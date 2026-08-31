import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const CLOUD_LEDGER_URL = 'https://api.restful-api.dev/objects/ff808181a04ccf2d01a0577582f02660'

async function fetchCloudTransactions(): Promise<any[]> {
  try {
    const res = await fetch(CLOUD_LEDGER_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const json = await res.json()
      const txns = json?.data?.transactions
      if (txns && typeof txns === 'object') {
        return Object.values(txns)
      }
    }
  } catch (e) {}
  return []
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
    const transactions = await fetchCloudTransactions()

    const opportunities = transactions.map((t: any) => {
      const amountMinor = t?.amount_minor || (t?.amount ? t.amount * 100 : 0)
      const recProb = t?.recovery_probability || 85
      const riskScore = t?.risk_score || 20
      const rawVal = (amountMinor * recProb) / 100
      const expectedValueMinor = Math.round(rawVal)
      const priorityScore = Math.min(
        99,
        Math.round(
          (expectedValueMinor / 5000000) * 40 +
            (recProb / 100) * 35 +
            (1 - riskScore / 100) * 25
        )
      )

      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      if (expectedValueMinor >= 2000000 && t?.policy === 'Approved') priority = 'CRITICAL'
      else if (expectedValueMinor >= 1000000) priority = 'HIGH'
      else if (expectedValueMinor >= 400000) priority = 'MEDIUM'

      return {
        id: `opp-${t?.id}`,
        opportunity_id: `opp-${t?.id}`,
        transaction_id: t?.id,
        amount_minor: amountMinor,
        currency: t?.currency || 'INR',
        failure_signature: t?.reason || 'Payment failure',
        recovery_probability: recProb,
        expected_value_minor: expectedValueMinor,
        expected_recovery_value_minor: expectedValueMinor,
        priority_score: priorityScore,
        priority_level: priority,
        priority: priority,
        recommended_action: t?.action || 'Send payment link',
        best_safe_action: t?.action || 'Send payment link',
        policy_status: t?.policy || 'Approved',
        reason: t?.reason || 'Payment failure',
        risk_score: riskScore,
        status: t?.status === 'RECOVERED' ? 'RECOVERED' : t?.policy === 'Blocked' ? 'POLICY_BLOCKED' : 'ELIGIBLE',
        recovery_operation_id: t?.recovery_operation_id,
        created_at: t?.created_at || new Date().toISOString(),
        updated_at: t?.updated_at || new Date().toISOString(),
      }
    })

    res.status(200).json(opportunities)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch opportunities' })
  }
}
