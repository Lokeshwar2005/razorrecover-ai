async function runTest2() {
  const API_BASE = process.env.API_BASE || 'https://razorrecover-ai-teal.vercel.app'
  const GITHUB_TOKEN = process.env.GIST_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const authHeaders = GITHUB_TOKEN ? { 'x-github-token': GITHUB_TOKEN } : {}
  const TEST_ID = `TXN-E2E-TEST2-RECOVERY-${Date.now()}`
  const PAYMENT_ID = `pay_test_cn_capture_${Date.now()}`
  const ORDER_ID = `order_test_${Date.now()}`
  const AMOUNT_MINOR = 899500 // ₹8,995

  console.log('====================================================================')
  console.log(`🧪 RAZORRECOVER AI — TEST #2: END-TO-END RECOVERY & VERIFICATION FLOW`)
  console.log(`TARGET: ${API_BASE}`)
  console.log(`TEST ID: ${TEST_ID}`)
  console.log('====================================================================\n')

  // STEP 1: Ingest Failure Event from Website A (Storefront)
  console.log('=== STEP 1: Storefront payment failure ingestion ===')
  const step1Payload = {
    transaction_id: TEST_ID,
    merchant_id: 'mer_chronova_watches',
    order_id: ORDER_ID,
    amount_minor: AMOUNT_MINOR,
    currency: 'INR',
    source: 'live',
    status: 'failed',
    provider: 'razorpay',
    failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    metadata: { scenario_id: '3ds_timeout', test: 'test_2_recovery_flow' },
  }

  const res1 = await fetch(`${API_BASE}/api/v1/transactions/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(step1Payload),
  })
  const body1 = await res1.json()
  console.log(`HTTP ${res1.status}:`, JSON.stringify(body1))

  if (res1.status !== 200 || !body1.success || body1.status !== 'STOPPED' || body1.transaction_id !== TEST_ID) {
    throw new Error(`Step 1 failed: Expected status=STOPPED, transaction_id=${TEST_ID}`)
  }
  console.log('✓ Step 1 PASSED: Failure event ingested with status STOPPED.\n')

  // STEP 2: Website B executes autonomous recovery
  console.log('=== STEP 2: Execute autonomous recovery action ===')
  const step2Payload = {
    transaction_id: TEST_ID,
    action_type: 'Send payment link',
    amount_minor: AMOUNT_MINOR,
    currency: 'INR',
  }

  const res2 = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(step2Payload),
  })
  const body2 = await res2.json()
  console.log(`HTTP ${res2.status}:`, JSON.stringify(body2))

  if (res2.status !== 200 || !body2.success || body2.workflow_status !== 'COMPLETE' || !body2.recovery_operation_id) {
    throw new Error('Step 2 failed: Expected workflow_status=COMPLETE and valid recovery_operation_id')
  }
  const recoveryOpId = body2.recovery_operation_id
  console.log(`✓ Step 2 PASSED: Recovery executed with operation ID: ${recoveryOpId}.\n`)

  // STEP 3: Verify Invariant before settlement
  console.log('=== STEP 3: Verify invariant: Unrecovered before payment settlement ===')
  const res3 = await fetch(`${API_BASE}/api/v1/transactions/${TEST_ID}`, {
    headers: { Accept: 'application/json', ...authHeaders },
  })
  const body3 = await res3.json()
  console.log(`HTTP ${res3.status}: Transaction Status = ${body3?.transaction?.status}`)

  if (res3.status !== 200 || body3?.transaction?.status === 'RECOVERED' || body3?.transaction?.status !== 'IN_PROGRESS') {
    throw new Error(`Step 3 failed: Expected status=IN_PROGRESS and NOT RECOVERED, got ${body3?.transaction?.status}`)
  }
  console.log('✓ Step 3 PASSED: Invariant verified: Transaction is IN_PROGRESS and NOT RECOVERED before capture.\n')

  // STEP 4: Customer settles payment & Backend verifies capture
  console.log('=== STEP 4: Settle payment & verify capture ===')
  const step4Payload = {
    transaction_id: TEST_ID,
    payment_id: PAYMENT_ID,
    order_id: ORDER_ID,
    amount_minor: AMOUNT_MINOR,
    currency: 'INR',
  }

  const res4 = await fetch(`${API_BASE}/api/v1/recovery/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(step4Payload),
  })
  const body4 = await res4.json()
  console.log(`HTTP ${res4.status}:`, JSON.stringify(body4))

  if (res4.status !== 200 || !body4.verified || body4.status !== 'captured' || body4.payment_id !== PAYMENT_ID) {
    throw new Error('Step 4 failed: Expected verified=true, status=captured')
  }
  console.log('✓ Step 4 PASSED: Payment capture verified successfully.\n')

  // STEP 5: Verify final state in authoritative ledger
  console.log('=== STEP 5: Final ledger lookup & state confirmation ===')
  const res5 = await fetch(`${API_BASE}/api/v1/transactions/${TEST_ID}`, {
    headers: { Accept: 'application/json', ...authHeaders },
  })
  const body5 = await res5.json()
  console.log(`HTTP ${res5.status}:`, JSON.stringify(body5?.transaction))

  if (
    res5.status !== 200 ||
    body5?.transaction?.id !== TEST_ID ||
    body5?.transaction?.status !== 'RECOVERED' ||
    body5?.transaction?.verified_amount_minor !== AMOUNT_MINOR ||
    body5?.transaction?.provider_payment_id !== PAYMENT_ID
  ) {
    throw new Error(`Step 5 failed: Expected status=RECOVERED, verified_amount_minor=${AMOUNT_MINOR}, provider_payment_id=${PAYMENT_ID}`)
  }
  console.log('✓ Step 5 PASSED: Transaction reached RECOVERED state with correct verified amount and payment ID.\n')

  console.log('====================================================================')
  console.log('🎉 TEST #2: END-TO-END RECOVERY & VERIFICATION FLOW PASSED 100%!')
  console.log('====================================================================\n')
}

runTest2().catch((err) => {
  console.error('❌ TEST #2 FAILED:', err)
  process.exit(1)
})
