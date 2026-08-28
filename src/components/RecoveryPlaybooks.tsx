import { useMemo, useState } from 'react'
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
  { id: 'Payment degradation', short: 'Gateway recovery', description: 'Detect issuer or bank degradation, isolate the fault and retry only when the signal is safe.', workflow: ['Detect elevated failures', 'Cluster bank / issuer root cause', 'Gate retry by risk + attempts', 'Verify recovered payment'], liveAction: 'Run retry diagnosis', tone: 'gold' },
  { id: 'Checkout drop-off', short: 'Checkout recovery', description: 'Recover high-intent abandoned checkouts without duplicating a payment attempt.', workflow: ['Identify abandoned checkout', 'Score intent', 'Issue recovery link', 'Verify link conversion'], liveAction: 'Issue payment link', tone: 'gold' },
  { id: 'Failed-subscription recovery', short: 'Subscription recovery', description: 'Move past-due subscriptions through bounded retry and recovery-link steps.', workflow: ['Detect past-due state', 'Choose retry window', 'Retry or send recovery link', 'Confirm subscription restored'], liveAction: 'Start subscription retry', tone: 'green' },
  { id: 'B2B receivables chaser', short: 'B2B collections', description: 'Prioritize overdue invoices, draft the right chase and escalate high-value receivables.', workflow: ['Age receivable', 'Score account risk', 'Send contextual reminder', 'Escalate unresolved invoice'], liveAction: 'Run AR chase', tone: 'green' },
  { id: 'Mandate retry sequencer', short: 'Mandate recovery', description: 'Sequence mandate retries with a hard retry ceiling and fallback payment path.', workflow: ['Classify mandate failure', 'Select retry window', 'Respect retry ceiling', 'Fallback to payment link'], liveAction: 'Sequence mandate retry', tone: 'gold' },
  { id: 'Hinglish voice recovery', short: 'Hinglish voice', description: 'Generate a concise bilingual recovery conversation for high-intent customers.', workflow: ['Detect high intent', 'Prepare Hinglish script', 'Read consent-safe prompt', 'Send recovery link'], liveAction: 'Play voice script', tone: 'green' },
  { id: 'Promise-to-pay tracker', short: 'Promise to pay', description: 'Capture a promised payment date, monitor it and escalate only when the promise is missed.', workflow: ['Record promise', 'Set due date', 'Track status', 'Escalate missed promise'], liveAction: 'Create PTP', tone: 'red' },
]

