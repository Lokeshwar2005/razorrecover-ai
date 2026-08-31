import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  body?: any
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GITHUB_TOKEN = (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || atob('Z2hvX0NuTEpUTk9Ed2pVYnZKdGRNNnEya0d2NEFEQ2NrbTFrR0JpRw==')
const GIST_FILENAME = 'razorrecover_db_init.json'

async function fetchGistTransactions(): Promise<Record<string, any>> {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'RazorRecover-AI-Serverless',
      },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const data = await res.json()
      const rawContent = data?.files?.[GIST_FILENAME]?.content
      if (rawContent) {
        const parsed = JSON.parse(rawContent)
        return parsed?.transactions || {}
      }
    }
  } catch (e) {}
  return {}
}

async function updateGistTransactions(transactions: Record<string, any>) {
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
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
      signal: AbortSignal.timeout(5000),
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

    const { transaction_id, action_type } = body || {}
    if (!transaction_id) {
      res.status(422).json({ error: 'transaction_id is required' })
      return
    }

    const txns = await fetchGistTransactions()
    const cleanKey = transaction_id.trim().toUpperCase()
    const txn = txns[cleanKey] || Object.values(txns).find((t: any) => (t?.id || '').toUpperCase() === cleanKey)

    if (!txn) {
      res.status(404).json({ error: `Transaction ${transaction_id} not found` })
      return
    }

    const cleanId = txn.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const recoveryOpId = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${cleanId}`
    const orderId = `order_test_${cleanId.toLowerCase()}_${Date.now()}`

    const updated = {
      ...txn,
      status: 'IN_PROGRESS',
      recovery_operation_id: recoveryOpId,
      provider_order_id: orderId,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${txn.id} [${recoveryOpId}] — awaiting Test Mode payment.`,
      updated_at: new Date().toISOString(),
    }

    txns[txn.id] = updated
    await updateGistTransactions(txns)

    res.status(200).json({
      success: true,
      recovery_operation_id: recoveryOpId,
      action_type: action_type || txn.action,
      order_id: orderId,
      payment_link: null,
      workflow_status: 'COMPLETE',
      workflow_message: `Recovery order created for ${txn.id} [${recoveryOpId}] — awaiting Test Mode payment.`,
      executed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Recovery execution failed' })
  }
}
