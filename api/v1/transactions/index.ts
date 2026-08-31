import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'
const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_ledger_v11.json')

const ALLOWED_ORIGINS = [
  'https://lokeshwar2005.github.io',
  'https://razorrecover-ai-teal.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]

function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('github.io')
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'null')
      return false
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-github-token')
  return true
}

let inMemoryTransactions: Map<string, any> = new Map()

function getGithubToken(req?: IncomingMessage): string | null {
  const customHeader = req?.headers?.['x-github-token'] || req?.headers?.authorization
  if (customHeader) {
    const raw = Array.isArray(customHeader) ? customHeader[0] : customHeader
    const token = raw.replace(/^Bearer\s+/i, '').replace(/^token\s+/i, '').trim()
    if (token) return token
  }
  if (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN.trim()
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

  try {
    const token = getGithubToken(req)
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
    const txnsMap = await fetchGistTransactions(req)
    const liveItems = Object.values(txnsMap)

    res.status(200).json({
      transactions: liveItems,
      total: liveItems.length,
      page: 1,
      page_size: 50,
      total_pages: Math.ceil(liveItems.length / 50) || 1,
      has_more: false,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch transactions' })
  }
}
