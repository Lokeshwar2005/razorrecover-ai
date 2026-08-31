/**
 * TEST #8: REAL CUSTOMER RECOVERY LOOP (CHRONOVA -> RAZORRECOVER AI -> RECOVERY -> SETTLEMENT)
 *
 * Verifies the single-source-of-truth flow:
 * 1. Customer initiates Chronova checkout (Website A)
 * 2. Payment fails -> Ingested into RazorRecover AI (Website B)
 * 3. AI diagnosis & policy evaluation performed on original transaction
 * 4. Recovery action executed
 * 5. Customer retries payment successfully
 * 6. Original transaction marked RECOVERED
 * 7. Recovered revenue credited & audit trail sealed
 */

async function runTest8() {
  const API_BASE = process.env.API_BASE || 'https://razorrecover-ai-teal.vercel.app'
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN || ''
  const authHeaders: Record<string, string> = GITHUB_TOKEN ? { 'x-github-token': GITHUB_TOKEN } : {}

  const RUN_TIMESTAMP = Date.now()
  const txnId = `TXN-CN-TEST8-${RUN_TIMESTAMP.toString(36).toUpperCase()}`
  const orderId = `order_cn8_${RUN_TIMESTAMP.toString(36)}`
  const paymentId = `pay_live8_${RUN_TIMESTAMP.toString(36)}`
  const amountMinor = 899500 // ₹8,995 INR
  const amountRupees = 8995

  console.log('====================================================================')
  console.log('🧪 TEST #8: REAL CUSTOMER RECOVERY LOOP (CHRONOVA -> RECOVERY AI)')
  console.log(`API TARGET: ${API_BASE}`)
  console.log(`TRANSACTION ID: ${txnId}`)
  console.log(`ORDER ID: ${orderId}`)
  console.log(`AMOUNT: ₹${amountRupees.toLocaleString('en-IN')} (${amountMinor} minor)`)
  console.log('====================================================================\n')

  // STEP 1: CHRONOVA (WEBSITE A) CHECKOUT PAYMENT FAILURE
  console.log('--- STEP 1: WEBSITE A (CHRONOVA) SENDS FAILED PAYMENT EVENT ---')
  const failurePayload = {
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
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(failurePayload),
  })
  const body1 = await res1.json()
  console.log(`Ingestion Result: HTTP ${res1.status}`, JSON.stringify(body1))

  if (res1.status !== 200 || !body1.success || body1.status !== 'STOPPED' || body1.transaction_id !== txnId) {
    throw new Error(`Step 1 Failed: Ingestion rejected: ${JSON.stringify(body1)}`)
  }
  console.log(`✓ Step 1 PASS: Live failure event ingested as ${txnId} with status STOPPED.\n`)

  // STEP 2: WEBSITE B (RAZORRECOVER AI) RETRIEVES THE TRANSACTION
  console.log('--- STEP 2: RAZORRECOVER AI READS ORIGINAL TRANSACTION ---')
  const resDetail1 = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`, {
    headers: { Accept: 'application/json', ...authHeaders },
  })
  const bodyDetail1 = await resDetail1.json()
  const txn1 = bodyDetail1?.transaction
  const aiDiag1 = bodyDetail1?.ai_diagnosis
  const policy1 = bodyDetail1?.policy_decision

  console.log(`Transaction Ingested: ID=${txn1?.id}, Status=${txn1?.status}, Action="${txn1?.action}", Policy=${policy1?.decision}`)

  if (
    resDetail1.status !== 200 ||
    txn1?.id !== txnId ||
    txn1?.status !== 'STOPPED' ||
    txn1?.verified_amount_minor !== 0 ||
    policy1?.decision !== 'Approved'
  ) {
    throw new Error(`Step 2 Failed: Transaction state mismatch: ${JSON.stringify(bodyDetail1)}`)
  }
  console.log(`✓ Step 2 PASS: AI Diagnosis and Policy Approved on original transaction ${txnId}.\n`)

  // STEP 3: RECOVERY ENGINE EXECUTES BOUNDED ACTION
  console.log('--- STEP 3: RECOVERY ENGINE EXECUTES RECOVERY ACTION ---')
  const recoveryPayload = {
    transaction_id: txnId,
    action_type: txn1?.action || 'Send payment link',
    amount_minor: amountMinor,
    currency: 'INR',
  }
  const resRec = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(recoveryPayload),
  })
  const bodyRec = await resRec.json()
  console.log(`Recovery Action Response:`, JSON.stringify(bodyRec))

  if (resRec.status !== 200 || !bodyRec.success || !bodyRec.recovery_operation_id) {
    throw new Error(`Step 3 Failed: Recovery execution failed: ${JSON.stringify(bodyRec)}`)
  }
  const recoveryOpId = bodyRec.recovery_operation_id
  console.log(`✓ Step 3 PASS: Recovery operation [${recoveryOpId}] created. Status is IN_PROGRESS.\n`)

  // STEP 4: CUSTOMER RETRIES & SUCCEEDS WITH RAZORPAY PAYMENT
  console.log('--- STEP 4: CUSTOMER RETRIES AND PAYMENT SUCCEEDS ---')
  const verifyPayload = {
    transaction_id: txnId,
    payment_id: paymentId,
    razorpay_payment_id: paymentId,
    order_id: orderId,
    razorpay_order_id: orderId,
    razorpay_signature: `sig_verified_${RUN_TIMESTAMP.toString(36)}`,
    amount_minor: amountMinor,
    currency: 'INR',
  }

  const resVerify = await fetch(`${API_BASE}/api/v1/recovery/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
    body: JSON.stringify(verifyPayload),
  })
  const bodyVerify = await resVerify.json()
  console.log(`Verification Response:`, JSON.stringify(bodyVerify))

  if (resVerify.status !== 200 || !bodyVerify.verified || bodyVerify.status !== 'captured') {
    throw new Error(`Step 4 Failed: Payment verification failed: ${JSON.stringify(bodyVerify)}`)
  }
  console.log(`✓ Step 4 PASS: Provider capture verified. Original transaction transitioned to RECOVERED.\n`)

  // STEP 5: VERIFY FINAL INVARIANTS ON ORIGINAL TRANSACTION
  console.log('--- STEP 5: VERIFY FINAL FINANCIAL INVARIANTS ---')
  const resFinal = await fetch(`${API_BASE}/api/v1/transactions/${txnId}`, {
    headers: { Accept: 'application/json', ...authHeaders },
  })
  const bodyFinal = await resFinal.json()
  const txnFinal = bodyFinal?.transaction

  console.log(`Final Transaction State: ID=${txnFinal?.id}, Status=${txnFinal?.status}, VerifiedRevenue=₹${(txnFinal?.verified_amount_minor / 100).toLocaleString('en-IN')}`)

  if (
    resFinal.status !== 200 ||
    txnFinal?.id !== txnId ||
    txnFinal?.status !== 'RECOVERED' ||
    txnFinal?.verified_amount_minor !== amountMinor ||
    txnFinal?.provider_payment_id !== paymentId
  ) {
    throw new Error(`Step 5 Failed: Final invariant violated: ${JSON.stringify(bodyFinal)}`)
  }
  console.log(`✓ Step 5 PASS: Verified Recovered Revenue = ₹${amountRupees.toLocaleString('en-IN')}.\n`)

  console.log('====================================================================')
  console.log('🏆 TEST #8: REAL CUSTOMER RECOVERY LOOP COMPLETED WITH 100% PASS')
  console.log('====================================================================\n')
}

runTest8().catch((err) => {
  console.error('❌ TEST #8 FAILURE:', err.message)
  process.exit(1)
})
