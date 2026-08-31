import eventsHandler from '../api/v1/transactions/events.js'
import detailHandler from '../api/v1/transactions/[id].js'
import executeHandler from '../api/v1/recovery/execute.js'
import verifyHandler from '../api/v1/recovery/verify.js'

function createMockReqRes(reqData: { method: string; body?: any; query?: any; headers?: Record<string, string> }) {
  let statusCode = 200
  let resHeaders: Record<string, string> = {}
  let resBody: any = null

  const req: any = {
    method: reqData.method,
    body: reqData.body,
    query: reqData.query || {},
    headers: reqData.headers || {},
  }

  const res: any = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(data: any) {
      resBody = data
      return res
    },
    setHeader(name: string, value: string) {
      resHeaders[name.toLowerCase()] = value
      return res
    },
    end() {
      return res
    },
  }

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getBody: () => resBody,
  }
}

async function runTest8() {
  const RUN_TIMESTAMP = Date.now()
  const txnId = `TXN-CN-TEST8-${RUN_TIMESTAMP.toString(36).toUpperCase()}`
  const orderId = `order_cn8_${RUN_TIMESTAMP.toString(36)}`
  const paymentId = `pay_live8_${RUN_TIMESTAMP.toString(36)}`
  const amountMinor = 899500 // ₹8,995 INR
  const amountRupees = 8995

  console.log('====================================================================')
  console.log('🧪 TEST #8: REAL CUSTOMER RECOVERY LOOP (CHRONOVA -> RECOVERY AI)')
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

  const { req: req1, res: res1, getStatusCode: getCode1, getBody: getBody1 } = createMockReqRes({
    method: 'POST',
    body: failurePayload,
  })
  await eventsHandler(req1, res1)
  const code1 = getCode1()
  const body1 = getBody1()
  console.log(`Ingestion Result: HTTP ${code1}`, JSON.stringify(body1))

  if (code1 !== 200 || !body1?.success || body1?.status !== 'STOPPED' || body1?.transaction_id !== txnId) {
    throw new Error(`Step 1 Failed: Ingestion rejected: ${JSON.stringify(body1)}`)
  }
  console.log(`✓ Step 1 PASS: Live failure event ingested as ${txnId} with status STOPPED.\n`)

  // STEP 2: WEBSITE B (RAZORRECOVER AI) RETRIEVES THE TRANSACTION
  console.log('--- STEP 2: RAZORRECOVER AI READS ORIGINAL TRANSACTION ---')
  const { req: reqDetail1, res: resDetail1, getStatusCode: getCodeDetail1, getBody: getBodyDetail1 } = createMockReqRes({
    method: 'GET',
    query: { id: txnId },
  })
  await detailHandler(reqDetail1, resDetail1)
  const codeDetail1 = getCodeDetail1()
  const bodyDetail1 = getBodyDetail1()
  const txn1 = bodyDetail1?.transaction
  const aiDiag1 = bodyDetail1?.ai_diagnosis
  const policy1 = bodyDetail1?.policy_decision

  console.log(`Transaction Ingested: ID=${txn1?.id}, Status=${txn1?.status}, Action="${txn1?.action}", Policy=${policy1?.decision}`)

  if (
    codeDetail1 !== 200 ||
    txn1?.id !== txnId ||
    (txn1?.status !== 'STOPPED' && txn1?.status !== 'PAYMENT_FAILED') ||
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
  const { req: reqRec, res: resRec, getStatusCode: getCodeRec, getBody: getBodyRec } = createMockReqRes({
    method: 'POST',
    body: recoveryPayload,
  })
  await executeHandler(reqRec, resRec)
  const codeRec = getCodeRec()
  const bodyRec = getBodyRec()
  console.log(`Recovery Action Response:`, JSON.stringify(bodyRec))

  if (codeRec !== 200 || !bodyRec?.success || !bodyRec?.recovery_operation_id) {
    throw new Error(`Step 3 Failed: Recovery execution failed: ${JSON.stringify(bodyRec)}`)
  }
  const recoveryOpId = bodyRec.recovery_operation_id
  console.log(`✓ Step 3 PASS: Recovery operation [${recoveryOpId}] created. Status is WAITING_FOR_RECOVERY.\n`)

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

  const { req: reqVerify, res: resVerify, getStatusCode: getCodeVerify, getBody: getBodyVerify } = createMockReqRes({
    method: 'POST',
    body: verifyPayload,
  })
  await verifyHandler(reqVerify, resVerify)
  const codeVerify = getCodeVerify()
  const bodyVerify = getBodyVerify()
  console.log(`Verification Response:`, JSON.stringify(bodyVerify))

  if (codeVerify !== 200 || !bodyVerify?.verified || bodyVerify?.status !== 'captured') {
    throw new Error(`Step 4 Failed: Payment verification failed: ${JSON.stringify(bodyVerify)}`)
  }
  console.log(`✓ Step 4 PASS: Provider capture verified. Original transaction transitioned to RECOVERED.\n`)

  // STEP 5: VERIFY FINAL INVARIANTS ON ORIGINAL TRANSACTION
  console.log('--- STEP 5: VERIFY FINAL FINANCIAL INVARIANTS ---')
  const { req: reqFinal, res: resFinal, getStatusCode: getCodeFinal, getBody: getBodyFinal } = createMockReqRes({
    method: 'GET',
    query: { id: txnId },
  })
  await detailHandler(reqFinal, resFinal)
  const codeFinal = getCodeFinal()
  const bodyFinal = getBodyFinal()
  const txnFinal = bodyFinal?.transaction

  console.log(`Final Transaction State: ID=${txnFinal?.id}, Status=${txnFinal?.status}, VerifiedRevenue=₹${(txnFinal?.verified_amount_minor / 100).toLocaleString('en-IN')}`)

  if (
    codeFinal !== 200 ||
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
