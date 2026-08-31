import eventsHandler from '../api/v1/transactions/events.js'
import detailHandler from '../api/v1/transactions/[id].js'
import executeHandler from '../api/v1/recovery/execute.js'

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

async function runTest() {
  const TEST_ID = `TXN-E2E-IDEMPOTENCY-${Date.now()}`
  console.log(`\n====================================================================`)
  console.log(`🧪 TESTING IDEMPOTENCY END-TO-END FLOW FOR: ${TEST_ID}`)
  console.log(`====================================================================\n`)

  const payload = {
    transaction_id: TEST_ID,
    merchant_id: 'mer_chronova_watches',
    order_id: `order_${TEST_ID}`,
    payment_id: `pay_${TEST_ID}`,
    amount_minor: 371300,
    currency: 'INR',
    source: 'live',
    status: 'failed',
    provider: 'razorpay',
    failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    metadata: { scenario_id: '3ds_timeout', test: 'idempotency' },
  }

  // Step 1: First transaction ingestion
  console.log('=== STEP 1: First transaction ingestion ===')
  const { req: req1, res: res1, getStatusCode: getCode1, getBody: getBody1 } = createMockReqRes({
    method: 'POST',
    body: payload,
  })
  await eventsHandler(req1, res1)
  const code1 = getCode1()
  const body1 = getBody1()
  console.log(`HTTP ${code1}:`, JSON.stringify(body1))
  if (code1 !== 200 || body1?.success !== true || body1?.duplicate !== false || body1?.transaction_id !== TEST_ID) {
    throw new Error(`Step 1 assertion failed: expected success=true, duplicate=false`)
  }
  console.log('✓ Step 1 PASSED: First ingestion created successfully with duplicate=false.\n')

  // Step 2: Duplicate transaction ingestion
  console.log('=== STEP 2: Duplicate transaction ingestion ===')
  const { req: req2, res: res2, getStatusCode: getCode2, getBody: getBody2 } = createMockReqRes({
    method: 'POST',
    body: payload,
  })
  await eventsHandler(req2, res2)
  const code2 = getCode2()
  const body2 = getBody2()
  console.log(`HTTP ${code2}:`, JSON.stringify(body2))
  if (code2 !== 200 || body2?.success !== true || body2?.duplicate !== true || body2?.transaction_id !== TEST_ID) {
    throw new Error(`Step 2 assertion failed: expected success=true, duplicate=true`)
  }
  console.log('✓ Step 2 PASSED: Duplicate ingestion recognized with duplicate=true.\n')

  // Step 3: First recovery execution
  console.log('=== STEP 3: First recovery execution ===')
  const recoveryPayload = {
    transaction_id: TEST_ID,
    action_type: 'Send payment link',
  }
  const { req: req3, res: res3, getStatusCode: getCode3, getBody: getBody3 } = createMockReqRes({
    method: 'POST',
    body: recoveryPayload,
  })
  await executeHandler(req3, res3)
  const code3 = getCode3()
  const body3 = getBody3()
  console.log(`HTTP ${code3}:`, JSON.stringify(body3))
  const recoveryOpId = body3?.recovery_operation_id
  if (code3 !== 200 || body3?.success !== true || body3?.duplicate !== false || !recoveryOpId) {
    throw new Error(`Step 3 assertion failed: expected success=true, duplicate=false, non-empty recovery_operation_id`)
  }
  console.log(`✓ Step 3 PASSED: Recovery executed with ID: ${recoveryOpId}.\n`)

  // Step 4: Duplicate recovery execution
  console.log('=== STEP 4: Duplicate recovery execution ===')
  const { req: req4, res: res4, getStatusCode: getCode4, getBody: getBody4 } = createMockReqRes({
    method: 'POST',
    body: recoveryPayload,
  })
  await executeHandler(req4, res4)
  const code4 = getCode4()
  const body4 = getBody4()
  console.log(`HTTP ${code4}:`, JSON.stringify(body4))
  if (code4 !== 200 || body4?.success !== true || body4?.duplicate !== true || body4?.recovery_operation_id !== recoveryOpId) {
    throw new Error(`Step 4 assertion failed: expected success=true, duplicate=true, recovery_operation_id=${recoveryOpId}`)
  }
  console.log('✓ Step 4 PASSED: Duplicate recovery returned identical recovery operation ID.\n')

  // Step 5: Transaction detail verification
  console.log('=== STEP 5: Verify transaction detail ===')
  const { req: req5, res: res5, getStatusCode: getCode5, getBody: getBody5 } = createMockReqRes({
    method: 'GET',
    query: { id: TEST_ID },
  })
  await detailHandler(req5, res5)
  const code5 = getCode5()
  const body5 = getBody5()
  console.log(`HTTP ${code5}:`, JSON.stringify(body5?.transaction))
  if (code5 !== 200 || body5?.transaction?.id !== TEST_ID || body5?.transaction?.status !== 'IN_PROGRESS') {
    throw new Error(`Step 5 assertion failed: expected transaction.id=${TEST_ID} and status=IN_PROGRESS`)
  }
  console.log('✓ Step 5 PASSED: Transaction reached IN_PROGRESS state and matches TEST_ID.\n')

  console.log(`====================================================================`)
  console.log(`🎉 ALL 5 IDEMPOTENCY & RECOVERY E2E TEST STEPS PASSED!`)
  console.log(`====================================================================\n`)
}

runTest().catch((err) => {
  console.error('❌ IDEMPOTENCY TEST FAILED:', err)
  process.exit(1)
})
