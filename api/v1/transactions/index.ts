import type { IncomingMessage, ServerResponse } from 'http'
import { fetchGistTransactions } from '../../_lib/gistStore'

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
    let list = Object.values(await fetchGistTransactions())

    const query = req.query || {}
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status.toUpperCase() : ''
    const source = typeof query.source === 'string' ? query.source.toLowerCase() : ''
    const parsedLimit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 200
    const parsedOffset = typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0
    const limit = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? Math.min(parsedLimit, 500) : 200
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0

    if (source && source !== 'all') {
      list = list.filter((t: any) => (t?.source || '').toLowerCase() === source)
    }

    if (status && status !== 'ALL') {
      list = list.filter((t: any) => (t?.status || '').toUpperCase() === status)
    }

    if (search) {
      list = list.filter((t: any) => {
        const id = (t?.id || '').toLowerCase()
        const pid = (t?.provider_payment_id || '').toLowerCase()
        const oid = (t?.provider_order_id || '').toLowerCase()
        const reason = (t?.reason || '').toLowerCase()
        const action = (t?.action || '').toLowerCase()
        return id.includes(search) || pid.includes(search) || oid.includes(search) || reason.includes(search) || action.includes(search)
      })
    }

    list.sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())

    res.status(200).json(list.slice(offset, offset + limit))
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch transactions' })
  }
}
