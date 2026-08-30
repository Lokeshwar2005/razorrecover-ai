import { useMemo, useRef, useState } from 'react'
import { PLAYBOOKS, createTransaction, type RecoveryDirection } from '../recoveryEngine'

type Scenario = 'balanced' | 'checkout' | 'degradation'
type WorkflowStatus = 'READY' | 'RUNNING' | 'COMPLETE' | 'ESCALATED'

type Props = {
  scenario: Scenario
  onSelectTransaction: (id: string) => void
}

const directions: Array<{
  id: RecoveryDirection
  short: string
  description: string
  workflow: string[]
  liveAction: string
  tone: 'gold' | 'green' | 'red'
}> = [
  { id: 'Payment degradation', short: 'Gateway recovery', description: 'When a bank or gateway starts failing, RazorRecover finds the pattern and retries only when it is safe.', workflow: ['Detect failed payments', 'Find bank / issuer pattern', 'Apply retry safety rules', 'Verify recovered payment'], liveAction: 'Run gateway recovery', tone: 'gold' },
  { id: 'Checkout drop-off', short: 'Checkout recovery', description: 'When a customer leaves checkout, RazorRecover brings them back with a safe payment link instead of a duplicate charge.', workflow: ['Find abandoned checkout', 'Score purchase intent', 'Create recovery link', 'Verify conversion'], liveAction: 'Recover checkout', tone: 'gold' },
  { id: 'Failed-subscription recovery', short: 'Subscription recovery', description: 'When a recurring payment fails, RazorRecover retries within limits and helps restore the subscription.', workflow: ['Find past-due subscription', 'Choose safe retry window', 'Retry or send recovery link', 'Confirm subscription restored'], liveAction: 'Recover subscription', tone: 'green' },
  { id: 'B2B receivables chaser', short: 'B2B collections', description: 'For overdue business invoices, RazorRecover prioritizes the right follow-up and hands risky cases to a human.', workflow: ['Age the invoice', 'Score account risk', 'Send contextual reminder', 'Escalate risky invoice'], liveAction: 'Run AR chase', tone: 'green' },
  { id: 'Mandate retry sequencer', short: 'Mandate recovery', description: 'For failed bank mandates, RazorRecover sequences limited retries and falls back safely when the limit is reached.', workflow: ['Classify mandate failure', 'Choose retry window', 'Respect retry ceiling', 'Fallback to payment link'], liveAction: 'Sequence mandate', tone: 'gold' },
  { id: 'Hinglish voice recovery', short: 'Hinglish voice', description: 'For high-intent customers, RazorRecover prepares a short bilingual conversation and asks for consent before recovery.', workflow: ['Detect high intent', 'Prepare Hinglish script', 'Ask consent safely', 'Share recovery link'], liveAction: 'Play Hinglish script', tone: 'green' },
  { id: 'Promise-to-pay tracker', short: 'Promise to pay', description: 'When a customer promises to pay later, RazorRecover tracks the date and escalates only if the promise is missed.', workflow: ['Record promise', 'Set due date', 'Track payment status', 'Escalate missed promise'], liveAction: 'Track promise', tone: 'red' },
]

const guide = [
  ['01', 'Detect', 'Find failed, risky or abandoned payments.'],
  ['02', 'Decide', 'AI explains the safest next step.'],
  ['03', 'Act', 'Run a bounded recovery action.'],
  ['04', 'Verify', 'Count money only after evidence.'],
  ['05', 'Learn', 'Write the outcome to the shared ledger.'],
]

