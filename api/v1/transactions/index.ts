import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_ledger_v6.json')
let inMemoryTransactions: Map<string, any> = new Map()

function loadStore(): any[] {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const txns = parsed.transactions || parsed
        if (typeof txns === 'object') {
          for (const [id, txn] of Object.entries(txns)) {
            inMemoryTransactions.set(id, txn)
          }
        }
      }
    }
  } catch (e) {}
  return Array.from(inMemoryTransactions.values())
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
    let list = loadStore()

    const query = req.query || {}
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status.toUpperCase() : ''
    const source = typeof query.source === 'string' ? query.source.toLowerCase() : ''
    const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : 200
    const offset = typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0

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

    const paginated = list.slice(offset, offset + limit)
    res.status(200).json(paginated)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch transactions' })
  }
}
