from .base import BasePaymentProvider
from .mock import MockPaymentProvider
from .paypal import PaypalPaymentProvider
from .stripe import StripePaymentProvider

_PROVIDER_MAP: dict[str, type[BasePaymentProvider]] = {
    'mock': MockPaymentProvider,
    'stripe': StripePaymentProvider,
    'paypal': PaypalPaymentProvider,
}


def get_payment_provider(provider_name: str) -> BasePaymentProvider:
    name = (provider_name or '').strip().lower()
    if not name:
        raise ValueError('provider_name is required.')

    provider_cls = _PROVIDER_MAP.get(name)
    if not provider_cls:
        raise ValueError(f'Unsupported payment provider: {provider_name!r}')
    return provider_cls()
