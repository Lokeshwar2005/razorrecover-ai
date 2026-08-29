import { create } from 'zustand'
import { createTransaction, type RecoveryDirection } from '../recoveryEngine'
import {
  executeRecoveryAction,
  verifyPaymentCapture,
  fetchRazorpayFeed,
  type OpportunityItem,
  type OpportunitySummary,
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
 * Baseline Razorpay Test Mode payments (e.g. pay_TVWRbgbZZuldtX, pay_TVKcFPdvHDKIPQ, pay_TVKaknokzpndeV).
 */
export const INITIAL_RAZORPAY_TEST_PAYMENTS: RawProviderPayment[] = [
  {
    id: 'pay_TVWRbgbZZuldtX',
    amount: 76800,
    currency: 'INR',
    status: 'captured',
    method: 'card',
    created_at: 1788015000,
  },
  {
    id: 'pay_TVKcFPdvHDKIPQ',
    amount: 76800,
    currency: 'INR',
    status: 'failed',
    method: 'upi',
    created_at: 1788014200,
    error_description: 'Bank timeout - issuer unavailable',
  },
  {
    id: 'pay_TVKaknokzpndeV',
    amount: 76800,
    currency: 'INR',
    status: 'failed',
    method: 'card',
    created_at: 1788013800,
    error_description: '3DS challenge expired',
  },
]

/**
 * Normalizes incoming Razorpay Test Mode or Live webhook/feed payments into canonical transactions.
 * Strict Rule: Razorpay amount is ALWAYS minor units (paise). amount_minor = payment.amount.
 * A captured provider payment is NOT counted as recovered until verified through RazorRecover.
 */
export function normalizeRazorpayPayment(
  payment: RawProviderPayment,
  isLive: boolean = false
): CanonicalTransaction {
  const amountMinor = payment.amount || 0
  const amountRupees = Math.round(amountMinor / 100)
  const currency = (payment.currency || 'INR').toUpperCase()
  const statusLower = (payment.status || 'pending').toLowerCase()

  // Status mapping:
  // - failed -> STOPPED
  // - authorized / created / captured -> PENDING (awaiting recovery / verification)
  let status: TransactionStatus = 'PENDING'
  if (statusLower === 'failed') {
    status = 'STOPPED'
  } else {
    status = 'PENDING'
  }

  const createdTime = payment.created_at
    ? (payment.created_at > 1e11 ? new Date(payment.created_at).toISOString() : new Date(payment.created_at * 1000).toISOString())
    : new Date().toISOString()

  // Keep transaction_id and provider_payment_id distinct
  const transactionId = payment.notes?.transaction_id || `RZP-${payment.id}`
  const reason = payment.error_description || (statusLower === 'captured' ? 'Checkout capture received' : 'Gateway degradation / bank timeout')
  const direction = payment.error_description?.toLowerCase().includes('subscription')
    ? 'Failed-subscription recovery'
    : payment.error_description?.toLowerCase().includes('checkout')
    ? 'Checkout drop-off'
    : 'Payment degradation'

  return {
    id: transactionId,
    merchant_id: payment.notes?.merchant_id || 'mer_razorpay',
    amount: amountRupees,
    amount_minor: amountMinor,
    currency,
    source: isLive ? 'live' : 'razorpay_test',
    status,
    direction,
    reason,
    action: statusLower === 'failed' ? 'Retry payment' : 'Review payment',
    confidence: 94,
    recovery_probability: statusLower === 'failed' ? 72 : 88,
    risk_score: statusLower === 'failed' ? 32 : 12,
    policy: 'Approved',
    explanation: `Ingested from Razorpay ${isLive ? 'Live' : 'Test Mode'} payment ${payment.id}.`,
    latency: '420ms',
    created_at: createdTime,
    provider: 'razorpay',
    provider_payment_id: payment.id,
    provider_status: payment.status,
    verified_amount_minor: 0, // Never claimed as recovered until verified!
  }
}

/**
 * Deduplicates and merges provider transactions with canonical synthetic transactions.
 * Provider records are deduplicated by provider + provider_payment_id.
 */
export function mergeCanonicalTransactions(
  synthetic: CanonicalTransaction[],
  provider: CanonicalTransaction[]
): CanonicalTransaction[] {
  const seenKeys = new Set<string>()
  const merged: CanonicalTransaction[] = []

  // Add provider transactions first
  for (const txn of provider) {
    const key = `${txn.provider || 'prov'}_${txn.provider_payment_id || txn.id}`
    if (!seenKeys.has(key) && !seenKeys.has(txn.id)) {
      seenKeys.add(key)
      seenKeys.add(txn.id)
      merged.push(txn)
    }
  }

  // Add synthetic transactions
  for (const txn of synthetic) {
    if (!seenKeys.has(txn.id)) {
      seenKeys.add(txn.id)
      merged.push(txn)
    }
  }

  return merged
}

const opportunitiesCache = new WeakMap<CanonicalTransaction[], OpportunityItem[]>()
const opportunitySummaryCache = new WeakMap<OpportunityItem[], OpportunitySummary>()
const metricsCache = new WeakMap<CanonicalTransaction[], ReturnType<typeof computeMetricsRaw>>()

/**
 * Pure function to project canonical transactions into the Recovery Opportunities model.
 */
export function computeOpportunitiesFromTransactions(
  transactions: CanonicalTransaction[]
): OpportunityItem[] {
  const cached = opportunitiesCache.get(transactions)
  if (cached) return cached

  const result = transactions.map((t) => {
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

    const yieldRupees = Math.floor(expectedValueMinor / 100)

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
        why_priority: `${priority} priority recovery candidate with ₹${yieldRupees} expected recovery yield.`,
        why_action: `Targeted automated intervention for ${t.reason} within policy boundaries.`,
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
          policy_reason: `Deterministic rule check: Risk score ${t.risk_score} <= 70.`,
        },
      ],
      created_at: t.created_at,
      updated_at: t.updated_at,
    }
  })

  opportunitiesCache.set(transactions, result)
  return result
}

