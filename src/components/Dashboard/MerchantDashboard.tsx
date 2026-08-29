'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  useTransactionStore,
  computeMetricsFromTransactions,
  computeOpportunitiesFromTransactions,
} from '../../services/canonicalTransactionStore'
import { fetchDashboardStats, type DashboardStats } from '../../services/backendApi'

export const MerchantDashboard: React.FC = () => {
  const transactions = useTransactionStore((s) => s.transactions)
  const [backendStats, setBackendStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    fetchDashboardStats().then((data) => {
      if (data) setBackendStats(data)
    })
  }, [])

  // Single Source of Truth metrics derived directly from canonical transactions
  const canonicalMetrics = useMemo(() => {
    return computeMetricsFromTransactions(transactions)
  }, [transactions])

  const opps = useMemo(() => {
    return computeOpportunitiesFromTransactions(transactions)
  }, [transactions])

  const oppsValueMinor = useMemo(() => {
    return opps.reduce((sum, o) => sum + o.expected_value_minor, 0)
  }, [opps])

  const stats: DashboardStats = useMemo(() => {
    if (backendStats) {
      return {
        ...backendStats,
        revenue_at_risk_minor: canonicalMetrics.revenueAtRiskMinor,
        revenue_recovered_minor: canonicalMetrics.verifiedRecoveredMinor,
        recovery_rate: canonicalMetrics.recoveryRate,
        failed_transactions_count: canonicalMetrics.stoppedCount,
        active_recovery_attempts_count: canonicalMetrics.pendingCount,
        policy_blocks_count: canonicalMetrics.blockedCount,
        total_opportunities_value_minor: oppsValueMinor,
      }
    }

    return {
      revenue_at_risk_minor: canonicalMetrics.revenueAtRiskMinor,
      revenue_recovered_minor: canonicalMetrics.verifiedRecoveredMinor,
      recovery_rate: canonicalMetrics.recoveryRate,
      failed_transactions_count: canonicalMetrics.stoppedCount,
      active_recovery_attempts_count: canonicalMetrics.pendingCount,
      policy_blocks_count: canonicalMetrics.blockedCount,
      total_opportunities_value_minor: oppsValueMinor,
      average_ai_confidence: 94.0,
      velocity_minor_per_sec: 4300,
      trends: [
        { timestamp: 'Aug 23', revenue_at_risk_minor: 3200000, revenue_recovered_minor: 2100000, recovery_rate: 65.6 },
        { timestamp: 'Aug 24', revenue_at_risk_minor: 4100000, revenue_recovered_minor: 2900000, recovery_rate: 70.7 },
        { timestamp: 'Aug 25', revenue_at_risk_minor: 5800000, revenue_recovered_minor: 4200000, recovery_rate: 72.4 },
        { timestamp: 'Aug 26', revenue_at_risk_minor: 8200000, revenue_recovered_minor: 6100000, recovery_rate: 74.3 },
        { timestamp: 'Aug 27', revenue_at_risk_minor: 11500000, revenue_recovered_minor: 8400000, recovery_rate: 73.0 },
        { timestamp: 'Aug 28', revenue_at_risk_minor: 14900000, revenue_recovered_minor: 10800000, recovery_rate: 72.4 },
        {
          timestamp: 'Aug 29',
          revenue_at_risk_minor: canonicalMetrics.revenueAtRiskMinor,
          revenue_recovered_minor: canonicalMetrics.verifiedRecoveredMinor,
          recovery_rate: canonicalMetrics.recoveryRate,
        },
      ],
    }
  }, [backendStats, canonicalMetrics, oppsValueMinor])

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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
              Live Telemetry • {canonicalMetrics.totalTransactions} Canonical Records
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Real-time bounded autonomy telemetry & financial recovery intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-mono text-[#7a7164]">RECOVERY VELOCITY</div>
            <div className="text-sm font-mono font-bold text-[#10b981]">
              +{formatRupees(stats.velocity_minor_per_sec)}/sec
            </div>
          </div>
          <a
            href="/opportunities"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#e5a944] text-[#080705] hover:bg-[#fcd34d] transition duration-200"
          >
            Review Opportunities ▶
          </a>
        </div>
      </div>

      {/* 8 Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] hover:border-[#e5a944]/40 transition">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Revenue at Risk</div>
          <div className="text-2xl font-bold text-[#f4ede2] mt-1">{formatRupees(stats.revenue_at_risk_minor)}</div>
          <div className="text-xs text-[#ef4444] mt-1">{canonicalMetrics.pendingCount} active leakage signals</div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] hover:border-[#10b981]/40 transition">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Verified Recovered</div>
          <div className="text-2xl font-bold text-[#10b981] mt-1">{formatRupees(stats.revenue_recovered_minor)}</div>
          <div className="text-xs text-[#10b981] mt-1">Razorpay captured & verified</div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] hover:border-[#e5a944]/40 transition">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Recovery Rate</div>
          <div className="text-2xl font-bold text-[#e5a944] mt-1">{stats.recovery_rate}%</div>
          <div className="text-xs text-[#a89f91] mt-1">+14.2% vs baseline retries</div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c] hover:border-[#e5a944]/40 transition">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Opportunity Queue</div>
          <div className="text-2xl font-bold text-[#fcd34d] mt-1">
            {formatRupees(stats.total_opportunities_value_minor)}
          </div>
          <div className="text-xs text-[#a89f91] mt-1">Expected recoverable value</div>
        </div>

        {/* Metric 5 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Active Attempts</div>
          <div className="text-xl font-bold text-[#f4ede2] mt-1">{stats.active_recovery_attempts_count} in-flight</div>
          <div className="text-xs text-[#a89f91] mt-1">Bounded playbook runs</div>
        </div>

        {/* Metric 6 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Policy Blocks</div>
          <div className="text-xl font-bold text-[#ef4444] mt-1">{stats.policy_blocks_count} blocked</div>
          <div className="text-xs text-[#a89f91] mt-1">Deterministic risk ceiling</div>
        </div>

        {/* Metric 7 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">AI Confidence</div>
          <div className="text-xl font-bold text-[#f4ede2] mt-1">{stats.average_ai_confidence}%</div>
          <div className="text-xs text-[#10b981] mt-1">OpenRouter diagnostic</div>
        </div>

        {/* Metric 8 */}
        <div className="p-4 rounded-xl bg-[#0f0c08] border border-[#2e271c]">
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a7164]">Failed & Stopped</div>
          <div className="text-xl font-bold text-[#a89f91] mt-1">{stats.failed_transactions_count} stopped</div>
          <div className="text-xs text-[#7a7164] mt-1">Escalated to human review</div>
        </div>
      </div>

      {/* 7-Day Performance Trend */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#f4ede2]">7-Day Recovery Efficiency Trend</h2>
            <p className="text-xs text-[#a89f91]">Daily at-risk volume vs captured & verified recovery rate.</p>
          </div>
          <span className="text-xs font-mono text-[#10b981]">● Recovery Rate Trend</span>
        </div>

        <div className="grid grid-cols-7 gap-2 pt-2">
          {stats.trends.map((t, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-[#15120c] border border-[#2e271c] text-center space-y-1">
              <div className="text-[10px] font-mono text-[#7a7164]">{t.timestamp}</div>
              <div className="text-xs font-mono font-bold text-[#f4ede2]">
                {formatRupees(t.revenue_recovered_minor)}
              </div>
              <div className="text-[10px] font-mono text-[#10b981] font-semibold">{t.recovery_rate}%</div>
              <div className="w-full bg-[#2e271c] h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-[#10b981] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, t.recovery_rate)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
