from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any


class BasePaymentProvider(ABC):
    """Contract for payment providers (mock, Stripe, ...)."""

    @abstractmethod
    def create_payment_intent(
        self,
        *,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, str]:
        """
        Returns keys at minimum: client_secret, transaction_id.
        Stripe also returns checkout_url for hosted Checkout redirect.
        """

    @abstractmethod
    def verify_payment(
        self,
        *,
        transaction_id: str,
        client_secret: str,
        simulate_outcome: str | None = None,
    ) -> str:
        """
        Returns one of: pending, processing, succeeded, failed
        """

    @abstractmethod
    def parse_webhook_payload(self, payload: dict[str, Any]) -> tuple[str, str]:
        """
        Returns (event_type, transaction_id).
        event_type: succeeded | failed
        """

    @abstractmethod
    def refund_payment(self, *, transaction_id: str, amount: Decimal) -> str:
        """
        Issue a refund for the given transaction and return the refund reference.
        """
