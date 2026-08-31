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
    let atRiskMinor = 0
    let recoveredMinor = 0

    for (const t of transactions) {
      if (t.status === 'RECOVERED' || (t.verified_amount_minor && t.verified_amount_minor > 0)) {
        recoveredCount++
        recoveredMinor += t.verified_amount_minor || t.amount_minor || 0
      } else if (t.status === 'WAITING_FOR_RECOVERY' || t.status === 'IN_PROGRESS') {
        pendingCount++
        atRiskMinor += t.amount_minor || 0
      } else {
        stoppedCount++
        atRiskMinor += t.amount_minor || 0
      }
    }

    const total = transactions.length
    const rate = total > 0 ? Math.round((recoveredCount / total) * 1000) / 10 : 0

    return {
      total,
      stoppedCount,
      pendingCount,
      recoveredCount,
      atRiskMinor,
      recoveredMinor,
      rate,
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
              ● LIVE PRODUCTION (CHRONOVA)
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Real-time autonomous revenue recovery telemetry originating from Chronova customer storefront.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#15120c] border border-[#2e271c] text-xs font-mono text-[#10b981]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>Live Stream: {metrics.total} Events</span>
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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue at Risk */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#7a7164] uppercase tracking-wider">Revenue at Risk</span>
            <span className="text-sm">⚠️</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#ef4444]">
            {formatRupees(backendStats?.revenue_at_risk_minor ?? metrics.atRiskMinor)}
          </div>
          <p className="text-[11px] text-[#7a7164] font-mono">
            {metrics.stoppedCount + metrics.pendingCount} unrecovered payment drops
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
            {formatRupees(backendStats?.revenue_recovered_minor ?? metrics.recoveredMinor)}
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
            {backendStats?.recovery_rate ?? metrics.rate}%
          </div>
          <p className="text-[11px] text-[#7a7164] font-mono">
            {metrics.recoveredCount} of {metrics.total} total checkout attempts
          </p>
        </div>

        {/* Active Recovery Opportunities */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#7a7164] uppercase tracking-wider">Active Opportunities</span>
            <span className="text-sm">🎯</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[#f4ede2]">
            {metrics.stoppedCount + metrics.pendingCount}
          </div>
          <p className="text-[11px] text-[#7a7164] font-mono">
            {metrics.pendingCount} in progress · {metrics.stoppedCount} open
          </p>
        </div>
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
              Live checkout failures and verified settlements streaming from Chronova Storefront.
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
              const isRec = t.status === 'RECOVERED'
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
                        <span className="text-[#a89f91] text-[11px]">{t.chronova_order_id}</span>
                      )}
                    </div>
                    <div className="text-[#a89f91]">
                      {t.reason} • Action: <span className="text-[#e5a944]">{t.action}</span>
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
                      ) : isStopped ? (
                        <span className="px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] text-[10px] font-bold border border-[#ef4444]/40">
                          PAYMENT FAILED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#e5a944]/20 text-[#e5a944] text-[10px] font-bold border border-[#e5a944]/40 animate-pulse">
                          IN PROGRESS
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
