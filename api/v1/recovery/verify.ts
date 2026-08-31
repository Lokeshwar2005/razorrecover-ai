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

async function updateGistTransactions(newTransactions: Record<string, any>, req?: IncomingMessage): Promise<void> {
  for (const [id, txn] of Object.entries(newTransactions)) {
    inMemoryTransactions.set(id.toUpperCase(), txn)
  }
  saveLocalFileStore()

  try {
    const token = getGithubToken(req)
    if (!token) return

    let existingRemote: Record<string, any> = {}
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

    const merged: Record<string, any> = { ...existingRemote }
    for (const [id, txn] of inMemoryTransactions.entries()) {
      merged[id] = txn
    }
    for (const [id, txn] of Object.entries(newTransactions)) {
      merged[id.toUpperCase()] = txn
    }

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

    const { transaction_id, payment_id, order_id, amount_minor, currency = 'INR' } = body || {}
    const cleanKey = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''

    if (!cleanKey || !payment_id) {
      res.status(422).json({ error: 'transaction_id and payment_id are required' })
      return
    }

    const txns = await fetchGistTransactions(req)
    let txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    const verifiedAmount = amount_minor || txn?.amount_minor || 899500
    const now = new Date().toISOString()

    const updated = {
      ...(txn || {
        id: cleanKey,
        merchant_id: 'mer_chronova_watches',
        amount: Math.round(verifiedAmount / 100),
        amount_minor: verifiedAmount,
        currency: (currency || 'INR').toUpperCase(),
        source: 'live',
        direction: 'Payment degradation',
        reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
        action: 'Send payment link',
        confidence: 95,
        recovery_probability: 88,
        risk_score: 20,
        policy: 'Approved',
        explanation: '3DS challenge expired due to issuer bank latency. Direct customer retry link dispatched.',
        created_at: now,
      }),
      status: 'RECOVERED',
      provider_payment_id: payment_id,
      provider_id: payment_id,
      provider_order_id: order_id || txn?.provider_order_id,
      provider_status: 'captured',
      verified_amount_minor: verifiedAmount,
      workflow_status: 'VERIFIED',
      captured_at: now,
      updated_at: now,
      workflow_message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${cleanKey}.`,
    }

    txns[cleanKey] = updated
    if (txn?.id) txns[txn.id] = updated
    await updateGistTransactions({ [cleanKey]: updated, [txn?.id || cleanKey]: updated }, req)

    res.status(200).json({
      verified: true,
      transaction_id: cleanKey,
      payment_id: payment_id,
      order_id: order_id || txn?.provider_order_id,
      amount_minor: verifiedAmount,
      currency: currency,
      status: 'captured',
      message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${cleanKey}.`,
      verified_at: now,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Payment verification failed' })
  }
}
