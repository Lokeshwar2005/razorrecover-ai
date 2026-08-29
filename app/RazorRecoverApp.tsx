'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import DecisionExecutionSequence from '../src/components/DecisionExecutionSequence'
import RecoveryIntelligenceGraph from '../src/components/RecoveryIntelligenceGraph/RecoveryIntelligenceGraph'
import CounterfactualLab from '../src/components/CounterfactualLab/CounterfactualLab'
import AIRecoveryAdvisor from '../src/components/AIRecoveryAdvisor/AIRecoveryAdvisor'
import { AgentTrace2 } from '../src/components/Trace/AgentTrace2'
import { MerchantDashboard } from '../src/components/Dashboard/MerchantDashboard'
import { OpportunityQueue } from '../src/components/Opportunities/OpportunityQueue'
import { TransactionExplorer } from '../src/components/Transactions/TransactionExplorer'
import { RecoveryAnalyticsView } from '../src/components/Analytics/RecoveryAnalyticsView'
import { PolicySettingsView } from '../src/components/Settings/PolicySettingsView'
import { AuditComplianceCenter } from '../src/components/Audit/AuditComplianceCenter'
import { GraphTransactionContext } from '../src/types/graph'
import { createTransaction, type RecoveryDirection } from '../src/recoveryEngine'
import { useTransactionStore } from '../src/services/canonicalTransactionStore'

type Result = 'Recovered' | 'Stopped' | 'Pending'
type Scenario = 'balanced' | 'checkout' | 'degradation'
type WorkflowStatus = 'READY' | 'RUNNING' | 'COMPLETE' | 'ESCALATED'
type EventItem = ReturnType<typeof createTransaction> & {
  workflowStatus?: WorkflowStatus
  workflowMessage?: string
  workflowAction?: string
  verifiedAmount?: number
  occurredAt?: string
  source?: 'razorpay' | 'synthetic'
  providerId?: string
}
type AuditItem = { time: string; event: string; detail: string; status: 'INFO' | 'PASS' | 'STOP' | 'LIVE' }
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

const scenarios = {
  balanced: { label: 'Balanced' },
  checkout: { label: 'Checkout drop-off' },
  degradation: { label: 'Gateway degradation' },
} as const

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const formatEventTime = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '—'

const makeEvents = (scenario: Scenario): EventItem[] =>
  Array.from({ length: 100 }, (_, i) => createTransaction(i, scenario))

const directions: Array<{
  id: RecoveryDirection
  short: string
  description: string
  steps: string[]
  action: string
  tone: 'gold' | 'green' | 'red'
}> = [
  {
    id: 'Payment degradation',
    short: 'Gateway recovery',
    description: 'Detect issuer degradation, isolate the fault and retry only inside policy limits.',
    steps: ['Detect elevated failures', 'Cluster bank / issuer root cause', 'Gate retry by risk + attempts', 'Verify recovered payment'],
    action: 'Run gateway recovery',
    tone: 'gold',
  },
  {
    id: 'Checkout drop-off',
    short: 'Checkout recovery',
    description: 'Recover high-intent abandoned checkouts without duplicating a payment attempt.',
    steps: ['Identify abandoned checkout', 'Score purchase intent', 'Issue recovery link', 'Verify conversion'],
    action: 'Recover checkout',
    tone: 'gold',
  },
  {
    id: 'Failed-subscription recovery',
    short: 'Subscription recovery',
    description: 'Move past-due subscriptions through bounded retry and recovery-link steps.',
    steps: ['Detect past-due state', 'Choose retry window', 'Retry or recovery link', 'Confirm restored'],
    action: 'Recover subscription',
    tone: 'green',
  },
  {
    id: 'B2B receivables chaser',
    short: 'B2B collections',
    description: 'Prioritize overdue invoices, draft the right chase and escalate risky receivables.',
    steps: ['Age receivable', 'Score account risk', 'Send contextual reminder', 'Escalate unresolved invoice'],
    action: 'Run AR chase',
    tone: 'green',
  },
  {
    id: 'Mandate retry sequencer',
    short: 'Mandate recovery',
    description: 'Sequence mandate retries with a hard retry ceiling and safe fallback.',
    steps: ['Classify mandate failure', 'Select retry window', 'Respect retry ceiling', 'Fallback payment link'],
    action: 'Sequence mandate',
    tone: 'gold',
  },
  {
    id: 'Hinglish voice recovery',
    short: 'Hinglish voice',
    description: 'Prepare a concise bilingual, consent-safe recovery conversation.',
    steps: ['Detect high intent', 'Prepare Hinglish script', 'Read consent-safe prompt', 'Send recovery link'],
    action: 'Play Hinglish script',
    tone: 'green',
  },
  {
    id: 'Promise-to-pay tracker',
    short: 'Promise to pay',
    description: 'Capture a promised payment date and escalate only when the promise is missed.',
    steps: ['Record promise', 'Set due date', 'Track status', 'Escalate missed promise'],
    action: 'Create PTP',
    tone: 'red',
  },
]

