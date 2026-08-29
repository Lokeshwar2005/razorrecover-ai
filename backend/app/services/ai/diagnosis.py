import json
import re
from typing import Any, Dict, Optional
import httpx

from backend.app.core.config import settings
from backend.app.schemas.domain import AIDiagnosisRequest, AIDiagnosisResponse
from backend.app.services.policy.engine import DeterministicPolicyEngine


def extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Resilient JSON extractor from LLM markdown code blocks."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except Exception:
            return None


class AIDiagnosisService:
    """
    AI Diagnosis Agent for RazorRecover AI.
    
    PRINCIPLE:
    AI recommendations are advisory and do NOT directly authorize money movement.
    The deterministic policy engine remains the final authorization gate.
    """

    @staticmethod
    async def diagnose(request: AIDiagnosisRequest) -> AIDiagnosisResponse:
        txn = request.transaction
        
        # 1. Deterministic Fallback Data
        fallback_diagnosis = f"Detected {txn.reason} on transaction {txn.id}. Risk {txn.risk_score}/100 with {txn.recovery_probability}% estimated recovery."
        fallback_root_cause = txn.reason
        fallback_action = txn.action or "Retry payment"

        # 2. Check if OpenRouter key is available
        if not settings.OPENROUTER_API_KEY:
            # Fallback directly to deterministic evaluation
            policy_check = DeterministicPolicyEngine.evaluate(
                risk_score=txn.risk_score,
                recovery_probability=txn.recovery_probability,
                retry_count=1,
                action=fallback_action,
            )
            return AIDiagnosisResponse(
                diagnosis=fallback_diagnosis,
                root_cause=fallback_root_cause,
                recommended_action=policy_check["action"],
                confidence=txn.confidence,
                recovery_probability=txn.recovery_probability,
                explanation=f"Deterministic fallback diagnosis. {policy_check['policy_reason']}",
                model_name="deterministic-engine",
                policy_alignment="aligned" if policy_check["decision"] == "Approved" else "escalate",
                execution_allowed=policy_check["execution_allowed"],
                policy_reason=policy_check["policy_reason"],
            )

        # 3. Construct Structured LLM Prompt
        system_prompt = (
            "You are the AI diagnosis layer for RazorRecover AI, a fintech revenue recovery platform.\n"
            "The deterministic recovery policy engine is the strict source of truth. "
            "You must NOT invent, modify, or override transaction facts, risk limits, policy decisions, "
            "retry boundaries, or execution authority. Diagnose the failure and recommend one bounded intervention.\n"
            "Allowed actions: Retry payment, Payment link, Customer prompt, Escalate.\n\n"
            "Return ONLY valid JSON with exactly these fields:\n"
            "{\n"
            '  "diagnosis": "short diagnosis sentence",\n'
            '  "rootCause": "short root cause signature",\n'
            '  "recommendedAction": "one allowed action",\n'
            '  "recoveryProbability": number from 0 to 100,\n'
            '  "confidence": number from 0 to 100,\n'
            '  "explanation": "concise rationale"\n'
            "}"
        )

        user_content = f"Transaction context:\n{json.dumps(txn.model_dump(), indent=2)}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://github.com/Lokeshwar2005/razorrecover-ai",
                        "X-Title": "RazorRecover AI",
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                        "temperature": 0.2,
                    },
                )

                if resp.is_success:
                    payload = resp.json()
                    content = payload["choices"][0]["message"]["content"]
                    parsed = extract_json(content)
                    if parsed:
                        recommended_action = str(parsed.get("recommendedAction", fallback_action))
                        
                        # Validate recommendation against deterministic policy engine
                        policy_eval = DeterministicPolicyEngine.evaluate(
                            risk_score=txn.risk_score,
                            recovery_probability=int(parsed.get("recoveryProbability", txn.recovery_probability)),
                            retry_count=1,
                            action=recommended_action,
                        )

                        return AIDiagnosisResponse(
                            diagnosis=str(parsed.get("diagnosis", fallback_diagnosis)),
                            root_cause=str(parsed.get("rootCause", fallback_root_cause)),
                            recommended_action=policy_eval["action"],
                            confidence=int(parsed.get("confidence", txn.confidence)),
                            recovery_probability=int(parsed.get("recoveryProbability", txn.recovery_probability)),
                            explanation=str(parsed.get("explanation", policy_eval["policy_reason"])),
                            model_name=settings.OPENROUTER_MODEL,
                            policy_alignment="aligned" if policy_eval["decision"] == "Approved" else "escalate",
                            execution_allowed=policy_eval["execution_allowed"],
                            policy_reason=policy_eval["policy_reason"],
                        )
        except Exception as e:
            # Graceful logging and fallback
            pass

        # Fallback if upstream LLM error or unparseable JSON
        policy_eval = DeterministicPolicyEngine.evaluate(
            risk_score=txn.risk_score,
            recovery_probability=txn.recovery_probability,
            retry_count=1,
            action=fallback_action,
        )

        return AIDiagnosisResponse(
            diagnosis=fallback_diagnosis,
            root_cause=fallback_root_cause,
            recommended_action=policy_eval["action"],
            confidence=txn.confidence,
            recovery_probability=txn.recovery_probability,
            explanation=f"Diagnosis completed with deterministic policy boundaries. {policy_eval['policy_reason']}",
            model_name="deterministic-fallback",
            policy_alignment="aligned" if policy_eval["decision"] == "Approved" else "escalate",
            execution_allowed=policy_eval["execution_allowed"],
            policy_reason=policy_eval["policy_reason"],
        )
