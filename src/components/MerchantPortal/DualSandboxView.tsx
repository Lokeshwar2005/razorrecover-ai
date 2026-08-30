'use client'

import React, { useState } from 'react'
import { ChronoSphereStore } from '../ChronoSphere/ChronoSphereStore'

interface DualSandboxViewProps {
  renderRazorRecover: (tab?: string, txnId?: string) => React.ReactNode
}

export const DualSandboxView: React.FC<DualSandboxViewProps> = ({ renderRazorRecover }) => {
  const [activeLayout, setActiveLayout] = useState<'split' | 'store-only' | 'recovery-only'>('split')
  const [recoveryTargetTab, setRecoveryTargetTab] = useState<string>('Opportunities')
  const [targetTxnId, setTargetTxnId] = useState<string | undefined>()

  const handleNavigateToRazorRecover = (tab?: string, txnId?: string) => {
    if (tab) setRecoveryTargetTab(tab)
    if (txnId) setTargetTxnId(txnId)
  }

  return (
    <div className="w-full min-h-screen bg-[#050811] flex flex-col font-sans text-xs">
      {/* Dual Sandbox Ecosystem Control Bar */}
      <div className="bg-[#090e1a] border-b border-[#1e293b] py-2.5 px-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full bg-[#38bdf8]/15 border border-[#38bdf8]/50 text-[#38bdf8] font-mono font-bold text-[11px] flex items-center gap-1.5">
            <span>⚡</span>
            <span>DUAL-SANDBOX LIVE PAYMENT ECOSYSTEM</span>
          </span>
          <span className="text-[#94a3b8] hidden md:inline text-xs">
            Website A (ChronoSphere Watches) ⟷ Razorpay Test Mode ⟷ Website B (RazorRecover AI)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#64748b] text-[11px] hidden sm:inline">View Mode:</span>
          <div className="bg-[#040711] border border-[#1e293b] rounded-xl p-0.5 flex gap-1">
            <button
              onClick={() => setActiveLayout('split')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeLayout === 'split'
                  ? 'bg-[#38bdf8] text-[#050811] shadow'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>◫</span>
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setActiveLayout('store-only')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeLayout === 'store-only'
                  ? 'bg-[#2563eb] text-white shadow'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>⌚</span>
              <span>ChronoSphere (A)</span>
            </button>
            <button
              onClick={() => setActiveLayout('recovery-only')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeLayout === 'recovery-only'
                  ? 'bg-[#10b981] text-[#050811] shadow'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🛡️</span>
              <span>RazorRecover (B)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Pane: Website A (ChronoSphere Watches) */}
        {(activeLayout === 'split' || activeLayout === 'store-only') && (
          <div
            className={`border-b lg:border-b-0 lg:border-r border-[#1e293b] overflow-y-auto max-h-[calc(100vh-45px)] ${
              activeLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <ChronoSphereStore
              onNavigateToRazorRecover={handleNavigateToRazorRecover}
              isDualView={activeLayout === 'split'}
            />
          </div>
        )}

        {/* Right Pane: Website B (RazorRecover AI Live Cockpit) */}
        {(activeLayout === 'split' || activeLayout === 'recovery-only') && (
          <div
            className={`overflow-y-auto max-h-[calc(100vh-45px)] bg-[#080705] ${
              activeLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <div className="p-2.5 bg-[#120f0a] border-b border-[#2e271c] text-[#e5a944] font-mono text-[11px] flex justify-between items-center px-4">
              <span className="flex items-center gap-1.5 font-bold">
                <span>🛡️</span>
                <span>WEBSITE B: RAZORRECOVER AI LIVE COCKPIT</span>
              </span>
              <span className="text-[#10b981] text-[10px] flex items-center gap-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                <span>REAL-TIME CANONICAL LEDGER SYNC</span>
              </span>
            </div>
            {renderRazorRecover(recoveryTargetTab, targetTxnId)}
          </div>
        )}
      </div>
    </div>
  )
}
