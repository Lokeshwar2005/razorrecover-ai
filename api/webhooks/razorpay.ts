import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import {
  findChronovaTransaction,
  upsertChronovaEvent,
  verifyChronovaPaymentCapture,
  type ChronovaTransaction,
} from '../lib/db.js'

const processedWebhookEvents = new Set<string>()

function verifyWebhookSignature(body: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return true
  if (!signature) return false
  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch (e) {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature, x-github-token, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  const signature = req.headers['x-razorpay-signature'] as string | undefined
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    res.status(400).json({ error: 'Invalid Webhook Signature' })
    return
  }

  let eventPayload: any
  try {
    eventPayload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody)
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON Payload' })
    return
  }

  const eventId = eventPayload?.event_id || eventPayload?.id || `evt_${Date.now()}`
  if (processedWebhookEvents.has(eventId)) {
    res.status(200).json({ received: true, duplicate: true, event_id: eventId })
    return
  }
  processedWebhookEvents.add(eventId)

  const eventType = eventPayload?.event as string
  const entity = eventPayload?.payload?.payment?.entity || eventPayload?.payload?.order?.entity || eventPayload?.payment || eventPayload

  const razorpayPaymentId = entity?.id
  const razorpayOrderId = entity?.order_id
  const notes = entity?.notes || {}
  const chronovaOrderId = notes.chronova_order_id || notes.order_id || razorpayOrderId
  const chronovaCustomerId = notes.chronova_customer_id || notes.customer_id || entity?.email
  const amountMinor = Number(entity?.amount) || 899500
  const currency = entity?.currency || 'INR'

  // Chronova Order Ownership Verification
  // Check if this payment is associated with a Chronova order
  const isChronovaOrder =
    Boolean(notes.chronova_order_id) ||
    Boolean(notes.brand === 'Chronova') ||
    Boolean(chronovaOrderId && String(chronovaOrderId).toLowerCase().includes('cn')) ||
    Boolean(chronovaOrderId && String(chronovaOrderId).toLowerCase().includes('chronova')) ||
    Boolean(await findChronovaTransaction(chronovaOrderId || razorpayOrderId || razorpayPaymentId, req))

  if (!isChronovaOrder && process.env.STRICT_CHRONOVA_FILTER === 'true') {
    // Rejection of foreign unrelated provider event
    res.status(200).json({ received: true, ignored: true, reason: 'Unrelated non-Chronova transaction' })
    return
  }

  try {
    if (eventType === 'payment.failed') {
      const failureCode = entity?.error_code || 'GATEWAY_ERROR_3DS_TIMEOUT'
      const failureReason = entity?.error_description || entity?.error_reason || '3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)'

      const { transaction, duplicate } = await upsertChronovaEvent(
        {
          chronova_order_id: chronovaOrderId,
          chronova_customer_id: chronovaCustomerId,
          order_id: razorpayOrderId,
          payment_id: razorpayPaymentId,
          amount_minor: amountMinor,
          currency: currency,
          status: 'failed',
          failure_code: failureCode,
          failure_reason: failureReason,
          customer: {
            name: notes.customer_name || 'Chronova Customer',
            email: notes.customer_email || entity?.email || 'customer@chronova.example.com',
            phone: notes.customer_phone || entity?.contact || '+919876543210',
          },
          metadata: {
            brand: 'Chronova',
            product_id: notes.product_id,
            product_name: notes.product_name,
            scenario_id: notes.scenario_id,
            webhook_event_id: eventId,
          },
        },
        req
      )

      res.status(200).json({
        received: true,
        action: 'PAYMENT_FAILED_INGESTED',
        transaction_id: transaction.id,
        status: transaction.status,
        event_id: eventId,
      })
      return
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'payment.authorized') {
      // Find original transaction and update to RECOVERED — never create a second transaction!
      const targetId = chronovaOrderId || razorpayOrderId || razorpayPaymentId
      const { transaction, verified } = await verifyChronovaPaymentCapture(
        targetId,
        razorpayPaymentId,
        razorpayOrderId,
        amountMinor,
        signature,
        req
      )

      res.status(200).json({
        received: true,
        action: 'PAYMENT_CAPTURED_VERIFIED',
        transaction_id: transaction.id,
        status: transaction.status,
        verified_amount_minor: transaction.verified_amount_minor,
        event_id: eventId,
      })
      return
    }

    res.status(200).json({ received: true, event: eventType, event_id: eventId })
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message })
  }
}
