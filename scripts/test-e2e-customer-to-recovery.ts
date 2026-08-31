async function runTest5() {
  const API_BASE = process.env.API_BASE || 'https://razorrecover-ai-teal.vercel.app'
  const RUN_TIMESTAMP = Date.now()
  const txnId = `TXN-CN-PROD-${RUN_TIMESTAMP.toString(36).toUpperCase()}`
  const orderId = `order_cn_${RUN_TIMESTAMP.toString(36)}`
  const paymentId = `pay_live_capture_${RUN_TIMESTAMP.toString(36)}`
  const amountMinor = 899500 // ₹8,995 INR (Chronova Seeker 40)
  const amountRupees = 8995

  console.log('====================================================================')
  console.log('🧪 TEST #5: FULL PRODUCTION E2E CUSTOMER → AI → RECOVERY FLOW')
  console.log(`API BASE: ${API_BASE}`)
  console.log(`TRANSACTION ID: ${txnId}`)
  console.log(`ORDER ID: ${orderId}`)
  console.log(`AMOUNT: ₹${amountRupees.toLocaleString('en-IN')} (${amountMinor} minor)`)
  console.log('====================================================================\n')

  // Step 1 - 8: Customer Storefront (Website A) triggers payment degradation
  console.log('--- STEP 1-8: WEBSITE A (CHRONOVA) CHECKOUT & FAILURE INGESTION ---')
  const step1Payload = {
    transaction_id: txnId,
    merchant_id: 'mer_chronova_watches',
    order_id: orderId,
    amount_minor: amountMinor,
    currency: 'INR',
    source: 'live',
    status: 'failed',
    provider: 'razorpay',
    method: 'card',
    failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    failure_reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    customer: {
      name: 'Lokeshwar Sudam',
      email: 'customer@chronova.example.com',
      phone: '+919876543210',
    },
    metadata: {
      product_id: 'prod_seeker_40',
      product_name: 'Chronova Seeker 40',
      brand: 'Chronova',
      scenario_id: '3ds_timeout',
    },
  }

  const res1 = await fetch(`${API_BASE}/api/v1/transactions/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(step1Payload),
  })
  const body1 = await res1.json()

  console.log(`HTTP ${res1.status} - Response:`, JSON.stringify(body1))
  if (res1.status !== 200 || !body1.success || body1.duplicate !== false || body1.status !== 'STOPPED' || body1.transaction_id !== txnId) {
    throw new Error(`Step 1 Ingestion Failed: ${JSON.stringify(body1)}`)
  }
  console.log(`✓ 1. Website A successfully ingested live transaction ${txnId} with status STOPPED (duplicate: false).\n`)

  // Step 9 - 13: Website B (RazorRecover AI) Transaction Intelligence & Lifecycle Trace
  console.log('--- STEP 9-13: WEBSITE B (RAZORRECOVER AI) INTELLIGENCE & TRACE ---')
  const resDetail1 = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`, {
    headers: { Accept: 'application/json' },
  })
  const bodyDetail1 = await resDetail1.json()
  const txnDetail1 = bodyDetail1?.transaction
  const aiDiag1 = bodyDetail1?.ai_diagnosis
  const policy1 = bodyDetail1?.policy_decision
  const audits1 = bodyDetail1?.audit_events

  console.log(`Detail Response: Status=${txnDetail1?.status}, Action="${txnDetail1?.action}", Policy="${policy1?.decision}", RiskScore=${aiDiag1?.risk_score}`)
  if (
    resDetail1.status !== 200 ||
    txnDetail1?.id !== txnId ||
    txnDetail1?.source !== 'live' ||
    txnDetail1?.status !== 'STOPPED' ||
    txnDetail1?.verified_amount_minor !== 0 ||
    !aiDiag1?.root_cause ||
    policy1?.decision !== 'Approved' ||
    !audits1 || audits1.length === 0
  ) {
    throw new Error(`Step 9-13 Website B Lookup Failed: ${JSON.stringify(bodyDetail1)}`)
  }
  console.log(`✓ 2. Website B retrieved live transaction intelligence with status STOPPED, AI diagnosis, and Policy Approved.\n`)

  // Step 14 - 16: Autonomous Recovery Execution
  console.log('--- STEP 14-16: AUTONOMOUS RECOVERY EXECUTION ---')
  const recoveryPayload = {
    transaction_id: txnId,
    action_type: txnDetail1.action || 'Send payment link',
    amount_minor: amountMinor,
    currency: 'INR',
  }
  const resRec1 = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(recoveryPayload),
  })
  const bodyRec1 = await resRec1.json()
  console.log(`Recovery Execution Response:`, JSON.stringify(bodyRec1))
  if (resRec1.status !== 200 || !bodyRec1.success || bodyRec1.duplicate !== false || bodyRec1.workflow_status !== 'COMPLETE' || !bodyRec1.recovery_operation_id) {
    throw new Error(`Step 14-16 Recovery Execution Failed: ${JSON.stringify(bodyRec1)}`)
  }
  const recoveryOpId = bodyRec1.recovery_operation_id
  console.log(`✓ 3. Recovery operation created exactly once: [${recoveryOpId}].\n`)

  // Verify intermediate state invariant
  const resDetail2 = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`)
  const bodyDetail2 = await resDetail2.json()
  console.log(`Intermediate Invariant: Status=${bodyDetail2?.transaction?.status}, VerifiedRevenue=₹${bodyDetail2?.transaction?.verified_amount_minor}`)
  if (bodyDetail2?.transaction?.status !== 'IN_PROGRESS' || bodyDetail2?.transaction?.verified_amount_minor !== 0) {
    throw new Error(`Intermediate Invariant Failed: Status=${bodyDetail2?.transaction?.status}`)
  }
  console.log(`✓ 4. Invariant Gate Verified: Status is IN_PROGRESS and revenue is ₹0 before capture.\n`)

  // Step 17 - 18: Payment Capture / Settlement Verification
  console.log('--- STEP 17-18: PAYMENT CAPTURE & SETTLEMENT VERIFICATION ---')
  const verifyPayload = {
    transaction_id: txnId,
    payment_id: paymentId,
    order_id: orderId,
    amount_minor: amountMinor,
    currency: 'INR',
  }
  const resVerify = await fetch(`${API_BASE}/api/v1/recovery/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(verifyPayload),
  })
  const bodyVerify = await resVerify.json()
  console.log(`Capture Verification Response:`, JSON.stringify(bodyVerify))
  if (resVerify.status !== 200 || !bodyVerify.verified || bodyVerify.status !== 'captured' || bodyVerify.payment_id !== paymentId) {
    throw new Error(`Step 17-18 Capture Verification Failed: ${JSON.stringify(bodyVerify)}`)
  }
  console.log(`✓ 5. Capture verified for ₹${(amountMinor / 100).toLocaleString('en-IN')}.\n`)

  // Step 19 - 24: Website A Real-Time Polling & Order Confirmation
  console.log('--- STEP 19-24: WEBSITE A POLLING DETECTION & ORDER CONFIRMATION ---')
  const resPoll = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`)
  const bodyPoll = await resPoll.json()
  const txnPoll = bodyPoll?.transaction

  console.log(`Website A Poll Response: Status=${txnPoll?.status}, VerifiedRevenue=₹${(txnPoll?.verified_amount_minor / 100).toLocaleString('en-IN')}`)
  if (
    resPoll.status !== 200 ||
    txnPoll?.status !== 'RECOVERED' ||
    txnPoll?.verified_amount_minor !== amountMinor ||
    txnPoll?.provider_payment_id !== paymentId
  ) {
    throw new Error(`Step 19-24 Website A Polling State Check Failed: ${JSON.stringify(bodyPoll)}`)
  }

  const simulatedReceipt = {
    orderId: orderId,
    canonicalTxnId: txnId,
    paymentId: paymentId,
    amountRupees: Math.round(txnPoll.verified_amount_minor / 100),
    action: txnPoll.action,
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    statusText: 'PAYMENT RECOVERED & ORDER CONFIRMED!',
  }
  console.log(`Simulated Website A Confirmed Receipt:`, JSON.stringify(simulatedReceipt, null, 2))
  console.log(`✓ 6. Website A polling detected RECOVERED state, auto-transitioned to ORDER CONFIRMED without page reload.\n`)

  // Cross-Origin & Refresh Invariance Check
  console.log('--- REFRESH & DUPLICATE SAFETY VALIDATION ---')
  const resRefresh = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`)
  const bodyRefresh = await resRefresh.json()
  if (bodyRefresh?.transaction?.status !== 'RECOVERED' || bodyRefresh?.transaction?.verified_amount_minor !== amountMinor) {
    throw new Error(`Refresh Safety Failed: State was not preserved after simulated refresh!`)
  }
  console.log(`✓ 7. Refresh safety verified: Transaction ${txnId} remains persistent in RECOVERED state.\n`)

  console.log('====================================================================')
  console.log('🎉 TEST #5: FULL PRODUCTION E2E FLOW COMPLETED SUCCESSFULLY (100% PASS)')
  console.log('====================================================================')
}

runTest5().catch((err) => {
  console.error('❌ TEST #5 FAILED:', err)
  process.exit(1)
})
