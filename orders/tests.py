from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from orders.models import Order
from payments.services import create_payment_intent, PaymentServiceError
from products.models import Category, Product
from users.models import SellerProfile


User = get_user_model()


class OrderCancellationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(email='buyer@test.com', password='pw123456', role='customer')
        seller_user = User.objects.create_user(email='seller@test.com', password='pw123456', role='seller')
        self.seller_profile, _ = SellerProfile.objects.get_or_create(
            user=seller_user,
            defaults={'store_name': 'Seller Store'},
        )
        self.category = Category.objects.create(name='Electronics', slug='electronics')
        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            name='Laptop',
            slug='laptop-order-test',
            price=Decimal('1000.00'),
            stock=5,
        )
        self.client.force_authenticate(self.buyer)

    def test_buyer_can_cancel_pending_order(self):
        order = Order.objects.create(
            buyer=self.buyer,
            seller=self.seller_profile,
            total_amount=Decimal('1000.00'),
            shipping_address='123 Main St',
            contact_phone='+10000000000',
            status='pending',
        )

        response = self.client.patch(f'/api/orders/my-orders/{order.id}/cancel/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')

    def test_buyer_cannot_cancel_non_pending_order(self):
        order = Order.objects.create(
            buyer=self.buyer,
            seller=self.seller_profile,
            total_amount=Decimal('1000.00'),
            shipping_address='123 Main St',
            contact_phone='+10000000000',
            status='accepted',
        )

        response = self.client.patch(f'/api/orders/my-orders/{order.id}/cancel/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'accepted')

    def test_cancelled_order_cannot_create_payment_intent(self):
        order = Order.objects.create(
            buyer=self.buyer,
            seller=self.seller_profile,
            total_amount=Decimal('1000.00'),
            shipping_address='123 Main St',
            contact_phone='+10000000000',
            status='cancelled',
        )

        with self.assertRaises(PaymentServiceError) as ctx:
            create_payment_intent(user=self.buyer, order_id=order.id)

        self.assertEqual(ctx.exception.code, 'order_cancelled')

    def test_seller_can_only_move_through_valid_transitions(self):
        seller = User.objects.create_user(email='seller2@test.com', password='pw123456', role='seller')
        other_profile = seller.seller_profile
        other_profile.store_name = 'Other Store'
        other_profile.save(update_fields=['store_name'])
        order = Order.objects.create(
            buyer=self.buyer,
            seller=other_profile,
            total_amount=Decimal('1000.00'),
            shipping_address='123 Main St',
            contact_phone='+10000000000',
            status='pending',
        )

        self.client.force_authenticate(seller)

        bad = self.client.patch(
            f'/api/orders/seller-orders/{order.id}/status/',
            {'status': 'shipped'},
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.client.patch(
            f'/api/orders/seller-orders/{order.id}/status/',
            {'status': 'accepted'},
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'accepted')

        next_step = self.client.patch(
            f'/api/orders/seller-orders/{order.id}/status/',
            {'status': 'shipped'},
            format='json',
        )
        self.assertEqual(next_step.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'shipped')

    def test_buyer_cannot_cancel_after_payment_is_created(self):
        order = Order.objects.create(
            buyer=self.buyer,
            seller=self.seller_profile,
            total_amount=Decimal('1000.00'),
            shipping_address='123 Main St',
            contact_phone='+10000000000',
            status='pending',
        )

        create_payment_intent(user=self.buyer, order_id=order.id)

        response = self.client.patch(f'/api/orders/my-orders/{order.id}/cancel/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'pending')
