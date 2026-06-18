from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from orders.models import Cart, CartItem, Order
from payments.models import Payment
from payments.services import create_payment_intent, verify_payment
from products.models import Category, Product
from promos.models import PromoCode
from users.models import SellerProfile


User = get_user_model()


def _make_catalog():
    seller_user = User.objects.create_user(email='seller1@test.com', password='pw123456', role='seller')
    profile, created = SellerProfile.objects.get_or_create(user=seller_user, defaults={'store_name': 'Store A'})
    if not created:
        profile.store_name = 'Store A'
        profile.save()
    cat = Category.objects.create(name='Cat', slug='cat')
    product = Product.objects.create(
        seller=profile,
        category=cat,
        name='Widget',
        slug='widget',
        price=Decimal('50.00'),
        stock=20,
    )
    return seller_user, profile, product


@override_settings(PAYMENT_PROVIDER='mock', PAYMENT_WEBHOOK_SECRET='testsecret')
class PaymentFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller_user, self.profile, self.product = _make_catalog()
        self.buyer = User.objects.create_user(email='buyer1@test.com', password='pw123456', role='customer')
        self.admin = User.objects.create_user(email='admin1@test.com', password='pw123456', role='admin')

        self.cart, _ = Cart.objects.get_or_create(user=self.buyer)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=2)

    def _checkout(self):
        self.client.force_authenticate(self.buyer)
        return self.client.post(
            '/api/orders/checkout/',
            {'shipping_address': '123 St', 'contact_phone': '+10000000000'},
            format='json',
        )

    def test_successful_payment_leaves_order_pending(self):
        r = self._checkout()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        order_id = r.json()[0]['id']

        r2 = self.client.post(
            '/api/payments/create-intent/',
            {'order_id': order_id},
            format='json',
        )
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        body = r2.json()
        self.assertEqual(body['status'], 'success')
        pay = body['data']
        pid = pay['id']
        secret = pay['client_secret']

        r3 = self.client.post(
            '/api/payments/verify/',
            {'payment_id': pid, 'client_secret': secret, 'simulate_outcome': 'succeeded'},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()['data']['status'], Payment.STATUS_SUCCEEDED)

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')

    def test_failed_payment_keeps_order_pending(self):
        r = self._checkout()
        order_id = r.json()[0]['id']
        stock_before = self.product.stock

        self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        pay = Payment.objects.get(order_id=order_id)
        r3 = self.client.post(
            '/api/payments/verify/',
            {'payment_id': pay.id, 'client_secret': pay.client_secret, 'simulate_outcome': 'failed'},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()['data']['status'], Payment.STATUS_FAILED)

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, stock_before)

    def test_successful_payment_decrements_stock(self):
        stock_before = self.product.stock
        r = self._checkout()
        order_id = r.json()[0]['id']
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, stock_before)

        self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        pay = Payment.objects.get(order_id=order_id)
        self.client.post(
            '/api/payments/verify/',
            {'payment_id': pay.id, 'client_secret': pay.client_secret, 'simulate_outcome': 'succeeded'},
            format='json',
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, stock_before - 2)

    def test_insufficient_stock_rejects_order_and_refunds_payment(self):
        r = self._checkout()
        order_id = r.json()[0]['id']

        self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        pay = Payment.objects.get(order_id=order_id)

        self.product.stock = 1
        self.product.save(update_fields=['stock'])

        r3 = self.client.post(
            '/api/payments/verify/',
            {'payment_id': pay.id, 'client_secret': pay.client_secret, 'simulate_outcome': 'succeeded'},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()['data']['status'], Payment.STATUS_REFUNDED)

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'rejected')

    def test_duplicate_intent_blocked_after_success(self):
        r = self._checkout()
        order_id = r.json()[0]['id']
        self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        pay = Payment.objects.get(order_id=order_id)
        verify_payment(
            user=self.buyer,
            payment_id=pay.id,
            client_secret=pay.client_secret,
            simulate_outcome='succeeded',
        )

        r2 = self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already paid', r2.json()['message'].lower())

    def test_create_intent_rejects_non_pending_orders(self):
        r = self._checkout()
        order_id = r.json()[0]['id']
        Order.objects.filter(id=order_id).update(status='accepted')

        r2 = self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('only pending orders can be paid', r2.json()['message'].lower())

    def test_history_lists_payments(self):
        self._checkout()
        order_id = Order.objects.filter(buyer=self.buyer).first().id
        create_payment_intent(user=self.buyer, order_id=order_id)

        self.client.force_authenticate(self.buyer)
        r = self.client.get('/api/payments/history/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(r.json()['data']['results']), 1)

    def test_webhook_simulation_succeeds_with_secret(self):
        r = self._checkout()
        order_id = r.json()[0]['id']
        self.client.post('/api/payments/create-intent/', {'order_id': order_id}, format='json')
        pay = Payment.objects.get(order_id=order_id)
        pay.status = Payment.STATUS_PROCESSING
        pay.save()

        r2 = self.client.post(
            '/api/payments/simulate-webhook/',
            {'transaction_id': pay.transaction_id, 'event': 'succeeded'},
            format='json',
            HTTP_X_PAYMENT_WEBHOOK_SECRET='testsecret',
        )
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        pay.refresh_from_db()
        self.assertEqual(pay.status, Payment.STATUS_SUCCEEDED)
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')

    def test_webhook_rejects_bad_secret(self):
        r2 = self.client.post(
            '/api/payments/simulate-webhook/',
            {'transaction_id': 'x', 'event': 'succeeded'},
            format='json',
            HTTP_X_PAYMENT_WEBHOOK_SECRET='wrong',
        )
        self.assertEqual(r2.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(PAYMENT_PROVIDER='mock', PAYMENT_WEBHOOK_SECRET='testsecret')
class PromoPaymentIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller_user, self.profile, self.product = _make_catalog()
        self.buyer = User.objects.create_user(email='buyer2@test.com', password='pw123456', role='customer')
        self.cart, _ = Cart.objects.get_or_create(user=self.buyer)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)

        PromoCode.objects.create(
            code='SAVE10',
            discount_type=PromoCode.DISCOUNT_FIXED,
            value=Decimal('10.00'),
            minimum_order_amount=Decimal('0'),
        )

    def test_checkout_with_promo_reduces_order_total(self):
        self.client.force_authenticate(self.buyer)
        self.client.post('/api/promos/apply/', {'code': 'SAVE10'}, format='json')
        r = self.client.post(
            '/api/orders/checkout/',
            {'shipping_address': '123', 'contact_phone': '+1'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.json()[0]['total_amount']), Decimal('40.00'))


@override_settings(PAYMENT_PROVIDER='mock')
class PromoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(email='b3@test.com', password='pw123456', role='customer')
        self.admin = User.objects.create_user(email='a3@test.com', password='pw123456', role='admin')
        _make_catalog()
        self.cart, _ = Cart.objects.get_or_create(user=self.buyer)
        p = Product.objects.first()
        CartItem.objects.create(cart=self.cart, product=p, quantity=1)

    def test_validate_expired_promo(self):
        PromoCode.objects.create(
            code='OLD',
            discount_type=PromoCode.DISCOUNT_FIXED,
            value=Decimal('5'),
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.client.force_authenticate(self.buyer)
        r = self.client.post('/api/promos/validate/', {'code': 'OLD'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.json()['data']['valid'])

    def test_promo_crud_forbidden_for_non_admin(self):
        self.client.force_authenticate(self.buyer)
        r = self.client.get('/api/promos/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_promo_crud_allowed_for_admin(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            '/api/promos/',
            {
                'code': 'ADMIN10',
                'discount_type': 'percentage',
                'value': '10',
                'is_active': True,
                'minimum_order_amount': '0',
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        pid = r.json()['data']['id']
        r2 = self.client.patch(f'/api/promos/{pid}/', {'is_active': False}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)


@override_settings(
    PAYMENT_PROVIDER='stripe',
    STRIPE_SECRET_KEY='sk_test_fake',
    FRONTEND_URL='http://localhost:4200',
)
class StripeCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller_user, self.profile, self.product = _make_catalog()
        self.buyer = User.objects.create_user(
            email='stripe_buyer@test.com',
            password='pw123456',
            role='customer',
            is_verified=True,
        )
        self.cart, _ = Cart.objects.get_or_create(user=self.buyer)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)

    @patch('payments.providers.stripe.stripe.checkout.Session.create')
    def test_create_intent_returns_checkout_url(self, mock_create):
        session = MagicMock()
        session.id = 'cs_test_123'
        session.url = 'https://checkout.stripe.com/c/pay/cs_test_123'
        mock_create.return_value = session

        self.client.force_authenticate(self.buyer)
        r = self.client.post(
            '/api/orders/checkout/',
            {'shipping_address': '1 St', 'contact_phone': '+1'},
            format='json',
        )
        order_id = r.json()[0]['id']

        # Explicit provider selection exercises the new strategy path.
        r2 = self.client.post(
            '/api/payments/create-intent/',
            {'order_id': order_id, 'provider': 'stripe'},
            format='json',
        )
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        data = r2.json()['data']
        self.assertEqual(data['provider'], 'stripe')
        self.assertEqual(data['checkout_url'], session.url)
        self.assertEqual(data['transaction_id'], session.id)

    @patch('payments.providers.stripe.stripe.checkout.Session.retrieve')
    @patch('payments.providers.stripe.stripe.checkout.Session.create')
    def test_verify_stripe_session_succeeds(self, mock_create, mock_retrieve):
        created = MagicMock()
        created.id = 'cs_test_verify'
        created.url = 'https://checkout.stripe.com/c/pay/cs_test_verify'
        mock_create.return_value = created

        session = MagicMock()
        session.payment_status = 'paid'
        session.status = 'complete'
        mock_retrieve.return_value = session

        self.client.force_authenticate(self.buyer)
        r = self.client.post(
            '/api/orders/checkout/',
            {'shipping_address': '1 St', 'contact_phone': '+1'},
            format='json',
        )
        order_id = r.json()[0]['id']
        self.client.post(
            '/api/payments/create-intent/',
            {'order_id': order_id, 'provider': 'stripe'},
            format='json',
        )
        pay = Payment.objects.get(order_id=order_id)

        r3 = self.client.post(
            '/api/payments/verify/',
            {'payment_id': pay.id, 'session_id': pay.transaction_id},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()['data']['status'], Payment.STATUS_SUCCEEDED)

    @patch('payments.providers.stripe.stripe.Refund.create')
    @patch('payments.providers.stripe.stripe.checkout.Session.retrieve')
    @patch('payments.providers.stripe.stripe.checkout.Session.create')
    def test_stripe_refund_runs_before_rejection(self, mock_create, mock_retrieve, mock_refund):
        created = MagicMock()
        created.id = 'cs_test_refund'
        created.url = 'https://checkout.stripe.com/c/pay/cs_test_refund'
        mock_create.return_value = created

        session = MagicMock()
        session.payment_status = 'paid'
        session.status = 'complete'
        mock_retrieve.return_value = session

        refund = MagicMock()
        refund.id = 're_test_123'
        mock_refund.return_value = refund

        self.client.force_authenticate(self.buyer)
        r = self.client.post(
            '/api/orders/checkout/',
            {'shipping_address': '1 St', 'contact_phone': '+1'},
            format='json',
        )
        order_id = r.json()[0]['id']

        self.client.post(
            '/api/payments/create-intent/',
            {'order_id': order_id, 'provider': 'stripe'},
            format='json',
        )
        pay = Payment.objects.get(order_id=order_id)

        self.product.stock = 0
        self.product.save(update_fields=['stock'])

        r3 = self.client.post(
            '/api/payments/verify/',
            {'payment_id': pay.id, 'session_id': pay.transaction_id},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()['data']['status'], Payment.STATUS_REFUNDED)
        mock_refund.assert_called_once_with(payment_intent='cs_test_refund')
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'rejected')
