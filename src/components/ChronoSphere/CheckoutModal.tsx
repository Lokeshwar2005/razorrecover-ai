'use client'

import React, { useState } from 'react'
import type { CartItem, ShippingAddress, FailureScenario } from './types'
import {
  useTransactionStore,
  type CanonicalTransaction,
} from '../../services/canonicalTransactionStore'
import {
  executeRecoveryAction,
  launchRazorpayCheckout,
  unlockPageScroll,
} from '../../services/backendApi'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onOrderSuccess: (orderId: string, paymentId: string) => void
  onNavigateToRazorRecover?: (tab?: string, txnId?: string) => void
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderSuccess,
  onNavigateToRazorRecover,
}) => {
  if (!isOpen) return null

  const [currentStep, setCurrentStep] = useState<'shipping' | 'payment' | 'confirmation' | 'failure'>('shipping')
  const [address, setAddress] = useState<ShippingAddress>({
    full_name: 'Rajeshwari Iyer',
    email: 'rajeshwari.iyer@fintech.in',
    phone: '+91 98765 43210',
    address_line1: 'Penthouse 14B, Altamount Heights',
    address_line2: 'Altamount Road, Cumballa Hill',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400026',
  })

  const [orderProcessing, setOrderProcessing] = useState(false)
  const [activeTxnId, setActiveTxnId] = useState<string>(
    () => `TXN-CS-${Date.now().toString(36).toUpperCase().slice(-6)}`
  )
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [confirmedPayment, setConfirmedPayment] = useState<{
    paymentId: string
    orderId: string
    amount: number
  } | null>(null)
  const [failureDetail, setFailureDetail] = useState<{
    code: string
    reason: string
    txnId: string
  } | null>(null)

  const ingestTransaction = useTransactionStore((s) => s.ingestTransaction)
  const verifyPayment = useTransactionStore((s) => s.verifyPayment)
  const refreshProviderFeed = useTransactionStore((s) => s.refreshProviderFeed)

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const subtotal = items.reduce((acc, item) => acc + item.product.price_rupees * item.quantity, 0)
  const totalAmountRupees = subtotal
  const totalAmountMinor = totalAmountRupees * 100
  const productSummary = items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')

  // Launch Real Razorpay Test Mode Checkout
  const handleLaunchRazorpayPayment = async () => {
    setOrderProcessing(true)
    setFailureDetail(null)
    unlockPageScroll()

    const txnId = activeTxnId

    try {
      // 1. Create real test order through Vercel serverless backend
      const orderRes = await executeRecoveryAction({
        action_type: 'Retry payment',
        transaction_id: txnId,
        amount_minor: totalAmountMinor,
        currency: 'INR',
      })

      const orderId = orderRes.order_id || `order_cs_${Date.now().toString(36)}`
      setActiveOrderId(orderId)

      // 2. Ingest transaction in store as PENDING
      const pendingTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronosphere_luxury',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'live',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason: 'Customer initiated ChronoSphere Luxury Checkout',
        action: 'Retry payment',
        confidence: 92,
        recovery_probability: 78,
        risk_score: 30,
        policy: 'Approved',
        explanation: `Customer ${address.full_name} (${address.email}) checking out ${productSummary}.`,
        latency: '280ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_order_id: orderId,
        provider_status: 'created',
        verified_amount_minor: 0,
      }
      ingestTransaction(pendingTxn)

      // 3. Open Razorpay Checkout Modal
      launchRazorpayCheckout({
        order_id: orderId,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        description: `ChronoSphere Luxury — ${items[0]?.product.name || 'Timepiece'}`,
        prefill: {
          name: address.full_name,
          email: address.email,
          contact: address.phone,
        },
        onSuccess: async (resp) => {
          setOrderProcessing(false)
          setConfirmedPayment({
            paymentId: resp.razorpay_payment_id,
            orderId: resp.razorpay_order_id || orderId,
            amount: totalAmountRupees,
          })
          setCurrentStep('confirmation')

          // Verify with RazorRecover canonical ledger
          await verifyPayment(
            txnId,
            resp.razorpay_payment_id,
            totalAmountMinor,
            'INR',
            resp.razorpay_order_id || orderId,
            resp.razorpay_signature
          )
          refreshProviderFeed()
          onOrderSuccess(resp.razorpay_order_id || orderId, resp.razorpay_payment_id)
          unlockPageScroll()
        },
        onFailure: (err) => {
          setOrderProcessing(false)
          const reason = err?.description || err?.message || 'Payment cancelled or card decline by issuer bank'
          setFailureDetail({
            code: err?.code || 'GATEWAY_DECLINE',
            reason,
            txnId,
          })
          setCurrentStep('failure')

          // Ingest stopped failure transaction into RazorRecover store
          const failedTxn: CanonicalTransaction = {
            ...pendingTxn,
            status: 'STOPPED',
            direction: 'Payment degradation',
            reason,
            action: 'Send payment link',
            provider_status: 'failed',
            updated_at: new Date().toISOString(),
          }
          ingestTransaction(failedTxn)
          refreshProviderFeed()
          unlockPageScroll()
        },
      })
    } catch (e: any) {
      setOrderProcessing(false)
      setFailureDetail({
        code: 'NETWORK_ERROR',
        reason: e?.message || 'Could not connect to Razorpay test gateway',
        txnId,
      })
      setCurrentStep('failure')
      unlockPageScroll()
    }
  }

  // Trigger Demo Scenarios
  const handleSimulateScenario = (scenario: FailureScenario) => {
    const txnId = activeTxnId
    setFailureDetail(null)

    if (scenario === 'success') {
      const mockPayId = `pay_test_cs_${Date.now().toString(36)}`
      const orderId = activeOrderId || `order_test_${Date.now().toString(36)}`
      setConfirmedPayment({
        paymentId: mockPayId,
        orderId,
        amount: totalAmountRupees,
      })
      setCurrentStep('confirmation')
      verifyPayment(txnId, mockPayId, totalAmountMinor, 'INR', orderId)
      onOrderSuccess(orderId, mockPayId)
    } else if (scenario === 'insufficient_funds') {
      const reason = 'Insufficient Customer Account Balance (Error: BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE)'
      setFailureDetail({ code: 'INSUFFICIENT_FUNDS', reason, txnId })
      setCurrentStep('failure')
      const failedTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronosphere_luxury',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'live',
        status: 'STOPPED',
        direction: 'Payment degradation',
        reason,
        action: 'Send payment link',
        confidence: 96,
        recovery_probability: 88,
        risk_score: 22,
        policy: 'Approved',
        explanation: `ChronoSphere failure: ${address.full_name} account balance shortfall on ${productSummary}. Recommended multi-channel retry link.`,
        latency: '310ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_status: 'failed',
        verified_amount_minor: 0,
      }
      ingestTransaction(failedTxn)
    } else if (scenario === 'gateway_timeout') {
      const reason = '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)'
      setFailureDetail({ code: '3DS_TIMEOUT', reason, txnId })
      setCurrentStep('failure')
      const failedTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronosphere_luxury',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'live',
        status: 'STOPPED',
        direction: 'Payment degradation',
        reason,
        action: 'Retry payment',
        confidence: 95,
        recovery_probability: 85,
        risk_score: 20,
        policy: 'Approved',
        explanation: `ChronoSphere high-value failure: 3DS OTP timeout on ${productSummary} (₹${totalAmountRupees.toLocaleString('en-IN')}).`,
        latency: '420ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_status: 'failed',
        verified_amount_minor: 0,
      }
      ingestTransaction(failedTxn)
    } else if (scenario === 'card_declined') {
      const reason = 'Card Transaction Limit Exceeded / International Security Decline'
      setFailureDetail({ code: 'CARD_DECLINED', reason, txnId })
      setCurrentStep('failure')
      const failedTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronosphere_luxury',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'live',
        status: 'STOPPED',
        direction: 'B2B receivables chaser',
        reason,
        action: 'Send payment link',
        confidence: 89,
        recovery_probability: 72,
        risk_score: 38,
        policy: 'Approved',
        explanation: `ChronoSphere card limit decline for ${address.full_name}. Bounded recovery link generated.`,
        latency: '390ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_status: 'failed',
        verified_amount_minor: 0,
      }
      ingestTransaction(failedTxn)
    } else if (scenario === 'checkout_abandoned') {
      const reason = 'Checkout Abandoned (Customer closed modal before 3DS authorization)'
      setFailureDetail({ code: 'CHECKOUT_ABANDONED', reason, txnId })
      setCurrentStep('failure')
      const abandonedTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronosphere_luxury',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'live',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason,
        action: 'Send payment link',
        confidence: 91,
        recovery_probability: 75,
        risk_score: 28,
        policy: 'Approved',
        explanation: `ChronoSphere cart drop-off for ${address.full_name} (${productSummary}).`,
        latency: '260ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_status: 'created',
        verified_amount_minor: 0,
      }
      ingestTransaction(abandonedTxn)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#090e1a] border border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#e2e8f0]">
        {/* Modal Header */}
        <div className="p-5 bg-[#040711] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💳</span>
            <div>
              <h2 className="text-base font-extrabold text-white">ChronoSphere Luxury Checkout</h2>
              <p className="text-[11px] text-[#94a3b8] font-mono">Invoice Reference: {activeTxnId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e293b] text-[#94a3b8] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Multi-Step Progress Tracker */}
        <div className="px-6 py-3 bg-[#0b132b] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-1.5 ${currentStep === 'shipping' ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
            <span>1. Shipping Details</span>
          </div>
          <span className="text-[#334155]">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'payment' ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
            <span>2. Payment Sandbox</span>
          </div>
          <span className="text-[#334155]">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'confirmation' ? 'text-[#34d399] font-bold' : currentStep === 'failure' ? 'text-[#ef4444] font-bold' : 'text-[#64748b]'}`}>
            <span>3. Order Status</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* STEP 1: SHIPPING DETAILS */}
          {currentStep === 'shipping' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Delivery & Billing Address</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Customer Full Name</label>
                  <input
                    type="text"
                    value={address.full_name}
                    onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Billing Email</label>
                  <input
                    type="email"
                    value={address.email}
                    onChange={(e) => setAddress({ ...address, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Mobile Phone (for OTP)</label>
                  <input
                    type="tel"
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">PIN Code</label>
                  <input
                    type="text"
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#94a3b8] mb-1 font-medium">Street Address</label>
                  <input
                    type="text"
                    value={address.address_line1}
                    onChange={(e) => setAddress({ ...address, address_line1: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">City</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">State</label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              {/* Order Quick Summary */}
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] text-xs space-y-2">
                <div className="flex justify-between text-[#94a3b8]">
                  <span>Items in Order:</span>
                  <span className="text-white font-semibold">{items.reduce((s, i) => s + i.quantity, 0)} Luxury Timepieces</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-[#1e293b]">
                  <span>Total Due:</span>
                  <span className="text-[#38bdf8] text-base">{formatINR(totalAmountRupees)}</span>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('payment')}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <span>Continue to Razorpay Test Payment</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* STEP 2: PAYMENT SANDBOX & DEMO SCENARIO SIMULATOR */}
          {currentStep === 'payment' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Recipient:</span>
                  <span className="text-white font-semibold">{address.full_name} ({address.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Total Amount to Settle:</span>
                  <span className="text-[#38bdf8] font-bold text-sm">{formatINR(totalAmountRupees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Gateway Environment:</span>
                  <span className="text-[#34d399] font-mono font-bold">Razorpay Test Mode (Simulated Funds)</span>
                </div>
              </div>

              {/* Main Real Razorpay Launch Button */}
              <button
                onClick={handleLaunchRazorpayPayment}
                disabled={orderProcessing}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-sm transition shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-mono"
              >
                {orderProcessing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Opening Razorpay Checkout...</span>
                  </>
                ) : (
                  <>
                    <span>💳 Complete Pay with Razorpay Checkout ({formatINR(totalAmountRupees)})</span>
                    <span>▶</span>
                  </>
                )}
              </button>

              {/* Demo Scenario Simulator Bar */}
              <div className="p-4 rounded-2xl bg-[#060b19] border border-[#334155] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Hackathon Demo Scenario Triggers</span>
                  </span>
                  <span className="text-[10px] text-[#94a3b8] font-mono">Simulate exact failure types</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleSimulateScenario('insufficient_funds')}
                    className="p-2.5 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-[#fca5a5] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">🔴</div>
                    <div>Insufficient Funds</div>
                  </button>

                  <button
                    onClick={() => handleSimulateScenario('gateway_timeout')}
                    className="p-2.5 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-[#fca5a5] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">⏱️</div>
                    <div>3DS Timeout</div>
                  </button>

                  <button
                    onClick={() => handleSimulateScenario('card_declined')}
                    className="p-2.5 rounded-xl bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 border border-[#f59e0b]/40 text-[#fde68a] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">🚫</div>
                    <div>Card Decline</div>
                  </button>

                  <button
                    onClick={() => handleSimulateScenario('checkout_abandoned')}
                    className="p-2.5 rounded-xl bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 border border-[#f59e0b]/40 text-[#fde68a] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">🟡</div>
                    <div>Cart Drop-off</div>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('shipping')}
                className="w-full py-2 text-xs text-[#94a3b8] hover:text-white font-medium transition cursor-pointer"
              >
                ← Back to Shipping Details
              </button>
            </div>
          )}

          {/* STEP 3: ORDER SUCCESS CONFIRMATION */}
          {currentStep === 'confirmation' && confirmedPayment && (
            <div className="p-6 rounded-2xl bg-[#064e3b]/30 border border-[#10b981] space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#10b981]/20 text-[#34d399] text-2xl flex items-center justify-center mx-auto border border-[#10b981]/40">
                ✓
              </div>
              <h3 className="text-lg font-black text-white">Payment Confirmed & Verified!</h3>
              <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
                Thank you for your order. Your luxury timepiece is being prepared for express insured dispatch.
              </p>

              <div className="p-4 rounded-xl bg-[#040711] border border-[#1e293b] font-mono text-xs text-left space-y-1.5 text-[#cbd5e1]">
                <div>Invoice Reference: <strong className="text-white">{activeTxnId}</strong></div>
                <div>Payment ID: <strong className="text-[#34d399]">{confirmedPayment.paymentId}</strong></div>
                <div>Amount Captured: <strong className="text-[#38bdf8]">{formatINR(confirmedPayment.amount)}</strong></div>
                <div>Status: <span className="text-[#10b981] font-bold">RECOVERED / VERIFIED</span></div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer"
                >
                  Return to Store
                </button>
                {onNavigateToRazorRecover && (
                  <button
                    onClick={() => {
                      onClose()
                      onNavigateToRazorRecover('Transactions', activeTxnId)
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-bold text-xs transition cursor-pointer"
                  >
                    View in RazorRecover AI →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3B: PAYMENT FAILURE & AI RECOVERY NOTICE */}
          {currentStep === 'failure' && failureDetail && (
            <div className="p-6 rounded-2xl bg-[#7f1d1d]/30 border border-[#ef4444] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#ef4444]/20 text-[#ef4444] text-xl flex items-center justify-center shrink-0 border border-[#ef4444]/40">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Payment Attempt Unsuccessful</h3>
                  <div className="text-xs text-[#fca5a5] font-mono mt-0.5">{failureDetail.code}</div>
                </div>
              </div>

              <p className="text-xs text-[#cbd5e1] leading-relaxed">
                {failureDetail.reason}
              </p>

              {/* Real-time sync callout to RazorRecover AI */}
              <div className="p-4 rounded-xl bg-[#090e1a] border border-[#38bdf8]/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#38bdf8] font-bold">
                  <span>⚡</span>
                  <span>RazorRecover AI Event Ingestion Triggered</span>
                </div>
                <div className="text-[11px] text-[#94a3b8]">
                  Transaction <strong className="text-white font-mono">{failureDetail.txnId}</strong> (₹{totalAmountRupees.toLocaleString('en-IN')}) has been captured by RazorRecover AI for automated root-cause diagnosis, recovery prioritization, and safe recovery link generation.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('payment')}
                  className="flex-1 py-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer"
                >
                  Try Another Payment Method
                </button>
                {onNavigateToRazorRecover && (
                  <button
                    onClick={() => {
                      onClose()
                      onNavigateToRazorRecover('Opportunities', failureDetail.txnId)
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#ef4444] hover:bg-[#f87171] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    Inspect in RazorRecover AI →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
