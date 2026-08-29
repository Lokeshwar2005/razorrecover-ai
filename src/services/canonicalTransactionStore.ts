import { create } from 'zustand'
import { createTransaction, type RecoveryDirection } from '../recoveryEngine'
import {
  executeRecoveryAction,
  verifyPaymentCapture,
  type OpportunityItem,
} from './backendApi'

export type TransactionSource = 'synthetic' | 'razorpay_test' | 'live'
export type TransactionStatus = 'PENDING' | 'RECOVERED' | 'STOPPED' | 'ESCALATED' | 'IN_PROGRESS'
export type PolicyDecision = 'Approved' | 'Escalated' | 'Blocked'

export interface CanonicalTransaction {
  id: string
  merchant_id: string
  amount: number // in Rupees
  amount_minor: number // in paise (safe integer arithmetic)
  currency: string
  source: TransactionSource
  status: TransactionStatus
  direction: string
  reason: string
  action: string
  confidence: number
  recovery_probability: number
  risk_score: number
  policy: PolicyDecision
  explanation: string
  latency: string
  created_at: string
  updated_at?: string

  // Optional Provider / Recovery fields
  provider?: 'razorpay'
  provider_id?: string
  provider_payment_id?: string
  provider_order_id?: string
  provider_payment_link_id?: string
  provider_status?: string
  verified_amount_minor?: number
  captured_at?: string
  workflow_status?: string
  workflow_message?: string
}

export interface RawProviderPayment {
  id: string
  amount: number
  currency?: string
  status?: string
  method?: string
  created_at?: number
  notes?: Record<string, string>
  error_description?: string
  [key: string]: any
}

// Stable deterministic epoch timestamp base (August 2026) to prevent hydration / re-render drift
const STABLE_EPOCH_BASE = 1788000000000

/**
 * Deterministically generates the 100 canonical synthetic transactions
 * (TXN-1042 down to TXN-0943, including TXN-1033 at index 9).
 */
export function generateCanonicalSyntheticTransactions(
  scenario: 'balanced' | 'checkout' | 'degradation' = 'balanced'
): CanonicalTransaction[] {
  return Array.from({ length: 100 }, (_, i) => {
    const raw = createTransaction(i, scenario)
    const amountRupees = raw.amount
    const amountMinor = amountRupees * 100
    // Deterministic timestamp spaced 15 minutes apart
    const createdIso = new Date(STABLE_EPOCH_BASE - i * 15 * 60 * 1000).toISOString()

    return {
      id: raw.id, // e.g. TXN-1042, TXN-1033, etc.
      merchant_id: 'mer_default',
      amount: amountRupees,
      amount_minor: amountMinor,
      currency: 'INR',
      source: 'synthetic',
      status: raw.result === 'Recovered' ? 'RECOVERED' : raw.result === 'Stopped' ? 'STOPPED' : 'PENDING',
      direction: raw.direction,
      reason: raw.reason,
      action: raw.action,
      confidence: raw.confidence,
      recovery_probability: raw.recoveryProbability,
      risk_score: raw.riskScore,
      policy: raw.policy === 'Approved' ? 'Approved' : 'Escalated',
      explanation: raw.explanation,
      latency: raw.latency,
      created_at: createdIso,
    }
  })
}

/**
 * Normalizes incoming Razorpay Test Mode or Live webhook/feed payments into canonical transactions.
 */
