import { useEffect, useState } from 'react'
import type { AIRecoveryRecommendation } from '../../types/ai'
import type { RecoveryDecision } from '../../recoveryEngine'
import { analyzeRecoveryWithClaude } from '../../services/recoveryAi'
import './ai-recovery.css'

type Transaction = {
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

export default function AIRecoveryAdvisor({ transaction }: { transaction: Transaction | null }) {
  const [result, setResult] = useState<AIRecoveryRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setResult(null)
    setError('')
  }, [transaction?.id, transaction?.amount])

  if (!transaction) return null

  const analyze = async () => {
    setLoading(true)
    setError('')
    try {
      const recommendation = await analyzeRecoveryWithClaude({ transaction })
      setResult(recommendation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Claude')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel aiAdvisor">
      <div className="panelTop aiAdvisorTop">
        <div>
          <span className="eyebrow">CLAUDE · AI DIAGNOSIS</span>
          <h2>AI Recovery Advisor</h2>
        </div>
        <span className={`aiStatus ${result ? 'connected' : ''}`}>● {result ? 'CLAUDE ANALYZED' : 'READY'}</span>
      </div>

      <div className="aiAdvisorGrid">
        <div className="aiInputCard">
          <span className="aiLabel">TRANSACTION CONTEXT</span>
          <strong>{transaction.id} · ₹{Math.round(transaction.amount).toLocaleString('en-IN')}</strong>
          <div className="aiFacts">
            <span>Failure <b>{transaction.reason}</b></span>
            <span>Risk <b>{transaction.riskScore}/100</b></span>
            <span>Recovery <b>{transaction.recoveryProbability}%</b></span>
            <span>Policy <b className={transaction.policy === 'Approved' ? 'aiGood' : 'aiStop'}>{transaction.policy}</b></span>
          </div>
          <button className="aiAnalyzeButton" onClick={analyze} disabled={loading}>
            {loading ? 'Claude is analyzing…' : result ? 'Re-analyze with Claude ↻' : 'Analyze with Claude →'}
          </button>
          {error && <div className="aiError">{error}</div>}
        </div>

        <div className="aiResultCard">
          {!result ? (
            <div className="aiEmpty">
              <span>AI → POLICY → ACTION</span>
              <p>Claude diagnoses the failure and recommends a bounded intervention. Your deterministic policy gate remains the final authority.</p>
            </div>
          ) : (
            <>
              <div className="aiRecommendationHeader">
                <div><span className="aiLabel">AI RECOMMENDATION</span><strong>{result.recommendedAction}</strong></div>
                <span className={`aiDecision ${result.executionAllowed ? 'allowed' : 'blocked'}`}>{result.executionAllowed ? 'POLICY ALIGNED' : 'POLICY BLOCKED'}</span>
              </div>
              <div className="aiMetrics">
                <div><small>AI CONFIDENCE</small><b>{result.confidence}%</b></div>
                <div><small>AI RECOVERY EST.</small><b>{result.recoveryProbability}%</b></div>
                <div><small>POLICY</small><b>{result.policyAlignment.toUpperCase()}</b></div>
              </div>
              <div className="aiReason"><span>DIAGNOSIS</span><p>{result.diagnosis}</p><small>{result.explanation}</small></div>
              <div className="aiPolicyReason"><span>DETERMINISTIC SAFETY GATE</span><b>{result.policyReason}</b></div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
