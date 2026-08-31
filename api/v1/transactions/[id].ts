import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findChronovaTransaction } from '../../lib/db.js'

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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { id } = req.query
  const cleanId = (Array.isArray(id) ? id[0] : id || '').trim()

  if (!cleanId) {
    res.status(400).json({ error: 'Transaction ID is required' })
    return
  }

  try {
    const txn = await findChronovaTransaction(cleanId, req)

    if (!txn) {
      res.status(404).json({
        error: 'Not Found',
        message: `Transaction ${cleanId} not found in authoritative Chronova ledger`,
      })
      return
    }

    const legacyStatus = txn.status === 'RECOVERED' ? 'RECOVERED' : (txn.status === 'WAITING_FOR_RECOVERY' ? 'IN_PROGRESS' : 'STOPPED')

    res.status(200).json({
      ...txn,
      status: legacyStatus,
      raw_status: txn.status,
      transaction: txn,
      ai_diagnosis: txn.ai_diagnosis,
      policy_decision: txn.policy_decision,
      verifications: txn.verified_at ? [{ payment_id: txn.razorpay_payment_id, verified_at: txn.verified_at, amount_minor: txn.verified_amount_minor }] : [],
      audit_events: txn.audit_events || [],
    })
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message,
    })
  }
}
