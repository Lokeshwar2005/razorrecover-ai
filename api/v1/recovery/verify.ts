import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyChronovaPaymentCapture } from '../../lib/db.js'

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

  const {
    transaction_id,
    razorpay_payment_id,
    payment_id,
    razorpay_order_id,
    order_id,
    amount_minor,
    amount,
    signature,
    razorpay_signature,
  } = req.body || {}

  const pId = razorpay_payment_id || payment_id
  const oId = razorpay_order_id || order_id
  const tId = transaction_id || oId || pId

  if (!pId) {
    res.status(400).json({ error: 'razorpay_payment_id is required for verification' })
    return
  }

  const parsedMinor = amount_minor !== undefined ? Number(amount_minor) : (amount !== undefined ? Number(amount) * 100 : undefined)

  try {
    const { transaction, verified } = await verifyChronovaPaymentCapture(
      tId,
      pId,
      oId,
      parsedMinor,
      signature || razorpay_signature,
      req
    )

    res.status(200).json({
      verified: true,
      transaction_id: transaction.id,
      payment_id: pId,
      order_id: transaction.chronova_order_id || oId,
      amount_minor: transaction.verified_amount_minor,
      currency: transaction.currency,
      status: 'captured',
      message: `✓ Verified Capture Confirmed! Recovered ₹${(transaction.verified_amount_minor / 100).toLocaleString('en-IN')} for ${transaction.id}.`,
      verified_at: transaction.verified_at,
    })
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message,
    })
  }
}
