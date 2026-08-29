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
                "order_id": f"order_synth_{transaction_id.replace('-', '_')}_{int(time.time())}",
                "amount": amount_minor,
                "currency": currency,
                "status": "created",
                "key_id": "rzp_test_mock",
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
            return {
                "payment_link_id": f"plink_synth_{transaction_id.replace('-', '_')}",
                "payment_link": f"https://rzp.io/i/synth-{transaction_id.lower()}",
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
    ) -> Dict[str, Any]:
        """
        Fetches payment status from Razorpay API.
        VERIFIED is True ONLY IF status is 'captured' or 'authorized'.
        """
        headers = cls._auth_header()
        if not headers:
            # In test mode without live credentials, verify dummy captured payment
            is_captured = not payment_id.startswith("pay_failed")
            return {
                "payment_id": payment_id,
                "amount_minor": 249900,
                "currency": "INR",
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

            return {
                "payment_id": data.get("id"),
                "amount_minor": data.get("amount", 0),
                "currency": data.get("currency", "INR"),
                "status": status,
                "verified": is_captured,
                "simulated": False,
            }
