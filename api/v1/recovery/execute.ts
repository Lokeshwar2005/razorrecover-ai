import type { IncomingMessage, ServerResponse } from 'http'
import { getTransactionAsync, upsertTransactionAsync } from '../store.js'

export interface VercelRequest extends IncomingMessage {
  body?: any
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
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
    if (!transaction_id) {
      res.status(422).json({ error: 'transaction_id is required' })
      return
    }

    const txn = await getTransactionAsync(transaction_id)
    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    const cleanId = txn.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const recoveryOpId = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${cleanId}`
    const orderId = `order_test_${cleanId.toLowerCase()}_${Date.now()}`

    const updated = await upsertTransactionAsync({
      ...txn,
      status: 'IN_PROGRESS',
      recovery_operation_id: recoveryOpId,
      provider_order_id: orderId,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${txn.id} [${recoveryOpId}] — awaiting Test Mode payment.`,
    })

    res.status(200).json({
      success: true,
      recovery_operation_id: recoveryOpId,
      action_type: action_type || txn.action,
      order_id: orderId,
      payment_link: null,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${txn.id} [${recoveryOpId}] — awaiting Test Mode payment.`,
      executed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Recovery execution failed' })
  }
}
