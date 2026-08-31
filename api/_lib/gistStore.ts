import fs from 'fs'
import path from 'path'

const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'
const TMP_FILE = path.join('/tmp', 'razorrecover_serverless_ledger_v4.json')

let inMemoryTransactions: Map<string, any> = new Map()

function getGithubToken(): string | null {
  return (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || null
}

function loadLocalFileStore(): Map<string, any> {
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
  return inMemoryTransactions
}

function saveLocalFileStore() {
  try {
    const obj: Record<string, any> = {}
    for (const [id, txn] of inMemoryTransactions.entries()) {
      obj[id] = txn
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify({ transactions: obj }, null, 2), 'utf-8')
  } catch (e) {}
}

export async function fetchGistTransactions(): Promise<Record<string, any>> {
  loadLocalFileStore()

  try {
    const token = getGithubToken()
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RazorRecover-AI-Serverless',
    }
    if (token) {
      headers.Authorization = `token ${token}`
    }

    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers,
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
          saveLocalFileStore()
        }
      }
    }
  } catch (e) {}

  const result: Record<string, any> = {}
  for (const [id, txn] of inMemoryTransactions.entries()) {
    result[id] = txn
  }
  return result
}

export async function updateGistTransactions(transactions: Record<string, any>): Promise<void> {
  for (const [id, txn] of Object.entries(transactions)) {
    inMemoryTransactions.set(id, txn)
  }
  saveLocalFileStore()

  try {
    const token = getGithubToken()
    if (!token) return

    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'RazorRecover-AI-Serverless',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify({ transactions }, null, 2),
          },
        },
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch (e) {}
}
