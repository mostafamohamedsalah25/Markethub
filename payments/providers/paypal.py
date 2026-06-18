from __future__ import annotations

import secrets
import uuid
from decimal import Decimal
from typing import Any

from .mock import MockPaymentProvider


class PaypalPaymentProvider(MockPaymentProvider):
    """
    PayPal provider stub that follows the same contract as the other providers.

    The project does not currently integrate the real PayPal SDK, so this keeps
    the strategy layer functional without blocking checkout or refunds.
    """

    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, str]:
        _ = amount, currency, metadata
        txn = f'paypal_txn_{uuid.uuid4()}'
        secret = f'paypal_cs_{secrets.token_hex(12)}'
        return {'client_secret': secret, 'transaction_id': txn}

    def refund_payment(self, *, transaction_id: str, amount: Decimal) -> str:
        _ = amount
        return f'paypal_ref_{transaction_id}_{uuid.uuid4().hex[:12]}'
