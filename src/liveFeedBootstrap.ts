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

const rootId = 'razorrecover-live-feed'

function money(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100)
}

function mount() {
  if (document.getElementById(rootId)) return

  const host = document.createElement('div')
  host.id = rootId
  host.innerHTML = `
    <button data-toggle class="rr-live-toggle">RZP TEST · LIVE FEED</button>
    <section data-panel class="rr-live-panel" hidden>
      <div class="rr-live-head"><div><strong>Razorpay Test Mode</strong><small>polling payment events</small></div><span data-state>idle</span></div>
      <div data-list class="rr-live-list"><div class="rr-live-empty">Connect Test Mode to see real payment events.</div></div>
      <div class="rr-live-foot"><span data-time>—</span><button data-refresh>Refresh</button></div>
    </section>
  `

  const style = document.createElement('style')
  style.textContent = `
    #${rootId}{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#eee3d1}
    #${rootId} button{font:inherit;cursor:pointer}
    .rr-live-toggle{border:1px solid #5b4625;background:#11100d;color:#e4a641;border-radius:999px;padding:9px 12px;font-size:9px;font-weight:800;letter-spacing:.08em;box-shadow:0 12px 35px rgba(0,0,0,.35)}
    .rr-live-panel{width:340px;margin-top:9px;border:1px solid #3a3124;border-radius:12px;background:rgba(13,12,10,.96);backdrop-filter:blur(16px);box-shadow:0 20px 70px rgba(0,0,0,.55);overflow:hidden}
    .rr-live-head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-bottom:1px solid #29251f}
    .rr-live-head strong{display:block;font-size:11px}.rr-live-head small{display:block;color:#777066;font-size:8px;margin-top:3px}
    .rr-live-head span{font-size:8px;color:#6ed099;text-transform:uppercase;letter-spacing:.1em}
    .rr-live-list{max-height:300px;overflow:auto}.rr-live-row{padding:11px 14px;border-bottom:1px solid #211e18}.rr-live-row:last-child{border-bottom:0}
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

  const refreshFeed = async () => {
    state.textContent = 'syncing'
    try {
      const response = await fetch('/api/razorpay/feed', { headers: { Accept: 'application/json' } })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Feed unavailable')
      const items = (data.items || []) as RazorpayPayment[]
      list.innerHTML = items.length
        ? items.slice(0, 8).map((payment) => {
            const status = String(payment.status || 'unknown').toLowerCase()
            const amount = money(Number(payment.amount || 0), payment.currency || 'INR')
            const method = payment.method ? ` · ${payment.method}` : ''
            const error = payment.error_description ? ` · ${payment.error_description}` : ''
            return `<article class="rr-live-row"><div class="rr-live-row-top"><b>${payment.id}</b><em class="${status}">${status}</em></div><small>${amount}${method}${error}</small></article>`
          }).join('')
        : '<div class="rr-live-empty">No Test Mode payments yet. Create a Test Mode transaction and refresh.</div>'
      state.textContent = 'connected'
      time.textContent = `synced ${new Date(data.fetchedAt || Date.now()).toLocaleTimeString()}`
    } catch (error) {
      state.textContent = 'offline'
      list.innerHTML = `<div class="rr-live-empty">${error instanceof Error ? error.message : 'Unable to load Razorpay Test Mode feed.'}</div>`
      time.textContent = 'check Environment Variables'
    }
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden
    if (!panel.hidden) {
      void refreshFeed()
      timer = window.setInterval(refreshFeed, 8000)
    } else if (timer) {
      window.clearInterval(timer)
      timer = undefined
    }
  })
  refresh.addEventListener('click', () => void refreshFeed())
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
else mount()
