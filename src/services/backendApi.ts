/**
 * Unified Backend API Client for RazorRecover AI
 * Connects frontend views to FastAPI endpoints with high-fidelity synthetic fallback.
 */

const API_BASE =
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_BACKEND_API_URL || process.env?.VITE_BACKEND_API_URL)) ||
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_BACKEND_API_URL) ||
  'http://127.0.0.1:8000/api/v1'

export interface DashboardStats {
  revenue_at_risk_minor: number
  revenue_recovered_minor: number
  recovery_rate: number
  failed_transactions_count: number
  active_recovery_attempts_count: number
  policy_blocks_count: number
  total_opportunities_value_minor: number
  average_ai_confidence: number
  velocity_minor_per_sec: number
  trends: Array<{
    timestamp: string
    revenue_at_risk_minor: number
    revenue_recovered_minor: number
    recovery_rate: number
  }>
}

export interface CandidateAction {
  action: string
  recovery_probability: number
  risk_score: number
  expected_value_minor: number
  policy_decision: 'Approved' | 'Blocked' | 'Escalated'
  execution_allowed: boolean
  policy_reason: string
}

export interface OpportunityExplainability {
  why_priority: string
  why_action: string
  why_policy_status: string
}

export interface OpportunityItem {
  id: string
  opportunity_id?: string
  transaction_id: string
  amount_minor: number
  currency?: string
  failure_signature?: string
  recovery_probability: number
  expected_value_minor: number
  expected_recovery_value_minor?: number
  priority_score?: number
  priority_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  recommended_action: string
  best_safe_action?: string
  policy_status: 'Approved' | 'Blocked' | 'Escalated'
  reason: string
  risk_score: number
  status?: string
  explainability?: OpportunityExplainability
  candidate_actions?: CandidateAction[]
  created_at: string
  updated_at?: string
}

export interface OpportunitySummary {
  total_opportunities: number
  total_revenue_at_risk_minor: number
  expected_recovery_value_minor: number
  policy_eligible_count: number
  policy_blocked_count: number
  high_priority_count: number
  average_recovery_probability: number
  mode?: string
}

export interface ActionPerformance {
  action: string
  total_attempts: number
  verified_recoveries: number
  success_rate: number
  total_recovered_minor: number
}

export interface FailureDistribution {
  failure_signature: string
  count: number
  total_at_risk_minor: number
  recovered_minor: number
  recovery_rate: number
}

export interface AnalyticsData {
  overall_recovery_rate: number
  total_revenue_at_risk_minor: number
  total_revenue_recovered_minor: number
  action_performance: ActionPerformance[]
  failure_distributions: FailureDistribution[]
}

export interface PolicySettings {
  max_risk_ceiling: number
  max_retry_ceiling: number
  min_recovery_probability: number
  allow_retry_payment: boolean
  allow_payment_link: boolean
  allow_customer_prompt: boolean
  allow_voice_recovery: boolean
  allow_ptp_tracker: boolean
}

export interface AuditEventItem {
  id: string
  transaction_id: string
  event_type: string
  actor: string
  decision: string
  reason: string
  hash: string
  timestamp: string
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return await res.json()
  } catch (e) {
    // Fallback for static mode
  }

  return {
    revenue_at_risk_minor: 18450000,
    revenue_recovered_minor: 13284000,
    recovery_rate: 72.0,
    failed_transactions_count: 28,
    active_recovery_attempts_count: 14,
    policy_blocks_count: 8,
    total_opportunities_value_minor: 9640000,
    average_ai_confidence: 94.0,
    velocity_minor_per_sec: 4300,
    trends: [
      { timestamp: 'Aug 23', revenue_at_risk_minor: 3200000, revenue_recovered_minor: 2100000, recovery_rate: 65.6 },
      { timestamp: 'Aug 24', revenue_at_risk_minor: 4100000, revenue_recovered_minor: 2900000, recovery_rate: 70.7 },
      { timestamp: 'Aug 25', revenue_at_risk_minor: 5800000, revenue_recovered_minor: 4200000, recovery_rate: 72.4 },
      { timestamp: 'Aug 26', revenue_at_risk_minor: 8200000, revenue_recovered_minor: 6100000, recovery_rate: 74.3 },
      { timestamp: 'Aug 27', revenue_at_risk_minor: 11500000, revenue_recovered_minor: 8400000, recovery_rate: 73.0 },
      { timestamp: 'Aug 28', revenue_at_risk_minor: 14900000, revenue_recovered_minor: 10800000, recovery_rate: 72.4 },
      { timestamp: 'Aug 29', revenue_at_risk_minor: 18450000, revenue_recovered_minor: 13284000, recovery_rate: 72.0 },
    ],
  }
}

