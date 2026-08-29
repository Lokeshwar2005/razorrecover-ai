'use client'

import React, { useEffect, useState } from 'react'
import { fetchPolicySettings, savePolicySettings, type PolicySettings } from '../../services/backendApi'

export const PolicySettingsView: React.FC = () => {
  const [settings, setSettings] = useState<PolicySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchPolicySettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setMessage(null)

    try {
      const updated = await savePolicySettings(settings)
      setSettings(updated)
      setMessage('✓ Policy boundaries updated & active across deterministic evaluation gates.')
    } catch (err) {
      setMessage('Error updating policy configuration.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return <div className="p-8 text-center text-[#e5a944] animate-pulse">Loading Policy Engine Parameters...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h1 className="text-xl font-bold tracking-tight text-[#f4ede2]">Merchant Policy Configuration</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              Deterministic Safety Gate
            </span>
          </div>
          <p className="text-sm text-[#a89f91] mt-1">
            Configure mathematical authorization boundaries for automated revenue recovery playbooks.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-lg bg-[#10b981]/10 border border-[#10b981]/40 text-[#10b981] text-sm font-mono flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-xs text-[#a89f91] hover:text-white">✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Sliders & Numerical Ceilings */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-6">
          <h2 className="text-base font-bold text-[#f4ede2] border-b border-[#2e271c] pb-2">Safety Thresholds</h2>

          {/* Risk Ceiling */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#a89f91]">MAXIMUM RISK CEILING:</span>
              <strong className="text-[#e5a944]">{settings.max_risk_ceiling}/100</strong>
            </div>
            <input
              type="range"
              min="20"
              max="85"
              value={settings.max_risk_ceiling}
              onChange={(e) => setSettings({ ...settings, max_risk_ceiling: Number(e.target.value) })}
              className="w-full accent-[#e5a944] bg-[#15120c]"
            />
            <p className="text-[11px] text-[#7a7164]">
              Transactions with a risk score above this ceiling are automatically blocked and escalated to human operators.
            </p>
          </div>

          {/* Max Retries */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#a89f91]">MAXIMUM AUTOMATED RETRIES:</span>
              <strong className="text-[#e5a944]">{settings.max_retry_ceiling} Retries</strong>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              value={settings.max_retry_ceiling}
              onChange={(e) => setSettings({ ...settings, max_retry_ceiling: Number(e.target.value) })}
              className="w-full accent-[#e5a944] bg-[#15120c]"
            />
            <p className="text-[11px] text-[#7a7164]">
              Prevents bank rate-limiting and merchant reputation degradation. (Default: 2)
            </p>
          </div>

          {/* Recovery Probability Floor */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#a89f91]">MINIMUM RECOVERY PROBABILITY FLOOR:</span>
              <strong className="text-[#10b981]">{settings.min_recovery_probability}%</strong>
            </div>
            <input
              type="range"
              min="30"
              max="80"
              value={settings.min_recovery_probability}
              onChange={(e) => setSettings({ ...settings, min_recovery_probability: Number(e.target.value) })}
              className="w-full accent-[#10b981] bg-[#15120c]"
            />
            <p className="text-[11px] text-[#7a7164]">
              Transactions with recovery likelihood below this floor require human review. (Default: 55%)
            </p>
          </div>
        </div>

        {/* Allowed Recovery Playbooks */}
        <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4">
          <h2 className="text-base font-bold text-[#f4ede2] border-b border-[#2e271c] pb-2">Allowed Bounded Playbooks</h2>

          <div className="space-y-3 text-xs font-mono">
            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#15120c] border border-[#2e271c] cursor-pointer hover:border-[#453d32] transition">
              <input
                type="checkbox"
                checked={settings.allow_retry_payment}
                onChange={(e) => setSettings({ ...settings, allow_retry_payment: e.target.checked })}
                className="accent-[#e5a944]"
              />
              <span className="text-[#f4ede2] font-bold">Automated Payment Retry</span>
              <span className="text-[#7a7164] ml-auto">For bank timeout & network degradation</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#15120c] border border-[#2e271c] cursor-pointer hover:border-[#453d32] transition">
              <input
                type="checkbox"
                checked={settings.allow_payment_link}
                onChange={(e) => setSettings({ ...settings, allow_payment_link: e.target.checked })}
                className="accent-[#e5a944]"
              />
              <span className="text-[#f4ede2] font-bold">Razorpay Smart Payment Links</span>
              <span className="text-[#7a7164] ml-auto">For checkout drop-offs & expired 3DS</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#15120c] border border-[#2e271c] cursor-pointer hover:border-[#453d32] transition">
              <input
                type="checkbox"
                checked={settings.allow_customer_prompt}
                onChange={(e) => setSettings({ ...settings, allow_customer_prompt: e.target.checked })}
                className="accent-[#e5a944]"
              />
              <span className="text-[#f4ede2] font-bold">In-App Customer Re-auth Prompt</span>
              <span className="text-[#7a7164] ml-auto">For 3DS challenges & user dropouts</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#15120c] border border-[#2e271c] cursor-pointer hover:border-[#453d32] transition">
              <input
                type="checkbox"
                checked={settings.allow_voice_recovery}
                onChange={(e) => setSettings({ ...settings, allow_voice_recovery: e.target.checked })}
                className="accent-[#e5a944]"
              />
              <span className="text-[#f4ede2] font-bold">Hinglish Voice Recovery & WhatsApp Links</span>
              <span className="text-[#7a7164] ml-auto">For high-intent failed commerce orders</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#15120c] border border-[#2e271c] cursor-pointer hover:border-[#453d32] transition">
              <input
                type="checkbox"
                checked={settings.allow_ptp_tracker}
                onChange={(e) => setSettings({ ...settings, allow_ptp_tracker: e.target.checked })}
                className="accent-[#e5a944]"
              />
              <span className="text-[#f4ede2] font-bold">Promise-to-Pay (PTP) Sequencer</span>
              <span className="text-[#7a7164] ml-auto">For B2B receivables & delayed settlements</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-4 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-sm hover:bg-[#fcd34d] transition shadow-[0_0_15px_rgba(229,169,68,0.3)] disabled:opacity-50"
        >
          {saving ? 'Saving Policy Configuration...' : 'Save & Activate Policy Boundaries ▶'}
        </button>
      </form>
    </div>
  )
}
