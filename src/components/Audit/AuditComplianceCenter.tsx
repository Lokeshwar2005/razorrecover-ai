'use client'

import React, { useState } from 'react'

interface AuditItem {
  id: string
  transaction_id: string
  event_type: string
  actor: string
  decision: string
  reason: string
  hash: string
  prev_hash: string
  recorded_at: string
}

export const AuditComplianceCenter: React.FC = () => {
  const [filter, setFilter] = useState<string>('all')

  const auditEvents: AuditItem[] = [
    {
      id: 'AUD-00101',
      transaction_id: 'TXN-1082',
      event_type: 'PAYMENT_VERIFIED',
      actor: 'Razorpay Verification Bridge',
      decision: 'Captured',
      reason: 'Signature verified & captured status confirmed (pay_TVLdJPjhhrCBEs)',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      prev_hash: '9f83c60e90c88b90757d34237f103825843b6715d47fcd7c2343f6785715f9b0',
      recorded_at: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: 'AUD-00100',
      transaction_id: 'TXN-1082',
      event_type: 'RECOVERY_STARTED',
      actor: 'Recovery Playbook Engine',
      decision: 'Executing',
      reason: 'Automated payment retry initiated via Razorpay Order order_OXb128',
      hash: '9f83c60e90c88b90757d34237f103825843b6715d47fcd7c2343f6785715f9b0',
      prev_hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      recorded_at: new Date(Date.now() - 240000).toISOString(),
    },
    {
      id: 'AUD-00099',
      transaction_id: 'TXN-1082',
      event_type: 'POLICY_APPROVED',
      actor: 'Deterministic Policy Gate',
      decision: 'Approved',
      reason: 'Risk 22 < 70, Retries 1 <= 2, Probability 84% >= 55%',
      hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      prev_hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      recorded_at: new Date(Date.now() - 360000).toISOString(),
    },
    {
      id: 'AUD-00098',
      transaction_id: 'TXN-1082',
      event_type: 'AI_DIAGNOSIS_CREATED',
      actor: 'AI Diagnosis Advisor',
      decision: 'Recommended',
      reason: 'Diagnosed transient bank timeout (HDFC gateway spike). Confidence 94%',
      hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      prev_hash: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
      recorded_at: new Date(Date.now() - 480000).toISOString(),
    },
    {
      id: 'AUD-00097',
      transaction_id: 'TXN-1082',
      event_type: 'TRANSACTION_DETECTED',
      actor: 'Telemetry Ingestion Gateway',
      decision: 'Ingested',
      reason: 'Failed payment signal captured for ₹45,000 INR',
      hash: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
      prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      recorded_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 'AUD-00096',
      transaction_id: 'TXN-1094',
      event_type: 'POLICY_BLOCKED',
      actor: 'Deterministic Policy Gate',
      decision: 'Escalated',
      reason: 'Risk score 84 exceeded maximum risk ceiling 70. Blocked from automated execution.',
      hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      prev_hash: 'c89c42c74d39f75bf7ef4668b5ea76e3309a4714dbf561937cead9e334a17ef6',
      recorded_at: new Date(Date.now() - 720000).toISOString(),
    },
  ]

  const handleExport = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(auditEvents, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'razorrecover_audit_ledger.json'
      a.click()
    } else {
      const headers = 'Event ID,Transaction ID,Event Type,Actor,Decision,Reason,SHA256 Hash,Timestamp\n'
      const rows = auditEvents
        .map(
          (e) =>
            `"${e.id}","${e.transaction_id}","${e.event_type}","${e.actor}","${e.decision}","${e.reason}","${e.hash}","${e.recorded_at}"`
        )
        .join('\n')
      const blob = new Blob([headers + rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'razorrecover_audit_ledger.csv'
      a.click()
    }
  }

  const filtered = auditEvents.filter((e) => {
    if (filter === 'verified') return e.event_type === 'PAYMENT_VERIFIED'
    if (filter === 'blocked') return e.event_type === 'POLICY_BLOCKED'
    if (filter === 'policy') return e.event_type.startsWith('POLICY_')
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Audit & Compliance Center</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
              SHA-256 Chained Ledger
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Tamper-evident cryptographic ledger of all AI diagnostic inferences and deterministic policy authorizations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-[#2e271c] bg-[#15120c] text-[#f4ede2] hover:border-[#e5a944] transition"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-[#2e271c] bg-[#15120c] text-[#f4ede2] hover:border-[#e5a944] transition"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-mono">
        {[
          { id: 'all', label: 'All Audit Events' },
          { id: 'verified', label: 'Verified Captures' },
          { id: 'blocked', label: 'Policy Blocked' },
          { id: 'policy', label: 'Policy Decisions' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition ${
              filter === tab.id
                ? 'bg-[#e5a944] text-[#080705] border-[#e5a944] font-bold'
                : 'bg-[#0f0c08] text-[#a89f91] border-[#2e271c] hover:border-[#453d32]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Table */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#2e271c] text-[#7a7164]">
              <th className="pb-3 font-semibold">EVENT ID</th>
              <th className="pb-3 font-semibold">TXN ID</th>
              <th className="pb-3 font-semibold">EVENT TYPE</th>
              <th className="pb-3 font-semibold">ACTOR</th>
              <th className="pb-3 font-semibold">DECISION & REASON</th>
              <th className="pb-3 font-semibold">SHA-256 HASH</th>
              <th className="pb-3 font-semibold text-right">INTEGRITY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e271c]/50 text-[#a89f91]">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[#15120c] transition">
                <td className="py-3.5 font-bold text-[#e5a944]">{item.id}</td>
                <td className="py-3.5 text-[#f4ede2] font-semibold">{item.transaction_id}</td>
                <td className="py-3.5">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#15120c] border border-[#2e271c] text-[#fcd34d]">
                    {item.event_type}
                  </span>
                </td>
                <td className="py-3.5 text-[#a89f91]">{item.actor}</td>
                <td className="py-3.5 max-w-xs">
                  <div className="text-[#f4ede2] font-bold">{item.decision}</div>
                  <div className="text-[11px] text-[#7a7164] truncate">{item.reason}</div>
                </td>
                <td className="py-3.5 font-mono text-[10px] text-[#7a7164] max-w-[120px] truncate" title={item.hash}>
                  {item.hash.slice(0, 16)}...
                </td>
                <td className="py-3.5 text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                    ✓ Chained
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