export async function fetchOpportunities(filter?: {
  priority?: string
  policy_status?: string
  sort_by?: string
}): Promise<OpportunityItem[]> {
  try {
    const params = new URLSearchParams()
    if (filter?.priority) params.append('priority', filter.priority)
    if (filter?.policy_status) params.append('policy_status', filter.policy_status)
    if (filter?.sort_by) params.append('sort_by', filter.sort_by)

    const url = `${API_BASE}/opportunities${params.toString() ? `?${params.toString()}` : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return await res.json()
  } catch (e) {
    // Fallback for static mode
  }

  const fallback: OpportunityItem[] = [
    {
      id: 'opp-TXN-1082',
      opportunity_id: 'opp-TXN-1082',
      transaction_id: 'TXN-1082',
      amount_minor: 4500000,
      currency: 'INR',
      failure_signature: 'Bank timeout',
      recovery_probability: 84,
      expected_value_minor: 3780000,
      expected_recovery_value_minor: 3780000,
      priority_score: 88,
      priority_level: 'CRITICAL',
      priority: 'CRITICAL',
      recommended_action: 'Retry payment',
      best_safe_action: 'Retry payment',
      policy_status: 'Approved',
      reason: 'Bank timeout',
      risk_score: 22,
      status: 'ELIGIBLE',
      explainability: {
        why_priority: 'Critical priority due to high recoverable value (₹37,800 expected out of ₹45,000), 84% recovery probability, and low risk (22/100).',
        why_action: 'Automated gateway retry is recommended for transient bank timeout as gateway telemetry indicates network recovery.',
        why_policy_status: 'Authorized by deterministic policy gate (Risk 22 < 70 ceiling, Retries 1 <= 2).',
      },
      candidate_actions: [
        { action: 'Retry payment', recovery_probability: 89, risk_score: 22, expected_value_minor: 4005000, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 22 < 70, Retries 1 <= 2' },
        { action: 'Payment link', recovery_probability: 95, risk_score: 14, expected_value_minor: 4275000, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 14 < 70' },
        { action: 'Customer prompt', recovery_probability: 86, risk_score: 17, expected_value_minor: 3870000, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 17 < 70' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 22, expected_value_minor: 1800000, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Requires operator action' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: 'opp-TXN-1094',
      opportunity_id: 'opp-TXN-1094',
      transaction_id: 'TXN-1094',
      amount_minor: 3499900,
      currency: 'INR',
      failure_signature: 'Checkout abandoned',
      recovery_probability: 79,
      expected_value_minor: 2764921,
      expected_recovery_value_minor: 2764921,
      priority_score: 82,
      priority_level: 'CRITICAL',
      priority: 'CRITICAL',
      recommended_action: 'Payment link',
      best_safe_action: 'Payment link',
      policy_status: 'Approved',
      reason: 'Checkout abandoned',
      risk_score: 27,
      status: 'ELIGIBLE',
      explainability: {
        why_priority: 'Critical priority with ₹27,649 expected recovery value and high buyer purchase intent.',
        why_action: 'Smart Payment Link is recommended to bypass checkout friction by delivering a pre-filled Razorpay link.',
        why_policy_status: 'Authorized by deterministic policy gate (Risk 27 < 70 ceiling).',
      },
      candidate_actions: [
        { action: 'Payment link', recovery_probability: 91, risk_score: 19, expected_value_minor: 3184909, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 19 < 70' },
        { action: 'Retry payment', recovery_probability: 84, risk_score: 27, expected_value_minor: 2939916, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 27 < 70' },
        { action: 'Customer prompt', recovery_probability: 81, risk_score: 22, expected_value_minor: 2834919, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 22 < 70' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 27, expected_value_minor: 1399960, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Requires operator action' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: 'opp-TXN-1077',
      opportunity_id: 'opp-TXN-1077',
      transaction_id: 'TXN-1077',
      amount_minor: 1899900,
      currency: 'INR',
      failure_signature: 'Subscription charge failed',
      recovery_probability: 76,
      expected_value_minor: 1443924,
      expected_recovery_value_minor: 1443924,
      priority_score: 71,
      priority_level: 'HIGH',
      priority: 'HIGH',
      recommended_action: 'Retry subscription',
      best_safe_action: 'Payment link',
      policy_status: 'Approved',
      reason: 'Subscription charge failed',
      risk_score: 34,
      status: 'ELIGIBLE',
      explainability: {
        why_priority: 'High priority recurring subscription renewal with ₹14,439 expected recovery value.',
        why_action: 'Subscription dunning sequence with smart payment link authorized to prevent customer churn.',
        why_policy_status: 'Authorized by deterministic policy gate (Risk 34 < 70 ceiling).',
      },
      candidate_actions: [
        { action: 'Payment link', recovery_probability: 88, risk_score: 26, expected_value_minor: 1671912, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 26 < 70' },
        { action: 'Retry payment', recovery_probability: 81, risk_score: 34, expected_value_minor: 1538919, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 34 < 70' },
        { action: 'Customer prompt', recovery_probability: 78, risk_score: 29, expected_value_minor: 1481922, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 29 < 70' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 34, expected_value_minor: 759960, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Requires operator action' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: 'opp-TXN-1065',
      opportunity_id: 'opp-TXN-1065',
      transaction_id: 'TXN-1065',
      amount_minor: 2499900,
      currency: 'INR',
      failure_signature: 'High-intent failed payment',
      recovery_probability: 73,
      expected_value_minor: 1824927,
      expected_recovery_value_minor: 1824927,
      priority_score: 68,
      priority_level: 'HIGH',
      priority: 'HIGH',
      recommended_action: 'Call + payment link',
      best_safe_action: 'Hinglish voice recovery',
      policy_status: 'Approved',
      reason: 'High-intent failed payment',
      risk_score: 37,
      status: 'ELIGIBLE',
      explainability: {
        why_priority: 'High priority customer with ₹18,249 expected yield on high-intent e-commerce cart.',
        why_action: 'Hinglish voice assistance & WhatsApp payment link recommended for high-touch recovery.',
        why_policy_status: 'Authorized by deterministic policy gate (Risk 37 < 70 ceiling).',
      },
      candidate_actions: [
        { action: 'Hinglish voice recovery', recovery_probability: 77, risk_score: 35, expected_value_minor: 1924923, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 35 < 70' },
        { action: 'Payment link', recovery_probability: 85, risk_score: 29, expected_value_minor: 2124915, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 29 < 70' },
        { action: 'Retry payment', recovery_probability: 78, risk_score: 37, expected_value_minor: 1949922, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 37 < 70' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 37, expected_value_minor: 999960, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Requires operator action' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: 'opp-TXN-1051',
      opportunity_id: 'opp-TXN-1051',
      transaction_id: 'TXN-1051',
      amount_minor: 1299900,
      currency: 'INR',
      failure_signature: 'Mandate debit failed',
      recovery_probability: 74,
      expected_value_minor: 961926,
      expected_recovery_value_minor: 961926,
      priority_score: 58,
      priority_level: 'MEDIUM',
      priority: 'MEDIUM',
      recommended_action: 'Retry mandate',
      best_safe_action: 'Retry payment',
      policy_status: 'Approved',
      reason: 'Mandate debit failed',
      risk_score: 38,
      status: 'ELIGIBLE',
      explainability: {
        why_priority: 'Medium priority recurring mandate debit with ₹9,619 expected yield.',
        why_action: 'Automated mandate retry within the bank settlement processing window.',
        why_policy_status: 'Authorized by deterministic policy gate (Risk 38 < 70 ceiling).',
      },
      candidate_actions: [
        { action: 'Retry payment', recovery_probability: 79, risk_score: 38, expected_value_minor: 1026921, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 38 < 70' },
        { action: 'Payment link', recovery_probability: 86, risk_score: 30, expected_value_minor: 1117914, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 30 < 70' },
        { action: 'Customer prompt', recovery_probability: 76, risk_score: 33, expected_value_minor: 987924, policy_decision: 'Approved', execution_allowed: true, policy_reason: 'Authorized: Risk 33 < 70' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 38, expected_value_minor: 519960, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Requires operator action' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: 'opp-TXN-1042',
      opportunity_id: 'opp-TXN-1042',
      transaction_id: 'TXN-1042',
      amount_minor: 7200000,
      currency: 'INR',
      failure_signature: 'High-risk velocity detected',
      recovery_probability: 79,
      expected_value_minor: 5688000,
      expected_recovery_value_minor: 5688000,
      priority_score: 25,
      priority_level: 'LOW',
      priority: 'LOW',
      recommended_action: 'Escalate',
      best_safe_action: 'Escalate',
      policy_status: 'Blocked',
      reason: 'High-risk velocity detected',
      risk_score: 84,
      status: 'POLICY_BLOCKED',
      explainability: {
        why_priority: 'Low priority because transaction carries high risk (84/100) and is blocked by deterministic safety gates.',
        why_action: 'Manual escalation is recommended because automated retries exceed safe risk boundaries.',
        why_policy_status: 'Blocked by Safety Gate: Risk score (84/100) exceeded maximum risk ceiling (70/100).',
      },
      candidate_actions: [
        { action: 'Retry payment', recovery_probability: 84, risk_score: 84, expected_value_minor: 6048000, policy_decision: 'Blocked', execution_allowed: false, policy_reason: 'Blocked: Risk 84 >= 70 ceiling' },
        { action: 'Payment link', recovery_probability: 91, risk_score: 76, expected_value_minor: 6552000, policy_decision: 'Blocked', execution_allowed: false, policy_reason: 'Blocked: Risk 76 >= 70 ceiling' },
        { action: 'Escalate', recovery_probability: 40, risk_score: 84, expected_value_minor: 2880000, policy_decision: 'Escalated', execution_allowed: false, policy_reason: 'Escalated to human operator' },
      ],
      created_at: new Date().toISOString(),
    },
  ]

  return fallback
}

export async function fetchOpportunitySummary(): Promise<OpportunitySummary> {
  try {
    const res = await fetch(`${API_BASE}/opportunities/summary`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return await res.json()
  } catch (e) {
    // Fallback
  }

  return {
    total_opportunities: 6,
    total_revenue_at_risk_minor: 20999600,
    expected_recovery_value_minor: 16463698,
    policy_eligible_count: 5,
    policy_blocked_count: 1,
    high_priority_count: 4,
    average_recovery_probability: 77.8,
    mode: 'synthetic-preview',
  }
}

export async function fetchOpportunityById(id: string): Promise<OpportunityItem | null> {
  try {
    const res = await fetch(`${API_BASE}/opportunities/${id}`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return await res.json()
  } catch (e) {
    // Fallback
  }
  const opps = await fetchOpportunities()
  return opps.find((o) => o.id === id || o.transaction_id === id) || null
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  try {
    const res = await fetch(`${API_BASE}/analytics/recovery`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return await res.json()
  } catch (e) {
    // Fallback
  }

  return {
    overall_recovery_rate: 72.0,
    total_revenue_at_risk_minor: 18450000,
    total_revenue_recovered_minor: 13284000,
    action_performance: [
      { action: 'Retry payment', total_attempts: 42, verified_recoveries: 36, success_rate: 85.7, total_recovered_minor: 5840000 },
      { action: 'Payment link', total_attempts: 28, verified_recoveries: 21, success_rate: 75.0, total_recovered_minor: 4120000 },
      { action: 'Retry subscription', total_attempts: 16, verified_recoveries: 12, success_rate: 75.0, total_recovered_minor: 1890000 },
      { action: 'Call + payment link', total_attempts: 10, verified_recoveries: 7, success_rate: 70.0, total_recovered_minor: 940000 },
      { action: 'Customer prompt', total_attempts: 8, verified_recoveries: 5, success_rate: 62.5, total_recovered_minor: 494000 },
    ],
    failure_distributions: [
      { failure_signature: 'Bank timeout', count: 35, total_at_risk_minor: 6200000, recovered_minor: 5332000, recovery_rate: 86.0 },
      { failure_signature: 'Checkout abandoned', count: 24, total_at_risk_minor: 4800000, recovered_minor: 3456000, recovery_rate: 72.0 },
      { failure_signature: 'Subscription charge failed', count: 18, total_at_risk_minor: 3100000, recovered_minor: 2356000, recovery_rate: 76.0 },
      { failure_signature: 'Mandate debit failed', count: 14, total_at_risk_minor: 2450000, recovered_minor: 1813000, recovery_rate: 74.0 },
      { failure_signature: '3DS challenge expired', count: 9, total_at_risk_minor: 1900000, recovered_minor: 1254000, recovery_rate: 66.0 },
    ],
  }
}

const POLICY_STORAGE_KEY = 'razorrecover_merchant_policies'

export async function fetchPolicySettings(): Promise<PolicySettings> {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(POLICY_STORAGE_KEY)
      if (cached) return JSON.parse(cached)
    } catch (e) {}
  }

  try {
    const res = await fetch(`${API_BASE}/settings/policies`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      if (typeof window !== 'undefined') {
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(data))
      }
      return data
    }
  } catch (e) {
    // Fallback
  }

  return {
    max_risk_ceiling: 70,
    max_retry_ceiling: 2,
    min_recovery_probability: 55,
    allow_retry_payment: true,
    allow_payment_link: true,
    allow_customer_prompt: true,
    allow_voice_recovery: true,
    allow_ptp_tracker: true,
  }
}

export async function savePolicySettings(settings: PolicySettings): Promise<PolicySettings> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(settings))
      window.dispatchEvent(new CustomEvent('razorrecover:policy-updated', { detail: settings }))
    } catch (e) {}
  }

  try {
    const res = await fetch(`${API_BASE}/settings/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (res.ok) {
      const saved = await res.json()
      if (typeof window !== 'undefined') {
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(saved))
      }
      return saved
    }
  } catch (e) {
    // Return saved locally
  }
  return settings
}
