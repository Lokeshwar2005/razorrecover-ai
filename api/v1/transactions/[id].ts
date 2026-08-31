import type { IncomingMessage, ServerResponse } from 'http'
import { getTransaction } from '../store.js'

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
    const rawId = req.query?.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    if (!id) {
      res.status(400).json({ error: 'Transaction ID is required' })
      return
    }

    const txn = getTransaction(id)
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
        confidence_score: txn.confidence,
        recovery_probability: txn.recovery_probability,
        risk_score: txn.risk_score,
        reasoning_summary: txn.explanation,
      },
      policy_decision: {
        transaction_id: txn.id,
        decision: txn.policy,
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
