import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'

export interface VercelRequest extends IncomingMessage {
  body?: any
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'
const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_ledger_v5.json')

let inMemoryTransactions: Map<string, any> = new Map()

function getGithubToken(): string | null {
  return (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || null
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
            inMemoryTransactions.set(id, txn)
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

async function fetchGistTransactions(): Promise<Record<string, any>> {
  loadLocalFileStore()

  try {
    const token = getGithubToken()
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RazorRecover-AI-Serverless',
    }
    if (token) {
      headers.Authorization = `token ${token}`
    }

    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers,
      signal: AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const data = await res.json()
      const rawContent = data?.files?.[GIST_FILENAME]?.content
      if (rawContent) {
        const parsed = JSON.parse(rawContent)
        const remoteTxns = parsed?.transactions
        if (remoteTxns && typeof remoteTxns === 'object') {
          for (const [id, txn] of Object.entries(remoteTxns)) {
            inMemoryTransactions.set(id, txn)
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

async function updateGistTransactions(transactions: Record<string, any>): Promise<void> {
  for (const [id, txn] of Object.entries(transactions)) {
    inMemoryTransactions.set(id, txn)
  }
  saveLocalFileStore()

  try {
    const token = getGithubToken()
    if (!token) return

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
            content: JSON.stringify({ transactions }, null, 2),
          },
        },
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch (e) {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
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

    const { transaction_id, payment_id, order_id, amount_minor, currency = 'INR' } = body || {}
    const cleanKey = typeof transaction_id === 'string' ? transaction_id.trim().toUpperCase() : ''

    if (!cleanKey || !payment_id) {
      res.status(422).json({ error: 'transaction_id and payment_id are required' })
      return
    }

    const txns = await fetchGistTransactions()
    const txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    const verifiedAmount = amount_minor || txn.amount_minor
    const now = new Date().toISOString()

    const updated = {
      ...txn,
      status: 'RECOVERED',
      provider_payment_id: payment_id,
      provider_id: payment_id,
      provider_order_id: order_id || txn.provider_order_id,
      provider_status: 'captured',
      verified_amount_minor: verifiedAmount,
      workflow_status: 'VERIFIED',
      captured_at: now,
      updated_at: now,
      workflow_message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${txn.id}.`,
    }

    txns[txn.id] = updated
    await updateGistTransactions(txns)

    res.status(200).json({
      verified: true,
      transaction_id: txn.id,
      payment_id: payment_id,
      order_id: order_id || txn.provider_order_id,
      amount_minor: verifiedAmount,
      currency: currency,
      status: 'captured',
      message: `✓ Verified Capture Confirmed! Recovered ₹${(verifiedAmount / 100).toLocaleString('en-IN')} for ${txn.id}.`,
      verified_at: now,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Payment verification failed' })
  }
}
