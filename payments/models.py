from decimal import Decimal

from django.conf import settings
from django.db import models


class Payment(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_SUCCEEDED = 'succeeded'
    STATUS_FAILED = 'failed'
    STATUS_REFUNDED = 'refunded'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_SUCCEEDED, 'Succeeded'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_REFUNDED, 'Refunded'),
    )

    PROVIDER_MOCK = 'mock'
    PROVIDER_STRIPE = 'stripe'
    PROVIDER_PAYPAL = 'paypal'
    PROVIDER_CHOICES = (
        (PROVIDER_MOCK, 'Mock'),
        (PROVIDER_STRIPE, 'Stripe'),
        (PROVIDER_PAYPAL, 'PayPal'),
    )

    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='payments',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_MOCK)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default='usd')
    transaction_id = models.CharField(max_length=196, unique=True, null=True, blank=True)
    client_secret = models.CharField(max_length=512, blank=True)
    checkout_url = models.URLField(max_length=1024, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['order', 'status']),
            models.Index(fields=['transaction_id']),
        ]

    def __str__(self) -> str:
        return f'Payment {self.pk} ({self.status}) for order {self.order_id}'
