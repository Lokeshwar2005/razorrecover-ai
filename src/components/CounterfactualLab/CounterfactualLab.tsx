import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GraphTransactionContext } from '../../types/graph'
import { CounterfactualInputs } from '../../types/counterfactual'
import { evaluateCounterfactual } from '../../recoveryEngine'
import CounterfactualControls from './CounterfactualControls'
import DecisionComparison from './DecisionComparison'
import DecisionDelta from './DecisionDelta'
import './counterfactual.css'

export interface CounterfactualLabProps {
  originalTransaction: GraphTransactionContext | null
  onActiveGraphTargetChange?: (target: 'original' | 'counterfactual', counterfactual: GraphTransactionContext | null, isRunning: boolean, progress: number) => void
}

export const CounterfactualLab: React.FC<CounterfactualLabProps> = ({
  originalTransaction,
  onActiveGraphTargetChange,
}) => {
  // Fallback transaction if none selected
  const defaultOriginal: GraphTransactionContext = useMemo(
    () =>
      originalTransaction || {
        id: 'TXN-1042',
        amount: 2499,
        reason: 'Network degradation',
        action: 'Retry payment',
        result: 'Recovered',
        confidence: 94,
        recoveryProbability: 82,
        riskScore: 28,
        policy: 'Approved',
        explanation: 'Bounded retry payment selected because recovery probability is 82% with risk 28/100.',
        latency: '210ms',
      },
    [originalTransaction]
  )

  // Initialize mutable counterfactual inputs
  const [inputs, setInputs] = useState<CounterfactualInputs>(() => ({
    amount: defaultOriginal.amount,
    reason: defaultOriginal.reason,
    riskScore: defaultOriginal.riskScore,
    recoveryProbability: defaultOriginal.recoveryProbability,
    retryAttempts: 1,
    policyThreshold: 70,
  }))

  // Track active 3D view target ('counterfactual' by default for interactive lab, or 'original')
  const [graphTarget, setGraphTarget] = useState<'counterfactual' | 'original'>('counterfactual')
  const [isRunningDemo, setIsRunningDemo] = useState(false)
  const [demoProgress, setDemoProgress] = useState(100)
  const animRaf = useRef<number | null>(null)

  // Reset inputs when the original transaction selection changes
  useEffect(() => {
    setInputs({
      amount: defaultOriginal.amount,
      reason: defaultOriginal.reason,
      riskScore: defaultOriginal.riskScore,
      recoveryProbability: defaultOriginal.recoveryProbability,
      retryAttempts: 1,
      policyThreshold: 70,
    })
    setIsRunningDemo(false)
    setDemoProgress(100)
  }, [defaultOriginal.id, defaultOriginal.amount, defaultOriginal.reason, defaultOriginal.riskScore, defaultOriginal.recoveryProbability])

  // Pure deterministic evaluation of the counterfactual decision
  const counterfactualDecision = useMemo(() => {
    return evaluateCounterfactual({
      amount: inputs.amount,
      reason: inputs.reason,
      riskScore: inputs.riskScore,
      recoveryProbability: inputs.recoveryProbability,
      retryAttempts: inputs.retryAttempts,
      policyThreshold: inputs.policyThreshold,
      actionOverride: inputs.actionOverride,
    })
  }, [inputs])

  // Complete counterfactual transaction context
  const counterfactualTransaction: GraphTransactionContext = useMemo(() => {
    return {
      id: `${defaultOriginal.id} (CF)`,
      amount: inputs.amount,
      latency: defaultOriginal.latency,
      ...counterfactualDecision,
    }
  }, [defaultOriginal.id, defaultOriginal.latency, inputs.amount, counterfactualDecision])

  // Sync to parent graph handler
  useEffect(() => {
    onActiveGraphTargetChange?.(
      graphTarget,
      counterfactualTransaction,
      isRunningDemo,
      demoProgress
    )
  }, [graphTarget, counterfactualTransaction, isRunningDemo, demoProgress, onActiveGraphTargetChange])

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animRaf.current) cancelAnimationFrame(animRaf.current)
    }
  }, [])

  // Reset counterfactual state to match original exactly
  const handleReset = useCallback(() => {
    if (animRaf.current) cancelAnimationFrame(animRaf.current)
    setIsRunningDemo(false)
    setDemoProgress(100)
    setInputs({
      amount: defaultOriginal.amount,
      reason: defaultOriginal.reason,
      riskScore: defaultOriginal.riskScore,
      recoveryProbability: defaultOriginal.recoveryProbability,
      retryAttempts: 1,
      policyThreshold: 70,
    })
  }, [defaultOriginal])

  // Run animated counterfactual progression
  const handleRunDemo = useCallback(() => {
    if (isRunningDemo) return
    setIsRunningDemo(true)
    setDemoProgress(0)
    setGraphTarget('counterfactual')

    const startTime = performance.now()
    const duration = 2800 // 2.8s smooth demo progression

    const tick = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(100, (elapsed / duration) * 100)
      setDemoProgress(p)

      if (p < 100) {
        animRaf.current = requestAnimationFrame(tick)
      } else {
        setIsRunningDemo(false)
        setDemoProgress(100)
      }
    }

    animRaf.current = requestAnimationFrame(tick)
  }, [isRunningDemo])

  const toggleGraphTarget = () => {
    setGraphTarget((prev) => (prev === 'counterfactual' ? 'original' : 'counterfactual'))
  }

  return (
    <section className="counterfactualLab" aria-label="Counterfactual Recovery Simulator">
      {/* Header */}
      <div className="counterfactualLab__header">
        <div className="counterfactualLab__headerLeft">
          <span className="eyebrow">COUNTERFACTUAL RECOVERY SIMULATOR</span>
          <h2>Change the conditions. Watch the decision change.</h2>
          <p className="counterfactualLab__sub">
            Interrogate the deterministic recovery & policy boundaries without altering real transaction records or audit history.
          </p>
        </div>

        <div className="counterfactualLab__headerRight">
          <div className="counterfactualLab__safetyPill" title="Original transaction data is immutable and never modified">
            <span className="safetyDot" />
            <span>SIMULATION ONLY · NO REAL FUNDS</span>
          </div>

          <div className="counterfactualLab__actions">
            <button
              type="button"
              className={`cfBtn cfBtn--viewToggle ${graphTarget === 'counterfactual' ? 'active' : ''}`}
              onClick={toggleGraphTarget}
              title="Toggle which transaction state is displayed in the 3D Recovery Intelligence Graph"
            >
              {graphTarget === 'counterfactual' ? '3D Graph: Counterfactual ⇄' : '3D Graph: Original ⇄'}
            </button>

            <button
              type="button"
              className="cfBtn cfBtn--reset"
              onClick={handleReset}
              title="Reset all conditions to match original transaction"
              disabled={isRunningDemo}
            >
              Reset ↺
            </button>

            <button
              type="button"
              className="cfBtn cfBtn--run"
              onClick={handleRunDemo}
              disabled={isRunningDemo}
            >
              <span>{isRunningDemo ? `Evaluating ${Math.floor(demoProgress)}%...` : 'Run Counterfactual ▶'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout: Controls (Left) vs Comparison & Delta (Right) */}
      <div className="counterfactualLab__grid">
        {/* Controls Column */}
        <CounterfactualControls
          inputs={inputs}
          onChange={(newInputs) => {
            setInputs(newInputs)
            setGraphTarget('counterfactual')
          }}
          disabled={isRunningDemo}
        />

        {/* Comparison & Delta Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <DecisionComparison
            original={defaultOriginal}
            counterfactual={counterfactualTransaction}
          />
          <DecisionDelta
            original={defaultOriginal}
            counterfactual={counterfactualTransaction}
          />
        </div>
      </div>
    </section>
  )
}

export default CounterfactualLab
