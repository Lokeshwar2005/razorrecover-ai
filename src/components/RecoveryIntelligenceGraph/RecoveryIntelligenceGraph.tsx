import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GraphNodeId, GraphTransactionContext } from '../../types/graph'
import { GRAPH_NODES, RecoveryGraphScene } from './graphScene'
import './graph.css'

export interface RecoveryIntelligenceGraphProps {
  transaction: GraphTransactionContext | null
  progress: number
  running: boolean
  complete: boolean
}

export const RecoveryIntelligenceGraph: React.FC<RecoveryIntelligenceGraphProps> = ({
  transaction,
  progress,
  running,
  complete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<RecoveryGraphScene | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<GraphNodeId>('policy')

  // Calculate active pipeline stage index (0 to 6) based on simulation progress
  const activeStageIndex = useMemo(() => {
    if (complete) return 6
    if (!running) return -1
    // Map progress 0-100 across 7 stages
    const stage = Math.min(6, Math.floor((progress / 100) * 7))
    return stage
  }, [progress, running, complete])

  // Automatically track selected node to currently active stage during simulation
  useEffect(() => {
    if (running && activeStageIndex >= 0 && activeStageIndex < GRAPH_NODES.length) {
      setSelectedNodeId(GRAPH_NODES[activeStageIndex].id)
    }
  }, [running, activeStageIndex])

  // Mount and manage Three.js Scene
  useEffect(() => {
    if (!canvasRef.current) return

    const scene = new RecoveryGraphScene({
      canvas: canvasRef.current,
      onNodeClick: (nodeId) => {
        setSelectedNodeId(nodeId)
      },
    })
    sceneRef.current = scene

    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Sync React simulation props to Three.js graph scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateSimulationState(
        transaction,
        activeStageIndex,
        running,
        complete
      )
    }
  }, [transaction, activeStageIndex, running, complete])

  // Determine Overall Status Pill
  const statusBadge = useMemo(() => {
    if (running) {
      const stageName = activeStageIndex >= 0 ? GRAPH_NODES[activeStageIndex].title.toUpperCase() : 'DETECT'
      return {
        label: `AGENT EXECUTING · ${stageName}`,
        className: 'processing',
      }
    }
    if (transaction?.policy === 'Escalated' || transaction?.result === 'Stopped') {
      return {
        label: 'POLICY GATE · STOPPED',
        className: 'stopped',
      }
    }
    if (complete || transaction?.result === 'Recovered') {
      return {
        label: 'RECOVERY VERIFIED',
        className: 'verified',
      }
    }
    return {
      label: 'RECOVERY GRAPH · LIVE',
      className: '',
    }
  }, [running, activeStageIndex, complete, transaction])

  // Selected Node Details for Inspector
  const selectedNodeInfo = useMemo(() => {
    const nodeDef = GRAPH_NODES.find((n) => n.id === selectedNodeId) || GRAPH_NODES[0]
    const idx = nodeDef.stageNumber

    let statusText = 'Idle'
    let metricLabel = 'Stage Index'
    let metricValue = `${idx + 1} of 7`
    let description = nodeDef.subtitle

    const isEscalated = transaction?.policy === 'Escalated' || transaction?.result === 'Stopped'
    const risk = transaction?.riskScore ?? 35

    if (running) {
      if (idx === activeStageIndex) statusText = 'Processing'
      else if (idx < activeStageIndex) statusText = 'Passed'
      else statusText = 'Pending'
    } else if (complete || transaction) {
      if (isEscalated && idx >= 4) {
        statusText = idx === 4 ? 'Policy Gate Blocked' : 'Halted (Safe)'
      } else {
        statusText = idx === 6 ? 'Verified Outcome' : 'Approved / Passed'
      }
    }

    switch (nodeDef.id) {
      case 'txn':
        metricLabel = 'Amount at risk'
        metricValue = transaction ? `₹${transaction.amount.toLocaleString('en-IN')}` : '₹2,499'
        description = transaction ? `Captured failure ${transaction.id} · Latency ${transaction.latency || '210ms'}` : 'Signal captured from webhook stream'
        break
      case 'detect':
        metricLabel = 'Signal Ingest'
        metricValue = '100% Ingested'
        description = 'Payment failure classified from gateway event payload'
        break
      case 'diagnose':
        metricLabel = 'AI Confidence'
        metricValue = transaction ? `${transaction.confidence}%` : '94%'
        description = transaction ? `Root cause: ${transaction.reason}` : 'Root cause pattern identified'
        break
      case 'risk':
        metricLabel = 'Risk Score'
        metricValue = `${risk}/100`
        description = risk >= 70 ? 'High fraud or velocity friction detected' : 'Low friction · safe for bounded intervention'
        break
      case 'policy':
        metricLabel = 'Policy Gate'
        metricValue = isEscalated ? 'Escalated / Stop' : 'Approved'
        description = isEscalated
          ? 'Safety boundary triggered · Money movement prevented'
          : 'Idempotency verified · Retry within bounded limit'
        break
      case 'action':
        metricLabel = 'Intervention'
        metricValue = isEscalated ? 'Escalate' : transaction?.action || 'Retry payment'
        description = isEscalated
          ? 'Intervention halted at policy boundary'
          : `Executing bounded recovery action: ${transaction?.action || 'Retry payment'}`
        break
      case 'verify':
        metricLabel = 'Recovery Result'
        metricValue = isEscalated ? 'Stopped (Funds Intact)' : 'Recovered'
        description = isEscalated
          ? 'Zero duplicate charges · Audit record stored'
          : 'Recovery confirmed with issuer ledger'
        break
    }

    return {
      nodeDef,
      statusText,
      metricLabel,
      metricValue,
      description,
    }
  }, [selectedNodeId, transaction, running, activeStageIndex, complete])

  const handleResetCamera = () => {
    sceneRef.current?.resetCamera()
  }

  return (
    <section className="recoveryGraph" aria-label="3D Recovery Intelligence Graph">
      {/* 3D Canvas Viewport */}
      <div className="recoveryGraph__canvasContainer">
        <canvas ref={canvasRef} className="recoveryGraph__canvas" />

        {/* Top HUD */}
        <div className="recoveryGraph__hudTop">
          <div className={`recoveryGraph__badge ${statusBadge.className}`} role="status" aria-live="polite">
            <span className="recoveryGraph__badgeDot" />
            <span>{statusBadge.label}</span>
          </div>

          <div className="recoveryGraph__controls">
            <button
              className="recoveryGraph__resetBtn"
              onClick={handleResetCamera}
              title="Reset 3D camera to default perspective"
              type="button"
            >
              Reset 3D View ↺
            </button>
          </div>
        </div>

        {/* Compact Bottom Legend */}
        <div className="recoveryGraph__legend" aria-hidden="true">
          <div className="recoveryGraph__legendItem">
            <span className="legendDot active" /> Active
          </div>
          <div className="recoveryGraph__legendItem">
            <span className="legendDot processing" /> Processing
          </div>
          <div className="recoveryGraph__legendItem">
            <span className="legendDot passed" /> Passed
          </div>
          <div className="recoveryGraph__legendItem">
            <span className="legendDot blocked" /> Blocked
          </div>
          <div className="recoveryGraph__legendItem">
            <span className="legendDot verified" /> Verified
          </div>
        </div>

        {/* Core Architecture Watermark */}
        <div className="recoveryGraph__coreTag" aria-hidden="true">
          <span>AUTONOMOUS REASONING</span>
          <strong>INTELLIGENCE GRAPH</strong>
        </div>
      </div>

      {/* 7-Step Pipeline Interactive Rail */}
      <div className="recoveryGraph__pipeline" role="tablist" aria-label="Pipeline stages">
        {GRAPH_NODES.map((node, i) => {
          const isSelected = node.id === selectedNodeId
          const isPassed = running ? i < activeStageIndex : (complete || !!transaction) && (transaction?.policy !== 'Escalated' || i < 4)
          const isProcessing = running && i === activeStageIndex
          const isBlocked = (complete || !!transaction) && (transaction?.policy === 'Escalated' || transaction?.result === 'Stopped') && i === 4
          const isVerified = (complete || transaction?.result === 'Recovered') && i === 6

          let stateClass = ''
          let statusText = 'Idle'
          if (isProcessing) {
            stateClass = 'is-processing'
            statusText = 'Processing'
          } else if (isBlocked) {
            stateClass = 'is-blocked'
            statusText = 'Blocked'
          } else if (isVerified) {
            stateClass = 'is-verified'
            statusText = 'Verified'
          } else if (isPassed) {
            stateClass = 'is-passed'
            statusText = 'Passed'
          }

          return (
            <button
              key={node.id}
              role="tab"
              aria-selected={isSelected}
              aria-label={`${node.key} ${node.title}: ${statusText}`}
              className={`recoveryGraph__stepBtn ${isSelected ? 'is-selected' : ''} ${stateClass}`}
              onClick={() => setSelectedNodeId(node.id)}
              type="button"
            >
              <span className="recoveryGraph__stepNum">{node.key}</span>
              <span className="recoveryGraph__stepTitle">{node.title}</span>
              <span className="recoveryGraph__stepStatus">{statusText}</span>
            </button>
          )
        })}
      </div>

      {/* Dynamic Node Detail Inspector */}
      <div className="recoveryGraph__inspector" aria-live="polite">
        <div className="recoveryGraph__inspectorLeft">
          <span className="recoveryGraph__inspectorKey">{selectedNodeInfo.nodeDef.key}</span>
          <div>
            <div className="recoveryGraph__inspectorTitle">{selectedNodeInfo.nodeDef.title}</div>
            <div className="recoveryGraph__inspectorDesc">{selectedNodeInfo.description}</div>
          </div>
        </div>
        <div className="recoveryGraph__inspectorRight">
          <div className="recoveryGraph__metricPill">
            <span>STATE</span>
            <strong style={{ color: selectedNodeInfo.statusText.includes('Blocked') ? '#ef4444' : selectedNodeInfo.statusText.includes('Verified') ? '#34d399' : '#e4a641' }}>
              {selectedNodeInfo.statusText}
            </strong>
          </div>
          <div className="recoveryGraph__metricPill">
            <span>{selectedNodeInfo.metricLabel}</span>
            <strong>{selectedNodeInfo.metricValue}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RecoveryIntelligenceGraph
