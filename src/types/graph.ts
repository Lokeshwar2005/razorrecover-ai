export type GraphNodeId = 'txn' | 'detect' | 'diagnose' | 'risk' | 'policy' | 'action' | 'verify'

export type NodeVisualStatus = 'idle' | 'active' | 'processing' | 'passed' | 'blocked' | 'verified'

export interface GraphNodeDefinition {
  id: GraphNodeId
  stageNumber: number
  key: string
  title: string
  subtitle: string
  position: [number, number, number] // 3D coordinates around the core
  baseColor: number
  activeColor: number
}

export interface GraphTransactionContext {
  id: string
  amount: number
  reason: string
  action: string
  result: 'Recovered' | 'Stopped' | 'Pending'
  confidence: number
  recoveryProbability: number
  riskScore: number
  policy: 'Approved' | 'Escalated'
  explanation: string
  latency?: string
}

export interface NodeStateData {
  id: GraphNodeId
  title: string
  subtitle: string
  status: NodeVisualStatus
  badgeText: string
  metricLabel?: string
  metricValue?: string
  detail?: string
}

export type PipelineStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0: Txn, 1: Detect, 2: Diagnose, 3: Risk, 4: Policy, 5: Action, 6: Verify
