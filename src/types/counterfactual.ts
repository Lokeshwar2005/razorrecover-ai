import { GraphTransactionContext } from './graph'

export interface CounterfactualInputs {
  amount: number
  reason: string
  riskScore: number
  recoveryProbability: number
  retryAttempts: number
  policyThreshold: number
  actionOverride?: string
}

export interface DecisionDeltaItem {
  key: string
  label: string
  originalValue: string | number
  counterfactualValue: string | number
  changed: boolean
  impactType: 'positive' | 'negative' | 'neutral'
}

export interface CounterfactualComparisonState {
  original: GraphTransactionContext
  counterfactual: GraphTransactionContext
  inputs: CounterfactualInputs
  deltas: DecisionDeltaItem[]
  isDecisionFlipped: boolean
  isPolicyFlipped: boolean
}