function mapRazorpayPayment(payment: RazorpayPayment): EventItem | null {
  const status = String(payment.status || 'unknown').toLowerCase()
  const amount = Math.round(Number(payment.amount || 0) / 100)
  if (!payment.id || !amount) return null
  const failed = status === 'failed'
  const captured = status === 'captured' || status === 'authorized'
  const reason = failed
    ? payment.error_description || 'Razorpay payment failed'
    : captured
    ? 'Payment captured'
    : 'Razorpay payment event received'
  const direction: RecoveryDirection = failed
    ? 'Payment degradation'
    : payment.error_description?.toLowerCase().includes('subscription')
    ? 'Failed-subscription recovery'
    : 'Payment degradation'
  const action = failed ? 'Retry payment' : captured ? 'Payment verified' : 'Review payment event'
  const occurredAt = payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString()
  return {
    id: `RZP-${payment.id}`,
    providerId: payment.id,
    source: 'razorpay',
    occurredAt,
    amount,
    latency: '1s',
    direction,
    reason,
    action,
    result: captured ? 'Recovered' : 'Pending',
    confidence: failed ? 94 : 99,
    recoveryProbability: failed ? 72 : 100,
    riskScore: failed ? 32 : 4,
    policy: 'Approved',
    explanation: failed
      ? `Razorpay Test Mode reported a failed payment at ${formatEventTime(occurredAt)}. RazorRecover ingested it as revenue at risk and is ready to apply a bounded recovery workflow.`
      : 'Razorpay Test Mode payment verified. This event is recorded as recovered evidence.',
    workflowStatus: failed ? 'READY' : 'COMPLETE',
    workflowMessage: failed
      ? 'Live payment failure ingested. Choose the bounded recovery action below.'
      : 'Payment verification received from Razorpay Test Mode.',
    workflowAction: action,
    verifiedAmount: captured ? amount : 0,
  }
}

const detectViewFromUrl = (): string => {
  if (typeof window === 'undefined') return 'Overview'
  const full = `${window.location.pathname} ${window.location.hash} ${window.location.search}`.toLowerCase()
  if (full.includes('dashboard')) return 'Command Center'
  if (full.includes('opportunities')) return 'Opportunities'
  if (full.includes('transactions')) return 'Transactions'
  if (full.includes('analytics')) return 'Analytics'
  if (full.includes('policies') || full.includes('settings')) return 'Policies'
  if (full.includes('audit')) return 'Audit'
  if (full.includes('simulation')) return 'Simulation'
  if (full.includes('agent-trace') || full.includes('trace')) return 'Agent trace'
  return 'Overview'
}

