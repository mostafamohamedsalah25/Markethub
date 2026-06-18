from __future__ import annotations

import random
import secrets
import uuid
from decimal import Decimal
from typing import Any

from django.conf import settings

from .base import BasePaymentProvider


class MockPaymentProvider(BasePaymentProvider):
    """Development provider: realistic shape; outcomes controllable for tests."""

    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, str]:
        _ = currency, metadata
        txn = f'mock_txn_{uuid.uuid4()}'
        secret = f'mock_cs_{secrets.token_hex(12)}'
        if settings.DEBUG:
            secret = f'{secret}_amt{amount}'
        return {'client_secret': secret, 'transaction_id': txn}

    def verify_payment(
        self,
        *,
        transaction_id: str,
        client_secret: str,
        simulate_outcome: str | None = None,
    ) -> str:
        if not transaction_id or not client_secret:
            return 'failed'

        if simulate_outcome in ('succeeded', 'processing', 'failed', 'pending'):
            return simulate_outcome

        if simulate_outcome == 'random':
            return random.choice(['succeeded', 'succeeded', 'succeeded', 'failed', 'processing'])

        return random.choices(
            population=['succeeded', 'failed', 'processing'],
            weights=[0.85, 0.1, 0.05],
            k=1,
        )[0]

    def parse_webhook_payload(self, payload: dict[str, Any]) -> tuple[str, str]:
        event = (payload.get('event') or payload.get('type') or '').lower()
        data = payload.get('data', {}) or {}
        obj = data.get('object', {}) if isinstance(data, dict) else {}
        txn = payload.get('transaction_id') or payload.get('id') or ''
        if isinstance(obj, dict):
            txn = txn or obj.get('id', '') or obj.get('payment_intent', '') or ''
        if event in ('payment.succeeded', 'succeeded', 'success'):
            return 'succeeded', txn
        if event in ('payment.failed', 'failed', 'failure'):
            return 'failed', txn
        return 'ignored', txn

    def refund_payment(self, *, transaction_id: str, amount: Decimal) -> str:
        _ = amount
        return f'mock_ref_{transaction_id}_{uuid.uuid4().hex[:12]}'
