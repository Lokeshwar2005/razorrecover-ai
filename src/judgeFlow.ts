const serviceLabels = [
  'Gateway recovery',
  'Checkout recovery',
  'Subscription recovery',
  'B2B collections',
  'Mandate recovery',
  'Hinglish voice',
  'Promise to pay',
]

function scrollToText(text: string) {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('section, .panel, h1, h2, h3, .eyebrow'))
  const target = elements.find((el) => el.textContent?.toLowerCase().includes(text.toLowerCase()))
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function formatTxnTime(index: number) {
  const d = new Date()
  d.setMinutes(d.getMinutes() - index * 3)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
}

function enhanceNavigation() {
  const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.navTabs button'))
  const destinations: Record<string, string> = {
    Overview: 'REVENUE RECOVERY / 01',
    Simulation: 'RECOVERY LAB',
    'Agent trace': 'AI JUDGEMENT',
    'Audit trail': 'AUDIT',
  }
  navButtons.forEach((button) => {
    const label = button.textContent?.trim() || ''
    button.onclick = () => scrollToText(destinations[label] || label)
  })
}

function enhanceTransactions() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.transactions .row'))
  rows.forEach((row, index) => {
    if (row.querySelector('.txnTime')) return
    const time = document.createElement('span')
    time.className = 'txnTime'
    time.textContent = formatTxnTime(index)
    time.title = 'Synthetic event timestamp · local time'
    row.prepend(time)
  })
}

function enhanceServiceCards() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.playbookCard'))
  cards.forEach((card, index) => {
    if (!card.querySelector('.serviceIndex')) {
      const badge = document.createElement('span')
      badge.className = 'serviceIndex'
      badge.textContent = `SERVICE ${String(index + 1).padStart(2, '0')}`
      card.prepend(badge)
    }
    if (!card.getAttribute('aria-label')) card.setAttribute('aria-label', serviceLabels[index] || 'Recovery service')
  })
}

function boot() {
  enhanceNavigation()
  enhanceTransactions()
  enhanceServiceCards()
  const observer = new MutationObserver(() => {
    enhanceNavigation()
    enhanceTransactions()
    enhanceServiceCards()
  })
  observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
