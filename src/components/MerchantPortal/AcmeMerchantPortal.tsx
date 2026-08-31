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

interface PlanOption {
  id: string
  name: string
  tagline: string
  amountRupees: number
  amountMinor: number
  features: string[]
  recommended?: boolean
}

const SAAS_PLANS: PlanOption[] = [
  {
    id: 'starter',
    name: 'Starter SaaS Plan',
    tagline: 'Standard cloud API cluster & compute node',
    amountRupees: 10000,
    amountMinor: 1000000,
    features: ['Up to 50k API Calls / mo', '99.9% Uptime SLA', 'Standard Email Support', '1 Production Node'],
  },
  {
    id: 'business',
    name: 'Business Growth Plan',
    tagline: 'High-throughput auto-scaling infrastructure',
    amountRupees: 25000,
    amountMinor: 2500000,
    features: ['Up to 500k API Calls / mo', '99.95% High-Availability SLA', 'Priority Slack Support', 'Dedicated Load Balancer'],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Dedicated Plan',
    tagline: 'Mission-critical isolated bare-metal cloud',
    amountRupees: 60000,
    amountMinor: 6000000,
    features: ['Unlimited API Calls', '99.99% Enterprise SLA', '24/7 Dedicated TAM & Phone Support', 'Multi-Region Failover'],
  },
]

export interface AcmeMerchantPortalProps {
  onNavigateToRazorRecover?: (tab?: string, txnId?: string) => void
  isDualView?: boolean
}

