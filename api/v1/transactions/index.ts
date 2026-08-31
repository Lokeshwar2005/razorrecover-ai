import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const RESTFUL_OBJECT_ID = 'ff808181a057a55b01a057bb444f003a'
const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'

let inMemoryTransactions: Map<string, any> = new Map()

async function fetchSharedTransactions(): Promise<any[]> {
  try {
    const res = await fetch(`https://api.restful-api.dev/objects/${RESTFUL_OBJECT_ID}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      const txns = data?.data?.transactions
      if (txns && typeof txns === 'object') {
        for (const [id, txn] of Object.entries(txns)) {
          inMemoryTransactions.set(id, txn)
        }
      }
    }
  } catch (e) {}

  if (inMemoryTransactions.size === 0) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'RazorRecover-AI' },
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        const rawContent = data?.files?.[GIST_FILENAME]?.content
        if (rawContent) {
          const parsed = JSON.parse(rawContent)
          const remoteTxns = parsed?.transactions
          if (remoteTxns && typeof remoteTxns === 'object') {
            for (const [id, txn] of Object.entries(remoteTxns)) {
              inMemoryTransactions.set(id, txn)
            }
          }
        }
      }
    } catch (e) {}
  }

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
    let list = await fetchSharedTransactions()

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
