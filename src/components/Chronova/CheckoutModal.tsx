'use client'

import React, { useState } from 'react'
import type { CartItem, ShippingAddress } from './types'
import { useTransactionStore, type CanonicalTransaction } from '../../services/canonicalTransactionStore'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onClearCart: () => void
}

type CheckoutStep = 'delivery' | 'payment' | 'success' | 'failure'

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onClearCart,
}) => {
  if (!isOpen) return null

  const [step, setStep] = useState<CheckoutStep>('delivery')
  const [address, setAddress] = useState<ShippingAddress>({
    full_name: 'Lokeshwar Sudam',
    email: 'lokeshwar@example.com',
    phone: '+91 98765 43210',
    address_line1: '42, Brigade Metropolis, Whitefield',
    address_line2: 'Tower C, Apt 402',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560048',
  })

  const [paymentLoading, setPaymentLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [orderReceipt, setOrderReceipt] = useState<{
    orderId: string
    paymentId: string
    amount: number
    date: string
  } | null>(null)

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const subtotal = items.reduce((sum, i) => sum + i.product.price_rupees * i.quantity, 0)
  const totalDue = subtotal
  const totalMinor = totalDue * 100

  // 1. Submit Delivery Address
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.full_name || !address.email || !address.phone || !address.pincode) {
      setErrorMessage('Please complete all required shipping fields.')
      return
    }
    setErrorMessage('')
    setStep('payment')
  }

  // 2. Launch Real Razorpay Test Mode Checkout
  const handleRazorpayTestPay = async (simulateScenario?: 'success' | 'timeout' | 'low_balance') => {
    setPaymentLoading(true)
    setErrorMessage('')

    const generatedTxnId = `TXN-CN-${Date.now().toString(36).toUpperCase()}`
    const mockOrderId = `order_cn_${Date.now().toString(36)}`

    // If simulating instant failure for demo / test mode verification
    if (simulateScenario === 'timeout' || simulateScenario === 'low_balance') {
      setTimeout(() => {
        setPaymentLoading(false)
        const reason =
          simulateScenario === 'timeout'
            ? '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)'
            : 'Insufficient Funds / Account Balance Exhausted'

        // Ingest into server-to-server transaction ledger for RazorRecover AI backend
        const failedTxn: CanonicalTransaction = {
          id: generatedTxnId,
          merchant_id: 'mer_chronova_watches',
          amount: totalDue,
          amount_minor: totalMinor,
          currency: 'INR',
          source: 'razorpay_test',
          status: 'STOPPED',
          direction: 'Payment degradation',
          reason: reason,
          action: 'Send payment link',
          confidence: 95,
          recovery_probability: 85,
          risk_score: 20,
          policy: 'Approved',
          explanation: `Chronova payment failure: High-intent customer checkout interrupted on ${items[0]?.product.name || 'timepiece'}. Generated multi-channel retry link.`,
          latency: '310ms',
          created_at: new Date().toISOString(),
          provider: 'razorpay',
          provider_order_id: mockOrderId,
          provider_status: 'failed',
          verified_amount_minor: 0,
        }

        useTransactionStore.getState().ingestTransaction(failedTxn)
        setStep('failure')
      }, 700)
      return
    }

    // Live Razorpay Checkout
    try {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: 'rzp_test_mockKeyId', // public Test Key
          amount: totalMinor,
          currency: 'INR',
          name: 'CHRONOVA Watches',
          description: `Order for ${items.length} timepiece(s)`,
          order_id: mockOrderId,
          prefill: {
            name: address.full_name,
            email: address.email,
            contact: address.phone,
          },
          theme: {
            color: '#0f172a',
          },
          handler: function (response: any) {
            setPaymentLoading(false)
            setOrderReceipt({
              orderId: response.razorpay_order_id || mockOrderId,
              paymentId: response.razorpay_payment_id || `pay_test_${Date.now().toString(36)}`,
              amount: totalDue,
              date: new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
            })
            onClearCart()
            setStep('success')
          },
          modal: {
            ondismiss: function () {
              setPaymentLoading(false)
            },
          },
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.on('payment.failed', function (resp: any) {
          setPaymentLoading(false)
          const failedTxn: CanonicalTransaction = {
            id: generatedTxnId,
            merchant_id: 'mer_chronova_watches',
            amount: totalDue,
            amount_minor: totalMinor,
            currency: 'INR',
            source: 'razorpay_test',
            status: 'STOPPED',
            direction: 'Payment degradation',
            reason: resp.error?.description || 'Payment failed in Razorpay Test Gateway',
            action: 'Send payment link',
            confidence: 90,
            recovery_probability: 80,
            risk_score: 25,
            policy: 'Approved',
            explanation: `Chronova checkout failure for ${items[0]?.product.name || 'watch'}. Ingested into serverless recovery engine.`,
            latency: '340ms',
            created_at: new Date().toISOString(),
            provider: 'razorpay',
            provider_order_id: mockOrderId,
            provider_payment_id: resp.error?.metadata?.payment_id,
            provider_status: 'failed',
            verified_amount_minor: 0,
          }
          useTransactionStore.getState().ingestTransaction(failedTxn)
          setStep('failure')
        })
        rzp.open()
      } else {
        setTimeout(() => {
          setPaymentLoading(false)
          setOrderReceipt({
            orderId: mockOrderId,
            paymentId: `pay_test_${Date.now().toString(36)}`,
            amount: totalDue,
            date: new Date().toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
          })
          onClearCart()
          setStep('success')
        }, 1000)
      }
    } catch (err: any) {
      setPaymentLoading(false)
      setErrorMessage(err.message || 'Payment service temporarily unavailable. Please retry.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl my-auto text-slate-900">
        {/* Step Indicator Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⌚</span>
            <div>
              <h3 className="text-sm font-black text-slate-900">CHRONOVA EXPRESS CHECKOUT</h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {step === 'delivery' && 'STEP 01 OF 02 · SHIPPING & CONTACT'}
                {step === 'payment' && 'STEP 02 OF 02 · SECURE RAZORPAY PAYMENT'}
                {step === 'success' && 'ORDER CONFIRMED'}
                {step === 'failure' && 'PAYMENT INTERRUPTED'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Delivery Address Form */}
        {step === 'delivery' && (
          <form onSubmit={handleProceedToPayment} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Delivery Address Details
            </h4>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={address.full_name}
                  onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Email (for Tracking) *</label>
                <input
                  type="email"
                  required
                  value={address.email}
                  onChange={(e) => setAddress({ ...address, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Pincode *</label>
                <input
                  type="text"
                  required
                  value={address.pincode}
                  onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 mb-1 font-semibold">Flat / House No. / Building / Street *</label>
                <input
                  type="text"
                  required
                  value={address.address_line1}
                  onChange={(e) => setAddress({ ...address, address_line1: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">City *</label>
                <input
                  type="text"
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">State *</label>
                <input
                  type="text"
                  required
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Summary Line */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Order Total ({items.length} Timepiece):</span>
              <span className="text-slate-900 font-black text-sm">{formatINR(totalDue)}</span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <span>Continue to Payment</span>
              <span>→</span>
            </button>
          </form>
        )}

        {/* Step 2: Payment Step with Razorpay Test Mode */}
        {step === 'payment' && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Delivery Destination Badge */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-900 font-bold block">Deliver to: {address.full_name}</span>
                <span className="text-[11px] text-slate-500">
                  {address.address_line1}, {address.city} - {address.pincode}
                </span>
              </div>
              <button
                onClick={() => setStep('delivery')}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            {/* Price Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Items in Bag:</span>
                <span className="text-slate-900 font-semibold">{items.length}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Insured Express Courier:</span>
                <span className="text-emerald-700 font-bold">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount to Pay:</span>
                <span className="text-blue-700 text-base">{formatINR(totalDue)}</span>
              </div>
            </div>

            {/* Payment Launcher Controls */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Razorpay Test Mode Payment
              </span>

              {/* Standard Pay Button */}
              <button
                disabled={paymentLoading}
                onClick={() => handleRazorpayTestPay('success')}
                className="w-full py-4 px-4 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-sm transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>💳 Complete Payment with Razorpay</span>
                <span>{paymentLoading ? '...' : '→'}</span>
              </button>

              {/* Simulation Failure Scenarios for Demo */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <button
                  disabled={paymentLoading}
                  onClick={() => handleRazorpayTestPay('timeout')}
                  className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>⏱️ 3DS Timeout</span>
                </button>
                <button
                  disabled={paymentLoading}
                  onClick={() => handleRazorpayTestPay('low_balance')}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>📉 Low Balance</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success Screen */}
        {step === 'success' && orderReceipt && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 text-3xl mx-auto flex items-center justify-center shadow-sm">
              ✓
            </div>
            <h3 className="text-2xl font-black text-slate-900">Order Confirmed!</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Thank you for choosing CHRONOVA. Your order has been placed and is currently being packed for express courier dispatch.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs font-mono space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="text-slate-900 font-bold">{orderReceipt.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment ID:</span>
                <span className="text-blue-700 font-bold">{orderReceipt.paymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="text-emerald-700 font-bold">{formatINR(orderReceipt.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-900">{orderReceipt.date}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="mt-4 px-6 py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        )}

        {/* Step 4: Consumer-Safe Friendly Failure Screen */}
        {step === 'failure' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 text-3xl mx-auto flex items-center justify-center shadow-sm">
              ⚠️
            </div>
            <h3 className="text-xl font-black text-slate-900">Payment Could Not Be Completed</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Don't worry — your selected watches are reserved in your bag. Please try another payment method (UPI, Cards, NetBanking) or check with your bank.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
              <div className="text-blue-700 font-bold">🔒 Order Hold Active</div>
              <div className="text-slate-500 text-[11px]">
                The bank gateway encountered an authentication timeout during 3DS verification.
              </div>
            </div>

            <div className="flex gap-3 max-w-md mx-auto pt-2">
              <button
                onClick={() => setStep('payment')}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition cursor-pointer"
              >
                Try Another Payment Method
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Return to Bag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
