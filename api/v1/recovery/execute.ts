import type { VercelRequest, VercelResponse } from '@vercel/node'
import { executeChronovaRecovery, findChronovaTransaction } from '../../lib/db.js'

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
    action_type = 'Send payment link',
    order_id,
  } = req.body || {}

  const rawId = (transaction_id || order_id || '').trim()
  if (!rawId) {
    res.status(400).json({ error: 'transaction_id is required' })
    return
  }

  try {
    const { transaction, recovery_operation_id, duplicate } = await executeChronovaRecovery(
      rawId,
      action_type,
      req
    )

    res.status(200).json({
      success: true,
      duplicate,
      recovery_operation_id,
      action_type: transaction.action,
      order_id: transaction.chronova_order_id || transaction.razorpay_order_id,
      payment_link: null,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${transaction.id} [${recovery_operation_id}] — awaiting Test Mode payment.`,
      executed_at: transaction.updated_at,
    })
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message,
    })
  }
}
