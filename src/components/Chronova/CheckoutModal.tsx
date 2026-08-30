'use client'

import React, { useState } from 'react'
import type { CartItem, ShippingAddress } from './types'
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
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderSuccess,
}) => {
  if (!isOpen) return null

  const [currentStep, setCurrentStep] = useState<'delivery' | 'payment' | 'confirmation' | 'failure'>('delivery')
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
    () => `TXN-CN-${Date.now().toString(36).toUpperCase().slice(-6)}`
  )
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [confirmedPayment, setConfirmedPayment] = useState<{
    paymentId: string
    orderId: string
    amount: number
  } | null>(null)
  const [failureDetail, setFailureDetail] = useState<{
    code: string
    customerMessage: string
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

  // Real Razorpay Test Mode Checkout
  const handleLaunchRazorpayPayment = async () => {
    setOrderProcessing(true)
    setFailureDetail(null)
    unlockPageScroll()

    const txnId = activeTxnId

    try {
      // 1. Create order on serverless backend
      const orderRes = await executeRecoveryAction({
        action_type: 'Retry payment',
        transaction_id: txnId,
        amount_minor: totalAmountMinor,
        currency: 'INR',
      })

      const orderId = orderRes.order_id || `order_cn_${Date.now().toString(36)}`
      setActiveOrderId(orderId)

      // 2. Ingest transaction in store as PENDING
      const pendingTxn: CanonicalTransaction = {
        id: txnId,
        merchant_id: 'mer_chronova_watches',
        amount: totalAmountRupees,
        amount_minor: totalAmountMinor,
        currency: 'INR',
        source: 'razorpay_test',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason: 'Customer initiated Chronova Checkout',
        action: 'Retry payment',
        confidence: 92,
        recovery_probability: 78,
        risk_score: 30,
        policy: 'Approved',
        explanation: `Customer ${address.full_name} (${address.email}) checking out ${productSummary}.`,
        latency: '260ms',
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
        name: 'CHRONOVA Watches',
        description: `Order ${txnId} · ${items[0]?.product.name || 'Watch'}`,
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

          // Cryptographic verification in canonical store
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
          const rawReason = err?.description || err?.message || 'Payment authentication interrupted by issuer bank'
          setFailureDetail({
            code: err?.code || 'GATEWAY_DECLINE',
            customerMessage: 'Payment could not be completed. Your order has been saved securely.',
            txnId,
          })
          setCurrentStep('failure')

          // Ingest stopped failure transaction into RazorRecover store (Server-side bridge)
          const failedTxn: CanonicalTransaction = {
            ...pendingTxn,
            status: 'STOPPED',
            direction: 'Payment degradation',
            reason: rawReason,
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
        customerMessage: 'Payment service temporarily unavailable. Please try again or choose another method.',
        txnId,
      })
      setCurrentStep('failure')
      unlockPageScroll()
    }
  }

  // Simulated Test Scenarios for Hackathon Evaluation
  const handleSimulateScenario = (scenarioType: 'insufficient_funds' | '3ds_timeout' | 'card_declined' | 'abandoned') => {
    const txnId = activeTxnId
    let rawReason = ''
    let code = ''

    if (scenarioType === 'insufficient_funds') {
      code = 'INSUFFICIENT_FUNDS'
      rawReason = 'Insufficient Account Balance (Error: BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE)'
    } else if (scenarioType === '3ds_timeout') {
      code = '3DS_TIMEOUT'
      rawReason = '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)'
    } else if (scenarioType === 'card_declined') {
      code = 'CARD_DECLINED'
      rawReason = 'Card Transaction Limit Exceeded / International Security Decline'
    } else {
      code = 'CHECKOUT_ABANDONED'
      rawReason = 'Checkout Abandoned (Customer closed modal before 3DS authorization)'
    }

    setFailureDetail({
      code,
      customerMessage: 'Payment could not be completed. Don’t worry — your order has not been lost.',
      txnId,
    })
    setCurrentStep('failure')

    // Ingest failure into backend canonical store
    const failedTxn: CanonicalTransaction = {
      id: txnId,
      merchant_id: 'mer_chronova_watches',
      amount: totalAmountRupees,
      amount_minor: totalAmountMinor,
      currency: 'INR',
      source: 'razorpay_test',
      status: scenarioType === 'abandoned' ? 'PENDING' : 'STOPPED',
      direction: scenarioType === 'abandoned' ? 'Checkout drop-off' : 'Payment degradation',
      reason: rawReason,
      action: 'Send payment link',
      confidence: 94,
      recovery_probability: 82,
      risk_score: 25,
      policy: 'Approved',
      explanation: `Chronova payment interruption: ${rawReason} on ${productSummary}.`,
      latency: '290ms',
      created_at: new Date().toISOString(),
      provider: 'razorpay',
      provider_status: 'failed',
      verified_amount_minor: 0,
    }
    ingestTransaction(failedTxn)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#090e1a] border border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#e2e8f0]">
        {/* Header */}
        <div className="p-5 bg-[#040711] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💳</span>
            <div>
              <h2 className="text-base font-extrabold text-white">Chronova Secure Checkout</h2>
              <p className="text-[11px] text-[#94a3b8] font-mono">Order Reference: {activeTxnId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e293b] text-[#94a3b8] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 3-Stage Progress Indicator */}
        <div className="px-6 py-3 bg-[#0b132b] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-1.5 ${currentStep === 'delivery' ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
            <span>01 DELIVERY</span>
          </div>
          <span className="text-[#334155]">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'payment' ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
            <span>02 PAYMENT</span>
          </div>
          <span className="text-[#334155]">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'confirmation' ? 'text-[#34d399] font-bold' : currentStep === 'failure' ? 'text-[#ef4444] font-bold' : 'text-[#64748b]'}`}>
            <span>03 CONFIRMATION</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* STAGE 1: DELIVERY ADDRESS */}
          {currentStep === 'delivery' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Shipping & Contact Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Recipient Full Name</label>
                  <input
                    type="text"
                    value={address.full_name}
                    onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Billing Email (for Invoice)</label>
                  <input
                    type="email"
                    value={address.email}
                    onChange={(e) => setAddress({ ...address, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] mb-1 font-medium">Mobile Phone (for Delivery SMS)</label>
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
                  <label className="block text-[#94a3b8] mb-1 font-medium">Street Address / Apartment</label>
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

              {/* Summary */}
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] text-xs space-y-2">
                <div className="flex justify-between text-[#94a3b8]">
                  <span>Items:</span>
                  <span className="text-white font-semibold">{items.reduce((s, i) => s + i.quantity, 0)} Timepieces</span>
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
                <span>Continue to Payment</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* STAGE 2: PAYMENT WITH RAZORPAY TEST MODE */}
          {currentStep === 'payment' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Delivering To:</span>
                  <span className="text-white font-semibold">{address.full_name} ({address.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Total Order Amount:</span>
                  <span className="text-[#38bdf8] font-bold text-sm">{formatINR(totalAmountRupees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Payment Method:</span>
                  <span className="text-[#34d399] font-mono font-bold">Razorpay Test Mode (Simulated Funds)</span>
                </div>
              </div>

              {/* Main Pay with Razorpay Button */}
              <button
                onClick={handleLaunchRazorpayPayment}
                disabled={orderProcessing}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-sm transition shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-mono"
              >
                {orderProcessing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Opening Razorpay Test Checkout...</span>
                  </>
                ) : (
                  <>
                    <span>💳 Complete Pay with Razorpay ({formatINR(totalAmountRupees)})</span>
                    <span>▶</span>
                  </>
                )}
              </button>

              {/* Test Simulation Controls */}
              <div className="p-4 rounded-2xl bg-[#060b19] border border-[#334155] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Test Gateway Simulation Modes</span>
                  </span>
                  <span className="text-[10px] text-[#94a3b8] font-mono">Simulate card & bank responses</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleSimulateScenario('insufficient_funds')}
                    className="p-2.5 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-[#fca5a5] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">🔴</div>
                    <div>Low Balance</div>
                  </button>

                  <button
                    onClick={() => handleSimulateScenario('3ds_timeout')}
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
                    onClick={() => handleSimulateScenario('abandoned')}
                    className="p-2.5 rounded-xl bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 border border-[#f59e0b]/40 text-[#fde68a] text-xs font-bold transition cursor-pointer text-left"
                  >
                    <div className="text-sm mb-0.5">🟡</div>
                    <div>Drop-off</div>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('delivery')}
                className="w-full py-2 text-xs text-[#94a3b8] hover:text-white font-medium transition cursor-pointer"
              >
                ← Back to Delivery Address
              </button>
            </div>
          )}

          {/* STAGE 3: ORDER SUCCESS CONFIRMATION */}
          {currentStep === 'confirmation' && confirmedPayment && (
            <div className="p-6 rounded-2xl bg-[#064e3b]/30 border border-[#10b981] space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#10b981]/20 text-[#34d399] text-2xl flex items-center justify-center mx-auto border border-[#10b981]/40">
                ✓
              </div>
              <h3 className="text-lg font-black text-white">Order Placed Successfully!</h3>
              <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
                Thank you for shopping with Chronova. Your order is confirmed and will be dispatched within 24 hours.
              </p>

              <div className="p-4 rounded-xl bg-[#040711] border border-[#1e293b] font-mono text-xs text-left space-y-1.5 text-[#cbd5e1]">
                <div>Order Reference: <strong className="text-white">{activeTxnId}</strong></div>
                <div>Payment ID: <strong className="text-[#34d399]">{confirmedPayment.paymentId}</strong></div>
                <div>Amount Paid: <strong className="text-[#38bdf8]">{formatINR(confirmedPayment.amount)}</strong></div>
                <div>Estimated Delivery: <span className="text-[#34d399] font-bold">2 Business Days</span></div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-bold text-xs transition cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3B: PAYMENT FAILURE SCREEN (CONSUMER FRIENDLY) */}
          {currentStep === 'failure' && failureDetail && (
            <div className="p-6 rounded-2xl bg-[#7f1d1d]/30 border border-[#ef4444] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#ef4444]/20 text-[#ef4444] text-xl flex items-center justify-center shrink-0 border border-[#ef4444]/40">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Payment could not be completed</h3>
                  <div className="text-xs text-[#fca5a5] font-mono mt-0.5">Reference: {failureDetail.txnId}</div>
                </div>
              </div>

              <p className="text-xs text-[#cbd5e1] leading-relaxed">
                Don’t worry — your order has not been lost. A secure retry checkout link has been generated and dispatched to your email (<strong>{address.email}</strong>).
              </p>

              <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1e293b] space-y-1.5 text-xs text-[#94a3b8]">
                <div className="text-white font-semibold">Suggested Next Steps:</div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>Retry with another card, UPI, or Net Banking option.</li>
                  <li>Ensure sufficient credit limit or authorization on your banking app.</li>
                  <li>Use the 1-click retry link sent to your registered phone or email.</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('payment')}
                  className="flex-1 py-3 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Retry Payment Now
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer"
                >
                  Keep in Bag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
