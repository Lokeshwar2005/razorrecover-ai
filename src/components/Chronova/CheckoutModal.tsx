'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { CartItem, ShippingAddress, AppliedCoupon } from './types'
import { useTransactionStore, type CanonicalTransaction } from '../../services/canonicalTransactionStore'
import { AVAILABLE_COUPONS } from './CartDrawer'
import { ingestPaymentEvent, fetchTransactionDetail, verifyPaymentCapture } from '../../services/backendApi'
import { saveChronovaOrder, updateChronovaOrder } from '../../services/chronovaOrderStore'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onClearCart: () => void
  appliedCoupon?: AppliedCoupon | null
  onApplyCoupon?: (coupon: AppliedCoupon | null) => void
}

type CheckoutStep = 'delivery' | 'payment' | 'success' | 'failure'
type RazorpayTab = 'upi' | 'card' | 'netbanking' | 'wallet'

export type FailureScenarioType =
  | '3ds_timeout'
  | 'low_balance'
  | 'upi_intent_drop'
  | 'bank_downtime'
  | 'risk_engine_flag'
  | 'network_drop'
  | 'auth_retries_exceeded'
  | 'cart_abandonment'

interface FailureScenarioConfig {
  id: FailureScenarioType
  icon: string
  title: string
  subtitle: string
  reason: string
  code: string
  confidence: number
  recoveryProb: number
  riskScore: number
  action: string
  latency: string
  badgeColor: string
}

