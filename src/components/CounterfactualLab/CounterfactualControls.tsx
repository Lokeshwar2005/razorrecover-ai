import React from 'react'
import { CounterfactualInputs } from '../../types/counterfactual'
import { PLAYBOOKS } from '../../recoveryEngine'

export interface CounterfactualControlsProps {
  inputs: CounterfactualInputs
  onChange: (updated: CounterfactualInputs) => void
  disabled?: boolean
}

export const CounterfactualControls: React.FC<CounterfactualControlsProps> = ({
  inputs,
  onChange,
  disabled = false,
}) => {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...inputs, amount: Number(e.target.value) })
  }

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextReason = e.target.value
    const matched = PLAYBOOKS.find((p) => p.reason === nextReason)
    onChange({
      ...inputs,
      reason: nextReason,
      // Default to matching playbook base risk if user changes failure mode, while preserving custom overrides
      actionOverride: undefined,
    })
  }

  const handleRiskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...inputs, riskScore: Number(e.target.value) })
  }

  const handleProbabilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...inputs, recoveryProbability: Number(e.target.value) })
  }

  const handleRetryChange = (attempts: number) => {
    onChange({ ...inputs, retryAttempts: attempts })
  }

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...inputs, policyThreshold: Number(e.target.value) })
  }

  const riskClass = inputs.riskScore >= 70 ? 'risk-high' : inputs.riskScore <= 35 ? 'risk-low' : ''

  return (
    <div className="cfControls" aria-label="Counterfactual condition controls">
      <div className="cfControls__title">
        <span>INTERVENTION PARAMETERS</span>
        <small>MUTABLE SIMULATION</small>
      </div>

      {/* Failure Reason */}
      <div className="cfControlGroup">
        <label className="cfControlLabel" htmlFor="cf-reason">
          <span>FAILURE REASON / SIGNATURE</span>
        </label>
        <select
          id="cf-reason"
          className="cfSelect"
          value={inputs.reason}
          onChange={handleReasonChange}
          disabled={disabled}
        >
          {PLAYBOOKS.map((p) => (
            <option key={p.reason} value={p.reason}>
              {p.reason} ({p.action})
            </option>
          ))}
        </select>
      </div>

      {/* Transaction Amount */}
      <div className="cfControlGroup">
        <div className="cfControlLabel">
          <label htmlFor="cf-amount">TRANSACTION AMOUNT</label>
          <strong>₹{inputs.amount.toLocaleString('en-IN')}</strong>
        </div>
        <input
          id="cf-amount"
          type="range"
          min="199"
          max="35000"
          step="100"
          className="cfSlider"
          value={inputs.amount}
          onChange={handleAmountChange}
          disabled={disabled}
          aria-label="Transaction Amount"
          aria-valuemin={199}
          aria-valuemax={35000}
          aria-valuenow={inputs.amount}
        />
      </div>

      {/* Risk Score */}
      <div className="cfControlGroup">
        <div className="cfControlLabel">
          <label htmlFor="cf-risk">RISK SCORE (SAFETY THRESHOLD: {inputs.policyThreshold})</label>
          <strong style={{ color: inputs.riskScore >= inputs.policyThreshold ? '#ef4444' : '#34d399' }}>
            {inputs.riskScore} / 100
          </strong>
        </div>
        <input
          id="cf-risk"
          type="range"
          min="1"
          max="99"
          className={`cfSlider ${riskClass}`}
          value={inputs.riskScore}
          onChange={handleRiskChange}
          disabled={disabled}
          aria-label="Risk Score"
          aria-valuemin={1}
          aria-valuemax={99}
          aria-valuenow={inputs.riskScore}
        />
      </div>

      {/* Recovery Probability */}
      <div className="cfControlGroup">
        <div className="cfControlLabel">
          <label htmlFor="cf-prob">RECOVERY PROBABILITY</label>
          <strong style={{ color: inputs.recoveryProbability >= 55 ? '#34d399' : '#e4a641' }}>
            {inputs.recoveryProbability}%
          </strong>
        </div>
        <input
          id="cf-prob"
          type="range"
          min="5"
          max="98"
          className="cfSlider"
          value={inputs.recoveryProbability}
          onChange={handleProbabilityChange}
          disabled={disabled}
          aria-label="Recovery Probability"
          aria-valuemin={5}
          aria-valuemax={98}
          aria-valuenow={inputs.recoveryProbability}
        />
      </div>

      {/* Retry Attempts */}
      <div className="cfControlGroup">
        <div className="cfControlLabel">
          <span>RETRY ATTEMPTS (MAX 2 BOUNDARY)</span>
          <strong>{inputs.retryAttempts} / 2</strong>
        </div>
        <div className="cfSegmented" role="group" aria-label="Retry attempts">
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              type="button"
              className={`cfSegmentBtn ${inputs.retryAttempts === num ? 'active' : ''}`}
              onClick={() => handleRetryChange(num)}
              disabled={disabled}
            >
              {num === 3 ? '3 (Limit Exceeded)' : `${num} of 2`}
            </button>
          ))}
        </div>
      </div>

      {/* Policy Safety Threshold */}
      <div className="cfControlGroup">
        <div className="cfControlLabel">
          <label htmlFor="cf-threshold">POLICY SAFETY THRESHOLD</label>
          <strong>{inputs.policyThreshold} / 100</strong>
        </div>
        <input
          id="cf-threshold"
          type="range"
          min="50"
          max="90"
          step="5"
          className="cfSlider"
          value={inputs.policyThreshold}
          onChange={handleThresholdChange}
          disabled={disabled}
          aria-label="Policy Threshold"
          aria-valuemin={50}
          aria-valuemax={90}
          aria-valuenow={inputs.policyThreshold}
        />
      </div>
    </div>
  )
}

export default CounterfactualControls
