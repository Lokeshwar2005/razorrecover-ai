import type { VercelRequest, VercelResponse } from '@vercel/node'

const TEST_PAYMENTS = [
  { id: 'pay_TW1ipx1A26Ekei', amount: 8148800, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 240 },
  { id: 'pay_TW1fgs4BfaGGvQ', amount: 7929200, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 420 },
  { id: 'pay_TW1cr6VtryxK1k', amount: 4715500, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 600 },
  { id: 'pay_TW1VRv3Q8Sesuu', amount: 371300, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 1020 },
  { id: 'pay_TW1O9fLRpJWuHW', amount: 371300, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 1440 },
  { id: 'pay_TW1N2folo7Ua9u', amount: 371300, currency: 'INR', status: 'captured', method: 'wallet', created_at: Math.floor(Date.now() / 1000) - 1500 },
  { id: 'pay_TW0T5hxfyFpiFm', amount: 1000000, currency: 'INR', status: 'pending', method: 'card', created_at: Math.floor(Date.now() / 1000) - 2080 },
  { id: 'pay_TVWRbgbZZuldtX', amount: 76800, currency: 'INR', status: 'captured', method: 'card', created_at: Math.floor(Date.now() / 1000) - 2580 },
]

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  res.status(200).json({
    status: 'CONNECTED',
    count: TEST_PAYMENTS.length,
    events: TEST_PAYMENTS,
    items: TEST_PAYMENTS,
    timestamp: new Date().toISOString(),
  })
}
