import eventsHandler from '../api/v1/transactions/events.js'
import detailHandler from '../api/v1/transactions/[id].js'
import executeHandler from '../api/v1/recovery/execute.js'
import verifyHandler from '../api/v1/recovery/verify.js'

function createMockReqRes(reqData: { method: string; body?: any; query?: any }) {
  let statusCode = 200
  let resHeaders: Record<string, string> = {}
  let resBody: any = null

  const req: any = {
    method: reqData.method,
    body: reqData.body,
    query: reqData.query || {},
    headers: {},
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
      resHeaders[name] = value
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

async function runTest2() {
  const TEST_ID = `TXN-E2E-TEST2-RECOVERY-${Date.now()}`
  const PAYMENT_ID = `pay_test_cn_capture_${Date.now()}`
  const ORDER_ID = `order_test_${Date.now()}`
  const AMOUNT_MINOR = 899500 // ₹8,995

  console.log('====================================================================')
  console.log(`🧪 RAZORRECOVER AI — TEST #2: END-TO-END RECOVERY & VERIFICATION FLOW`)
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
    failure_reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    metadata: { scenario_id: '3ds_timeout', test: 'test_2_recovery_flow' },
  }

  const { req: req1, res: res1, getStatusCode: getCode1, getBody: getBody1 } = createMockReqRes({
    method: 'POST',
    body: step1Payload,
  })
  await eventsHandler(req1, res1)
  const code1 = getCode1()
  const body1 = getBody1()
  console.log(`HTTP ${code1}:`, JSON.stringify(body1))

  if (code1 !== 200 || !body1?.success || body1?.status !== 'STOPPED' || body1?.transaction_id !== TEST_ID) {
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

  const { req: req2, res: res2, getStatusCode: getCode2, getBody: getBody2 } = createMockReqRes({
    method: 'POST',
    body: step2Payload,
  })
  await executeHandler(req2, res2)
  const code2 = getCode2()
  const body2 = getBody2()
  console.log(`HTTP ${code2}:`, JSON.stringify(body2))

  if (code2 !== 200 || !body2?.success || body2?.workflow_status !== 'COMPLETE' || !body2?.recovery_operation_id) {
    throw new Error('Step 2 failed: Expected workflow_status=COMPLETE and valid recovery_operation_id')
  }
  const recoveryOpId = body2.recovery_operation_id
  console.log(`✓ Step 2 PASSED: Recovery executed with operation ID: ${recoveryOpId}.\n`)

  // STEP 3: Verify Invariant before settlement
  console.log('=== STEP 3: Verify invariant: Unrecovered before payment settlement ===')
  const { req: req3, res: res3, getStatusCode: getCode3, getBody: getBody3 } = createMockReqRes({
    method: 'GET',
    query: { id: TEST_ID },
  })
  await detailHandler(req3, res3)
  const code3 = getCode3()
  const body3 = getBody3()
  console.log(`HTTP ${code3}: Transaction Status = ${body3?.transaction?.status}`)

  if (code3 !== 200 || body3?.transaction?.status === 'RECOVERED' || (body3?.transaction?.status !== 'IN_PROGRESS' && body3?.transaction?.status !== 'WAITING_FOR_RECOVERY')) {
    throw new Error(`Step 3 failed: Expected status=IN_PROGRESS or WAITING_FOR_RECOVERY, got ${body3?.transaction?.status}`)
  }
  console.log('✓ Step 3 PASSED: Invariant verified: Transaction is WAITING_FOR_RECOVERY and NOT RECOVERED before capture.\n')

  // STEP 4: Customer settles payment & Backend verifies capture
  console.log('=== STEP 4: Settle payment & verify capture ===')
  const step4Payload = {
    transaction_id: TEST_ID,
    payment_id: PAYMENT_ID,
    order_id: ORDER_ID,
    amount_minor: AMOUNT_MINOR,
    currency: 'INR',
  }

  const { req: req4, res: res4, getStatusCode: getCode4, getBody: getBody4 } = createMockReqRes({
    method: 'POST',
    body: step4Payload,
  })
  await verifyHandler(req4, res4)
  const code4 = getCode4()
  const body4 = getBody4()
  console.log(`HTTP ${code4}:`, JSON.stringify(body4))

  if (code4 !== 200 || !body4?.verified || body4?.status !== 'captured' || body4?.payment_id !== PAYMENT_ID) {
    throw new Error('Step 4 failed: Expected verified=true, status=captured')
  }
  console.log('✓ Step 4 PASSED: Payment capture verified successfully.\n')

  // STEP 5: Verify final state in authoritative ledger
  console.log('=== STEP 5: Final ledger lookup & state confirmation ===')
  const { req: req5, res: res5, getStatusCode: getCode5, getBody: getBody5 } = createMockReqRes({
    method: 'GET',
    query: { id: TEST_ID },
  })
  await detailHandler(req5, res5)
  const code5 = getCode5()
  const body5 = getBody5()
  console.log(`HTTP ${code5}:`, JSON.stringify(body5?.transaction))

  if (
    code5 !== 200 ||
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
