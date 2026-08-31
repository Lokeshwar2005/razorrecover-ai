import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAllChronovaTransactions } from '../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-github-token')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const txns = await getAllChronovaTransactions(req)
    
    // Map strictly from real Chronova transactions to Razorpay provider events
    const events = txns.map((t) => {
      const isRec = t.status === 'RECOVERED' || t.verified_amount_minor > 0
      return {
        id: t.razorpay_payment_id || t.provider_payment_id || `pay_${t.id.toLowerCase()}`,
        order_id: t.razorpay_order_id || t.chronova_order_id,
        amount: t.amount_minor,
        currency: t.currency || 'INR',
        status: isRec ? 'captured' : 'failed',
        method: t.metadata?.method || 'card',
        created_at: Math.floor(new Date(t.created_at || Date.now()).getTime() / 1000),
        notes: {
          chronova_order_id: t.chronova_order_id,
          brand: 'Chronova',
        },
        error_description: isRec ? null : t.reason,
      }
    })

    res.status(200).json({
      provider: 'razorpay',
      status: 'CONNECTED',
      source: 'CHRONOVA',
      count: events.length,
      events: events,
      items: events,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message,
    })
  }
}