const FAILURE_SCENARIOS: FailureScenarioConfig[] = [
  {
    id: '3ds_timeout',
    icon: '⏳',
    title: '3DS Bank OTP Timeout',
    subtitle: 'Issuer Switch 504 Unresponsive',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    confidence: 0.94,
    recoveryProb: 0.88,
    riskScore: 0.15,
    action: 'Send payment link',
    latency: '240ms',
    badgeColor: 'border-amber-500 bg-amber-50 text-amber-900',
  },
  {
    id: 'low_balance',
    icon: '⚠️',
    title: 'Insufficient Account Balance',
    subtitle: 'Credit Limit / Balance Exhausted',
    reason: 'Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)',
    code: 'BAD_REQUEST_INSUFFICIENT_FUNDS',
    confidence: 0.85,
    recoveryProb: 0.72,
    riskScore: 0.2,
    action: 'Switch to UPI Auto-Pay / Split Link',
    latency: '190ms',
    badgeColor: 'border-rose-500 bg-rose-50 text-rose-900',
  },
  {
    id: 'upi_intent_drop',
    icon: '📱',
    title: 'UPI App Intent Auto-Drop',
    subtitle: 'GPay/PhonePe App Switch Expired',
    reason: 'UPI Intent Session Expired (Customer Backgrounded App to Check SMS)',
    code: 'UPI_INTENT_TIMEOUT',
    confidence: 0.96,
    recoveryProb: 0.92,
    riskScore: 0.08,
    action: 'Send instant WhatsApp UPI deep link',
    latency: '150ms',
    badgeColor: 'border-purple-500 bg-purple-50 text-purple-900',
  },
  {
    id: 'bank_downtime',
    icon: '🏦',
    title: 'Bank Core Server Downtime',
    subtitle: 'HDFC / SBI CBS Downtime 502',
    reason: 'Issuer Core Banking System (CBS) Scheduled Maintenance / Outage',
    code: 'ISSUER_CBS_DOWN_502',
    confidence: 0.91,
    recoveryProb: 0.84,
    riskScore: 0.12,
    action: 'Smart Routing to Alternate Bank Node',
    latency: '310ms',
    badgeColor: 'border-blue-500 bg-blue-50 text-blue-900',
  },
  {
    id: 'risk_engine_flag',
    icon: '🛡️',
    title: 'Risk Engine False Positive',
    subtitle: 'Velocity Heuristic Soft Block',
    reason: 'Issuer Velocity Heuristic Triggered (False Positive Soft Decline)',
    code: 'FRAUD_VELOCITY_SOFT_BLOCK',
    confidence: 0.98,
    recoveryProb: 0.95,
    riskScore: 0.18,
    action: 'Dispatch Biometric Verified Secure Link',
    latency: '220ms',
    badgeColor: 'border-indigo-500 bg-indigo-50 text-indigo-900',
  },
  {
    id: 'network_drop',
    icon: '🌐',
    title: 'Mobile Network Disconnect',
    subtitle: 'TCP Reset Mid-Handshake',
    reason: 'Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)',
    code: 'CLIENT_TCP_CONNECTION_RESET',
    confidence: 0.89,
    recoveryProb: 0.81,
    riskScore: 0.1,
    action: 'Send 1-Click SMS Recovery Link',
    latency: '180ms',
    badgeColor: 'border-teal-500 bg-teal-50 text-teal-900',
  },
  {
    id: 'auth_retries_exceeded',
    icon: '💳',
    title: 'Incorrect OTP / Max Retries',
    subtitle: '3DS Verification Failed (3/3)',
    reason: 'Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded',
    code: 'AUTH_RETRIES_EXCEEDED_3DS',
    confidence: 0.93,
    recoveryProb: 0.86,
    riskScore: 0.22,
    action: 'Send UPI QR Alternative Link',
    latency: '260ms',
    badgeColor: 'border-orange-500 bg-orange-50 text-orange-900',
  },
  {
    id: 'cart_abandonment',
    icon: '🚫',
    title: 'Checkout Sheet Abandoned',
    subtitle: 'Customer Closed Gateway Window',
    reason: 'Customer Dismissed Razorpay Checkout Window Before Submitting Credentials',
    code: 'GATEWAY_DISMISSED_BY_USER',
    confidence: 0.82,
    recoveryProb: 0.79,
    riskScore: 0.14,
    action: 'Send Cart Recovery WhatsApp with 5% Perk',
    latency: '110ms',
    badgeColor: 'border-slate-500 bg-slate-100 text-slate-900',
  },
]

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
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false)
  const [selectedRzpTab, setSelectedRzpTab] = useState<RazorpayTab>('upi')
  const [upiId, setUpiId] = useState('lokeshwar@okaxis')
  const [selectedBank, setSelectedBank] = useState('HDFC')
  const [cardDetails, setCardDetails] = useState({
    number: '4111 2222 3333 4242',
    expiry: '12/28',
    cvv: '891',
    name: 'Lokeshwar Sudam',
  })

  const [errorMessage, setErrorMessage] = useState('')
  const [lastFailureScenario, setLastFailureScenario] = useState<FailureScenarioConfig | null>(null)
  const [activeTxnId, setActiveTxnId] = useState<string | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'in_progress' | 'recovered' | 'unavailable'>('idle')
  const [recoveredReceipt, setRecoveredReceipt] = useState<{
    orderId: string
    paymentId: string
    amount: number
    date: string
  } | null>(null)
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

  // Real-Time Recovery Polling: Listens for authoritative backend recovery verification from Website B
  useEffect(() => {
    if (step !== 'failure' || !activeTxnId || recoveryStatus === 'recovered') {
      return
    }

    let isMounted = true
    const pollInterval = setInterval(async () => {
      try {
        const detail = await fetchTransactionDetail(activeTxnId)
        if (!isMounted) return
        if (detail?.transaction) {
          const t = detail.transaction
          const isRec = t.status === 'RECOVERED' || t.verified_amount_minor > 0
          if (isRec) {
            setRecoveryStatus('recovered')
            setRecoveredReceipt({
              orderId: activeOrderId || t.provider_order_id || `order_cn_${activeTxnId}`,
              paymentId: t.provider_id || t.provider_payment_id || `pay_rec_${activeTxnId}`,
              amount: t.verified_amount_minor ? Math.round(t.verified_amount_minor / 100) : totalDue,
              date: new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
            // Sync canonical store
            useTransactionStore.getState().updateTransactionStatus(activeTxnId, 'RECOVERED', t.verified_amount_minor || totalMinor, t.provider_id)
            onClearCart()
          }
        }
      } catch (err) {
        // Safe timeout handling
      }
    }, 2500)

    return () => {
      isMounted = false
      clearInterval(pollInterval)
    }
  }, [step, activeTxnId, recoveryStatus, activeOrderId, totalDue, totalMinor, onClearCart])

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

  // 2. Open Custom Interactive Razorpay Gateway Modal
  const handleOpenRazorpayGateway = () => {
    setErrorMessage('')
    setIsRazorpayModalOpen(true)
  }

  // 3. Process Successful Payment via Simulator
  const handleExecuteSuccessfulPayment = () => {
    setPaymentLoading(true)
    const isRetry = !!activeTxnId
    const currentTxnId = activeTxnId || `TXN-CN-${Date.now().toString(36).toUpperCase()}`
    const currentOrderId = activeOrderId || `order_cn_${Date.now().toString(36)}`
    const paymentId = `pay_live_${Date.now().toString(36)}`
    const firstItem = items[0]
    const prod = firstItem?.product
    const primaryImg = prod?.images?.primary || prod?.primaryImage || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'

    const mappedItems = items.map((item) => {
      const p = item.product
      const img = p.images?.primary || p.primaryImage || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'
      return {
        productId: p.id,
        product_id: p.id,
        productName: p.name,
        product_name: p.name,
        productImage: img,
        product_image: img,
        productCategory: p.category,
        product_category: p.category,
        productBrand: p.brand,
        product_brand: p.brand,
        quantity: item.quantity,
        unitPrice: p.price_rupees,
        unit_price: p.price_rupees,
        unit_price_rupees: p.price_rupees,
        totalPrice: p.price_rupees * item.quantity,
        total_price: p.price_rupees * item.quantity,
        total_price_rupees: p.price_rupees * item.quantity,
        selected_color: item.selected_color,
      }
    })

    if (!activeTxnId) {
      setActiveTxnId(currentTxnId)
    }
    if (!activeOrderId) {
      setActiveOrderId(currentOrderId)
    }

    if (isRetry) {
      // Authoritative Server-Side Payment Verification for RETRY
      verifyPaymentCapture({
        transaction_id: currentTxnId,
        payment_id: paymentId,
        order_id: currentOrderId,
        amount_minor: totalMinor,
        currency: 'INR',
      }).catch(() => {})

      // Update Order in Customer Order History
      updateChronovaOrder(currentTxnId, {
        payment_status: 'PAID',
        order_status: 'ORDER_CONFIRMED',
        recovery_status: 'RECOVERED',
        razorpay_payment_id: paymentId,
        payment_method: selectedRzpTab,
        verified_at: new Date().toISOString(),
      })
    } else {
      // Authoritative Server-Side Ingestion for DIRECT PAYMENT
      ingestPaymentEvent({
        transaction_id: currentTxnId,
        merchant_id: 'mer_chronova_watches',
        order_id: currentOrderId,
        payment_id: paymentId,
        amount_minor: totalMinor,
        currency: 'INR',
        source: 'live',
        status: 'captured',
        provider: 'razorpay',
        method: selectedRzpTab,
        product_id: prod?.id,
        product_name: prod?.name || 'Chronova Luxury Timepiece',
        product_image: primaryImg,
        product_brand: prod?.brand || 'Chronova',
        product_category: prod?.category || 'Automatic Watches',
        quantity: firstItem?.quantity || 1,
        unit_price: prod?.price_rupees || Math.round(totalDue),
        items: mappedItems,
        customer: {
          name: address.full_name,
          email: address.email,
          phone: address.phone,
        },
        metadata: {
          product_id: prod?.id,
          product_name: prod?.name,
          brand: prod?.brand,
          category: prod?.category,
          quantity: firstItem?.quantity || 1,
          unit_price: prod?.price_rupees,
          items: mappedItems,
        },
      }).catch(() => {})

      // Save Order in Customer Order History
      saveChronovaOrder({
        order_id: currentOrderId,
        transaction_id: currentTxnId,
        created_at: new Date().toISOString(),
        items: mappedItems,
        total_amount_rupees: totalDue,
        total_amount_minor: totalMinor,
        currency: 'INR',
        customer: {
          full_name: address.full_name,
          email: address.email,
          phone: address.phone,
          address_line1: address.address_line1,
          address_line2: address.address_line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        payment_status: 'PAID',
        order_status: 'ORDER_CONFIRMED',
        recovery_status: 'NONE',
        razorpay_order_id: currentOrderId,
        razorpay_payment_id: paymentId,
        payment_method: selectedRzpTab,
        verified_at: new Date().toISOString(),
      })
    }

    // Update frontend canonical store
    useTransactionStore.getState().updateTransactionStatus(currentTxnId, 'RECOVERED', totalMinor, paymentId)

    setTimeout(() => {
      setPaymentLoading(false)
      setIsRazorpayModalOpen(false)

      const receipt = {
        orderId: currentOrderId,
        paymentId: paymentId,
        amount: totalDue,
        date: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }

      if (isRetry) {
        setRecoveryStatus('recovered')
        setRecoveredReceipt(receipt)
        setStep('failure')
      } else {
        const successTxn: CanonicalTransaction = {
          id: currentTxnId,
          merchant_id: 'mer_chronova_watches',
          chronova_order_id: currentOrderId,
          amount: totalDue,
          amount_minor: totalMinor,
          currency: 'INR',
          source: 'live',
          status: 'RECOVERED',
          direction: 'Direct settlement',
          reason: 'Payment completed successfully without degradation',
          action: 'None — Payment already successful',
          confidence: 0.99,
          recovery_probability: 1.0,
          risk_score: 0.05,
          policy: 'Approved',
          explanation: `Customer successfully authorized ${formatINR(totalDue)} via Razorpay Test Mode (${selectedRzpTab.toUpperCase()}). No recovery intervention was required.`,
          latency: '180ms',
          created_at: new Date().toISOString(),
          provider: 'razorpay',
          provider_payment_id: paymentId,
          provider_order_id: currentOrderId,
          verified_amount_minor: totalMinor,
          captured_at: new Date().toISOString(),
          product_id: prod?.id,
          product_name: prod?.name || 'Chronova Luxury Timepiece',
          product_image: primaryImg,
          product_brand: prod?.brand || 'Chronova',
          product_category: prod?.category || 'Automatic Watches',
          quantity: firstItem?.quantity || 1,
          unit_price: prod?.price_rupees || Math.round(totalDue),
          unit_price_rupees: prod?.price_rupees || Math.round(totalDue),
          items: mappedItems,
        }
        useTransactionStore.getState().ingestTransaction(successTxn)
        setOrderReceipt(receipt)
        setStep('success')
      }

      onClearCart()
      useTransactionStore.getState().refreshProviderFeed().catch(() => {})
    }, 650)
  }

  // 4. Simulate Failure Scenarios for RazorRecover AI Testing
  const handleSimulateFailure = (scenarioId: FailureScenarioType) => {
    setPaymentLoading(true)
    setErrorMessage('')
    setIsRazorpayModalOpen(false)

    const scenario = FAILURE_SCENARIOS.find((s) => s.id === scenarioId) || FAILURE_SCENARIOS[0]
    setLastFailureScenario(scenario)

    const generatedTxnId = `TXN-CN-${Date.now().toString(36).toUpperCase()}`
    const mockOrderId = `order_cn_${Date.now().toString(36)}`
    const firstItem = items[0]
    const prod = firstItem?.product
    const primaryImg = prod?.images?.primary || prod?.primaryImage || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'

    const mappedItems = items.map((item) => {
      const p = item.product
      const img = p.images?.primary || p.primaryImage || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'
      return {
        productId: p.id,
        product_id: p.id,
        productName: p.name,
        product_name: p.name,
        productImage: img,
        product_image: img,
        productCategory: p.category,
        product_category: p.category,
        productBrand: p.brand,
        product_brand: p.brand,
        quantity: item.quantity,
        unitPrice: p.price_rupees,
        unit_price: p.price_rupees,
        unit_price_rupees: p.price_rupees,
        totalPrice: p.price_rupees * item.quantity,
        total_price: p.price_rupees * item.quantity,
        total_price_rupees: p.price_rupees * item.quantity,
        selected_color: item.selected_color,
      }
    })

    setActiveTxnId(generatedTxnId)
    setActiveOrderId(mockOrderId)
    setRecoveryStatus('in_progress')

    // Save Failed Order in Customer Order History so customer can track/retry it
    saveChronovaOrder({
      order_id: mockOrderId,
      transaction_id: generatedTxnId,
      created_at: new Date().toISOString(),
      items: mappedItems,
      total_amount_rupees: totalDue,
      total_amount_minor: totalMinor,
      currency: 'INR',
      customer: {
        full_name: address.full_name,
        email: address.email,
        phone: address.phone,
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      payment_status: 'FAILED',
      order_status: 'PAYMENT_FAILED',
      recovery_status: 'ELIGIBLE',
      failure_reason: scenario.reason,
      failure_code: scenario.code,
      recommended_action: scenario.action,
      razorpay_order_id: mockOrderId,
      payment_method: selectedRzpTab,
    })

    // Authoritative Backend Event Ingestion to Trigger AI & Recovery Pipeline
    ingestPaymentEvent({
      transaction_id: generatedTxnId,
      merchant_id: 'mer_chronova_watches',
      order_id: mockOrderId,
      amount_minor: totalMinor,
      currency: 'INR',
      source: 'live',
      status: 'failed',
      provider: 'razorpay',
      method: selectedRzpTab,
      failure_code: scenario.code,
      failure_reason: scenario.reason,
      product_id: prod?.id,
      product_name: prod?.name || 'Chronova Luxury Timepiece',
      product_image: primaryImg,
      product_brand: prod?.brand || 'Chronova',
      product_category: prod?.category || 'Automatic Watches',
      quantity: firstItem?.quantity || 1,
      unit_price: prod?.price_rupees || Math.round(totalDue),
      items: mappedItems,
      customer: {
        name: address.full_name,
        email: address.email,
        phone: address.phone,
      },
      metadata: {
        product_id: prod?.id,
        product_name: prod?.name,
        brand: prod?.brand,
        category: prod?.category,
        quantity: firstItem?.quantity || 1,
        unit_price: prod?.price_rupees,
        scenario_id: scenario.id,
        items: mappedItems,
      },
    }).catch(() => {})

    setTimeout(() => {
      setPaymentLoading(false)

      // Ingest into server-to-server transaction ledger for RazorRecover AI backend
      const failedTxn: CanonicalTransaction = {
        id: generatedTxnId,
        merchant_id: 'mer_chronova_watches',
        chronova_order_id: mockOrderId,
        amount: totalDue,
        amount_minor: totalMinor,
        currency: 'INR',
        source: 'live',
        status: 'STOPPED',
        direction: 'Payment degradation',
        reason: scenario.reason,
        action: scenario.action,
        confidence: scenario.confidence,
        recovery_probability: scenario.recoveryProb,
        risk_score: scenario.riskScore,
        policy: 'Approved',
        explanation: `Captured failed Razorpay Test payment [${scenario.code}] for order ${mockOrderId}`,
        latency: scenario.latency,
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_order_id: mockOrderId,
        verified_amount_minor: 0,
        product_id: prod?.id,
        product_name: prod?.name || 'Chronova Luxury Timepiece',
        product_image: primaryImg,
        product_brand: prod?.brand || 'Chronova',
        product_category: prod?.category || 'Automatic Watches',
        quantity: firstItem?.quantity || 1,
        unit_price: prod?.price_rupees || Math.round(totalDue),
        unit_price_rupees: prod?.price_rupees || Math.round(totalDue),
        items: mappedItems,
      }

      useTransactionStore.getState().ingestTransaction(failedTxn)
      setStep('failure')
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200 text-left">
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
              <span className="text-[11px] font-bold text-emerald-700 uppercase font-mono flex items-center gap-1">
                <span>🔒 256-Bit SSL Encrypted</span>
                <span>·</span>
                <span>Verified Razorpay Gateway</span>
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

              {/* Order Summary & Coupon Engine */}
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
                          {activeCoupon.discountPercent
                            ? `${activeCoupon.discountPercent}% Discount Applied`
                            : `₹${activeCoupon.flatDiscount} Discount Applied`}
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
                          style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
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
                style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
              >
                <span>PROCEED TO PAYMENT ({formatINR(totalDue)})</span>
                <span>→</span>
              </button>
            </form>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION & SCENARIOS */}
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
                  Deliver to: <strong className="text-slate-900">{address.full_name}</strong>,{' '}
                  {address.address_line1}, {address.city} ({address.pincode})
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
              <div className="space-y-4">
                {/* 1. Official Razorpay Test Mode Checkout Trigger */}
                <button
                  disabled={paymentLoading}
                  onClick={handleOpenRazorpayGateway}
                  className="w-full py-4 px-5 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black text-sm uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-between disabled:opacity-50"
                  style={{ color: '#ffffff', backgroundColor: '#1d4ed8' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💳</span>
                    <div className="text-left">
                      <div className="leading-tight flex items-center gap-2">
                        <span>OPEN RAZORPAY TEST GATEWAY</span>
                        <span className="text-[10px] font-mono bg-blue-900/60 px-2 py-0.5 rounded border border-blue-400 text-blue-200">
                          VERIFIED
                        </span>
                      </div>
                      <div className="text-[10px] font-normal text-blue-200">
                        UPI · Credit/Debit Cards · NetBanking · Wallets
                      </div>
                    </div>
                  </div>
                  <span>{paymentLoading ? 'Processing...' : 'Pay ' + formatINR(totalDue) + ' →'}</span>
                </button>

                {/* 2. 8 Comprehensive Simulation Failure Buttons for RazorRecover AI Testing */}
                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      🧪 RAZORRECOVER AI TEST SCENARIOS (SIMULATE PAYMENT DROPS):
                    </span>
                    <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      8 SCENARIOS ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FAILURE_SCENARIOS.map((sc) => (
                      <button
                        key={sc.id}
                        disabled={paymentLoading}
                        onClick={() => handleSimulateFailure(sc.id)}
                        className={`p-3 rounded-xl border-2 hover:brightness-95 text-xs font-black uppercase tracking-wider transition cursor-pointer text-left flex items-center justify-between disabled:opacity-50 shadow-xs ${sc.badgeColor}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span>{sc.icon}</span>
                            <span className="text-[11px] font-black">{sc.title}</span>
                          </div>
                          <div className="text-[10px] font-medium opacity-85">{sc.subtitle}</div>
                        </div>
                        <span className="text-xs opacity-75">⚡</span>
                      </button>
                    ))}
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
                  Your luxury timepiece order has been successfully placed. We have sent the confirmation & invoice
                  to <strong className="text-slate-900">{address.email}</strong>.
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
                  <span className="font-semibold text-slate-900">
                    {address.city}, {address.pincode}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Amount Paid:</span>
                  <span className="text-emerald-700 font-black">{formatINR(orderReceipt.amount)}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
              >
                Continue Shopping
              </button>
            </div>
          )}

          {/* STEP 4: FAILURE DEMO & AUTONOMOUS RECOVERY (RAZORRECOVER INTEGRATION) */}
          {step === 'failure' && (
            recoveryStatus === 'recovered' && recoveredReceipt ? (
              <div className="py-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 text-3xl flex items-center justify-center mx-auto shadow-md">
                  ✓
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black font-mono">
                    <span>⚡ RAZORRECOVER AI</span>
                    <span>·</span>
                    <span>AUTONOMOUS RECOVERY VERIFIED</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    PAYMENT RECOVERED & ORDER CONFIRMED!
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                    Your dropped checkout was autonomously diagnosed, authorized, and verified through RazorRecover AI.
                    Confirmation dispatched to <strong className="text-slate-900">{address.email}</strong>.
                  </p>
                </div>

                {/* Receipt Summary Box */}
                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 max-w-md mx-auto text-left space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Order Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{recoveredReceipt.orderId}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Canonical Txn ID:</span>
                    <span className="font-mono font-bold text-blue-700">{activeTxnId}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Settlement Channel:</span>
                    <span className="font-mono font-bold text-slate-900">{lastFailureScenario?.action || 'Razorpay Autonomous Recovery'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Verified Date:</span>
                    <span className="font-semibold text-slate-900">{recoveredReceipt.date}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-emerald-200">
                    <span>Recovered Amount:</span>
                    <span className="text-emerald-700 font-black">{formatINR(recoveredReceipt.amount)}</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                  style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="py-6 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 text-3xl flex items-center justify-center mx-auto shadow-md">
                  ✕
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    PAYMENT DEGRADATION DETECTED
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                    {lastFailureScenario?.reason || 'Your payment encountered a temporary bank switch error.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 max-w-md mx-auto text-left space-y-2.5 text-xs text-amber-900">
                  <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="animate-pulse">⚡</span>
                      <span>RazorRecover AI Autonomous Recovery Active</span>
                    </span>
                    <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-black">
                      SCORE: {Math.round((lastFailureScenario?.recoveryProb || 0.85) * 100)}/99
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Canonical transaction <strong className="font-mono font-bold text-slate-900">{activeTxnId}</strong> ingested into backend ledger.
                    Automated priority recovery action (<strong className="text-slate-900">{lastFailureScenario?.action}</strong>) has been initialized.
                  </p>

                  <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-1 text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                      <span>Listening for recovery settlement...</span>
                    </div>
                    <span className="text-emerald-700 font-bold">✓ DISPATCH VERIFIED</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => setStep('payment')}
                    className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
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
            )
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SEAMLESS INTERACTIVE RAZORPAY GATEWAY MODAL (TEST MODE)               */}
      {/* ========================================================================= */}
      {isRazorpayModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-300 text-slate-900">
            {/* Razorpay Brand Header */}
            <div className="bg-[#0c2340] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black text-white text-base">
                  ₹
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300 tracking-wider">CHRONOVA WATCHES</div>
                  <div className="text-lg font-black text-white">{formatINR(totalDue)}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-400/40">
                  TEST MODE
                </span>
                <button
                  onClick={() => setIsRazorpayModalOpen(false)}
                  className="block text-slate-400 hover:text-white text-xs mt-1 text-right ml-auto cursor-pointer"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>

            {/* Razorpay Tabbed Checkout Interface */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedRzpTab('upi')}
                className={`flex-1 py-3 px-2 text-center transition cursor-pointer border-b-2 ${
                  selectedRzpTab === 'upi'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ⚡ UPI
              </button>
              <button
                type="button"
                onClick={() => setSelectedRzpTab('card')}
                className={`flex-1 py-3 px-2 text-center transition cursor-pointer border-b-2 ${
                  selectedRzpTab === 'card'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                💳 Cards
              </button>
              <button
                type="button"
                onClick={() => setSelectedRzpTab('netbanking')}
                className={`flex-1 py-3 px-2 text-center transition cursor-pointer border-b-2 ${
                  selectedRzpTab === 'netbanking'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🏦 NetBanking
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* TAB 1: UPI */}
              {selectedRzpTab === 'upi' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Enter UPI ID / VPA</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex gap-2">
                    {['Google Pay', 'PhonePe', 'Paytm', 'Cred UPI'].map((app) => (
                      <button
                        key={app}
                        type="button"
                        onClick={() => setUpiId(`lokeshwar@${app.toLowerCase().replace(' ', '')}`)}
                        className="flex-1 py-2 px-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-center cursor-pointer"
                      >
                        {app}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                    <span>⚡</span>
                    <span>Instant authorization in Razorpay sandbox mode with auto-capture.</span>
                  </div>
                </div>
              )}

              {/* TAB 2: CARDS */}
              {selectedRzpTab === 'card' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Card Number</label>
                    <input
                      type="text"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">CVV</label>
                      <input
                        type="password"
                        value={cardDetails.cvv}
                        onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NETBANKING */}
              {selectedRzpTab === 'netbanking' && (
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-slate-600 block">Select Popular Bank</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'PNB'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBank(b)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                          selectedBank === b
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {b} Bank
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={paymentLoading}
                  onClick={handleExecuteSuccessfulPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ color: '#ffffff', backgroundColor: '#2563eb' }}
                >
                  <span style={{ color: '#ffffff' }}>{paymentLoading ? 'AUTHORIZING WITH ISSUER...' : `AUTHORIZE & PAY ${formatINR(totalDue)}`}</span>
                  <span style={{ color: '#ffffff' }}>✓</span>
                </button>

                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-mono">
                  <span>Secured by Razorpay</span>
                  <button
                    type="button"
                    onClick={() => handleSimulateFailure('3ds_timeout')}
                    className="text-rose-600 hover:underline cursor-pointer"
                  >
                    Simulate Gateway Failure
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
