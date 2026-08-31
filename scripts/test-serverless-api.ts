import eventsHandler from '../api/v1/transactions/events.js'
import listHandler from '../api/v1/transactions/index.js'
import detailHandler from '../api/v1/transactions/[id].js'
import executeHandler from '../api/v1/recovery/execute.js'
import verifyHandler from '../api/v1/recovery/verify.js'
import oppHandler from '../api/v1/opportunities/index.js'

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
    getResult: () => ({ status: statusCode, body: resBody, headers: resHeaders }),
  }
}

async function testServerlessEndpoints() {
  console.log('====================================================================')
  console.log('🧪 TESTING VERCEL SERVERLESS /api/v1/ SUITE DIRECTLY IN NODE')
  console.log('====================================================================\n')

  const testTxnId = `TXN-CN-LIVE-TEST-${Date.now().toString(36).toUpperCase()}`
  const orderId = `order_test_${Date.now().toString(36)}`
  const amountMinor = 539500 // ₹5,395

  // 1. Test POST /api/v1/transactions/events
  console.log(`TEST 1: Ingesting Payment Event: ${testTxnId}`)
  const ingest = createMockReqRes({
    method: 'POST',
    body: {
      transaction_id: testTxnId,
      merchant_id: 'mer_chronova_watches',
      order_id: orderId,
      amount_minor: amountMinor,
      currency: 'INR',
      source: 'live',
      status: 'failed',
      failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
      failure_reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
      metadata: {
        scenario_id: '3ds_timeout',
      },
    },
  })

  await eventsHandler(ingest.req, ingest.res)
  const ingestRes = ingest.getResult()
  console.log(`✓ POST /api/v1/transactions/events HTTP Status: ${ingestRes.status}`)
  console.log(`✓ Response: ${JSON.stringify(ingestRes.body)}`)
  if (ingestRes.status !== 200 || !ingestRes.body?.success) {
    throw new Error(`Ingestion failed with status ${ingestRes.status}`)
  }

  // 2. Test GET /api/v1/transactions/[id]
  console.log(`\nTEST 2: Fetching Transaction Detail for ${testTxnId}`)
  const detail = createMockReqRes({
    method: 'GET',
    query: { id: testTxnId },
  })
  await detailHandler(detail.req, detail.res)
  const detailRes = detail.getResult()
  console.log(`✓ GET /api/v1/transactions/${testTxnId} HTTP Status: ${detailRes.status}`)
  console.log(`✓ Found Transaction ID: ${detailRes.body?.transaction?.id} (Source: ${detailRes.body?.transaction?.source})`)
  if (detailRes.status !== 200 || detailRes.body?.transaction?.id !== testTxnId) {
    throw new Error(`Detail fetch failed for ${testTxnId}`)
  }

  // 3. Test GET /api/v1/transactions (with source=live and search)
  console.log(`\nTEST 3: Querying Transactions List with search=${testTxnId}`)
  const list = createMockReqRes({
    method: 'GET',
    query: { search: testTxnId, source: 'live' },
  })
  await listHandler(list.req, list.res)
  const listRes = list.getResult()
  console.log(`✓ GET /api/v1/transactions HTTP Status: ${listRes.status}`)
  console.log(`✓ Matched records: ${listRes.body?.length}`)
  if (listRes.status !== 200 || listRes.body?.length < 1 || listRes.body[0]?.id !== testTxnId) {
    throw new Error(`List query failed to find live transaction ${testTxnId}`)
  }

  // 4. Test POST /api/v1/recovery/execute
  console.log(`\nTEST 4: Executing Recovery for ${testTxnId}`)
  const exec = createMockReqRes({
    method: 'POST',
    body: {
      transaction_id: testTxnId,
      action_type: 'Send payment link',
    },
  })
  await executeHandler(exec.req, exec.res)
  const execRes = exec.getResult()
  console.log(`✓ POST /api/v1/recovery/execute HTTP Status: ${execRes.status}`)
  console.log(`✓ Recovery Operation ID: ${execRes.body?.recovery_operation_id}`)
  if (execRes.status !== 200 || !execRes.body?.success) {
    throw new Error(`Recovery execution failed for ${testTxnId}`)
  }

  // 5. Test POST /api/v1/recovery/verify
  console.log(`\nTEST 5: Verifying Recovery Capture for ${testTxnId}`)
  const settlePaymentId = `pay_test_settle_${Date.now().toString(36)}`
  const verify = createMockReqRes({
    method: 'POST',
    body: {
      transaction_id: testTxnId,
      payment_id: settlePaymentId,
      amount_minor: amountMinor,
      currency: 'INR',
    },
  })
  await verifyHandler(verify.req, verify.res)
  const verifyRes = verify.getResult()
  console.log(`✓ POST /api/v1/recovery/verify HTTP Status: ${verifyRes.status}`)
  console.log(`✓ Verified Status: ${verifyRes.body?.status}`)
  if (verifyRes.status !== 200 || !verifyRes.body?.verified) {
    throw new Error(`Payment verification failed for ${testTxnId}`)
  }

  // 6. Test GET Opportunities
  console.log(`\nTEST 6: Querying Recovery Opportunities`)
  const opp = createMockReqRes({ method: 'GET' })
  await oppHandler(opp.req, opp.res)
  const oppRes = opp.getResult()
  console.log(`✓ GET /api/v1/opportunities HTTP Status: ${oppRes.status}`)
  console.log(`✓ Total Opportunities: ${oppRes.body?.length}`)

  // 7. Test Duplicate Ingestion Idempotency
  console.log(`\nTEST 7: Duplicate Event Ingestion Idempotency`)
  const dupIngest = createMockReqRes({
    method: 'POST',
    body: {
      transaction_id: testTxnId,
      amount_minor: amountMinor,
      status: 'failed',
    },
  })
  await eventsHandler(dupIngest.req, dupIngest.res)
  const dupRes = dupIngest.getResult()
  console.log(`✓ Duplicate POST status: ${dupRes.status}`)
  if (dupRes.status !== 200) {
    throw new Error(`Duplicate ingestion failed`)
  }

  console.log('\n====================================================================')
  console.log('🎉 ALL SERVERLESS API HANDLER UNIT TESTS PASSED!')
  console.log('====================================================================\n')
}

testServerlessEndpoints().catch((err) => {
  console.error('❌ SERVERLESS TEST FAILED:', err)
  process.exit(1)
})
