import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  body?: unknown
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => this
}

const RAZORPAY_URL = 'https://api.razorpay.com/v1'

function authHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    res.status(500).json({ error: 'Razorpay Test Mode credentials are not configured on the server' })
    return
  }

  try {
    const upstream = await fetch(`${RAZORPAY_URL}/payments?count=100`, {
      headers: { Authorization: authHeader(keyId, keySecret) },
    })
    const data = await upstream.json()

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.description || 'Razorpay payment feed failed' })
      return
    }

    const payments = Array.isArray(data?.items) ? data.items : []
    res.status(200).json({
      provider: 'razorpay',
      mode: 'test',
      fetchedAt: new Date().toISOString(),
      count: payments.length,
      items: payments,
    })
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to reach Razorpay' })
  }
}
