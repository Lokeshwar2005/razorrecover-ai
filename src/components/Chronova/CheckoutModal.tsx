'use client'

import React, { useState } from 'react'
import type { CartItem, ShippingAddress, AppliedCoupon } from './types'
import { useTransactionStore, type CanonicalTransaction } from '../../services/canonicalTransactionStore'
import { AVAILABLE_COUPONS } from './CartDrawer'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onClearCart: () => void
  appliedCoupon?: AppliedCoupon | null
  onApplyCoupon?: (coupon: AppliedCoupon | null) => void
}

type CheckoutStep = 'delivery' | 'payment' | 'success' | 'failure'

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onClearCart,
  appliedCoupon,
  onApplyCoupon,
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

  const [inputCoupon, setInputCoupon] = useState('')
  const [couponError, setCouponError] = useState('')
  const [localCoupon, setLocalCoupon] = useState<AppliedCoupon | null>(appliedCoupon || null)

  const activeCoupon = appliedCoupon !== undefined ? appliedCoupon : localCoupon

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
  
  let discountAmount = 0
  if (activeCoupon) {
    if (activeCoupon.discountPercent) {
      discountAmount = Math.round((subtotal * activeCoupon.discountPercent) / 100)
    } else if (activeCoupon.flatDiscount) {
      discountAmount = Math.min(subtotal, activeCoupon.flatDiscount)
    }
  }
  const totalDue = Math.max(0, subtotal - discountAmount)
  const totalMinor = totalDue * 100

  const handleApplyCoupon = (code: string) => {
    const found = AVAILABLE_COUPONS.find((c) => c.code.toUpperCase() === code.trim().toUpperCase())
    if (found) {
      const couponObj: AppliedCoupon = {
        code: found.code,
        discountPercent: found.discountPercent,
        flatDiscount: found.flatDiscount,
        description: found.description,
      }
      setLocalCoupon(couponObj)
      onApplyCoupon?.(couponObj)
      setCouponError('')
      setInputCoupon('')
    } else {
      setCouponError('Invalid coupon code. Try CHRONOVA10 or WELCOME500')
    }
  }

  const handleRemoveCoupon = () => {
    setLocalCoupon(null)
    onApplyCoupon?.(null)
    setCouponError('')
  }

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
          confidence: 0.94,
          recovery_probability: 0.88,
          risk_score: 0.15,
          policy: 'Approved',
          explanation: `Captured failed Razorpay Test Mode payment (${reason}) for order ${mockOrderId}`,
          latency: '240ms',
          created_at: new Date().toISOString(),
          provider: 'razorpay',
          provider_order_id: mockOrderId,
          verified_amount_minor: 0,
        }

        useTransactionStore.getState().ingestTransaction(failedTxn)
        setStep('failure')
      }, 700)
      return
    }

    // Real Razorpay Test Mode Checkout via window.Razorpay
    try {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: 'rzp_test_mock_chronova_key',
          amount: totalMinor,
          currency: 'INR',
          name: 'Chronova Luxury Watches',
          description: `Order for ${items.length} Timepiece(s) - ${items[0]?.product.name}`,
          image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=128&auto=format&fit=crop&q=80',
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
            const paymentId = response.razorpay_payment_id || `pay_test_${Date.now().toString(36)}`
            setOrderReceipt({
              orderId: mockOrderId,
              paymentId: paymentId,
              amount: totalDue,
              date: new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })

            // Ingest SUCCESSFUL payment into transaction store
            const successTxn: CanonicalTransaction = {
              id: generatedTxnId,
              merchant_id: 'mer_chronova_watches',
              amount: totalDue,
              amount_minor: totalMinor,
              currency: 'INR',
              source: 'razorpay_test',
              status: 'RECOVERED',
              direction: 'Direct settlement',
              reason: 'Payment successful on first attempt',
              action: 'Direct settlement',
              confidence: 0.99,
              recovery_probability: 1.0,
              risk_score: 0.05,
              policy: 'Approved',
              explanation: `Customer successfully authorized ${formatINR(totalDue)} via Razorpay Test Mode`,
              latency: '180ms',
              created_at: new Date().toISOString(),
              provider: 'razorpay',
              provider_payment_id: paymentId,
              provider_order_id: mockOrderId,
              verified_amount_minor: totalMinor,
              captured_at: new Date().toISOString(),
            }
            useTransactionStore.getState().ingestTransaction(successTxn)
            onClearCart()
            setStep('success')
          },
          modal: {
            ondismiss: function () {
              setPaymentLoading(false)
              setErrorMessage('Payment cancelled by user. You can retry anytime.')
            },
          },
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.open()
      } else {
        // Fallback simulate instant success for sandbox
        setTimeout(() => {
          setPaymentLoading(false)
          const paymentId = `pay_test_${Date.now().toString(36)}`
          setOrderReceipt({
            orderId: mockOrderId,
            paymentId: paymentId,
            amount: totalDue,
            date: new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          })
          onClearCart()
          setStep('success')
        }, 1000)
      }
    } catch (err: any) {
      setPaymentLoading(false)
      setErrorMessage(err.message || 'Unable to open Razorpay payment checkout.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 text-left">
        {/* Modal Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-sm">
              ⧖
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                CHRONOVA SECURE CHECKOUT
              </h2>
              <span className="text-[11px] font-bold text-emerald-700 uppercase font-mono">
                🔒 Razorpay 256-Bit SSL Encrypted
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: DELIVERY ADDRESS */}
          {step === 'delivery' && (
            <form onSubmit={handleProceedToPayment} className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                  1. Shipping & Contact Information
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Enter your address for insured doorstep courier delivery and real-time SMS tracking updates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={address.full_name}
                    onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                    placeholder="Lokeshwar Sudam"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Address (for Invoice) *</label>
                  <input
                    type="email"
                    required
                    value={address.email}
                    onChange={(e) => setAddress({ ...address, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                    placeholder="lokeshwar@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mobile Phone (for Delivery SMS) *</label>
                  <input
                    type="tel"
                    required
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Flat / House No. / Building *</label>
                  <input
                    type="text"
                    required
                    value={address.address_line1}
                    onChange={(e) => setAddress({ ...address, address_line1: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                    placeholder="42, Brigade Metropolis, Whitefield"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Street / Area / Landmark</label>
                  <input
                    type="text"
                    value={address.address_line2}
                    onChange={(e) => setAddress({ ...address, address_line2: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                    placeholder="Near ITPL Main Road"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">City *</label>
                  <input
                    type="text"
                    required
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">PIN Code *</label>
                  <input
                    type="text"
                    required
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                    placeholder="560048"
                  />
                </div>
              </div>

              {/* Order Summary & Coupon Engine inside Checkout */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-900">
                  <span>Order Items ({items.length})</span>
                  <span>{formatINR(subtotal)}</span>
                </div>

                {/* Coupon Code Section */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase text-slate-800">
                    <span>🎟️ Coupon Code:</span>
                    {activeCoupon && (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {activeCoupon ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black bg-emerald-200 px-2 py-0.5 rounded text-emerald-800">
                          {activeCoupon.code}
                        </span>
                        <span className="font-bold">
                          {activeCoupon.discountPercent ? `${activeCoupon.discountPercent}% Discount Applied` : `₹${activeCoupon.flatDiscount} Discount Applied`}
                        </span>
                      </div>
                      <span className="font-black text-emerald-700">-{formatINR(discountAmount)}</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputCoupon}
                          onChange={(e) => setInputCoupon(e.target.value)}
                          placeholder="Enter coupon (e.g. CHRONOVA10)"
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (inputCoupon) handleApplyCoupon(inputCoupon)
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                          style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                        >
                          Apply
                        </button>
                      </div>
                      {couponError && (
                        <div className="text-[11px] font-semibold text-rose-600">{couponError}</div>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {AVAILABLE_COUPONS.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleApplyCoupon(c.code)}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
                          >
                            🏷️ {c.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs pt-2 border-t border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatINR(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Coupon Savings:</span>
                      <span>-{formatINR(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Insured Delivery:</span>
                    <span className="text-emerald-700 font-black">FREE</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                    <span>Total Amount Payable:</span>
                    <span className="text-blue-700 text-base">{formatINR(totalDue)}</span>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  ⚠️ {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-sm uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
                style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
              >
                <span>PROCEED TO PAYMENT ({formatINR(totalDue)})</span>
                <span>→</span>
              </button>
            </form>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION (RAZORPAY TEST MODE) */}
          {step === 'payment' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                    2. Select Payment Mode
                  </h3>
                  <button
                    onClick={() => setStep('delivery')}
                    className="text-xs text-blue-700 hover:underline font-bold cursor-pointer"
                  >
                    ← Edit Address
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Deliver to: <strong className="text-slate-900">{address.full_name}</strong>, {address.address_line1}, {address.city} ({address.pincode})
                </p>
              </div>

              {/* Amount Due Card */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-md">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono">
                    Total Amount Due
                  </span>
                  <div className="text-2xl font-black">{formatINR(totalDue)}</div>
                  {discountAmount > 0 && (
                    <span className="text-xs text-emerald-400 font-bold">
                      ✓ Includes {formatINR(discountAmount)} Coupon Savings ({activeCoupon?.code})
                    </span>
                  )}
                </div>
                <div className="text-right text-xs text-slate-300 font-mono">
                  <div>Insured Delivery: FREE</div>
                  <div>Taxes: Included</div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* Payment Actions */}
              <div className="space-y-3">
                {/* 1. Official Razorpay Test Mode Checkout */}
                <button
                  disabled={paymentLoading}
                  onClick={() => handleRazorpayTestPay('success')}
                  className="w-full py-4 px-5 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black text-sm uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-between disabled:opacity-50"
                  style={{ color: "#ffffff", backgroundColor: "#1d4ed8" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💳</span>
                    <div className="text-left">
                      <div className="leading-tight">PAY VIA RAZORPAY TEST GATEWAY</div>
                      <div className="text-[10px] font-normal text-blue-200">
                        UPI · Credit/Debit Cards · NetBanking · Wallets
                      </div>
                    </div>
                  </div>
                  <span>{paymentLoading ? 'Connecting...' : 'Pay ' + formatINR(totalDue) + ' →'}</span>
                </button>

                {/* 2. Simulation Failure Buttons for RazorRecover AI Testing */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    🧪 RazorRecover AI Test Scenarios (Simulate Payment Drops):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      disabled={paymentLoading}
                      onClick={() => handleRazorpayTestPay('timeout')}
                      className="py-3 px-3.5 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider transition cursor-pointer text-left flex items-center justify-between disabled:opacity-50 shadow-xs"
                    >
                      <div>
                        <div>SIMULATE 3DS TIMEOUT</div>
                        <div className="text-[10px] font-medium text-amber-700">Bank Switch Failure</div>
                      </div>
                      <span className="text-base">⏳</span>
                    </button>

                    <button
                      disabled={paymentLoading}
                      onClick={() => handleRazorpayTestPay('low_balance')}
                      className="py-3 px-3.5 rounded-xl border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-black uppercase tracking-wider transition cursor-pointer text-left flex items-center justify-between disabled:opacity-50 shadow-xs"
                    >
                      <div>
                        <div>SIMULATE INSUFFICIENT FUNDS</div>
                        <div className="text-[10px] font-medium text-rose-700">Card Limit Exceeded</div>
                      </div>
                      <span className="text-base">⚠️</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'success' && orderReceipt && (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 text-3xl flex items-center justify-center mx-auto shadow-md">
                ✓
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  CONGRATULATIONS! ORDER CONFIRMED
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                  Your luxury timepiece order has been successfully placed. We have sent the confirmation & invoice to <strong className="text-slate-900">{address.email}</strong>.
                </p>
              </div>

              {/* Receipt Summary Box */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Order Reference:</span>
                  <span className="font-mono font-bold text-slate-900">{orderReceipt.orderId}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Razorpay Payment ID:</span>
                  <span className="font-mono font-bold text-blue-700">{orderReceipt.paymentId}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Date & Time:</span>
                  <span className="font-semibold text-slate-900">{orderReceipt.date}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Address:</span>
                  <span className="font-semibold text-slate-900">{address.city}, {address.pincode}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Amount Paid:</span>
                  <span className="text-emerald-700 font-black">{formatINR(orderReceipt.amount)}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
              >
                Continue Shopping
              </button>
            </div>
          )}

          {/* STEP 4: FAILURE DEMO (RAZORRECOVER INTEGRATION) */}
          {step === 'failure' && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 text-3xl flex items-center justify-center mx-auto shadow-md">
                ✕
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  PAYMENT COULD NOT BE COMPLETED
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                  Your bank issuer encountered a temporary degradation. Don't worry, your cart items are reserved for 30 minutes.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 max-w-md mx-auto text-left space-y-2 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚡ RazorRecover AI Autonomous Recovery Active:</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  The payment failure event was ingested by RazorRecover AI. An instant one-click payment link has been dispatched to {address.phone}.
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setStep('payment')}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                  style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                >
                  Retry Payment Now
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Close & Return
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
