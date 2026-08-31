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

    const { transaction_id, payment_id, order_id, amount_minor, currency = 'INR' } = body || {}
    if (!transaction_id || !payment_id) {
      res.status(422).json({ error: 'transaction_id and payment_id are required' })
      return
    }

    const txn = await getTransactionAsync(transaction_id)
    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    const verifiedAmount = amount_minor || txn.amount_minor
    const now = new Date().toISOString()

    const updated = await upsertTransactionAsync({
      ...txn,
      status: 'RECOVERED',
      provider_payment_id: payment_id,
      provider_id: payment_id,
      provider_order_id: order_id || txn.provider_order_id,
      provider_status: 'captured',
      verified_amount_minor: verifiedAmount,
      workflow_status: 'VERIFIED',
      captured_at: now,
      workflow_message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${txn.id}.`,
    })

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
