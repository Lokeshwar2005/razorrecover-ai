import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  body?: unknown
  query?: Record<string, string | string[]>
  cookies?: Record<string, string>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => this
}

type Transaction = {
  id: string
  amount: number
  reason: string
  confidence: number
  recoveryProbability: number
  riskScore: number
  policy: 'Approved' | 'Escalated'
  action: string
  result: 'Recovered' | 'Stopped' | 'Pending'
  explanation: string
}

const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function send(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body)
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function boundedAction(action: unknown, transaction: Transaction): string {
  const allowed = new Set(['Retry payment', 'Payment link', 'Customer prompt', 'Escalate'])
  const normalized = typeof action === 'string' ? action.trim() : ''
  if (!allowed.has(normalized)) return transaction.policy === 'Approved' ? transaction.action : 'Escalate'
  return normalized
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    send(res, 500, { error: 'OPENROUTER_API_KEY is not configured on the server' })
    return
  }

  const body = req.body as { transaction?: Transaction } | undefined
  const transaction = body?.transaction

  if (!transaction || typeof transaction.id !== 'string' || typeof transaction.amount !== 'number') {
    send(res, 400, { error: 'A valid transaction context is required' })
    return
  }

  const prompt = `You are the AI diagnosis layer for RazorRecover AI, a synthetic payment-recovery buildathon prototype.

The deterministic recovery engine is the source of truth. You must NOT invent, modify, or override transaction facts, risk limits, policy decisions, retry boundaries, or execution authority. Diagnose the failure and recommend one bounded intervention only.

Transaction context:
${JSON.stringify(transaction, null, 2)}

Allowed actions: Retry payment, Payment link, Customer prompt, Escalate.

Return ONLY valid JSON with exactly these fields:
{
  "diagnosis": "short diagnosis",
  "rootCause": "short root cause",
  "recommendedAction": "one allowed action",
  "recoveryProbability": number from 0 to 100,
  "riskAssessment": "Low|Medium|High",
  "confidence": number from 0 to 100,
  "explanation": "one concise explanation"
}

Use the supplied transaction facts as the basis. If policy is Escalated or the transaction is Stopped, recommend Escalate and do not suggest executing a recovery action.`

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lokeshwar2005.github.io/razorrecover-ai/',
        'X-Title': 'RazorRecover AI',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: 'system', content: 'You are a precise financial-recovery diagnosis assistant. Output JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    if (!upstream.ok) {
      send(res, upstream.status, { error: data.error?.message || 'OpenRouter request failed' })
      return
    }

    const content = data.choices?.[0]?.message?.content || ''
    const ai = extractJson(content)
    if (!ai) {
      send(res, 502, { error: 'AI returned an invalid structured response' })
      return
    }

    const recommendedAction = boundedAction(ai.recommendedAction, transaction)
    const policyAlignment = transaction.policy === 'Approved' && recommendedAction === transaction.action
      ? 'aligned'
      : transaction.policy === 'Escalated' || recommendedAction === 'Escalate'
        ? 'escalate'
        : 'conflict'

    const executionAllowed = transaction.policy === 'Approved'
      && transaction.result !== 'Stopped'
      && policyAlignment === 'aligned'

    send(res, 200, {
      provider: 'openrouter',
      model: MODEL,
      diagnosis: typeof ai.diagnosis === 'string' ? ai.diagnosis : transaction.reason,
      rootCause: typeof ai.rootCause === 'string' ? ai.rootCause : transaction.reason,
      recommendation: recommendedAction,
      recommendedAction,
      recoveryProbability: Math.max(0, Math.min(100, Number(ai.recoveryProbability) || transaction.recoveryProbability)),
      riskAssessment: typeof ai.riskAssessment === 'string' ? ai.riskAssessment : transaction.riskScore < 40 ? 'Low' : transaction.riskScore < 70 ? 'Medium' : 'High',
      confidence: Math.max(0, Math.min(100, Number(ai.confidence) || transaction.confidence)),
      policyAlignment,
      policyReason: executionAllowed
        ? 'AI recommendation matches the deterministic policy decision and bounded action.'
        : 'Deterministic policy remains authoritative; the recommendation cannot override a blocked or conflicting action.',
      executionAllowed,
      explanation: typeof ai.explanation === 'string' ? ai.explanation : transaction.explanation,
    })
  } catch (error) {
    send(res, 502, { error: error instanceof Error ? error.message : 'Unable to reach OpenRouter' })
  }
}
