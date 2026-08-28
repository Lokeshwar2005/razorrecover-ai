import React from 'react'
import { GraphTransactionContext } from '../../types/graph'
import { DecisionDeltaItem } from '../../types/counterfactual'

export interface DecisionDeltaProps {
  original: GraphTransactionContext
  counterfactual: GraphTransactionContext
}

export const DecisionDelta: React.FC<DecisionDeltaProps> = ({
  original,
  counterfactual,
}) => {
  const deltas: DecisionDeltaItem[] = [
    {
      key: 'amount',
      label: 'Amount',
      originalValue: `₹${original.amount.toLocaleString('en-IN')}`,
      counterfactualValue: `₹${counterfactual.amount.toLocaleString('en-IN')}`,
      changed: original.amount !== counterfactual.amount,
      impactType: 'neutral',
    },
    {
      key: 'reason',
      label: 'Failure Signature',
      originalValue: original.reason,
      counterfactualValue: counterfactual.reason,
      changed: original.reason !== counterfactual.reason,
      impactType: 'neutral',
    },
    {
      key: 'risk',
      label: 'Risk Score',
      originalValue: `${original.riskScore}/100`,
      counterfactualValue: `${counterfactual.riskScore}/100`,
      changed: original.riskScore !== counterfactual.riskScore,
      impactType: counterfactual.riskScore < original.riskScore ? 'positive' : 'negative',
    },
    {
      key: 'probability',
      label: 'Recovery Prob.',
      originalValue: `${original.recoveryProbability}%`,
      counterfactualValue: `${counterfactual.recoveryProbability}%`,
      changed: original.recoveryProbability !== counterfactual.recoveryProbability,
      impactType: counterfactual.recoveryProbability > original.recoveryProbability ? 'positive' : 'negative',
    },
    {
      key: 'policy',
      label: 'Policy Gate',
      originalValue: original.policy.toUpperCase(),
      counterfactualValue: counterfactual.policy.toUpperCase(),
      changed: original.policy !== counterfactual.policy,
      impactType: counterfactual.policy === 'Approved' ? 'positive' : 'negative',
    },
    {
      key: 'action',
      label: 'Intervention',
      originalValue: original.action,
      counterfactualValue: counterfactual.action,
      changed: original.action !== counterfactual.action,
      impactType: 'neutral',
    },
    {
      key: 'result',
      label: 'Final Outcome',
      originalValue: original.result.toUpperCase(),
      counterfactualValue: counterfactual.result.toUpperCase(),
      changed: original.result !== counterfactual.result,
      impactType: counterfactual.result === 'Recovered' ? 'positive' : 'negative',
    },
  ]

  const hasAnyChange = deltas.some((d) => d.changed)
  const isOutcomeFlipped = original.result !== counterfactual.result

  return (
    <div className="cfDeltaSection" aria-label="Decision delta breakdown">
      <div className="cfDeltaHeader">
        <h3>DECISION DELTA</h3>
        <small style={{ color: isOutcomeFlipped ? '#e4a641' : '#8c8273', fontSize: '8px', letterSpacing: '0.12em', fontWeight: 800 }}>
          {isOutcomeFlipped ? '● OUTCOME FLIPPED' : hasAnyChange ? '● CONDITIONS MODIFIED' : '● MATCHING ORIGINAL'}
        </small>
      </div>

      <div className="cfDeltaChips">
        {deltas.map((item) => {
          const isFlipped = item.key === 'result' && item.changed
          return (
            <div
              key={item.key}
              className={`cfDeltaChip ${item.changed ? 'changed' : ''} ${isFlipped ? 'flipped' : ''}`}
            >
              <span className="cfDeltaChip__label">{item.label}</span>
              <div className="cfDeltaChip__values">
                {item.changed ? (
                  <>
                    <em>{item.originalValue}</em>
                    <span>→</span>
                    <b>{item.counterfactualValue}</b>
                  </>
                ) : (
                  <span>{item.originalValue}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Deterministic Explanation */}
      <div className="cfDeltaExplanation">
        <strong>Deterministic Rationale: </strong>
        <span>{counterfactual.explanation}</span>
      </div>
    </div>
  )
}

export default DecisionDelta
