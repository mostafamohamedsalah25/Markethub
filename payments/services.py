from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from orders.fulfillment import FulfillmentError, fulfill_order_on_payment
from orders.models import Order
from payments.models import Payment
from payments.providers import get_payment_provider
from payments.providers.stripe import StripePaymentProvider
from notifications.tasks import send_order_confirmation_email, create_notification


class PaymentServiceError(Exception):
    def __init__(self, message: str, code: str = 'payment_error'):
        self.message = message
        self.code = code
        super().__init__(message)


def _normalize_provider_name(provider_name: str | None) -> str:
    name = (provider_name or Payment.PROVIDER_MOCK).strip().lower()
    if name not in {choice for choice, _ in Payment.PROVIDER_CHOICES}:
        raise PaymentServiceError(f'Unsupported payment provider: {provider_name!r}', 'invalid_provider')
    return name


@transaction.atomic
def create_payment_intent(*, user, order_id: int, provider_name: str | None = None) -> Payment:
    order = (
        Order.objects.select_for_update()
        .filter(id=order_id, buyer=user)
        .first()
    )
    if not order:
        raise PaymentServiceError('Order not found.', 'not_found')

    if order.status == 'cancelled':
        raise PaymentServiceError('Order has been cancelled.', 'order_cancelled')

    if order.status != 'pending':
        raise PaymentServiceError('Only pending orders can be paid.', 'order_not_payable')

    if Payment.objects.filter(order=order, status=Payment.STATUS_SUCCEEDED).exists():
        raise PaymentServiceError('This order is already paid.', 'already_paid')

    amount = order.total_amount.quantize(Decimal('0.01'))
    provider_enum = _normalize_provider_name(provider_name)

    if amount <= 0:
        payment = Payment.objects.create(
            order=order,
            user=user,
            provider=provider_enum,
            status=Payment.STATUS_SUCCEEDED,
            amount=amount,
            currency='usd',
            transaction_id=f'zero_amount_{order.id}_{user.id}',
            client_secret='',
            paid_at=timezone.now(),
        )
        return _apply_status(payment, Payment.STATUS_SUCCEEDED)

    existing = (
        Payment.objects.select_for_update()
        .filter(
            order=order,
            status__in=[Payment.STATUS_PENDING, Payment.STATUS_PROCESSING],
        )
        .first()
    )
    if existing:
        if existing.amount != amount:
            existing.amount = amount
            existing.save(update_fields=['amount', 'updated_at'])
        if existing.provider == Payment.PROVIDER_STRIPE and existing.transaction_id:
            url = StripePaymentProvider.retrieve_open_session_url(existing.transaction_id)
            if url and not existing.checkout_url:
                existing.checkout_url = url
                existing.save(update_fields=['checkout_url', 'updated_at'])
        return existing

    provider = get_payment_provider(provider_enum)
    pending_txn = f'pending_{uuid.uuid4().hex[:20]}'
    payment = Payment.objects.create(
        order=order,
        user=user,
        provider=provider_enum,
        status=Payment.STATUS_PENDING,
        amount=amount,
        currency='usd',
        transaction_id=pending_txn,
        client_secret='',
        checkout_url='',
    )

    metadata: dict[str, Any] = {
        'order_id': str(order.id),
        'user_id': str(user.id),
        'payment_id': str(payment.pk),
    }
    try:
        intent = provider.create_payment_intent(amount=amount, currency='usd', metadata=metadata)
    except Exception as exc:  # pragma: no cover - provider exceptions are integration-level failures
        raise PaymentServiceError(f'Payment provider failed to create intent: {exc}', 'provider_error') from exc

    payment.transaction_id = intent['transaction_id']
    payment.client_secret = intent.get('client_secret', '')
    payment.checkout_url = intent.get('checkout_url', '')
    payment.save(update_fields=['transaction_id', 'client_secret', 'checkout_url', 'updated_at'])
    return payment


@transaction.atomic
def verify_payment(
    *,
    user,
    payment_id: int,
    client_secret: str,
    simulate_outcome: str | None = None,
) -> Payment:
    payment = (
        Payment.objects.select_for_update()
        .select_related('order')
        .filter(id=payment_id, user=user)
        .first()
    )
    if not payment:
        raise PaymentServiceError('Payment not found.', 'not_found')

    if payment.status == Payment.STATUS_SUCCEEDED:
        raise PaymentServiceError('Payment already completed.', 'already_succeeded')

    if payment.provider == Payment.PROVIDER_MOCK:
        if payment.client_secret != client_secret:
            raise PaymentServiceError('Invalid client secret.', 'invalid_secret')
    elif payment.provider == Payment.PROVIDER_STRIPE:
        allowed = {payment.client_secret, payment.transaction_id, payment.checkout_url}
        if client_secret not in allowed and not client_secret.startswith('cs_'):
            raise PaymentServiceError('Invalid payment session.', 'invalid_secret')

    if Payment.objects.filter(
        order_id=payment.order_id,
        status=Payment.STATUS_SUCCEEDED,
    ).exclude(pk=payment.pk).exists():
        raise PaymentServiceError('Order already has a successful payment.', 'order_already_paid')

    provider = get_payment_provider(payment.provider)
    try:
        outcome = provider.verify_payment(
            transaction_id=payment.transaction_id or '',
            client_secret=payment.client_secret,
            simulate_outcome=simulate_outcome,
        )
    except Exception as exc:  # pragma: no cover - provider exceptions are integration-level failures
        raise PaymentServiceError(f'Payment provider verification failed: {exc}', 'provider_error') from exc

    return _apply_status(payment, outcome)


