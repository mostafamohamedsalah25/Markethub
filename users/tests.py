from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from users.models import SellerProfile
from products.models import Product, Category
from orders.models import Order, OrderItem

User = get_user_model()

class SellerProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller_user = User.objects.create_user(email='seller@example.com', password='password123', role='seller')
        self.seller_profile = SellerProfile.objects.get(user=self.seller_user) # Created automatically by signal or serialzer
        self.client.force_authenticate(user=self.seller_user)

    def test_retrieve_seller_profile(self):
        response = self.client.get(f'/api/seller-profiles/{self.seller_profile.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['store_name'], self.seller_profile.store_name)

    def test_update_seller_profile(self):
        response = self.client.patch(f'/api/seller-profiles/{self.seller_profile.id}/', {'store_name': 'New Name'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller_profile.refresh_from_db()
        self.assertEqual(self.seller_profile.store_name, 'New Name')

    def test_seller_statistics(self):
        # Create some data for stats
        cat = Category.objects.create(name='Cat', slug='cat')
        prod = Product.objects.create(seller=self.seller_profile, category=cat, name='P1', slug='p1', price=100)
        order = Order.objects.create(buyer=self.seller_user, seller=self.seller_profile, total_amount=100, status='delivered')
        OrderItem.objects.create(order=order, product=prod, product_name='P1', price=100, quantity=2)

        response = self.client.get(f'/api/seller-profiles/{self.seller_profile.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.data['data']
        self.assertEqual(stats['total_products'], 1)
        self.assertEqual(stats['total_sales'], 2)


class SellerRegistrationTests(TestCase):
    """Tests for the seller registration flow — specifically guarding against
    the duplicate SellerProfile IntegrityError bug."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'

    def test_seller_registration_creates_profile_once(self):
        """Seller registration should succeed and create exactly one SellerProfile."""
        data = {
            'email': 'newseller@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
            'role': 'seller',
            'store_name': 'My Awesome Store',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED],
                       f"Registration failed with {response.status_code}: {response.data}")

        user = User.objects.get(email='newseller@example.com')
        self.assertEqual(user.role, 'seller')

        # Exactly one SellerProfile must exist
        profiles = SellerProfile.objects.filter(user=user)
        self.assertEqual(profiles.count(), 1)
        self.assertEqual(profiles.first().store_name, 'My Awesome Store')

    def test_customer_registration_no_seller_profile(self):
        """Customer registration should not create a SellerProfile."""
        data = {
            'email': 'customer@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
            'role': 'customer',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])

        user = User.objects.get(email='customer@example.com')
        self.assertFalse(SellerProfile.objects.filter(user=user).exists())

    def test_seller_registration_without_store_name_fails(self):
        """Seller registration without store_name should be rejected."""
        data = {
            'email': 'nostorenameseller@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
            'role': 'seller',
            'store_name': '',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_seller_registration_password_mismatch(self):
        """Registration with mismatched passwords should fail."""
        data = {
            'email': 'mismatch@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'WrongPass456!',
            'role': 'seller',
            'store_name': 'Store',
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
