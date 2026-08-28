(() => {
  'use strict'

  const state = { orderId: null, paymentId: null, amount: 0, transactionId: null, verified: false, verifying: false }
  const originalFetch = window.fetch.bind(window)

  const money = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

  function panel() {
    let el = document.getElementById('rr-payment-verification')
    if (el) return el
    el = document.createElement('section')
    el.id = 'rr-payment-verification'
    el.setAttribute('aria-live', 'polite')
    el.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;width:min(390px,calc(100vw - 32px));background:#0d0d0d;color:#f5f0e7;border:1px solid #3b3325;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.55);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:none;overflow:hidden;'
    document.body.appendChild(el)
    return el
  }

  function render(message) {
    const el = panel()
    if (!state.orderId && !state.paymentId) { el.style.display = 'none'; return }
    el.style.display = 'block'
    const status = state.verified ? 'VERIFIED' : state.verifying ? 'VERIFYING' : 'WAITING FOR PAYMENT'
    const bg = state.verified ? '#173d2a' : '#3c3019'
    const color = state.verified ? '#8ee3ae' : '#f1c46b'
    el.innerHTML = `<div style="padding:16px 18px;border-bottom:1px solid #2a261f;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><div style="font-size:11px;letter-spacing:.16em;color:#b99552">RZP RECOVERY VERIFICATION</div><div style="font-weight:700;margin-top:4px">Customer payment is the gate</div></div><span style="background:${bg};color:${color};padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.08em;white-space:nowrap">${status}</span></div><div style="padding:16px 18px"><div style="color:#a9a39a;font-size:12px">Order</div><div style="font-family:ui-monospace,monospace;font-size:12px;margin-top:3px;word-break:break-all">${esc(state.orderId || '—')}</div><div style="display:flex;justify-content:space-between;margin-top:14px"><span style="color:#a9a39a">Recovery amount</span><strong>${money(state.amount)}</strong></div>${state.paymentId ? `<div style="margin-top:10px"><span style="color:#a9a39a">Payment</span><div style="font-family:ui-monospace,monospace;font-size:12px;margin-top:3px">${esc(state.paymentId)}</div></div>` : ''}<p style="color:#bcb5aa;margin:14px 0 16px">${esc(message || (state.verified ? 'Razorpay reports captured. Revenue can now enter the verified recovery ledger.' : 'The recovery action is created, but no money is counted as recovered until Razorpay reports a captured payment.'))}</p>${!state.verified && state.orderId ? '<button id="rr-open-checkout" style="width:100%;border:0;border-radius:10px;padding:12px 14px;background:#f1e4ce;color:#15130f;font-weight:800;cursor:pointer">Open Test Payment</button>' : ''}</div>`
    const btn = document.getElementById('rr-open-checkout')
    if (btn) btn.onclick = openCheckout
  }

  function showWaiting(data, transactionId) {
    state.orderId = data.orderId || null
    state.amount = Number(data.amount || 0) / 100 || Number(data.amount || 0) || 0
    state.transactionId = transactionId || null
    state.paymentId = null
    state.verified = false
    state.verifying = false
    render('Razorpay Test Mode order created. Waiting for the customer to complete checkout.')
    markExistingWorkflow('WAITING FOR PAYMENT')
  }

  function markExistingWorkflow(label) {
    if (!state.orderId) return
    const nodes = document.querySelectorAll('body *')
    for (const n of nodes) {
      if (n.children.length > 12 || !(n.textContent || '').includes(state.orderId)) continue
      let root = n
      for (let up = 0; up < 6 && root.parentElement; up++) root = root.parentElement
      const all = root.querySelectorAll ? root.querySelectorAll('*') : []
      for (const x of all) {
        if (x.children.length === 0 && (x.textContent || '').trim() === 'COMPLETE') {
          x.textContent = label
          x.style.color = label === 'VERIFIED' ? '#8ee3ae' : '#f1c46b'
        }
      }
      break
    }
  }

  async function verify(paymentId) {
    state.verifying = true
    state.paymentId = paymentId
    render('Payment returned from checkout. RazorRecover is fetching the payment from Razorpay before marking revenue recovered.')
    try {
      const r = await originalFetch('/api/razorpay/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'Fetch payment', paymentId }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Razorpay payment lookup failed')
      const payment = data.payment || {}
      if (data.verified === true && String(payment.status).toLowerCase() === 'captured') {
        state.verified = true
        state.verifying = false
        render('Verified by Razorpay: status=captured. This is the only point where the payment is counted as recovered.')
        window.dispatchEvent(new CustomEvent('razorpay:payment-feed', { detail: { items: [payment] } }))
        markExistingWorkflow('VERIFIED')
      } else {
        state.verifying = false
        render('Razorpay has not reported a captured payment. Keep the recovery in WAITING FOR PAYMENT.')
      }
    } catch (error) {
      state.verifying = false
      render(error instanceof Error ? error.message : 'Payment verification failed. Recovery remains unverified.')
    }
  }

  function openCheckout() {
    if (!state.orderId) return
    if (!window.Razorpay) { render('Razorpay Checkout SDK is not loaded yet. Refresh once and try again.'); return }
    const key = window.__RAZORRECOVER_RZP_KEY__
    if (!key) { render('Missing Razorpay Test Mode key. The server created the order, but the checkout key was not exposed to the browser.'); return }
    const checkout = new window.Razorpay({
      key,
      amount: Math.round(state.amount * 100),
      currency: 'INR',
      name: 'RazorRecover AI',
      description: 'Recovery payment',
      order_id: state.orderId,
      handler: response => verify(response.razorpay_payment_id),
      modal: { ondismiss: () => render('Checkout closed. No captured payment was received, so recovery remains unverified.') },
      theme: { color: '#111111' }
    })
    checkout.on('payment.failed', () => render('Razorpay checkout reported a failed payment. No revenue is counted as recovered.'))
    checkout.open()
  }

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input?.url || ''
      if (url.includes('/api/razorpay/action') && init?.body) {
        const req = JSON.parse(init.body)
        if (req.action === 'Retry payment' && response.ok) {
          const data = await response.clone().json()
          if (data?.orderId) {
            window.__RAZORRECOVER_RZP_KEY__ = data.keyId || window.__RAZORRECOVER_RZP_KEY__
            showWaiting(data, req.transactionId)
          }
        }
      }
    } catch (_) {}
    return response
  }

  const observer = new MutationObserver(() => {
    if (state.orderId && !state.verified) markExistingWorkflow('WAITING FOR PAYMENT')
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('load', () => panel())
})()
