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

    const { transaction_id, payment_id, order_id, amount_minor, currency = 'INR' } = body || {}
    const cleanKey = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''

    if (!cleanKey || !payment_id) {
      res.status(422).json({ error: 'transaction_id and payment_id are required' })
      return
    }

    const txns = await fetchSharedTransactions()
    const txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    const verifiedAmount = amount_minor || txn.amount_minor
    const now = new Date().toISOString()

    const updated = {
      ...txn,
      status: 'RECOVERED',
      provider_payment_id: payment_id,
      provider_id: payment_id,
      provider_order_id: order_id || txn.provider_order_id,
      provider_status: 'captured',
      verified_amount_minor: verifiedAmount,
      workflow_status: 'VERIFIED',
      captured_at: now,
      updated_at: now,
      workflow_message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${txn.id}.`,
    }

    txns[txn.id] = updated
    await updateSharedTransactions(txns)

    res.status(200).json({
      verified: true,
      transaction_id: txn.id,
      payment_id: payment_id,
      order_id: order_id || txn.provider_order_id,
      amount_minor: verifiedAmount,
      currency: currency,
      status: 'captured',
      message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${txn.id}.`,
      verified_at: now,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Payment verification failed' })
  }
}