export default function RecoveryPlaybooks({ scenario, onSelectTransaction }: Props) {
  const [active, setActive] = useState<RecoveryDirection | null>(null)
  const [status, setStatus] = useState<WorkflowStatus>('READY')
  const [message, setMessage] = useState('Choose a service above. The selected transaction will appear in the shared product state.')
  const [ptpDate, setPtpDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10))
  const [ptpState, setPtpState] = useState<'PROMISED' | 'PAID' | 'MISSED'>('PROMISED')
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [selectedTime, setSelectedTime] = useState<Date | null>(null)
  const consoleRef = useRef<HTMLDivElement | null>(null)

  const activeData = useMemo(() => directions.find((d) => d.id === active) || null, [active])
  const stepIndex = status === 'READY' ? 0 : status === 'RUNNING' ? 2 : status === 'ESCALATED' ? 3 : 4
  const transactionTime = selectedTime
    ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(selectedTime)
    : '—'
  const transactionDate = selectedTime
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(selectedTime)
    : 'Waiting for selection'

  const open = (direction: RecoveryDirection) => {
    setActive(direction)
    setStatus('READY')
    setMessage('Service selected. Run the bounded action to send this transaction through the recovery journey.')
    setSelectedTime(new Date())
    window.requestAnimationFrame(() => consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const run = async () => {
    if (!activeData || status === 'RUNNING') return
    const sample = createTransaction(directions.findIndex((d) => d.id === activeData.id), scenario)
    const now = new Date()
    setSelectedTime(now)
    onSelectTransaction(sample.id)
    setStatus('RUNNING')
    setMessage(`${sample.id} · ${formatTimestamp(now)} — AI is checking the cause, risk and policy before acting.`)

    if (activeData.id === 'Hinglish voice recovery') {
      const text = 'Namaste! Aapka payment complete nahi hua. Main ek secure payment link share kar sakta hoon. Kya aap abhi retry karna chahenge?'
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'hi-IN'
        utterance.rate = 0.94
        utterance.onstart = () => setVoicePlaying(true)
        utterance.onend = () => setVoicePlaying(false)
        window.speechSynthesis.speak(utterance)
      }
      setVoicePlaying(true)
      window.setTimeout(() => setVoicePlaying(false), 5200)
      setStatus('COMPLETE')
      setMessage(`${sample.id} · ${formatTimestamp(now)} — consent-safe Hinglish script prepared. No automatic call is placed.`)
      return
    }

    if (activeData.id === 'Promise-to-pay tracker') {
      const nextStatus = ptpState === 'MISSED' ? 'ESCALATED' : 'COMPLETE'
      setStatus(nextStatus)
      setMessage(ptpState === 'MISSED'
        ? `${sample.id} · ${formatTimestamp(now)} — promise missed on ${ptpDate}; human escalation created.`
        : `${sample.id} · ${formatTimestamp(now)} — promise tracked through ${ptpDate}; reminder scheduled.`)
      return
    }

const RAZORPAY_ACTION_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_ACTION_URL) ||
  'https://razorrecover-ai-teal.vercel.app/api/razorpay/action'

    if (activeData.id === 'Payment degradation' || activeData.id === 'Checkout drop-off') {
      const action = activeData.id === 'Checkout drop-off' ? 'Payment link' : 'Retry payment'
      try {
        const response = await fetch(RAZORPAY_ACTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, transactionId: sample.id, amount: sample.amount }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Razorpay Test Mode action failed')
        setStatus('COMPLETE')
        setMessage(action === 'Payment link'
          ? `${sample.id} · ${formatTimestamp(now)} — Test Mode payment link created. Payment remains unverified until checkout success.`
          : `${sample.id} · ${formatTimestamp(now)} — Test Mode retry order ${data.orderId || 'created'} is ready. Payment remains unverified until checkout success.`)
      } catch (error) {
        setStatus('ESCALATED')
        setMessage(`${sample.id} · ${formatTimestamp(now)} — ${error instanceof Error ? error.message : 'Test Mode action failed.'}`)
      }
      return
    }

    window.setTimeout(() => {
      const escalated = activeData.id === 'B2B receivables chaser' && sample.riskScore >= 60
      setStatus(escalated ? 'ESCALATED' : 'COMPLETE')
      setMessage(escalated
        ? `${sample.id} · ${formatTimestamp(now)} — risk boundary crossed; human AR escalation created.`
        : `${sample.id} · ${formatTimestamp(now)} — ${activeData.liveAction} completed in simulation and written to the shared product state.`)
    }, 650)
  }

  return <section className="panel playbooks" id="recovery-playbooks">
    <div className="panelTop">
      <div><span className="eyebrow">WHAT RAZORRECOVER DOES</span><h2>One system that finds and recovers lost revenue</h2></div>
      <span className="pulse">● plain-language demo</span>
    </div>

    <div className="productIntro">
      <div className="introLead"><strong>Payments fail for many reasons.</strong><span>RazorRecover watches the signal, explains why a payment is at risk, chooses a safe recovery action, and records the outcome so a business can see what happened.</span></div>
      <div className="introRule"><span>INPUT</span><b>Failed / abandoned payment</b><i>→</i><span>OUTPUT</span><b>Recovered money or safe escalation</b></div>
    </div>

    <div className="journeyGuide">
      {guide.map(([number, title, text], index) => <div className={`journeyGuideStep ${stepIndex >= index + 1 ? 'reached' : ''}`} key={number}><span>{number}</span><div><b>{title}</b><small>{text}</small></div></div>)}
    </div>

    <div className="serviceHeader"><div><span className="eyebrow">SERVICES / 07</span><h3>Choose the problem you want to recover</h3><p>Each service below is a different way revenue gets lost. Click one to see the same transaction travel through the recovery system.</p></div><span className="serviceHint">CLICK → WATCH → EXPLAIN</span></div>

    <div className="playbookGrid">
      {directions.map((direction, index) => {
        const representative = PLAYBOOKS.find((p) => p.direction === direction.id)!
        return <button key={direction.id} className={`playbookCard ${active === direction.id ? 'active' : ''}`} onClick={() => open(direction.id)}>
          <div className="playbookNumber">0{index + 1}</div>
          <div className="playbookCardTop"><strong>{direction.short}</strong><span className={`playbookDot ${direction.tone}`}>●</span></div>
          <p>{direction.description}</p>
          <div className="playbookMeta"><span>Example: {representative.reason}</span><b>{representative.action}</b></div>
        </button>
      })}
    </div>

    {activeData && <div className="playbookConsole" ref={consoleRef}>
      <div className="playbookConsoleHead">
        <div><span className="eyebrow">LIVE TRANSACTION JOURNEY</span><h3>{activeData.short}</h3></div>
        <button className="closePlaybook" onClick={() => setActive(null)}>×</button>
      </div>

      <div className="transactionBanner">
        <div><span>TRANSACTION</span><strong>{createTransaction(directions.findIndex((d) => d.id === activeData.id), scenario).id}</strong></div>
        <div><span>TIME</span><strong>{transactionTime}</strong><small>{transactionDate}</small></div>
        <div><span>SCENARIO</span><strong>{scenario === 'balanced' ? 'Balanced' : scenario === 'checkout' ? 'Checkout drop-off' : 'Gateway degradation'}</strong></div>
        <div><span>STATE</span><strong className={`bannerState ${status.toLowerCase()}`}>{status}</strong></div>
      </div>

      <div className="workflowSteps">
        {activeData.workflow.map((step, index) => <div className={`workflowStep ${stepIndex > index ? 'done' : ''} ${stepIndex === index + 1 ? 'current' : ''}`} key={step}><span>0{index + 1}</span><b>{step}</b>{stepIndex === index + 1 && <em>NOW</em>}</div>)}
      </div>

      {activeData.id === 'Promise-to-pay tracker' && <div className="ptpControls"><label>Promise date<input type="date" value={ptpDate} onChange={(e) => setPtpDate(e.target.value)} /></label><label>Status<select value={ptpState} onChange={(e) => setPtpState(e.target.value as typeof ptpState)}><option>PROMISED</option><option>PAID</option><option>MISSED</option></select></label></div>}
      {activeData.id === 'Hinglish voice recovery' && <div className="voicePanel"><span className="voiceWave">{voicePlaying ? '))) ))) )))' : '— — — —'}</span><p>“Namaste! Aapka payment complete nahi hua. Main ek secure payment link share kar sakta hoon. Kya aap abhi retry karna chahenge?”</p><small>Browser voice demo · consent-safe · no automatic call</small></div>}

      <div className="plainJourney"><span className="plainJourneyDot">●</span><div><b>What the judge is seeing</b><p>{message}</p></div></div>
      <div className="playbookActionRow"><div className={`workflowStatus ${status.toLowerCase()}`}><span>●</span>{status}</div><button className="run runPlaybook" onClick={run} disabled={status === 'RUNNING'}>{status === 'RUNNING' ? 'Processing transaction' : activeData.liveAction}<b>↗</b></button></div>
    </div>}

    <div className="judgeDemo">
      <div><span className="eyebrow">30-SECOND JUDGE STORY</span><h3>“A payment fails → AI explains it → policy decides → recovery runs → money is verified.”</h3></div>
      <div className="judgeDemoSteps"><span>1. Pick a service</span><span>2. Run it</span><span>3. Watch the journey</span><span>4. Check the ledger / graph / audit trail</span></div>
    </div>
  </section>
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(value)
}
