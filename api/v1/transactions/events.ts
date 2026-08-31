import type { IncomingMessage, ServerResponse } from 'http'
import {
  FAILURE_SCENARIO_MAP,
  loadStore,
  saveStore,
  upsertTransaction,
  type ServerlessTransaction,
} from '../store.js'

export interface VercelRequest extends IncomingMessage {
  body?: any
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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
    if (typeof body === 'string') {
      body = JSON.parse(body)
    }

    const {
      transaction_id,
      merchant_id = 'mer_chronova_watches',
      order_id,
      payment_id,
      amount_minor,
      currency = 'INR',
      source = 'live',
      status = 'failed',
      provider = 'razorpay',
      method = 'card',
      failure_code,
      failure_reason,
      customer,
      metadata,
    } = body || {}

    if (!transaction_id || !amount_minor) {
      res.status(422).json({ error: 'transaction_id and amount_minor are required' })
      return
    }

    const isSuccess = status === 'captured' || status === 'recovered'
    const scenarioKey = metadata?.scenario_id || (failure_code ? Object.keys(FAILURE_SCENARIO_MAP).find((k) => FAILURE_SCENARIO_MAP[k].code === failure_code) : '3ds_timeout') || '3ds_timeout'
    const scenario = FAILURE_SCENARIO_MAP[scenarioKey] || FAILURE_SCENARIO_MAP['3ds_timeout']

    const now = new Date().toISOString()
    const amountRupees = Math.round(amount_minor / 100)

    const txn: ServerlessTransaction = {
      id: transaction_id,
      merchant_id,
      amount: amountRupees,
      amount_minor,
      currency: (currency || 'INR').toUpperCase(),
      source: 'live',
      status: isSuccess ? 'RECOVERED' : 'STOPPED',
      direction: isSuccess ? 'Direct settlement' : 'Payment degradation',
      reason: isSuccess ? 'Payment successful on first attempt' : (failure_reason || scenario.reason),
      action: isSuccess ? 'Direct settlement' : scenario.action,
      confidence: isSuccess ? 99 : scenario.confidence,
      recovery_probability: isSuccess ? 100 : scenario.recoveryProb,
      risk_score: isSuccess ? 5 : scenario.riskScore,
      policy: 'Approved',
      explanation: isSuccess
        ? `Customer authorized ₹${amountRupees.toLocaleString('en-IN')} via direct checkout.`
        : (scenario.explanation || `Payment degradation detected: ${scenario.reason}. Automated recovery initialized.`),
      latency: '180ms',
      created_at: now,
      updated_at: now,
      provider: provider || 'razorpay',
      provider_id: payment_id || order_id,
      provider_payment_id: payment_id,
      provider_order_id: order_id,
      provider_status: isSuccess ? 'captured' : 'failed',
      verified_amount_minor: isSuccess ? amount_minor : 0,
      workflow_status: isSuccess ? 'VERIFIED' : undefined,
      customer,
      metadata,
    }

    upsertTransaction(txn)

    res.status(200).json({
      success: true,
      transaction_id: txn.id,
      status: txn.status,
      opportunity_id: `opp-${txn.id}`,
      message: `Transaction ${txn.id} successfully ingested into authoritative backend ledger.`,
      created_at: txn.created_at,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to ingest transaction event' })
  }
}