export function normalizeRazorpayPayment(
  payment: RawProviderPayment,
  isLive: boolean = false
): CanonicalTransaction {
  const isMinor = payment.amount > 100000 || payment.amount % 100 === 0
  const amountMinor = isMinor ? payment.amount : payment.amount * 100
  const amountRupees = Math.round(amountMinor / 100)
  const currency = (payment.currency || 'INR').toUpperCase()
  const statusLower = (payment.status || 'pending').toLowerCase()

  let status: TransactionStatus = 'PENDING'
  if (statusLower === 'captured' || statusLower === 'authorized') status = 'RECOVERED'
  else if (statusLower === 'failed') status = 'STOPPED'

  const createdTime = payment.created_at
    ? (payment.created_at > 1e11 ? new Date(payment.created_at).toISOString() : new Date(payment.created_at * 1000).toISOString())
    : new Date().toISOString()

  const transactionId = payment.notes?.transaction_id || `PAY-${payment.id.replace('pay_', '')}`

  return {
    id: transactionId,
    merchant_id: payment.notes?.merchant_id || 'mer_default',
    amount: amountRupees,
    amount_minor: amountMinor,
    currency,
    source: isLive ? 'live' : 'razorpay_test',
    status,
    direction: 'Payment degradation',
    reason: payment.error_description || 'Payment failure / checkout drop-off',
    action: 'Retry payment',
    confidence: 90,
    recovery_probability: 75,
    risk_score: 25,
    policy: 'Approved',
    explanation: `Ingested from Razorpay ${isLive ? 'Live' : 'Test Mode'} payment ${payment.id}.`,
    latency: '450ms',
    created_at: createdTime,
    provider: 'razorpay',
    provider_payment_id: payment.id,
    provider_status: payment.status,
    verified_amount_minor: status === 'RECOVERED' ? amountMinor : 0,
  }
}

/**
 * Deduplicates and merges provider transactions with canonical synthetic transactions.
 */
export function mergeCanonicalTransactions(
  synthetic: CanonicalTransaction[],
  provider: CanonicalTransaction[]
): CanonicalTransaction[] {
  const seen = new Set<string>()
  const merged: CanonicalTransaction[] = []

  // Add provider transactions first
  for (const txn of provider) {
    if (!seen.has(txn.id)) {
      seen.add(txn.id)
      merged.push(txn)
    }
  }

  // Add synthetic transactions
  for (const txn of synthetic) {
    if (!seen.has(txn.id)) {
      seen.add(txn.id)
      merged.push(txn)
    }
  }

  return merged
}

export interface CanonicalStoreState {
  transactions: CanonicalTransaction[]
  providerTransactions: CanonicalTransaction[]
  selectedTransactionId: string | null
  scenario: 'balanced' | 'checkout' | 'degradation'
  providerFeedStatus: 'idle' | 'connected' | 'unavailable'

  // Actions
  setScenario: (scenario: 'balanced' | 'checkout' | 'degradation') => void
  setSelectedTransactionId: (id: string | null) => void
  ingestProviderPayments: (payments: RawProviderPayment[], isLive?: boolean) => void
  updateTransactionStatus: (
    id: string,
    status: TransactionStatus,
    verifiedAmountMinor?: number,
    providerId?: string
  ) => void
  executeRecovery: (
    id: string,
    actionType?: string
  ) => Promise<{ success: boolean; message: string; orderId?: string; paymentLink?: string }>
  verifyPayment: (
    id: string,
    paymentId: string,
    amountMinor?: number,
    currency?: string
  ) => Promise<{ verified: boolean; message: string }>

  // Selectors / Resolvers
  getTransactionById: (id: string) => CanonicalTransaction | undefined
  getSelectedTransaction: () => CanonicalTransaction | undefined
  getOpportunities: () => OpportunityItem[]
  getMetrics: () => {
    totalTransactions: number
    syntheticCount: number
    providerCount: number
    revenueAtRiskMinor: number
    verifiedRecoveredMinor: number
    recoveryRate: number
    pendingCount: number
    recoveredCount: number
    stoppedCount: number
    blockedCount: number
    highRiskCount: number
    highValueCount: number
  }
}