def _complete_order_payment(order: Order) -> None:
    order.refresh_from_db()
    fulfill_order_on_payment(order)

    # Trigger notifications
    send_order_confirmation_email.delay(order.id, order.buyer.email)
    create_notification.delay(
        order.buyer.id, 
        f"Order Confirmation - #{order.id}", 
        f"Your order #{order.id} has been confirmed.", 
        'order_confirmation'
    )
    
    # Notify seller
    if hasattr(order, 'seller') and order.seller and order.seller.user:
        create_notification.delay(
            order.seller.user.id,
            "New Order Received",
            f"A new paid order #{order.id} has arrived.",
            'order_received'
        )


def _reject_order_and_refund(payment: Payment, *, _reason: str) -> Payment:
    """
    Payment succeeded, but fulfillment failed.

    We call the gateway refund first, then persist the rejected/refunded state.
    """
    _ = _reason
    try:
        provider = get_payment_provider(payment.provider)
        refund_id = provider.refund_payment(
            transaction_id=payment.transaction_id or '',
            amount=payment.amount,
        )
    except Exception as exc:  # pragma: no cover - provider exceptions are integration-level failures
        raise PaymentServiceError(f'Gateway refund failed: {exc}', 'refund_failed') from exc
    Order.objects.filter(pk=payment.order_id).update(status='rejected', updated_at=timezone.now())
    payment.status = Payment.STATUS_REFUNDED
    payment.save(update_fields=['status', 'updated_at'])
    _ = refund_id
    return payment


def _apply_status(payment: Payment, outcome: str) -> Payment:
    if outcome == Payment.STATUS_SUCCEEDED:
        payment.status = Payment.STATUS_SUCCEEDED
        payment.paid_at = timezone.now()
        payment.save(update_fields=['status', 'paid_at', 'updated_at'])
        order = payment.order
        order.refresh_from_db()

        if order.status == 'cancelled':
            # A cancelled order must not be fulfilled. In production this is where
            # the provider refund call would run before returning the payment state.
            payment.status = Payment.STATUS_REFUNDED
            payment.save(update_fields=['status', 'updated_at'])
            return payment

        try:
            _complete_order_payment(payment.order)
        except FulfillmentError as exc:
            return _reject_order_and_refund(payment, _reason=str(exc))

        return payment

    if outcome == Payment.STATUS_FAILED:
        payment.status = Payment.STATUS_FAILED
        payment.save(update_fields=['status', 'updated_at'])
        return payment

    if outcome == Payment.STATUS_PROCESSING:
        payment.status = Payment.STATUS_PROCESSING
        payment.save(update_fields=['status', 'updated_at'])
        return payment

    if outcome == Payment.STATUS_PENDING:
        payment.status = Payment.STATUS_PENDING
        payment.save(update_fields=['status', 'updated_at'])
        return payment

    payment.status = Payment.STATUS_FAILED
    payment.save(update_fields=['status', 'updated_at'])
    return payment


@transaction.atomic
def apply_webhook_event(*, transaction_id: str, event: str) -> Payment:
    if not transaction_id:
        raise PaymentServiceError('transaction_id is required.', 'invalid_payload')

    payment = (
        Payment.objects.select_for_update()
        .select_related('order')
        .filter(transaction_id=transaction_id)
        .first()
    )
    if not payment:
        raise PaymentServiceError('Payment not found for transaction.', 'not_found')

    event_l = event.lower()
    if event_l in ('succeeded', 'payment.succeeded', 'success'):
        if payment.status == Payment.STATUS_SUCCEEDED:
            return payment
        if Payment.objects.filter(
            order_id=payment.order_id,
            status=Payment.STATUS_SUCCEEDED,
        ).exclude(pk=payment.pk).exists():
            raise PaymentServiceError('Order already paid.', 'already_paid')
        return _apply_status(payment, Payment.STATUS_SUCCEEDED)

    if event_l in ('failed', 'payment.failed', 'failure'):
        if payment.status == Payment.STATUS_SUCCEEDED:
            raise PaymentServiceError('Cannot fail a completed payment.', 'invalid_transition')
        return _apply_status(payment, Payment.STATUS_FAILED)

    if event_l in ('refunded', 'payment.refunded'):
        payment.status = Payment.STATUS_REFUNDED
        payment.save(update_fields=['status', 'updated_at'])
        return payment

    if event_l == 'ignored':
        raise PaymentServiceError('Unsupported webhook event.', 'unsupported_event')

    raise PaymentServiceError('Unsupported webhook event.', 'unsupported_event')


def list_payments_for_account(user):
    qs = Payment.objects.select_related('order', 'order__buyer', 'order__seller')
    if user.role == 'admin':
        return qs.order_by('-created_at')
    if user.role == 'seller' and hasattr(user, 'seller_profile'):
        return qs.filter(order__seller=user.seller_profile).order_by('-created_at')
    return qs.filter(user=user).order_by('-created_at')
