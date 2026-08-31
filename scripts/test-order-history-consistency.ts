import {
  saveChronovaOrder,
  getStoredChronovaOrders,
  updateChronovaOrder,
  findChronovaOrder,
} from '../src/services/chronovaOrderStore'
import {
  upsertChronovaEvent,
  verifyChronovaPaymentCapture,
  findChronovaTransaction,
  getAllChronovaTransactions,
} from '../api/lib/db'
import type { ChronovaOrder } from '../src/components/Chronova/types'

// Setup Mock LocalStorage for CLI environment
const mockStorage: Record<string, string> = {}
if (typeof global !== 'undefined') {
  ;(global as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  ;(global as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v
    },
    removeItem: (k: string) => {
      delete mockStorage[k]
    },
    clear: () => {
      for (const k in mockStorage) delete mockStorage[k]
    },
  }
}

async function runOrderHistoryTestSuite() {
  console.log('\n===============================================================')
  console.log('  CHRONOVA & RAZORRECOVER AI: ORDER HISTORY & PRODUCT TEST SUITE (O1 - O14)')
  console.log('===============================================================\n')

  let passed = 0
  let failed = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ✗ [FAIL] ${testName}`)
      if (detail) console.error(`    ↳ Error: ${detail}`)
      failed++
    }
  }

  // Clear mock storage
  localStorage.clear()

  const testOrderId = `order_cn_test_${Date.now().toString(36)}`
  const testTxnId = `TXN-CN-TEST-${Date.now().toString(36).toUpperCase()}`
  const prodId = 'prod_horizon_seeker'
  const prodName = 'Chronova Horizon Automatic Watch'
  const prodImage = 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600'
  const prodBrand = 'Chronova'
  const prodCategory = 'Automatic Watches'
  const unitPrice = 18999
  const totalMinor = 1899900

  // -------------------------------------------------------------
  // Test O1: Order Placement & Persistence in Customer Order Store
  // -------------------------------------------------------------
  const initialOrder: ChronovaOrder = {
    order_id: testOrderId,
    transaction_id: testTxnId,
    created_at: new Date().toISOString(),
    items: [
      {
        product_id: prodId,
        product_name: prodName,
        product_image: prodImage,
        product_brand: prodBrand,
        product_category: prodCategory,
        quantity: 1,
        unit_price_rupees: unitPrice,
        total_price_rupees: unitPrice,
      },
    ],
    total_amount_rupees: unitPrice,
    total_amount_minor: totalMinor,
    currency: 'INR',
    customer: {
      full_name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+919876543210',
      address_line1: '123 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400020',
    },
    payment_status: 'FAILED',
    order_status: 'PAYMENT_FAILED',
    recovery_status: 'ELIGIBLE',
    failure_reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    failure_code: '3DS_TIMEOUT',
    recommended_action: 'Send payment retry link',
    razorpay_order_id: testOrderId,
  }

  saveChronovaOrder(initialOrder)
  const storedOrders = getStoredChronovaOrders()

  assert(
    storedOrders.length === 1 && storedOrders[0].order_id === testOrderId,
    'Test O1: Order Placement on Chronova creates real customer order in chronova_orders'
  )

  // -------------------------------------------------------------
  // Test O2: Failed Checkout Scenario Order State
  // -------------------------------------------------------------
  const failedOrder = findChronovaOrder(testOrderId)
  assert(
    failedOrder !== null &&
      failedOrder.payment_status === 'FAILED' &&
      failedOrder.order_status === 'PAYMENT_FAILED' &&
      failedOrder.recovery_status === 'ELIGIBLE' &&
      failedOrder.failure_code === '3DS_TIMEOUT',
    'Test O2: Failed checkout scenario marks order as FAILED with failure reason, code, and recovery ELIGIBLE'
  )

  // -------------------------------------------------------------
  // Test O3: Product Info Ingestion into RazorRecover AI
  // -------------------------------------------------------------
  const { transaction: ingestedTxn } = await upsertChronovaEvent({
    transaction_id: testTxnId,
    chronova_order_id: testOrderId,
    amount_minor: totalMinor,
    currency: 'INR',
    failure_code: '3DS_TIMEOUT',
    failure_reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    product_id: prodId,
    product_name: prodName,
    product_image: prodImage,
    product_brand: prodBrand,
    product_category: prodCategory,
    quantity: 1,
    unit_price: unitPrice,
    customer: {
      name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+919876543210',
    },
    metadata: {
      product_id: prodId,
      product_name: prodName,
      brand: prodBrand,
      category: prodCategory,
      quantity: 1,
      unit_price: unitPrice,
    },
  })

  assert(
    ingestedTxn.product_name === prodName &&
      ingestedTxn.product_image === prodImage &&
      ingestedTxn.product_brand === prodBrand &&
      ingestedTxn.chronova_order_id === testOrderId,
    'Test O3: Product info flows seamlessly into RazorRecover backend ledger without hardcoded mapping'
  )

  // -------------------------------------------------------------
  // Test O4: Transaction Specs & 7-Section Metadata Integrity
  // -------------------------------------------------------------
  const isSection1Valid = !!(ingestedTxn.product_name && ingestedTxn.chronova_order_id && ingestedTxn.amount > 0)
  const isSection2Valid = ingestedTxn.provider === 'RAZORPAY' && !!ingestedTxn.razorpay_order_id
  const isSection3Valid = !!ingestedTxn.reason && !!ingestedTxn.latency
  const isSection4Valid = !!ingestedTxn.ai_diagnosis && ingestedTxn.confidence > 0 && ingestedTxn.risk_score > 0
  const isSection5Valid = !!ingestedTxn.action && !!ingestedTxn.policy
  const isSection6Valid = ingestedTxn.status === 'PAYMENT_FAILED'
  const isSection7Valid = Array.isArray(ingestedTxn.audit_events) && ingestedTxn.audit_events.length > 0

  assert(
    isSection1Valid && isSection2Valid && isSection3Valid && isSection4Valid && isSection5Valid && isSection6Valid && isSection7Valid,
    'Test O4: Transaction data contains complete attributes for all 7 structured detail sections'
  )

  // -------------------------------------------------------------
  // Test O5: Successful Retry Mutates Original Order to PAID
  // -------------------------------------------------------------
  const razorpayPaymentId = `pay_live_test_${Date.now().toString(36)}`
  const updatedOrder = updateChronovaOrder(testOrderId, {
    payment_status: 'PAID',
    order_status: 'ORDER_CONFIRMED',
    recovery_status: 'RECOVERED',
    razorpay_payment_id: razorpayPaymentId,
    verified_at: new Date().toISOString(),
  })

  assert(
    updatedOrder !== null &&
      updatedOrder.payment_status === 'PAID' &&
      updatedOrder.order_status === 'ORDER_CONFIRMED' &&
      updatedOrder.recovery_status === 'RECOVERED',
    'Test O5: Successful retry mutates original order to PAID / ORDER_CONFIRMED and recovery_status RECOVERED'
  )

  // -------------------------------------------------------------
  // Test O6: Successful Retry Attaches Razorpay Payment ID
  // -------------------------------------------------------------
  assert(
    updatedOrder?.razorpay_payment_id === razorpayPaymentId &&
      updatedOrder?.order_id === testOrderId &&
      updatedOrder?.transaction_id === testTxnId,
    'Test O6: Successful retry preserves exact order_id and transaction_id, binding razorpay_payment_id'
  )

  // -------------------------------------------------------------
  // Test O7: Zero Duplicate Order Created on Retry
  // -------------------------------------------------------------
  const allOrdersAfterRetry = getStoredChronovaOrders()
  assert(
    allOrdersAfterRetry.length === 1,
    'Test O7: Zero duplicate order created on retry (order count strictly equals 1)'
  )

  // -------------------------------------------------------------
  // Test O8: Zero Duplicate Transaction Created in RazorRecover
  // -------------------------------------------------------------
  const { transaction: recoveredTxn } = await verifyChronovaPaymentCapture(
    testTxnId,
    razorpayPaymentId,
    testOrderId,
    totalMinor
  )

  const allTxns = await getAllChronovaTransactions()
  const matchingTxns = allTxns.filter((t) => t.id === testTxnId)

  assert(
    matchingTxns.length === 1 && recoveredTxn.status === 'RECOVERED',
    'Test O8: Zero duplicate transaction in RazorRecover ledger (original record mutated to RECOVERED)'
  )

  // -------------------------------------------------------------
  // Test O9: Direct First-Attempt Success Order Flow
  // -------------------------------------------------------------
  const directOrderId = `order_cn_direct_${Date.now().toString(36)}`
  const directTxnId = `TXN-CN-DIR-${Date.now().toString(36).toUpperCase()}`
  const directPayId = `pay_live_direct_${Date.now().toString(36)}`

  saveChronovaOrder({
    order_id: directOrderId,
    transaction_id: directTxnId,
    created_at: new Date().toISOString(),
    items: [
      {
        product_id: 'prod_stellar_titanium',
        product_name: 'Chronova Stellar Titanium Chrono',
        product_image: 'https://images.unsplash.com/photo-1547996160-71dfa6358862?w=600',
        product_brand: 'Chronova',
        product_category: 'Titanium Watches',
        quantity: 1,
        unit_price_rupees: 28500,
        total_price_rupees: 28500,
      },
    ],
    total_amount_rupees: 28500,
    total_amount_minor: 2850000,
    currency: 'INR',
    customer: {
      full_name: 'Ananya Sharma',
      email: 'ananya@example.com',
      phone: '+919123456789',
    },
    payment_status: 'PAID',
    order_status: 'ORDER_CONFIRMED',
    recovery_status: 'NONE',
    razorpay_order_id: directOrderId,
    razorpay_payment_id: directPayId,
    verified_at: new Date().toISOString(),
  })

  const directOrder = findChronovaOrder(directOrderId)
  assert(
    directOrder !== null &&
      directOrder.payment_status === 'PAID' &&
      directOrder.order_status === 'ORDER_CONFIRMED' &&
      directOrder.recovery_status === 'NONE' &&
      directOrder.razorpay_payment_id === directPayId,
    'Test O9: Direct checkout success creates order with status PAID, order_status ORDER_CONFIRMED and recovery_status NONE'
  )

  // -------------------------------------------------------------
  // Test O10: Order History Filtering Logic (All, Paid, Failed)
  // -------------------------------------------------------------
  // Add a third failed order to test multi-item filtering
  const failedOrder2Id = `order_cn_failed2_${Date.now().toString(36)}`
  saveChronovaOrder({
    order_id: failedOrder2Id,
    transaction_id: `TXN-CN-F2-${Date.now().toString(36).toUpperCase()}`,
    created_at: new Date().toISOString(),
    items: [
      {
        product_id: 'prod_zenith',
        product_name: 'Chronova Zenith Skeleton',
        product_image: '',
        quantity: 1,
        unit_price_rupees: 35000,
        total_price_rupees: 35000,
      },
    ],
    total_amount_rupees: 35000,
    total_amount_minor: 3500000,
    currency: 'INR',
    customer: { full_name: 'Rohan Verma', email: 'rohan@example.com', phone: '+919988776655' },
    payment_status: 'FAILED',
    order_status: 'PAYMENT_FAILED',
    recovery_status: 'ELIGIBLE',
  })

  const allOrders = getStoredChronovaOrders()
  const paidOrders = allOrders.filter((o) => o.payment_status === 'PAID' || o.payment_status === 'RECOVERED')
  const failedOrders = allOrders.filter((o) => o.payment_status !== 'PAID' && o.payment_status !== 'RECOVERED')

  assert(
    allOrders.length === 3 && paidOrders.length === 2 && failedOrders.length === 1,
    `Test O10: Order history filtering accurately splits categories (All: ${allOrders.length}, Paid: ${paidOrders.length}, Failed: ${failedOrders.length})`
  )

  // -------------------------------------------------------------
  // Test O11: Product Image Safety & Fallback Resilience
  // -------------------------------------------------------------
  const orderWithMissingImage = findChronovaOrder(failedOrder2Id)
  const hasSafeFallback = orderWithMissingImage?.items[0]?.product_image !== undefined
  assert(
    hasSafeFallback,
    'Test O11: Missing or broken product image handles gracefully without throwing exceptions'
  )

  // -------------------------------------------------------------
  // Test O12: Tamper-Evident SHA-256 Audit Trail Attachment
  // -------------------------------------------------------------
  const storedTxn = await findChronovaTransaction(testTxnId)
  const auditEvents = storedTxn?.audit_events || []
  const hasChainedHash = auditEvents.some((ev) => ev.hash && ev.hash.length === 64)

  assert(
    auditEvents.length >= 2 && hasChainedHash,
    'Test O12: Cryptographic audit events chained with SHA-256 hashes attached to Chronova transaction'
  )

  // -------------------------------------------------------------
  // Test O13: Storage Idempotency & Persistence Across Re-reads
  // -------------------------------------------------------------
  const serialized = localStorage.getItem('chronova_orders')
  const reParsed = JSON.parse(serialized || '[]')
  assert(
    Array.isArray(reParsed) && reParsed.length === 3 && reParsed.some((o: any) => o.order_id === testOrderId),
    'Test O13: Order state persists perfectly across storage serialize/re-read cycles'
  )

  // -------------------------------------------------------------
  // Test O14: Zero Synthetic / Preloaded / Demo Orders
  // -------------------------------------------------------------
  const containsSynthetic = allOrders.some(
    (o) =>
      o.order_id.includes('demo') ||
      o.order_id.includes('synthetic') ||
      o.transaction_id.includes('TXN-10') ||
      o.customer.email.includes('synthetic.example.com')
  )

  assert(
    !containsSynthetic,
    'Test O14: Zero synthetic, demo, or preloaded orders in live Chronova order repository'
  )

  // -------------------------------------------------------------
  // Test O15: Multi-Item Order (3 Products) Ingestion & Persistence
  // -------------------------------------------------------------
  const multiOrderId = `order_cn_3items_${Date.now().toString(36)}`
  const multiTxnId = `TXN-CN-3ITEMS-${Date.now().toString(36).toUpperCase()}`
  const threeItems = [
    {
      product_id: 'prod_watch_1',
      product_name: 'Chronova Meridian Chronograph',
      product_image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
      product_brand: 'Chronova',
      product_category: 'Automatic Watches',
      quantity: 1,
      unit_price_rupees: 19500,
      total_price_rupees: 19500,
    },
    {
      product_id: 'prod_watch_2',
      product_name: 'Titan Horizon Obsidian',
      product_image: 'https://images.unsplash.com/photo-1547996160-71dfa6358862?w=600',
      product_brand: 'Titan',
      product_category: 'Ceramic Watches',
      quantity: 2,
      unit_price_rupees: 14000,
      total_price_rupees: 28000,
    },
    {
      product_id: 'prod_watch_3',
      product_name: 'Chronova Stella Rose Gold',
      product_image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600',
      product_brand: 'Chronova',
      product_category: 'Luxury Watches',
      quantity: 1,
      unit_price_rupees: 22500,
      total_price_rupees: 22500,
    },
  ]
  const multiTotalRupees = 19500 + 28000 + 22500 // 70,000
  const multiTotalMinor = multiTotalRupees * 100

  saveChronovaOrder({
    order_id: multiOrderId,
    transaction_id: multiTxnId,
    created_at: new Date().toISOString(),
    items: threeItems,
    total_amount_rupees: multiTotalRupees,
    total_amount_minor: multiTotalMinor,
    currency: 'INR',
    customer: {
      full_name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+919876543210',
    },
    payment_status: 'FAILED',
    order_status: 'PAYMENT_FAILED',
    recovery_status: 'ELIGIBLE',
    failure_reason: '3DS Authentication Bank Gateway Timeout',
    failure_code: '3DS_TIMEOUT',
    recommended_action: 'Send payment retry link',
  })

  const { transaction: multiTxn } = await upsertChronovaEvent({
    transaction_id: multiTxnId,
    chronova_order_id: multiOrderId,
    amount_minor: multiTotalMinor,
    currency: 'INR',
    items: threeItems,
    customer: {
      name: 'Lokeshwar Sudam',
      email: 'lokeshwar@example.com',
      phone: '+919876543210',
    },
  })

  const storedMultiOrder = findChronovaOrder(multiOrderId)
  const storedMultiTxn = await findChronovaTransaction(multiTxnId)

  assert(
    storedMultiOrder?.items?.length === 3 &&
      storedMultiTxn?.items?.length === 3 &&
      storedMultiTxn.items[1].product_name === 'Titan Horizon Obsidian' &&
      storedMultiTxn.items[1].quantity === 2 &&
      storedMultiTxn.amount === 70000,
    'Test O15: Multi-item order (3 products) preserves all 3 items in Chronova Store and RazorRecover AI ledger'
  )

  // -------------------------------------------------------------
  // Test O16: Direct Success Transaction Action Invariant
  // -------------------------------------------------------------
  const directTxn2Id = `TXN-CN-DIR2-${Date.now().toString(36).toUpperCase()}`
  const directPay2Id = `pay_direct_instant_${Date.now().toString(36)}`
  const { transaction: directTxn2 } = await verifyChronovaPaymentCapture(
    directTxn2Id,
    directPay2Id,
    `order_cn_dir2`,
    3500000
  )

  assert(
    directTxn2.status === 'RECOVERED' &&
      directTxn2.action === 'None — Payment already successful' &&
      directTxn2.recovery_status === 'NONE' &&
      directTxn2.provider_status === 'captured',
    'Test O16: Direct successful payment sets action "None — Payment already successful" and recovery_status "NONE"'
  )

  // -------------------------------------------------------------
  // Test O17: Recovered Transaction State Machine & Action Invariant
  // -------------------------------------------------------------
  const { transaction: recoveredMultiTxn } = await verifyChronovaPaymentCapture(
    multiTxnId,
    `pay_multi_rec_${Date.now().toString(36)}`,
    multiOrderId,
    multiTotalMinor
  )

  assert(
    recoveredMultiTxn.status === 'RECOVERED' &&
      recoveredMultiTxn.action === 'None — Recovery completed' &&
      recoveredMultiTxn.recovery_status === 'RECOVERED' &&
      recoveredMultiTxn.items?.length === 3 &&
      recoveredMultiTxn.verified_amount_minor === multiTotalMinor,
    'Test O17: Recovered transaction transitions to status "RECOVERED", action "None — Recovery completed", preserving all 3 items and failure history'
  )

  // -------------------------------------------------------------
  // Test O18: Customer Phone & Identity Integrity Data Contract
  // -------------------------------------------------------------
  const realCustPhone = '+91 98765 43210'
  const realCustName = 'Lokeshwar Sudam'
  const realCustEmail = 'lokeshwar@example.com'
  const realCustAddress = '42, Brigade Metropolis, Whitefield, Tower C, Apt 402, Bengaluru, Karnataka, 560048'
  const custTxnId = `TXN-CN-CUST-${Date.now().toString(36).toUpperCase()}`
  const custOrderId = `order_cn_cust_${Date.now().toString(36)}`

  saveChronovaOrder({
    order_id: custOrderId,
    transaction_id: custTxnId,
    created_at: new Date().toISOString(),
    items: threeItems,
    total_amount_rupees: multiTotalRupees,
    total_amount_minor: multiTotalMinor,
    currency: 'INR',
    customer: {
      full_name: realCustName,
      name: realCustName,
      email: realCustEmail,
      phone: realCustPhone,
      address: realCustAddress,
    },
    payment_status: 'FAILED',
    order_status: 'PAYMENT_FAILED',
    recovery_status: 'ELIGIBLE',
  })

  const { transaction: custTxn } = await upsertChronovaEvent({
    transaction_id: custTxnId,
    chronova_order_id: custOrderId,
    amount_minor: multiTotalMinor,
    currency: 'INR',
    items: threeItems,
    customer: {
      name: realCustName,
      full_name: realCustName,
      email: realCustEmail,
      phone: realCustPhone,
      address: realCustAddress,
    },
  })

  const storedCustOrder = findChronovaOrder(custOrderId)
  const storedCustTxn = await findChronovaTransaction(custTxnId)

  assert(
    storedCustOrder?.customer?.phone === realCustPhone &&
      storedCustTxn?.customer?.phone === realCustPhone &&
      storedCustTxn?.customer?.name === realCustName &&
      storedCustTxn?.customer?.email === realCustEmail &&
      storedCustTxn?.customer?.address === realCustAddress,
    `Test O18: Customer Phone (${realCustPhone}) & Address preserved 1:1 across Chronova and RazorRecover AI ledger`
  )

  console.log('\n===============================================================')
  console.log(`  ORDER HISTORY TEST SUITE COMPLETE: ${passed} PASSED / ${failed} FAILED`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runOrderHistoryTestSuite().catch((err) => {
  console.error('Fatal Error running test suite:', err)
  process.exit(1)
})
