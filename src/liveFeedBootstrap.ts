type RazorpayPayment = {
  id: string
  amount: number
  currency?: string
  status?: string
  method?: string
  created_at?: number
  email?: string
  contact?: string
  error_description?: string
}

const RAZORPAY_FEED_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_API_URL) ||
  'https://razorrecover-ai-teal.vercel.app/api/razorpay/feed'

const rootId = 'razorrecover-live-feed'

function money(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100)
}

function emitPaymentFeed(items: RazorpayPayment[], fetchedAt?: string) {
  window.dispatchEvent(new CustomEvent('razorpay:payment-feed', { detail: { items, fetchedAt: fetchedAt || new Date().toISOString() } }))
}

function computeFeedFingerprint(items: RazorpayPayment[]): string {
  return items.map((p) => `${p.id}:${p.status || ''}:${p.amount || 0}`).join('|')
}

function mount() {
  if (typeof document === 'undefined') return
  if (document.getElementById(rootId)) return

  const host = document.createElement('div')
  host.id = rootId
  host.innerHTML = `
    <button data-toggle class="rr-live-toggle" aria-label="Toggle Razorpay Test Live Feed">RZP TEST · LIVE FEED</button>
    <section data-panel class="rr-live-panel" hidden aria-hidden="true">
      <div class="rr-live-head"><div><strong>Razorpay Test Mode</strong><small>payment events → recovery operations</small></div><span data-state>idle</span></div>
      <div data-list class="rr-live-list"><div class="rr-live-empty">Connect Test Mode to see real payment events.</div></div>
      <div class="rr-live-foot"><span data-time>—</span><button data-refresh aria-label="Refresh Feed">Refresh</button></div>
    </section>
  `

  const style = document.createElement('style')
  style.textContent = `
    #${rootId}{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#eee3d1;pointer-events:none}
    #${rootId} button{font:inherit;cursor:pointer}
    .rr-live-toggle{pointer-events:auto;border:1px solid #5b4625;background:#11100d;color:#e4a641;border-radius:999px;padding:9px 12px;font-size:9px;font-weight:800;letter-spacing:.08em;box-shadow:0 12px 35px rgba(0,0,0,.35)}
    .rr-live-panel{pointer-events:auto;width:340px;margin-top:9px;border:1px solid #3a3124;border-radius:12px;background:rgba(13,12,10,.96);backdrop-filter:blur(16px);box-shadow:0 20px 70px rgba(0,0,0,.55);overflow:hidden}
    .rr-live-head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-bottom:1px solid #29251f}
    .rr-live-head strong{display:block;font-size:11px}.rr-live-head small{display:block;color:#777066;font-size:8px;margin-top:3px}
    .rr-live-head span{font-size:8px;color:#6ed099;text-transform:uppercase;letter-spacing:.1em}
    .rr-live-list{max-height:300px;overflow-y:auto;overscroll-behavior:contain}.rr-live-row{padding:11px 14px;border-bottom:1px solid #211e18}.rr-live-row:last-child{border-bottom:0}
    .rr-live-row-top{display:flex;justify-content:space-between;gap:8px;font-size:9px}.rr-live-row-top b{color:#ddd2c3}.rr-live-row-top em{font-style:normal;color:#6ed099;text-transform:uppercase;font-size:7px}
    .rr-live-row small{display:block;color:#777066;font-size:8px;margin-top:4px}.rr-live-row .failed{color:#e87d77}.rr-live-row .authorized,.rr-live-row .captured{color:#6ed099}
    .rr-live-empty{padding:20px 14px;color:#777066;font-size:9px;line-height:1.6}
    .rr-live-foot{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-top:1px solid #29251f;color:#5f594f;font-size:8px}.rr-live-foot button{border:1px solid #3a3124;background:#17140f;color:#d7c7b0;border-radius:6px;padding:5px 8px;font-size:8px}
    @media(max-width:650px){#${rootId}{right:10px;bottom:10px}.rr-live-panel{width:min(340px,calc(100vw - 20px))}}
  `
  document.head.appendChild(style)
  document.body.appendChild(host)

  const toggle = host.querySelector<HTMLButtonElement>('[data-toggle]')!
  const panel = host.querySelector<HTMLElement>('[data-panel]')!
  const state = host.querySelector<HTMLElement>('[data-state]')!
  const list = host.querySelector<HTMLElement>('[data-list]')!
  const time = host.querySelector<HTMLElement>('[data-time]')!
  const refresh = host.querySelector<HTMLButtonElement>('[data-refresh]')!

  let timer: number | undefined
  let activeAbortController: AbortController | null = null
  let lastFingerprint = ''

  const refreshFeed = async () => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }

    const controller = new AbortController()
    activeAbortController = controller

    state.textContent = 'syncing'
    try {
      const response = await fetch(RAZORPAY_FEED_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Razorpay API returned HTML instead of JSON. Check the configured production API URL.')
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Razorpay payment feed unavailable')
      
      const items = (data.items || []) as RazorpayPayment[]
      const fingerprint = computeFeedFingerprint(items)

      // Only update DOM and dispatch event if data actually changed
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint
        emitPaymentFeed(items, data.fetchedAt)
        list.innerHTML = items.length
          ? items.slice(0, 8).map((payment) => {
              const status = String(payment.status || 'unknown').toLowerCase()
              const amount = money(Number(payment.amount || 0), payment.currency || 'INR')
              const method = payment.method ? ` · ${payment.method}` : ''
              const error = payment.error_description ? ` · ${payment.error_description}` : ''
              const created = payment.created_at ? new Date(payment.created_at * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'time unavailable'
              return `<article class="rr-live-row"><div class="rr-live-row-top"><b>${payment.id}</b><em class="${status}">${status}</em></div><small>${created} · ${amount}${method}${error}</small></article>`
            }).join('')
          : '<div class="rr-live-empty">No Test Mode payments yet. Create a Test Mode transaction and refresh.</div>'
      }

      state.textContent = 'connected'
      time.textContent = `synced ${new Date(data.fetchedAt || Date.now()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      state.textContent = 'offline'
      list.innerHTML = `<div class="rr-live-empty">${error instanceof Error ? error.message : 'Unable to load Razorpay Test Mode feed.'}</div>`
      time.textContent = 'check Environment Variables'
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null
      }
    }
  }

  const stopPolling = () => {
    if (timer) {
      window.clearInterval(timer)
      timer = undefined
    }
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  }

  const startPolling = () => {
    stopPolling()
    void refreshFeed()
    timer = window.setInterval(refreshFeed, 12000)
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden
    panel.setAttribute('aria-hidden', String(panel.hidden))
    if (!panel.hidden) {
      startPolling()
    } else {
      stopPolling()
    }
  })

  refresh.addEventListener('click', () => void refreshFeed())

  window.addEventListener('beforeunload', stopPolling)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
}
