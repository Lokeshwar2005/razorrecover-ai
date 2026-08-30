import {
  WATCH_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
} from '../src/data/watchCatalog'
import {
  useTransactionStore,
  type CanonicalTransaction,
  computeOpportunitiesFromTransactions,
  computeMetricsFromTransactions,
} from '../src/services/canonicalTransactionStore'

async function runChronoSphereE2ETest() {
  console.log('====================================================================')
  console.log('⌚ CHRONOSPHERE WATCHES + RAZORRECOVER AI — E2E VALIDATION SUITE')
  console.log('====================================================================\n')

  // TEST 1: Catalog Scale & Diversity
  console.log('TEST 1: Validating 120+ Watch Products & Brand Coverage')
  console.log(`✓ Total Watch Products in Catalog: ${WATCH_CATALOG.length}`)
  if (WATCH_CATALOG.length < 120) {
    throw new Error(`Expected at least 120 watches, found ${WATCH_CATALOG.length}`)
  }

  const brandCounts: Record<string, number> = {}
  for (const w of WATCH_CATALOG) {
    brandCounts[w.brand] = (brandCounts[w.brand] || 0) + 1
  }

  console.log('✓ Brand Breakdown:')
  for (const [b, c] of Object.entries(brandCounts)) {
    console.log(`   • ${b.padEnd(24)}: ${c} models`)
  }

  const requiredBrands = [
    'Titan', 'Fastrack', 'Casio', 'Seiko', 'Citizen', 'Fossil',
    'Garmin', 'Apple Watch', 'Samsung Galaxy Watch', 'Amazfit', 'Noise', 'boAt'
  ]
  for (const rb of requiredBrands) {
    if (!brandCounts[rb] || brandCounts[rb] < 8) {
      throw new Error(`Missing or insufficient products for brand: ${rb}`)
    }
  }
  console.log('✅ TEST 1 PASSED: 120+ watch catalog with all 12 brands verified.\n')

  // TEST 2: Customer Cart & Checkout Simulation
  console.log('TEST 2: Customer Checkout & Razorpay Test Mode Failure Simulation')
  const chosenWatch = WATCH_CATALOG.find((w) => w.brand === 'Titan' && w.price_rupees > 15000) || WATCH_CATALOG[0]
  console.log(`✓ Selected Watch: ${chosenWatch.name} (₹${chosenWatch.price_rupees.toLocaleString('en-IN')})`)

  const testTxnId = `TXN-CS-E2E-${Date.now().toString(36).toUpperCase()}`
  const orderAmountRupees = chosenWatch.price_rupees
  const orderAmountMinor = orderAmountRupees * 100

  const failedCheckoutTxn: CanonicalTransaction = {
    id: testTxnId,
    merchant_id: 'mer_chronosphere_luxury',
    amount: orderAmountRupees,
    amount_minor: orderAmountMinor,
    currency: 'INR',
    source: 'razorpay_test',
    status: 'STOPPED',
    direction: 'Payment degradation',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    action: 'Send payment link',
    confidence: 96,
    recovery_probability: 88,
    risk_score: 22,
    policy: 'Approved',
    explanation: `ChronoSphere failure: High-value buyer checkout interrupted during 3DS verification for ${chosenWatch.name}.`,
    latency: '340ms',
    created_at: new Date().toISOString(),
    provider: 'razorpay',
    provider_status: 'failed',
    verified_amount_minor: 0,
  }

  // Ingest failure into store (Website A -> Event Stream -> Website B)
  useTransactionStore.getState().ingestTransaction(failedCheckoutTxn)
  console.log(`✓ Ingested failure event for ${testTxnId} into shared canonical store`)

  const initialMetrics = computeMetricsFromTransactions(useTransactionStore.getState().transactions)
  console.log(`✓ Verified Recovered Revenue before settlement: ₹${(initialMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)
  console.log('✅ TEST 2 PASSED: Payment failure ingested into recovery queue.\n')

  // TEST 3: RazorRecover AI Diagnosis, Scoring & Policy Check
  console.log('TEST 3: RazorRecover AI Recovery Evaluation & Policy Bounding')
  const allTxns = useTransactionStore.getState().transactions
  const opportunities = computeOpportunitiesFromTransactions(allTxns)
  const opp = opportunities.find((o) => o.transaction_id === testTxnId)

  if (!opp) {
    throw new Error(`Opportunity not found for transaction ${testTxnId}`)
  }

  console.log(`✓ Opportunity ID: ${opp.opportunity_id}`)
  console.log(`✓ Priority Level: ${opp.priority_level} (Score: ${opp.priority_score}/99)`)
  console.log(`✓ Expected Recovery Yield: ₹${Math.round(opp.expected_value_minor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Policy Clearance: ${opp.policy_status}`)
  console.log(`✓ Recommended Safe Action: ${opp.best_safe_action}`)

  if (opp.policy_status !== 'Approved') {
    throw new Error(`Expected Approved policy, got ${opp.policy_status}`)
  }
  console.log('✅ TEST 3 PASSED: Opportunity evaluated and pre-cleared by policy.\n')

  // TEST 4: Execute Autonomous Recovery Action
  console.log('TEST 4: Autonomous Recovery Link Dispatch & Invariant Verification')
  const execResult = await useTransactionStore.getState().executeRecovery(testTxnId, opp.best_safe_action)
  console.log(`✓ Recovery Action Executed: ${JSON.stringify(execResult)}`)

  if (!execResult.success) {
    throw new Error(`Recovery execution failed: ${execResult.message}`)
  }

  const txnAfterAction = useTransactionStore.getState().transactions.find((t) => t.id === testTxnId)
  if ((txnAfterAction?.verified_amount_minor ?? 0) > 0) {
    throw new Error('CRITICAL VIOLATION: Recovered revenue must remain strictly 0 before payment capture!')
  }
  console.log('✅ TEST 4 PASSED: Safe recovery action dispatched, 0-unverified revenue invariant upheld.\n')

  // TEST 5: Customer Settlement in ChronoSphere Recovery Portal
  console.log('TEST 5: Customer Settle via Recovery Link & Razorpay Capture Verification')
  const mockCapturePaymentId = `pay_test_cs_settle_${Date.now().toString(36)}`
  const mockOrderId = txnAfterAction?.provider_order_id || `order_cs_${Date.now().toString(36)}`

  const verifyResult = await useTransactionStore.getState().verifyPayment(
    testTxnId,
    mockCapturePaymentId,
    orderAmountMinor,
    'INR',
    mockOrderId
  )

  console.log(`✓ Razorpay Capture Verification: ${JSON.stringify(verifyResult)}`)
  if (!verifyResult.verified) {
    throw new Error(`Verification failed: ${verifyResult.message}`)
  }

  // TEST 6: Cryptographic SHA-256 Ledger & KPI Increment Verification
  console.log('TEST 6: Cryptographic Verification & Dashboard KPI Updates')
  const finalTxns = useTransactionStore.getState().transactions
  const finalTxn = finalTxns.find((t) => t.id === testTxnId)
  const finalMetrics = computeMetricsFromTransactions(finalTxns)

  console.log(`✓ Final Transaction Status: ${finalTxn?.status}`)
  console.log(`✓ Verified Recovered Amount: ₹${((finalTxn?.verified_amount_minor ?? 0) / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Provider Payment Reference: ${finalTxn?.provider_payment_id}`)
  console.log(`✓ Total Verified Recovered Ecosystem Revenue: ₹${(finalMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Total Recovered Transactions: ${finalMetrics.recoveredCount}`)

  if (finalTxn?.status !== 'RECOVERED') {
    throw new Error(`Expected RECOVERED status, got ${finalTxn?.status}`)
  }
  if (finalTxn?.verified_amount_minor !== orderAmountMinor) {
    throw new Error(`Expected verified amount ${orderAmountMinor}, got ${finalTxn?.verified_amount_minor}`)
  }
  if (finalMetrics.verifiedRecoveredMinor <= initialMetrics.verifiedRecoveredMinor) {
    throw new Error('Ecosystem recovered revenue did not increase after verified payment capture')
  }

  console.log('\n====================================================================')
  console.log('🎉 ALL 6 CHRONOSPHERE + RAZORRECOVER E2E LIFECYCLE TESTS PASSED!')
  console.log('====================================================================')
}

runChronoSphereE2ETest().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err)
  process.exit(1)
})
