import type { RecoveryDecision } from '../recoveryEngine'

export type AIProvider = 'anthropic'

export interface AIRecoveryRequest {
  transaction: {
    id: string
    amount: number
    reason: string
    confidence: number
    recoveryProbability: number
    riskScore: number
    policy: RecoveryDecision['policy']
    action: string
    result: RecoveryDecision['result']
    explanation: string
  }
}

export interface AIRecoveryRecommendation {
  provider: AIProvider
  model: string
  diagnosis: string
  rootCause: string
  recommendation: string
  recommendedAction: string
  recoveryProbability: number
  riskAssessment: string
  confidence: number
  policyAlignment: 'aligned' | 'conflict' | 'escalate'
  policyReason: string
  executionAllowed: boolean
  explanation: string
}
