import './recoveryScene'

export type RecoveryResult = 'Recovered' | 'Stopped' | 'Pending'

export type RecoveryDecision = {
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

const playbooks = [
  { reason: 'Bank timeout', action: 'Retry payment', base: 0.91, risk: 18 },
  { reason: 'Checkout abandoned', action: 'Payment link', base: 0.78, risk: 24 },
  { reason: 'Retry limit reached', action: 'Escalate', base: 0.12, risk: 81 },
  { reason: 'Network degradation', action: 'Retry payment', base: 0.87, risk: 27 },
  { reason: 'Authentication failed', action: 'Customer prompt', base: 0.68, risk: 42 },
  { reason: 'Subscription failure', action: 'Retry + link', base: 0.83, risk: 31 },
  { reason: 'Insufficient balance', action: 'Payment link', base: 0.64, risk: 49 },
  { reason: '3DS challenge expired', action: 'Customer prompt', base: 0.73, risk: 36 },
  { reason: 'Issuer unavailable', action: 'Retry payment', base: 0.86, risk: 29 },
  { reason: 'Velocity risk', action: 'Escalate', base: 0.18, risk: 88 },
] as const

export function evaluateTransaction({ amount, index, scenario }: Signal): RecoveryDecision {
  const playbook = playbooks[index % playbooks.length]
  const scenarioBias = scenario === 'checkout'
    ? (playbook.reason === 'Checkout abandoned' ? 0.08 : 0)
    : scenario === 'degradation'
      ? (['Bank timeout', 'Network degradation', 'Issuer unavailable'].includes(playbook.reason) ? 0.05 : -0.04)
      : 0

  const jitter = ((index * 17) % 9 - 4) / 100
  const recoveryProbability = Math.max(0.05, Math.min(0.98, playbook.base + scenarioBias + jitter))
  const riskScore = Math.max(1, Math.min(99, playbook.risk + ((index * 11) % 13 - 6)))
  const policyApproved = playbook.action !== 'Escalate' && riskScore < 70 && index % 23 !== 0
  const shouldRecover = policyApproved && recoveryProbability >= 0.55

  return {
    reason: playbook.reason,
    action: policyApproved ? playbook.action : 'Escalate',
    result: shouldRecover ? 'Recovered' : 'Stopped',
    confidence: Math.round(72 + recoveryProbability * 24 - riskScore * 0.08),
    recoveryProbability: Math.round(recoveryProbability * 100),
    riskScore,
    policy: policyApproved ? 'Approved' : 'Escalated',
    explanation: policyApproved
      ? `Bounded ${playbook.action.toLowerCase()} selected because recovery probability is ${Math.round(recoveryProbability * 100)}% with risk ${riskScore}/100.`
      : `Action stopped before money movement because policy risk reached ${riskScore}/100 or the intervention requires escalation.`,
  }
}

export function createTransaction(index: number, scenario: Signal['scenario']) {
  const amount = 799 + ((index * 1703) % 18000)
  const decision = evaluateTransaction({ amount, index, scenario })
  return {
    id: `TXN-${String(1042 - index).padStart(4, '0')}`,
    amount,
    latency: `${180 + ((index * 43) % 520)}ms`,
    ...decision,
  }
}
