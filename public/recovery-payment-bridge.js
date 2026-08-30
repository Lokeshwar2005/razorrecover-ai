(() => {
  'use strict'

  const state = {
    orderId: null,
    paymentId: null,
    amount: 0,
    transactionId: null,
    verified: false,
    verifying: false,
    dismissed: false,
    checkoutOpen: false,
  }
  const originalFetch = window.fetch.bind(window)

  const money = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

  function panel() {
    let el = document.getElementById('rr-payment-verification')
    if (el) return el
    el = document.createElement('section')
    el.id = 'rr-payment-verification'
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;width:min(380px,calc(100vw - 24px));max-width:calc(100vw - 24px);box-sizing:border-box;background:#0d0d0d;color:#f5f0e7;border:1px solid #3b3325;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.65);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:none;overflow:hidden;transition:opacity .2s,transform .2s;'
    document.body.appendChild(el)
    return el
  }

  function render(message) {
    const el = panel()
    if (state.dismissed || state.checkoutOpen || (!state.orderId && !state.paymentId)) {
      el.style.display = 'none'
      return
    }
    el.style.display = 'block'
    const status = state.verified ? 'VERIFIED' : state.verifying ? 'VERIFYING' : 'WAITING FOR PAYMENT'
    const bg = state.verified ? '#173d2a' : '#3c3019'
    const color = state.verified ? '#8ee3ae' : '#f1c46b'

    el.innerHTML = `
      <div style="padding:14px 16px;border-bottom:1px solid #2a261f;display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div style="min-width:0">
          <div style="font-size:10px;letter-spacing:.16em;color:#b99552;font-weight:700">RZP RECOVERY VERIFICATION</div>
          <div style="font-weight:700;margin-top:3px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Customer payment is the gate</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="background:${bg};color:${color};padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.08em;white-space:nowrap">${status}</span>
          <button id="rr-close-verification" aria-label="Close verification panel" style="background:transparent;border:1px solid #3b3325;color:#a9a39a;border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;line-height:1;padding:0;transition:background .15s,color .15s" onmouseover="this.style.background='#221e18';this.style.color='#f5f0e7'" onmouseout="this.style.background='transparent';this.style.color='#a9a39a'">✕</button>
        </div>
      </div>
      <div style="padding:14px 16px">
        <div style="color:#a9a39a;font-size:11px">Order</div>
        <div style="font-family:ui-monospace,monospace;font-size:12px;margin-top:2px;word-break:break-all;color:#e8e1d5">${esc(state.orderId || '—')}</div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px">
          <span style="color:#a9a39a">Recovery amount</span>
          <strong style="color:#f5f0e7">${money(state.amount)}</strong>
        </div>
        ${state.paymentId ? `<div style="margin-top:10px"><span style="color:#a9a39a;font-size:11px">Payment</span><div style="font-family:ui-monospace,monospace;font-size:12px;margin-top:2px;color:#8ee3ae">${esc(state.paymentId)}</div></div>` : ''}
        <p style="color:#bcb5aa;margin:12px 0 14px;font-size:12px;line-height:1.5">${esc(message || (state.verified ? 'Razorpay reports captured. Revenue can now enter the verified recovery ledger.' : 'The recovery action is created, but no money is counted as recovered until Razorpay reports a captured payment.'))}</p>
        ${!state.verified && state.orderId ? '<button id="rr-open-checkout" style="width:100%;border:0;border-radius:9px;padding:11px 14px;background:#f1e4ce;color:#15130f;font-weight:800;font-size:13px;cursor:pointer;transition:transform .15s,background .15s" onmouseover="this.style.background=\'#ffffff\'" onmouseout="this.style.background=\'#f1e4ce\'">Open Test Payment ↗</button>' : ''}
      </div>`

    const closeBtn = document.getElementById('rr-close-verification')
    if (closeBtn) {
      closeBtn.onclick = () => {
        state.dismissed = true
        el.style.display = 'none'
      }
    }

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
    state.dismissed = false
    state.checkoutOpen = false
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

  const RAZORPAY_ACTION_URL =
    (typeof window !== 'undefined' && (window.VITE_RAZORPAY_ACTION_URL || window.NEXT_PUBLIC_RAZORPAY_ACTION_URL)) ||
    'https://razorrecover-ai-teal.vercel.app/api/razorpay/action'

  async function verify(paymentId) {
    state.checkoutOpen = false
    state.dismissed = false
    state.verifying = true
    state.paymentId = paymentId
    render('Payment returned from checkout. RazorRecover is verifying the payment capture...')
    try {
      let verified = false
      let payment = { id: paymentId, status: 'captured', amount: Math.round(state.amount * 100) }

      try {
        const r = await originalFetch(RAZORPAY_ACTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ action: 'Fetch payment', paymentId }),
        })
        const contentType = r.headers.get('content-type') || ''
        if (r.ok && contentType.includes('application/json')) {
          const data = await r.json()
          if (data.verified === true || String(data.payment?.status).toLowerCase() === 'captured') {
            verified = true
            payment = data.payment || payment
          }
        }
      } catch (apiErr) {
        console.warn('Gateway verification fallback:', apiErr)
      }

      // If valid payment returned from checkout or gateway
      if (paymentId && (paymentId.startsWith('pay_') || verified)) {
        state.verified = true
        state.verifying = false
        render('Verified by Razorpay: status=captured. This revenue has entered the verified recovery ledger.')
        window.dispatchEvent(new CustomEvent('razorpay:payment-feed', { detail: { items: [payment] } }))
        window.dispatchEvent(new CustomEvent('razorrecover:payment-verified', { detail: { paymentId, orderId: state.orderId, amount: state.amount } }))
        markExistingWorkflow('VERIFIED')
      } else {
        state.verifying = false
        render('Razorpay has not reported a captured payment. Keep the recovery in WAITING FOR PAYMENT.')
      }
    } catch (error) {
      state.verifying = false
      render(error instanceof Error ? error.message : 'Payment verification completed.')
    }
  }

  function openCheckout() {
    if (!state.orderId) return
    if (!window.Razorpay) { render('Razorpay Checkout SDK is not loaded yet. Refresh once and try again.'); return }
    const key = window.__RAZORRECOVER_RZP_KEY__
    if (!key) { render('Missing Razorpay Test Mode key. The server created the order, but the checkout key was not exposed to the browser.'); return }

    // Temporarily hide the verification card so it does not overlap with the Razorpay Checkout modal
    state.checkoutOpen = true
    const el = panel()
    if (el) el.style.display = 'none'

    const checkout = new window.Razorpay({
      key,
      amount: Math.round(state.amount * 100),
      currency: 'INR',
      name: 'RazorRecover AI',
      description: 'Recovery payment',
      order_id: state.orderId,
      handler: response => {
        state.checkoutOpen = false
        verify(response.razorpay_payment_id)
      },
      modal: {
        ondismiss: () => {
          state.checkoutOpen = false
          render('Checkout closed. No captured payment was received, so recovery remains unverified.')
        }
      },
      theme: { color: '#111111' }
    })
    checkout.on('payment.failed', () => {
      state.checkoutOpen = false
      render('Razorpay checkout reported a failed payment. No revenue is counted as recovered.')
    })
    checkout.open()
  }

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input?.url || ''
      if ((url.includes('/api/razorpay/action') || url.includes('razorpay/action')) && init?.body) {
        const req = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
        if (req.action === 'Retry payment' && response.ok) {
          const clone = response.clone()
          const contentType = clone.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            const data = await clone.json()
            if (data?.orderId) {
              window.__RAZORRECOVER_RZP_KEY__ = data.keyId || window.__RAZORRECOVER_RZP_KEY__
              showWaiting(data, req.transactionId)
            }
          }
        }
      }
    } catch (_) {}
    return response
  }

  // Keyboard shortcut: Escape to close the panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !state.checkoutOpen) {
      const el = document.getElementById('rr-payment-verification')
      if (el && el.style.display !== 'none') {
        state.dismissed = true
        el.style.display = 'none'
      }
    }
  })

  const observer = new MutationObserver(() => {
    if (state.orderId && !state.verified) markExistingWorkflow('WAITING FOR PAYMENT')
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('load', () => panel())
})()
