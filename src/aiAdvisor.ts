import type { Transaction } from './types'

const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'https://razorrecover-ai-teal.vercel.app/api/ai/recovery'

export async function analyzeWithAI(transaction: Transaction) {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || `AI advisor request failed (${response.status})`)
  }
  return data
}
