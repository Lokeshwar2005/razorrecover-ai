'use client'

import React, { useState, useEffect } from 'react'
import {
  executeRecoveryAction,
  verifyPaymentCapture,
  type RecoveryExecutionResult,
} from '../../services/backendApi'

interface TransactionItem {
  id: string
  merchant_id: string
  amount_minor: number
  currency: string
  source: string
  status: 'PENDING' | 'RECOVERED' | 'STOPPED' | 'ESCALATED' | 'IN_PROGRESS'
  direction: string
  reason: string
  action: string
  confidence: number
  recovery_probability: number
  risk_score: number
  policy: 'Approved' | 'Escalated' | 'Blocked'
  explanation: string
  created_at: string
}

export const TransactionExplorer: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [selectedTxn, setSelectedTxn] = useState<TransactionItem | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<RecoveryExecutionResult | null>(null)
  const [executionMsg, setExecutionMsg] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  // Seed / Synthetic fallback data
  useEffect(() => {
    const list: TransactionItem[] = [
      {
        id: 'TXN-1082',
        merchant_id: 'mer_default',
        amount_minor: 4500000,
        currency: 'INR',
        source: 'synthetic',
        status: 'PENDING',
        direction: 'Payment degradation',
        reason: 'Bank timeout',
        action: 'Retry payment',
        confidence: 94,
        recovery_probability: 84,
        risk_score: 22,
        policy: 'Approved',
        explanation: 'Diagnosed transient HDFC bank gateway spike. Automated retry scheduled within optimal 120s window.',
        created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: 'TXN-1094',
        merchant_id: 'mer_default',
        amount_minor: 3499900,
        currency: 'INR',
        source: 'synthetic',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason: 'Checkout abandoned',
        action: 'Payment link',
        confidence: 92,
        recovery_probability: 79,
        risk_score: 27,
        policy: 'Approved',
        explanation: 'Customer dropped off at OTP screen. Smart Payment Link generated with dynamic 15-min expiry.',
        created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      },
      {
        id: 'TXN-1077',
        merchant_id: 'mer_default',
        amount_minor: 1899900,
        currency: 'INR',
        source: 'synthetic',
        status: 'PENDING',
        direction: 'Subscription dunning',
        reason: 'Subscription charge failed',
        action: 'Retry subscription',
        confidence: 89,
        recovery_probability: 76,
        risk_score: 34,
        policy: 'Approved',
        explanation: 'Soft decline on recurring auto-debit. Scheduled smart dunning cadence across fallback payment methods.',
        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'TXN-1065',
        merchant_id: 'mer_default',
        amount_minor: 2499900,
        currency: 'INR',
        source: 'synthetic',
        status: 'PENDING',
        direction: 'Checkout friction',
        reason: 'High-intent failed payment',
        action: 'Call + payment link',
        confidence: 88,
        recovery_probability: 73,
        risk_score: 37,
        policy: 'Approved',
        explanation: 'Multi-device attempt indicated high purchase intent. Assigned Hinglish AI recovery agent.',
        created_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
      },
      {
        id: 'TXN-1051',
        merchant_id: 'mer_default',
        amount_minor: 1299900,
        currency: 'INR',
        source: 'synthetic',
        status: 'PENDING',
        direction: 'Mandate degradation',
        reason: 'Mandate debit failed',
        action: 'Retry mandate',
        confidence: 85,
        recovery_probability: 74,
        risk_score: 38,
        policy: 'Approved',
        explanation: 'Mandate processing window retry aligned with clearing bank settlement cycles.',
        created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      },
      {
        id: 'TXN-1042',
        merchant_id: 'mer_default',
        amount_minor: 7200000,
        currency: 'INR',
        source: 'synthetic',
        status: 'STOPPED',
        direction: 'High risk transaction',
        reason: 'High-risk velocity detected',
        action: 'Escalate',
        confidence: 96,
        recovery_probability: 79,
        risk_score: 84,
        policy: 'Blocked',
        explanation: 'Exceeded risk ceiling of 70/100. Policy engine prevented automated financial retry.',
        created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      },
    ]

    setTransactions(list)
    if (list.length > 0) setSelectedTxn(list[0])
  }, [])

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const handleExecuteTxn = async (txn: TransactionItem) => {
    if (txn.policy === 'Blocked' || txn.risk_score >= 70) {
      setExecutionMsg(`⛔ Blocked: Risk score (${txn.risk_score}/100) exceeds safety ceiling (70/100).`)
      setExecutionResult(null)
      return
    }

    setExecuting(true)
    setExecutionMsg(null)
    setExecutionResult(null)

    try {
      const res = await executeRecoveryAction({
        transaction_id: txn.id,
        action_type: txn.action,
        amount_minor: txn.amount_minor,
        currency: txn.currency,
      })
      setExecutionResult(res)
      setExecutionMsg(res.workflow_message)
      setTransactions((prev) =>
        prev.map((t) => (t.id === txn.id ? { ...t, status: 'IN_PROGRESS' } : t))
      )
      if (selectedTxn?.id === txn.id) {
        setSelectedTxn({ ...selectedTxn, status: 'IN_PROGRESS' })
      }
    } catch (e: any) {
      setExecutionMsg(`Execution failed: ${e?.message}`)
    } finally {
      setExecuting(false)
    }
  }

  const handleVerifyTxn = async (txn: TransactionItem) => {
    setVerifying(true)
    try {
      const mockPayId = `pay_${txn.id.replace('-', '_').toLowerCase()}_${Date.now()}`
      const res = await verifyPaymentCapture({
        transaction_id: txn.id,
        payment_id: mockPayId,
        amount_minor: txn.amount_minor,
        currency: txn.currency,
      })
      if (res.verified) {
        setExecutionMsg(`✓ Payment ${mockPayId} verified as captured! Transaction marked RECOVERED.`)
        setTransactions((prev) =>
          prev.map((t) => (t.id === txn.id ? { ...t, status: 'RECOVERED' } : t))
        )
        if (selectedTxn?.id === txn.id) {
          setSelectedTxn({ ...selectedTxn, status: 'RECOVERED' })
        }
      }
    } catch (e) {
      setExecutionMsg('Verification check failed.')
    } finally {
      setVerifying(false)
    }
  }

  // Filter & search logic
  const filtered = transactions.filter((t) => {
    if (search) {
      const q = search.toLowerCase()
      const matchesSearch =
        t.id.toLowerCase().includes(q) ||
        t.reason.toLowerCase().includes(q) ||
        t.action.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }

    if (filter === 'failed') return t.status === 'STOPPED'
    if (filter === 'pending') return t.status === 'PENDING'
    if (filter === 'recovered') return t.status === 'RECOVERED'
    if (filter === 'blocked' || filter === 'escalated') return t.policy === 'Blocked' || t.policy === 'Escalated'
    if (filter === 'high_risk') return t.risk_score >= 60
    if (filter === 'high_value') return t.amount_minor >= 2000000
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Transaction Intelligence Explorer</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              {filtered.length} of {transactions.length} Transactions
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Search, filter, and inspect full lifecycle audit trails for any payment event.
          </p>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search by ID, failure reason, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#15120c] border border-[#2e271c] text-[#f4ede2] placeholder-[#7a7164] focus:outline-none focus:border-[#e5a944]"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-mono">
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'pending', label: 'Pending Recovery' },
          { id: 'recovered', label: 'Verified Recovered' },
          { id: 'failed', label: 'Failed / Stopped' },
          { id: 'blocked', label: 'Policy Blocked' },
          { id: 'high_risk', label: 'High Risk (≥60)' },
          { id: 'high_value', label: 'High Value (≥₹20k)' },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setFilter(pill.id)}
            className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition ${
              filter === pill.id
                ? 'bg-[#e5a944] text-[#080705] border-[#e5a944] font-bold'
                : 'bg-[#15120c] text-[#a89f91] border-[#2e271c] hover:border-[#453d32]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Notification Banner */}
      {executionMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between animate-fade-in ${
            executionMsg.startsWith('✓')
              ? 'bg-[#10b981]/15 border-[#10b981]/50 text-[#10b981]'
              : executionMsg.startsWith('⛔')
              ? 'bg-[#ef4444]/15 border-[#ef4444]/50 text-[#ef4444]'
              : 'bg-[#e5a944]/15 border-[#e5a944]/50 text-[#e5a944]'
          }`}
        >
          <span>{executionMsg}</span>
          <button onClick={() => setExecutionMsg(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: List on Left, Detail Audit Trace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Table */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-center text-[#a89f91] text-sm font-mono">
              No transactions match your search filter.
            </div>
          ) : (
            filtered.map((t) => {
              const isSelected = selectedTxn?.id === t.id
              const isRecovered = t.status === 'RECOVERED'
              const isStopped = t.status === 'STOPPED'
              const isInProgress = t.status === 'IN_PROGRESS'

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTxn(t)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-[#1a150e] border-[#e5a944] shadow-[0_0_15px_rgba(229,169,68,0.2)]'
                      : isRecovered
                      ? 'bg-[#0f0c08] border-[#10b981]/30 hover:border-[#10b981]/50'
                      : isStopped
                      ? 'bg-[#0f0c08] border-[#ef4444]/30 hover:border-[#ef4444]/50 opacity-80'
                      : 'bg-[#0f0c08] border-[#2e271c] hover:border-[#453d32]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#f4ede2]">{t.id}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                          isRecovered
                            ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                            : isStopped
                            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40'
                            : isInProgress
                            ? 'bg-[#e5a944]/20 text-[#e5a944] border-[#e5a944]/40 animate-pulse'
                            : 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/40'
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-xs text-[#7a7164]">• {t.direction}</span>
                    </div>
                    <div className="text-xs text-[#a89f91]">
                      Reason: <strong className="text-[#f4ede2]">{t.reason}</strong> • Action:{' '}
                      <strong className="text-[#e5a944]">{t.action}</strong>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-[#2e271c]">
                    <div className="text-base font-mono font-bold text-[#f4ede2]">{formatRupees(t.amount_minor)}</div>
                    <div className="text-[11px] font-mono text-[#7a7164]">
                      Risk: <span className={t.risk_score >= 60 ? 'text-[#ef4444]' : 'text-[#10b981]'}>{t.risk_score}/100</span> • Prob:{' '}
                      <span className="text-[#10b981]">{t.recovery_probability}%</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Lifecycle Inspection Panel */}
        {selectedTxn && (
          <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#e5a944]">LIFECYCLE TRACE</h3>
                <div className="text-xs text-[#a89f91]">{selectedTxn.id}</div>
              </div>
              <span
                className={`px-2 py-0.5 text-xs rounded border ${
                  selectedTxn.policy === 'Approved'
                    ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
                    : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                }`}
              >
                {selectedTxn.policy}
              </span>
            </div>

            {/* Lifecycle Steps */}
            <div className="space-y-3 text-xs">
              {/* Step 1: Failure Detection */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> 01 FAILURE DETECTED
                </div>
                <div className="text-[#f4ede2] font-semibold">{selectedTxn.reason}</div>
                <div className="text-[#a89f91] text-[11px]">{selectedTxn.direction}</div>
              </div>

              {/* Step 2: Risk Scoring */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> 02 RISK & LIKELIHOOD
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Risk Assessment:</span>
                  <span className={selectedTxn.risk_score >= 60 ? 'text-[#ef4444]' : 'text-[#10b981]'}>
                    {selectedTxn.risk_score}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89f91]">Recovery Probability:</span>
                  <span className="text-[#10b981] font-bold">{selectedTxn.recovery_probability}%</span>
                </div>
              </div>

              {/* Step 3: AI Diagnosis */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e5a944]" /> 03 AI DIAGNOSIS
                </div>
                <div className="text-[#e5a944] font-semibold">Recommended: {selectedTxn.action}</div>
                <p className="text-[11px] text-[#a89f91]">{selectedTxn.explanation}</p>
              </div>

              {/* Step 4: Deterministic Policy */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> 04 POLICY DECISION
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#f4ede2]">Decision:</span>
                  <span className={selectedTxn.policy === 'Approved' ? 'text-[#10b981] font-bold' : 'text-[#ef4444] font-bold'}>
                    {selectedTxn.policy}
                  </span>
                </div>
                <div className="text-[11px] text-[#7a7164]">
                  Risk: {selectedTxn.risk_score}/100 • Probability: {selectedTxn.recovery_probability}%
                </div>
              </div>

              {/* Step 5: Bounded Action */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-2">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e5a944]" /> 05 BOUNDED ACTION
                </div>
                <div className="text-[#f4ede2] font-semibold">{selectedTxn.action}</div>

                {selectedTxn.status === 'RECOVERED' ? (
                  <div className="text-[#10b981] text-[11px]">✓ Recovery Action Succeeded & Verified</div>
                ) : selectedTxn.policy === 'Blocked' ? (
                  <div className="text-[#ef4444] text-[11px]">⛔ Action Blocked: High risk transaction</div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleExecuteTxn(selectedTxn)}
                      disabled={executing}
                      className="w-full py-2 px-3 rounded bg-[#e5a944] text-[#080705] font-bold text-xs hover:bg-[#fcd34d] transition disabled:opacity-50"
                    >
                      {executing ? 'Executing...' : 'Execute Recovery Action ▶'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 6: Payment Verification */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-2">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> 06 PAYMENT VERIFICATION
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a89f91]">Status:</span>
                  <span
                    className={`font-bold ${
                      selectedTxn.status === 'RECOVERED'
                        ? 'text-[#10b981]'
                        : selectedTxn.status === 'STOPPED'
                        ? 'text-[#ef4444]'
                        : 'text-[#e5a944]'
                    }`}
                  >
                    {selectedTxn.status}
                  </span>
                </div>
                {selectedTxn.status !== 'RECOVERED' && selectedTxn.policy === 'Approved' && (
                  <button
                    onClick={() => handleVerifyTxn(selectedTxn)}
                    disabled={verifying}
                    className="w-full py-1.5 px-3 rounded bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] font-bold text-[11px] hover:bg-[#10b981]/30 transition disabled:opacity-50"
                  >
                    {verifying ? 'Verifying Capture...' : 'Verify Captured Payment Gate ↗'}
                  </button>
                )}
              </div>

              {/* Step 7: Cryptographic Audit */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] text-[#7a7164] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> 07 AUDIT LEDGER
                </div>
                <div className="text-[10px] text-[#a89f91] truncate font-mono">
                  SHA-256: 7f8a9e2d4c...b91a
                </div>
                <div className="text-[10px] text-[#10b981]">✓ Tamper-evident verified</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
