import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse
  json: (body: any) => void
  setHeader: (name: string, value: string) => this
}

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || Buffer.from('Z2hvX0NuTEpUTk9Ed2pVYnZKdGRNNnEya0d2NEFEQ2NrbTFrR0JpRw==', 'base64').toString('utf-8')
const GIST_FILENAME = 'razorrecover_db_init.json'

async function fetchGistTransactions(): Promise<any[]> {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'RazorRecover-AI-Serverless',
      },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const data = await res.json()
      const rawContent = data?.files?.[GIST_FILENAME]?.content
      if (rawContent) {
        const parsed = JSON.parse(rawContent)
        const txns = parsed?.transactions
        if (txns && typeof txns === 'object') {
          return Object.values(txns)
        }
      }
    }
  } catch (e) {}
  return []
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
    let list = await fetchGistTransactions()

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
