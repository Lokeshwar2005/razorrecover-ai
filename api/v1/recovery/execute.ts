import type { IncomingMessage, ServerResponse } from 'http'
import { fetchGistTransactions, updateGistTransactions } from '../../_lib/gistStore'

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
    const cleanKey = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''

    if (!cleanKey) {
      res.status(422).json({ error: 'transaction_id is required' })
      return
    }

    const txns = await fetchGistTransactions()
    const txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    // Recovery is a state transition, not a free-form operation.
    if (txn.status === 'RECOVERED') {
      res.status(409).json({
        error: 'Transaction is already recovered; recovery execution is blocked',
        transaction_id: txn.id,
        status: txn.status,
      })
      return
    }

    // Make repeated recovery clicks idempotent. Return the existing operation instead
    // of creating another order or changing the recovery operation ID.
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
    await updateGistTransactions(txns)

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
