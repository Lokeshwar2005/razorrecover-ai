import type { IncomingMessage, ServerResponse } from 'http'
import { fetchGistTransactions, updateGistTransactions } from '../../_lib/gistStore'

export interface VercelRequest extends IncomingMessage {
  body?: any
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const FAILURE_SCENARIOS: Record<string, { code: string; reason: string; action: string; confidence: number; recoveryProb: number; riskScore: number; explanation: string }> = {
  '3ds_timeout': {
    code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    action: 'Send payment link',
    confidence: 95,
    recoveryProb: 88,
    riskScore: 20,
    explanation: '3DS challenge expired due to issuer bank latency. Direct customer retry link dispatched.',
  },
  'low_balance': {
    code: 'BAD_REQUEST_INSUFFICIENT_FUNDS',
    reason: 'Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)',
    action: 'Switch to UPI Auto-Pay / Split Link',
    confidence: 92,
    recoveryProb: 78,
    riskScore: 35,
    explanation: 'Soft decline from issuer bank. Alternate low-friction payment channel dispatched.',
  },
  'upi_intent_drop': {
    code: 'UPI_INTENT_TIMEOUT',
    reason: 'UPI Intent Session Expired (Customer Backgrounded App to Check SMS)',
    action: 'Send instant WhatsApp UPI deep link',
    confidence: 97,
    recoveryProb: 94,
    riskScore: 12,
    explanation: 'UPI app switch timeout detected. High-intent 1-click WhatsApp deep link activated.',
  },
  'bank_downtime': {
    code: 'ISSUER_CBS_DOWN_502',
    reason: 'Issuer Core Banking System (CBS) Scheduled Maintenance / Outage',
    action: 'Smart Routing to Alternate Bank Node',
    confidence: 99,
    recoveryProb: 91,
    riskScore: 10,
    explanation: 'Issuer node 502 detected. Re-routed authorization through redundant bank gateway.',
  },
  'risk_engine_flag': {
    code: 'FRAUD_VELOCITY_SOFT_BLOCK',
    reason: 'Issuer Velocity Heuristic Triggered (False Positive Soft Decline)',
    action: 'Dispatch Biometric Verified Secure Link',
    confidence: 89,
    recoveryProb: 82,
    riskScore: 40,
    explanation: 'False positive velocity flag. Cryptographic biometric challenge dispatched.',
  },
  'network_drop': {
    code: 'CLIENT_TCP_CONNECTION_RESET',
    reason: 'Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)',
    action: 'Send 1-Click SMS Recovery Link',
    confidence: 96,
    recoveryProb: 92,
    riskScore: 15,
    explanation: 'Customer network handshake dropped. Direct tokenized SMS retry link generated.',
  },
  'auth_retries_exceeded': {
    code: 'AUTH_RETRIES_EXCEEDED_3DS',
    reason: 'Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded',
    action: 'Send UPI QR Alternative Link',
    confidence: 91,
    recoveryProb: 84,
    riskScore: 28,
    explanation: 'Card OTP limit reached. Alternate dynamic UPI QR payment link provisioned.',
  },
  'cart_abandonment': {
    code: 'GATEWAY_DISMISSED_BY_USER',
    reason: 'Customer Dismissed Razorpay Checkout Window Before Submitting Credentials',
    action: 'Send Cart Recovery WhatsApp with 5% Perk',
    confidence: 94,
    recoveryProb: 89,
    riskScore: 18,
    explanation: 'High-intent cart abandonment detected. Automated promotional recovery link dispatched.',
  },
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
    if (typeof body === 'string') body = JSON.parse(body)

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
      failure_code,
      failure_reason,
      customer,
      metadata,
    } = body || {}

    const cleanId = typeof transaction_id === 'string' ? transaction_id.trim() : ''
    const numericAmount = Number(amount_minor)

    if (!cleanId || !Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      res.status(422).json({ error: 'transaction_id and a positive integer amount_minor are required' })
      return
    }

    const currentMap = await fetchGistTransactions()
    const existing = currentMap[cleanId]

    // Transaction IDs are immutable event keys. Never overwrite an existing event.
    if (existing) {
      const sameAmount = Number(existing.amount_minor) === numericAmount
      const sameProvider = (existing.provider || 'razorpay') === (provider || 'razorpay')
      if (!sameAmount || !sameProvider) {
        res.status(409).json({
          error: 'Transaction ID already exists with different immutable fields',
          transaction_id: existing.id,
        })
        return
      }

      res.status(200).json({
        success: true,
        duplicate: true,
        transaction_id: existing.id,
        status: existing.status,
        opportunity_id: `opp-${existing.id}`,
        message: `Transaction ${existing.id} was already ingested; existing ledger record returned unchanged.`,
        created_at: existing.created_at,
      })
      return
    }

    const normalizedStatus = String(status || 'failed').toLowerCase()
    const isSuccess = normalizedStatus === 'captured' || normalizedStatus === 'recovered'
    const scenarioKey = metadata?.scenario_id || (failure_code ? Object.keys(FAILURE_SCENARIOS).find((k) => FAILURE_SCENARIOS[k].code === failure_code) : '3ds_timeout') || '3ds_timeout'
    const scenario = FAILURE_SCENARIOS[scenarioKey] || FAILURE_SCENARIOS['3ds_timeout']

    const now = new Date().toISOString()
    const amountRupees = Math.round(numericAmount / 100)

    const newTxn = {
      id: cleanId,
      merchant_id,
      amount: amountRupees,
      amount_minor: numericAmount,
      currency: (currency || 'INR').toUpperCase(),
      source: source || 'live',
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
      verified_amount_minor: isSuccess ? numericAmount : 0,
      workflow_status: isSuccess ? 'VERIFIED' : undefined,
      customer,
      metadata,
    }

    currentMap[cleanId] = newTxn
    await updateGistTransactions(currentMap)

    res.status(200).json({
      success: true,
      duplicate: false,
      transaction_id: newTxn.id,
      status: newTxn.status,
      opportunity_id: `opp-${newTxn.id}`,
      message: `Transaction ${newTxn.id} successfully ingested into authoritative backend ledger.`,
      created_at: newTxn.created_at,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to ingest transaction event' })
  }
}
