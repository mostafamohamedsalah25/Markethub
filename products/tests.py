from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Category, Product, ProductReview, WishlistItem
from users.models import SellerProfile
from orders.models import Order, OrderItem
import uuid

User = get_user_model()

class Module9Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='test@example.com', password='password123', role='customer')
        self.seller_user = User.objects.create_user(email='seller@example.com', password='password123', role='seller')
        self.seller_profile, _ = SellerProfile.objects.get_or_create(user=self.seller_user, defaults={'store_name': 'Test Store'})
        self.category = Category.objects.create(name='Electronics', slug='electronics')
        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            name='Laptop',
            slug='laptop',
            price=1000.00,
            stock=10
        )
        self.client.force_authenticate(user=self.user)

    def _mark_product_as_purchased(self, product: Product) -> None:
        order = Order.objects.create(
            buyer=self.user,
            seller=product.seller,
            total_amount=product.price,
            status='delivered'
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            price=product.price,
            quantity=1
        )

    def _create_review(self, product: Product, rating: int) -> ProductReview:
        self._mark_product_as_purchased(product)
        review = ProductReview.objects.create(
            user=self.user,
            product=product,
            rating=rating,
            comment=f'{rating}-star review'
        )
        product.update_rating()
        return review

    def test_add_to_wishlist(self):
        response = self.client.post('/api/products/wishlist/', {'product': self.product.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(WishlistItem.objects.filter(user=self.user, product=self.product).exists())

    def test_retrieve_wishlist(self):
        WishlistItem.objects.create(user=self.user, product=self.product)
        response = self.client.get('/api/products/wishlist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_verified_purchase_review(self):
        # Try to review without purchase
        response = self.client.post('/api/products/reviews/', {
            'product': self.product.id,
            'rating': 5,
            'comment': 'Great!'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("You can only review products you have purchased and received.", str(response.data))

        # Create a delivered order
        order = Order.objects.create(
            buyer=self.user,
            seller=self.seller_profile,
            total_amount=1000.00,
            status='delivered'
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name='Laptop',
            price=1000.00,
            quantity=1
        )

        # Now review should work
        response = self.client.post('/api/products/reviews/', {
            'product': self.product.id,
            'rating': 5,
            'comment': 'Great!'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_verified_purchase'])
        
        # Check rating calculation
        self.product.refresh_from_db()
        self.assertEqual(self.product.average_rating, 5.00)
        self.assertEqual(self.product.review_count, 1)

    def test_duplicate_review_prevention(self):
        order = Order.objects.create(buyer=self.user, seller=self.seller_profile, total_amount=1000.00, status='delivered')
        OrderItem.objects.create(order=order, product=self.product, product_name='Laptop', price=1000.00, quantity=1)
        
        ProductReview.objects.create(user=self.user, product=self.product, rating=5, comment='First')
        
        response = self.client.post('/api/products/reviews/', {
            'product': self.product.id,
            'rating': 4,
            'comment': 'Second'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_review_list_filters_by_product(self):
        self._create_review(self.product, 5)
        other_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            name='Phone',
            slug='phone',
            price=600.00,
            stock=5
        )
        self._create_review(other_product, 4)

        response = self.client.get(f'/api/products/reviews/?product={self.product.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        reviews = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0]['product'], self.product.id)

    def test_min_rating_filter_filters_products(self):
        self._create_review(self.product, 5)
        low_rating_product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            name='Mouse',
            slug='mouse',
            price=25.00,
            stock=15
        )
        self._create_review(low_rating_product, 2)

        response = self.client.get('/api/products/?min_rating=4')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        products = response.data if isinstance(response.data, list) else response.data.get('results', [])
        product_ids = {item['id'] for item in products}
        self.assertIn(self.product.id, product_ids)
        self.assertNotIn(low_rating_product.id, product_ids)
