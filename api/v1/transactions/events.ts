import type { VercelRequest, VercelResponse } from '@vercel/node'
import { upsertChronovaEvent, findChronovaTransaction, verifyChronovaPaymentCapture } from '../../lib/db.js'

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/lokeshwar2005\.github\.io$/,
  /^https:\/\/razorrecover-ai-.*\.vercel\.app$/,
  /^https:\/\/razorrecover-.*\.vercel\.app$/,
  /^https:\/\/razorrecover-ai-teal\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
]

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin as string | undefined
  const allowed = isOriginAllowed(origin)

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-github-token, X-GitHub-Token, x-token, Accept')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  return allowed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowed = applyCors(req, res)

  if (req.method === 'OPTIONS') {
    if (!allowed) {
      res.status(403).json({ error: 'Origin not allowed by CORS' })
      return
    }
    res.status(204).end()
    return
  }

  if (!allowed) {
    res.status(403).json({ error: 'Origin not allowed by CORS' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const payload = req.body || {}
  const rawId = payload.transaction_id || payload.chronova_order_id || payload.order_id

  if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
    res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'transaction_id or order_id is required',
    })
    return
  }

  const rawAmountMinor = payload.amount_minor !== undefined ? payload.amount_minor : (payload.amount !== undefined ? payload.amount * 100 : undefined)
  if (rawAmountMinor === undefined || rawAmountMinor === null || isNaN(Number(rawAmountMinor)) || Number(rawAmountMinor) <= 0) {
    res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'amount_minor must be a positive integer',
    })
    return
  }

  try {
    const isCaptured =
      payload.status === 'captured' ||
      payload.status === 'RECOVERED' ||
      payload.status === 'paid'

    if (isCaptured) {
      const pId = payload.payment_id || `pay_direct_${Date.now().toString(36)}`
      const { transaction } = await verifyChronovaPaymentCapture(
        rawId.trim(),
        pId,
        payload.chronova_order_id || payload.order_id,
        Number(rawAmountMinor),
        payload.signature,
        req
      )
      res.status(200).json({
        success: true,
        duplicate: false,
        transaction_id: transaction.id,
        status: 'RECOVERED',
        opportunity_id: `opp-${transaction.id}`,
        message: `Transaction ${transaction.id} captured and recorded in RECOVERED state.`,
        created_at: transaction.created_at,
      })
      return
    }

    const { transaction, duplicate } = await upsertChronovaEvent(
      {
        transaction_id: rawId.trim(),
        chronova_order_id: payload.chronova_order_id || payload.order_id,
        chronova_customer_id: payload.chronova_customer_id || payload.customer?.email,
        order_id: payload.order_id,
        payment_id: payload.payment_id,
        amount_minor: Number(rawAmountMinor),
        currency: payload.currency || 'INR',
        status: 'failed',
        failure_code: payload.failure_code,
        failure_reason: payload.failure_reason,
        customer: payload.customer,
        metadata: payload.metadata,
      },
      req
    )

    res.status(200).json({
      success: true,
      duplicate,
      transaction_id: transaction.id,
      status: transaction.status === 'RECOVERED' ? 'RECOVERED' : 'STOPPED',
      opportunity_id: `opp-${transaction.id}`,
      message: duplicate
        ? `Transaction ${transaction.id} was already ingested; existing ledger record returned unchanged.`
        : `Transaction ${transaction.id} successfully ingested into authoritative backend ledger.`,
      created_at: transaction.created_at,
    })
  }
 catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message,
    })
  }
}
