import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Result = 'Recovered' | 'Stopped' | 'Pending'
type EventItem = { id: string; amount: number; reason: string; action: string; result: Result; confidence: number; latency: string }

const seed: EventItem[] = [
  { id: 'TXN-1042', amount: 2499, reason: 'Bank timeout', action: 'Retry payment', result: 'Recovered', confidence: 94, latency: '420ms' },
  { id: 'TXN-1041', amount: 8999, reason: 'Checkout abandoned', action: 'Payment link', result: 'Recovered', confidence: 91, latency: '610ms' },
  { id: 'TXN-1040', amount: 4500, reason: 'Retry limit reached', action: 'Escalate', result: 'Stopped', confidence: 99, latency: '180ms' },
  { id: 'TXN-1039', amount: 1299, reason: 'Network degradation', action: 'Retry payment', result: 'Recovered', confidence: 93, latency: '380ms' },
  { id: 'TXN-1038', amount: 12499, reason: 'Authentication failed', action: 'Customer prompt', result: 'Pending', confidence: 86, latency: '520ms' },
  { id: 'TXN-1037', amount: 6750, reason: 'Subscription failure', action: 'Retry + link', result: 'Recovered', confidence: 89, latency: '470ms' },
]

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

function App() {
  const [events, setEvents] = useState(seed)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tab, setTab] = useState('Overview')
  const [selected, setSelected] = useState<EventItem | null>(seed[0])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setProgress(p => Math.min(100, p + 2)), 55)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (progress >= 100) setRunning(false)
  }, [progress])

  const recovered = useMemo(() => 86400 + Math.round(progress * 73), [progress])
  const risk = 240000
  const rate = Math.min(100, Math.round((recovered / risk) * 100))
  const stage = progress < 20 ? 'DETECT' : progress < 40 ? 'DIAGNOSE' : progress < 60 ? 'DECIDE' : progress < 80 ? 'RECOVER' : 'VERIFY'

  const run = () => {
    setProgress(0)
    setRunning(true)
    setSelected(null)
    setEvents(seed.map((e, i) => i === 4 ? { ...e, result: 'Pending' } : e))
  }

  return <div className="app">
    <header className="nav">
      <div className="logo"><span className="logoMark">R</span><span>RazorRecover</span><em>AI</em></div>
      <div className="navTabs">{['Overview', 'Simulation', 'Agent trace', 'Audit trail'].map(t => <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>
      <div className="live"><span /> LIVE · DEMO MODE</div>
    </header>

    <main className="shell">
      <section className="hero">
        <div className="heroCopy"><div className="eyebrow">REVENUE RECOVERY / 01</div><h1>Recover revenue.<br/><i>Intelligently.</i></h1><p>An autonomous recovery agent that detects leakage, diagnoses root causes, applies bounded interventions, and proves the money recovered.</p></div>
        <div className="heroAction"><div className="health"><span /> All systems nominal <b>·</b> 42ms</div><button className="run" onClick={run} disabled={running}><span>{running ? `Processing ${progress}%` : 'Run live simulation'}</span><b>↗</b></button></div>
      </section>

      <section className="metrics">
        <Metric label="Revenue at risk" value={money(risk)} note="Across current batch" />
        <Metric label="Money recovered" value={money(recovered)} note="Verified recoveries" good />
        <Metric label="Recovery rate" value={`${rate}%`} note="Target: >30%" gold />
        <Metric label="Actions gated" value="08" note="Stopped / escalated" danger />
      </section>

      <section className="coreGrid">
        <div className="panel corePanel">
          <div className="panelTop"><div><span className="eyebrow">AGENT CORE</span><h2>Revenue recovery engine</h2></div><span className="secure">● BOUNDED · SAFE</span></div>
          <div className="coreVisual" aria-label="3D recovery engine visualization">
            <div className={`orb ${running ? 'active' : ''}`}><div className="orbGlow" /><div className="orbInner"><strong>{running ? progress : 'AI'}</strong><small>{running ? stage : 'READY'}</small></div></div>
            <div className="ring r1"/><div className="ring r2"/><div className="ring r3"/>
            <div className="orbitDot od1"/><div className="orbitDot od2"/><div className="orbitDot od3"/>
            <div className="node n1"><span>01</span>DETECT</div><div className="node n2"><span>02</span>DIAGNOSE</div><div className="node n3"><span>03</span>DECIDE</div><div className="node n4"><span>04</span>RECOVER</div>
            <div className="coreGridLabel">AUTONOMOUS<br/><b>RECOVERY CORE</b></div>
          </div>
          <div className="pipeline">{['Detect','Diagnose','Decide','Recover','Verify'].map((x,i)=>{ const done = running ? progress >= (i + 1) * 20 : false; return <div className={done ? 'step done' : 'step'} key={x}><span>{String(i+1).padStart(2,'0')}</span>{x}</div> })}</div>
        </div>

        <div className="panel tracePanel">
          <div className="panelTop"><div><span className="eyebrow">AI JUDGEMENT</span><h2>{tab === 'Overview' ? 'Latest decisions' : tab}</h2></div><span className="pulse">● streaming</span></div>
          {tab === 'Overview' && <>
            <div className="traceList">
              <Trace title="Root cause detected" text="Transient bank failure · retry permitted" tag="94%" />
              <Trace title="Policy gate passed" text="Idempotency ✓ · attempts 1/2 · low risk" tag="SAFE" />
              <Trace title="Recovery executed" text="Retry payment · ₹2,499" tag="DONE" />
              <Trace title="Safety stop" text="Retry limit reached · human escalation" tag="STOP" stop />
            </div>
            <div className="policy"><span>POLICY ENGINE</span><b>Every money action is explainable, bounded & gated.</b><div><i>✓</i> No duplicate charge&nbsp;&nbsp; <i>✓</i> Max 2 retries&nbsp;&nbsp; <i>✓</i> Audit event</div></div>
          </>}
          {tab === 'Simulation' && <SimulationInfo progress={progress} running={running} />}
          {tab === 'Agent trace' && <AgentTrace progress={progress} />}
          {tab === 'Audit trail' && <AuditTrail />}
        </div>
      </section>

      <section className="panel transactions">
        <div className="panelTop"><div><span className="eyebrow">EVENT STREAM</span><h2>Recovery operations</h2></div><span>{progress || 100} / 100 synthetic transactions</span></div>
        <div className="table">{events.map(e => <button className={`row ${selected?.id === e.id ? 'selected' : ''}`} key={e.id} onClick={() => setSelected(e)}><strong>{e.id}</strong><b>{money(e.amount)}</b><span>{e.reason}</span><span className="action">→ {e.action}</span><span className={`status ${e.result.toLowerCase()}`}>{e.result}</span><span className="confidence">{e.confidence}%</span></button>)}</div>
      </section>

      {selected && <section className="detailStrip"><div><span className="eyebrow">SELECTED EVENT</span><strong>{selected.id}</strong></div><div><small>ROOT CAUSE</small><b>{selected.reason}</b></div><div><small>AI CONFIDENCE</small><b>{selected.confidence}%</b></div><div><small>LATENCY</small><b>{selected.latency}</b></div><div><small>POLICY RESULT</small><b className={selected.result === 'Recovered' ? 'goodText' : selected.result === 'Stopped' ? 'dangerText' : 'goldText'}>{selected.result}</b></div></section>}
      <footer>RAZORRECOVER AI · SYNTHETIC DATA · NO REAL CUSTOMER FUNDS · BUILDATHON PROTOTYPE</footer>
    </main>
  </div>
}

function Metric({label,value,note,good,gold,danger}:{label:string,value:string,note:string,good?:boolean,gold?:boolean,danger?:boolean}) { return <div className="metric"><span>{label}</span><strong className={good?'good':gold?'gold':danger?'danger':''}>{value}</strong><small>{note}</small></div> }
function Trace({title,text,tag,stop}:{title:string,text:string,tag:string,stop?:boolean}) { return <div className="trace"><span className={stop?'dot stop':'dot'} /><div><b>{title}</b><small>{text}</small></div><em className={stop?'tag stopTag':'tag'}>{tag}</em></div> }
function SimulationInfo({progress,running}:{progress:number,running:boolean}) { return <div className="infoView"><div className="bigProgress">{progress}<small>%</small></div><p>{running ? 'Processing synthetic transactions through the complete recovery pipeline.' : 'Launch the simulation to watch 100 synthetic transactions move through detection, diagnosis, decision, recovery and verification.'}</p><div className="miniStats"><span>100 <small>transactions</small></span><span>5 <small>AI stages</small></span><span>0 <small>real funds</small></span></div></div> }
function AgentTrace({progress}:{progress:number}) { const lines = ['Event ingested from payment stream','Failure classified as transient','Customer intent + risk scored','Policy gate evaluated','Recovery action bounded and logged']; return <div className="traceList">{lines.map((line,i)=><div className="trace" key={line}><span className={progress > i*20 ? 'dot' : 'dot muted'} /><div><b>{line}</b><small>{progress > i*20 ? 'completed · deterministic evidence attached' : 'waiting for simulation stage'}</small></div><em className="tag">{progress > i*20 ? 'DONE' : 'WAIT'}</em></div>)}</div> }
function AuditTrail() { return <div className="audit"><div><b>09:41:02.481</b><span>TXN-1042 · diagnosis.created</span><em>hash: 9f2a…e81c</em></div><div><b>09:41:02.901</b><span>TXN-1042 · policy.approved</span><em>rule: retry_limit_2</em></div><div><b>09:41:03.212</b><span>TXN-1042 · recovery.verified</span><em>amount: ₹2,499</em></div><div><b>09:41:05.004</b><span>TXN-1040 · recovery.stopped</span><em>reason: max_attempts</em></div></div> }

createRoot(document.getElementById('root')!).render(<App />)
