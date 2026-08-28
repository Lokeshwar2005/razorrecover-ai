export type RecoveryResult = 'Recovered' | 'Stopped' | 'Pending'

export type RecoveryDirection =
  | 'Payment degradation'
  | 'Checkout drop-off'
  | 'Failed-subscription recovery'
  | 'B2B receivables chaser'
  | 'Mandate retry sequencer'
  | 'Hinglish voice recovery'
  | 'Promise-to-pay tracker'

export type RecoveryDecision = {
  direction: RecoveryDirection
  reason: string
  action: string
  result: RecoveryResult
  confidence: number
  recoveryProbability: number
  riskScore: number
  policy: 'Approved' | 'Escalated'
  explanation: string
}

type Signal = {
  amount: number
  index: number
  scenario: 'balanced' | 'checkout' | 'degradation'
}

type Playbook = {
  direction: RecoveryDirection
  reason: string
  action: string
  base: number
  risk: number
  latencyBase: number
  latencyJitter: number
  preferredScenarios?: Signal['scenario'][]
}

/**
 * Every Razorpay Track 03 example direction is represented here.
 * The simulator is deterministic, but each direction has its own economics,
 * policy risk and recovery latency so the dashboard does not collapse to one
 * repeated result.
 */
export const PLAYBOOKS: readonly Playbook[] = [
  { direction: 'Payment degradation', reason: 'Bank timeout', action: 'Retry payment', base: 0.86, risk: 22, latencyBase: 760, latencyJitter: 440, preferredScenarios: ['degradation', 'balanced'] },
  { direction: 'Checkout drop-off', reason: 'Checkout abandoned', action: 'Payment link', base: 0.72, risk: 27, latencyBase: 1420, latencyJitter: 900, preferredScenarios: ['checkout', 'balanced'] },
  { direction: 'Failed-subscription recovery', reason: 'Subscription charge failed', action: 'Retry subscription', base: 0.76, risk: 34, latencyBase: 2100, latencyJitter: 1300, preferredScenarios: ['balanced'] },
  { direction: 'B2B receivables chaser', reason: 'Invoice overdue', action: 'Send AR reminder', base: 0.61, risk: 46, latencyBase: 5200, latencyJitter: 2600, preferredScenarios: ['balanced'] },
  { direction: 'Mandate retry sequencer', reason: 'Mandate debit failed', action: 'Retry mandate', base: 0.74, risk: 38, latencyBase: 2500, latencyJitter: 1500, preferredScenarios: ['balanced'] },
  { direction: 'Hinglish voice recovery', reason: 'Customer needs assisted recovery', action: 'Hinglish voice recovery', base: 0.69, risk: 41, latencyBase: 6800, latencyJitter: 3200, preferredScenarios: ['balanced'] },
  { direction: 'Promise-to-pay tracker', reason: 'Promise to pay recorded', action: 'Track promised date', base: 0.82, risk: 29, latencyBase: 9000, latencyJitter: 4000, preferredScenarios: ['balanced'] },
  { direction: 'Payment degradation', reason: 'Issuer unavailable', action: 'Retry payment', base: 0.79, risk: 28, latencyBase: 1040, latencyJitter: 520, preferredScenarios: ['degradation', 'balanced'] },
  { direction: 'Checkout drop-off', reason: '3DS challenge expired', action: 'Customer prompt', base: 0.66, risk: 35, latencyBase: 1840, latencyJitter: 1100, preferredScenarios: ['checkout', 'balanced'] },
  { direction: 'Failed-subscription recovery', reason: 'Subscription past due', action: 'Recovery link', base: 0.68, risk: 42, latencyBase: 3600, latencyJitter: 1800, preferredScenarios: ['balanced'] },
  { direction: 'B2B receivables chaser', reason: 'High-value receivable aging', action: 'Escalate to AR owner', base: 0.43, risk: 63, latencyBase: 7200, latencyJitter: 3400, preferredScenarios: ['balanced'] },
  { direction: 'Mandate retry sequencer', reason: 'Mandate retry exhausted', action: 'Fallback payment link', base: 0.48, risk: 58, latencyBase: 4100, latencyJitter: 2200, preferredScenarios: ['balanced'] },
  { direction: 'Hinglish voice recovery', reason: 'High-intent failed payment', action: 'Call + payment link', base: 0.73, risk: 37, latencyBase: 5900, latencyJitter: 2800, preferredScenarios: ['balanced'] },
  { direction: 'Promise-to-pay tracker', reason: 'Promise date missed', action: 'Escalate missed promise', base: 0.39, risk: 68, latencyBase: 11200, latencyJitter: 5000, preferredScenarios: ['balanced'] },
]

