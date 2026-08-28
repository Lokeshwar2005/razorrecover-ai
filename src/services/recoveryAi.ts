import type { AIRecoveryRecommendation, AIRecoveryRequest } from '../types/ai'

const AI_API_URL = import.meta.env.VITE_AI_API_URL || '/api/ai/recovery'

export async function analyzeRecoveryWithAI(
  request: AIRecoveryRequest,
): Promise<AIRecoveryRecommendation> {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || `AI advisor request failed (${response.status})`)
  }

  return payload as AIRecoveryRecommendation
}
