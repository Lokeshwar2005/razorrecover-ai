import type { VercelRequest, VercelResponse } from '@vercel/node'
import { computeAuthoritativeStats } from '../../lib/db.js'

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
    const stats = await computeAuthoritativeStats(req)
    res.status(200).json(stats)
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message })
  }
}
