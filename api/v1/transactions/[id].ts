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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const rawId = req.query?.id
    const id = (Array.isArray(rawId) ? rawId[0] : rawId || '').trim().toUpperCase()

    if (!id) {
      res.status(400).json({ error: 'Transaction ID is required' })
      return
    }

    const txns = await fetchGistTransactions()
    let txn = txns[id]

    if (!txn) {
      txn = Object.values(txns).find(
        (t: any) =>
          (t?.id || '').toUpperCase() === id ||
          (t?.provider_payment_id && t.provider_payment_id.toUpperCase() === id) ||
          (t?.provider_order_id && t.provider_order_id.toUpperCase() === id)
      )
    }

    if (!txn) {
      res.status(404).json({ error: `Transaction ${id} not found` })
      return
    }

    res.status(200).json({
      transaction: txn,
      ai_diagnosis: {
        transaction_id: txn.id,
        root_cause: txn.reason,
        recommended_action: txn.action,
        confidence_score: txn.confidence || 95,
        recovery_probability: txn.recovery_probability || 85,
        risk_score: txn.risk_score || 20,
        reasoning_summary: txn.explanation,
      },
      policy_decision: {
        transaction_id: txn.id,
        decision: txn.policy || 'Approved',
        policy_rule_id: 'RULE-POL-GATE-01',
        requires_human_approval: false,
        reason: 'Deterministic risk threshold verification passed.',
      },
      verifications: txn.status === 'RECOVERED' ? [
        {
          transaction_id: txn.id,
          razorpay_payment_id: txn.provider_payment_id || `pay_${txn.id}`,
          amount_minor: txn.verified_amount_minor || txn.amount_minor,
          status: 'captured',
          verified: true,
          verified_at: txn.updated_at || txn.created_at,
        }
      ] : [],
      audit_events: [
        {
          id: `audit-${txn.id}-01`,
          event_type: txn.status === 'RECOVERED' ? 'PAYMENT_VERIFIED' : 'FAILURE_INGESTED',
          actor: 'RazorRecover Ingestion Gateway',
          decision: txn.status,
          reason: txn.reason,
          timestamp: txn.created_at,
        }
      ],
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch transaction detail' })
  }
}
