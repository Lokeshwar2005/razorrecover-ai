'use client'

import React, { useEffect, useState } from 'react'
import { fetchOpportunities, type OpportunityItem } from '../../services/backendApi'

export const OpportunityQueue: React.FC = () => {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOpp, setSelectedOpp] = useState<OpportunityItem | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executionMessage, setExecutionMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchOpportunities().then((data) => {
      setOpportunities(data)
      if (data.length > 0) setSelectedOpp(data[0])
      setLoading(false)
    })
  }, [])

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const handleExecute = (opp: OpportunityItem) => {
    setExecuting(true)
    setExecutionMessage(`Initializing bounded '${opp.recommended_action}' via Razorpay Test Mode...`)
    setTimeout(() => {
      setExecuting(false)
      setExecutionMessage(
        `✓ Recovery initiated for ${opp.transaction_id}. Expected outcome: ${formatRupees(opp.expected_value_minor)} under deterministic policy authorization.`
      )
    }, 1200)
  }

  if (loading) {
    return <div className="p-8 text-center text-[#e5a944] animate-pulse">Calculating Expected Recovery Values...</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Recovery Opportunity Engine</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              Ranked by Expected Value (Amount × Probability)
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Prioritizes highest-value safe recoveries within deterministic policy boundaries.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[#7a7164]">
          <div>
            TOTAL QUEUE: <span className="text-[#f4ede2] font-bold">{opportunities.length} Items</span>
          </div>
          <div>
            POTENTIAL: <span className="text-[#10b981] font-bold">
              {formatRupees(opportunities.reduce((acc, o) => acc + o.expected_value_minor, 0))}
            </span>
          </div>
        </div>
      </div>

      {executionMessage && (
        <div className="p-4 rounded-lg bg-[#10b981]/10 border border-[#10b981]/40 text-[#10b981] text-sm font-mono flex items-center justify-between">
          <span>{executionMessage}</span>
          <button onClick={() => setExecutionMessage(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: Queue on Left, Optimizer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunity List (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-3">
          {opportunities.map((opp) => {
            const isSelected = selectedOpp?.id === opp.id
            const priorityColors = {
              CRITICAL: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30',
              HIGH: 'bg-[#e5a944]/10 text-[#e5a944] border-[#e5a944]/30',
              MEDIUM: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
              LOW: 'bg-[#7a7164]/10 text-[#a89f91] border-[#7a7164]/30',
            }

            return (
              <div
                key={opp.id}
                onClick={() => setSelectedOpp(opp)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-[#1c1710] border-[#e5a944] shadow-[0_0_15px_rgba(229,169,68,0.15)]'
                    : 'bg-[#0f0c08] border-[#2e271c] hover:border-[#453d32]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${priorityColors[opp.priority]}`}>
                      {opp.priority}
                    </span>
                    <span className="font-mono font-bold text-sm text-[#f4ede2]">{opp.transaction_id}</span>
                    <span className="text-xs text-[#7a7164]">• {opp.reason}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-[#a89f91]">
                    <span>Amount: <strong className="text-[#f4ede2]">{formatRupees(opp.amount_minor)}</strong></span>
                    <span>Prob: <strong className="text-[#10b981]">{opp.recovery_probability}%</strong></span>
                    <span>Risk: <strong className="text-[#e5a944]">{opp.risk_score}/100</strong></span>
                  </div>
                </div>

                <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-[#2e271c]">
                  <div className="text-[10px] font-mono text-[#7a7164]">EXPECTED VALUE</div>
                  <div className="text-lg font-mono font-bold text-[#fcd34d]">
                    {formatRupees(opp.expected_value_minor)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Strategy Optimizer Detail Panel */}
        {selectedOpp && (
          <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
              <div>
                <h3 className="text-sm font-mono font-bold text-[#e5a944]">STRATEGY OPTIMIZER</h3>
                <div className="text-xs text-[#a89f91]">Candidate Playbook Simulation</div>
              </div>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                {selectedOpp.policy_status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-[#7a7164]">TARGET TRANSACTION</div>
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Transaction ID:</span>
                  <span className="text-[#f4ede2] font-bold">{selectedOpp.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Raw Value:</span>
                  <span className="text-[#f4ede2]">{formatRupees(selectedOpp.amount_minor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Failure Signal:</span>
                  <span className="text-[#e5a944]">{selectedOpp.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Expected Recovery:</span>
                  <span className="text-[#10b981] font-bold">{formatRupees(selectedOpp.expected_value_minor)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-[#7a7164]">RECOMMENDED SAFE ACTION</div>
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#e5a944]/40 space-y-1">
                <div className="text-sm font-bold text-[#f4ede2] flex items-center gap-2">
                  <span>⚡</span> {selectedOpp.recommended_action}
                </div>
                <p className="text-xs text-[#a89f91]">
                  Authorized by deterministic policy gate (Risk {selectedOpp.risk_score} &lt; 70 ceiling, Probability {selectedOpp.recovery_probability}% &gt; 55% floor).
                </p>
              </div>
            </div>

            <button
              onClick={() => handleExecute(selectedOpp)}
              disabled={executing}
              className="w-full py-2.5 px-4 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-sm hover:bg-[#fcd34d] transition shadow-[0_0_15px_rgba(229,169,68,0.3)] disabled:opacity-50"
            >
              {executing ? 'Executing Bounded Action...' : `Execute Recovery (${formatRupees(selectedOpp.expected_value_minor)}) ▶`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