export const useTransactionStore = create<CanonicalStoreState>((set, get) => {
  const initialSynthetic = generateCanonicalSyntheticTransactions('balanced')

  return {
    transactions: initialSynthetic,
    providerTransactions: [],
    selectedTransactionId: null,
    scenario: 'balanced',
    providerFeedStatus: 'idle',

    setScenario: (scenario) => {
      const synthetic = generateCanonicalSyntheticTransactions(scenario)
      const provider = get().providerTransactions
      const merged = mergeCanonicalTransactions(synthetic, provider)
      set({
        scenario,
        transactions: merged,
      })
    },

    setSelectedTransactionId: (id) => {
      set({ selectedTransactionId: id })
    },

    ingestProviderPayments: (rawPayments, isLive = false) => {
      const normalized = rawPayments.map((p) => normalizeRazorpayPayment(p, isLive))
      const currentProvider = get().providerTransactions
      
      // Deduplicate on provider_payment_id or id
      const seen = new Set<string>()
      const updatedProvider: CanonicalTransaction[] = []
      
      for (const p of [...normalized, ...currentProvider]) {
        const key = p.provider_payment_id || p.id
        if (!seen.has(key)) {
          seen.add(key)
          updatedProvider.push(p)
        }
      }

      const synthetic = generateCanonicalSyntheticTransactions(get().scenario)
      const merged = mergeCanonicalTransactions(synthetic, updatedProvider)

      set({
        providerTransactions: updatedProvider,
        transactions: merged,
        providerFeedStatus: 'connected',
      })
    },

    updateTransactionStatus: (id, status, verifiedAmountMinor, providerId) => {
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                verified_amount_minor: verifiedAmountMinor ?? t.verified_amount_minor,
                provider_id: providerId ?? t.provider_id,
                updated_at: new Date().toISOString(),
              }
            : t
        ),
      }))
    },

    executeRecovery: async (id, actionType) => {
      const txn = get().transactions.find((t) => t.id === id)
      if (!txn) {
        return { success: false, message: `Transaction ${id} not found.` }
      }

      if (txn.policy === 'Blocked') {
        return {
          success: false,
          message: `Recovery blocked by policy gate: Risk score (${txn.risk_score}/100) exceeds threshold.`,
        }
      }

      const chosenAction = actionType || txn.action || 'Retry payment'
      try {
        const result = await executeRecoveryAction({
          transaction_id: txn.id,
          action_type: chosenAction,
          amount_minor: txn.amount_minor,
          currency: txn.currency,
        })

        if (result.workflow_status === 'BLOCKED' || result.workflow_status === 'ESCALATED') {
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.id === id ? { ...t, policy: 'Blocked', status: 'STOPPED' } : t
            ),
          }))
          return { success: false, message: result.workflow_message }
        }

        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'IN_PROGRESS',
                  provider_id: result.provider_id || result.order_id || result.payment_link,
                  provider_order_id: result.order_id,
                  provider_payment_link_id: result.payment_link,
                  workflow_status: result.workflow_status,
                  workflow_message: result.workflow_message,
                  updated_at: new Date().toISOString(),
                }
              : t
          ),
        }))

        return {
          success: true,
          message: result.workflow_message,
          orderId: result.order_id,
          paymentLink: result.payment_link,
        }
      } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to start recovery execution.' }
      }
    },

    verifyPayment: async (id, paymentId, amountMinor, currency) => {
      const txn = get().transactions.find((t) => t.id === id)
      if (!txn) {
        return { verified: false, message: `Transaction ${id} not found.` }
      }

      try {
        const res = await verifyPaymentCapture({
          transaction_id: txn.id,
          payment_id: paymentId,
          amount_minor: amountMinor ?? txn.amount_minor,
          currency: currency ?? txn.currency,
        })

        if (res.verified) {
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: 'RECOVERED',
                    verified_amount_minor: res.amount_minor,
                    provider_payment_id: res.payment_id,
                    provider_status: 'captured',
                    updated_at: new Date().toISOString(),
                  }
                : t
            ),
          }))
          return { verified: true, message: res.message }
        } else {
          return { verified: false, message: res.message }
        }
      } catch (e: any) {
        return { verified: false, message: e?.message || 'Payment verification failed.' }
      }
    },

    getTransactionById: (id) => {
      if (!id) return undefined
      const cleanId = id.trim().toUpperCase()
      return get().transactions.find(
        (t) =>
          t.id.toUpperCase() === cleanId ||
          t.id.toUpperCase().replace('TXN-', '') === cleanId ||
          (t.provider_payment_id && t.provider_payment_id.toUpperCase() === cleanId)
      )
    },

    getSelectedTransaction: () => {
      const selectedId = get().selectedTransactionId
      if (!selectedId) return get().transactions[0]
      return get().getTransactionById(selectedId) || get().transactions[0]
    },

    getOpportunities: () => {
      const txns = get().transactions
      return txns.map((t) => {
        const expectedValueMinor = Math.floor((t.amount_minor * t.recovery_probability) / 100)
        let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
        if (expectedValueMinor >= 2000000 && t.policy === 'Approved') priority = 'CRITICAL'
        else if (expectedValueMinor >= 1000000) priority = 'HIGH'
        else if (expectedValueMinor >= 400000) priority = 'MEDIUM'

        const priorityScore = Math.min(
          99,
          Math.round(
            (expectedValueMinor / 5000000) * 40 +
              (t.recovery_probability / 100) * 35 +
              (1 - t.risk_score / 100) * 25
          )
        )

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
          explainability: {
            why_priority: `${priority} priority recovery candidate with ₹${(expectedValueMinor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} expected recovery yield.`,
            why_action: `Targeted automated intervention for ${t.reason.toLowerCase()} within policy boundaries.`,
            why_policy_status: `Evaluated by Deterministic Policy Engine (Risk ${t.risk_score}/100, Probability ${t.recovery_probability}%).`,
          },
          candidate_actions: [
            {
              action: t.action,
              recovery_probability: t.recovery_probability,
              risk_score: t.risk_score,
              expected_value_minor: expectedValueMinor,
              policy_decision: t.policy,
              execution_allowed: t.policy === 'Approved',
              policy_reason: `Authorized: Risk ${t.risk_score} < 70 ceiling`,
            },
            {
              action: 'Payment link',
              recovery_probability: Math.min(95, t.recovery_probability + 7),
              risk_score: Math.max(10, t.risk_score - 8),
              expected_value_minor: Math.floor((t.amount_minor * Math.min(95, t.recovery_probability + 7)) / 100),
              policy_decision: 'Approved',
              execution_allowed: true,
              policy_reason: 'Authorized: Low risk customer self-serve checkout link',
            },
            {
              action: 'Escalate',
              recovery_probability: 40,
              risk_score: t.risk_score,
              expected_value_minor: Math.floor((t.amount_minor * 40) / 100),
              policy_decision: 'Escalated',
              execution_allowed: false,
              policy_reason: 'Requires merchant operator review',
            },
          ],
          created_at: t.created_at,
        }
      })
    },

    getMetrics: () => {
      const txns = get().transactions
      const total = txns.length
      const synthetic = txns.filter((t) => t.source === 'synthetic').length
      const provider = txns.filter((t) => t.source !== 'synthetic').length

      let atRiskMinor = 0
      let recoveredMinor = 0
      let pendingCount = 0
      let recoveredCount = 0
      let stoppedCount = 0
      let blockedCount = 0
      let highRiskCount = 0
      let highValueCount = 0

      for (const t of txns) {
        if (t.status === 'RECOVERED') {
          recoveredCount++
          recoveredMinor += t.verified_amount_minor || t.amount_minor
        } else if (t.status === 'STOPPED') {
          stoppedCount++
          atRiskMinor += t.amount_minor
        } else {
          pendingCount++
          atRiskMinor += t.amount_minor
        }

        if (t.policy === 'Blocked' || t.policy === 'Escalated') {
          blockedCount++
        }
        if (t.risk_score >= 60) {
          highRiskCount++
        }
        if (t.amount_minor >= 2000000) {
          highValueCount++
        }
      }

      const totalValue = atRiskMinor + recoveredMinor
      const recoveryRate = totalValue > 0 ? (recoveredMinor / totalValue) * 100 : 0

      return {
        totalTransactions: total,
        syntheticCount: synthetic,
        providerCount: provider,
        revenueAtRiskMinor: atRiskMinor,
        verifiedRecoveredMinor: recoveredMinor,
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        pendingCount,
        recoveredCount,
        stoppedCount,
        blockedCount,
        highRiskCount,
        highValueCount,
      }
    },
  }
})
