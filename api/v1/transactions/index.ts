import type { IncomingMessage, ServerResponse } from 'http'
import { loadStore } from '../store.js'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const store = loadStore()
    let list = Array.from(store.values())

    const query = req.query || {}
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status.toUpperCase() : ''
    const source = typeof query.source === 'string' ? query.source.toLowerCase() : ''
    const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 200
    const offset = typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0

    if (source && source !== 'all') {
      list = list.filter((t) => t.source === source)
    }

    if (status && status !== 'ALL') {
      list = list.filter((t) => t.status === status)
    }

    if (search) {
      list = list.filter((t) => {
        const id = t.id.toLowerCase()
        const pid = (t.provider_payment_id || '').toLowerCase()
        const oid = (t.provider_order_id || '').toLowerCase()
        const reason = t.reason.toLowerCase()
        const action = t.action.toLowerCase()
        return id.includes(search) || pid.includes(search) || oid.includes(search) || reason.includes(search) || action.includes(search)
      })
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const paginated = list.slice(offset, offset + limit)
    res.status(200).json(paginated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch transactions' })
  }
}
