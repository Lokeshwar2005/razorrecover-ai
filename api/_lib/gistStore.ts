const GIST_ID = '2f5891b16cf74dd9c53fa5589ed2954a'
const GIST_FILENAME = 'razorrecover_db_init.json'

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured on the server')
  }
  return token
}

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `token ${getGithubToken()}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'RazorRecover-AI-Serverless',
  }
}

export async function fetchGistTransactions(): Promise<Record<string, any>> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(4000),
  })

  if (!res.ok) {
    throw new Error(`Authoritative ledger read failed (${res.status})`)
  }

  const data = await res.json()
  const rawContent = data?.files?.[GIST_FILENAME]?.content
  if (!rawContent) {
    throw new Error('Authoritative ledger file is missing')
  }

  const parsed = JSON.parse(rawContent)
  const transactions = parsed?.transactions
  if (!transactions || typeof transactions !== 'object') {
    throw new Error('Authoritative ledger has an invalid transaction map')
  }

  return transactions
}

export async function updateGistTransactions(transactions: Record<string, any>): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      ...githubHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({ transactions }, null, 2),
        },
      },
    }),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    throw new Error(`Authoritative ledger write failed (${res.status})`)
  }
}