export type PlaybookReason = typeof PLAYBOOKS[number]['reason']

const scenarioWeights: Record<Signal['scenario'], Record<RecoveryDirection, number>> = {
  balanced: {
    'Payment degradation': 1,
    'Checkout drop-off': 1,
    'Failed-subscription recovery': 1,
    'B2B receivables chaser': 1,
    'Mandate retry sequencer': 1,
    'Hinglish voice recovery': 1,
    'Promise-to-pay tracker': 1,
  },
  checkout: {
    'Payment degradation': 0.45,
    'Checkout drop-off': 1.45,
    'Failed-subscription recovery': 0.65,
    'B2B receivables chaser': 0.25,
    'Mandate retry sequencer': 0.55,
    'Hinglish voice recovery': 1.15,
    'Promise-to-pay tracker': 0.35,
  },
  degradation: {
    'Payment degradation': 1.5,
    'Checkout drop-off': 0.4,
    'Failed-subscription recovery': 0.75,
    'B2B receivables chaser': 0.25,
    'Mandate retry sequencer': 0.9,
    'Hinglish voice recovery': 0.35,
    'Promise-to-pay tracker': 0.2,
  },
}

function deterministicUnit(index: number, salt: number) {
  const value = Math.sin((index + 1) * (salt + 11) * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function choosePlaybook(index: number, scenario: Signal['scenario']) {
  if (scenario === 'balanced') return PLAYBOOKS[index % PLAYBOOKS.length]

  const scored = PLAYBOOKS.map((playbook, i) => ({
    playbook,
    score: scenarioWeights[scenario][playbook.direction] * (0.75 + deterministicUnit(index + i, 7) * 0.5),
    i,
  })).sort((a, b) => b.score - a.score || a.i - b.i)

  // Spread selections across the top weighted directions instead of choosing
  // one fixed row for every transaction.
  return scored[index % Math.min(7, scored.length)].playbook
}

export function evaluateTransaction({ amount, index, scenario }: Signal): RecoveryDecision {
  const playbook = choosePlaybook(index, scenario)
  const scenarioBoost = scenario === 'balanced'
    ? 0
    : scenario === 'checkout'
      ? playbook.direction === 'Checkout drop-off' ? 0.07 : -0.02
      : playbook.direction === 'Payment degradation' ? 0.08 : -0.025

  const jitter = (deterministicUnit(index, 3) - 0.5) * 0.12
  const recoveryProbability = Math.max(0.08, Math.min(0.96, playbook.base + scenarioBoost + jitter))
  const riskJitter = Math.round((deterministicUnit(index, 5) - 0.5) * 14)
  const riskScore = Math.max(1, Math.min(99, playbook.risk + riskJitter))

  const policyApproved = playbook.action !== 'Escalate' && riskScore < 70 && index % 23 !== 0
  const shouldRecover = policyApproved && recoveryProbability >= 0.55
  const confidence = Math.max(58, Math.min(99, Math.round(72 + recoveryProbability * 24 - riskScore * 0.08)))

  return {
    direction: playbook.direction,
    reason: playbook.reason,
    action: policyApproved ? playbook.action : 'Escalate',
    result: shouldRecover ? 'Recovered' : 'Stopped',
    confidence,
    recoveryProbability: Math.round(recoveryProbability * 100),
    riskScore,
    policy: policyApproved ? 'Approved' : 'Escalated',
    explanation: policyApproved
      ? `${playbook.direction}: ${playbook.action} selected because recovery probability is ${Math.round(recoveryProbability * 100)}% with risk ${riskScore}/100.`
      : `Action stopped before money movement because policy risk reached ${riskScore}/100 or the intervention requires escalation.`,
  }
}

export interface CounterfactualEvaluationInput {
  amount: number
  reason: string
  riskScore: number
  recoveryProbability: number
  retryAttempts?: number
  policyThreshold?: number
  actionOverride?: string
}

export function evaluateCounterfactual({
  amount: _amount,
  reason,
  riskScore,
  recoveryProbability,
  retryAttempts = 1,
  policyThreshold = 70,
  actionOverride,
}: CounterfactualEvaluationInput): RecoveryDecision {
  const matchedPlaybook = PLAYBOOKS.find((p) => p.reason === reason) || PLAYBOOKS[0]
  const chosenAction = actionOverride || matchedPlaybook.action
  const recProbDecimal = recoveryProbability / 100
  const isEscalateAction = chosenAction === 'Escalate' || chosenAction.toLowerCase().includes('escalate')
  const isWithinRiskLimit = riskScore < policyThreshold
  const isWithinRetryLimit = retryAttempts <= 2
  const policyApproved = !isEscalateAction && isWithinRiskLimit && isWithinRetryLimit
  const shouldRecover = policyApproved && recProbDecimal >= 0.55
  const confidence = Math.max(10, Math.min(99, Math.round(72 + recProbDecimal * 24 - riskScore * 0.08)))

  let explanation = ''
  if (policyApproved) {
    explanation = `Bounded ${chosenAction.toLowerCase()} permitted because counterfactual risk (${riskScore}/100) is below safety threshold (${policyThreshold}/100) and recovery probability is ${Math.round(recoveryProbability)}%.`
  } else if (!isWithinRetryLimit) {
    explanation = `Intervention stopped at policy boundary: retry attempts (${retryAttempts}/2) exceeded maximum allowable limit.`
  } else if (!isWithinRiskLimit) {
    explanation = `Action stopped at policy boundary because counterfactual risk (${riskScore}/100) reached or exceeded policy threshold (${policyThreshold}/100).`
  } else {
    explanation = `Intervention halted because selected action (${chosenAction}) requires human escalation under safety protocol.`
  }

  return {
    direction: matchedPlaybook.direction,
    reason,
    action: policyApproved ? chosenAction : 'Escalate',
    result: shouldRecover ? 'Recovered' : 'Stopped',
    confidence,
    recoveryProbability: Math.round(recoveryProbability),
    riskScore: Math.round(riskScore),
    policy: policyApproved ? 'Approved' : 'Escalated',
    explanation,
  }
}

export function createTransaction(index: number, scenario: Signal['scenario']) {
  const playbook = choosePlaybook(index, scenario)
  const baseAmount = playbook.direction === 'B2B receivables chaser'
    ? 12000
    : playbook.direction === 'Promise-to-pay tracker'
      ? 4500
      : playbook.direction === 'Failed-subscription recovery'
        ? 1499
        : 799
  const spread = playbook.direction === 'B2B receivables chaser' ? 72000 : 18000
  const amount = baseAmount + Math.round(deterministicUnit(index, 17) * spread)
  const decision = evaluateTransaction({ amount, index, scenario })
  const latencyMs = Math.max(320, Math.round(playbook.latencyBase + deterministicUnit(index, 23) * playbook.latencyJitter))

  return {
    id: `TXN-${String(1042 - index).padStart(4, '0')}`,
    amount,
    latency: `${latencyMs}ms`,
    ...decision,
  }
}
