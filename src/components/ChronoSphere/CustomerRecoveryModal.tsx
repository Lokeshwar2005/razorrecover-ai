'use client'

import React, { useState } from 'react'
import {
  useTransactionStore,
  type CanonicalTransaction,
} from '../../services/canonicalTransactionStore'
import {
  executeRecoveryAction,
  launchRazorpayCheckout,
  unlockPageScroll,
} from '../../services/backendApi'

interface CustomerRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: string
  onNavigateToRazorRecover?: (tab?: string, txnId?: string) => void
}

export const CustomerRecoveryModal: React.FC<CustomerRecoveryModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  onNavigateToRazorRecover,
}) => {
  if (!isOpen) return null

  const [settling, setSettling] = useState(false)
  const [settledSuccess, setSettledSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const transactions = useTransactionStore((s) => s.transactions)
  const verifyPayment = useTransactionStore((s) => s.verifyPayment)
  const refreshProviderFeed = useTransactionStore((s) => s.refreshProviderFeed)

  const targetTxn = transactions.find((t) => t.id === transactionId) || transactions.find((t) => t.status === 'STOPPED' || t.status === 'PENDING')

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const handleSettleRecoveryPayment = async () => {
    if (!targetTxn) return
    setSettling(true)
    setErrorMessage(null)
    unlockPageScroll()

    try {
      // 1. Create retry order via Vercel backend
      const orderRes = await executeRecoveryAction({
        action_type: 'Retry payment',
        transaction_id: targetTxn.id,
        amount_minor: targetTxn.amount_minor,
        currency: targetTxn.currency || 'INR',
        recovery_operation_id: targetTxn.recovery_operation_id,
      })

      const orderId = orderRes.order_id || `order_rec_${Date.now().toString(36)}`

      // 2. Launch Razorpay Test Mode checkout
      launchRazorpayCheckout({
        order_id: orderId,
        amount_minor: targetTxn.amount_minor,
        currency: targetTxn.currency || 'INR',
        description: `ChronoSphere Recovery Settlement — ${targetTxn.id}`,
        onSuccess: async (resp) => {
          setSettling(false)
          setSettledSuccess(resp.razorpay_payment_id)

          // 3. Cryptographically verify in canonical ledger
          await verifyPayment(
            targetTxn.id,
            resp.razorpay_payment_id,
            targetTxn.amount_minor,
            targetTxn.currency || 'INR',
            resp.razorpay_order_id || orderId,
            resp.razorpay_signature
          )
          refreshProviderFeed()
          unlockPageScroll()
        },
        onFailure: (err) => {
          setSettling(false)
          setErrorMessage(err?.description || err?.message || 'Settlement failed')
          unlockPageScroll()
        },
      })
    } catch (e: any) {
      setSettling(false)
      setErrorMessage(e?.message || 'Failed to initialize settlement')
      unlockPageScroll()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#090e1a] border border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#e2e8f0]">
        {/* Header */}
        <div className="p-5 bg-[#040711] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📬</span>
            <div>
              <h2 className="text-base font-extrabold text-white">ChronoSphere Recovery Portal</h2>
              <p className="text-[11px] text-[#94a3b8] font-mono">Invoice Settlement & VIP Re-engagement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e293b] text-[#94a3b8] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {settledSuccess ? (
            <div className="p-6 rounded-2xl bg-[#064e3b]/30 border border-[#10b981] space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/20 text-[#34d399] text-xl flex items-center justify-center mx-auto border border-[#10b981]/40">
                ✓
              </div>
              <h3 className="text-base font-bold text-white">Recovery Payment Captured & Verified</h3>
              <p className="text-xs text-[#94a3b8]">
                Your payment for invoice <strong className="text-white font-mono">{targetTxn?.id}</strong> has been successfully captured through Razorpay Test Mode and verified in RazorRecover AI.
              </p>
              <div className="p-3 rounded-xl bg-[#040711] border border-[#1e293b] font-mono text-xs text-left text-[#cbd5e1] space-y-1">
                <div>Payment ID: <span className="text-[#34d399]">{settledSuccess}</span></div>
                <div>Recovered Amount: <span className="text-[#38bdf8]">{formatINR(targetTxn?.amount || 0)}</span></div>
                <div>Status: <span className="text-[#10b981] font-bold">RECOVERED</span></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer"
                >
                  Close
                </button>
                {onNavigateToRazorRecover && (
                  <button
                    onClick={() => {
                      onClose()
                      onNavigateToRazorRecover('Transactions', targetTxn?.id)
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-bold text-xs transition cursor-pointer"
                  >
                    View in RazorRecover AI →
                  </button>
                )}
              </div>
            </div>
          ) : targetTxn ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Outstanding Invoice:</span>
                  <span className="text-white font-mono font-bold">{targetTxn.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Outstanding Amount:</span>
                  <span className="text-[#38bdf8] font-bold text-sm">{formatINR(targetTxn.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Reason for Interruption:</span>
                  <span className="text-[#fca5a5] font-mono">{targetTxn.reason}</span>
                </div>
                {targetTxn.recovery_operation_id && (
                  <div className="flex justify-between pt-2 border-t border-[#1e293b]">
                    <span className="text-[#94a3b8]">Recovery Operation ID:</span>
                    <span className="text-[#34d399] font-mono">{targetTxn.recovery_operation_id}</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#0f1d40] border border-[#38bdf8]/40 text-xs space-y-1.5">
                <div className="text-[#38bdf8] font-bold flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>AI Smart Recovery Action Ready</span>
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  RazorRecover AI generated a bounded, safe retry checkout link with pre-approved merchant terms.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-[#7f1d1d]/30 border border-[#ef4444] text-[#fca5a5] text-xs font-mono">
                  ⚠️ {errorMessage}
                </div>
              )}

              <button
                onClick={handleSettleRecoveryPayment}
                disabled={settling}
                className="w-full py-4 px-4 bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#34d399] hover:to-[#10b981] text-[#064e3b] font-extrabold text-sm rounded-2xl transition cursor-pointer shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 font-mono disabled:opacity-50"
              >
                {settling ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin"></span>
                    <span>Opening Razorpay Test Checkout...</span>
                  </>
                ) : (
                  <>
                    <span>💳 Complete Recovery Pay with Razorpay Test Mode ({formatINR(targetTxn.amount)})</span>
                    <span>▶</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="py-8 text-center text-[#64748b] text-xs">
              No outstanding payment recovery invoice found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
