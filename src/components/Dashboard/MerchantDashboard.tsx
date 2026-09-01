'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  useTransactionStore,
  type CanonicalTransaction,
} from '../../services/canonicalTransactionStore'
import { fetchDashboardStats, type DashboardStats } from '../../services/backendApi'

export const MerchantDashboard: React.FC = () => {
  const {
    transactions,
    refreshProviderFeed,
    syncMessage,
  } = useTransactionStore()

  const [backendStats, setBackendStats] = useState<DashboardStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString())

  useEffect(() => {
    refreshProviderFeed().then(() => setLastSyncedAt(new Date().toISOString()))
    fetchDashboardStats().then((data) => {
      if (data) setBackendStats(data)
    })

    const pollTimer = setInterval(() => {
      refreshProviderFeed().then(() => setLastSyncedAt(new Date().toISOString()))
      fetchDashboardStats().then((data) => {
        if (data) setBackendStats(data)
      })
    }, 3500)

    return () => clearInterval(pollTimer)
  }, [refreshProviderFeed])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshProviderFeed()
      const data = await fetchDashboardStats()
      if (data) setBackendStats(data)
      setLastSyncedAt(new Date().toISOString())
    } finally {
      setTimeout(() => setRefreshing(false), 400)
    }
  }

  // Calculate metrics purely from live Chronova transactions
  const metrics = useMemo(() => {
    let stoppedCount = 0
    let pendingCount = 0
    let recoveredCount = 0
    let directCount = 0
    let atRiskMinor = 0
    let recoveredMinor = 0
    let expectedRecoveryMinor = 0

    const failureMap = new Map<string, { attempts: number; recoveries: number; atRiskMinor: number; recoveredMinor: number }>()

    for (const t of transactions) {
      const isRec = t.status === 'RECOVERED' || (t.verified_amount_minor && t.verified_amount_minor > 0)
      const recAmt = isRec ? (t.verified_amount_minor || t.amount_minor || 0) : 0
      const prob = Number(t.recovery_probability) || 85

      if (isRec) {
        recoveredCount++
        recoveredMinor += recAmt
      } else if (t.status === 'CAPTURED' || t.status === 'SUCCESS') {
        directCount++
      } else if (t.status === 'WAITING_FOR_RECOVERY' || t.status === 'IN_PROGRESS') {
        pendingCount++
        atRiskMinor += t.amount_minor || 0
        expectedRecoveryMinor += Math.round((t.amount_minor || 0) * (prob / 100))
      } else {
        stoppedCount++
        atRiskMinor += t.amount_minor || 0
        expectedRecoveryMinor += Math.round((t.amount_minor || 0) * (prob / 100))
      }

      // Failure reason breakdown
      const sig = t.reason || 'Network / Latency Degradation'
      const cur = failureMap.get(sig) || { attempts: 0, recoveries: 0, atRiskMinor: 0, recoveredMinor: 0 }
      cur.attempts++
      cur.atRiskMinor += t.amount_minor || 0
      if (isRec) {
        cur.recoveries++
        cur.recoveredMinor += recAmt
      }
      failureMap.set(sig, cur)
    }

    const total = transactions.length
    const rate = total > 0 ? Math.round((recoveredCount / total) * 1000) / 10 : 0

    const failureBreakdown = Array.from(failureMap.entries()).map(([reason, d]) => ({
      reason,
      attempts: d.attempts,
      recoveries: d.recoveries,
      rate: d.attempts > 0 ? Math.round((d.recoveries / d.attempts) * 1000) / 10 : 0,
      atRiskMinor: d.atRiskMinor,
      recoveredMinor: d.recoveredMinor,
    }))

    return {
      total,
      stoppedCount,
      pendingCount,
      recoveredCount,
      directCount,
      atRiskMinor,
      recoveredMinor,
      expectedRecoveryMinor,
      rate,
      failureBreakdown,
    }
  }, [transactions])

  const formatRupees = (minor?: number) => {
    const val = Number(minor) || 0
    return `₹${Math.round(val / 100).toLocaleString('en-IN')}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-[#15120c] via-[#0f0c08] to-[#15120c] border border-[#2e271c]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981] animate-ping" />
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Merchant Command Center</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded border border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]">
              ● LIVE CANONICAL TELEMETRY
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Real-time autonomous revenue recovery telemetry originating from Chronova customer storefront.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#15120c] border border-[#2e271c] text-xs font-mono text-[#10b981]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>Event Stream: {metrics.total} Transactions</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg bg-[#15120c] border border-[#2e271c] hover:border-[#e5a944] text-xs font-mono text-[#f4ede2] hover:text-[#e5a944] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Live Telemetry"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Primary Financial KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue at Risk */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#7a7164] uppercase tracking-wider">Revenue at Risk</span>
            <span className="text-sm">⚠️</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#ef4444]">
            {formatRupees(metrics.atRiskMinor)}
          </div>
          <p className="text-[11px] text-[#7a7164] font-mono">
            {metrics.stoppedCount + metrics.pendingCount} unrecovered payment drops
          </p>
        </div>

        {/* Expected Recovery Value */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#fcd34d]/30 space-y-1 shadow-[0_0_15px_rgba(252,211,77,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#fcd34d] uppercase tracking-wider font-bold">
              Expected Recovery Value
            </span>
            <span className="text-sm">🎯</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#fcd34d]">
            {formatRupees(metrics.expectedRecoveryMinor)}
          </div>
          <p className="text-[11px] text-[#a89f91] font-mono">
            ∑ (Amount × Recovery Prob)
          </p>
        </div>

        {/* Verified Revenue Recovered */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#10b981]/40 space-y-1 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#10b981] uppercase tracking-wider font-bold">
              Verified Revenue Recovered
            </span>
            <span className="text-sm">✓</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#10b981]">
            {formatRupees(metrics.recoveredMinor)}
          </div>
          <p className="text-[11px] text-[#10b981]/80 font-mono">
            {metrics.recoveredCount} verified captured payments
          </p>
        </div>

        {/* Recovery Success Rate */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#7a7164] uppercase tracking-wider">Recovery Success Rate</span>
            <span className="text-sm">📈</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#e5a944]">
            {metrics.rate}%
          </div>
          <p className="text-[11px] text-[#7a7164] font-mono">
            {metrics.recoveredCount} of {metrics.total} total checkout attempts
          </p>
        </div>
      </div>

      {/* Secondary Operational Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#15120c] border border-[#2e271c] text-xs font-mono">
        <div>
          <span className="text-[#7a7164]">Active Opportunities: </span>
          <strong className="text-[#f4ede2]">{metrics.stoppedCount + metrics.pendingCount}</strong>
        </div>
        <div>
          <span className="text-[#7a7164]">Customer Payments Pending: </span>
          <strong className="text-[#fcd34d]">{metrics.pendingCount}</strong>
        </div>
        <div>
          <span className="text-[#7a7164]">Verified Recoveries: </span>
          <strong className="text-[#10b981]">{metrics.recoveredCount}</strong>
        </div>
        <div>
          <span className="text-[#7a7164]">Direct Settlements: </span>
          <strong className="text-[#3b82f6]">{metrics.directCount}</strong>
        </div>
      </div>

      {/* Batch Recovery Analytics Section */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
        <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#f4ede2] flex items-center gap-2">
              <span>📊</span>
              <span>Batch Recovery Analytics & Failure Attribution</span>
            </h2>
            <p className="text-xs text-[#a89f91] mt-0.5">
              Recovery performance, conversion efficiency, and revenue attribution broken down by failure signature.
            </p>
          </div>
          <span className="text-xs font-mono text-[#e5a944] bg-[#e5a944]/10 px-2 py-0.5 rounded border border-[#e5a944]/30">
            {metrics.failureBreakdown.length} Failure Signatures
          </span>
        </div>

        {metrics.failureBreakdown.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#7a7164]">
            No failure events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#2e271c] text-[#7a7164]">
                  <th className="pb-3 font-semibold">FAILURE SIGNATURE</th>
                  <th className="pb-3 font-semibold text-center">ATTEMPTS</th>
                  <th className="pb-3 font-semibold text-center">RECOVERIES</th>
                  <th className="pb-3 font-semibold text-center">RECOVERY RATE</th>
                  <th className="pb-3 font-semibold text-right">REVENUE AT RISK</th>
                  <th className="pb-3 font-semibold text-right">RECOVERED REVENUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e271c]/60 text-[#a89f91]">
                {metrics.failureBreakdown.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#15120c]/60 transition">
                    <td className="py-3 font-bold text-[#f4ede2] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#e5a944]" />
                      <span>{row.reason}</span>
                    </td>
                    <td className="py-3 text-center text-[#f4ede2]">{row.attempts}</td>
                    <td className="py-3 text-center text-[#10b981] font-bold">{row.recoveries}</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#15120c] border border-[#2e271c] text-[#fcd34d] font-bold">
                        {row.rate}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-[#ef4444] font-bold">
                      {formatRupees(row.atRiskMinor)}
                    </td>
                    <td className="py-3 text-right text-[#10b981] font-bold">
                      {formatRupees(row.recoveredMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Chronova Stream & Empty State */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
        <div className="flex items-center justify-between border-b border-[#2e271c] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#f4ede2] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span>Live Chronova Payments Stream</span>
            </h2>
            <p className="text-xs text-[#a89f91] mt-0.5">
              Live checkout failures and verified settlements streaming from Chronova Storefront (Razorpay Test Mode).
            </p>
          </div>
          <div className="text-xs font-mono text-[#7a7164]">
            Last sync: {new Date(lastSyncedAt).toLocaleTimeString()}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 rounded-xl bg-[#15120c]/60 border border-[#2e271c]/60 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center mx-auto text-[#10b981] text-xl">
              ⚡
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4ede2]">No live Chronova transactions yet.</h3>
              <p className="text-xs text-[#a89f91] max-w-md mx-auto">
                RazorRecover AI is actively listening for payment events. Open the Chronova storefront to initiate a checkout or test a failure scenario.
              </p>
            </div>
            <div className="pt-2">
              <a
                href="https://lokeshwar2005.github.io/razorrecover-ai/chronova/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e5a944] text-[#080705] text-xs font-mono font-bold hover:bg-[#fcd34d] transition shadow-md"
              >
                <span>Open Chronova Storefront</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.slice(0, 10).map((t) => {
              const isRec = t.status === 'RECOVERED' || (t.verified_amount_minor && t.verified_amount_minor > 0)
              const isWaiting = t.status === 'WAITING_FOR_RECOVERY' || t.status === 'IN_PROGRESS'
              const isStopped = t.status === 'PAYMENT_FAILED' || t.status === 'STOPPED'

              return (
                <div
                  key={t.id}
                  className="p-3.5 rounded-lg bg-[#15120c] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#f4ede2]">{t.id}</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#10b981] text-[10px] font-bold border border-[#10b981]/40">
                        CHRONOVA
                      </span>
                      {t.chronova_order_id && (
                        <span className="text-[#a89f91] text-[11px]">#{t.chronova_order_id}</span>
                      )}
                    </div>
                    <div className="text-[#a89f91]">
                      {t.reason} • Action: <span className="text-[#e5a944]">{isRec ? 'None — Recovery completed' : t.action}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="text-right">
                      <div className="font-bold text-[#f4ede2]">₹{t.amount.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-[#7a7164]">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    <div>
                      {isRec ? (
                        <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] text-[10px] font-bold border border-[#10b981]/40">
                          ✓ RECOVERED
                        </span>
                      ) : isWaiting ? (
                        <span className="px-2 py-0.5 rounded bg-[#fcd34d]/20 text-[#fcd34d] text-[10px] font-bold border border-[#fcd34d]/40 animate-pulse">
                          PAYMENT PENDING
                        </span>
                      ) : isStopped ? (
                        <span className="px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] text-[10px] font-bold border border-[#ef4444]/40">
                          PAYMENT FAILED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#3b82f6]/20 text-[#3b82f6] text-[10px] font-bold border border-[#3b82f6]/40">
                          ✓ DIRECT PAID
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
