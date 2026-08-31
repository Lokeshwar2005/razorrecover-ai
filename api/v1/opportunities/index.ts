import type { IncomingMessage, ServerResponse } from 'http'
import { loadStore } from '../store'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
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
    const store = loadStore()
    const transactions = Array.from(store.values())

    const opportunities = transactions.map((t) => {
      const rawVal = (t.amount_minor * t.recovery_probability) / 100
      const expectedValueMinor = Math.round(rawVal)
      const priorityScore = Math.min(
        99,
        Math.round(
          (expectedValueMinor / 5000000) * 40 +
            (t.recovery_probability / 100) * 35 +
            (1 - t.risk_score / 100) * 25
        )
      )

      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      if (expectedValueMinor >= 2000000 && t.policy === 'Approved') priority = 'CRITICAL'
      else if (expectedValueMinor >= 1000000) priority = 'HIGH'
      else if (expectedValueMinor >= 400000) priority = 'MEDIUM'

      return {
        id: `opp-${t.id}`,
        opportunity_id: `opp-${t.id}`,
        transaction_id: t.id,
        amount_minor: t.amount_minor,
        currency: t.currency,
        failure_signature: t.reason,
        recovery_probability: t.recovery_probability,
        expected_value_minor: expectedValueMinor,
        expected_recovery_value_minor: expectedValueMinor,
        priority_score: priorityScore,
        priority_level: priority,
        priority: priority,
        recommended_action: t.action,
        best_safe_action: t.action,
        policy_status: t.policy,
        reason: t.reason,
        risk_score: t.risk_score,
        status: t.status === 'RECOVERED' ? 'RECOVERED' : t.policy === 'Blocked' ? 'POLICY_BLOCKED' : 'ELIGIBLE',
        recovery_operation_id: t.recovery_operation_id,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }
    })

    res.status(200).json(opportunities)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch opportunities' })
  }
}
