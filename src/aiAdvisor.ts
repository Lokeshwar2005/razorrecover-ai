import type { AIRecoveryRequest } from './types/ai'

type Transaction = AIRecoveryRequest['transaction']

const AI_API_URL =
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_AI_API_URL || process.env?.VITE_AI_API_URL)) ||
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_AI_API_URL) ||
  'https://razorrecover-ai-teal.vercel.app/api/ai/recovery'

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
