import {
  useTransactionStore,
  type CanonicalTransaction,
  computeOpportunitiesFromTransactions,
  computeMetricsFromTransactions,
} from '../src/services/canonicalTransactionStore'

async function runDualSandboxE2ETest() {
  console.log('====================================================')
  console.log('🚀 RAZORRECOVER AI — DUAL-SANDBOX E2E VALIDATION SUITE')
  console.log('====================================================\n')

  const store = useTransactionStore.getState()

  // 1. Initial State Invariant Check
  console.log('TEST 1: Invariant Check on Baseline Canonical Ledger')
  const initialTxns = store.transactions
  const initialMetrics = computeMetricsFromTransactions(initialTxns)
  console.log(`✓ Total Transactions: ${initialTxns.length}`)
  console.log(`✓ Verified Recovered Revenue: ₹${(initialMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Recovered Count: ${initialMetrics.recoveredCount}`)
  
  if (initialTxns.length < 100) {
    throw new Error(`Expected >= 100 baseline transactions, found ${initialTxns.length}`)
  }
  console.log('✅ TEST 1 PASSED: Baseline invariants preserved.\n')

  // 2. Website A Checkout & Failure Event Generation
  console.log('TEST 2: Website A (Acme Cloud) B2B Subscription Payment Failure')
  const testInvoiceId = `INV-ACME-DUAL-TEST-${Date.now().toString(36).toUpperCase()}`
  const planAmountRupees = 25000 // Business Growth Plan
  const planAmountMinor = 2500000

  const simulatedFailedPayment: CanonicalTransaction = {
    id: testInvoiceId,
    merchant_id: 'mer_acme_cloud',
    amount: planAmountRupees,
    amount_minor: planAmountMinor,
    currency: 'INR',
    source: 'razorpay_test',
    status: 'STOPPED',
    direction: 'Payment degradation',
    reason: 'Simulated 3DS Bank Timeout (Issuer Gateway Downtime)',
    action: 'Retry payment',
    confidence: 95,
    recovery_probability: 84,
    risk_score: 24,
    policy: 'Approved',
    explanation: 'Acme Cloud B2B SaaS failure: Issuer timeout on high-value business invoice.',
    latency: '340ms',
    created_at: new Date().toISOString(),
    provider: 'razorpay',
    provider_status: 'failed',
    verified_amount_minor: 0,
  }

  // Ingest failure into store (Website A -> Event Bus -> Website B)
  store.ingestTransaction(simulatedFailedPayment)
  console.log(`✓ Ingested failure event for Invoice ${testInvoiceId} (₹${planAmountRupees.toLocaleString('en-IN')})`)

  const updatedTxnsAfterFailure = useTransactionStore.getState().transactions
  const ingestedTxn = updatedTxnsAfterFailure.find((t) => t.id === testInvoiceId)
  if (!ingestedTxn || ingestedTxn.status !== 'STOPPED') {
    throw new Error('Failed to ingest failed transaction into canonical ledger')
  }
  console.log('✅ TEST 2 PASSED: Failure ingested into shared canonical store.\n')

  // 3. Website B (RazorRecover AI) Opportunity Detection & Scoring
  console.log('TEST 3: RazorRecover AI Opportunity Ranking & Policy Check')
  const opps = computeOpportunitiesFromTransactions(updatedTxnsAfterFailure)
  const matchingOpp = opps.find((o) => o.transaction_id === testInvoiceId)

  if (!matchingOpp) {
    throw new Error(`Opportunity not generated for ${testInvoiceId}`)
  }

  console.log(`✓ Opportunity Created: ID ${matchingOpp.opportunity_id}`)
  console.log(`✓ Failure Signature: "${matchingOpp.failure_signature}"`)
  console.log(`✓ Priority Level: ${matchingOpp.priority_level} (Score: ${matchingOpp.priority_score})`)
  console.log(`✓ Expected Recovery Value: ₹${Math.round(matchingOpp.expected_value_minor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Policy Decision: ${matchingOpp.policy_status}`)
  console.log(`✓ Best Safe Action: ${matchingOpp.best_safe_action}`)

  if (matchingOpp.priority_level !== 'CRITICAL' && matchingOpp.priority_level !== 'HIGH') {
    throw new Error(`Expected CRITICAL/HIGH priority for ₹25,000 failure, got ${matchingOpp.priority_level}`)
  }
  if (matchingOpp.policy_status !== 'Approved') {
    throw new Error(`Expected Approved policy status, got ${matchingOpp.policy_status}`)
  }
  console.log('✅ TEST 3 PASSED: Opportunity prioritized and policy-approved.\n')

  // 4. Execution of Recovery Action (Issuing Smart Retry / Payment Link)
  console.log('TEST 4: Autonomous Recovery Action Execution')
  const executionRes = await useTransactionStore.getState().executeRecovery(testInvoiceId, matchingOpp.best_safe_action)
  console.log(`✓ Recovery Execution Response: ${JSON.stringify(executionRes)}`)

  if (!executionRes.success) {
    throw new Error(`Recovery execution failed: ${executionRes.message}`)
  }

  const txnAfterAction = useTransactionStore.getState().transactions.find((t) => t.id === testInvoiceId)
  console.log(`✓ Transaction Status after Action: ${txnAfterAction?.status}`)
  console.log(`✓ Recovery Operation ID: ${txnAfterAction?.recovery_operation_id}`)

  // Revenue must remain UNVERIFIED (0) until actual customer payment capture
  if ((txnAfterAction?.verified_amount_minor ?? 0) > 0) {
    throw new Error('CRITICAL VIOLATION: Revenue was marked verified before payment capture!')
  }
  console.log('✅ TEST 4 PASSED: Recovery action bound, strict 0 unverified revenue gate verified.\n')

  // 5. Website A Customer Pays via Recovery Link (Payment Capture & Verification)
  console.log('TEST 5: Customer Settlement in Website A & Razorpay Verification Gate')
  const mockPaymentId = `pay_test_rec_${Date.now().toString(36)}`
  const mockOrderId = txnAfterAction?.provider_order_id || `order_rec_${Date.now().toString(36)}`

  const verifyRes = await useTransactionStore.getState().verifyPayment(
    testInvoiceId,
    mockPaymentId,
    planAmountMinor,
    'INR',
    mockOrderId
  )

  console.log(`✓ Verification Result: ${JSON.stringify(verifyRes)}`)
  if (!verifyRes.verified) {
    throw new Error(`Payment verification failed: ${verifyRes.message}`)
  }

  // 6. Verification of Final Cryptographic State in Website B
  console.log('TEST 6: Final Canonical State & Metrics Verification')
  const finalTxns = useTransactionStore.getState().transactions
  const finalTxn = finalTxns.find((t) => t.id === testInvoiceId)
  const finalMetrics = computeMetricsFromTransactions(finalTxns)

  console.log(`✓ Final Transaction Status: ${finalTxn?.status}`)
  console.log(`✓ Verified Recovered Amount: ₹${((finalTxn?.verified_amount_minor ?? 0) / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Provider Payment ID: ${finalTxn?.provider_payment_id}`)
  console.log(`✓ Total Verified Ecosystem Recovered: ₹${(finalMetrics.verifiedRecoveredMinor / 100).toLocaleString('en-IN')}`)
  console.log(`✓ Total Recovered Count: ${finalMetrics.recoveredCount}`)

  if (finalTxn?.status !== 'RECOVERED') {
    throw new Error(`Expected RECOVERED status, got ${finalTxn?.status}`)
  }
  if (finalTxn?.verified_amount_minor !== planAmountMinor) {
    throw new Error(`Expected verified amount ${planAmountMinor}, got ${finalTxn?.verified_amount_minor}`)
  }
  if (finalMetrics.verifiedRecoveredMinor <= initialMetrics.verifiedRecoveredMinor) {
    throw new Error('Ecosystem recovered revenue did not increase after verified payment capture')
  }

  console.log('\n====================================================')
  console.log('🎉 ALL DUAL-SANDBOX E2E LIFECYCLE TESTS PASSED!')
  console.log('====================================================')
}

runDualSandboxE2ETest().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err)
  process.exit(1)
})
