import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { IncomingMessage } from 'http'
import fs from 'fs'
import path from 'path'

const REPO_OWNER = 'Lokeshwar2005'
const REPO_NAME = 'razorrecover-ai'
const REPO_FILE = 'data/ledger.json'
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
  if (!req?.headers) {
    return (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) ? process.env.GITHUB_TOKEN.trim() : null
  }
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

async function fetchRemoteLedger(req?: IncomingMessage): Promise<Record<string, any>> {
  loadLocalFileStore()
  const token = getGithubToken(req)

  if (token) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${REPO_FILE}?_t=${Date.now()}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'RazorRecover-AI-Serverless',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.ok) {
        const d = await res.json()
        if (d?.content) {
          const raw = Buffer.from(d.content, 'base64').toString('utf-8')
          const parsed = JSON.parse(raw)
          if (parsed?.transactions && typeof parsed.transactions === 'object') {
            for (const [id, txn] of Object.entries(parsed.transactions)) {
              inMemoryTransactions.set(id.toUpperCase(), txn)
            }
            saveLocalFileStore()
          }
        }
      }
    } catch (e) {}
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RazorRecover-AI-Serverless',
    }
    if (token) headers.Authorization = `token ${token}`
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}?_t=${Date.now()}`, {
      headers,
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      const rawContent = data?.files?.[GIST_FILENAME]?.content
      if (rawContent) {
        const parsed = JSON.parse(rawContent)
        if (parsed?.transactions && typeof parsed.transactions === 'object') {
          for (const [id, txn] of Object.entries(parsed.transactions)) {
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
    const txns = await fetchRemoteLedger(req)
    const list = Object.values(txns)

    res.status(200).json({
      success: true,
      count: list.length,
      transactions: list,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal Server Error' })
  }
}
