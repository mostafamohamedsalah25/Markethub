from __future__ import annotations

import uuid

from django.db import transaction

from orders.models import Order, OrderItem
from products.models import Product
from promos.models import PromoCode
from promos.services import increment_promo_usage


class FulfillmentError(Exception):
    pass


@transaction.atomic
def fulfill_order_on_payment(order: Order) -> None:
    """
    Decrement inventory and record promo usage once payment succeeds.
    Idempotent per order via inventory_fulfilled.

    Callers must catch FulfillmentError and handle rejection/refund flows when
    stock is no longer available at payment time.
    """
    order = Order.objects.select_for_update().get(pk=order.pk)

    if not order.inventory_fulfilled:
        items = (
            OrderItem.objects.select_for_update()
            .filter(order=order)
            .select_related('product')
        )
        for item in items:
            if item.product_id is None:
                continue
            product = Product.objects.select_for_update().get(pk=item.product_id)
            if product.stock < item.quantity:
                raise FulfillmentError(
                    f'Insufficient stock for {product.name}. '
                    f'Available: {product.stock}, required: {item.quantity}.'
                )
            product.stock -= item.quantity
            product.save(update_fields=['stock'])

        order.inventory_fulfilled = True
        order.save(update_fields=['inventory_fulfilled', 'updated_at'])

    if order.applied_promo_id and order.checkout_group_id and not order.promo_usage_recorded:
        group_id = order.checkout_group_id
        already = Order.objects.filter(
            checkout_group_id=group_id,
            promo_usage_recorded=True,
        ).exists()
        if not already:
            promo = PromoCode.objects.select_for_update().get(pk=order.applied_promo_id)
            increment_promo_usage(promo)
            Order.objects.filter(checkout_group_id=group_id).update(promo_usage_recorded=True)


def new_checkout_group_id() -> uuid.UUID:
    return uuid.uuid4()
