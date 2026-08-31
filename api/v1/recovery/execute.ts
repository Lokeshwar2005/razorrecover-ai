import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  body?: any
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const RESTFUL_OBJECT_ID = 'ff808181a057a55b01a057bb444f003a'
const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'

let inMemoryTransactions: Map<string, any> = new Map()

async function fetchSharedTransactions(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`https://api.restful-api.dev/objects/${RESTFUL_OBJECT_ID}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      const txns = data?.data?.transactions
      if (txns && typeof txns === 'object') {
        for (const [id, txn] of Object.entries(txns)) {
          inMemoryTransactions.set(id, txn)
        }
      }
    }
  } catch (e) {}

  if (inMemoryTransactions.size === 0) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'RazorRecover-AI' },
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        const rawContent = data?.files?.[GIST_FILENAME]?.content
        if (rawContent) {
          const parsed = JSON.parse(rawContent)
          const remoteTxns = parsed?.transactions
          if (remoteTxns && typeof remoteTxns === 'object') {
            for (const [id, txn] of Object.entries(remoteTxns)) {
              inMemoryTransactions.set(id, txn)
            }
          }
        }
      }
    } catch (e) {}
  }

  const result: Record<string, any> = {}
  for (const [id, txn] of inMemoryTransactions.entries()) {
    result[id] = txn
  }
  return result
}

async function updateSharedTransactions(transactions: Record<string, any>): Promise<void> {
  for (const [id, txn] of Object.entries(transactions)) {
    inMemoryTransactions.set(id, txn)
  }

  try {
    await fetch(`https://api.restful-api.dev/objects/${RESTFUL_OBJECT_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: 'razorrecover_ledger',
        data: { transactions },
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch (e) {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    let body = req.body
    if (typeof body === 'string') body = JSON.parse(body)

    const { transaction_id, action_type } = body || {}
    const cleanKey = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''

    if (!cleanKey) {
      res.status(422).json({ error: 'transaction_id is required' })
      return
    }

    const txns = await fetchSharedTransactions()
    const txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    if (txn.status === 'RECOVERED') {
      res.status(409).json({
        error: 'Transaction is already recovered; recovery execution is blocked',
        transaction_id: txn.id,
        status: txn.status,
      })
      return
    }

    if (txn.status === 'IN_PROGRESS' && txn.recovery_operation_id && txn.provider_order_id) {
      res.status(200).json({
        success: true,
        duplicate: true,
        recovery_operation_id: txn.recovery_operation_id,
        action_type: action_type || txn.action,
        order_id: txn.provider_order_id,
        payment_link: null,
        workflow_status: txn.workflow_status || 'COMPLETE',
        workflow_message: txn.workflow_message || `Recovery already initialized for ${txn.id}.`,
        executed_at: txn.updated_at || txn.created_at,
      })
      return
    }

    const recoverableStatuses = new Set(['STOPPED', 'FAILED', 'PENDING'])
    if (!recoverableStatuses.has(String(txn.status || '').toUpperCase())) {
      res.status(409).json({
        error: `Transaction state ${txn.status || 'UNKNOWN'} is not recoverable`,
        transaction_id: txn.id,
        status: txn.status,
      })
      return
    }

    const cleanId = txn.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const recoveryOpId = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${cleanId}`
    const orderId = `order_test_${cleanId.toLowerCase()}_${Date.now()}`
    const executedAt = new Date().toISOString()

    const updated = {
      ...txn,
      status: 'IN_PROGRESS',
      recovery_operation_id: recoveryOpId,
      provider_order_id: orderId,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${txn.id} [${recoveryOpId}] — awaiting Test Mode payment.`,
      updated_at: executedAt,
    }

    txns[txn.id] = updated
    await updateSharedTransactions(txns)

    res.status(200).json({
      success: true,
      duplicate: false,
      recovery_operation_id: recoveryOpId,
      action_type: action_type || txn.action,
      order_id: orderId,
      payment_link: null,
      workflow_status: 'COMPLETE',
      workflow_message: updated.workflow_message,
      executed_at: executedAt,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Recovery execution failed' })
  }
}
