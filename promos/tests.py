from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from orders.models import Cart, CartItem
from django.test import SimpleTestCase

from promos.models import PromoCode
from promos.serializers import PromoValidateRequestSerializer
from products.models import Category, Product
from promos.services import allocate_order_totals, compute_discount_amount
from users.models import SellerProfile


User = get_user_model()


def _make_cart_with_promo():
    seller = User.objects.create_user(email='seller@test.com', password='pw123456', role='seller')
    profile, _ = SellerProfile.objects.get_or_create(user=seller, defaults={'store_name': 'Store'})
    category = Category.objects.create(name='Cat', slug='cat')
    product = Product.objects.create(
        seller=profile,
        category=category,
        name='Widget',
        slug='widget',
        price=Decimal('50.00'),
        stock=10,
    )
    buyer = User.objects.create_user(email='buyer@test.com', password='pw123456', role='customer')
    cart, _ = Cart.objects.get_or_create(user=buyer)
    CartItem.objects.create(cart=cart, product=product, quantity=1)
    promo = PromoCode.objects.create(
        code='SAVE10',
        discount_type=PromoCode.DISCOUNT_FIXED,
        value=Decimal('10.00'),
        is_active=True,
        minimum_order_amount=Decimal('0.00'),
    )
    cart.applied_promo = promo
    cart.save(update_fields=['applied_promo', 'updated_at'])
    return buyer, cart, promo


class PromoServicesTests(SimpleTestCase):
    def test_allocate_order_totals_splits_discount(self):
        s1, s2 = object(), object()
        raw = {s1: Decimal('60.00'), s2: Decimal('40.00')}
        out = allocate_order_totals(raw, Decimal('100.00'), Decimal('10.00'))
        self.assertEqual(sum(out.values()), Decimal('90.00'))

    def test_percentage_discount_capped(self):
        p = PromoCode(
            code='X',
            discount_type=PromoCode.DISCOUNT_PERCENTAGE,
            value=Decimal('50'),
        )
        self.assertEqual(compute_discount_amount(p, Decimal('80')), Decimal('40.00'))


class PromoApiTests(TestCase):
    def test_invalid_code_rejected(self):
        ser = PromoValidateRequestSerializer(data={'code': 'BAD CODE!'})
        self.assertFalse(ser.is_valid())
        self.assertIn('alphanumeric', str(ser.errors).lower())

    def test_remove_promos_clears_cart(self):
        buyer, cart, promo = _make_cart_with_promo()
        client = APIClient()
        client.force_authenticate(buyer)

        resp = client.post('/api/promos/remove/', {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        cart.refresh_from_db()
        self.assertIsNone(cart.applied_promo_id)
        self.assertIsNone(resp.json()['data']['applied_promo_code'])
