import { useEffect, useState } from 'react'

type Props = {
  amount: number
  onComplete?: () => void
}

const stages = [
  ['DETECT', 'Signal captured', 'Payment failure entered the recovery stream.'],
  ['DIAGNOSE', 'Root cause classified', 'Network degradation identified as recoverable.'],
  ['DECIDE', 'Policy gate passed', 'Risk and retry boundaries evaluated.'],
  ['RECOVER', 'Bounded intervention', 'Approved recovery action executed.'],
  ['VERIFY', 'Outcome verified', 'Recovery counted only after verification.'],
] as const

export default function DecisionExecutionSequence({ amount, onComplete }: Props) {
  const [active, setActive] = useState(-1)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    setActive(-1)
    setComplete(false)
    const timers = stages.map((_, index) =>
      window.setTimeout(() => setActive(index), 450 + index * 850),
    )
    const done = window.setTimeout(() => {
      setComplete(true)
      onComplete?.()
    }, 450 + stages.length * 850)
    return () => {
      timers.forEach(window.clearTimeout)
      window.clearTimeout(done)
    }
  }, [amount, onComplete])

  return (
    <section className="execution-sequence" aria-label="Recovery execution sequence">
      <div className="execution-sequence__header">
        <div>
          <span className="eyebrow">LIVE EXECUTION</span>
          <h3>{complete ? 'Recovery verified.' : 'Agent executing decision.'}</h3>
        </div>
        <div className={`execution-sequence__amount ${complete ? 'is-complete' : ''}`}>
          {complete ? `₹${amount.toLocaleString('en-IN')} VERIFIED` : 'PROCESSING'}
        </div>
      </div>

      <div className="execution-sequence__rail">
        {stages.map(([label, title, detail], index) => {
          const isActive = index === active
          const isDone = index < active || complete
          return (
            <div className={`execution-stage ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`} key={label}>
              <div className="execution-stage__node">{isDone ? '✓' : String(index + 1).padStart(2, '0')}</div>
              <div className="execution-stage__copy">
                <span>{label}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="execution-sequence__footer">
        <span>Every money action → explainable · bounded · gated · audited</span>
        <span>{complete ? 'AUDIT EVENT APPENDED' : 'AWAITING VERIFICATION'}</span>
      </div>
    </section>
  )
}
