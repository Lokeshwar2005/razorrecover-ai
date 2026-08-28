const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

const json = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function policyCheck(tx, recommendation) {
  const risk = clamp(tx.riskScore, 1, 99)
  const retriesExceeded = /retry limit|attempts/i.test(tx.reason) || /retry.*(3|limit)/i.test(tx.explanation)
  const riskyAction = ['refund', 'capture', 'charge', 'payout'].some((word) => recommendation.recommendedAction.toLowerCase().includes(word))
  const allowed = tx.policy === 'Approved' && risk < 70 && !retriesExceeded && !riskyAction

  if (tx.policy !== 'Approved') {
    return { executionAllowed: false, policyAlignment: 'escalate', policyReason: 'The deterministic policy engine already escalated this transaction.' }
  }
  if (risk >= 70) {
    return { executionAllowed: false, policyAlignment: 'conflict', policyReason: `Risk ${risk}/100 is at or above the 70/100 safety boundary.` }
  }
  if (retriesExceeded) {
    return { executionAllowed: false, policyAlignment: 'conflict', policyReason: 'Retry boundary is exceeded; no additional automated intervention is allowed.' }
  }
  if (riskyAction) {
    return { executionAllowed: false, policyAlignment: 'conflict', policyReason: 'The AI suggested a money-moving operation outside the bounded recovery playbook.' }
  }
  return { executionAllowed: allowed, policyAlignment: 'aligned', policyReason: 'AI recommendation is compatible with the deterministic safety boundary.' }
}

function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Claude returned no JSON recommendation')
  return JSON.parse(candidate.slice(start, end + 1))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Claude advisor is not configured. Set ANTHROPIC_API_KEY on the server.' })
  }

  try {
    const tx = req.body?.transaction
    if (!tx?.id || typeof tx.amount !== 'number' || !tx.reason) {
      return res.status(400).json({ error: 'Invalid transaction context' })
    }

    const system = `You are the AI diagnosis and recommendation layer of RazorRecover AI, a payment revenue recovery agent. You NEVER authorize money movement. The deterministic policy engine is the safety authority. Analyze one failed-payment transaction and recommend only a bounded recovery intervention from this playbook: Retry payment, Payment link, Customer prompt, Retry + link, Escalate. Return ONLY valid JSON with keys: diagnosis, rootCause, recommendation, recommendedAction, recoveryProbability, riskAssessment, confidence, explanation. recoveryProbability and confidence must be integers 0-100. Do not invent transaction facts.`
    const user = JSON.stringify({ transaction: tx })

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    const raw = await anthropicResponse.json()
    if (!anthropicResponse.ok) {
      return res.status(502).json({ error: raw?.error?.message || 'Anthropic API request failed' })
    }

    const text = raw?.content?.find((item) => item.type === 'text')?.text || ''
    const recommendation = parseJson(text)
    const policy = policyCheck(tx, recommendation)

    return res.status(200).json({
      provider: 'anthropic',
      model: MODEL,
      diagnosis: String(recommendation.diagnosis || 'No diagnosis returned'),
      rootCause: String(recommendation.rootCause || tx.reason),
      recommendation: String(recommendation.recommendation || ''),
      recommendedAction: String(recommendation.recommendedAction || 'Escalate'),
      recoveryProbability: clamp(recommendation.recoveryProbability, 0, 100),
      riskAssessment: String(recommendation.riskAssessment || ''),
      confidence: clamp(recommendation.confidence, 0, 100),
      policyAlignment: policy.policyAlignment,
      policyReason: policy.policyReason,
      executionAllowed: policy.executionAllowed,
      explanation: String(recommendation.explanation || ''),
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'AI advisor failed' })
  }
}
