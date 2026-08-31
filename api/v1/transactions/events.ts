import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { IncomingMessage } from 'http'
import fs from 'fs'
import path from 'path'

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'
const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_ledger_v11.json')

const inMemoryTransactions = new Map<string, any>()

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

function getGithubToken(req?: IncomingMessage): string | null {
  if (req?.headers) {
    const headers = req.headers
    const customHeader =
      headers['x-github-token'] ||
      headers['X-GitHub-Token'] ||
      headers['x-token'] ||
      headers['authorization'] ||
      headers['Authorization']

    if (customHeader) {
      const raw = Array.isArray(customHeader) ? customHeader[0] : customHeader
      const token = raw.replace(/^Bearer\s+/i, '').replace(/^token\s+/i, '').trim()
      if (token) return token
    }
  }
  if (typeof process !== 'undefined') {
    const envToken = process.env?.GIST_TOKEN || process.env?.GITHUB_TOKEN || process.env?.GH_TOKEN
    if (envToken && envToken.trim()) return envToken.trim()
  }
  return null
}

function loadLocalFileStore(): Map<string, any> {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const txns = parsed.transactions || parsed
        if (typeof txns === 'object') {
          for (const [id, txn] of Object.entries(txns)) {
            inMemoryTransactions.set(id.toUpperCase(), txn)
          }
        }
      }
    }
  } catch (e) {}
  return inMemoryTransactions
}

function saveLocalFileStore() {
  try {
    const obj: Record<string, any> = {}
    for (const [id, txn] of inMemoryTransactions.entries()) {
      obj[id] = txn
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify({ transactions: obj }, null, 2), 'utf-8')
  } catch (e) {}
}

