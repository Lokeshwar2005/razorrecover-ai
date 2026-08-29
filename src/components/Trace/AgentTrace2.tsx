'use client'

import React, { useState, useEffect } from 'react'

export interface TraceStep {
  index: number
  name: string
  status: 'WAIT' | 'DONE' | 'STOP'
  detail: string
  decision?: string
}

export const AgentTrace2: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(6) // Default to step 6 (Verify completed)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  const steps: TraceStep[] = [
    {
      index: 0,
      name: '01 DETECT',
      status: 'DONE',
      detail: 'Raw payment signal captured: ₹45,000 failed under bank timeout signature.',
      decision: 'Signal Ingested',
    },
    {
      index: 1,
      name: '02 DIAGNOSE',
      status: 'DONE',
      detail: 'OpenRouter AI Diagnostic inference: Transient issuer degradation on HDFC payment gateway.',
      decision: '94% Confidence',
    },
    {
      index: 2,
      name: '03 SCORE',
      status: 'DONE',
      detail: 'Calculated recoverability probability: 84%, Base risk score: 22/100.',
      decision: 'Risk 22 (Low)',
    },
    {
      index: 3,
      name: '04 PRIORITIZE',
      status: 'DONE',
      detail: 'Expected recovery value calculated: ₹37,800. Placed in CRITICAL opportunity queue.',
      decision: 'CRITICAL Priority',
    },
    {
      index: 4,
      name: '05 POLICY',
      status: 'DONE',
      detail: 'Deterministic Policy Gate evaluated: Risk 22 < 70, Retries 1 <= 2, Prob 84% >= 55%.',
      decision: 'APPROVED',
    },
    {
      index: 5,
      name: '06 ACTION',
      status: 'DONE',
      detail: 'Bounded recovery playbook executed: Automated payment retry via Razorpay Order order_OXb128.',
      decision: 'Order Generated',
    },
    {
      index: 6,
      name: '07 VERIFY',
      status: 'DONE',
      detail: 'Payment Verification Bridge received Razorpay webhook: status === captured (pay_TVLdJPjhhrCBEs).',
      decision: 'VERIFIED RECOVERY',
    },
    {
      index: 7,
      name: '08 LEARN',
      status: 'DONE',
      detail: 'Verified recovery outcome ingested into empirical historical dataset. Success rate updated.',
      decision: 'Telemetry Updated',
    },
  ]

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= 7) {
            setIsPlaying(false)
            return 7
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying])

  const handleRestart = () => {
    setActiveStep(0)
    setIsPlaying(true)
  }

  const handleStep = () => {
    setActiveStep((prev) => (prev >= 7 ? 0 : prev + 1))
  }

  return (
    <div className="p-5 rounded-xl bg-[#0f0c08] border border-[#2e271c] space-y-4 max-w-7xl mx-auto my-6">
      {/* Header & Replay Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e271c] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎬</span>
            <h2 className="text-base font-bold text-[#f4ede2]">Agent Trace 2.0 & Decision Replay Theater</h2>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-[#e5a944]/10 text-[#e5a944] border border-[#e5a944]/30">
              8-Stage Deterministic Timeline
            </span>
          </div>
          <p className="text-xs text-[#a89f91] mt-1">
            Replay and audit end-to-end execution of AI diagnostic reasoning and deterministic policy gates.
          </p>
        </div>

        {/* Replay Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-[#e5a944] text-[#080705] hover:bg-[#fcd34d] transition"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Replay'}
          </button>
          <button
            onClick={handleStep}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-[#2e271c] bg-[#15120c] text-[#f4ede2] hover:border-[#e5a944] transition"
          >
            ⏭ Step
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-[#2e271c] bg-[#15120c] text-[#a89f91] hover:text-[#f4ede2] transition"
          >
            ↺ Restart
          </button>
        </div>
      </div>

      {/* 8-Stage Timeline Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((step) => {
          const isPassed = step.index <= activeStep
          const isCurrent = step.index === activeStep

          return (
            <div
              key={step.index}
              onClick={() => setActiveStep(step.index)}
              className={`p-3 rounded-lg border text-xs font-mono cursor-pointer transition flex flex-col justify-between min-h-[110px] ${
                isCurrent
                  ? 'bg-[#1c1710] border-[#e5a944] shadow-[0_0_12px_rgba(229,169,68,0.25)]'
                  : isPassed
                  ? 'bg-[#15120c] border-[#10b981]/40 text-[#f4ede2]'
                  : 'bg-[#080705] border-[#2e271c] opacity-50'
              }`}
            >
              <div>
                <div className="text-[10px] text-[#7a7164] flex items-center justify-between">
                  <span>STEP {step.index + 1}</span>
                  {isPassed && <span className="text-[#10b981]">✓</span>}
                </div>
                <div className="font-bold text-[#f4ede2] mt-1">{step.name}</div>
              </div>
              <div className="mt-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  isPassed ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30' : 'bg-[#2e271c] text-[#7a7164]'
                }`}>
                  {step.decision}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active Step Deep Dive Detail */}
      <div className="p-4 rounded-lg bg-[#15120c] border border-[#2e271c] space-y-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#e5a944] font-bold">
            STAGE {activeStep + 1}: {steps[activeStep].name}
          </span>
          <span className="text-[#10b981] font-bold">{steps[activeStep].decision}</span>
        </div>
        <p className="text-xs text-[#a89f91]">{steps[activeStep].detail}</p>
      </div>
    </div>
  )
}
