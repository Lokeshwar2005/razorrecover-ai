import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findChronovaTransaction, getAllChronovaTransactions } from '../../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-github-token')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { query, order_id, payment_id, transaction_id } = req.query
  const identifier = (transaction_id || order_id || payment_id || query || '') as string

  if (!identifier) {
    const all = await getAllChronovaTransactions(req)
    res.status(200).json({
      status: 'OK',
      total_chronova_transactions: all.length,
      sample_ids: all.slice(0, 5).map((t) => ({
        id: t.id,
        chronova_order_id: t.chronova_order_id,
        razorpay_payment_id: t.razorpay_payment_id,
        status: t.status,
      })),
      usage: 'Pass ?order_id=... or ?transaction_id=... to trace a transaction lifecycle.',
    })
    return
  }

  try {
    const txn = await findChronovaTransaction(identifier, req)

    if (!txn) {
      res.status(404).json({
        found: false,
        queried_identifier: identifier,
        message: `No Chronova transaction matching "${identifier}" found in authoritative database.`,
      })
      return
    }

    const traceSteps = [
      {
        step: 1,
        name: 'Website A (Chronova) Order Created',
        status: 'COMPLETE',
        details: {
          chronova_order_id: txn.chronova_order_id,
          customer_id: txn.chronova_customer_id,
          amount: `₹${txn.amount.toLocaleString('en-IN')}`,
          currency: txn.currency,
          product: txn.metadata?.product_name || 'Chronova Luxury Timepiece',
        },
      },
      {
        step: 2,
        name: 'Razorpay Payment Attempt & Degradation Signal',
        status: 'COMPLETE',
        details: {
          razorpay_order_id: txn.razorpay_order_id || txn.chronova_order_id,
          razorpay_payment_id: txn.razorpay_payment_id || 'Pending/Failed initial attempt',
          failure_reason: txn.reason,
          failure_code: txn.metadata?.scenario_id || 'GATEWAY_ERROR_3DS_TIMEOUT',
        },
      },
      {
        step: 3,
        name: 'RazorRecover Ingestion & AI Diagnosis',
        status: 'COMPLETE',
        details: {
          canonical_transaction_id: txn.id,
          source: 'CHRONOVA',
          provider: 'RAZORPAY',
          ai_root_cause: txn.ai_diagnosis?.root_cause || txn.reason,
          recommended_action: txn.ai_diagnosis?.recommended_action || txn.action,
          confidence_score: `${txn.confidence}%`,
          policy_decision: txn.policy_decision?.decision || txn.policy,
        },
      },
      {
        step: 4,
        name: 'Autonomous Recovery Operation',
        status: txn.recovery_operation_id ? 'COMPLETE' : 'WAITING',
        details: {
          recovery_operation_id: txn.recovery_operation_id || 'Not Yet Dispatched',
          action: txn.action,
          recovery_status: txn.recovery_status || 'PENDING',
        },
      },
      {
        step: 5,
        name: 'Customer Retry & Gateway Verification',
        status: txn.status === 'RECOVERED' ? 'COMPLETE' : 'PENDING',
        details: {
          settlement_status: txn.status,
          verified_recovered_revenue: `₹${((txn.verified_amount_minor || 0) / 100).toLocaleString('en-IN')}`,
          captured_at: txn.captured_at || txn.verified_at || 'Awaiting Settlement',
        },
      },
      {
        step: 6,
        name: 'Cryptographic Audit Seal',
        status: txn.audit_events && txn.audit_events.length > 0 ? 'COMPLETE' : 'PENDING',
        details: {
          audit_events_count: txn.audit_events?.length || 0,
          latest_hash: txn.audit_events?.[0]?.hash || 'N/A',
        },
      },
    ]

    res.status(200).json({
      found: true,
      transaction_id: txn.id,
      chronova_order_id: txn.chronova_order_id,
      status: txn.status,
      trace_steps: traceSteps,
      transaction: txn,
    })
  } catch (err: any) {
    res.status(500).json({ error: 'Trace failed', message: err?.message })
  }
}
