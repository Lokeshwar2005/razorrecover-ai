import React from 'react'
import { GraphTransactionContext } from '../../types/graph'

export interface DecisionComparisonProps {
  original: GraphTransactionContext
  counterfactual: GraphTransactionContext
}

export const DecisionComparison: React.FC<DecisionComparisonProps> = ({
  original,
  counterfactual,
}) => {
  const isCfRecovered = counterfactual.result === 'Recovered'
  const isCfApproved = counterfactual.policy === 'Approved'

  return (
    <div className="cfComparison" aria-label="Decision comparison: original versus counterfactual">
      <div className="cfCardsGrid">
        {/* Original Card */}
        <div className="cfCard cfCard--original">
          <div className="cfCardHeader">
            <span className="cfCardTitle">ORIGINAL DECISION</span>
            <span className={`cfCardBadge ${original.result.toLowerCase()}`}>
              {original.result.toUpperCase()}
            </span>
          </div>

          <div className="cfRow">
            <span>Transaction</span>
            <strong>{original.id} · ₹{original.amount.toLocaleString('en-IN')}</strong>
          </div>

          <div className="cfRow">
            <span>Failure Reason</span>
            <strong>{original.reason}</strong>
          </div>

          <div className="cfRow">
            <span>Risk Score</span>
            <strong style={{ color: original.riskScore >= 70 ? '#ef4444' : '#34d399' }}>
              {original.riskScore}/100
            </strong>
          </div>

          <div className="cfRow">
            <span>Recovery Prob.</span>
            <strong>{original.recoveryProbability}%</strong>
          </div>

          <div className="cfRow">
            <span>Policy Gate</span>
            <strong style={{ color: original.policy === 'Approved' ? '#34d399' : '#ef4444' }}>
              {original.policy}
            </strong>
          </div>

          <div className="cfRow">
            <span>Action</span>
            <strong>{original.action}</strong>
          </div>
        </div>

        {/* Counterfactual Card */}
        <div
          className={`cfCard cfCard--counterfactual ${
            isCfRecovered ? 'is-passed' : 'is-blocked'
          }`}
        >
          <div className="cfCardHeader">
            <span className="cfCardTitle">COUNTERFACTUAL</span>
            <span className={`cfCardBadge ${counterfactual.result.toLowerCase()}`}>
              {counterfactual.result.toUpperCase()}
            </span>
          </div>

          <div className="cfRow">
            <span>Transaction</span>
            <strong>{counterfactual.id} · ₹{counterfactual.amount.toLocaleString('en-IN')}</strong>
          </div>

          <div className="cfRow">
            <span>Failure Reason</span>
            <strong>{counterfactual.reason}</strong>
          </div>

          <div className="cfRow">
            <span>Risk Score</span>
            <strong style={{ color: counterfactual.riskScore >= 70 ? '#ef4444' : '#34d399' }}>
              {counterfactual.riskScore}/100
            </strong>
          </div>

          <div className="cfRow">
            <span>Recovery Prob.</span>
            <strong>{counterfactual.recoveryProbability}%</strong>
          </div>

          <div className="cfRow">
            <span>Policy Gate</span>
            <strong style={{ color: isCfApproved ? '#34d399' : '#ef4444' }}>
              {counterfactual.policy}
            </strong>
          </div>

          <div className="cfRow">
            <span>Action</span>
            <strong>{counterfactual.action}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DecisionComparison
