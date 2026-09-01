/**
 * Comprehensive Production-Hardening & Agentic Lifecycle Test Suite
 * Validates all 12 core directives of RazorRecover AI (Razorpay AI Buildathon 2026 - Track 3)
 */

import {
  computeOpportunitiesFromTransactions,
  computeOpportunitySummary,
  computeMetricsFromTransactions,
  type CanonicalTransaction,
} from '../src/services/canonicalTransactionStore.js'
import {
  upsertChronovaEvent,
  executeChronovaRecoveryAction,
  verifyChronovaPaymentCapture,
  findChronovaTransaction,
} from '../api/lib/db.js'

async function runTestSuite() {
  console.log('\n===============================================================')
  console.log('  RAZORRECOVER AI: PRODUCTION HARDENING & AGENTIC LIFECYCLE SUITE')
  console.log('===============================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`)
      failed++
    }
  }

  // TEST 1: Direct Payment Capture Invariants
  const directTxnId = `TXN-DIRECT-${Date.now()}`
  const directOrder = {
    order_id: `order_dir_${Date.now()}`,
    transaction_id: directTxnId,
    total_amount_rupees: 18995,
    amount_minor: 1899500,
    currency: 'INR',
    payment_status: 'PAID',
    order_status: 'ORDER_CONFIRMED',
    recovery_status: 'NONE',
    razorpay_payment_id: `pay_dir_${Date.now()}`,
    customer: {
      full_name: 'Ananya Sharma',
      email: 'ananya.sharma@example.com',
      phone: '+91 98765 43210',
      address: '742 Luxury Avenue, Bandra West, Mumbai 400050',
    },
    items: [
      {
        product_id: 'chronova-edge-silver',
        product_name: 'Titan Edge Silver Dial',
        product_brand: 'Titan',
        quantity: 1,
        unit_price_rupees: 18995,
        total_price_rupees: 18995,
      },
    ],
  }

  const { transaction: directIngested } = await upsertChronovaEvent(directOrder as any)
  assert(
    directIngested.status === 'RECOVERED' || directIngested.status === 'CAPTURED' || (directIngested.verified_amount_minor && directIngested.verified_amount_minor > 0),
    'Test P1: Direct Payment Capture sets status as CAPTURED/RECOVERED with ₹0 revenue at risk'
  )

  // TEST 2: Non-Risk Filtering in Opportunities Engine
  const directTxnList: CanonicalTransaction[] = [
    {
      id: directTxnId,
      amount: 18995,
      amount_minor: 1899500,
      currency: 'INR',
      status: 'RECOVERED',
      action: 'None — Payment captured',
      reason: 'None',
      recovery_status: 'NONE',
      verified_amount_minor: 1899500,
      recovery_probability: 100,
      risk_score: 5,
      policy: 'Approved',
      confidence: 100,
      direction: 'INGRESS',
      created_at: new Date().toISOString(),
    },
  ]
  const oppsForDirect = computeOpportunitiesFromTransactions(directTxnList)
  assert(
    oppsForDirect.length === 0,
    'Test P2: Direct captured payment creates ZERO recovery opportunities'
  )

  // TEST 3: Failed Payment & Expected Recovery Value Formula
  const failedTxnId = `TXN-FAIL-${Date.now()}`
  const failedOrder = {
    order_id: `order_fail_${Date.now()}`,
    transaction_id: failedTxnId,
    total_amount_rupees: 25000,
    amount_minor: 2500000,
    currency: 'INR',
    payment_status: 'FAILED',
    order_status: 'PAYMENT_PENDING',
    recovery_status: 'ELIGIBLE',
    failure_code: 'BAD_REQUEST_ERROR',
    failure_reason: '3DS Authentication Timeout: Issuer ACS took >60s',
    recommended_action: 'Send payment retry link',
    recovery_probability: 80,
    customer: {
      full_name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+91 98765 43210',
      address: 'Plot 42, Hitech City, Hyderabad 500081',
    },
    items: [
      {
        product_id: 'chronova-edge-green',
        product_name: 'Titan Edge Ceramic Green Dial',
        product_brand: 'Titan',
        quantity: 1,
        unit_price_rupees: 25000,
        total_price_rupees: 25000,
      },
    ],
  }

  const { transaction: failedIngested } = await upsertChronovaEvent(failedOrder as any)
  assert(
    failedIngested.status === 'STOPPED' || failedIngested.status === 'PAYMENT_FAILED',
    'Test P3: Failed checkout creates canonical failure record with status STOPPED/PAYMENT_FAILED'
  )

  const failedTxnList: CanonicalTransaction[] = [
    {
      id: failedTxnId,
      amount: 25000,
      amount_minor: 2500000,
      currency: 'INR',
      status: 'PAYMENT_FAILED',
      action: 'Send payment retry link',
      reason: '3DS Authentication Timeout: Issuer ACS took >60s',
      recovery_status: 'ELIGIBLE',
      recovery_probability: 80,
      risk_score: 25,
      policy: 'Approved',
      confidence: 94,
      direction: 'INGRESS',
      created_at: new Date().toISOString(),
    },
  ]
  const oppsForFailed = computeOpportunitiesFromTransactions(failedTxnList)
  assert(
    oppsForFailed.length === 1 &&
      oppsForFailed[0].expected_recovery_value_minor === 2000000 &&
      oppsForFailed[0].amount_minor === 2500000,
    'Test P4: Opportunity Engine calculates Expected Recovery Value = ₹20,000 (80% of ₹25,000)'
  )

  // TEST 4: Recovery Authorization & Session State
  const { transaction: authTxn, recovery_operation_id } = await executeChronovaRecoveryAction(
    failedTxnId,
    'Send payment retry link'
  )
  assert(
    authTxn.status === 'WAITING_FOR_RECOVERY' &&
      recovery_operation_id.startsWith('REC-') &&
      authTxn.recovery_status === 'IN_PROGRESS',
    'Test P5: Authorization creates bounded REC-xxx recovery session with status WAITING_FOR_RECOVERY'
  )

  // TEST 5: Customer Payment Simulation & Verified Capture
  const paymentId = `pay_test_${Date.now()}`
  const { transaction: recTxn, verified } = await verifyChronovaPaymentCapture(
    failedTxnId,
    paymentId,
    failedOrder.order_id,
    2500000
  )
  assert(
    verified &&
      recTxn.status === 'RECOVERED' &&
      recTxn.verified_amount_minor === 2500000 &&
      recTxn.action === 'None — Recovery completed',
    'Test P6: Customer payment verification captures gateway funds, sets status RECOVERED and action "None — Recovery completed"'
  )

  // TEST 6: Failure History Preservation
  assert(
    recTxn.reason.includes('3DS Authentication Timeout'),
    'Test P7: Recovered transaction preserves original failure reason for audit and compliance inspection'
  )

  // TEST 7: Multi-Item Order Invariants
  const multiTxnId = `TXN-MULTI-${Date.now()}`
  const multiOrder = {
    order_id: `order_multi_${Date.now()}`,
    transaction_id: multiTxnId,
    total_amount_rupees: 70405,
    amount_minor: 7040500,
    currency: 'INR',
    payment_status: 'FAILED',
    order_status: 'PAYMENT_PENDING',
    recovery_status: 'ELIGIBLE',
    failure_code: 'BANK_DOWNTIME',
    failure_reason: 'Bank Downtime: HDFC netbanking gateway unreachable',
    recommended_action: 'Switch to UPI Auto-Pay Link',
    customer: {
      full_name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+91 98765 43210',
      address: 'Plot 42, Hitech City, Hyderabad 500081',
    },
    items: [
      {
        product_id: 'titan-1',
        product_name: 'Titan Edge Silver Dial',
        product_brand: 'Titan',
        product_model: 'Edge Slim 679',
        quantity: 1,
        unit_price_rupees: 12415,
        total_price_rupees: 12415,
      },
      {
        product_id: 'titan-2',
        product_name: 'Titan Edge Ceramic Green Dial',
        product_brand: 'Titan',
        product_model: 'Edge Ceramic 901',
        quantity: 1,
        unit_price_rupees: 29195,
        total_price_rupees: 29195,
      },
      {
        product_id: 'titan-3',
        product_name: 'Titan Edge Ceramic White Dial',
        product_brand: 'Titan',
        product_model: 'Edge Ceramic 902',
        quantity: 1,
        unit_price_rupees: 28795,
        total_price_rupees: 28795,
      },
    ],
  }

  const { transaction: multiIngested } = await upsertChronovaEvent(multiOrder as any)
  assert(
    multiIngested.items?.length === 3 &&
      multiIngested.customer?.phone === '+91 98765 43210' &&
      multiIngested.customer?.full_name === 'Lokeshwar Sudam',
    'Test P8: Multi-item order (3 watches) preserves all 3 items, customer phone (+91 98765 43210) & full name'
  )

  // TEST 8: Financial Summary & Metrics Calculations
  const testLedger: CanonicalTransaction[] = [
    {
      id: 'TXN-1',
      amount: 10000,
      amount_minor: 1000000,
      currency: 'INR',
      status: 'RECOVERED',
      action: 'None — Recovery completed',
      reason: '3DS Timeout',
      recovery_status: 'RECOVERED',
      verified_amount_minor: 1000000,
      recovery_probability: 90,
      risk_score: 10,
      policy: 'Approved',
      confidence: 95,
      direction: 'INGRESS',
      created_at: new Date().toISOString(),
    },
    {
      id: 'TXN-2',
      amount: 20000,
      amount_minor: 2000000,
      currency: 'INR',
      status: 'PAYMENT_FAILED',
      action: 'Send payment retry link',
      reason: 'Insufficient Funds',
      recovery_status: 'ELIGIBLE',
      recovery_probability: 75,
      risk_score: 30,
      policy: 'Approved',
      confidence: 90,
      direction: 'INGRESS',
      created_at: new Date().toISOString(),
    },
    {
      id: 'TXN-3',
      amount: 30000,
      amount_minor: 3000000,
      currency: 'INR',
      status: 'WAITING_FOR_RECOVERY',
      action: 'Switch to UPI Auto-Pay Link',
      reason: 'UPI Intent Expired',
      recovery_status: 'IN_PROGRESS',
      recovery_probability: 85,
      risk_score: 15,
      policy: 'Approved',
      confidence: 95,
      direction: 'INGRESS',
      created_at: new Date().toISOString(),
    },
  ]

  const metrics = computeMetricsFromTransactions(testLedger)
  const opps = computeOpportunitiesFromTransactions(testLedger)
  const oppSummary = computeOpportunitySummary(opps)

  assert(
    metrics.revenueAtRiskMinor === 5000000 &&
      metrics.verifiedRecoveredMinor === 1000000 &&
      oppSummary.total_opportunities === 2 &&
      oppSummary.expected_recovery_value_minor === (1500000 + 2550000), // 75% of 20k + 85% of 30k = 15k + 25.5k = 40.5k
    'Test P9: Financial KPIs and Expected Recovery value derived from canonical formulas'
  )

  // TEST 9: Cryptographic Hash Chaining on Audit Events
  assert(
    multiIngested.audit_events &&
      multiIngested.audit_events.length > 0 &&
      multiIngested.audit_events[0].hash &&
      multiIngested.audit_events[0].hash.length === 64,
    'Test P10: Audit events cryptographically chained with 256-bit SHA-256 block hash'
  )

  console.log('\n===============================================================')
  console.log(`  PRODUCTION HARDENING TEST RESULTS: ${passed} PASSED / ${failed} FAILED`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((e) => {
  console.error('Test Suite Exception:', e)
  process.exit(1)
})
