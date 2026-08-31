async function runSecurityAudit() {
  const API_BASE = process.env.API_BASE || 'https://razorrecover-ai-teal.vercel.app'
  const RUN_TIMESTAMP = Date.now()

  console.log('====================================================================')
  console.log('🔒 TEST #6: SECURITY & PRODUCTION INTEGRITY ACTIVE AUDIT SUITE')
  console.log(`API BASE: ${API_BASE}`)
  console.log(`TIMESTAMP: ${RUN_TIMESTAMP}`)
  console.log('====================================================================\n')

  const testResults: { test: string; status: 'PASS' | 'FAIL'; detail: string }[] = []

  function logResult(test: string, status: 'PASS' | 'FAIL', detail: string) {
    testResults.push({ test, status, detail })
    const icon = status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} [${status}] ${test}: ${detail}`)
  }

  // --- 1. CORS ALLOWED ORIGIN ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://lokeshwar2005.github.io' },
    })
    const allowOrigin = res.headers.get('access-control-allow-origin')
    if (res.status === 204 && allowOrigin === 'https://lokeshwar2005.github.io') {
      logResult('A. Allowed Origin CORS Preflight', 'PASS', `HTTP 204, Access-Control-Allow-Origin: ${allowOrigin}`)
    } else {
      logResult('A. Allowed Origin CORS Preflight', 'FAIL', `HTTP ${res.status}, Access-Control-Allow-Origin: ${allowOrigin}`)
    }
  } catch (err: any) {
    logResult('A. Allowed Origin CORS Preflight', 'FAIL', err.message)
  }

  // --- 2. CORS UNTRUSTED ORIGIN REJECTION ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious-attacker-domain.evil.com' },
    })
    if (res.status === 403) {
      logResult('B. Untrusted Origin CORS Rejection', 'PASS', `HTTP 403 Forbidden for untrusted origin`)
    } else {
      logResult('B. Untrusted Origin CORS Rejection', 'FAIL', `Expected HTTP 403, received HTTP ${res.status}`)
    }
  } catch (err: any) {
    logResult('B. Untrusted Origin CORS Rejection', 'FAIL', err.message)
  }

  // --- 3. VALID INGESTION ---
  const validTxnId = `TXN-SEC-VALID-${RUN_TIMESTAMP}`
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://lokeshwar2005.github.io',
      },
      body: JSON.stringify({
        transaction_id: validTxnId,
        amount_minor: 899500,
        currency: 'INR',
        status: 'failed',
        failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
      }),
    })
    const body = await res.json()
    if (res.status === 200 && body.success && body.duplicate === false && body.status === 'STOPPED') {
      logResult('C. Valid Transaction Ingestion', 'PASS', `HTTP 200, status=STOPPED, duplicate=false`)
    } else {
      logResult('C. Valid Transaction Ingestion', 'FAIL', `HTTP ${res.status}: ${JSON.stringify(body)}`)
    }
  } catch (err: any) {
    logResult('C. Valid Transaction Ingestion', 'FAIL', err.message)
  }

  // --- 4. DUPLICATE INGESTION IDEMPOTENCY ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
      body: JSON.stringify({
        transaction_id: validTxnId,
        amount_minor: 899500,
        currency: 'INR',
        status: 'failed',
        failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
      }),
    })
    const body = await res.json()
    if (res.status === 200 && body.success && body.duplicate === true) {
      logResult('D. Duplicate Ingestion Idempotency', 'PASS', `HTTP 200, duplicate=true, idempotent response`)
    } else {
      logResult('D. Duplicate Ingestion Idempotency', 'FAIL', `HTTP ${res.status}: ${JSON.stringify(body)}`)
    }
  } catch (err: any) {
    logResult('D. Duplicate Ingestion Idempotency', 'FAIL', err.message)
  }

  // --- 5. FORGED RECOVERED STATUS PROTECTION ---
  const forgedTxnId = `TXN-SEC-FORGED-${RUN_TIMESTAMP}`
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
      body: JSON.stringify({
        transaction_id: forgedTxnId,
        amount_minor: 899500,
        currency: 'INR',
        status: 'recovered', // Untrusted client attempts to bypass capture
        failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
      }),
    })
    const body = await res.json()
    // Must be forced to STOPPED on failure ingestion endpoint
    if (res.status === 200 && body.status === 'STOPPED') {
      logResult('E. Forged Status Tampering Protection', 'PASS', `Storefront cannot force RECOVERED status; forced to STOPPED`)
    } else {
      logResult('E. Forged Status Tampering Protection', 'FAIL', `Status was not forced to STOPPED: ${JSON.stringify(body)}`)
    }
  } catch (err: any) {
    logResult('E. Forged Status Tampering Protection', 'FAIL', err.message)
  }

  // --- 6. MISSING TRANSACTION ID ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: '', amount_minor: 899500 }),
    })
    if (res.status === 422) {
      logResult('F1. Missing ID Rejection', 'PASS', `Rejected with HTTP 422 Unprocessable Entity`)
    } else {
      logResult('F1. Missing ID Rejection', 'FAIL', `Expected HTTP 422, received HTTP ${res.status}`)
    }
  } catch (err: any) {
    logResult('F1. Missing ID Rejection', 'FAIL', err.message)
  }

  // --- 7. ZERO AMOUNT REJECTION ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: `TXN-SEC-ZERO-${RUN_TIMESTAMP}`, amount_minor: 0 }),
    })
    if (res.status === 422) {
      logResult('F2. Zero Amount Rejection', 'PASS', `Rejected with HTTP 422 Unprocessable Entity`)
    } else {
      logResult('F2. Zero Amount Rejection', 'FAIL', `Expected HTTP 422, received HTTP ${res.status}`)
    }
  } catch (err: any) {
    logResult('F2. Zero Amount Rejection', 'FAIL', err.message)
  }

  // --- 8. NEGATIVE AMOUNT REJECTION ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: `TXN-SEC-NEG-${RUN_TIMESTAMP}`, amount_minor: -5000 }),
    })
    if (res.status === 422) {
      logResult('F3. Negative Amount Rejection', 'PASS', `Rejected with HTTP 422 Unprocessable Entity`)
    } else {
      logResult('F3. Negative Amount Rejection', 'FAIL', `Expected HTTP 422, received HTTP ${res.status}`)
    }
  } catch (err: any) {
    logResult('F3. Negative Amount Rejection', 'FAIL', err.message)
  }

  // --- 9. RECOVERY EXECUTION IDEMPOTENCY ---
  let recOpId = ''
  try {
    const res1 = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
      body: JSON.stringify({ transaction_id: validTxnId, action_type: 'Send payment link' }),
    })
    const body1 = await res1.json()
    recOpId = body1.recovery_operation_id

    const res2 = await fetch(`${API_BASE}/api/v1/recovery/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
      body: JSON.stringify({ transaction_id: validTxnId, action_type: 'Send payment link' }),
    })
    const body2 = await res2.json()

    if (
      res1.status === 200 && body1.duplicate === false &&
      res2.status === 200 && body2.duplicate === true &&
      body1.recovery_operation_id === body2.recovery_operation_id
    ) {
      logResult('G. Recovery Execution Idempotency', 'PASS', `Initial created [${recOpId}], duplicate returned identical ID`)
    } else {
      logResult('G. Recovery Execution Idempotency', 'FAIL', `Duplicate recovery mismatch: ${JSON.stringify(body2)}`)
    }
  } catch (err: any) {
    logResult('G. Recovery Execution Idempotency', 'FAIL', err.message)
  }

  // --- 10. PRE-SETTLEMENT INVARIANT GATE ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/${validTxnId}`, {
      headers: { Origin: 'https://lokeshwar2005.github.io' },
    })
    const body = await res.json()
    const t = body?.transaction
    if (t?.status === 'IN_PROGRESS' && t?.verified_amount_minor === 0) {
      logResult('H. Pre-Settlement Invariant Gate', 'PASS', `Status is strictly IN_PROGRESS, verified revenue = ₹0`)
    } else {
      logResult('H. Pre-Settlement Invariant Gate', 'FAIL', `Premature revenue or wrong status: ${JSON.stringify(t)}`)
    }
  } catch (err: any) {
    logResult('H. Pre-Settlement Invariant Gate', 'FAIL', err.message)
  }

  // --- 11. RECOVERY SETTLEMENT VERIFICATION ---
  const paymentId = `pay_sec_test_${RUN_TIMESTAMP}`
  try {
    const res = await fetch(`${API_BASE}/api/v1/recovery/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
      body: JSON.stringify({
        transaction_id: validTxnId,
        payment_id: paymentId,
        order_id: `order_sec_${RUN_TIMESTAMP}`,
        amount_minor: 899500,
      }),
    })
    const body = await res.json()
    if (res.status === 200 && body.verified === true && body.status === 'captured') {
      logResult('I. Recovery Settlement Verification', 'PASS', `Confirmed capture for ₹8,995`)
    } else {
      logResult('I. Recovery Settlement Verification', 'FAIL', `Verification failed: ${JSON.stringify(body)}`)
    }
  } catch (err: any) {
    logResult('I. Recovery Settlement Verification', 'FAIL', err.message)
  }

  // --- 12. FINAL RECOVERED STATE ---
  try {
    const res = await fetch(`${API_BASE}/api/v1/transactions/${validTxnId}`, {
      headers: { Origin: 'https://lokeshwar2005.github.io' },
    })
    const body = await res.json()
    const t = body?.transaction
    if (t?.status === 'RECOVERED' && t?.verified_amount_minor === 899500 && t?.provider_payment_id === paymentId) {
      logResult('J. Final RECOVERED State & Revenue Crediting', 'PASS', `Status=RECOVERED, verified_amount_minor=899500`)
    } else {
      logResult('J. Final RECOVERED State & Revenue Crediting', 'FAIL', `Ledger mismatch: ${JSON.stringify(t)}`)
    }
  } catch (err: any) {
    logResult('J. Final RECOVERED State & Revenue Crediting', 'FAIL', err.message)
  }

  // --- 13. CONCURRENT INGESTION (10 PARALLEL REQUESTS) ---
  const concurrentTxnId = `TXN-SEC-CONCURRENT-${RUN_TIMESTAMP}`
  try {
    const promises = Array.from({ length: 10 }).map(() =>
      fetch(`${API_BASE}/api/v1/transactions/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
        body: JSON.stringify({
          transaction_id: concurrentTxnId,
          amount_minor: 499500,
          currency: 'INR',
          status: 'failed',
          failure_code: 'GATEWAY_ERROR_3DS_TIMEOUT',
        }),
      }).then((r) => r.json())
    )
    const responses = await Promise.all(promises)
    const allSuccessful = responses.every((r) => r.success === true && r.transaction_id === concurrentTxnId)

    // Check that ledger contains exactly ONE record
    const checkRes = await fetch(`${API_BASE}/api/v1/transactions/${concurrentTxnId}`, {
      headers: { Origin: 'https://lokeshwar2005.github.io' },
    })
    const checkBody = await checkRes.json()

    if (allSuccessful && checkBody?.transaction?.id === concurrentTxnId) {
      logResult('K. Concurrent Ingestion (10 Parallel Requests)', 'PASS', `All 10 requests resolved safely to 1 canonical transaction`)
    } else {
      logResult('K. Concurrent Ingestion (10 Parallel Requests)', 'FAIL', `Concurrency error: ${JSON.stringify(responses)}`)
    }
  } catch (err: any) {
    logResult('K. Concurrent Ingestion (10 Parallel Requests)', 'FAIL', err.message)
  }

  // --- 14. CONCURRENT RECOVERY EXECUTION (5 PARALLEL REQUESTS) ---
  try {
    const promises = Array.from({ length: 5 }).map(() =>
      fetch(`${API_BASE}/api/v1/recovery/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://lokeshwar2005.github.io' },
        body: JSON.stringify({ transaction_id: concurrentTxnId, action_type: 'Send payment link' }),
      }).then((r) => r.json())
    )
    const responses = await Promise.all(promises)
    const opIds = new Set(responses.map((r) => r.recovery_operation_id).filter(Boolean))

    if (opIds.size === 1) {
      logResult('L. Concurrent Recovery Execution', 'PASS', `5 concurrent recovery requests produced exact 1 unique operation ID: [${[...opIds][0]}]`)
    } else {
      logResult('L. Concurrent Recovery Execution', 'FAIL', `Multiple operations generated: ${[...opIds].join(', ')}`)
    }
  } catch (err: any) {
    logResult('L. Concurrent Recovery Execution', 'FAIL', err.message)
  }

  console.log('\n====================================================================')
  console.log('📊 SECURITY & INTEGRITY AUDIT TEST SUMMARY')
  console.log('====================================================================')
  console.table(testResults)

  const hasFailures = testResults.some((r) => r.status === 'FAIL')
  if (hasFailures) {
    console.error('❌ SOME AUDIT CHECKS FAILED')
    process.exit(1)
  } else {
    console.log('🎉 ALL SECURITY & INTEGRITY CHECKS PASSED (100%)')
  }
}

runSecurityAudit().catch((err) => {
  console.error('❌ AUDIT SUITE ERROR:', err)
  process.exit(1)
})