/**
 * Pure function to derive summary metrics for opportunities.
 */
export function computeOpportunitySummary(opportunities: OpportunityItem[]): OpportunitySummary {
  const cached = opportunitySummaryCache.get(opportunities)
  if (cached) return cached

  let totalRisk = 0
  let expectedRecovery = 0
  let eligible = 0
  let blocked = 0
  let highPriority = 0
  let probSum = 0

  for (const o of opportunities) {
    totalRisk += o.amount_minor
    expectedRecovery += o.expected_value_minor
    if (o.policy_status === 'Approved') eligible++
    else if (o.policy_status === 'Blocked') blocked++
    if (o.priority === 'CRITICAL' || o.priority === 'HIGH') highPriority++
    probSum += o.recovery_probability
  }

  const avgProb =
    opportunities.length > 0
      ? Math.round((probSum / opportunities.length) * 10) / 10
      : 75

  const result: OpportunitySummary = {
    total_opportunities: opportunities.length,
    total_revenue_at_risk_minor: totalRisk,
    expected_recovery_value_minor: expectedRecovery,
    policy_eligible_count: eligible,
    policy_blocked_count: blocked,
    high_priority_count: highPriority,
    average_recovery_probability: avgProb,
    mode: 'canonical-store',
  }

  opportunitySummaryCache.set(opportunities, result)
  return result
}

function computeMetricsRaw(transactions: CanonicalTransaction[]) {
  const totalTransactions = transactions.length
  let syntheticCount = 0
  let providerTestCount = 0
  let liveCount = 0
  let revenueAtRiskMinor = 0
  let verifiedRecoveredMinor = 0
  let pendingCount = 0
  let recoveredCount = 0
  let stoppedCount = 0
  let blockedCount = 0
  let highRiskCount = 0
  let highValueCount = 0

  for (const t of transactions) {
    if (t.source === 'synthetic') syntheticCount++
    else if (t.source === 'razorpay_test') providerTestCount++
    else if (t.source === 'live') liveCount++

    revenueAtRiskMinor += t.amount_minor

    if (t.status === 'RECOVERED' && (t.verified_amount_minor ?? 0) > 0) {
      recoveredCount++
      verifiedRecoveredMinor += t.verified_amount_minor || t.amount_minor
    } else if (t.status === 'STOPPED') {
      stoppedCount++
    } else {
      pendingCount++
    }

    if (t.policy === 'Blocked') blockedCount++
    if (t.risk_score >= 60) highRiskCount++
    if (t.amount >= 20000) highValueCount++
  }

  const recoveryRate =
    revenueAtRiskMinor > 0
      ? Math.round((verifiedRecoveredMinor / revenueAtRiskMinor) * 1000) / 10
      : 0

  return {
    totalTransactions,
    syntheticCount,
    providerTestCount,
    liveCount,
    providerCount: providerTestCount + liveCount,
    revenueAtRiskMinor,
    verifiedRecoveredMinor,
    recoveryRate,
    pendingCount,
    recoveredCount,
    stoppedCount,
    blockedCount,
    highRiskCount,
    highValueCount,
  }
}

/**
 * Pure function to calculate dashboard & system KPIs from canonical transactions.
 */
export function computeMetricsFromTransactions(transactions: CanonicalTransaction[]) {
  const cached = metricsCache.get(transactions)
  if (cached) return cached
  const result = computeMetricsRaw(transactions)
  metricsCache.set(transactions, result)
  return result
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
  refreshProviderFeed: () => Promise<void>
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
    currency?: string,
    orderId?: string,
    signature?: string
  ) => Promise<{ verified: boolean; message: string }>

  // Selectors / Resolvers
  getTransactionById: (id: string) => CanonicalTransaction | undefined
  getSelectedTransaction: () => CanonicalTransaction | undefined
  getOpportunities: () => OpportunityItem[]
  getMetrics: () => ReturnType<typeof computeMetricsFromTransactions>
}

let lastIngestedFingerprint = ''
let isRefreshingProviderFeed = false
let cachedSynthetic: { scenario: string; items: CanonicalTransaction[] } | null = null