async function fetchGistTransactions(req?: IncomingMessage): Promise<Record<string, any>> {
  loadLocalFileStore()
  const token = getGithubToken(req)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RazorRecover-AI-Serverless',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    }
    if (token) {
      headers.Authorization = `token ${token}`
    }

    const res = await fetch(`https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    })

    if (res.ok) {
      const data = await res.json()
      const rawContent = data?.files?.[GIST_FILENAME]?.content
      if (rawContent) {
        const parsed = JSON.parse(rawContent)
        const remoteTxns = parsed?.transactions
        if (remoteTxns && typeof remoteTxns === 'object') {
          for (const [id, txn] of Object.entries(remoteTxns)) {
            inMemoryTransactions.set(id.toUpperCase(), txn)
          }
          saveLocalFileStore()
        }
      }
    }
  } catch (e) {}

  const result: Record<string, any> = {}
  for (const [id, txn] of inMemoryTransactions.entries()) {
    result[id] = txn
  }
  return result
}

async function updateGistTransactionsAtomic(
  targetId: string,
  newTxn: any,
  req?: IncomingMessage
): Promise<{ isDuplicate: boolean; existingRecord?: any }> {
  const cleanTarget = targetId.toUpperCase()
  loadLocalFileStore()

  if (inMemoryTransactions.has(cleanTarget)) {
    return { isDuplicate: true, existingRecord: inMemoryTransactions.get(cleanTarget) }
  }

  const token = getGithubToken(req)
  let existingRemote: Record<string, any> = {}

  if (token) {
    try {
      const getRes = await fetch(`https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'RazorRecover-AI-Serverless',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (getRes.ok) {
        const d = await getRes.json()
        const raw = d?.files?.[GIST_FILENAME]?.content
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.transactions && typeof parsed.transactions === 'object') {
            existingRemote = parsed.transactions
          }
        }
      }
    } catch (e) {}
  }

  if (existingRemote[cleanTarget]) {
    inMemoryTransactions.set(cleanTarget, existingRemote[cleanTarget])
    saveLocalFileStore()
    return { isDuplicate: true, existingRecord: existingRemote[cleanTarget] }
  }

  inMemoryTransactions.set(cleanTarget, newTxn)
  saveLocalFileStore()

  const merged: Record<string, any> = { ...existingRemote }
  for (const [id, txn] of inMemoryTransactions.entries()) {
    merged[id] = txn
  }
  merged[cleanTarget] = newTxn

  if (token) {
    try {
      await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'RazorRecover-AI-Serverless',
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify({ transactions: merged }, null, 2),
            },
          },
        }),
        signal: AbortSignal.timeout(4000),
      })
    } catch (e) {}
  }

  return { isDuplicate: false, existingRecord: newTxn }
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
    explanation: 'Card decline due to temporary limit. Split payment link provisioned.',
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
  const originAllowed = applyCors(req, res)

  if (req.method === 'OPTIONS') {
    if (!originAllowed && req.headers.origin) {
      res.status(403).json({ error: 'Origin not allowed by CORS' })
      return
    }
    res.status(204).end()
    return
  }

  if (!originAllowed && req.headers.origin) {
    res.status(403).json({ error: 'Origin not allowed by CORS' })
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
      provider = 'razorpay',
      failure_code,
      failure_reason,
      customer,
      metadata,
    } = body || {}

    const cleanId = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''
    const numericAmount = Number(amount_minor)

    if (!cleanId || Number.isNaN(numericAmount) || numericAmount <= 0) {
      res.status(422).json({ error: 'transaction_id and positive numeric amount_minor are required' })
      return
    }

    const currentMap = await fetchGistTransactions(req)
    const existing = currentMap[cleanId] || Object.values(currentMap).find((t: any) => (t?.id || '').toUpperCase() === cleanId)

    if (existing) {
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

    const scenarioKey = metadata?.scenario_id || (failure_code ? Object.keys(FAILURE_SCENARIOS).find((k) => FAILURE_SCENARIOS[k].code === failure_code) : '3ds_timeout') || '3ds_timeout'
    const scenario = FAILURE_SCENARIOS[scenarioKey] || FAILURE_SCENARIOS['3ds_timeout']

    const now = new Date().toISOString()
    const newTxn = {
      id: cleanId,
      merchant_id: merchant_id,
      amount: Math.round(numericAmount / 100),
      amount_minor: numericAmount,
      currency: currency.toUpperCase(),
      source: source || 'live',
      status: 'STOPPED',
      direction: 'Payment degradation',
      reason: failure_reason || scenario.reason,
      action: scenario.action,
      confidence: scenario.confidence,
      recovery_probability: scenario.recoveryProb,
      risk_score: scenario.riskScore,
      policy: 'Approved',
      explanation: scenario.explanation,
      latency: '180ms',
      created_at: now,
      updated_at: now,
      provider: provider || 'razorpay',
      provider_id: payment_id || order_id || `pay_${cleanId}`,
      provider_payment_id: payment_id || `pay_${cleanId}`,
      provider_order_id: order_id || `order_${cleanId}`,
      provider_status: 'failed',
      verified_amount_minor: 0,
      customer: customer || {
        name: 'Lokeshwar Sudam',
        email: 'customer@chronova.example.com',
        phone: '+919876543210',
      },
      metadata: {
        ...(metadata || {}),
        failure_code: failure_code || scenario.code,
        failure_reason: failure_reason || scenario.reason,
      },
      audit_events: [
        {
          id: `audit-${cleanId}-01`,
          event_type: 'FAILURE_INGESTED',
          actor: 'RazorRecover Ingestion Gateway',
          decision: 'STOPPED',
          reason: failure_reason || scenario.reason,
          timestamp: now,
        },
      ],
    }

    const { isDuplicate, existingRecord } = await updateGistTransactionsAtomic(cleanId, newTxn, req)

    res.status(200).json({
      success: true,
      duplicate: isDuplicate,
      transaction_id: existingRecord.id,
      status: existingRecord.status,
      opportunity_id: `opp-${existingRecord.id}`,
      message: isDuplicate
        ? `Transaction ${existingRecord.id} was already ingested concurrently.`
        : `Transaction ${existingRecord.id} successfully ingested into authoritative backend ledger.`,
      created_at: existingRecord.created_at,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal Server Error' })
  }
}
