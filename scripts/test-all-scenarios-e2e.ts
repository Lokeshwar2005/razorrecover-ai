const SCENARIOS = [
  {
    id: '3ds_timeout',
    name: '3DS Bank OTP Timeout',
    code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    expectedAction: 'Send payment link',
    amountMinor: 499500,
  },
  {
    id: 'low_balance',
    name: 'Insufficient Account Balance',
    code: 'BAD_REQUEST_INSUFFICIENT_FUNDS',
    reason: 'Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)',
    expectedAction: 'Switch to UPI Auto-Pay / Split Link',
    amountMinor: 699500,
  },
  {
    id: 'upi_intent_drop',
    name: 'UPI App Intent Auto-Drop',
    code: 'UPI_INTENT_TIMEOUT',
    reason: 'UPI Intent Session Expired (Customer Backgrounded App to Check SMS)',
    expectedAction: 'Send instant WhatsApp UPI deep link',
    amountMinor: 349500,
  },
  {
    id: 'bank_downtime',
    name: 'Bank Core Server Downtime',
    code: 'ISSUER_CBS_DOWN_502',
    reason: 'Issuer Core Banking System (CBS) Scheduled Maintenance / Outage',
    expectedAction: 'Smart Routing to Alternate Bank Node',
    amountMinor: 899500,
  },
  {
    id: 'risk_engine_flag',
    name: 'Risk Engine False Positive',
    code: 'FRAUD_VELOCITY_SOFT_BLOCK',
    reason: 'Issuer Velocity Heuristic Triggered (False Positive Soft Decline)',
    expectedAction: 'Dispatch Biometric Verified Secure Link',
    amountMinor: 1299500,
  },
  {
    id: 'network_drop',
    name: 'Mobile Network Disconnect',
    code: 'CLIENT_TCP_CONNECTION_RESET',
    reason: 'Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)',
    expectedAction: 'Send 1-Click SMS Recovery Link',
    amountMinor: 549500,
  },
  {
    id: 'auth_retries_exceeded',
    name: 'Incorrect OTP / Maximum Retries',
    code: 'AUTH_RETRIES_EXCEEDED_3DS',
    reason: 'Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded',
    expectedAction: 'Send UPI QR Alternative Link',
    amountMinor: 429500,
  },
  {
    id: 'cart_abandonment',
    name: 'Checkout Sheet Abandoned',
    code: 'GATEWAY_DISMISSED_BY_USER',
    reason: 'Customer Dismissed Razorpay Checkout Window Before Submitting Credentials',
    expectedAction: 'Send Cart Recovery WhatsApp with 5% Perk',
    amountMinor: 799500,
  },
]