export function RazorRecoverApp() {
  const seed = useMemo(() => makeEvents('balanced'), [])
  const [events, setEvents] = useState<EventItem[]>(seed)
  const [selected, setSelected] = useState<EventItem | null>(seed[0])
  const [scenario, setScenario] = useState<Scenario>('balanced')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tab, setTab] = useState<string>(detectViewFromUrl())
  const [toast, setToast] = useState('')
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [activeDirection, setActiveDirection] = useState<RecoveryDirection | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('READY')
  const [workflowMessage, setWorkflowMessage] = useState(
    'Choose a recovery direction. Its actions write back to the same ledger, graph, event stream and audit trail.'
  )
  const [ptpDate, setPtpDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10))
  const [ptpState, setPtpState] = useState<'PROMISED' | 'PAID' | 'MISSED'>('PROMISED')
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [judgeMode, setJudgeMode] = useState(false)
  const [cfTransaction, setCfTransaction] = useState<GraphTransactionContext | null>(null)
  const [cfTarget, setCfTarget] = useState<'original' | 'counterfactual'>('counterfactual')
  const [cfRunning, setCfRunning] = useState(false)
  const [cfProgress, setCfProgress] = useState(100)
  const raf = useRef<number | null>(null)

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current)
  }, [])

  // Sync selected transaction with canonical store
  useEffect(() => {
    if (selected?.id) {
      useTransactionStore.getState().setSelectedTransactionId(selected.id)
    }
  }, [selected?.id])

  // Sync canonical store selection to main app state
  const canonicalSelectedId = useTransactionStore((s) => s.selectedTransactionId)
  useEffect(() => {
    if (canonicalSelectedId && canonicalSelectedId !== selected?.id) {
      const match = events.find((e) => e.id === canonicalSelectedId)
      if (match) setSelected(match)
    }
  }, [canonicalSelectedId])

  const addAudit = (event: string, detail: string, status: AuditItem['status'] = 'INFO') =>
    setAudit((a) => [
      {
        time: new Date().toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        event,
        detail,
        status,
      },
      ...a,
    ].slice(0, 20))

  useEffect(() => {
    // Sync with canonical store provider feed
    useTransactionStore.getState().refreshProviderFeed()

    const onRazorpayFeed = (event: Event) => {
      const detail = (event as CustomEvent<{ items?: RazorpayPayment[] }>).detail
      const rawItems = detail?.items || []
      if (rawItems.length > 0) {
        useTransactionStore.getState().ingestProviderPayments(rawItems, false)
      }
      const incoming = rawItems.map(mapRazorpayPayment).filter((x): x is EventItem => Boolean(x))
      if (!incoming.length) return
      setEvents((current) => [...incoming, ...current.filter((item) => !incoming.some((live) => live.id === item.id)).slice(0, 100)])
      const latest = incoming[0]
      setSelected(latest)
      setProgress(100)
      setRunning(false)
      setActiveDirection(latest.direction)
      setWorkflowStatus(latest.workflowStatus || 'READY')
      setWorkflowMessage(latest.workflowMessage || 'Razorpay event ingested into the shared recovery ledger.')
      addAudit('rzp.event.ingested', `${formatEventTime(latest.occurredAt)} · ${money(latest.amount)} · ${latest.reason}`, 'LIVE')
      setToast(`Razorpay event ingested · ${money(latest.amount)}`)
      window.setTimeout(() => {
        document.getElementById('recovery-operations')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setToast('')
      }, 700)
    }
    window.addEventListener('razorpay:payment-feed', onRazorpayFeed)
    return () => window.removeEventListener('razorpay:payment-feed', onRazorpayFeed)
  }, [])

  const processed = Math.floor(progress)
  const riskEvents = running ? events.slice(0, processed) : events
  const risk = riskEvents.reduce((s, e) => s + e.amount, 0)
  const recovered = riskEvents.reduce((s, e) => s + (e.verifiedAmount ?? (e.result === 'Recovered' ? e.amount : 0)), 0)
  const rate = risk ? Math.min(99, Math.round((recovered / risk) * 100)) : 0
  const stopped = riskEvents.filter((e) => e.result === 'Stopped' || e.workflowStatus === 'ESCALATED').length
  const complete = progress >= 100 && !running
  const visible = useMemo(() => events.slice(0, 10), [events])
  const liveCount = events.filter((e) => e.source === 'razorpay').length
  const recoveredEvents = riskEvents.filter((e) => (e.verifiedAmount ?? (e.result === 'Recovered' ? e.amount : 0)) > 0)
  const velocity = recoveredEvents.length
    ? Math.round(
        recoveredEvents.reduce((s, e) => s + (e.verifiedAmount ?? e.amount), 0) /
          Math.max(1, recoveredEvents.reduce((s, e) => s + Number.parseInt(e.latency, 10), 0) / 1000)
      )
    : 0
  const velocityLabel = velocity ? `${money(velocity)}/s` : '—'
  const velocityScore = velocity ? Math.min(92, Math.max(8, Math.round((velocity / Math.max(1, risk)) * 10000))) : 8
  const chart = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const p = complete ? 1 : running ? progress / 100 : 0
        return Math.max(8, Math.min(92, 8 + (velocityScore - 8) * p + Math.sin(i * 0.75 + scenario.length) * 3 * p))
      }),
    [progress, complete, running, velocityScore, scenario]
  )

  const handleCfSync = (target: 'original' | 'counterfactual', txn: GraphTransactionContext | null, isRunning: boolean, p: number) => {
    setCfTarget(target)
    setCfTransaction(txn)
    setCfRunning(isRunning)
    setCfProgress(p)
  }

  const selectScenario = (s: Scenario) => {
    if (running) return
    const next = makeEvents(s)
    setScenario(s)
    setProgress(0)
    setEvents(next)
    setSelected(next[0])
    setActiveDirection(null)
    setWorkflowStatus('READY')
    setWorkflowMessage('Scenario armed. Choose a recovery direction to write into the shared ledger.')
    addAudit('scenario.armed', scenarios[s].label, 'INFO')
  }

  const run = () => {
    if (running) return
    const fresh = makeEvents(scenario)
    setRunning(true)
    setProgress(0)
    setSelected(null)
    setEvents(fresh.map((e) => ({ ...e, result: 'Pending' as Result, verifiedAmount: 0, workflowStatus: 'READY' as WorkflowStatus })))
    addAudit('batch.started', `${scenarios[scenario].label} · 100 synthetic transactions`, 'LIVE')
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / 6200) * 100)
      setProgress(p)
      const n = Math.floor(p)
      if (n > 0) setEvents((current) => current.map((e, i) => (i < n ? fresh[i] : { ...e, result: 'Pending' as Result })))
      if (p < 100) raf.current = requestAnimationFrame(tick)
      else {
        setRunning(false)
        setEvents(fresh.map((e) => ({ ...e, verifiedAmount: e.result === 'Recovered' ? e.amount : 0, workflowStatus: 'READY' as WorkflowStatus })))
        addAudit('batch.verified', 'Shared recovery ledger verified', 'PASS')
        setToast('Batch verified · shared ledger updated')
        window.setTimeout(() => setToast(''), 1800)
      }
    }
    raf.current = requestAnimationFrame(tick)
  }

  const selectPlaybook = (d: RecoveryDirection) => {
    if (running) return
    const sample = createTransaction(directions.findIndex((x) => x.id === d), scenario)
    const existing = events.find((e) => e.id === sample.id)
    setActiveDirection(d)
    setWorkflowStatus(existing?.workflowStatus || 'READY')
    setWorkflowMessage(existing?.workflowMessage || 'Workflow armed. Run the bounded action to propagate its result through the same product.')
    setSelected(existing ?? sample)
    addAudit('workflow.armed', `${d} → ${existing?.source === 'razorpay' ? existing.providerId : sample.id}`, 'INFO')
  }

  const applyWorkflow = (id: string, status: WorkflowStatus, message: string, action: string, verifiedAmount = 0) => {
    setWorkflowStatus(status)
    setWorkflowMessage(message)
    setEvents((current) =>
      current.map((e) =>
        e.id === id
          ? {
              ...e,
              workflowStatus: status,
              workflowMessage: message,
              workflowAction: action,
              action,
              explanation: `${e.explanation} Workflow: ${message}`,
              verifiedAmount,
            }
          : e
      )
    )
    setSelected((current) =>
      current && current.id === id
        ? {
            ...current,
            workflowStatus: status,
            workflowMessage: message,
            workflowAction: action,
            action,
            explanation: `${current.explanation} Workflow: ${message}`,
            verifiedAmount,
          }
        : current
    )
    addAudit(`workflow.${status.toLowerCase()}`, `${activeDirection} · ${id}`, status === 'COMPLETE' ? 'PASS' : status === 'ESCALATED' ? 'STOP' : 'LIVE')
    setToast(`${activeDirection} · ${status.toLowerCase()}`)
    window.setTimeout(() => setToast(''), 1800)
  }

  const runWorkflow = async () => {
    if (!activeDirection || workflowStatus === 'RUNNING') return
    const selectedLive = selected?.source === 'razorpay' && selected.direction === activeDirection ? selected : null
    const sample = selectedLive || createTransaction(directions.findIndex((x) => x.id === activeDirection), scenario)
    const id = sample.id
    if (!events.some((e) => e.id === id)) setEvents((current) => [sample, ...current.slice(0, 109)])
    setSelected(events.find((e) => e.id === id) ?? sample)
    setWorkflowStatus('RUNNING')
    setWorkflowMessage(`${activeDirection} is evaluating ${id} with policy gates.`)
    addAudit('workflow.started', `${activeDirection} · ${id}`, 'LIVE')
    if (activeDirection === 'Hinglish voice recovery') {
      const text = 'Namaste! Aapka payment complete nahi hua. Main ek secure payment link share kar sakta hoon. Kya aap abhi retry karna chahenge?'
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'hi-IN'
        u.rate = 0.94
        u.onstart = () => setVoicePlaying(true)
        u.onend = () => setVoicePlaying(false)
        window.speechSynthesis.speak(u)
      }
      setVoicePlaying(true)
      window.setTimeout(() => setVoicePlaying(false), 5200)
      applyWorkflow(id, 'COMPLETE', 'Consent-safe Hinglish script prepared. Browser voice demo only; no automatic call is placed.', 'Hinglish voice recovery')
      return
    }
    if (activeDirection === 'Promise-to-pay tracker') {
      applyWorkflow(
        id,
        ptpState === 'MISSED' ? 'ESCALATED' : 'COMPLETE',
        ptpState === 'MISSED' ? `Promise missed on ${ptpDate}; human escalation created.` : `Promise tracked through ${ptpDate}; reminder scheduled.`,
        ptpState === 'MISSED' ? 'Escalate missed promise' : 'Track promised date'
      )
      return
    }
    if (activeDirection === 'Payment degradation' || activeDirection === 'Checkout drop-off') {
      const action = activeDirection === 'Checkout drop-off' ? 'Payment link' : 'Retry payment'
      try {
        const r = await fetch('/api/razorpay/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, transactionId: id, amount: sample.amount }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'Razorpay Test Mode action failed')
        applyWorkflow(
          id,
          'COMPLETE',
          action === 'Payment link'
            ? `Test Mode payment link created: ${data.paymentLink || 'ready'}. Payment remains unverified until checkout success.`
            : `Test Mode retry order ${data.orderId || 'created'} is ready. Payment remains unverified until checkout success.`,
          action
        )
      } catch (err) {
        applyWorkflow(id, 'ESCALATED', err instanceof Error ? err.message : 'Test Mode action failed.', action)
      }
      return
    }
    window.setTimeout(() => {
      const escalated = activeDirection === 'B2B receivables chaser' && sample.riskScore >= 60
      const verified = activeDirection === 'Failed-subscription recovery' || activeDirection === 'Mandate retry sequencer'
      applyWorkflow(
        id,
        escalated ? 'ESCALATED' : 'COMPLETE',
        escalated ? 'Risk boundary crossed; human AR escalation created.' : `${activeDirection} completed in simulation with audit evidence attached.`,
        sample.action,
        verified ? sample.amount : 0
      )
    }, 650)
  }

  const startJudgeDemo = () => {
    setJudgeMode(true)
    setTab('Overview')
    setScenario('degradation')
    const next = makeEvents('degradation')
    setEvents(next)
    const live = events.find((e) => e.source === 'razorpay' && e.result === 'Pending')
    const target = live || next.find((e) => e.result === 'Stopped') || next[0]
    setSelected(target)
    setActiveDirection(target.direction)
    setWorkflowStatus('READY')
    setWorkflowMessage('Judge Mode: one transaction will travel through diagnosis → policy → recovery → verification → evidence.')
    addAudit('judge.demo.started', `${target.id} · ${money(target.amount)}`, 'LIVE')
    window.setTimeout(() => document.getElementById('recovery-operations')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
  }

  const navigateToTab = (newTab: string) => {
    setTab(newTab)
    const slugMap: Record<string, string> = {
      'Command Center': 'dashboard',
      Opportunities: 'opportunities',
      Transactions: 'transactions',
      Analytics: 'analytics/recovery',
      Policies: 'settings/policies',
      Audit: 'audit',
      Overview: '',
      Simulation: 'simulation',
      'Agent trace': 'agent-trace',
    }
    const slug = slugMap[newTab] ?? ''
    const basePath = typeof window !== 'undefined' && window.location.pathname.includes('/razorrecover-ai') ? '/razorrecover-ai/' : '/'
    const newUrl = slug ? `${basePath}${slug}` : basePath
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', newUrl)
    }
  }

  const navItems = [
    'Overview',
    'Command Center',
    'Opportunities',
    'Transactions',
    'Analytics',
    'Policies',
    'Audit',
    'Simulation',
    'Agent trace',
  ]

  return (
    <div className="app">
      <header className="nav">
        <div className="navMain">
          <div className="logo" onClick={() => navigateToTab('Overview')} style={{ cursor: 'pointer' }}>
            <span className="logoMark">R</span>
            <span>RazorRecover</span>
            <em>AI</em>
          </div>
          <div className="navTabs">
            {navItems.map((t) => (
              <button className={tab === t ? 'active' : ''} onClick={() => navigateToTab(t)} key={t}>
                {t}
              </button>
            ))}
            <button className={`judgeNav ${judgeMode ? 'active' : ''}`} onClick={startJudgeDemo}>
              ▶ Judge Demo
            </button>
          </div>
          <div className="live">
            <span />
            {judgeMode
              ? 'JUDGE MODE'
              : running
              ? `PROCESSING · ${Math.floor(progress)}%`
              : liveCount
              ? `LIVE · RZP ${liveCount} EVENT${liveCount > 1 ? 'S' : ''}`
              : complete
              ? 'LIVE · COMPLETE'
              : 'LIVE · SYNTHETIC MODE'}
          </div>
        </div>
        <div className="mobileNav">
          <div className="mobileNavTabs">
            {navItems.map((t) => (
              <button className={tab === t ? 'active' : ''} onClick={() => navigateToTab(t)} key={t}>
                {t}
              </button>
            ))}
            <button className={`judgeNav ${judgeMode ? 'active' : ''}`} onClick={startJudgeDemo}>
              ▶ Judge Demo
            </button>
          </div>
        </div>
      </header>

      {/* Render Sub-View if tab is not Overview */}
      {tab === 'Command Center' && <MerchantDashboard />}
      {tab === 'Opportunities' && <OpportunityQueue />}
      {tab === 'Transactions' && <TransactionExplorer />}
      {tab === 'Analytics' && <RecoveryAnalyticsView />}
      {tab === 'Policies' && <PolicySettingsView />}
      {tab === 'Audit' && <AuditComplianceCenter />}

      {/* Main Core View (Overview / Simulation / Agent trace) */}
      {(tab === 'Overview' || tab === 'Simulation' || tab === 'Agent trace') && (
        <main className="shell">
        <section className="hero">
          <div className="heroCopy">
            <div className="eyebrow">REVENUE RECOVERY / 01</div>
            <h1>
              Recover revenue.
              <br />
              <i>Intelligently.</i>
            </h1>
            <p>
              An autonomous recovery agent that detects leakage, diagnoses root causes, applies bounded interventions, and proves the money
              recovered.
            </p>
            {judgeMode && (
              <div className="judgeBanner">
                <b>JUDGE MODE</b>
                <span>Follow the highlighted transaction: diagnosis → policy → action → verification → evidence.</span>
              </div>
            )}
          </div>
          <div className="heroAction">
            <div className="health">
              <span /> Shared recovery ledger <b>·</b> {liveCount ? 'Razorpay connected' : '42ms'}
            </div>
            <button className="run" onClick={run} disabled={running}>
              <span>{running ? `Processing ${Math.floor(progress)}%` : complete ? 'Run again' : 'Run live simulation'}</span>
              <b>↗</b>
            </button>
          </div>
        </section>

        <section className="metrics">
          <Metric label="Revenue at risk" value={money(risk)} note={`${liveCount} Razorpay live · ${Math.max(0, events.length - liveCount)} synthetic`} />
          <Metric label="Money recovered" value={money(recovered)} note="Verified recovery only" good />
          <Metric label="Recovery rate" value={`${rate}%`} note="Verified recovered ÷ at-risk" gold />
          <Metric label="Actions gated" value={String(stopped).padStart(2, '0')} note="Stopped / escalated" danger />
        </section>

        <section className="panel lab">
          <div className="panelTop">
            <div>
              <span className="eyebrow">RECOVERY LAB</span>
              <h2>Choose a failure environment</h2>
            </div>
            <span className="pulse">● shared ledger</span>
          </div>
          <div className="scenarioBar">
            {(Object.keys(scenarios) as Scenario[]).map((s) => (
              <button className={`scenario ${scenario === s ? 'active' : ''}`} onClick={() => selectScenario(s)} key={s}>
                <strong>{s === 'balanced' ? '01' : s === 'checkout' ? '02' : '03'}</strong>
                {scenarios[s].label}
              </button>
            ))}
          </div>
          <div className="scenarioMeta">
            <div>
              <span>MODE</span>
              <b>{scenarios[scenario].label}</b>
            </div>
            <div>
              <span>POLICY</span>
              <b>Bounded</b>
            </div>
            <div>
              <span>DATA</span>
              <b>100 synthetic + live</b>
            </div>
            <div>
              <span>FUNDS</span>
              <b>Razorpay Test Mode</b>
            </div>
          </div>
          <div className="pulseChart">
            <span className="chartLabel">RECOVERY VELOCITY</span>
            <span className="chartValue">{velocityLabel} verified</span>
            <div className="spark">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline points={chart.map((v, i) => `${i * (100 / (chart.length - 1))},${100 - v}`).join(' ')} />
                <circle cx={100} cy={100 - chart[chart.length - 1]} r="2.3" />
              </svg>
            </div>
          </div>
        </section>

        <section className="coreGrid">
          <div className="panel corePanel">
            <div className="panelTop">
              <div>
                <span className="eyebrow">AGENT CORE</span>
                <h2>Revenue recovery engine</h2>
              </div>
              <span className="secure">● BOUNDED · SAFE</span>
            </div>
            <RecoveryIntelligenceGraph
              transaction={cfTarget === 'counterfactual' && cfTransaction ? cfTransaction : selected}
              progress={cfRunning ? cfProgress : progress}
              running={cfRunning || running}
              complete={cfRunning ? cfProgress >= 100 : complete}
            />
          </div>
          <div className="panel tracePanel">
            <div className="panelTop">
              <div>
                <span className="eyebrow">AI JUDGEMENT</span>
                <h2>{tab === 'Overview' ? 'Latest decisions' : tab}</h2>
              </div>
              <span className="pulse">
                ● {workflowStatus === 'RUNNING' ? 'workflow running' : selected?.source === 'razorpay' ? 'RZP event linked' : 'streaming'}
              </span>
            </div>
            {tab === 'Overview' && (
              <>
                <div className="traceList">
                  <Trace title="Root cause detected" text={`${selected?.direction || scenarios[scenario].label} · ${selected?.reason || 'diagnosis pending'}`} tag={selected ? `${selected.confidence}%` : '94%'} />
                  <Trace title="Policy gate evaluated" text={selected?.explanation || 'Idempotency ✓ · attempts 1/2 · low risk'} tag={selected?.policy === 'Approved' ? 'SAFE' : 'ESCALATE'} stop={selected?.policy === 'Escalated'} />
                  <Trace title="Recovery workflow" text={selected?.workflowMessage || selected?.action || 'Choose one of the seven directions below'} tag={selected?.workflowStatus || 'READY'} stop={selected?.workflowStatus === 'ESCALATED'} />
                  <Trace title="Safety boundary" text={selected?.riskScore ? `Risk ${selected.riskScore}/100 · no uncontrolled money movement` : 'Retry limit reached · human escalation'} tag={selected?.riskScore && selected.riskScore < 70 ? 'PASS' : 'STOP'} stop={!!selected?.riskScore && selected.riskScore >= 70} />
                </div>
                <div className="policy">
                  <span>SHARED RECOVERY LEDGER</span>
                  <b>Every Razorpay or synthetic event writes to the same evidence chain.</b>
                  <div>
                    <i>✓</i> Metrics&nbsp;&nbsp; <i>✓</i> Graph&nbsp;&nbsp; <i>✓</i> Event stream&nbsp;&nbsp; <i>✓</i> Audit trail&nbsp;&nbsp; <i>✓</i> AI advisor
                  </div>
                </div>
              </>
            )}
            {tab === 'Simulation' && <SimulationInfo progress={progress} running={running} scenario={scenarios[scenario].label} />}
            {tab === 'Agent trace' && <AgentTrace progress={progress} />}
          </div>
        </section>

        <section className="panel playbooks" id="recovery-playbooks">
          <div className="panelTop">
            <div>
              <span className="eyebrow">RECOVERY PLAYBOOKS / 07</span>
              <h2>Seven first-class recovery directions</h2>
            </div>
            <span className="pulse">● click → shared ledger</span>
          </div>
          <div className="playbookGrid">
            {directions.map((d, i) => (
              <button key={d.id} className={`playbookCard ${activeDirection === d.id ? 'active' : ''}`} onClick={() => selectPlaybook(d.id)}>
                <div className="playbookNumber">0{i + 1}</div>
                <div className="playbookCardTop">
                  <strong>{d.short}</strong>
                  <span className={`playbookDot ${d.tone}`}>●</span>
                </div>
                <p>{d.description}</p>
                <div className="playbookMeta">
                  <span>{d.id}</span>
                  <b>{d.action}</b>
                </div>
              </button>
            ))}
          </div>
          {activeDirection && (
            <div className="playbookConsole">
              <div className="playbookConsoleHead">
                <div>
                  <span className="eyebrow">ACTIVE WORKFLOW · SHARED LEDGER</span>
                  <h3>{directions.find((d) => d.id === activeDirection)?.short}</h3>
                </div>
                <button className="closePlaybook" onClick={() => setActiveDirection(null)}>
                  ×
                </button>
              </div>
              <div className="workflowSteps">
                {directions
                  .find((d) => d.id === activeDirection)!
                  .steps.map((step, i) => (
                    <div key={step} className={`workflowStep ${workflowStatus !== 'READY' && i <= (workflowStatus === 'RUNNING' ? 1 : 3) ? 'done' : ''}`}>
                      <span>0{i + 1}</span>
                      <b>{step}</b>
                    </div>
                  ))}
              </div>
              {activeDirection === 'Promise-to-pay tracker' && (
                <div className="ptpControls">
                  <label>
                    Promise date
                    <input type="date" value={ptpDate} onChange={(e) => setPtpDate(e.target.value)} />
                  </label>
                  <label>
                    Status
                    <select value={ptpState} onChange={(e) => setPtpState(e.target.value as typeof ptpState)}>
                      <option>PROMISED</option>
                      <option>PAID</option>
                      <option>MISSED</option>
                    </select>
                  </label>
                </div>
              )}
              {activeDirection === 'Hinglish voice recovery' && (
                <div className="voicePanel">
                  <span className="voiceWave">{voicePlaying ? '))) ))) )))' : '— — — —'}</span>
                  <p>“Namaste! Aapka payment complete nahi hua. Main ek secure payment link share kar sakta hoon. Kya aap abhi retry karna chahenge?”</p>
                  <small>Browser voice demo · consent-safe · no automatic call</small>
                </div>
              )}
              <div className="playbookActionRow">
                <div className={`workflowStatus ${workflowStatus.toLowerCase()}`}>
                  <span>●</span>
                  {workflowStatus}
                </div>
                <button className="run runPlaybook" onClick={runWorkflow} disabled={workflowStatus === 'RUNNING'}>
                  {directions.find((d) => d.id === activeDirection)!.action}
                  <b>↗</b>
                </button>
              </div>
              <div className="workflowMessage">{workflowMessage}</div>
            </div>
          )}
        </section>

        <section className="panel transactions" id="recovery-operations">
          <div className="panelTop">
            <div>
              <span className="eyebrow">EVENT STREAM / SHARED LEDGER</span>
              <h2>Recovery operations</h2>
            </div>
            <span>{liveCount ? `${liveCount} Razorpay live + ${events.length - liveCount} synthetic` : `${events.length} synthetic transactions`}</span>
          </div>
          <div className="table">
            {visible.map((e) => (
              <button className={`row ${selected?.id === e.id ? 'selected' : ''}`} key={e.id} onClick={() => setSelected(e)}>
                <strong>{e.id}</strong>
                <b>{money(e.amount)}</b>
                <span>
                  {formatEventTime(e.occurredAt)}
                  {e.source === 'razorpay' ? ' · RZP LIVE' : ''} · {e.reason}
                </span>
                <span className="action">→ {e.workflowAction || e.action}</span>
                <span className={`status ${e.result.toLowerCase()}`}>
                  {e.source === 'razorpay' && e.workflowStatus === 'READY'
                    ? 'AT RISK'
                    : e.workflowStatus && e.workflowStatus !== 'READY'
                    ? e.workflowStatus
                    : e.result}
                </span>
                <span className="confidence">{e.confidence}%</span>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <section className="detailStrip">
            <div>
              <span className="eyebrow">SELECTED EVENT</span>
              <strong>{selected.id}</strong>
              <small>{selected.source === 'razorpay' ? `${formatEventTime(selected.occurredAt)} · Razorpay Test Mode` : 'Synthetic transaction'}</small>
            </div>
            <div>
              <small>RECOVERY DIRECTION</small>
              <b>{selected.direction}</b>
            </div>
            <div>
              <small>ROOT CAUSE</small>
              <b>{selected.reason}</b>
            </div>
            <div>
              <small>AI CONFIDENCE</small>
              <b>{selected.confidence}%</b>
            </div>
            <div>
              <small>RECOVERY PROB.</small>
              <b>{selected.recoveryProbability}%</b>
            </div>
            <div>
              <small>RISK SCORE</small>
              <b>{selected.riskScore}/100</b>
            </div>
            <div>
              <small>WORKFLOW</small>
              <b className={selected.workflowStatus === 'COMPLETE' ? 'goodText' : selected.workflowStatus === 'ESCALATED' ? 'dangerText' : 'goldText'}>
                {selected.workflowStatus || selected.result}
              </b>
            </div>
          </section>
        )}

        <AgentTrace2 />

        {selected && <AIRecoveryAdvisor transaction={selected} />}
        {selected && <DecisionExecutionSequence key={`${selected.id}-${selected.amount}-${selected.workflowStatus}`} amount={selected.amount} />}
        {selected && <CounterfactualLab originalTransaction={selected} onActiveGraphTargetChange={handleCfSync} />}

        <footer>RAZORRECOVER AI · DETERMINISTIC BOUNDED AUTONOMY REVENUE RECOVERY PLATFORM · RAZORPAY TEST MODE</footer>
      </main>
      )}

      {toast && (
        <div className="toast">
          <b>✓</b>
          {toast}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, note, good, gold, danger }: { label: string; value: string; note: string; good?: boolean; gold?: boolean; danger?: boolean }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={good ? 'good' : gold ? 'gold' : danger ? 'danger' : ''}>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function Trace({ title, text, tag, stop }: { title: string; text: string; tag: string; stop?: boolean }) {
  return (
    <div className="trace">
      <span className={stop ? 'dot stop' : 'dot'} />
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <em className={stop ? 'tag stopTag' : 'tag'}>{tag}</em>
    </div>
  )
}

function SimulationInfo({ progress, running, scenario }: { progress: number; running: boolean; scenario: string }) {
  return (
    <div className="infoView">
      <div className="bigProgress">
        {Math.floor(progress)}
        <small>%</small>
      </div>
      <p>
        {running
          ? `Processing the ${scenario} environment through detection, diagnosis, decision, recovery and verification.`
          : 'Launch the simulation to watch synthetic transactions move through the complete recovery pipeline.'}
      </p>
      <div className="miniStats">
        <span>
          100 <small>synthetic</small>
        </span>
        <span>
          5 <small>AI stages</small>
        </span>
        <span>
          0 <small>real funds</small>
        </span>
      </div>
    </div>
  )
}

function AgentTrace({ progress }: { progress: number }) {
  const lines = [
    'Event ingested from payment stream',
    'AI diagnosis requested',
    'AI intervention recommendation received',
    'Policy gate evaluated',
    'Recovery action bounded and logged',
  ]
  return (
    <div className="traceList">
      {lines.map((line, i) => (
        <div className="trace" key={line}>
          <span className={progress > i * 20 ? 'dot' : 'dot muted'} />
          <div>
            <b>{line}</b>
            <small>{progress > i * 20 ? 'completed · evidence attached' : 'waiting for stage'}</small>
          </div>
          <em className="tag">{progress > i * 20 ? 'DONE' : 'WAIT'}</em>
        </div>
      ))}
    </div>
  )
}

function AuditTrail({ items }: { items: AuditItem[] }) {
  return (
    <div className="audit">
      {(items.length
        ? items
        : [
            {
              time: '—',
              event: 'audit.ready',
              detail: 'Run a batch or ingest a Razorpay event to create shared evidence.',
              status: 'INFO' as const,
            },
          ]
      ).map((x, i) => (
        <div key={`${x.time}-${i}`}>
          <b>{x.time}</b>
          <span>{x.event}</span>
          <em>{x.detail}</em>
        </div>
      ))}
    </div>
  )
}

export default RazorRecoverApp
