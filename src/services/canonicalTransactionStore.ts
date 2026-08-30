import { create } from 'zustand'
import { createTransaction, type RecoveryDirection } from '../recoveryEngine'
import {
  executeRecoveryAction,
  verifyPaymentCapture,
  fetchRazorpayFeed,
  syncTransactionsBackend,
  fetchCanonicalTransactions,
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
  recovery_operation_id?: string
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
 * Synthetic transactions enter the system as PENDING recovery opportunities.
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
      status: 'PENDING',
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
      verified_amount_minor: 0,
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

export function mergeCanonicalTransactions(
  synthetic: CanonicalTransaction[],
  provider: CanonicalTransaction[]
): CanonicalTransaction[] {
  const seenIds = new Set<string>()
  const seenPaymentIds = new Set<string>()
  const merged: CanonicalTransaction[] = []

  // 1. Index synthetic transactions by ID, provider_payment_id, and provider_order_id
  const syntheticMap = new Map<string, CanonicalTransaction>()
  const paymentToSynthMap = new Map<string, string>()
  const orderToSynthMap = new Map<string, string>()

  for (const s of synthetic) {
    syntheticMap.set(s.id, s)
    if (s.provider_payment_id) {
      paymentToSynthMap.set(s.provider_payment_id, s.id)
    }
    if (s.provider_order_id) {
      orderToSynthMap.set(s.provider_order_id, s.id)
    }
  }

  // 2. Reconcile provider transactions into matching synthetic records or add standalone
  for (const provTxn of provider) {
    const paymentId = provTxn.provider_payment_id
    const orderId = provTxn.provider_order_id

    const synthId =
      syntheticMap.has(provTxn.id)
        ? provTxn.id
        : paymentId && paymentToSynthMap.get(paymentId)
        ? paymentToSynthMap.get(paymentId)
        : orderId && orderToSynthMap.get(orderId)
        ? orderToSynthMap.get(orderId)
        : undefined

    const targetSynth = synthId ? syntheticMap.get(synthId) : undefined

    if (targetSynth) {
      // Reconcile into target synthetic transaction
      const isRecovered = targetSynth.status === 'RECOVERED' || provTxn.status === 'RECOVERED'
      const reconciled: CanonicalTransaction = {
        ...targetSynth,
        provider: provTxn.provider || targetSynth.provider || 'razorpay',
        provider_payment_id: paymentId || targetSynth.provider_payment_id,
        provider_order_id: provTxn.provider_order_id || targetSynth.provider_order_id,
        provider_status: provTxn.provider_status || targetSynth.provider_status,
        status: isRecovered ? 'RECOVERED' : targetSynth.status,
        verified_amount_minor: Math.max(targetSynth.verified_amount_minor || 0, provTxn.verified_amount_minor || 0),
        workflow_status: isRecovered ? 'VERIFIED' : targetSynth.workflow_status,
        captured_at: provTxn.captured_at || targetSynth.captured_at,
        updated_at: provTxn.updated_at || targetSynth.updated_at,
      }
      syntheticMap.set(targetSynth.id, reconciled)
      if (paymentId) seenPaymentIds.add(paymentId)
    } else {
      // Standalone provider payment (e.g. RZP-pay_TVWRbgbZZuldtX)
      if (paymentId && seenPaymentIds.has(paymentId)) {
        continue
      }
      if (!seenIds.has(provTxn.id)) {
        seenIds.add(provTxn.id)
        if (paymentId) seenPaymentIds.add(paymentId)
        merged.push(provTxn)
      }
    }
  }

  // 3. Add all synthetic transactions (including reconciled ones)
  for (const synthTxn of syntheticMap.values()) {
    if (!seenIds.has(synthTxn.id)) {
      seenIds.add(synthTxn.id)
      merged.push(synthTxn)
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
      recovery_operation_id: t.recovery_operation_id,
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
 * Determines whether a transaction or opportunity item represents an active
 * recovery opportunity (i.e. still exposed to leakage and not yet verified/recovered).
 */
export function isActiveRecoveryOpportunity(item: { status?: string }): boolean {
  const s = (item.status || '').toUpperCase()
  return s !== 'RECOVERED' && s !== 'VERIFIED'
}

/**
 * Pure function to derive summary metrics for opportunities.
 */
export function computeOpportunitySummary(opportunities: OpportunityItem[]): OpportunitySummary {
  const cached = opportunitySummaryCache.get(opportunities)
  if (cached) return cached

  // Filter for ACTIVE (unrecovered) opportunities
  const activeOpps = opportunities.filter(isActiveRecoveryOpportunity)

  let totalRisk = 0
  let expectedRecovery = 0
  let eligible = 0
  let blocked = 0
  let highPriority = 0
  let probSum = 0

  for (const o of activeOpps) {
    totalRisk += o.amount_minor
    expectedRecovery += o.expected_value_minor
    if (o.policy_status === 'Approved') eligible++
    else if (o.policy_status === 'Blocked') blocked++
    if (o.priority === 'CRITICAL' || o.priority === 'HIGH') highPriority++
    probSum += o.recovery_probability
  }

  const avgProb =
    activeOpps.length > 0
      ? Math.round((probSum / activeOpps.length) * 10) / 10
      : 0

  const result: OpportunitySummary = {
    total_opportunities: activeOpps.length,
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
  let totalExposureMinor = 0
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

    totalExposureMinor += t.amount_minor

    if (t.status === 'RECOVERED' && (t.verified_amount_minor ?? 0) > 0) {
      recoveredCount++
      verifiedRecoveredMinor += t.verified_amount_minor || t.amount_minor
    } else if (t.status === 'STOPPED') {
      stoppedCount++
      revenueAtRiskMinor += t.amount_minor
    } else {
      pendingCount++
      revenueAtRiskMinor += t.amount_minor
    }

    if (t.policy === 'Blocked') blockedCount++
    if (t.risk_score >= 60) highRiskCount++
    if (t.amount >= 20000) highValueCount++
  }

  const recoveryRate =
    totalExposureMinor > 0
      ? Math.round((verifiedRecoveredMinor / totalExposureMinor) * 1000) / 10
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
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed'
  syncMessage: string | null
  lastSyncedAt: string | null

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
  ) => Promise<{ success: boolean; message: string; orderId?: string; paymentLink?: string; recoveryOperationId?: string }>
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

const STORAGE_KEY = 'razorrecover_canonical_ledger_v4'

export interface PersistedRecoveryState {
  transaction_id: string
  recovery_status: TransactionStatus
  payment_status?: string
  verification_status?: string
  verified_amount_minor: number
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_payment_link_id?: string
  recovery_operation_id?: string
  recovered_at?: string
  action?: string
  updated_at?: string
}

export function loadCanonicalLedger(): Record<string, PersistedRecoveryState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function persistRecoveryState(state: PersistedRecoveryState) {
  if (typeof window === 'undefined') return
  try {
    const current = loadCanonicalLedger()
    current[state.transaction_id] = { ...current[state.transaction_id], ...state }
    if (state.razorpay_payment_id) {
      current[`PAY_${state.razorpay_payment_id}`] = current[state.transaction_id]
    }
    if (state.razorpay_order_id) {
      current[`ORD_${state.razorpay_order_id}`] = current[state.transaction_id]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (e) {}
}

export function getPersistedStateForTransaction(id: string, paymentId?: string, orderId?: string): PersistedRecoveryState | undefined {
  const ledger = loadCanonicalLedger()
  if (ledger[id]) return ledger[id]
  if (paymentId && ledger[`PAY_${paymentId}`]) return ledger[`PAY_${paymentId}`]
  if (orderId && ledger[`ORD_${orderId}`]) return ledger[`ORD_${orderId}`]
  return undefined
}

export function loadPersistedTransactionStates(): Record<string, Partial<CanonicalTransaction>> {
  const ledger = loadCanonicalLedger()
  const res: Record<string, Partial<CanonicalTransaction>> = {}
  for (const [key, state] of Object.entries(ledger)) {
    if (key.startsWith('PAY_') || key.startsWith('ORD_')) continue
    res[key] = {
      status: state.recovery_status,
      verified_amount_minor: state.verified_amount_minor,
      provider_payment_id: state.razorpay_payment_id,
      provider_order_id: state.razorpay_order_id,
      provider_payment_link_id: state.razorpay_payment_link_id,
      recovery_operation_id: state.recovery_operation_id,
      provider_status: (state.payment_status as any) || 'captured',
      workflow_status: state.verification_status === 'VERIFIED' ? 'VERIFIED' : undefined,
      captured_at: state.recovered_at,
      updated_at: state.updated_at,
    }
  }
  return res
}

export function savePersistedTransactionState(id: string, state: Partial<CanonicalTransaction>) {
  if (typeof window === 'undefined') return
  try {
    const existing = getPersistedStateForTransaction(id, state.provider_payment_id, state.provider_order_id)
    const isRecovered = state.status === 'RECOVERED' || existing?.recovery_status === 'RECOVERED'
    const nowIso = new Date().toISOString()

    persistRecoveryState({
      transaction_id: id,
      recovery_status: (state.status || existing?.recovery_status || 'PENDING') as TransactionStatus,
      payment_status: state.provider_status || existing?.payment_status || (isRecovered ? 'captured' : 'pending'),
      verification_status: (state.workflow_status === 'VERIFIED' || isRecovered) ? 'VERIFIED' : 'PENDING',
      verified_amount_minor: state.verified_amount_minor ?? existing?.verified_amount_minor ?? (isRecovered ? (state.amount_minor || 0) : 0),
      razorpay_order_id: state.provider_order_id || existing?.razorpay_order_id,
      razorpay_payment_id: state.provider_payment_id || existing?.razorpay_payment_id,
      razorpay_payment_link_id: state.provider_payment_link_id || existing?.razorpay_payment_link_id,
      recovery_operation_id: state.recovery_operation_id || existing?.recovery_operation_id,
      recovered_at: state.captured_at || existing?.recovered_at || (isRecovered ? nowIso : undefined),
      action: state.action || existing?.action,
      updated_at: state.updated_at || nowIso,
    })
  } catch (e) {}
}

let lastIngestedFingerprint = ''
let isRefreshingProviderFeed = false
let cachedSynthetic: { scenario: string; items: CanonicalTransaction[] } | null = null
const activeRecoveryExecutionLocks = new Set<string>()

function getCachedSyntheticTransactions(scenario: 'balanced' | 'checkout' | 'degradation'): CanonicalTransaction[] {
  if (cachedSynthetic && cachedSynthetic.scenario === scenario) {
    return cachedSynthetic.items
  }
  const items = generateCanonicalSyntheticTransactions(scenario)
  cachedSynthetic = { scenario, items }
  return items
}

export const useTransactionStore = create<CanonicalStoreState>((set, get) => {
  const initialSynthetic = generateCanonicalSyntheticTransactions('balanced').map((t) => {
    const saved = getPersistedStateForTransaction(t.id, t.provider_payment_id, t.provider_order_id)
    if (saved && saved.recovery_status === 'RECOVERED') {
      return {
        ...t,
        status: 'RECOVERED' as TransactionStatus,
        verified_amount_minor: saved.verified_amount_minor || t.amount_minor,
        provider_payment_id: saved.razorpay_payment_id || t.provider_payment_id,
        provider_order_id: saved.razorpay_order_id || t.provider_order_id,
        provider_status: 'captured',
        workflow_status: 'VERIFIED' as const,
        captured_at: saved.recovered_at || t.created_at,
        updated_at: saved.updated_at || new Date().toISOString(),
      }
    }
    return t
  })

  const initialProvider = INITIAL_RAZORPAY_TEST_PAYMENTS.map((p) => {
    const normalized = normalizeRazorpayPayment(p, false)
    const saved = getPersistedStateForTransaction(normalized.id, normalized.provider_payment_id, normalized.provider_order_id)
    if (saved && saved.recovery_status === 'RECOVERED') {
      return {
        ...normalized,
        status: 'RECOVERED' as TransactionStatus,
        verified_amount_minor: saved.verified_amount_minor || normalized.amount_minor,
        provider_payment_id: saved.razorpay_payment_id || normalized.provider_payment_id,
        provider_order_id: saved.razorpay_order_id || normalized.provider_order_id,
        provider_status: 'captured',
        workflow_status: 'VERIFIED' as const,
        captured_at: saved.recovered_at || normalized.created_at,
        updated_at: saved.updated_at || new Date().toISOString(),
      }
    }
    return normalized
  })

  const initialMerged = mergeCanonicalTransactions(initialSynthetic, initialProvider)

  return {
    transactions: initialMerged,
    providerTransactions: initialProvider,
    selectedTransactionId: null,
    scenario: 'balanced',
    providerFeedStatus: 'connected',
    syncStatus: 'idle',
    syncMessage: null,
    lastSyncedAt: new Date().toISOString(),

    setScenario: (scenario) => {
      const currentTxnMap = new Map(get().transactions.map((t) => [t.id, t]))

      const synthetic = generateCanonicalSyntheticTransactions(scenario).map((t) => {
        const existing = currentTxnMap.get(t.id)
        const saved = getPersistedStateForTransaction(t.id, t.provider_payment_id, t.provider_order_id)
        if (existing && existing.status === 'RECOVERED') {
          return existing
        }
        if (saved && saved.recovery_status === 'RECOVERED') {
          return {
            ...t,
            status: 'RECOVERED' as TransactionStatus,
            verified_amount_minor: saved.verified_amount_minor || t.amount_minor,
            provider_payment_id: saved.razorpay_payment_id || t.provider_payment_id,
            provider_order_id: saved.razorpay_order_id || t.provider_order_id,
            provider_status: 'captured',
            workflow_status: 'VERIFIED' as const,
            captured_at: saved.recovered_at,
            updated_at: saved.updated_at,
          }
        }
        return existing ? { ...t, ...existing } : t
      })

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

      const fingerprint = rawPayments
        .map((p) => `${p.id}:${p.status || ''}:${p.amount || 0}`)
        .sort()
        .join('|')

      if (fingerprint === lastIngestedFingerprint && get().transactions.length > 0) {
        return
      }

      const currentTxnMap = new Map(get().transactions.map((t) => [t.id, t]))
      const normalized = rawPayments.map((p) => normalizeRazorpayPayment(p, isLive))
      const currentProvider = get().providerTransactions

      const seen = new Set<string>()
      const updatedProvider: CanonicalTransaction[] = []

      for (const p of [...normalized, ...currentProvider]) {
        const key = `${p.provider || 'prov'}_${p.provider_payment_id || p.id}`
        if (!seen.has(key)) {
          seen.add(key)
          // If this payment matches an existing synthetic transaction, reconcile it directly rather than adding as a duplicate
          const synthMatch = get().transactions.find(
            (t) =>
              t.source === 'synthetic' &&
              (t.id === p.id ||
                (p.provider_payment_id && t.provider_payment_id === p.provider_payment_id) ||
                (p.provider_order_id && t.provider_order_id === p.provider_order_id))
          )

          if (synthMatch) {
            continue
          }

          const existing = currentTxnMap.get(p.id) || currentTxnMap.get(`RZP-${p.provider_payment_id}`)
          const saved = getPersistedStateForTransaction(p.id, p.provider_payment_id, p.provider_order_id)

          if (existing && existing.status === 'RECOVERED') {
            updatedProvider.push(existing)
          } else if (saved && saved.recovery_status === 'RECOVERED') {
            updatedProvider.push({
              ...p,
              status: 'RECOVERED',
              verified_amount_minor: saved.verified_amount_minor || p.amount_minor,
              provider_payment_id: saved.razorpay_payment_id || p.provider_payment_id,
              provider_order_id: saved.razorpay_order_id || p.provider_order_id,
              provider_status: 'captured',
              workflow_status: 'VERIFIED',
              captured_at: saved.recovered_at,
              updated_at: saved.updated_at,
            })
          } else if (existing) {
            updatedProvider.push({ ...p, ...existing })
          } else {
            updatedProvider.push(p)
          }
        }
      }

      lastIngestedFingerprint = fingerprint

      // Build updated synthetic list, preserving any modified or recovered states
      const synthetic = getCachedSyntheticTransactions(get().scenario).map((st) => {
        const existing = currentTxnMap.get(st.id)
        const saved = getPersistedStateForTransaction(st.id, st.provider_payment_id, st.provider_order_id)
        if (existing && existing.status === 'RECOVERED') {
          return existing
        }
        if (saved && saved.recovery_status === 'RECOVERED') {
          return {
            ...st,
            status: 'RECOVERED' as TransactionStatus,
            verified_amount_minor: saved.verified_amount_minor || st.amount_minor,
            provider_payment_id: saved.razorpay_payment_id || st.provider_payment_id,
            provider_order_id: saved.razorpay_order_id || st.provider_order_id,
            provider_status: 'captured',
            workflow_status: 'VERIFIED' as const,
            captured_at: saved.recovered_at,
            updated_at: saved.updated_at,
          }
        }
        return existing ? { ...st, ...existing } : st
      })

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
      set({ syncStatus: 'syncing', syncMessage: 'Synchronizing with Razorpay canonical store...' })
      const prevCount = get().transactions.length

      try {
        // 1. Authoritative backend synchronization
        try {
          await syncTransactionsBackend()
        } catch (e) {}

        // 2. Ingest provider payments from feed
        const feed = await fetchRazorpayFeed()
        if (feed && Array.isArray(feed.items) && feed.items.length > 0) {
          get().ingestProviderPayments(feed.items, feed.mode === 'live')
        }

        // 3. Re-hydrate canonical records from database
        try {
          const backendTxns = await fetchCanonicalTransactions({ limit: 200 })
          if (backendTxns && backendTxns.length > 0) {
            const existingMap = new Map(get().transactions.map((t) => [t.id, t]))

            for (const bt of backendTxns) {
              const existing = existingMap.get(bt.id)
              const saved = getPersistedStateForTransaction(bt.id, bt.provider_id, bt.provider_order_id)
              const isRec = bt.status === 'RECOVERED' || (saved && saved.recovery_status === 'RECOVERED')

              if (existing) {
                if (isRec) {
                  const updated: CanonicalTransaction = {
                    ...existing,
                    status: 'RECOVERED',
                    verified_amount_minor: bt.verified_amount_minor || saved?.verified_amount_minor || existing.amount_minor,
                    provider_payment_id: bt.provider_id || bt.provider_payment_id || saved?.razorpay_payment_id || existing.provider_payment_id,
                    provider_order_id: bt.provider_order_id || saved?.razorpay_order_id || existing.provider_order_id,
                    provider_status: 'captured',
                    workflow_status: 'VERIFIED',
                  }
                  existingMap.set(bt.id, updated)
                  persistRecoveryState({
                    transaction_id: bt.id,
                    recovery_status: 'RECOVERED',
                    payment_status: 'captured',
                    verification_status: 'VERIFIED',
                    verified_amount_minor: updated.verified_amount_minor || existing.amount_minor || 0,
                    razorpay_payment_id: updated.provider_payment_id,
                    razorpay_order_id: updated.provider_order_id,
                    recovered_at: saved?.recovered_at || new Date().toISOString(),
                    action: updated.action,
                    updated_at: new Date().toISOString(),
                  })
                }
              } else {
                const newTxn: CanonicalTransaction = {
                  id: bt.id,
                  merchant_id: bt.merchant_id || 'mer_default',
                  amount: Math.round(bt.amount_minor / 100),
                  amount_minor: bt.amount_minor,
                  currency: bt.currency || 'INR',
                  source: bt.source || 'synthetic',
                  status: isRec ? 'RECOVERED' : (bt.status || 'PENDING'),
                  direction: bt.direction || 'Payment degradation',
                  reason: bt.reason,
                  action: bt.action,
                  confidence: bt.confidence || 94,
                  recovery_probability: bt.recovery_probability || 70,
                  risk_score: bt.risk_score || 25,
                  policy: bt.policy || 'Approved',
                  explanation: bt.explanation || '',
                  latency: '85ms',
                  created_at: bt.created_at || new Date().toISOString(),
                  provider_payment_id: bt.provider_id || bt.provider_payment_id || saved?.razorpay_payment_id,
                  provider_order_id: bt.provider_order_id || saved?.razorpay_order_id,
                  verified_amount_minor: isRec ? (bt.verified_amount_minor || saved?.verified_amount_minor || bt.amount_minor) : 0,
                  workflow_status: isRec ? 'VERIFIED' : undefined,
                }
                existingMap.set(bt.id, newTxn)
              }
            }

            set({ transactions: Array.from(existingMap.values()) })
          }
        } catch (e) {}

        const newCount = get().transactions.length
        const diff = newCount - prevCount
        const nowIso = new Date().toISOString()

        const msg =
          diff > 0
            ? `Synced ${diff} new transaction${diff > 1 ? 's' : ''} from Razorpay.`
            : 'No new transactions — feed is up to date.'

        set({
          syncStatus: 'success',
          syncMessage: msg,
          lastSyncedAt: nowIso,
          providerFeedStatus: 'connected',
        })
      } catch (e) {
        set({
          syncStatus: 'failed',
          syncMessage: 'Provider sync failed. Canonical offline cache active.',
          providerFeedStatus: 'unavailable',
        })
      } finally {
        isRefreshingProviderFeed = false
      }
    },

    updateTransactionStatus: (id, status, verifiedAmountMinorOrOpts, providerId) => {
      let verifiedAmt: number | undefined
      let provId: string | undefined
      let provStatus: string | undefined
      let orderId: string | undefined

      if (typeof verifiedAmountMinorOrOpts === 'object' && verifiedAmountMinorOrOpts !== null) {
        verifiedAmt = (verifiedAmountMinorOrOpts as any).verified_amount_minor
        provId = (verifiedAmountMinorOrOpts as any).provider_payment_id || (verifiedAmountMinorOrOpts as any).provider_id
        provStatus = (verifiedAmountMinorOrOpts as any).provider_status
        orderId = (verifiedAmountMinorOrOpts as any).provider_order_id
      } else {
        verifiedAmt = verifiedAmountMinorOrOpts as number | undefined
        provId = providerId
      }

      const finalVerifiedAmt = verifiedAmt !== undefined ? verifiedAmt : (status === 'RECOVERED' ? undefined : undefined)
      const finalProvStatus = provStatus !== undefined ? provStatus : (status === 'RECOVERED' ? 'captured' : undefined)

      savePersistedTransactionState(id, {
        status,
        ...(finalVerifiedAmt !== undefined ? { verified_amount_minor: finalVerifiedAmt } : {}),
        ...(provId !== undefined ? { provider_payment_id: provId, provider_id: provId } : {}),
        ...(orderId !== undefined ? { provider_order_id: orderId } : {}),
        ...(finalProvStatus !== undefined ? { provider_status: finalProvStatus } : {}),
        ...(status === 'RECOVERED' ? { workflow_status: 'VERIFIED', captured_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })

      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                verified_amount_minor: verifiedAmt !== undefined ? verifiedAmt : (status === 'RECOVERED' ? t.amount_minor : t.verified_amount_minor),
                provider_id: provId !== undefined ? provId : t.provider_id,
                provider_payment_id: provId !== undefined ? provId : t.provider_payment_id,
                provider_order_id: orderId !== undefined ? orderId : t.provider_order_id,
                provider_status: provStatus !== undefined ? provStatus : (status === 'RECOVERED' ? 'captured' : t.provider_status),
                workflow_status: status === 'RECOVERED' ? 'VERIFIED' : t.workflow_status,
                captured_at: status === 'RECOVERED' ? (t.captured_at || new Date().toISOString()) : t.captured_at,
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

      // Idempotency: Already recovered
      if (txn.status === 'RECOVERED') {
        return {
          success: true,
          message: `Transaction ${id} is already verified and recovered [${txn.recovery_operation_id || 'REC-VERIFIED'}].`,
          orderId: txn.provider_order_id,
          paymentLink: txn.provider_payment_link_id,
          recoveryOperationId: txn.recovery_operation_id,
        }
      }

      // Idempotency: Already in progress
      if (txn.status === 'IN_PROGRESS' && (txn.provider_order_id || txn.recovery_operation_id)) {
        return {
          success: true,
          message: `Recovery operation [${txn.recovery_operation_id}] is already active for ${id}.`,
          orderId: txn.provider_order_id,
          paymentLink: txn.provider_payment_link_id,
          recoveryOperationId: txn.recovery_operation_id,
        }
      }

      if (activeRecoveryExecutionLocks.has(id)) {
        return {
          success: false,
          message: `Recovery execution is already in flight for ${id}.`,
          recoveryOperationId: txn.recovery_operation_id,
        }
      }

      if (txn.policy === 'Blocked') {
        return {
          success: false,
          message: `Recovery blocked by deterministic policy gate: Risk score (${txn.risk_score}/100) exceeds threshold.`,
        }
      }

      activeRecoveryExecutionLocks.add(id)

      const cleanId = txn.id.replace(/[^a-zA-Z0-9]/g, '')
      const recoveryOperationId =
        txn.recovery_operation_id ||
        `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${cleanId}`

      const chosenAction = actionType || txn.action || 'Retry payment'
      try {
        const result = await executeRecoveryAction({
          transaction_id: txn.id,
          action_type: chosenAction,
          amount_minor: txn.amount_minor,
          currency: txn.currency,
          recovery_operation_id: recoveryOperationId,
        })

        if (result.workflow_status === 'BLOCKED' || result.workflow_status === 'ESCALATED') {
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.id === id
                ? {
                    ...t,
                    policy: 'Blocked',
                    status: 'STOPPED',
                    recovery_operation_id: recoveryOperationId,
                    workflow_status: result.workflow_status,
                    workflow_message: result.workflow_message,
                    updated_at: new Date().toISOString(),
                  }
                : t
            ),
          }))
          return { success: false, message: result.workflow_message, recoveryOperationId }
        }

        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'IN_PROGRESS',
                  recovery_operation_id: recoveryOperationId,
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
          recoveryOperationId,
        }
      } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to start recovery execution.' }
      } finally {
        activeRecoveryExecutionLocks.delete(id)
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
          savePersistedTransactionState(id, {
            status: 'RECOVERED',
            verified_amount_minor: res.amount_minor,
            provider_payment_id: res.payment_id,
            provider_order_id: res.order_id || orderId || txn.provider_order_id,
            provider_status: 'captured',
            workflow_status: 'VERIFIED',
            captured_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

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
