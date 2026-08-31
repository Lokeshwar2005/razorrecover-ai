import fs from 'fs'
import path from 'path'

export interface ServerlessTransaction {
  id: string
  merchant_id: string
  amount: number
  amount_minor: number
  currency: string
  source: 'synthetic' | 'razorpay_test' | 'live'
  status: 'PENDING' | 'RECOVERED' | 'STOPPED' | 'ESCALATED' | 'IN_PROGRESS'
  direction: string
  reason: string
  action: string
  confidence: number
  recovery_probability: number
  risk_score: number
  policy: 'Approved' | 'Blocked' | 'Escalated'
  explanation: string
  latency: string
  created_at: string
  updated_at?: string
  provider?: string
  provider_id?: string
  provider_payment_id?: string
  provider_order_id?: string
  provider_payment_link_id?: string
  provider_status?: string
  verified_amount_minor?: number
  captured_at?: string
  workflow_status?: string
  workflow_message?: string
  recovery_operation_id?: string
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  metadata?: Record<string, any>
}

const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_db_v2.json')
let inMemoryStore: Map<string, ServerlessTransaction> = new Map()

export const FAILURE_SCENARIO_MAP: Record<
  string,
  {
    code: string
    reason: string
    action: string
    confidence: number
    recoveryProb: number
    riskScore: number
    policy: 'Approved' | 'Blocked' | 'Escalated'
    explanation: string
  }
> = {
  '3ds_timeout': {
    code: 'GATEWAY_ERROR_3DS_TIMEOUT',
    reason: '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)',
    action: 'Send payment link',
    confidence: 95,
    recoveryProb: 88,
    riskScore: 20,
    policy: 'Approved',
    explanation: '3DS challenge expired due to issuer bank latency. Direct customer retry link dispatched.',
  },
  'low_balance': {
    code: 'BAD_REQUEST_INSUFFICIENT_FUNDS',
    reason: 'Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)',
    action: 'Switch to UPI Auto-Pay / Split Link',
    confidence: 92,
    recoveryProb: 78,
    riskScore: 35,
    policy: 'Approved',
    explanation: 'Soft decline from issuer bank. Alternate low-friction payment channel dispatched.',
  },
  'upi_intent_drop': {
    code: 'UPI_INTENT_TIMEOUT',
    reason: 'UPI Intent Session Expired (Customer Backgrounded App to Check SMS)',
    action: 'Send instant WhatsApp UPI deep link',
    confidence: 97,
    recoveryProb: 94,
    riskScore: 12,
    policy: 'Approved',
    explanation: 'UPI app switch timeout detected. High-intent 1-click WhatsApp deep link activated.',
  },
  'bank_downtime': {
    code: 'ISSUER_CBS_DOWN_502',
    reason: 'Issuer Core Banking System (CBS) Scheduled Maintenance / Outage',
    action: 'Smart Routing to Alternate Bank Node',
    confidence: 99,
    recoveryProb: 91,
    riskScore: 10,
    policy: 'Approved',
    explanation: 'Issuer node 502 detected. Re-routed authorization through redundant bank gateway.',
  },
  'risk_engine_flag': {
    code: 'FRAUD_VELOCITY_SOFT_BLOCK',
    reason: 'Issuer Velocity Heuristic Triggered (False Positive Soft Decline)',
    action: 'Dispatch Biometric Verified Secure Link',
    confidence: 89,
    recoveryProb: 82,
    riskScore: 40,
    policy: 'Approved',
    explanation: 'False positive velocity flag. Cryptographic biometric challenge dispatched.',
  },
  'network_drop': {
    code: 'CLIENT_TCP_CONNECTION_RESET',
    reason: 'Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)',
    action: 'Send 1-Click SMS Recovery Link',
    confidence: 96,
    recoveryProb: 92,
    riskScore: 15,
    policy: 'Approved',
    explanation: 'Customer network handshake dropped. Direct tokenized SMS retry link generated.',
  },
  'auth_retries_exceeded': {
    code: 'AUTH_RETRIES_EXCEEDED_3DS',
    reason: 'Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded',
    action: 'Send UPI QR Alternative Link',
    confidence: 91,
    recoveryProb: 84,
    riskScore: 28,
    policy: 'Approved',
    explanation: 'Card OTP limit reached. Alternate dynamic UPI QR payment link provisioned.',
  },
  'cart_abandonment': {
    code: 'GATEWAY_DISMISSED_BY_USER',
    reason: 'Customer Dismissed Razorpay Checkout Window Before Submitting Credentials',
    action: 'Send Cart Recovery WhatsApp with 5% Perk',
    confidence: 94,
    recoveryProb: 89,
    riskScore: 18,
    policy: 'Approved',
    explanation: 'High-intent cart abandonment detected. Automated promotional recovery link dispatched.',
  },
}

export function loadStore(): Map<string, ServerlessTransaction> {
  if (inMemoryStore.size > 0) return inMemoryStore
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf-8')
      const items: ServerlessTransaction[] = JSON.parse(raw)
      if (Array.isArray(items)) {
        inMemoryStore = new Map(items.map((i) => [i.id, i]))
        return inMemoryStore
      }
    }
  } catch (e) {}
  return inMemoryStore
}

export function saveStore() {
  try {
    const list = Array.from(inMemoryStore.values())
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {}
}

export function getTransaction(id: string): ServerlessTransaction | undefined {
  const store = loadStore()
  const cleanId = id.trim().toUpperCase()
  return (
    store.get(cleanId) ||
    store.get(id) ||
    Array.from(store.values()).find(
      (t) =>
        t.id.toUpperCase() === cleanId ||
        (t.provider_payment_id && t.provider_payment_id.toUpperCase() === cleanId) ||
        (t.provider_order_id && t.provider_order_id.toUpperCase() === cleanId)
    )
  )
}

export function upsertTransaction(txn: ServerlessTransaction): ServerlessTransaction {
  const store = loadStore()
  const existing = store.get(txn.id)
  const merged: ServerlessTransaction = {
    ...existing,
    ...txn,
    updated_at: new Date().toISOString(),
  }
  store.set(txn.id, merged)
  saveStore()
  return merged
}
