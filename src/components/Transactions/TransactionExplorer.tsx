'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  useTransactionStore,
  computeMetricsFromTransactions,
  type CanonicalTransaction,
  type TransactionSource,
} from '../../services/canonicalTransactionStore'

const PAGE_SIZE = 15

export const TransactionExplorer: React.FC = () => {
  const transactions = useTransactionStore((s) => s.transactions)
  const selectedTransactionId = useTransactionStore((s) => s.selectedTransactionId)
  const setSelectedTransactionId = useTransactionStore((s) => s.setSelectedTransactionId)
  const getTransactionById = useTransactionStore((s) => s.getTransactionById)
  const executeRecovery = useTransactionStore((s) => s.executeRecovery)
  const verifyPayment = useTransactionStore((s) => s.verifyPayment)
  const refreshProviderFeed = useTransactionStore((s) => s.refreshProviderFeed)
  const providerFeedStatus = useTransactionStore((s) => s.providerFeedStatus)

  const metrics = useMemo(() => computeMetricsFromTransactions(transactions), [transactions])

  const [sourceFilter, setSourceFilter] = useState<'all' | 'synthetic' | 'razorpay_test' | 'live'>('all')
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [refreshingFeed, setRefreshingFeed] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<{ orderId?: string; paymentLink?: string; message: string } | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState<string | null>(null)

  // URL Deep-linking support (?transaction=TXN-1033 or ?txn=TXN-1033)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const txnParam = params.get('transaction') || params.get('txn') || params.get('id')
      if (txnParam) {
        setSelectedTransactionId(txnParam.toUpperCase())
      }
    }
  }, [setSelectedTransactionId])

  const handleRefreshFeed = async () => {
    setRefreshingFeed(true)
    try {
      await refreshProviderFeed()
    } finally {
      setTimeout(() => setRefreshingFeed(false), 500)
    }
  }

  // Filter & Search over the entire canonical dataset
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      // 1. Source filter match
      if (sourceFilter !== 'all' && txn.source !== sourceFilter) {
        return false
      }

      // 2. Search match (Case-insensitive across ID, raw numeric, provider ID, partial provider ID, reason, action, direction, status, merchant)
      const q = search.trim().toLowerCase()
      let matchesSearch = true
      if (q) {
        const cleanId = txn.id.toLowerCase()
        const cleanRawNum = txn.id.replace(/^txn-?/i, '').toLowerCase()
        const cleanReason = txn.reason.toLowerCase()
        const cleanAction = txn.action.toLowerCase()
        const cleanDirection = txn.direction.toLowerCase()
        const cleanStatus = txn.status.toLowerCase()
        const cleanMerchant = txn.merchant_id.toLowerCase()
        const cleanProviderId = (txn.provider_payment_id || '').toLowerCase()
        const cleanSource = txn.source.toLowerCase()

        matchesSearch =
          cleanId.includes(q) ||
          (cleanRawNum && cleanRawNum.includes(q)) ||
          cleanReason.includes(q) ||
          cleanAction.includes(q) ||
          cleanDirection.includes(q) ||
          cleanStatus.includes(q) ||
          cleanMerchant.includes(q) ||
          cleanProviderId.includes(q) ||
          cleanSource.includes(q)
      }

      // 3. Category/Status filter match
      let matchesFilter = true
      if (filter === 'pending') matchesFilter = txn.status === 'PENDING' || txn.status === 'IN_PROGRESS'
      else if (filter === 'recovered') matchesFilter = txn.status === 'RECOVERED'
      else if (filter === 'failed') matchesFilter = txn.status === 'STOPPED'
      else if (filter === 'blocked') matchesFilter = txn.policy === 'Blocked' || txn.policy === 'Escalated'
      else if (filter === 'high_risk') matchesFilter = txn.risk_score >= 60
      else if (filter === 'high_value') matchesFilter = txn.amount_minor >= 2000000

      return matchesSearch && matchesFilter
    })
  }, [transactions, sourceFilter, search, filter])

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sourceFilter, search, filter])

  // Selected Transaction: resolve canonical instance
  const selectedTxn: CanonicalTransaction | null = useMemo(() => {
    if (selectedTransactionId) {
      const found = getTransactionById(selectedTransactionId)
      if (found) return found
    }
    return filteredTransactions.length > 0 ? filteredTransactions[0] : null
  }, [selectedTransactionId, getTransactionById, filteredTransactions])

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredTransactions.slice(start, start + PAGE_SIZE)
  }, [filteredTransactions, currentPage])

  const handleSelectTransaction = (txn: CanonicalTransaction) => {
    setSelectedTransactionId(txn.id)
    setExecutionResult(null)
    setExecutionError(null)
    setVerifiedSuccess(null)
  }

  const handleExecuteRecovery = async () => {
    if (!selectedTxn) return
    setExecuting(true)
    setExecutionError(null)
    setExecutionResult(null)
    setVerifiedSuccess(null)

    try {
      const res = await executeRecovery(selectedTxn.id, selectedTxn.action)
      if (res.success) {
        setExecutionResult({
          message: res.message,
          orderId: res.orderId,
          paymentLink: res.paymentLink,
        })
      } else {
        setExecutionError(res.message)
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Failed to start recovery execution.')
    } finally {
      setExecuting(false)
    }
  }

  const handleVerifyPayment = async () => {
    if (!selectedTxn) return
    setVerifying(true)
    setExecutionError(null)

    try {
      const payId = selectedTxn.provider_payment_id || `pay_${selectedTxn.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`
      const res = await verifyPayment(selectedTxn.id, payId, selectedTxn.amount_minor, selectedTxn.currency)
      if (res.verified) {
        setExecutionResult(null)
        setVerifiedSuccess(res.message || `✓ Verified Capture Confirmed! Recovered ₹${(selectedTxn.amount_minor / 100).toLocaleString('en-IN')} for ${selectedTxn.id}.`)
      } else {
        setExecutionError(res.message || 'Payment verification failed.')
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Payment verification failed.')
    } finally {
      setVerifying(false)
    }
  }

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const renderSourceBadge = (source: TransactionSource) => {
    if (source === 'live') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
          LIVE
        </span>
      )
    }
    if (source === 'razorpay_test') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40">
          RAZORPAY TEST
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#7a7164]/20 text-[#a89f91] border border-[#7a7164]/40">
        SYNTHETIC
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header & Canonical Data Summary */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#15120c] via-[#0f0c08] to-[#15120c] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔎</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Transaction Intelligence Explorer</h1>
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              {metrics.totalTransactions} Canonical Transactions
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Deterministic transaction inspection across complete canonical store ({metrics.syntheticCount} Synthetic + {metrics.providerTestCount} Razorpay Test).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
            <div className="text-[#7a7164] text-[10px]">TOTAL AT RISK</div>
            <div className="text-[#ef4444] font-bold">{formatRupees(metrics.revenueAtRiskMinor)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
            <div className="text-[#7a7164] text-[10px]">VERIFIED RECOVERED</div>
            <div className="text-[#10b981] font-bold">{formatRupees(metrics.verifiedRecoveredMinor)}</div>
          </div>
          <button
            onClick={handleRefreshFeed}
            disabled={refreshingFeed}
            className="px-3 py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] hover:text-[#e5a944] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Fetch and normalize latest Razorpay Test Mode payments"
          >
            <span className={refreshingFeed ? 'animate-spin' : ''}>🔄</span>
            <span>{refreshingFeed ? 'Syncing...' : 'Refresh Feed'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-3">
        {/* Source Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e271c]/50 pb-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#7a7164] text-[11px]">DATA SOURCE:</span>
            {[
              { id: 'all', label: 'ALL SOURCES', count: metrics.totalTransactions },
              { id: 'synthetic', label: 'SYNTHETIC', count: metrics.syntheticCount },
              { id: 'razorpay_test', label: 'RAZORPAY TEST', count: metrics.providerTestCount },
              { id: 'live', label: 'LIVE', count: metrics.liveCount },
            ].map((src) => (
              <button
                key={src.id}
                onClick={() => setSourceFilter(src.id as any)}
                className={`px-2.5 py-1 rounded border transition flex items-center gap-1.5 ${
                  sourceFilter === src.id
                    ? 'bg-[#e5a944] text-[#080705] border-[#e5a944] font-bold'
                    : 'bg-[#15120c] text-[#a89f91] border-[#2e271c] hover:border-[#453d32]'
                }`}
              >
                <span>{src.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${sourceFilter === src.id ? 'bg-[#080705]/20 text-[#080705]' : 'bg-[#2e271c] text-[#a89f91]'}`}>
                  {src.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#7a7164] flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${providerFeedStatus === 'connected' ? 'bg-[#10b981]' : 'bg-[#e5a944]'}`} />
            <span>Feed: {providerFeedStatus === 'connected' ? 'Razorpay Test Connected' : 'Synthetic Mode'}</span>
          </div>
        </div>

        {/* Search input and status pills */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96 relative">
            <input
              type="text"
              placeholder="Search by ID (e.g. 1033), provider (e.g. pay_TVWR), reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 pl-9 rounded-lg bg-[#15120c] border border-[#2e271c] text-[#f4ede2] text-xs font-mono focus:outline-none focus:border-[#e5a944]"
            />
            <span className="absolute left-3 top-2.5 text-xs text-[#7a7164]">🔍</span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-xs text-[#7a7164] hover:text-[#f4ede2]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#a89f91] w-full md:w-auto justify-between md:justify-end">
            <span>
              Showing {filteredTransactions.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length} matching
            </span>
          </div>
        </div>

        {/* Dynamic Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2e271c]/50 text-xs font-mono">
          <span className="text-[#7a7164] text-[11px]">STATUS:</span>
          {[
            { id: 'all', label: 'All Statuses', count: transactions.length },
            { id: 'pending', label: 'Pending', count: metrics.pendingCount },
            { id: 'recovered', label: 'Recovered', count: metrics.recoveredCount },
            { id: 'failed', label: 'Failed / Stopped', count: metrics.stoppedCount },
            { id: 'blocked', label: 'Policy Gated', count: metrics.blockedCount },
            { id: 'high_risk', label: 'High Risk (≥60)', count: metrics.highRiskCount },
            { id: 'high_value', label: 'High Value (≥₹20k)', count: metrics.highValueCount },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              className={`px-2.5 py-1 rounded border transition flex items-center gap-1.5 ${
                filter === pill.id
                  ? 'bg-[#e5a944] text-[#080705] border-[#e5a944] font-bold'
                  : 'bg-[#15120c] text-[#a89f91] border-[#2e271c] hover:border-[#453d32]'
              }`}
            >
              <span>{pill.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${filter === pill.id ? 'bg-[#080705]/20 text-[#080705]' : 'bg-[#2e271c] text-[#a89f91]'}`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Transaction List on Left, Lifecycle Trace & Action on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Table / List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-center space-y-2">
              <div className="text-2xl">🔎</div>
              <div className="text-sm font-mono text-[#f4ede2] font-bold">No transactions match your search.</div>
              <p className="text-xs text-[#a89f91] font-mono">
                Searched across all {transactions.length} canonical records for "{search}".
              </p>
              <button
                onClick={() => { setSearch(''); setFilter('all'); setSourceFilter('all') }}
                className="mt-3 px-3 py-1.5 rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30 text-xs font-mono hover:bg-[#e5a944]/20"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            paginatedTransactions.map((txn) => {
              const isSelected = selectedTxn?.id === txn.id
              const isRecovered = txn.status === 'RECOVERED'
              const isStopped = txn.status === 'STOPPED'
              const isBlocked = txn.policy === 'Blocked' || txn.policy === 'Escalated'

              return (
                <div
                  key={txn.id}
                  onClick={() => handleSelectTransaction(txn)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-[#1a150e] border-[#e5a944] shadow-[0_0_15px_rgba(229,169,68,0.2)]'
                      : isRecovered
                      ? 'bg-[#0f0c08] border-[#10b981]/40 hover:border-[#10b981]/60'
                      : isBlocked
                      ? 'bg-[#0f0c08]/80 border-[#ef4444]/30 hover:border-[#ef4444]/50'
                      : 'bg-[#0f0c08] border-[#2e271c] hover:border-[#453d32]'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#f4ede2]">{txn.id}</span>
                      {renderSourceBadge(txn.source)}
                      {txn.provider_payment_id && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#15120c] text-[#7a7164] border border-[#2e271c]">
                          {txn.provider_payment_id}
                        </span>
                      )}
                      <span className="text-xs text-[#7a7164]">• {txn.direction}</span>
                      
                      {isRecovered ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold ml-auto md:ml-0">
                          ✓ RECOVERED
                        </span>
                      ) : isStopped ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold ml-auto md:ml-0">
                          STOPPED
                        </span>
                      ) : txn.status === 'IN_PROGRESS' ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40 font-bold ml-auto md:ml-0 animate-pulse">
                          ⚡ IN PROGRESS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30 font-bold ml-auto md:ml-0">
                          PENDING
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#a89f91] font-mono">
                      Reason: <strong className="text-[#f4ede2]">{txn.reason}</strong> • Action: <strong className="text-[#e5a944]">{txn.action}</strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#7a7164]">
                      <span>Confidence: <strong className="text-[#10b981]">{txn.confidence}%</strong></span>
                      <span>Recovery Prob: <strong className="text-[#10b981]">{txn.recovery_probability}%</strong></span>
                      <span>Risk: <strong className={txn.risk_score >= 60 ? 'text-[#ef4444]' : 'text-[#e5a944]'}>{txn.risk_score}/100</strong></span>
                      <span>Policy: <strong className={txn.policy === 'Approved' ? 'text-[#10b981]' : 'text-[#ef4444]'}>{txn.policy}</strong></span>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-[#2e271c]">
                    <div className="text-[10px] font-mono text-[#7a7164]">AMOUNT</div>
                    <div className="text-base font-mono font-bold text-[#f4ede2]">
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination Controls */}
          {filteredTransactions.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-xs font-mono">
              <div className="text-[#7a7164]">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-[#15120c] border border-[#2e271c] text-[#f4ede2] disabled:opacity-30 hover:border-[#e5a944] transition"
                >
                  ◀ Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded bg-[#15120c] border border-[#2e271c] text-[#f4ede2] disabled:opacity-30 hover:border-[#e5a944] transition"
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Transaction: Lifecycle Trace & Action Terminal */}
        {selectedTxn && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
                <div>
                  <div className="text-xs font-mono text-[#7a7164]">LIFECYCLE TRACE</div>
                  <h3 className="text-base font-mono font-bold text-[#e5a944]">{selectedTxn.id}</h3>
                </div>
                {renderSourceBadge(selectedTxn.source)}
              </div>

              {/* Execution/Verification Feedback */}
              {executionResult && (
                <div className="p-3 rounded-lg bg-[#10b981]/15 border border-[#10b981]/50 text-[#f4ede2] text-xs font-mono space-y-1">
                  <div className="font-bold text-[#10b981]">⚡ RECOVERY DISPATCHED</div>
                  <div>{executionResult.message}</div>
                  {executionResult.paymentLink && (
                    <a
                      href={executionResult.paymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#10b981] underline block pt-1"
                    >
                      Open Razorpay Link ↗
                    </a>
                  )}
                </div>
              )}

              {verifiedSuccess && (
                <div className="p-3 rounded-lg bg-[#10b981]/20 border border-[#10b981]/60 text-[#10b981] text-xs font-mono font-bold">
                  {verifiedSuccess}
                </div>
              )}

              {executionError && (
                <div className="p-3 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/50 text-[#ef4444] text-xs font-mono">
                  ⛔ {executionError}
                </div>
              )}

              {/* Transaction Specs */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Amount:</span>
                  <span className="text-[#f4ede2] font-bold">₹{selectedTxn.amount.toLocaleString('en-IN')} ({selectedTxn.currency})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Source:</span>
                  <span className="text-[#f4ede2] uppercase">{selectedTxn.source}</span>
                </div>
                {selectedTxn.provider_payment_id && (
                  <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                    <span className="text-[#7a7164]">Provider Payment ID:</span>
                    <span className="text-[#fcd34d] font-bold">{selectedTxn.provider_payment_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Direction:</span>
                  <span className="text-[#f4ede2]">{selectedTxn.direction}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Reason:</span>
                  <span className="text-[#ef4444]">{selectedTxn.reason}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Risk Score:</span>
                  <span className={selectedTxn.risk_score >= 60 ? 'text-[#ef4444] font-bold' : 'text-[#10b981]'}>
                    {selectedTxn.risk_score}/100
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Recovery Probability:</span>
                  <span className="text-[#10b981] font-bold">{selectedTxn.recovery_probability}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Policy Gate:</span>
                  <span className={selectedTxn.policy === 'Approved' ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                    {selectedTxn.policy}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#7a7164]">Timestamp:</span>
                  <span className="text-[#a89f91]">{new Date(selectedTxn.created_at).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* AI Explanation Box */}
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
                <div className="text-[10px] font-mono text-[#e5a944] font-bold">AI DIAGNOSTIC EXPLANATION</div>
                <p className="text-xs text-[#a89f91] leading-relaxed">{selectedTxn.explanation}</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedTxn.status === 'RECOVERED' ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-[#10b981]/20 border border-[#10b981]/50 text-[#10b981] font-bold text-xs font-mono cursor-default"
                  >
                    ✓ Payment Captured & Verified
                  </button>
                ) : selectedTxn.policy === 'Blocked' ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] font-bold text-xs font-mono cursor-not-allowed"
                  >
                    ⛔ Blocked by Deterministic Policy Ceiling
                  </button>
                ) : (
                  <button
                    onClick={handleExecuteRecovery}
                    disabled={executing}
                    className="w-full py-2.5 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-xs font-mono hover:bg-[#fcd34d] transition disabled:opacity-50 cursor-pointer"
                  >
                    {executing ? '⚡ Executing via Razorpay...' : `Execute Recovery (${selectedTxn.action}) ▶`}
                  </button>
                )}

                {selectedTxn.status !== 'RECOVERED' && (
                  <button
                    onClick={handleVerifyPayment}
                    disabled={verifying}
                    className="w-full py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#10b981] text-[#10b981] text-xs font-mono transition disabled:opacity-50 cursor-pointer"
                  >
                    {verifying ? 'Verifying Gateway Capture...' : 'Verify Captured Payment Gate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
