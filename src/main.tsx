import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type EventItem = { id: string; amount: number; reason: string; action: string; result: 'Recovered' | 'Stopped' | 'Pending'; confidence: number }

const seed: EventItem[] = [
  { id: 'TXN-1042', amount: 2499, reason: 'Bank timeout', action: 'Retry payment', result: 'Recovered', confidence: 94 },
  { id: 'TXN-1041', amount: 8999, reason: 'Checkout abandoned', action: 'Payment link', result: 'Recovered', confidence: 91 },
  { id: 'TXN-1040', amount: 4500, reason: 'Retry limit reached', action: 'Escalate', result: 'Stopped', confidence: 99 },
  { id: 'TXN-1039', amount: 1299, reason: 'Network degradation', action: 'Retry payment', result: 'Recovered', confidence: 93 },
  { id: 'TXN-1038', amount: 12499, reason: 'Authentication failed', action: 'Customer prompt', result: 'Pending', confidence: 86 },
]

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function App() {
  const [events, setEvents] = useState(seed)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setProgress(p => p >= 100 ? 100 : p + 2), 45)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (progress >= 100) setRunning(false)
  }, [progress])

  const recovered = useMemo(() => 86400 + Math.round(progress * 73), [progress])
  const risk = 240000
  const rate = Math.round((recovered / risk) * 100)

  const run = () => {
    setProgress(0); setRunning(true)
    setEvents(seed.map((e, i) => i === 4 ? { ...e, result: 'Recovered' } : e))
  }

  return <div className="app">
    <header className="nav">
      <div className="logo"><span className="logoMark">R</span> RazorRecover <em>AI</em></div>
      <div className="navTabs">{['Overview', 'Simulation', 'Agent trace', 'Audit trail'].map(t => <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>
      <div className="live"><span /> LIVE · DEMO MODE</div>
    </header>

    <main className="shell">
      <section className="hero">
        <div><div className="eyebrow">REVENUE RECOVERY / 01</div><h1>Recover revenue.<br/><i>Intelligently.</i></h1><p>An autonomous recovery agent that detects leakage, diagnoses root causes, applies bounded interventions, and proves the money recovered.</p></div>
        <button className="run" onClick={run} disabled={running}>{running ? `Processing ${progress}%` : 'Run live simulation'} <b>↗</b></button>
      </section>

      <section className="metrics">
        <Metric label="Revenue at risk" value={money(risk)} note="Across current batch" />
        <Metric label="Money recovered" value={money(recovered)} note="Verified recoveries" good />
        <Metric label="Recovery rate" value={`${rate}%`} note="Target: >30%" gold />
        <Metric label="Actions gated" value="08" note="Stopped / escalated" danger />
      </section>

      <section className="coreGrid">
        <div className="panel corePanel">
          <div className="panelTop"><div><span className="eyebrow">AGENT CORE</span><h2>Revenue recovery engine</h2></div><span className="secure">● BOUNDED</span></div>
          <div className="coreVisual">
            <div className="orb"><div className="orbInner">{running ? <strong>{progress}</strong> : <strong>AI</strong>}<small>{running ? 'PROCESSING' : 'READY'}</small></div></div>
            <div className="ring r1"/><div className="ring r2"/><div className="ring r3"/>
            <div className="node n1">DETECT</div><div className="node n2">DIAGNOSE</div><div className="node n3">DECIDE</div><div className="node n4">RECOVER</div>
          </div>
          <div className="pipeline">{['Detect','Diagnose','Decide','Recover','Verify'].map((x,i)=><div className={running && progress > i*20 ? 'step done' : 'step'} key={x}><span>{String(i+1).padStart(2,'0')}</span>{x}</div>)}</div>
        </div>
        <div className="panel tracePanel">
          <div className="panelTop"><div><span className="eyebrow">AI JUDGEMENT</span><h2>{tab === 'Overview' ? 'Latest decisions' : tab}</h2></div><span className="pulse">● streaming</span></div>
          <div className="traceList">
            <Trace title="Root cause detected" text="Transient bank failure · retry permitted" tag="94%" />
            <Trace title="Policy gate passed" text="Idempotency ✓ · attempts 1/2 · low risk" tag="SAFE" />
            <Trace title="Recovery executed" text="Retry payment · ₹2,499" tag="DONE" />
            <Trace title="Safety stop" text="Retry limit reached · human escalation" tag="STOP" stop />
          </div>
          <div className="policy"><span>POLICY ENGINE</span><b>Every money action is explainable, bounded & gated.</b><div><i>✓</i> No duplicate charge&nbsp;&nbsp; <i>✓</i> Max 2 retries&nbsp;&nbsp; <i>✓</i> Audit event</div></div>
        </div>
      </section>

      <section className="panel transactions">
        <div className="panelTop"><div><span className="eyebrow">EVENT STREAM</span><h2>Recovery operations</h2></div><span>{progress || 100} / 100 synthetic transactions</span></div>
        <div className="table">{events.map(e => <div className="row" key={e.id}><strong>{e.id}</strong><b>{money(e.amount)}</b><span>{e.reason}</span><span className="action">→ {e.action}</span><span className={`status ${e.result.toLowerCase()}`}>{e.result}</span><span className="confidence">{e.confidence}%</span></div>)}</div>
      </section>
      <footer>RAZORRECOVER AI · SYNTHETIC DATA · NO REAL CUSTOMER FUNDS · BUILDATHON PROTOTYPE</footer>
    </main>
  </div>
}

function Metric({label,value,note,good,gold,danger}:{label:string,value:string,note:string,good?:boolean,gold?:boolean,danger?:boolean}) { return <div className="metric"><span>{label}</span><strong className={good?'good':gold?'gold':danger?'danger':''}>{value}</strong><small>{note}</small></div> }
function Trace({title,text,tag,stop}:{title:string,text:string,tag:string,stop?:boolean}) { return <div className="trace"><span className={stop?'dot stop':'dot'} /><div><b>{title}</b><small>{text}</small></div><em className={stop?'tag stopTag':'tag'}>{tag}</em></div> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