function getCachedSyntheticTransactions(scenario: 'balanced' | 'checkout' | 'degradation'): CanonicalTransaction[] {
  if (cachedSynthetic && cachedSynthetic.scenario === scenario) {
    return cachedSynthetic.items
  }
  const items = generateCanonicalSyntheticTransactions(scenario)
  cachedSynthetic = { scenario, items }
  return items
}

export const useTransactionStore = create<CanonicalStoreState>((set, get) => {
  const initialSynthetic = generateCanonicalSyntheticTransactions('balanced')
  const initialProvider = INITIAL_RAZORPAY_TEST_PAYMENTS.map((p) => normalizeRazorpayPayment(p, false))
  const initialMerged = mergeCanonicalTransactions(initialSynthetic, initialProvider)

  return {
    transactions: initialMerged,
    providerTransactions: initialProvider,
    selectedTransactionId: null,
    scenario: 'balanced',
    providerFeedStatus: 'connected',

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
      if (!rawPayments || rawPayments.length === 0) return

      const fingerprint =
        `${isLive ? 'live' : 'test'}_` +
        rawPayments.map((p) => `${p.id}_${p.status || ''}_${p.amount || 0}`).join('|')
      if (fingerprint === lastIngestedFingerprint && get().transactions.length > 0) {
        return
      }

      const normalized = rawPayments.map((p) => normalizeRazorpayPayment(p, isLive))
      const currentProvider = get().providerTransactions

      const seen = new Set<string>()
      const updatedProvider: CanonicalTransaction[] = []
      let hasChanges = false

      for (const p of [...normalized, ...currentProvider]) {
        const key = `${p.provider || 'prov'}_${p.provider_payment_id || p.id}`
        if (!seen.has(key)) {
          seen.add(key)
          updatedProvider.push(p)
        }
      }

      if (updatedProvider.length !== currentProvider.length) {
        hasChanges = true
      } else {
        for (let i = 0; i < updatedProvider.length; i++) {
          if (
            updatedProvider[i].id !== currentProvider[i].id ||
            updatedProvider[i].status !== currentProvider[i].status ||
            updatedProvider[i].amount_minor !== currentProvider[i].amount_minor
          ) {
            hasChanges = true
            break
          }
        }
      }

      lastIngestedFingerprint = fingerprint

      if (!hasChanges && get().transactions.length > 0) {
        return
      }

      const synthetic = getCachedSyntheticTransactions(get().scenario)
      const merged = mergeCanonicalTransactions(synthetic, updatedProvider)

      set({
        providerTransactions: updatedProvider,
        transactions: merged,
        providerFeedStatus: 'connected',
      })
    },

    refreshProviderFeed: async () => {
      if (isRefreshingProviderFeed) return
      isRefreshingProviderFeed = true
      try {
        const feed = await fetchRazorpayFeed()
        if (feed && Array.isArray(feed.items) && feed.items.length > 0) {
          get().ingestProviderPayments(feed.items, feed.mode === 'live')
        }
      } catch (e) {
        set({ providerFeedStatus: 'unavailable' })
      } finally {
        isRefreshingProviderFeed = false
      }
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

    verifyPayment: async (id, paymentId, amountMinor, currency, orderId, signature) => {
      const txn = get().transactions.find((t) => t.id === id)
      if (!txn) {
        return { verified: false, message: `Transaction ${id} not found.` }
      }

      try {
        const res = await verifyPaymentCapture({
          transaction_id: txn.id,
          payment_id: paymentId,
          order_id: orderId || txn.provider_order_id,
          signature: signature,
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
                    provider_order_id: res.order_id || orderId || txn.provider_order_id,
                    provider_status: 'captured',
                    captured_at: new Date().toISOString(),
                    workflow_status: 'VERIFIED',
                    workflow_message: res.message,
                    updated_at: new Date().toISOString(),
                  }
                : t
            ),
          }))
          return { verified: true, message: res.message }
        } else {
          return { verified: false, message: res.message || 'Payment could not be verified — recovery not recorded.' }
        }
      } catch (e: any) {
        return { verified: false, message: e?.message || 'Payment verification unavailable.' }
      }
    },

    getTransactionById: (id) => {
      if (!id) return undefined
      const cleanId = id.trim().toUpperCase()
      return get().transactions.find(
        (t) =>
          t.id.toUpperCase() === cleanId ||
          t.id.toUpperCase().replace('TXN-', '') === cleanId ||
          t.id.toUpperCase().replace('RZP-', '') === cleanId ||
          (t.provider_payment_id && t.provider_payment_id.toUpperCase() === cleanId) ||
          (t.provider_payment_id && t.provider_payment_id.toUpperCase().includes(cleanId))
      )
    },

    getSelectedTransaction: () => {
      const selectedId = get().selectedTransactionId
      if (!selectedId) return get().transactions[0]
      return get().getTransactionById(selectedId) || get().transactions[0]
    },

    getOpportunities: () => {
      return computeOpportunitiesFromTransactions(get().transactions)
    },

    getMetrics: () => {
      return computeMetricsFromTransactions(get().transactions)
    },
  }
})
