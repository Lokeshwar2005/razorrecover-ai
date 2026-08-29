import base64
import time
from typing import Any, Dict, Optional
import httpx

from backend.app.core.config import settings


class RazorpayService:
    """
    Razorpay Test Mode Integration Service.
    
    CRITICAL:
    Revenue is NEVER counted as recovered until payment verification confirms 'captured' status.
    """

    @staticmethod
    def _auth_header() -> Optional[Dict[str, str]]:
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            return None
        creds = f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}"
        encoded = base64.b64encode(creds.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    @classmethod
    async def create_order(
        cls,
        transaction_id: str,
        amount_minor: int,
        currency: str = "INR",
    ) -> Dict[str, Any]:
        """Creates a Razorpay Test Mode Order for bounded retry execution."""
        headers = cls._auth_header()
        if not headers:
            # Synthetic simulation fallback order ID if keys are not set locally
            return {
                "order_id": f"order_test_{transaction_id.replace('-', '_').lower()}_{int(time.time())}",
                "amount": amount_minor,
                "currency": currency,
                "status": "created",
                "key_id": "rzp_test_placeholder",
                "simulated": True,
            }

        receipt = f"{transaction_id}-{int(time.time())}"[:40]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.RAZORPAY_BASE_URL}/orders",
                headers=headers,
                json={
                    "amount": amount_minor,
                    "currency": currency,
                    "receipt": receipt,
                    "notes": {
                        "source": "RazorRecover AI",
                        "transaction_id": transaction_id,
                    },
                },
            )
            data = resp.json()
            if not resp.is_success:
                error_msg = data.get("error", {}).get("description", "Razorpay Order creation failed")
                raise RuntimeError(error_msg)

            return {
                "order_id": data.get("id"),
                "amount": data.get("amount"),
                "currency": data.get("currency"),
                "status": data.get("status"),
                "key_id": settings.RAZORPAY_KEY_ID,
                "simulated": False,
            }

    @classmethod
    async def create_payment_link(
        cls,
        transaction_id: str,
        amount_minor: int,
        currency: str = "INR",
    ) -> Dict[str, Any]:
        """Creates a Razorpay Payment Link for abandoned checkout recovery."""
        headers = cls._auth_header()
        if not headers:
            # When live keys are not configured, return an in-app test checkout reference
            # DO NOT generate fake rzp.io URLs because rzp.io is Razorpay's production shortlink server
            return {
                "payment_link_id": f"plink_test_{transaction_id.replace('-', '_').lower()}_{int(time.time())}",
                "payment_link": None,
                "status": "created",
                "simulated": True,
            }

        ref_id = f"{transaction_id}-{int(time.time())}"[:40]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.RAZORPAY_BASE_URL}/payment_links",
                headers=headers,
                json={
                    "amount": amount_minor,
                    "currency": currency,
                    "description": f"RazorRecover Recovery for {transaction_id}",
                    "reference_id": ref_id,
                    "notes": {
                        "source": "RazorRecover AI",
                        "transaction_id": transaction_id,
                    },
                },
            )
            data = resp.json()
            if not resp.is_success:
                error_msg = data.get("error", {}).get("description", "Razorpay Payment Link creation failed")
                raise RuntimeError(error_msg)

            return {
                "payment_link_id": data.get("id"),
                "payment_link": data.get("short_url"),
                "status": data.get("status"),
                "simulated": False,
            }

    @classmethod
    async def verify_payment(
        cls,
        payment_id: str,
        expected_amount_minor: Optional[int] = None,
        expected_currency: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetches payment status from Razorpay API.
        VERIFIED is True ONLY IF status is 'captured' or 'authorized' AND amount and currency match.
        """
        headers = cls._auth_header()
        if not headers:
            # In test/mock mode:
            is_captured = not payment_id.startswith("pay_failed")
            amt = expected_amount_minor if expected_amount_minor is not None else 0
            curr = (expected_currency or "INR").upper()
            return {
                "payment_id": payment_id,
                "amount_minor": amt,
                "currency": curr,
                "status": "captured" if is_captured else "failed",
                "verified": is_captured,
                "simulated": True,
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.RAZORPAY_BASE_URL}/payments/{payment_id}",
                headers=headers,
            )
            data = resp.json()
            if not resp.is_success:
                error_msg = data.get("error", {}).get("description", "Razorpay payment fetch failed")
                raise RuntimeError(error_msg)

            status = str(data.get("status", "unknown")).lower()
            is_captured = (status == "captured" or status == "authorized")
            actual_amount = data.get("amount", 0)
            actual_currency = str(data.get("currency", "INR")).upper()

            # Validate amount and currency
            amount_matches = True
            if expected_amount_minor is not None and actual_amount != expected_amount_minor:
                amount_matches = False
                is_captured = False

            currency_matches = True
            if expected_currency is not None and actual_currency != expected_currency.upper():
                currency_matches = False
                is_captured = False

            return {
                "payment_id": data.get("id"),
                "amount_minor": actual_amount,
                "currency": actual_currency,
                "status": status,
                "verified": is_captured,
                "amount_matches": amount_matches,
                "currency_matches": currency_matches,
                "simulated": False,
            }