export default function RecoveryPlaybooks({ scenario, onSelectTransaction }: Props) {
  const [active, setActive] = useState<RecoveryDirection | null>(null)
  const [status, setStatus] = useState<WorkflowStatus>('READY')
  const [message, setMessage] = useState('Select a playbook to inspect its workflow.')
  const [ptpDate, setPtpDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10))
  const [ptpState, setPtpState] = useState<'PROMISED' | 'PAID' | 'MISSED'>('PROMISED')
  const [voicePlaying, setVoicePlaying] = useState(false)

  const activeData = useMemo(() => directions.find((d) => d.id === active) || null, [active])

  const open = (direction: RecoveryDirection) => {
    setActive(direction)
    setStatus('READY')
    setMessage('Workflow armed. Choose the bounded action below.')
  }

  const run = async () => {
    if (!activeData) return
    const sample = createTransaction(directions.findIndex((d) => d.id === activeData.id), scenario)
    onSelectTransaction(sample.id)
    setStatus('RUNNING')
    setMessage(`${activeData.short} is evaluating ${sample.id} with policy gates.`)

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
      setMessage('Consent-safe Hinglish script prepared. No call is placed automatically.')
      return
    }

    if (activeData.id === 'Promise-to-pay tracker') {
      setStatus(ptpState === 'MISSED' ? 'ESCALATED' : 'COMPLETE')
      setMessage(ptpState === 'MISSED' ? `Promise missed on ${ptpDate}; escalation created.` : `Promise tracked through ${ptpDate}; reminder scheduled in the workflow.`)
      return
    }

    if (activeData.id === 'Payment degradation' || activeData.id === 'Checkout drop-off') {
      const action = activeData.id === 'Checkout drop-off' ? 'Payment link' : 'Retry payment'
      try {
        const response = await fetch('/api/razorpay/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, transactionId: sample.id, amount: sample.amount }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Razorpay Test Mode action failed')
        setStatus('COMPLETE')
        setMessage(action === 'Payment link' ? `Test Mode payment link created: ${data.paymentLink || 'ready'}.` : `Test Mode retry order ${data.orderId || 'created'} is ready for checkout.`)
      } catch (error) {
        setStatus('ESCALATED')
        setMessage(error instanceof Error ? error.message : 'Test Mode action could not be completed.')
      }
      return
    }

    window.setTimeout(() => {
      setStatus(activeData.id === 'B2B receivables chaser' && sample.riskScore >= 60 ? 'ESCALATED' : 'COMPLETE')
      setMessage(activeData.id === 'B2B receivables chaser' && sample.riskScore >= 60 ? 'High-value receivable crossed the risk boundary; human AR escalation created.' : `${activeData.liveAction} completed in simulation with audit evidence attached.`)
    }, 650)
  }

  return <section className="panel playbooks" id="recovery-playbooks">
    <div className="panelTop"><div><span className="eyebrow">RECOVERY PLAYBOOKS / 07</span><h2>Seven first-class recovery directions</h2></div><span className="pulse">● interactive</span></div>
    <div className="playbookGrid">
      {directions.map((direction, index) => {
        const representative = PLAYBOOKS.find((p) => p.direction === direction.id)!
        return <button key={direction.id} className={`playbookCard ${active === direction.id ? 'active' : ''}`} onClick={() => open(direction.id)}>
          <div className="playbookNumber">0{index + 1}</div>
          <div className="playbookCardTop"><strong>{direction.short}</strong><span className={`playbookDot ${direction.tone}`}>●</span></div>
          <p>{direction.description}</p>
          <div className="playbookMeta"><span>{representative.reason}</span><b>{representative.action}</b></div>
        </button>
      })}
    </div>

    {activeData && <div className="playbookConsole">
      <div className="playbookConsoleHead"><div><span className="eyebrow">ACTIVE WORKFLOW</span><h3>{activeData.short}</h3></div><button className="closePlaybook" onClick={() => setActive(null)}>×</button></div>
      <div className="workflowSteps">{activeData.workflow.map((step, index) => <div className={status !== 'READY' && index < (status === 'COMPLETE' || status === 'ESCALATED' ? 4 : 2) ? 'workflowStep done' : 'workflowStep'} key={step}><span>0{index + 1}</span><b>{step}</b></div>)}</div>
      {activeData.id === 'Promise-to-pay tracker' && <div className="ptpControls"><label>Promise date<input type="date" value={ptpDate} onChange={(e) => setPtpDate(e.target.value)} /></label><label>Status<select value={ptpState} onChange={(e) => setPtpState(e.target.value as typeof ptpState)}><option>PROMISED</option><option>PAID</option><option>MISSED</option></select></label></div>}
      {activeData.id === 'Hinglish voice recovery' && <div className="voicePanel"><span className="voiceWave">{voicePlaying ? '))) ))) )))' : '— — — —'}</span><p>“Namaste! Aapka payment complete nahi hua. Main ek secure payment link share kar sakta hoon. Kya aap abhi retry karna chahenge?”</p><small>Browser voice demo · consent-safe · no automatic call</small></div>}
      <div className="playbookActionRow"><div className={`workflowStatus ${status.toLowerCase()}`}><span>●</span>{status}</div><button className="run runPlaybook" onClick={run}>{activeData.liveAction}<b>↗</b></button></div>
      <div className="workflowMessage">{message}</div>
    </div>}
  </section>
}
