'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  useTransactionStore,
  computeOpportunitiesFromTransactions,
  computeOpportunitySummary,
  type CanonicalTransaction,
} from '../../services/canonicalTransactionStore'
import {
  type OpportunityItem,
  type RecoveryExecutionResult,
  launchRazorpayCheckout,
} from '../../services/backendApi'

export const OpportunityQueue: React.FC = () => {
  const transactions = useTransactionStore((s) => s.transactions)
  const selectedTransactionId = useTransactionStore((s) => s.selectedTransactionId)
  const setSelectedTransactionId = useTransactionStore((s) => s.setSelectedTransactionId)
  const executeRecovery = useTransactionStore((s) => s.executeRecovery)
  const verifyPayment = useTransactionStore((s) => s.verifyPayment)
  const refreshProviderFeed = useTransactionStore((s) => s.refreshProviderFeed)
  const syncStatus = useTransactionStore((s) => s.syncStatus)
  const syncMessage = useTransactionStore((s) => s.syncMessage)
  const lastSyncedAt = useTransactionStore((s) => s.lastSyncedAt)
  const [refreshingFeed, setRefreshingFeed] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<
    | 'ALL'
    | 'CRITICAL'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW'
    | 'RECOVERED'
    | 'PENDING'
    | 'FAILED'
    | 'BLOCKED'
  >('ALL')
  const [sortBy, setSortBy] = useState<
    | 'ev_desc'
    | 'ev_asc'
    | 'amount_desc'
    | 'amount_asc'
    | 'prob_desc'
    | 'risk_desc'
    | 'newest'
    | 'oldest'
  >('ev_desc')

  const [pageSize, setPageSize] = useState<number>(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [continuousScroll, setContinuousScroll] = useState(false)
  const [visibleCount, setVisibleCount] = useState(25)

  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<RecoveryExecutionResult | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState<string | null>(null)

  // URL Deep-linking support & Mount Feed Rehydration
  useEffect(() => {
    refreshProviderFeed()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const txnParam = params.get('opportunity') || params.get('transaction') || params.get('txn') || params.get('id')
      if (txnParam) {
        setSelectedTransactionId(txnParam.toUpperCase())
      }
    }
  }, [setSelectedTransactionId, refreshProviderFeed])

  // Map for O(1) canonical transaction lookup
  const transactionMap = useMemo(() => {
    const map = new Map<string, CanonicalTransaction>()
    for (const t of transactions) {
      map.set(t.id, t)
    }
    return map
  }, [transactions])

  // Single Source of Truth: Derived directly from canonical transactions
  const allOpportunities = useMemo(() => {
    return computeOpportunitiesFromTransactions(transactions)
  }, [transactions])

  const summary = useMemo(() => {
    return computeOpportunitySummary(allOpportunities)
  }, [allOpportunities])

  // Active breakdown counts derived from canonical dataset
  const breakdown = useMemo(() => {
    let activeSyntheticCount = 0
    let activeRazorpayTestCount = 0
    let activeLiveCount = 0
    let recoveredCount = 0

    for (const t of transactions) {
      if (t.status === 'RECOVERED') {
        recoveredCount++
      } else {
        if (t.source === 'synthetic') activeSyntheticCount++
        else if (t.source === 'razorpay_test') activeRazorpayTestCount++
        else if (t.source === 'live') activeLiveCount++
      }
    }

    return {
      activeSyntheticCount,
      activeRazorpayTestCount,
      activeLiveCount,
      totalActive: transactions.length - recoveredCount,
      recoveredCount,
      total: transactions.length,
    }
  }, [transactions])

  // Resolve selected opportunity from canonical selectedTransactionId or default to top item
  const selectedOpp = useMemo(() => {
    if (selectedTransactionId) {
      const match = allOpportunities.find(
        (o) =>
          o.transaction_id.toUpperCase() === selectedTransactionId.toUpperCase() ||
          o.id.toUpperCase() === selectedTransactionId.toUpperCase() ||
          o.transaction_id.replace('TXN-', '') === selectedTransactionId.replace('TXN-', '')
      )
      if (match) return match
    }
    return allOpportunities.length > 0 ? allOpportunities[0] : null
  }, [allOpportunities, selectedTransactionId])

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const handleSelectOpportunity = (opp: OpportunityItem) => {
    setSelectedTransactionId(opp.transaction_id)
    setExecutionResult(null)
    setVerifiedSuccess(null)
    setExecutionError(null)
  }

  // Filter and sort across COMPLETE canonical dataset
  const filteredOpportunities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const cleanNum = q.replace(/^txn-?/, '')

    return allOpportunities
      .filter((opp) => {
        const parentTxn = transactionMap.get(opp.transaction_id)

        const matchesSearch =
          !q ||
          opp.transaction_id.toLowerCase().includes(q) ||
          (cleanNum && opp.transaction_id.replace('TXN-', '').toLowerCase().includes(cleanNum)) ||
          opp.id.toLowerCase().includes(q) ||
          opp.reason.toLowerCase().includes(q) ||
          opp.recommended_action.toLowerCase().includes(q) ||
          (opp.best_safe_action && opp.best_safe_action.toLowerCase().includes(q)) ||
          opp.priority.toLowerCase().includes(q) ||
          opp.policy_status.toLowerCase().includes(q) ||
          (opp.status ? opp.status.toLowerCase().includes(q) : false) ||
          (parentTxn?.provider_payment_id && parentTxn.provider_payment_id.toLowerCase().includes(q)) ||
          (parentTxn?.provider_order_id && parentTxn.provider_order_id.toLowerCase().includes(q)) ||
          (parentTxn?.direction && parentTxn.direction.toLowerCase().includes(q)) ||
          (parentTxn?.source && parentTxn.source.toLowerCase().includes(q))

        let matchesFilter = true
        if (activeFilter === 'CRITICAL') matchesFilter = opp.priority === 'CRITICAL'
        else if (activeFilter === 'HIGH') matchesFilter = opp.priority === 'HIGH'
        else if (activeFilter === 'MEDIUM') matchesFilter = opp.priority === 'MEDIUM'
        else if (activeFilter === 'LOW') matchesFilter = opp.priority === 'LOW'
        else if (activeFilter === 'RECOVERED') matchesFilter = opp.status === 'RECOVERED' || parentTxn?.status === 'RECOVERED'
        else if (activeFilter === 'PENDING') matchesFilter = opp.status === 'ELIGIBLE' || opp.status === 'PENDING' || parentTxn?.status === 'PENDING'
        else if (activeFilter === 'FAILED') matchesFilter = opp.status === 'STOPPED' || parentTxn?.status === 'STOPPED'
        else if (activeFilter === 'BLOCKED') matchesFilter = opp.policy_status === 'Blocked' || parentTxn?.policy === 'Blocked'

        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        const txnA = transactionMap.get(a.transaction_id)
        const txnB = transactionMap.get(b.transaction_id)

        if (sortBy === 'ev_desc') {
          const aBoost = a.policy_status === 'Approved' ? 1 : 0
          const bBoost = b.policy_status === 'Approved' ? 1 : 0
          if (aBoost !== bBoost) return bBoost - aBoost
          return b.expected_value_minor - a.expected_value_minor
        }
        if (sortBy === 'ev_asc') return a.expected_value_minor - b.expected_value_minor
        if (sortBy === 'amount_desc') return b.amount_minor - a.amount_minor
        if (sortBy === 'amount_asc') return a.amount_minor - b.amount_minor
        if (sortBy === 'prob_desc') return b.recovery_probability - a.recovery_probability
        if (sortBy === 'risk_desc') return a.risk_score - b.risk_score
        if (sortBy === 'newest') {
          const timeA = txnA ? new Date(txnA.created_at).getTime() : 0
          const timeB = txnB ? new Date(txnB.created_at).getTime() : 0
          return timeB - timeA
        }
        if (sortBy === 'oldest') {
          const timeA = txnA ? new Date(txnA.created_at).getTime() : 0
          const timeB = txnB ? new Date(txnB.created_at).getTime() : 0
          return timeA - timeB
        }
        return b.expected_value_minor - a.expected_value_minor
      })
  }, [allOpportunities, searchQuery, activeFilter, sortBy, transactionMap])

  // Reset pagination when search/filter/sort changes
  useEffect(() => {
    setCurrentPage(1)
    setVisibleCount(25)
  }, [searchQuery, activeFilter, sortBy, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredOpportunities.length / pageSize))
  const paginatedOpportunities = useMemo(() => {
    if (continuousScroll) {
      return filteredOpportunities.slice(0, visibleCount)
    }
    const start = (currentPage - 1) * pageSize
    return filteredOpportunities.slice(start, start + pageSize)
  }, [filteredOpportunities, currentPage, pageSize, continuousScroll, visibleCount])

  const handleExecute = async (opp: OpportunityItem) => {
    if (opp.policy_status === 'Blocked') {
      setExecutionError(`Recovery blocked by deterministic policy gate: Risk score (${opp.risk_score}/100) exceeds maximum ceiling.`)
      setExecutionResult(null)
      return
    }

    setExecuting(true)
    setExecutionError(null)
    setExecutionResult(null)
    setVerifiedSuccess(null)

    try {
      const actionToRun = opp.best_safe_action || opp.recommended_action
      const result = await executeRecovery(opp.transaction_id, actionToRun)

      if (!result.success) {
        setExecutionError(result.message)
      } else {
        setExecutionResult({
          transaction_id: opp.transaction_id,
          action_type: actionToRun,
          workflow_status: 'COMPLETE',
          workflow_message: result.message,
          order_id: result.orderId,
          payment_link: result.paymentLink,
          executed_at: new Date().toISOString(),
        })
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Failed to start recovery action.')
    } finally {
      setExecuting(false)
    }
  }

  const handleLaunchCheckout = (opp: OpportunityItem) => {
    const parentTxn = transactionMap.get(opp.transaction_id)
    launchRazorpayCheckout({
      order_id: executionResult?.order_id || parentTxn?.provider_order_id,
      amount_minor: opp.amount_minor,
      currency: opp.currency || 'INR',
      description: `RazorRecover AI Recovery for ${opp.transaction_id}`,
      onSuccess: async (resp) => {
        setVerifying(true)
        setExecutionResult(null)
        setExecutionError(null)
        try {
          const verifyRes = await verifyPayment(
            opp.transaction_id,
            resp.razorpay_payment_id,
            opp.amount_minor,
            opp.currency || 'INR',
            resp.razorpay_order_id,
            resp.razorpay_signature
          )
          if (verifyRes.verified) {
            setVerifiedSuccess(verifyRes.message || `✓ Verified Capture Confirmed! Recovered ${formatRupees(opp.amount_minor)} for ${opp.transaction_id}.`)
          } else {
            setExecutionError(verifyRes.message || 'Payment could not be verified — recovery not recorded.')
          }
        } finally {
          setVerifying(false)
        }
      },
      onFailure: (err) => {
        setExecutionError(err?.message || 'Razorpay Checkout cancelled.')
      },
    })
  }

  const handleVerifyPayment = async (opp: OpportunityItem) => {
    const parentTxn = transactionMap.get(opp.transaction_id)
    if (!parentTxn?.provider_payment_id) {
      setExecutionError('Payment verification unavailable. No payment has been submitted or captured yet.')
      return
    }

    setVerifying(true)
    setExecutionError(null)
    try {
      const verifyRes = await verifyPayment(
        opp.transaction_id,
        parentTxn.provider_payment_id,
        opp.amount_minor,
        opp.currency || 'INR',
        parentTxn.provider_order_id
      )
      if (verifyRes.verified) {
        setVerifiedSuccess(verifyRes.message || `✓ Verified Capture Confirmed! Recovered ${formatRupees(opp.amount_minor)} for ${opp.transaction_id}.`)
      } else {
        setExecutionError(verifyRes.message || 'Payment could not be verified — recovery not recorded.')
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Payment verification unavailable.')
    } finally {
      setVerifying(false)
    }
  }

  const handleRefreshFeed = async () => {
    setRefreshingFeed(true)
    try {
      await refreshProviderFeed()
    } finally {
      setTimeout(() => setRefreshingFeed(false), 500)
    }
  }

  const priorityColors = {
    CRITICAL: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/40',
    HIGH: 'bg-[#e5a944]/10 text-[#e5a944] border-[#e5a944]/40',
    MEDIUM: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/40',
    LOW: 'bg-[#7a7164]/10 text-[#a89f91] border-[#7a7164]/40',
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#15120c] via-[#0f0c08] to-[#15120c] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">🎯</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Recovery Opportunity Explorer</h1>
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              {summary.total_opportunities} Active Opportunities
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Search, filter, rank, and inspect every recovery opportunity ({breakdown.activeSyntheticCount} Synthetic · {breakdown.activeRazorpayTestCount} Razorpay Test · {breakdown.activeLiveCount} Live{breakdown.recoveredCount > 0 ? ` · ${breakdown.recoveredCount} Recovered` : ''}).
          </p>
          {syncMessage && (
            <div className="mt-2 text-xs font-mono text-[#10b981] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {summary && (
            <>
              <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
                <div className="text-[#7a7164] text-[10px]">ACTIVE OPPORTUNITIES</div>
                <div className="text-[#f4ede2] font-bold">{summary.total_opportunities} Active Items</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
                <div className="text-[#7a7164] text-[10px]">EXPECTED RECOVERY</div>
                <div className="text-[#10b981] font-bold">{formatRupees(summary.expected_recovery_value_minor)}</div>
              </div>
            </>
          )}
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

      {/* Summary KPI Cards (Entire Canonical Dataset) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">AT RISK VOLUME</div>
            <div className="text-base font-bold font-mono text-[#ef4444] mt-1">
              {formatRupees(summary.total_revenue_at_risk_minor)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">EXPECTED RECOVERY</div>
            <div className="text-base font-bold font-mono text-[#fcd34d] mt-1">
              {formatRupees(summary.expected_recovery_value_minor)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">AVG PROBABILITY</div>
            <div className="text-base font-bold font-mono text-[#10b981] mt-1">
              {summary.average_recovery_probability}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">POLICY ELIGIBLE</div>
            <div className="text-base font-bold font-mono text-[#10b981] mt-1">
              {summary.policy_eligible_count} Safe
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">POLICY BLOCKED</div>
            <div className="text-base font-bold font-mono text-[#ef4444] mt-1">
              {summary.policy_blocked_count} Gated
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
            <div className="text-[10px] font-mono text-[#7a7164]">HIGH PRIORITY</div>
            <div className="text-base font-bold font-mono text-[#e5a944] mt-1">
              {summary.high_priority_count} Critical
            </div>
          </div>
        </div>
      )}

      {/* Execution Feedback Banners */}
      {executionResult && selectedOpp && executionResult.transaction_id === selectedOpp.transaction_id && (
        <div className="p-4 rounded-xl bg-[#10b981]/15 border border-[#10b981]/50 text-[#f4ede2] text-xs font-mono space-y-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#10b981] font-bold">
              <span>⚡ RECOVERY ACTION INITIATED</span>
              <span className="text-[#a89f91] font-normal">({executionResult.action_type} for {executionResult.transaction_id})</span>
            </div>
            <button onClick={() => setExecutionResult(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
          </div>
          <p className="text-xs text-[#e5e7eb]">{executionResult.workflow_message}</p>
          
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#10b981]/20">
            {executionResult.payment_link && (
              <a
                href={executionResult.payment_link}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#10b981] text-[#080705] font-bold hover:bg-[#34d399] transition text-xs inline-flex items-center gap-1.5"
              >
                Open Razorpay Payment Link ↗
              </a>
            )}
            <button
              onClick={() => handleVerifyPayment(selectedOpp)}
              disabled={verifying}
              className="px-3 py-1.5 rounded-lg bg-[#e5a944] text-[#080705] font-bold hover:bg-[#fcd34d] transition text-xs inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {verifying ? 'Verifying Gateway Capture...' : 'Verify Captured Payment Gate ▶'}
            </button>
          </div>
        </div>
      )}

      {verifiedSuccess && selectedOpp && (
        <div className="p-4 rounded-xl bg-[#10b981]/20 border border-[#10b981]/60 text-[#10b981] text-xs font-mono flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">💰</span>
            <span className="font-bold">{verifiedSuccess}</span>
          </div>
          <button onClick={() => setVerifiedSuccess(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
        </div>
      )}

      {executionError && (
        <div className="p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/50 text-[#ef4444] text-xs font-mono flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⛔</span>
            <span>{executionError}</span>
          </div>
          <button onClick={() => setExecutionError(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
        </div>
      )}

      {/* Filter, Search and Sort Control Bar */}
      <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-3 text-xs font-mono">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Prominent Search Box */}
          <div className="w-full md:flex-1 relative">
            <input
              type="text"
              placeholder="Search by transaction ID, payment ID, reason, action, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-[#15120c] border border-[#2e271c] text-[#f4ede2] placeholder:text-[#7a7164] focus:outline-none focus:border-[#e5a944] text-xs"
            />
            <span className="absolute left-3 top-2.5 text-[#7a7164]">🔎</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-[#7a7164] hover:text-[#f4ede2]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[#7a7164]">SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-[#15120c] border border-[#2e271c] text-[#f4ede2] focus:outline-none focus:border-[#e5a944] text-xs"
            >
              <option value="ev_desc">Expected Value (High → Low)</option>
              <option value="ev_asc">Expected Value (Low → High)</option>
              <option value="amount_desc">Amount (High → Low)</option>
              <option value="amount_asc">Amount (Low → High)</option>
              <option value="prob_desc">Recovery Probability (High → Low)</option>
              <option value="risk_desc">Risk (Low → High)</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* View Mode & Page Size */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setContinuousScroll(!continuousScroll)}
              className={`px-3 py-2 rounded-lg border transition ${
                continuousScroll
                  ? 'bg-[#e5a944]/15 border-[#e5a944] text-[#e5a944] font-bold'
                  : 'bg-[#15120c] border-[#2e271c] text-[#a89f91] hover:border-[#453d32]'
              }`}
            >
              {continuousScroll ? '📜 Continuous Scroll' : '📄 Paginated'}
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#2e271c]/50">
          <span className="text-[#7a7164] mr-1">FILTER:</span>
          {(
            [
              { id: 'ALL', label: 'ALL' },
              { id: 'CRITICAL', label: 'CRITICAL' },
              { id: 'HIGH', label: 'HIGH' },
              { id: 'MEDIUM', label: 'MEDIUM' },
              { id: 'LOW', label: 'LOW' },
              { id: 'RECOVERED', label: 'RECOVERED' },
              { id: 'PENDING', label: 'PENDING' },
              { id: 'FAILED', label: 'FAILED / STOPPED' },
              { id: 'BLOCKED', label: 'POLICY BLOCKED' },
            ] as const
          ).map((flt) => (
            <button
              key={flt.id}
              onClick={() => setActiveFilter(flt.id)}
              className={`px-2.5 py-1 rounded border transition ${
                activeFilter === flt.id
                  ? 'bg-[#e5a944] text-[#080705] border-[#e5a944] font-bold'
                  : 'bg-[#15120c] text-[#a89f91] border-[#2e271c] hover:border-[#453d32]'
              }`}
            >
              {flt.label}
            </button>
          ))}

          <span className="ml-auto text-[#7a7164] text-[11px]">
            Showing <strong className="text-[#f4ede2]">{filteredOpportunities.length}</strong> of {allOpportunities.length} opportunities
          </span>
        </div>
      </div>

      {/* Main Grid: Opportunity Explorer on Left, Optimizer & Explainability on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunity List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredOpportunities.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-center space-y-3 font-mono">
              <span className="text-3xl">🔍</span>
              <h4 className="text-sm font-bold text-[#f4ede2]">No opportunities match your search.</h4>
              <p className="text-xs text-[#a89f91]">Try another transaction ID, payment ID, reason, action, or status.</p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setActiveFilter('ALL')
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#e5a944] text-xs transition cursor-pointer"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedOpportunities.map((opp) => {
                const parentTxn = transactionMap.get(opp.transaction_id)
                const isSelected = selectedOpp?.id === opp.id
                const isBlocked = opp.policy_status === 'Blocked'
                const isRecovered = opp.status === 'RECOVERED' || parentTxn?.status === 'RECOVERED'
                const isInProgress = opp.status === 'IN_PROGRESS' || parentTxn?.status === 'IN_PROGRESS'

                return (
                  <div
                    key={opp.id}
                    onClick={() => handleSelectOpportunity(opp)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-[#1a150e] border-[#e5a944] shadow-[0_0_15px_rgba(229,169,68,0.2)]'
                        : isBlocked
                        ? 'bg-[#0f0c08]/80 border-[#ef4444]/30 hover:border-[#ef4444]/50 opacity-80'
                        : isRecovered
                        ? 'bg-[#0f0c08] border-[#10b981]/40 hover:border-[#10b981]/60'
                        : 'bg-[#0f0c08] border-[#2e271c] hover:border-[#453d32]'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${priorityColors[opp.priority]}`}>
                          {opp.priority}
                        </span>
                        <span className="font-mono font-bold text-sm text-[#f4ede2]">{opp.transaction_id}</span>
                        
                        {parentTxn?.source === 'razorpay_test' && (
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40">
                            RAZORPAY TEST
                          </span>
                        )}
                        {parentTxn?.provider_payment_id && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#15120c] text-[#fcd34d] border border-[#2e271c]">
                            {parentTxn.provider_payment_id}
                          </span>
                        )}

                        <span className="text-xs text-[#7a7164]">• {opp.reason}</span>
                        
                        {isRecovered ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold ml-auto md:ml-0">
                            ✓ RECOVERED
                          </span>
                        ) : isInProgress ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40 font-bold ml-auto md:ml-0 animate-pulse">
                            ⚡ IN PROGRESS
                          </span>
                        ) : (
                          <span
                            className={`px-1.5 py-0.2 text-[10px] font-mono rounded border ml-auto md:ml-0 ${
                              opp.policy_status === 'Approved'
                                ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
                                : opp.policy_status === 'Blocked'
                                ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                                : 'bg-[#e5a944]/10 text-[#e5a944] border-[#e5a944]/30'
                            }`}
                          >
                            {opp.policy_status}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#a89f91]">
                        <span>Amount: <strong className="text-[#f4ede2]">{formatRupees(opp.amount_minor)}</strong></span>
                        <span>Prob: <strong className="text-[#10b981]">{opp.recovery_probability}%</strong></span>
                        <span>Risk: <strong className={opp.risk_score >= 70 ? 'text-[#ef4444]' : 'text-[#e5a944]'}>{opp.risk_score}/100</strong></span>
                        <span>Action: <strong className="text-[#f4ede2]">{opp.recommended_action}</strong></span>
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
          )}

          {/* Continuous Scroll Load-More or Pagination Controls */}
          {filteredOpportunities.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-xs font-mono gap-3">
              <div className="text-[#7a7164]">
                {continuousScroll
                  ? `Showing 1 - ${Math.min(filteredOpportunities.length, visibleCount)} of ${filteredOpportunities.length} opportunities`
                  : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(filteredOpportunities.length, currentPage * pageSize)} of ${filteredOpportunities.length} opportunities`}
              </div>

              {continuousScroll ? (
                visibleCount < filteredOpportunities.length ? (
                  <button
                    onClick={() => setVisibleCount((c) => Math.min(filteredOpportunities.length, c + 25))}
                    className="px-4 py-2 rounded-lg bg-[#e5a944] text-[#080705] font-bold hover:bg-[#fcd34d] transition cursor-pointer"
                  >
                    Load More Opportunities (+25) ▶
                  </button>
                ) : (
                  <span className="text-[#10b981] font-bold">✓ All {filteredOpportunities.length} opportunities loaded</span>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded bg-[#15120c] border border-[#2e271c] text-[#f4ede2] disabled:opacity-30 hover:border-[#e5a944] transition cursor-pointer"
                  >
                    ◀ Prev
                  </button>
                  <span className="text-[#a89f91] px-1">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded bg-[#15120c] border border-[#2e271c] text-[#f4ede2] disabled:opacity-30 hover:border-[#e5a944] transition cursor-pointer"
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Strategy Optimizer & Explainability Panel (Right Side) */}
        {selectedOpp && (
          <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-5 h-fit">
            <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
              <div>
                <h3 className="text-sm font-mono font-bold text-[#e5a944]">STRATEGY OPTIMIZER</h3>
                <div className="text-xs text-[#a89f91]">Candidate Playbook Simulation</div>
              </div>
              <span
                className={`px-2 py-0.5 text-xs font-mono rounded border ${
                  selectedOpp.policy_status === 'Approved'
                    ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
                    : selectedOpp.policy_status === 'Blocked'
                    ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                    : 'bg-[#e5a944]/10 text-[#e5a944] border-[#e5a944]/30'
                }`}
              >
                {selectedOpp.policy_status}
              </span>
            </div>

            {/* Target Transaction Specs */}
            <div className="p-3.5 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-[#2e271c]/40 pb-1.5">
                <span className="text-[#7a7164]">TARGET TRANSACTION:</span>
                <span className="text-[#f4ede2] font-bold">{selectedOpp.transaction_id}</span>
              </div>
              <div className="flex justify-between border-b border-[#2e271c]/40 pb-1.5">
                <span className="text-[#7a7164]">AMOUNT:</span>
                <span className="text-[#f4ede2] font-bold">{formatRupees(selectedOpp.amount_minor)}</span>
              </div>
              <div className="flex justify-between border-b border-[#2e271c]/40 pb-1.5">
                <span className="text-[#7a7164]">EXPECTED RECOVERY:</span>
                <span className="text-[#fcd34d] font-bold">{formatRupees(selectedOpp.expected_value_minor)}</span>
              </div>
              <div className="flex justify-between border-b border-[#2e271c]/40 pb-1.5">
                <span className="text-[#7a7164]">FAILURE REASON:</span>
                <span className="text-[#ef4444]">{selectedOpp.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a7164]">PRIORITY RATING:</span>
                <span className="text-[#e5a944] font-bold">{selectedOpp.priority} ({selectedOpp.priority_score}/100)</span>
              </div>
            </div>

            {/* Candidate Playbooks Table */}
            {selectedOpp.candidate_actions && selectedOpp.candidate_actions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-[#7a7164]">CANDIDATE ACTION SIMULATION</div>
                <div className="space-y-1.5 text-[11px] font-mono">
                  {selectedOpp.candidate_actions.map((act) => (
                    <div
                      key={act.action}
                      className={`p-2.5 rounded border flex items-center justify-between ${
                        act.execution_allowed
                          ? 'bg-[#15120c] border-[#2e271c]'
                          : 'bg-[#15120c]/60 border-[#ef4444]/20 opacity-70'
                      }`}
                    >
                      <div>
                        <div className="text-[#f4ede2] font-bold">{act.action}</div>
                        <div className="text-[10px] text-[#7a7164]">
                          Prob: {act.recovery_probability}% • Risk: {act.risk_score}/100
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#fcd34d] font-bold">{formatRupees(act.expected_value_minor)}</div>
                        <span
                          className={`text-[9px] px-1 rounded ${
                            act.policy_decision === 'Approved'
                              ? 'text-[#10b981] bg-[#10b981]/10'
                              : act.policy_decision === 'Blocked'
                              ? 'text-[#ef4444] bg-[#ef4444]/10'
                              : 'text-[#e5a944] bg-[#e5a944]/10'
                          }`}
                        >
                          {act.policy_decision}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best Safe Action Recommendation */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-[#7a7164]">RECOMMENDED SAFE ACTION</div>
              <div
                className={`p-3.5 rounded-lg border space-y-1.5 ${
                  selectedOpp.policy_status === 'Approved'
                    ? 'bg-[#15120c] border-[#10b981]/40'
                    : 'bg-[#15120c] border-[#ef4444]/40'
                }`}
              >
                <div className="text-sm font-bold text-[#f4ede2] flex items-center gap-2">
                  <span>⚡</span> {selectedOpp.best_safe_action || selectedOpp.recommended_action}
                </div>
                {selectedOpp.explainability && (
                  <p className="text-xs text-[#a89f91] leading-relaxed">
                    {selectedOpp.explainability.why_action}
                  </p>
                )}
              </div>
            </div>

            {/* Audited Explainability Breakdown */}
            {selectedOpp.explainability && (
              <div className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-2 text-[11px] font-mono">
                <div className="text-[#e5a944] font-bold">AUDITED EXPLAINABILITY</div>
                <div>
                  <span className="text-[#7a7164]">Priority Rationale: </span>
                  <span className="text-[#a89f91]">{selectedOpp.explainability.why_priority}</span>
                </div>
                <div>
                  <span className="text-[#7a7164]">Policy Gate: </span>
                  <span className="text-[#a89f91]">{selectedOpp.explainability.why_policy_status}</span>
                </div>
              </div>
            )}

            {/* Action Execution Section */}
            {selectedOpp.status === 'RECOVERED' ? (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg bg-[#10b981]/20 border border-[#10b981]/50 text-[#10b981] font-bold text-xs font-mono cursor-default"
                >
                  ✓ Recovery Verified & Captured in Razorpay Test Mode
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('razorrecover:navigate-tab', {
                          detail: { tab: 'Transactions', txnId: selectedOpp.transaction_id },
                        })
                      )
                    }}
                    className="py-2 px-3 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] text-xs font-mono transition cursor-pointer text-center"
                  >
                    Transactions ➔
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('razorrecover:navigate-tab', {
                          detail: { tab: 'Audit', txnId: selectedOpp.transaction_id },
                        })
                      )
                    }}
                    className="py-2 px-3 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] text-xs font-mono transition cursor-pointer text-center"
                  >
                    Audit Trail ➔
                  </button>
                </div>
              </div>
            ) : selectedOpp.policy_status === 'Blocked' ? (
              <button
                disabled
                className="w-full py-3 px-4 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] font-bold text-xs cursor-not-allowed font-mono"
              >
                ⛔ Recovery Blocked by Deterministic Safety Gate
              </button>
            ) : (
              <div className="space-y-2">
                {selectedOpp.recovery_operation_id && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded bg-[#15120c] border border-[#2e271c] text-[11px] font-mono text-[#7a7164]">
                    <span>RECOVERY OPERATION:</span>
                    <span className="text-[#e5a944] font-bold">{selectedOpp.recovery_operation_id}</span>
                  </div>
                )}

                <button
                  onClick={() => handleExecute(selectedOpp)}
                  disabled={executing || selectedOpp.status === 'IN_PROGRESS'}
                  className="w-full py-3 px-4 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-sm hover:bg-[#fcd34d] transition shadow-[0_0_15px_rgba(229,169,68,0.3)] disabled:opacity-50 cursor-pointer font-mono"
                >
                  {executing
                    ? '⚡ Contacting Razorpay Orchestrator...'
                    : selectedOpp.status === 'IN_PROGRESS'
                    ? `⚡ Recovery In Progress (${selectedOpp.recovery_operation_id || 'ACTIVE'})`
                    : `Execute Recovery (${formatRupees(selectedOpp.expected_value_minor)}) ▶`}
                </button>

                <button
                  onClick={() => handleVerifyPayment(selectedOpp)}
                  disabled={verifying}
                  className="w-full py-2 px-4 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#10b981] text-[#10b981] text-xs font-mono transition disabled:opacity-50 cursor-pointer"
                >
                  {verifying ? 'Verifying Gateway Capture...' : 'Verify Captured Payment Gate'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
