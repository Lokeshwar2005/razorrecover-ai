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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const txns = await fetchGistTransactions(req)
    const list = Object.values(txns).filter((t: any) => {
      if (!t || !t.id) return false
      const isSynthetic = t.source === 'synthetic' || /^TXN-\d{3,4}$/i.test(t.id)
      return !isSynthetic
    })

    res.status(200).json({
      success: true,
      count: list.length,
      transactions: list,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal Server Error' })
  }
}
