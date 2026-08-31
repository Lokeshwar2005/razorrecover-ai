import React, { useState, useMemo, useEffect } from 'react'
import {
  useTransactionStore,
  type CanonicalTransaction,
  type TransactionSource,
  chronovaOrderToCanonicalTransaction,
} from '../../services/canonicalTransactionStore'
import {
  executeRecoveryAction as executeRecovery,
  verifyPaymentCapture as verifyPayment,
  launchRazorpayCheckout,
} from '../../services/backendApi'
import { resolveProductImageUrl } from '../Chronova/utils'
import { findChronovaOrder } from '../../services/chronovaOrderStore'

const PAGE_SIZE = 15

export const TransactionExplorer: React.FC = () => {
  const {
    transactions,
    selectedTransactionId,
    setSelectedTransactionId,
    refreshProviderFeed,
    syncMessage,
  } = useTransactionStore()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [executing, setExecuting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [executionResult, setExecutionResult] = useState<{
    message: string
    orderId?: string
    paymentLink?: string | null
  } | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [verifiedSuccess, setVerifiedSuccess] = useState<string | null>(null)
  const [refreshingFeed, setRefreshingFeed] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString())

  // Initial load and periodic polling
  useEffect(() => {
    refreshProviderFeed().then(() => setLastSyncedAt(new Date().toISOString()))

    const pollTimer = setInterval(() => {
      refreshProviderFeed().then(() => setLastSyncedAt(new Date().toISOString()))
    }, 3500)

    return () => clearInterval(pollTimer)
  }, [refreshProviderFeed])

  const handleRefreshFeed = async () => {
    setRefreshingFeed(true)
    try {
      await refreshProviderFeed()
      setLastSyncedAt(new Date().toISOString())
    } finally {
      setTimeout(() => setRefreshingFeed(false), 500)
    }
  }

  // Filter & Search over Chronova transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const q = search.trim().toLowerCase()
      const cleanId = (txn.id || '').toLowerCase()
      const cleanChronovaOrderId = (txn.chronova_order_id || '').toLowerCase()
      const cleanProviderPaymentId = (txn.provider_payment_id || txn.razorpay_payment_id || '').toLowerCase()
      const cleanProviderOrderId = (txn.provider_order_id || txn.razorpay_order_id || '').toLowerCase()
      const cleanCustomerName = (txn.customer?.name || '').toLowerCase()
      const cleanCustomerEmail = (txn.customer?.email || '').toLowerCase()
      const cleanReason = (txn.reason || '').toLowerCase()
      const cleanAction = (txn.action || '').toLowerCase()
      const cleanProdName = (txn.product_name || '').toLowerCase()
      const itemNames = (txn.items || []).map((i: any) => (i.product_name || i.productName || '').toLowerCase()).join(' ')

      let matchesSearch = true
      if (q) {
        matchesSearch =
          cleanId.includes(q) ||
          cleanChronovaOrderId.includes(q) ||
          cleanProviderPaymentId.includes(q) ||
          cleanProviderOrderId.includes(q) ||
          cleanCustomerName.includes(q) ||
          cleanCustomerEmail.includes(q) ||
          cleanReason.includes(q) ||
          cleanAction.includes(q) ||
          cleanProdName.includes(q) ||
          itemNames.includes(q)
      }

      let matchesFilter = true
      if (filter === 'failed') {
        matchesFilter = txn.status === 'PAYMENT_FAILED' || txn.status === 'STOPPED'
      } else if (filter === 'pending') {
        matchesFilter = txn.status === 'WAITING_FOR_RECOVERY' || txn.status === 'IN_PROGRESS' || txn.status === 'PENDING'
      } else if (filter === 'recovered') {
        matchesFilter = txn.status === 'RECOVERED'
      } else if (filter === 'blocked') {
        matchesFilter = txn.policy === 'Blocked' || txn.policy === 'Escalated'
      }

      return matchesSearch && matchesFilter
    })
  }, [transactions, search, filter])

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filter])

  // Selected Transaction: resolve canonical instance and enrich from Chronova order store
  const selectedTxn: CanonicalTransaction | null = useMemo(() => {
    let baseTxn: CanonicalTransaction | null = null
    if (selectedTransactionId) {
      baseTxn = transactions.find((t) => t.id === selectedTransactionId) || null
    }
    if (!baseTxn && filteredTransactions.length > 0) {
      baseTxn = filteredTransactions[0]
    }
    if (!baseTxn) return null

    // Check if we can enrich further with Chronova Order Store
    const chronovaOrder =
      findChronovaOrder(baseTxn.id) ||
      (baseTxn.chronova_order_id ? findChronovaOrder(baseTxn.chronova_order_id) : null) ||
      (baseTxn.provider_order_id ? findChronovaOrder(baseTxn.provider_order_id) : null)

    if (chronovaOrder) {
      const ordTxn = chronovaOrderToCanonicalTransaction(chronovaOrder)
      return {
        ...baseTxn,
        customer: (ordTxn.customer?.name !== 'Information unavailable' || ordTxn.customer?.email !== 'Information unavailable') ? ordTxn.customer : baseTxn.customer,
        items: (ordTxn.items && ordTxn.items.length > 0) ? ordTxn.items : baseTxn.items,
        product_name: ordTxn.product_name !== 'Information unavailable' ? ordTxn.product_name : baseTxn.product_name,
        product_image: ordTxn.product_image || baseTxn.product_image,
        product_brand: ordTxn.product_brand !== 'Information unavailable' ? ordTxn.product_brand : baseTxn.product_brand,
        product_category: ordTxn.product_category !== 'Information unavailable' ? ordTxn.product_category : baseTxn.product_category,
        quantity: ordTxn.quantity || baseTxn.quantity,
        unit_price: ordTxn.unit_price || baseTxn.unit_price,
        unit_price_rupees: ordTxn.unit_price_rupees || baseTxn.unit_price_rupees,
        amount: ordTxn.amount || baseTxn.amount,
        amount_minor: ordTxn.amount_minor || baseTxn.amount_minor,
        status: (chronovaOrder.payment_status === 'PAID' || chronovaOrder.recovery_status === 'RECOVERED') ? 'RECOVERED' : baseTxn.status,
        action: (chronovaOrder.payment_status === 'PAID' || chronovaOrder.recovery_status === 'RECOVERED')
          ? (chronovaOrder.recovery_status === 'RECOVERED' ? 'None — Recovery completed' : 'None — Payment already successful')
          : baseTxn.action,
      }
    }

    return baseTxn
  }, [selectedTransactionId, transactions, filteredTransactions])

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
      if (res && res.success) {
        setExecutionResult({
          message: res.message || 'Recovery action dispatched.',
          orderId: res.orderId,
          paymentLink: res.paymentLink,
        })
        await refreshProviderFeed()
      } else {
        setExecutionError(res?.message || 'Recovery action failed.')
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Failed to start recovery execution.')
    } finally {
      setExecuting(false)
    }
  }

  const handleLaunchCheckout = () => {
    if (!selectedTxn) return
    launchRazorpayCheckout({
      order_id: executionResult?.orderId || selectedTxn.provider_order_id,
      amount_minor: selectedTxn.amount_minor,
      currency: selectedTxn.currency,
      description: `RazorRecover AI Recovery for ${selectedTxn.id}`,
      onSuccess: async (resp) => {
        setVerifying(true)
        setExecutionResult(null)
        setExecutionError(null)
        try {
          const verifyRes = await verifyPayment(
            selectedTxn.id,
            resp.razorpay_payment_id,
            selectedTxn.amount_minor,
            selectedTxn.currency,
            resp.razorpay_order_id,
            resp.razorpay_signature
          )
          if (verifyRes.verified) {
            setVerifiedSuccess(verifyRes.message || `✓ Verified Capture Confirmed! Recovered ₹${(selectedTxn.amount_minor / 100).toLocaleString('en-IN')} for ${selectedTxn.id}.`)
            await refreshProviderFeed()
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

  const handleVerifyPayment = async () => {
    if (!selectedTxn) return
    const pId = selectedTxn.provider_payment_id || selectedTxn.razorpay_payment_id
    if (!pId) {
      setExecutionError('Payment verification unavailable. No payment has been submitted or captured yet.')
      return
    }

    setVerifying(true)
    setExecutionError(null)

    try {
      const res = await verifyPayment(
        selectedTxn.id,
        pId,
        selectedTxn.amount_minor,
        selectedTxn.currency,
        selectedTxn.provider_order_id
      )
      if (res.verified) {
        setExecutionResult(null)
        setVerifiedSuccess(res.message || `✓ Verified Capture Confirmed! Recovered ₹${(selectedTxn.amount_minor / 100).toLocaleString('en-IN')} for ${selectedTxn.id}.`)
        await refreshProviderFeed()
      } else {
        setExecutionError(res.message || 'Payment could not be verified — recovery not recorded.')
      }
    } catch (e: any) {
      setExecutionError(e?.message || 'Payment verification unavailable.')
    } finally {
      setVerifying(false)
    }
  }

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const metrics = useMemo(() => {
    let stoppedCount = 0
    let pendingCount = 0
    let recoveredCount = 0
    let blockedCount = 0
    let atRisk = 0
    let recoveredRevenue = 0

    for (const t of transactions) {
      if (t.status === 'RECOVERED' || (t.verified_amount_minor && t.verified_amount_minor > 0)) {
        recoveredCount++
        recoveredRevenue += t.verified_amount_minor || t.amount_minor
      } else if (t.status === 'WAITING_FOR_RECOVERY' || t.status === 'IN_PROGRESS') {
        pendingCount++
        atRisk += t.amount_minor
      } else {
        stoppedCount++
        atRisk += t.amount_minor
      }

      if (t.policy === 'Blocked' || t.policy === 'Escalated') {
        blockedCount++
      }
    }

    return {
      total: transactions.length,
      stoppedCount,
      pendingCount,
      recoveredCount,
      blockedCount,
      atRisk,
      recoveredRevenue,
    }
  }, [transactions])

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header & Source Indicator */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#15120c] via-[#0f0c08] to-[#15120c] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔎</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Live Chronova Transactions</h1>
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              {transactions.length} Recorded
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Real-time transaction intelligence originating strictly from Website A (Chronova Customer Storefront).
          </p>
          {syncMessage && (
            <div className="mt-2 text-xs font-mono text-[#10b981] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
            <div className="text-[#7a7164] text-[10px]">REVENUE AT RISK</div>
            <div className="text-[#ef4444] font-bold">{formatRupees(metrics.atRisk)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#15120c] border border-[#2e271c]">
            <div className="text-[#7a7164] text-[10px]">VERIFIED RECOVERED</div>
            <div className="text-[#10b981] font-bold">{formatRupees(metrics.recoveredRevenue)}</div>
          </div>
          <button
            onClick={handleRefreshFeed}
            disabled={refreshingFeed}
            className="px-3 py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] hover:text-[#e5a944] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh transactions from backend"
          >
            <span className={refreshingFeed ? 'animate-spin' : ''}>🔄</span>
            <span>{refreshingFeed ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e271c]/50 pb-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#7a7164] text-[11px]">DATA SOURCE:</span>
            <span className="px-2.5 py-1 rounded bg-[#e5a944] text-[#080705] border border-[#e5a944] font-bold flex items-center gap-1.5">
              <span>CHRONOVA STOREFRONT (LIVE)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#080705]/20 text-[#080705]">
                {transactions.length}
              </span>
            </span>
          </div>

          <div className="text-[11px] text-[#7a7164] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>Feed: Razorpay Live Ingestion Active</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96 relative">
            <input
              type="text"
              placeholder="Search by transaction ID, order ID, payment ID, failure reason..."
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

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2e271c]/50 text-xs font-mono">
          <span className="text-[#7a7164] text-[11px]">STATUS:</span>
          {[
            { id: 'all', label: 'All Transactions', count: transactions.length },
            { id: 'failed', label: 'Payment Failed', count: metrics.stoppedCount },
            { id: 'pending', label: 'Waiting for Recovery', count: metrics.pendingCount },
            { id: 'recovered', label: 'Payment Recovered', count: metrics.recoveredCount },
            { id: 'blocked', label: 'Policy Gated', count: metrics.blockedCount },
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

      {/* Main Layout: Transactions List on Left, Lifecycle Trace & Action Terminal on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {filteredTransactions.length === 0 ? (
            !search ? (
              <div className="p-12 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/40 flex items-center justify-center mx-auto text-[#10b981] text-2xl font-bold">
                  ⚡
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#f4ede2]">No live Chronova transactions yet.</h3>
                  <p className="text-xs text-[#a89f91] max-w-lg mx-auto leading-relaxed">
                    RazorRecover AI is actively listening for payment events from Website A (Chronova Storefront). Initiate a checkout or failure scenario to stream real-time events.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span>LIVE FEED CONNECTED · Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}</span>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleRefreshFeed}
                    disabled={refreshingFeed}
                    className="px-4 py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-xs font-mono font-semibold text-[#f4ede2] hover:text-[#e5a944] transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className={refreshingFeed ? 'animate-spin' : ''}>🔄</span>
                    <span>{refreshingFeed ? 'Checking Feed...' : 'Refresh Live Feed'}</span>
                  </button>
                  <a
                    href="https://lokeshwar2005.github.io/razorrecover-ai/chronova/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-[#e5a944] text-[#080705] text-xs font-mono font-bold hover:bg-[#fcd34d] transition flex items-center gap-1.5 shadow-md"
                  >
                    <span>Open Chronova Storefront</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-xl bg-[#0f0c08] border border-[#2e271c] text-center space-y-2">
                <div className="text-2xl">🔎</div>
                <div className="text-sm font-mono text-[#f4ede2] font-bold">0 transactions match your query.</div>
                <p className="text-xs text-[#a89f91] font-mono">
                  Searched across {transactions.length} Chronova transactions for &ldquo;{search}&rdquo;.
                </p>
                <button
                  onClick={() => { setSearch(''); setFilter('all') }}
                  className="mt-3 px-3 py-1.5 rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30 text-xs font-mono hover:bg-[#e5a944]/20 cursor-pointer"
                >
                  Clear Search & Filters
                </button>
              </div>
            )
          ) : (
            paginatedTransactions.map((txn) => {
              const isSelected = selectedTxn?.id === txn.id
              const isRecovered = txn.status === 'RECOVERED'
              const isStopped = txn.status === 'PAYMENT_FAILED' || txn.status === 'STOPPED'
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
                  {/* Product Thumbnail with Defensive Error Fallback */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#15120c] border border-[#2e271c] overflow-hidden shrink-0 flex items-center justify-center relative">
                      {txn.product_image ? (
                        <img
                          src={resolveProductImageUrl(txn.product_image)}
                          alt={txn.product_name || 'Chronova Watch'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <span className="text-xl">⌚</span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#f4ede2]">{txn.id}</span>
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                          LIVE • CHRONOVA
                        </span>
                        {txn.chronova_order_id && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#15120c] text-[#a89f91] border border-[#2e271c]">
                            {txn.chronova_order_id}
                          </span>
                        )}
                        
                        {isRecovered ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold ml-auto md:ml-0">
                            ✓ PAYMENT RECOVERED
                          </span>
                        ) : isStopped ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold ml-auto md:ml-0">
                            PAYMENT FAILED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40 font-bold ml-auto md:ml-0 animate-pulse">
                            ⚡ RECOVERY IN PROGRESS
                          </span>
                        )}
                      </div>

                      {/* Product Name & Brand & Multi-Item Indicator */}
                      <div className="text-xs font-bold text-[#f4ede2] truncate flex items-center gap-1.5">
                        <span>
                          {txn.items && txn.items.length > 1
                            ? `${txn.items[0]?.product_name || txn.product_name} (+${txn.items.length - 1} other item${txn.items.length > 2 ? 's' : ''})`
                            : (txn.product_name || 'Information unavailable')}
                        </span>
                        {txn.items && txn.items.length > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-[#e5a944]/20 text-[#e5a944] text-[9px] font-mono font-bold">
                            {txn.items.length} ITEMS
                          </span>
                        )}
                        {txn.product_brand && <span className="text-[#a89f91] font-normal"> · {txn.product_brand}</span>}
                      </div>

                      <div className="text-xs text-[#a89f91] font-mono truncate">
                        {isRecovered ? (
                          <span>Outcome: <strong className="text-[#10b981]">Captured</strong> • Action: <strong className="text-[#10b981]">{txn.action || 'None — Recovery completed'}</strong></span>
                        ) : (
                          <span>Reason: <strong className="text-[#f4ede2]">{txn.reason}</strong> • Action: <strong className="text-[#e5a944]">{txn.action}</strong></span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#7a7164]">
                        <span>Confidence: <strong className="text-[#10b981]">{txn.confidence}%</strong></span>
                        <span>Recovery Prob: <strong className="text-[#10b981]">{txn.recovery_probability}%</strong></span>
                        <span>Risk: <strong className={txn.risk_score >= 60 ? 'text-[#ef4444]' : 'text-[#e5a944]'}>{txn.risk_score}/100</strong></span>
                        <span>Policy: <strong className={txn.policy === 'Approved' ? 'text-[#10b981]' : 'text-[#ef4444]'}>{txn.policy}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-[#2e271c] shrink-0">
                    <div className="text-[10px] font-mono text-[#7a7164]">TOTAL</div>
                    <div className="text-base font-mono font-bold text-[#f4ede2]">
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex items-center justify-between text-xs font-mono text-[#a89f91]">
              <div className="text-[#7a7164]">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length} Chronova transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  ◀ Previous
                </button>
                <span className="px-2 font-bold text-[#e5a944]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-[#f4ede2] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Detail Panel: 6 Clear Structured Sections */}
        {selectedTxn && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4 sticky top-6 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-bold text-[#f4ede2]">{selectedTxn.id}</div>
                  <div className="text-[11px] font-mono text-[#a89f91]">
                    {selectedTxn.chronova_order_id || 'order_cn'} · {selectedTxn.customer?.name || 'Chronova Customer'}
                  </div>
                </div>
                {selectedTxn.status === 'RECOVERED' ? (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold">
                    ✓ PAYMENT RECOVERED
                  </span>
                ) : selectedTxn.status === 'PAYMENT_FAILED' || selectedTxn.status === 'STOPPED' ? (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold">
                    ✕ PAYMENT FAILED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40 font-bold animate-pulse">
                    ⚡ RECOVERY ACTIVE
                  </span>
                )}
              </div>

              {executionResult && (
                <div className="p-3 rounded-lg bg-[#10b981]/15 border border-[#10b981]/50 text-[#f4ede2] text-xs font-mono space-y-1">
                  <div className="font-bold text-[#10b981]">✓ {executionResult.message}</div>
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
                  {executionResult.orderId && selectedTxn.status !== 'RECOVERED' && (
                    <button
                      onClick={handleLaunchCheckout}
                      className="w-full py-2 rounded-lg bg-[#10b981] text-[#080705] font-bold text-xs font-mono hover:bg-[#34d399] transition flex items-center justify-center gap-1.5 cursor-pointer mt-1 shadow-md"
                    >
                      <span>💳 Open Razorpay Test Checkout Modal</span>
                    </button>
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

              {/* SECTION 1: ORDER DETAILS (MULTI-ITEM CAPABLE) */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2.5">
                <div className="text-[10px] font-mono text-[#e5a944] font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>1. ORDER DETAILS</span>
                  <span className="text-[#7a7164]">#{selectedTxn.chronova_order_id || 'order_cn'}</span>
                </div>
                
                {/* List of Purchased Items */}
                <div className="space-y-2">
                  {(selectedTxn.items && selectedTxn.items.length > 0 ? selectedTxn.items : [
                    {
                      productId: selectedTxn.product_id,
                      productName: selectedTxn.product_name || 'Information unavailable',
                      productImage: selectedTxn.product_image,
                      productBrand: selectedTxn.product_brand || 'Information unavailable',
                      productCategory: selectedTxn.product_category || 'Information unavailable',
                      quantity: selectedTxn.quantity || 1,
                      unitPrice: selectedTxn.unit_price || selectedTxn.amount,
                      totalPrice: (selectedTxn.unit_price || selectedTxn.amount) * (selectedTxn.quantity || 1),
                    }
                  ]).map((item: any, idx: number) => {
                    const img = resolveProductImageUrl(item.productImage || item.product_image || item.imageUrl || item.image_url)
                    const pName = item.productName || item.product_name || 'Information unavailable'
                    const pBrand = item.productBrand || item.product_brand || item.brand || 'Information unavailable'
                    const pModel = item.productModel || item.product_model || item.model || pName
                    const pCat = item.productCategory || item.product_category || item.category || 'Information unavailable'
                    const qty = Number(item.quantity) || 1
                    const uPrice = Number(item.unitPrice || item.unit_price || item.unit_price_rupees) || Math.round(selectedTxn.amount / (selectedTxn.items?.length || 1))
                    const lineTot = Number(item.totalPrice || item.total_price || item.total_price_rupees || item.lineTotal || item.line_total) || (qty * uPrice)

                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-[#0f0c08] border border-[#2e271c]/60">
                        <div className="w-12 h-12 rounded-lg bg-[#15120c] border border-[#2e271c] overflow-hidden shrink-0 flex items-center justify-center relative">
                          {img ? (
                            <img
                              src={img}
                              alt={pName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent && !parent.querySelector('.img-fallback-text')) {
                                  const span = document.createElement('span')
                                  span.className = 'img-fallback-text text-[9px] font-mono text-slate-400 text-center p-1 leading-tight'
                                  span.innerText = 'Product image unavailable'
                                  parent.appendChild(span)
                                }
                              }}
                            />
                          ) : (
                            <span className="text-xl">⌚</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-xs font-bold text-[#f4ede2] truncate">
                            {pName}
                          </div>
                          <div className="text-[10px] text-[#a89f91] font-mono truncate">
                            {pBrand} · Model: {pModel}
                            {pCat && pCat !== 'Information unavailable' && <span> · {pCat}</span>}
                            {item.selected_color && <span> · Color: {item.selected_color}</span>}
                          </div>
                          <div className="text-[10px] text-[#7a7164] font-mono flex items-center justify-between pt-0.5">
                            <span>Qty: <strong className="text-[#f4ede2]">{qty}</strong> × ₹{uPrice.toLocaleString('en-IN')}</span>
                            <span className="text-[#fcd34d] font-bold">₹{lineTot.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between pt-1 border-t border-[#2e271c]/40 text-xs font-mono">
                  <span className="text-[#7a7164]">Total Order Amount:</span>
                  <span className="text-[#f4ede2] font-bold">₹{selectedTxn.amount.toLocaleString('en-IN')} ({selectedTxn.currency})</span>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER DETAILS */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-[#e5a944] font-bold uppercase tracking-wider">2. CUSTOMER & SHIPPING</div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Customer Name:</span>
                  <span className="text-[#f4ede2] font-bold">{selectedTxn.customer?.full_name || selectedTxn.customer?.name || 'Information unavailable'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Email Address:</span>
                  <span className="text-[#a89f91]">{selectedTxn.customer?.email || 'Information unavailable'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Contact Phone:</span>
                  <span className="text-[#a89f91]">{selectedTxn.customer?.phone || (selectedTxn.customer as any)?.contact_phone || (selectedTxn.customer as any)?.contactPhone || (selectedTxn.customer as any)?.phoneNumber || 'Information unavailable'}</span>
                </div>
                <div className="flex justify-between items-start py-0.5">
                  <span className="text-[#7a7164] shrink-0">Shipping Address:</span>
                  <span className="text-[#a89f91] text-right break-words max-w-[260px] pl-2">{selectedTxn.customer?.address || 'Information unavailable'}</span>
                </div>
              </div>

              {/* SECTION 3: PAYMENT GATEWAY */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-[#e5a944] font-bold uppercase tracking-wider">3. PAYMENT GATEWAY</div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Provider:</span>
                  <span className="text-[#f4ede2] font-bold">Razorpay Test Mode</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Gateway Status:</span>
                  <span className={selectedTxn.status === 'RECOVERED' ? 'text-[#10b981] font-bold' : 'text-[#ef4444]'}>
                    {selectedTxn.provider_status || (selectedTxn.status === 'RECOVERED' ? 'captured' : 'failed')}
                  </span>
                </div>
                {selectedTxn.provider_payment_id && (
                  <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                    <span className="text-[#7a7164]">Payment ID:</span>
                    <span className="text-[#fcd34d] font-bold">{selectedTxn.provider_payment_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-[#7a7164]">Order ID:</span>
                  <span className="text-[#a89f91]">{selectedTxn.provider_order_id || selectedTxn.chronova_order_id || 'N/A'}</span>
                </div>
              </div>

              {/* SECTION 4: FAILURE ANALYSIS */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-[#e5a944] font-bold uppercase tracking-wider">4. FAILURE ANALYSIS</div>
                {selectedTxn.status === 'RECOVERED' && !selectedTxn.reason.includes('3DS') && !selectedTxn.reason.includes('Timeout') && !selectedTxn.reason.includes('degradation') ? (
                  <div className="p-2.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-[11px] leading-relaxed">
                    ✓ Payment completed successfully without degradation on the initial checkout attempt.
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                      <span className="text-[#7a7164]">Direction:</span>
                      <span className="text-[#f4ede2]">{selectedTxn.direction}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                      <span className="text-[#7a7164]">Failure Reason:</span>
                      <span className="text-[#ef4444] font-bold">{selectedTxn.reason}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#7a7164]">Gateway Latency:</span>
                      <span className="text-[#a89f91]">{selectedTxn.latency || '180ms'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* SECTION 5: AI REVENUE-RECOVERY DIAGNOSIS */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-[#e5a944] font-bold uppercase tracking-wider">5. AI REVENUE-RECOVERY DIAGNOSIS</div>
                <p className="text-[11px] text-[#a89f91] leading-relaxed italic bg-[#0f0c08] p-2.5 rounded-lg border border-[#2e271c]/60">
                  "{selectedTxn.explanation}"
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded bg-[#0f0c08] border border-[#2e271c]">
                    <div className="text-[10px] text-[#7a7164]">AI Confidence</div>
                    <div className="text-sm font-bold text-[#10b981]">{selectedTxn.confidence}%</div>
                  </div>
                  <div className="p-2 rounded bg-[#0f0c08] border border-[#2e271c]">
                    <div className="text-[10px] text-[#7a7164]">Recovery Prob</div>
                    <div className="text-sm font-bold text-[#10b981]">{selectedTxn.recovery_probability}%</div>
                  </div>
                  <div className="p-2 rounded bg-[#0f0c08] border border-[#2e271c]">
                    <div className="text-[10px] text-[#7a7164]">Risk Score</div>
                    <div className={`text-sm font-bold ${selectedTxn.risk_score >= 60 ? 'text-[#ef4444]' : 'text-[#e5a944]'}`}>
                      {selectedTxn.risk_score}/100
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0f0c08] border border-[#2e271c]">
                    <div className="text-[10px] text-[#7a7164]">Policy Gate</div>
                    <div className={`text-sm font-bold ${selectedTxn.policy === 'Approved' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {selectedTxn.policy}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 6: LIFECYCLE & FINAL OUTCOME */}
              <div className="p-3.5 rounded-xl bg-[#15120c] border border-[#2e271c] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-[#e5a944] font-bold uppercase tracking-wider">6. LIFECYCLE TRACE & OUTCOME</div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Settlement Status:</span>
                  <span className={selectedTxn.status === 'RECOVERED' ? 'text-[#10b981] font-bold' : 'text-[#ef4444] font-bold'}>
                    {selectedTxn.status === 'RECOVERED' ? '✓ RECOVERED & CAPTURED' : 'PAYMENT FAILED'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Recommended Action:</span>
                  <span className={selectedTxn.status === 'RECOVERED' ? 'text-[#10b981] font-bold' : 'text-[#e5a944] font-bold'}>
                    {selectedTxn.status === 'RECOVERED' ? (selectedTxn.action && !selectedTxn.action.includes('Send') ? selectedTxn.action : 'None — Recovery completed') : selectedTxn.action}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[#2e271c]/40">
                  <span className="text-[#7a7164]">Verified Amount:</span>
                  <span className="text-[#f4ede2] font-bold">
                    ₹{(selectedTxn.verified_amount_minor ? selectedTxn.verified_amount_minor / 100 : selectedTxn.status === 'RECOVERED' ? selectedTxn.amount : 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#7a7164]">Created At:</span>
                  <span className="text-[#a89f91]">{new Date(selectedTxn.created_at).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedTxn.status === 'RECOVERED' ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-[#10b981]/20 border border-[#10b981]/50 text-[#10b981] font-bold text-xs font-mono cursor-default"
                  >
                    ✓ Payment Verified & Captured in Razorpay
                  </button>
                ) : selectedTxn.policy === 'Blocked' ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] font-bold text-xs font-mono cursor-not-allowed"
                  >
                    ⛔ Blocked by Deterministic Policy Ceiling (Risk {selectedTxn.risk_score}/100)
                  </button>
                ) : selectedTxn.status === 'WAITING_FOR_RECOVERY' || selectedTxn.status === 'IN_PROGRESS' ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-[#e5a944]/15 border border-[#e5a944]/50 text-[#f4ede2] text-xs font-mono space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#e5a944]">⚡ RECOVERY IN PROGRESS</span>
                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-[#e5a944]/20 text-[#e5a944] font-mono border border-[#e5a944]/40">
                          {selectedTxn.recovery_operation_id || 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-[#a89f91] text-[11px]">
                        {selectedTxn.workflow_message || 'Recovery workflow initiated. Awaiting customer retry checkout.'}
                      </div>
                    </div>

                    <button
                      onClick={handleVerifyPayment}
                      disabled={verifying}
                      className="w-full py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#10b981] text-[#10b981] text-xs font-mono transition disabled:opacity-50 cursor-pointer"
                    >
                      {verifying ? 'Verifying Gateway Capture...' : 'Verify Captured Payment Gate'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      onClick={handleExecuteRecovery}
                      disabled={executing}
                      className="w-full py-2.5 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-xs font-mono hover:bg-[#fcd34d] transition shadow-[0_0_15px_rgba(229,169,68,0.3)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>{executing ? 'Dispatching...' : 'Send Retry Payment Link'}</span>
                      <span>➔</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
