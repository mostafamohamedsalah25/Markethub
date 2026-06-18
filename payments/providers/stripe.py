from __future__ import annotations

from decimal import Decimal
from typing import Any

import stripe
from django.conf import settings

from .base import BasePaymentProvider


class StripePaymentProvider(BasePaymentProvider):
    """Stripe Checkout Session provider."""

    def __init__(self) -> None:
        secret = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''
        if not secret:
            raise ValueError('STRIPE_SECRET_KEY is required when using the Stripe provider.')
        stripe.api_key = secret

    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, str]:
        order_id = metadata.get('order_id', '')
        payment_id = metadata.get('payment_id', '')
        frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:4200').rstrip('/')

        success_url = (
            f'{frontend}/payment/success?payment_id={payment_id}'
            '&session_id={CHECKOUT_SESSION_ID}'
        )
        cancel_url = f'{frontend}/payment/cancel?payment_id={payment_id}'

        unit_amount = int((amount * 100).quantize(Decimal('1')))
        if unit_amount < 50:
            raise ValueError('Stripe requires a minimum charge of $0.50 USD.')

        session = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': currency.lower(),
                        'unit_amount': unit_amount,
                        'product_data': {
                            'name': f'Markethub Order #{order_id}',
                            'description': f'Payment for order {order_id}',
                        },
                    },
                    'quantity': 1,
                }
            ],
            metadata={k: str(v) for k, v in metadata.items()},
            success_url=success_url,
            cancel_url=cancel_url,
        )

        return {
            'client_secret': session.id,
            'transaction_id': session.id,
            'checkout_url': session.url or '',
        }

    def verify_payment(
        self,
        *,
        transaction_id: str,
        client_secret: str,
        simulate_outcome: str | None = None,
    ) -> str:
        _ = client_secret, simulate_outcome
        if not transaction_id:
            return 'failed'

        session_id = transaction_id
        if transaction_id.startswith('cs_'):
            session_id = transaction_id
        elif client_secret.startswith('cs_'):
            session_id = client_secret

        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except stripe.error.StripeError:
            return 'failed'

        payment_status = getattr(session, 'payment_status', None)
        status = getattr(session, 'status', None)

        if payment_status == 'paid' or status == 'complete':
            return 'succeeded'
        if status == 'expired':
            return 'failed'
        if status == 'open':
            return 'pending'
        return 'processing'

    def parse_webhook_payload(self, payload: dict[str, Any]) -> tuple[str, str]:
        event_type = (payload.get('type') or '').lower()
        data = payload.get('data', {}) or {}
        obj = data.get('object', {}) if isinstance(data, dict) else {}
        txn = obj.get('id', '') if isinstance(obj, dict) else ''

        if event_type == 'checkout.session.completed':
            return 'succeeded', txn
        if event_type in ('checkout.session.expired', 'checkout.session.async_payment_failed'):
            return 'failed', txn
        if event_type == 'payment_intent.payment_failed':
            pi = obj
            txn = pi.get('id', '') if isinstance(pi, dict) else ''
            return 'failed', txn
        return 'ignored', txn

    def refund_payment(self, *, transaction_id: str, amount: Decimal) -> str:
        _ = amount
        refund = stripe.Refund.create(payment_intent=transaction_id)
        return getattr(refund, 'id', '')

    @staticmethod
    def retrieve_open_session_url(transaction_id: str) -> str | None:
        """Return checkout URL if session is still open."""
        try:
            session = stripe.checkout.Session.retrieve(transaction_id)
        except stripe.error.StripeError:
            return None
        if session.status == 'open' and session.url:
            return session.url
        return None