async function runAllScenariosTest() {
  const API_BASE = process.env.API_BASE || 'https://razorrecover-ai-teal.vercel.app'
  const RUN_TIMESTAMP = Date.now()

  console.log('====================================================================')
  console.log('🧪 TEST #3: ALL 8 PAYMENT FAILURE SCENARIOS VALIDATION SUITE')
  console.log(`API BASE: ${API_BASE}`)
  console.log(`TIMESTAMP: ${RUN_TIMESTAMP}`)
  console.log('====================================================================\n')

  const resultsTable: any[] = []

  for (let i = 0; i < SCENARIOS.length; i++) {
    const sc = SCENARIOS[i]
    const testId = `TXN-E2E-SCENARIO-${sc.id.toUpperCase()}-${RUN_TIMESTAMP}`
    const paymentId = `pay_test_capture_${sc.id}_${RUN_TIMESTAMP}`
    const orderId = `order_test_${sc.id}_${RUN_TIMESTAMP}`

    console.log(`--------------------------------------------------------------------`)
    console.log(`[${i + 1}/8] TESTING SCENARIO: ${sc.name} (${sc.code})`)
    console.log(`      TEST ID: ${testId}`)
    console.log(`--------------------------------------------------------------------`)

    // 1. Initial Ingestion
    const step1Payload = {
      transaction_id: testId,
      merchant_id: 'mer_chronova_watches',
      order_id: orderId,
      amount_minor: sc.amountMinor,
      currency: 'INR',
      source: 'live',
      status: 'failed',
      provider: 'razorpay',
      failure_code: sc.code,
      failure_reason: sc.reason,
      metadata: { scenario_id: sc.id, test: 'test_3_all_scenarios' },
    }

    const res1 = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(step1Payload),
    })
    const body1 = await res1.json()
    if (res1.status !== 200 || !body1.success || body1.duplicate !== false || body1.status !== 'STOPPED') {
      throw new Error(`Scenario ${sc.id} Step 1 Failed: HTTP ${res1.status}, body: ${JSON.stringify(body1)}`)
    }
    console.log(`✓ 1. Ingestion: Initial event accepted with status STOPPED (duplicate: false).`)

    // 2. Duplicate Ingestion Idempotency
    const res2 = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(step1Payload),
    })
    const body2 = await res2.json()
    if (res2.status !== 200 || !body2.success || body2.duplicate !== true) {
      throw new Error(`Scenario ${sc.id} Step 2 Failed: Duplicate check failed. HTTP ${res2.status}, body: ${JSON.stringify(body2)}`)
    }
    console.log(`✓ 2. Duplicate Check: Duplicate event recognized with duplicate: true.`)

    // 3. Detail & AI Diagnosis Verification
    const res3 = await fetch(`${API_BASE}/api/v1/transactions/${testId}`, {
      headers: { Accept: 'application/json' },
    })
    const body3 = await res3.json()
    const txn3 = body3?.transaction
    const diag3 = body3?.ai_diagnosis
    const pol3 = body3?.policy_decision
    const audits3 = body3?.audit_events

    if (
      res3.status !== 200 ||
      txn3?.id !== testId ||
      txn3?.status !== 'STOPPED' ||
      txn3?.action !== sc.expectedAction ||
      diag3?.recommended_action !== sc.expectedAction ||
      pol3?.decision !== 'Approved' ||
      !audits3 || audits3.length === 0
    ) {
      throw new Error(`Scenario ${sc.id} Step 3 Failed: Diagnosis or policy mismatch. Details: ${JSON.stringify(body3)}`)
    }
    console.log(`✓ 3. Diagnosis & Policy: Action="${txn3.action}", Policy="${pol3.decision}", Risk=${diag3.risk_score}.`)

    // 4. Recovery Execution
    const step4Payload = {
      transaction_id: testId,
      action_type: sc.expectedAction,
      amount_minor: sc.amountMinor,
      currency: 'INR',
    }
    const res4 = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(step4Payload),
    })
    const body4 = await res4.json()
    if (res4.status !== 200 || !body4.success || body4.workflow_status !== 'COMPLETE' || !body4.recovery_operation_id) {
      throw new Error(`Scenario ${sc.id} Step 4 Failed: Recovery execution failed. HTTP ${res4.status}, body: ${JSON.stringify(body4)}`)
    }
    const recoveryOpId = body4.recovery_operation_id
    console.log(`✓ 4. Recovery Execution: Operation created [${recoveryOpId}].`)

    // 5. Pre-Settlement Invariant Check
    const res5 = await fetch(`${API_BASE}/api/v1/transactions/${testId}`)
    const body5 = await res5.json()
    if (body5?.transaction?.status !== 'IN_PROGRESS' || body5?.transaction?.verified_amount_minor !== 0) {
      throw new Error(`Scenario ${sc.id} Step 5 Failed: Pre-settlement invariant violated! Status=${body5?.transaction?.status}`)
    }
    console.log(`✓ 5. Invariant Gate: Status is strictly IN_PROGRESS and verified revenue is ₹0 before capture.`)

    // 6. Capture Verification
    const step6Payload = {
      transaction_id: testId,
      payment_id: paymentId,
      order_id: orderId,
      amount_minor: sc.amountMinor,
      currency: 'INR',
    }
    const res6 = await fetch(`${API_BASE}/api/v1/recovery/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(step6Payload),
    })
    const body6 = await res6.json()
    if (res6.status !== 200 || !body6.verified || body6.status !== 'captured' || body6.payment_id !== paymentId) {
      throw new Error(`Scenario ${sc.id} Step 6 Failed: Capture verification failed. HTTP ${res6.status}, body: ${JSON.stringify(body6)}`)
    }
    console.log(`✓ 6. Payment Verification: Capture verified for ₹${(sc.amountMinor / 100).toLocaleString('en-IN')}.`)

    // 7. Final RECOVERED State Confirmation
    const res7 = await fetch(`${API_BASE}/api/v1/transactions/${testId}`)
    const body7 = await res7.json()
    const txn7 = body7?.transaction
    if (
      res7.status !== 200 ||
      txn7?.status !== 'RECOVERED' ||
      txn7?.verified_amount_minor !== sc.amountMinor ||
      txn7?.provider_payment_id !== paymentId
    ) {
      throw new Error(`Scenario ${sc.id} Step 7 Failed: Final state verification failed. Details: ${JSON.stringify(body7)}`)
    }
    console.log(`✓ 7. Final Ledger State: Reached RECOVERED with ₹${(txn7.verified_amount_minor / 100).toLocaleString('en-IN')} verified.\n`)

    resultsTable.push({
      Scenario: sc.name,
      Ingestion: 'PASS',
      Diagnosis: `${diag3.confidence_score}% / ${diag3.recommended_action}`,
      Policy: pol3.decision,
      Recovery: recoveryOpId,
      Audit: 'Verified (1)',
      Result: 'PASS',
    })
  }

  console.log('====================================================================')
  console.log('🎉 ALL 8 PAYMENT FAILURE SCENARIOS VALIDATED SUCCESSFULLY (100% PASS)')
  console.log('====================================================================\n')
  console.table(resultsTable)
}

runAllScenariosTest().catch((err) => {
  console.error('❌ SCENARIO TEST FAILED:', err)
  process.exit(1)
})