export const AcmeMerchantPortal: React.FC<AcmeMerchantPortalProps> = ({
  onNavigateToRazorRecover,
  isDualView = false,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(SAAS_PLANS[0])
  const [companyName, setCompanyName] = useState('HoliTech Labs Ltd')
  const [customerEmail, setCustomerEmail] = useState('billing@holitech.in')
  const [gstNumber, setGstNumber] = useState('27AAPCH1234F1Z8')
  const [invoiceRef, setInvoiceRef] = useState('INV-ACME-2026-0983')

  // Payment states
  const [orderProcessing, setOrderProcessing] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    paymentId: string
    orderId: string
    amount: number
  } | null>(null)
  const [paymentFailureError, setPaymentFailureError] = useState<{
    code: string
    description: string
    transactionId: string
  } | null>(null)

  // Simulation states
  const [activeTab, setActiveTab] = useState<'checkout' | 'scenarios' | 'recovery'>('checkout')

  const transactions = useTransactionStore((s) => s.transactions)
  const refreshProviderFeed = useTransactionStore((s) => s.refreshProviderFeed)
  const ingestTransaction = useTransactionStore((s) => s.ingestTransaction)
  const verifyPayment = useTransactionStore((s) => s.verifyPayment)

  // Format INR Currency
  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  // Check if this invoice currently has an active recovery action or is recovered
  const linkedTxn = transactions.find(
    (t) => t.id === invoiceRef || t.provider_order_id === activeOrderId
  )

  // Handle Initial Real Razorpay Checkout Order Creation
  const handleInitiatePayment = async () => {
    setOrderProcessing(true)
    setPaymentSuccessData(null)
    setPaymentFailureError(null)
    unlockPageScroll()

    try {
      // 1. Create real Razorpay Test Mode Order via Vercel Backend
      const orderRes = await executeRecoveryAction({
        action_type: 'Retry payment',
        transaction_id: invoiceRef,
        amount_minor: selectedPlan.amountMinor,
        currency: 'INR',
      })

      const orderId = orderRes.order_id || `order_test_${Date.now().toString(36)}`
      setActiveOrderId(orderId)

      // 2. Ingest initial transaction state into store (PENDING)
      const newTxn: CanonicalTransaction = {
        id: invoiceRef,
        merchant_id: 'mer_acme_cloud',
        amount: selectedPlan.amountRupees,
        amount_minor: selectedPlan.amountMinor,
        currency: 'INR',
        source: 'live',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason: 'Awaiting customer checkout payment',
        action: 'Retry payment',
        confidence: 90,
        recovery_probability: 75,
        risk_score: 35,
        policy: 'Approved',
        explanation: `Customer initiated Acme Cloud checkout for ${selectedPlan.name}.`,
        latency: '310ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_order_id: orderId,
        provider_status: 'created',
        verified_amount_minor: 0,
      }
      ingestTransaction(newTxn)

      // 3. Launch Razorpay Test Mode Checkout
      launchRazorpayCheckout({
        order_id: orderId,
        amount_minor: selectedPlan.amountMinor,
        currency: 'INR',
        description: `Acme Cloud B2B — ${selectedPlan.name}`,
        onSuccess: async (resp) => {
          setOrderProcessing(false)
          setPaymentSuccessData({
            paymentId: resp.razorpay_payment_id,
            orderId: resp.razorpay_order_id || orderId,
            amount: selectedPlan.amountRupees,
          })

          // Verify with RazorRecover canonical ledger
          await verifyPayment(
            invoiceRef,
            resp.razorpay_payment_id,
            selectedPlan.amountMinor,
            'INR',
            resp.razorpay_order_id || orderId,
            resp.razorpay_signature
          )
          refreshProviderFeed()
          unlockPageScroll()
        },
        onFailure: (err) => {
          setOrderProcessing(false)
          const failureReason = err?.description || err?.message || 'Payment cancelled or gateway challenge failed'
          setPaymentFailureError({
            code: err?.code || 'GATEWAY_DECLINE',
            description: failureReason,
            transactionId: invoiceRef,
          })

          // Mark transaction as failed/stopped in canonical store to trigger recovery opportunity
          const failedTxn: CanonicalTransaction = {
            ...newTxn,
            status: 'STOPPED',
            reason: failureReason,
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
      setPaymentFailureError({
        code: 'ORDER_INIT_FAILED',
        description: e?.message || 'Could not connect to Razorpay test backend.',
        transactionId: invoiceRef,
      })
      unlockPageScroll()
    }
  }

  // Handle Demo Scenarios
  const handleSimulateScenario = (scenario: 'success' | 'timeout' | 'abandon') => {
    setPaymentSuccessData(null)
    setPaymentFailureError(null)

    if (scenario === 'success') {
      const mockPayId = `pay_test_${invoiceRef.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now().toString(36)}`
      const orderId = activeOrderId || `order_test_${Date.now().toString(36)}`
      setPaymentSuccessData({
        paymentId: mockPayId,
        orderId,
        amount: selectedPlan.amountRupees,
      })
      verifyPayment(invoiceRef, mockPayId, selectedPlan.amountMinor, 'INR', orderId)
    } else if (scenario === 'timeout') {
      const reason = 'Simulated 3DS Bank Timeout (Issuer Gateway Downtime)'
      setPaymentFailureError({
        code: 'GATEWAY_TIMEOUT',
        description: reason,
        transactionId: invoiceRef,
      })
      const failedTxn: CanonicalTransaction = {
        id: invoiceRef,
        merchant_id: 'mer_acme_cloud',
        amount: selectedPlan.amountRupees,
        amount_minor: selectedPlan.amountMinor,
        currency: 'INR',
        source: 'live',
        status: 'STOPPED',
        direction: 'Payment degradation',
        reason,
        action: 'Retry payment',
        confidence: 94,
        recovery_probability: 82,
        risk_score: 28,
        policy: 'Approved',
        explanation: `Test Mode Failure: Customer experienced 3DS authentication timeout on ${selectedPlan.name}.`,
        latency: '450ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_order_id: activeOrderId || undefined,
        provider_status: 'failed',
        verified_amount_minor: 0,
      }
      ingestTransaction(failedTxn)
    } else if (scenario === 'abandon') {
      const reason = 'Checkout drop-off (Customer closed browser modal)'
      setPaymentFailureError({
        code: 'CHECKOUT_ABANDONED',
        description: reason,
        transactionId: invoiceRef,
      })
      const abandonedTxn: CanonicalTransaction = {
        id: invoiceRef,
        merchant_id: 'mer_acme_cloud',
        amount: selectedPlan.amountRupees,
        amount_minor: selectedPlan.amountMinor,
        currency: 'INR',
        source: 'live',
        status: 'PENDING',
        direction: 'Checkout drop-off',
        reason,
        action: 'Send payment link',
        confidence: 88,
        recovery_probability: 70,
        risk_score: 42,
        policy: 'Approved',
        explanation: `Customer abandoned checkout session on Acme Cloud for ${selectedPlan.name}.`,
        latency: '290ms',
        created_at: new Date().toISOString(),
        provider: 'razorpay',
        provider_status: 'created',
        verified_amount_minor: 0,
      }
      ingestTransaction(abandonedTxn)
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#060b19] text-[#e2e8f0] font-sans antialiased pb-16">
      {/* Top Banner: Dual Sandbox Disclaimer */}
      <div className="w-full bg-[#0d1b3e] border-b border-[#1e3a8a] py-2 px-4 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#93c5fd]">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
          <span className="font-bold uppercase tracking-wider">WEBSITE A: B2B Merchant Store Sandbox</span>
          <span className="text-[#64748b]">|</span>
          <span className="text-[#38bdf8]">Razorpay Test Mode (Simulated Money Only)</span>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateToRazorRecover && (
            <button
              onClick={() => onNavigateToRazorRecover('Opportunities', invoiceRef)}
              className="px-2.5 py-1 bg-[#1e40af] hover:bg-[#2563eb] text-white rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <span>View in RazorRecover AI</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Acme Cloud Navbar */}
      <header className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563eb] to-[#06b6d4] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
            ▲
          </div>
          <div>
            <div className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Acme Cloud <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#334155] font-mono">B2B SaaS</span>
            </div>
            <p className="text-xs text-[#94a3b8]">Enterprise Cloud Infrastructure & Managed APIs</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#0f172a] p-1 rounded-xl border border-[#1e293b] text-xs">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'checkout'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            🛒 Customer Checkout
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'scenarios'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            ⚡ Test Scenarios
          </button>
          <button
            onClick={() => setActiveTab('recovery')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'recovery'
                ? 'bg-[#2563eb] text-white shadow-md'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <span>📬 Recovery Portal</span>
            {linkedTxn?.recovery_operation_id && (
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* Active Recovery Notification Banner if applicable */}
        {linkedTxn?.recovery_operation_id && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#064e3b]/80 to-[#0f172a] border border-[#10b981]/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <div className="font-bold text-[#6ee7b7] text-sm flex items-center gap-2">
                  <span>RazorRecover AI Recovery Action Active</span>
                  <span className="font-mono text-xs text-[#a7f3d0]">[{linkedTxn.recovery_operation_id}]</span>
                </div>
                <div className="text-xs text-[#94a3b8]">
                  RazorRecover generated a safe payment retry link with pre-authorized terms for invoice <strong className="text-white">{linkedTxn.id}</strong>.
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('recovery')}
              className="px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-extrabold text-xs transition cursor-pointer shrink-0 shadow-lg shadow-emerald-500/20"
            >
              Complete Recovery Pay →
            </button>
          </div>
        )}

        {/* TAB 1: CUSTOMER CHECKOUT */}
        {activeTab === 'checkout' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Plan Selection & Company Details */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">1. Select Subscription Plan</h2>
                <p className="text-xs text-[#94a3b8]">Choose the monthly cloud infrastructure plan for your organization.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SAAS_PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#0f1d40] border-[#38bdf8] shadow-lg shadow-blue-500/10'
                          : 'bg-[#0b132b] border-[#1e293b] hover:border-[#334155]'
                      }`}
                    >
                      {plan.recommended && (
                        <div className="absolute -top-2.5 right-3 bg-[#2563eb] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Popular
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-sm">{plan.name}</div>
                        <div className="text-[11px] text-[#94a3b8] mt-1 leading-snug">{plan.tagline}</div>
                        <div className="mt-3 text-xl font-extrabold text-[#38bdf8]">
                          {formatINR(plan.amountRupees)}
                          <span className="text-[10px] text-[#64748b] font-normal"> /mo</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#1e293b] space-y-1">
                        {plan.features.map((f, i) => (
                          <div key={i} className="text-[10px] text-[#94a3b8] flex items-center gap-1.5">
                            <span className="text-[#38bdf8]">✓</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* B2B Customer / Invoice Details Form */}
              <div className="p-5 rounded-xl bg-[#0b132b] border border-[#1e293b] space-y-4">
                <h3 className="text-sm font-bold text-white">2. B2B Billing Information</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[#94a3b8] mb-1 font-medium">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] mb-1 font-medium">Billing Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060b19] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] mb-1 font-medium">GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060b19] border border-[#1e293b] text-white font-mono focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] mb-1 font-medium">Invoice Reference</label>
                    <input
                      type="text"
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060b19] border border-[#1e293b] text-white font-mono focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary & Pay Action */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-5 shadow-xl">
                <div className="border-b border-[#1e293b] pb-4">
                  <h3 className="text-base font-bold text-white">Invoice Summary</h3>
                  <div className="text-xs text-[#94a3b8] font-mono mt-0.5">Reference: {invoiceRef}</div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Selected Subscription:</span>
                    <span className="text-white font-bold">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Billing Entity:</span>
                    <span className="text-white">{companyName}</span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Payment Gateway:</span>
                    <span className="text-[#38bdf8] font-mono">Razorpay Test Mode</span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8] pt-3 border-t border-[#1e293b]">
                    <span>Subtotal:</span>
                    <span className="text-white">{formatINR(selectedPlan.amountRupees)}</span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Estimated Tax (18% GST):</span>
                    <span className="text-white">Included</span>
                  </div>
                  <div className="flex justify-between text-white font-extrabold text-base pt-3 border-t border-[#1e293b]">
                    <span>Total Due:</span>
                    <span className="text-[#38bdf8]">{formatINR(selectedPlan.amountRupees)}</span>
                  </div>
                </div>

                {/* Primary Razorpay Test Mode Checkout Button */}
                <button
                  onClick={handleInitiatePayment}
                  disabled={orderProcessing}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-sm transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-mono"
                >
                  {orderProcessing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Opening Razorpay Test Checkout...</span>
                    </>
                  ) : (
                    <>
                      <span>💳 Pay with Razorpay Test Mode ({formatINR(selectedPlan.amountRupees)})</span>
                      <span>▶</span>
                    </>
                  )}
                </button>

                <div className="text-[10px] text-center text-[#64748b] leading-tight">
                  🔒 Encrypted simulated test transaction. Razorpay Test Mode credentials only. No actual funds debited.
                </div>
              </div>

              {/* Status Outcome Banners */}
              {paymentSuccessData && (
                <div className="p-5 rounded-2xl bg-[#064e3b]/30 border border-[#10b981] space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2 text-[#6ee7b7] font-bold text-sm">
                    <span>✓</span>
                    <span>Payment Submitted Successfully</span>
                  </div>
                  <div className="text-[#94a3b8] text-[11px] space-y-1">
                    <div>Payment ID: <strong className="text-white">{paymentSuccessData.paymentId}</strong></div>
                    <div>Order ID: <strong className="text-white">{paymentSuccessData.orderId}</strong></div>
                    <div>Amount Captured: <strong className="text-[#6ee7b7]">{formatINR(paymentSuccessData.amount)}</strong></div>
                  </div>
                  {onNavigateToRazorRecover && (
                    <button
                      onClick={() => onNavigateToRazorRecover('Transactions', invoiceRef)}
                      className="mt-2 w-full py-2 bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-bold rounded-lg text-center cursor-pointer transition"
                    >
                      Verify in RazorRecover Dashboard →
                    </button>
                  )}
                </div>
              )}

              {paymentFailureError && (
                <div className="p-5 rounded-2xl bg-[#7f1d1d]/30 border border-[#ef4444] space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2 text-[#fca5a5] font-bold text-sm">
                    <span>⚠️</span>
                    <span>Payment Failed / Declined</span>
                  </div>
                  <div className="text-[#cbd5e1] text-[11px]">
                    {paymentFailureError.description}
                  </div>
                  <div className="text-[10px] text-[#94a3b8]">
                    Transaction <strong className="text-white">{paymentFailureError.transactionId}</strong> has been logged to RazorRecover AI for automated root-cause diagnosis.
                  </div>
                  {onNavigateToRazorRecover && (
                    <button
                      onClick={() => onNavigateToRazorRecover('Opportunities', invoiceRef)}
                      className="mt-2 w-full py-2 bg-[#ef4444] hover:bg-[#f87171] text-white font-bold rounded-lg text-center cursor-pointer transition"
                    >
                      Inspect Recovery Opportunity in RazorRecover →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEST SCENARIO SIMULATOR */}
        {activeTab === 'scenarios' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">⚡ Razorpay Test Mode Scenarios</h2>
              <p className="text-xs text-[#94a3b8]">
                Execute deterministic Razorpay test conditions to demonstrate end-to-end recovery lifecycles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Scenario 1: Success */}
              <div className="p-5 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-2">🟢</div>
                  <h3 className="font-bold text-white text-sm">1. Successful Capture</h3>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    Standard payment capture using Test Card or instant UPI simulation.
                  </p>
                </div>
                <button
                  onClick={() => handleSimulateScenario('success')}
                  className="w-full py-2.5 bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/50 text-[#6ee7b7] font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Simulate Success ▶
                </button>
              </div>

              {/* Scenario 2: Timeout */}
              <div className="p-5 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-2">🔴</div>
                  <h3 className="font-bold text-white text-sm">2. 3DS Bank Timeout</h3>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    Simulates issuer degradation. Triggers RazorRecover AI high-priority recovery.
                  </p>
                </div>
                <button
                  onClick={() => handleSimulateScenario('timeout')}
                  className="w-full py-2.5 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 border border-[#ef4444]/50 text-[#fca5a5] font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Trigger Failure ▶
                </button>
              </div>

              {/* Scenario 3: Abandonment */}
              <div className="p-5 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-2">🟡</div>
                  <h3 className="font-bold text-white text-sm">3. Checkout Drop-off</h3>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    Customer abandoned modal. RazorRecover dispatches multi-channel payment link.
                  </p>
                </div>
                <button
                  onClick={() => handleSimulateScenario('abandon')}
                  className="w-full py-2.5 bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border border-[#f59e0b]/50 text-[#fde68a] font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Simulate Drop-off ▶
                </button>
              </div>
            </div>

            {/* Scenario Feedback Result */}
            {(paymentSuccessData || paymentFailureError) && (
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#334155] space-y-3 font-mono text-xs">
                <div className="text-white font-bold">Scenario Execution Result:</div>
                {paymentSuccessData && (
                  <div className="text-[#6ee7b7]">
                    ✓ Payment Captured: {paymentSuccessData.paymentId} | Invoice: {invoiceRef} (Status: RECOVERED / VERIFIED)
                  </div>
                )}
                {paymentFailureError && (
                  <div className="text-[#fca5a5]">
                    ⚠️ Payment Failed: {paymentFailureError.code} — {paymentFailureError.description}
                  </div>
                )}
                {onNavigateToRazorRecover && (
                  <button
                    onClick={() => onNavigateToRazorRecover('Opportunities', invoiceRef)}
                    className="px-4 py-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Switch to RazorRecover AI Cockpit →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMER RECOVERY PORTAL */}
        {activeTab === 'recovery' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">📬 Customer Invoice Recovery Portal</h2>
              <p className="text-xs text-[#94a3b8]">
                B2B Buyer portal for reviewing and settling outstanding payment recovery links.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0b132b] border border-[#1e293b] space-y-4">
              <div className="flex justify-between items-start border-b border-[#1e293b] pb-4">
                <div>
                  <div className="text-sm font-bold text-white">{companyName}</div>
                  <div className="text-xs text-[#94a3b8]">Invoice #{invoiceRef}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-[#38bdf8]">{formatINR(selectedPlan.amountRupees)}</div>
                  <div className="text-[10px] text-[#64748b]">Due Immediately</div>
                </div>
              </div>

              {linkedTxn?.recovery_operation_id ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0f1d40] border border-[#38bdf8]/40 text-xs space-y-2">
                    <div className="text-[#38bdf8] font-bold flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>RazorRecover Smart Retry Link Ready</span>
                    </div>
                    <div className="text-[#94a3b8] text-[11px]">
                      Operation ID: <span className="text-white font-mono">{linkedTxn.recovery_operation_id}</span>
                    </div>
                    <div className="text-[#94a3b8] text-[11px]">
                      Policy Status: <span className="text-[#10b981] font-bold">Approved (Cooling-off cleared)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleInitiatePayment}
                    disabled={orderProcessing}
                    className="w-full py-3 px-4 bg-[#10b981] hover:bg-[#34d399] text-[#064e3b] font-bold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <span>💳 Complete Recovery Pay with Razorpay Test Mode ▶</span>
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center text-[#64748b] text-xs space-y-2">
                  <div>No pending recovery link issued yet for this invoice.</div>
                  <div className="text-[11px]">
                    Trigger a payment failure in <strong>Customer Checkout</strong> or <strong>Test Scenarios</strong> to observe RazorRecover AI evaluate and issue recovery links.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
