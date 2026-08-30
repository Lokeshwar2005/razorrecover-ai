'use client'

import React, { useState } from 'react'
import { AcmeMerchantPortal } from './AcmeMerchantPortal'

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
    <div className="w-full min-h-screen bg-[#080705] flex flex-col font-sans text-xs">
      {/* Ecosystem Control Bar */}
      <div className="bg-[#0d0d0d] border-b border-[#2e271c] py-2.5 px-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-[#e5a944]/20 border border-[#e5a944]/50 text-[#e5a944] font-mono font-bold text-[11px]">
            ⚡ DUAL-SANDBOX LIVE PAYMENT ECOSYSTEM
          </span>
          <span className="text-[#7a7164] hidden md:inline">
            Demonstrating End-to-End B2B Failure & Recovery in Razorpay Test Mode
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#7a7164] text-[11px]">View Mode:</span>
          <div className="bg-[#15120c] border border-[#2e271c] rounded-lg p-0.5 flex gap-1">
            <button
              onClick={() => setActiveLayout('split')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                activeLayout === 'split'
                  ? 'bg-[#e5a944] text-[#080705]'
                  : 'text-[#a89f91] hover:text-white'
              }`}
            >
              ◫ Side-by-Side (Split)
            </button>
            <button
              onClick={() => setActiveLayout('store-only')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                activeLayout === 'store-only'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-[#a89f91] hover:text-white'
              }`}
            >
              🏢 Website A (Acme Store)
            </button>
            <button
              onClick={() => setActiveLayout('recovery-only')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                activeLayout === 'recovery-only'
                  ? 'bg-[#10b981] text-[#080705]'
                  : 'text-[#a89f91] hover:text-white'
              }`}
            >
              🛡️ Website B (RazorRecover AI)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Pane: Website A (Acme Cloud) */}
        {(activeLayout === 'split' || activeLayout === 'store-only') && (
          <div
            className={`border-b lg:border-b-0 lg:border-r border-[#2e271c] overflow-y-auto max-h-[calc(100vh-45px)] ${
              activeLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <AcmeMerchantPortal
              onNavigateToRazorRecover={handleNavigateToRazorRecover}
              isDualView={activeLayout === 'split'}
            />
          </div>
        )}

        {/* Right Pane: Website B (RazorRecover AI Cockpit) */}
        {(activeLayout === 'split' || activeLayout === 'recovery-only') && (
          <div
            className={`overflow-y-auto max-h-[calc(100vh-45px)] bg-[#080705] ${
              activeLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <div className="p-2 bg-[#120f0a] border-b border-[#2e271c] text-[#e5a944] font-mono text-[11px] flex justify-between items-center px-4">
              <span>🛡️ WEBSITE B: RAZORRECOVER AI LIVE COCKPIT</span>
              <span className="text-[#10b981] text-[10px]">● REAL-TIME SYNCHRONIZATION ACTIVE</span>
            </div>
            {renderRazorRecover(recoveryTargetTab, targetTxnId)}
          </div>
        )}
      </div>
    </div>
  )
}
