import {
  CHRONOVA_CATALOG,
} from '../src/data/chronovaCatalog'
import {
  useTransactionStore,
  type CanonicalTransaction,
  computeOpportunitiesFromTransactions,
  computeMetricsFromTransactions,
} from '../src/services/canonicalTransactionStore'

async function runChronovaRecoveryE2ETest() {
  console.log('====================================================================')
  console.log('⌚ CHRONOVA (Website A) + RAZORRECOVER AI (Website B) — E2E TEST')
  console.log('====================================================================\n')

  // TEST 1: Catalog Integrity
  console.log('TEST 1: Validating Approved Watch Products & Canonical Schema')
  console.log(`✓ Total Products in Catalog: ${CHRONOVA_CATALOG.length}`)
  if (CHRONOVA_CATALOG.length !== 45) {
    throw new Error(`Expected exactly 45 approved watches, found ${CHRONOVA_CATALOG.length}`)
  }

  // TEST 2: Customer Checkout & Server-to-Server Event Flow
  console.log('\nTEST 2: Customer Checkout & Server-to-Server Event Flow')
  const sampleWatch = CHRONOVA_CATALOG.find((w) => w.brand === 'Fastrack' && w.price_rupees > 2000) || CHRONOVA_CATALOG[0]
  console.log(`✓ Selected Watch: ${sampleWatch.name} (₹${sampleWatch.price_rupees.toLocaleString('en-IN')})`)

  const testTxnId = `TXN-CN-190-${Date.now().toString(36).toUpperCase()}`
  const orderAmountRupees = sampleWatch.price_rupees
  const orderAmountMinor = orderAmountRupees * 100

  const initialMetrics = computeMetricsFromTransactions(useTransactionStore.getState().transactions)
  console.log(`✓ Initial Verified Recovered Revenue: ₹${(initialMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)

  const failedCheckoutTxn: CanonicalTransaction = {
    id: testTxnId,
    merchant_id: 'mer_chronova_watches',
    amount: orderAmountRupees,
    amount_minor: orderAmountMinor,
    currency: 'INR',
    source: 'razorpay_test',
    status: 'STOPPED',
    direction: 'Payment degradation',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    action: 'Send payment link',
    confidence: 95,
    recovery_probability: 85,
    risk_score: 20,
    policy: 'Approved',
    explanation: `Chronova payment failure: High-intent customer checkout interrupted on ${sampleWatch.name}. Recommended multi-channel retry link.`,
    latency: '310ms',
    created_at: new Date().toISOString(),
    provider: 'razorpay',
    provider_status: 'failed',
    verified_amount_minor: 0,
  }

  useTransactionStore.getState().ingestTransaction(failedCheckoutTxn)
  console.log(`✓ Server ingested payment failure event for ${testTxnId}`)

  // TEST 3: RazorRecover AI Opportunity Analysis & Policy Decision
  console.log('\nTEST 3: RazorRecover AI Opportunity Analysis & Policy Decision')
  const allTxns = useTransactionStore.getState().transactions
  const opportunities = computeOpportunitiesFromTransactions(allTxns)
  const opp = opportunities.find((o) => o.transaction_id === testTxnId)

  if (!opp) throw new Error(`Opportunity not found for ${testTxnId}`)

  console.log(`✓ Opportunity ID: ${opp.opportunity_id}`)
  console.log(`✓ AI Priority Score: ${opp.priority_score}/99 (${opp.priority_level})`)
  console.log(`✓ Expected Recovery Yield: ₹${Math.round(opp.expected_value_minor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Policy Clearance: ${opp.policy_status}`)
  console.log(`✓ Recommended Safe Action: ${opp.best_safe_action}`)

  if (opp.policy_status !== 'Approved') throw new Error(`Policy expected Approved, got ${opp.policy_status}`)

  // TEST 4: Dispatch Safe Recovery Link & Enforce 0-Unverified Revenue
  console.log('\nTEST 4: Autonomous Recovery Link Dispatch & Invariant Gate')
  const execResult = await useTransactionStore.getState().executeRecovery(testTxnId, opp.best_safe_action)
  console.log(`✓ Recovery Action Result: ${JSON.stringify(execResult)}`)

  if (!execResult.success) throw new Error(`Recovery execution failed: ${execResult.message}`)

  const txnAfterAction = useTransactionStore.getState().transactions.find((t) => t.id === testTxnId)
  if ((txnAfterAction?.verified_amount_minor ?? 0) > 0) {
    throw new Error('CRITICAL INVARIANT VIOLATION: Recovered revenue must remain strictly ₹0 before payment settlement!')
  }

  // TEST 5: Customer Retries Payment & Razorpay Capture Verification
  console.log('\nTEST 5: Customer Settlement in Razorpay Test Mode & Server-Side Verification')
  const mockCapturePaymentId = `pay_test_cn_settle_${Date.now().toString(36)}`
  const mockOrderId = txnAfterAction?.provider_order_id || `order_cn_${Date.now().toString(36)}`

  const verifyResult = await useTransactionStore.getState().verifyPayment(
    testTxnId,
    mockCapturePaymentId,
    orderAmountMinor,
    'INR',
    mockOrderId
  )

  console.log(`✓ Razorpay Capture Verification: ${JSON.stringify(verifyResult)}`)
  if (!verifyResult.verified) throw new Error(`Verification failed: ${verifyResult.message}`)

  // TEST 6: Cryptographic Verification & Dashboard KPI Updates
  console.log('\nTEST 6: Ledger Update & Recovered Revenue KPI Increment')
  const finalTxns = useTransactionStore.getState().transactions
  const finalTxn = finalTxns.find((t) => t.id === testTxnId)
  const finalMetrics = computeMetricsFromTransactions(finalTxns)

  console.log(`✓ Final Transaction Status: ${finalTxn?.status}`)
  console.log(`✓ Verified Recovered Amount: ₹${((finalTxn?.verified_amount_minor ?? 0) / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Payment ID: ${finalTxn?.provider_payment_id}`)
  console.log(`✓ Updated Total Verified Recovered Revenue: ₹${(finalMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Total Recovered Transactions: ${finalMetrics.recoveredCount}`)

  if (finalTxn?.status !== 'RECOVERED') throw new Error(`Expected RECOVERED status, got ${finalTxn?.status}`)
  if (finalTxn?.verified_amount_minor !== orderAmountMinor) {
    throw new Error(`Expected verified amount ${orderAmountMinor}, got ${finalTxn?.verified_amount_minor}`)
  }

  console.log('\n====================================================================')
  console.log('🎉 ALL 6 CHRONOVA + RAZORRECOVER E2E LIFECYCLE TESTS PASSED!')
  console.log('====================================================================')
}

runChronovaRecoveryE2ETest().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err)
  process.exit(1)
})
