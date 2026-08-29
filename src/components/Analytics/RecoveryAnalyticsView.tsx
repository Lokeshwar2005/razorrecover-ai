'use client'

import React, { useEffect, useState } from 'react'
import { fetchAnalytics, type AnalyticsData } from '../../services/backendApi'

export const RecoveryAnalyticsView: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics().then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [])

  const formatRupees = (minor: number) => {
    return `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  if (loading || !data) {
    return <div className="p-8 text-center text-[#e5a944] animate-pulse">Aggregating Verified Historical Telemetry...</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Historical Recovery Effectiveness</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
              Verified Payment Captures Only
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Empirical success rates calculated exclusively from captured Razorpay payments.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="p-2 rounded bg-[#15120c] border border-[#2e271c]">
            <span className="text-[#7a7164]">OVERALL RATE: </span>
            <strong className="text-[#10b981] text-sm">{data.overall_recovery_rate}%</strong>
          </div>
          <div className="p-2 rounded bg-[#15120c] border border-[#2e271c]">
            <span className="text-[#7a7164]">TOTAL RECOVERED: </span>
            <strong className="text-[#fcd34d] text-sm">{formatRupees(data.total_revenue_recovered_minor)}</strong>
          </div>
        </div>
      </div>

      {/* Action Performance Matrix */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#f4ede2]">Recovery Playbook Performance</h2>
          <p className="text-xs text-[#a89f91]">Empirical success rates by recovery action type.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#2e271c] text-[#7a7164]">
                <th className="pb-3 font-semibold">RECOVERY PLAYBOOK</th>
                <th className="pb-3 font-semibold">TOTAL ATTEMPTS</th>
                <th className="pb-3 font-semibold">VERIFIED CAPTURES</th>
                <th className="pb-3 font-semibold">SUCCESS RATE</th>
                <th className="pb-3 font-semibold text-right">REVENUE RECOVERED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e271c]/60 text-[#a89f91]">
              {data.action_performance.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#15120c]/60 transition">
                  <td className="py-3.5 font-bold text-[#f4ede2] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#e5a944]" />
                    {item.action}
                  </td>
                  <td className="py-3.5">{item.total_attempts}</td>
                  <td className="py-3.5 text-[#10b981] font-bold">{item.verified_recoveries}</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-[#15120c] rounded-full h-1.5 overflow-hidden border border-[#2e271c]">
                        <div style={{ width: `${item.success_rate}%` }} className="bg-[#10b981] h-full" />
                      </div>
                      <span className="text-[#f4ede2]">{item.success_rate}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right font-bold text-[#fcd34d]">
                    {formatRupees(item.total_recovered_minor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failure Signature Distribution */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#f4ede2]">Failure Signature Effectiveness</h2>
          <p className="text-xs text-[#a89f91]">Breakdown of recovery rates by root cause failure signal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.failure_distributions.map((sig, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#f4ede2]">{sig.failure_signature}</span>
                <span className="px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                  {sig.recovery_rate}% Recovery
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-[#a89f91]">
                <span>Occurrences: {sig.count}</span>
                <span>At Risk: {formatRupees(sig.total_at_risk_minor)}</span>
                <span>Recovered: <strong className="text-[#10b981]">{formatRupees(sig.recovered_minor)}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
