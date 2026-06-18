"""
Populate Markethub with realistic QA / demo data.

Usage:
    python manage.py seed_data
    python manage.py seed_data --flush   # remove prior seed data, then re-seed
"""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.fulfillment import fulfill_order_on_payment, new_checkout_group_id
from orders.models import Cart, CartItem, Order, OrderItem
from payments.models import Payment
from products.models import Category, Product, ProductImage, ProductReview, WishlistItem
from promos.models import PromoCode
from users.management.commands.seed_helpers import (
    CATEGORIES,
    PRODUCTS,
    PROMOS,
    REVIEW_COMMENTS,
    SEED_MARKER,
    SEED_PRODUCT_SLUGS,
    TEST_USERS,
    make_product_image_file,
    register_product_slug,
    unique_tx_id,
)
from users.models import SellerProfile

User = get_user_model()

SEED_EMAILS = tuple(TEST_USERS.keys())


class Command(BaseCommand):
    help = 'Seed realistic catalog, users, orders, payments, reviews, and wishlists for QA.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Delete previously seeded @example.com data before seeding.',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self.stdout.write(self.style.WARNING('Flushing existing seed data…'))
            self._flush()

        with transaction.atomic():
            users = self._seed_users()
            categories = self._seed_categories()
            products = self._seed_products(users, categories)
            self._seed_promos()
            self._seed_reviews(users, products)
            self._seed_wishlists(users, products)
            self._seed_cart(users, products)
            self._seed_orders_and_payments(users, products)

        self._print_summary(users, products)

    def _flush(self):
        WishlistItem.objects.filter(user__email__in=SEED_EMAILS).delete()
        ProductReview.objects.filter(user__email__in=SEED_EMAILS).delete()
        Payment.objects.filter(user__email__in=SEED_EMAILS).delete()
        Order.objects.filter(buyer__email__in=SEED_EMAILS).delete()
        CartItem.objects.filter(cart__user__email__in=SEED_EMAILS).delete()
        Cart.objects.filter(user__email__in=SEED_EMAILS).delete()

        Product.objects.filter(slug__in=SEED_PRODUCT_SLUGS).delete()

        PromoCode.objects.filter(code__in=[p[0] for p in PROMOS]).delete()

        for email in SEED_EMAILS:
            User.objects.filter(email=email).delete()

        Category.objects.filter(slug__in=[c[1] for c in CATEGORIES]).delete()

    def _seed_users(self) -> dict[str, User]:
        users: dict[str, User] = {}
        for email, spec in TEST_USERS.items():
            role = spec['role']
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'role': role,
                    'is_verified': True,
                    'is_active': True,
                    'is_staff': spec.get('is_staff', False),
                    'is_superuser': spec.get('is_superuser', False),
                },
            )
            user.set_password(spec['password'])
            user.role = role
            user.is_verified = True
            user.is_active = True
            user.is_staff = spec.get('is_staff', False)
            user.is_superuser = spec.get('is_superuser', False)
            user.save()

            if role == 'seller':
                profile, _ = SellerProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        'store_name': spec['store_name'],
                        'description': f"{spec['description']} [{SEED_MARKER}]",
                        'is_approved': spec.get('is_approved', True),
                        'balance': spec.get('balance', Decimal('0')),
                    },
                )
                users[email] = user
            else:
                users[email] = user

            action = 'Created' if created else 'Updated'
            self.stdout.write(f'  {action} user {email} ({role})')

        return users

    def _seed_categories(self) -> dict[str, Category]:
        by_slug: dict[str, Category] = {}
        for name, slug, parent_slug in CATEGORIES:
            parent = by_slug.get(parent_slug) if parent_slug else None
            cat, created = Category.objects.update_or_create(
                slug=slug,
                defaults={'name': name, 'parent': parent},
            )
            by_slug[slug] = cat
            if created:
                self.stdout.write(f'  Category: {name}')
        return by_slug

    def _seed_products(self, users: dict[str, User], categories: dict[str, Category]) -> list[Product]:
        sellers = {
            'seller1': users['seller1@example.com'].seller_profile,
            'seller2': users['seller2@example.com'].seller_profile,
        }
        products: list[Product] = []

        for row in PRODUCTS:
            name, slug, cat_slug, seller_key, price, discount, stock, active = row
            register_product_slug(slug)
            seller = sellers[seller_key]
            category = categories[cat_slug]

            product, created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    'seller': seller,
                    'category': category,
                    'name': name,
                    'description': (
                        f'{name} — premium quality item for manual QA testing. '
                        f'Category: {category.name}. [{SEED_MARKER}]'
                    ),
                    'price': Decimal(price),
                    'discount_price': Decimal(discount) if discount else None,
                    'stock': stock,
                    'is_active': active,
                },
            )
            products.append(product)

            existing_images = product.images.count()
            if existing_images < 2:
                for idx in range(2 - existing_images):
                    order = existing_images + idx
                    is_primary = order == 0 and not product.images.filter(is_primary=True).exists()
                    img_file = make_product_image_file(slug, name, order)
                    ProductImage.objects.create(
                        product=product,
                        image=img_file,
                        is_primary=is_primary,
                        order=order,
                    )

            if created:
                self.stdout.write(f'  Product: {name}')

        return products

    def _seed_promos(self):
        for row in PROMOS:
            code, dtype, value, active, starts, expires, min_amt, max_uses = row
            PromoCode.objects.update_or_create(
                code=code,
                defaults={
                    'discount_type': dtype,
                    'value': Decimal(value),
                    'is_active': active,
                    'starts_at': starts,
                    'expires_at': expires,
                    'minimum_order_amount': Decimal(min_amt) if min_amt else Decimal('0'),
                    'max_uses': max_uses,
                    'used_count': 2 if code == 'FLASH50' else 0,
                },
            )
        self.stdout.write(f'  Promos: {len(PROMOS)} codes')

    def _seed_reviews(self, users: dict[str, User], products: list[Product]):
        customers = [users[e] for e in SEED_EMAILS if users[e].role == 'customer']
        active_products = [p for p in products if p.is_active][:30]
        count = 0
        for product in active_products:
            reviewers = random.sample(customers, k=min(len(customers), random.randint(1, 3)))
            for user in reviewers:
                rating = random.choices([5, 4, 4, 3, 3, 2, 1], weights=[30, 25, 15, 12, 8, 5, 5])[0]
                comment = random.choice(REVIEW_COMMENTS)
                _, created = ProductReview.objects.update_or_create(
                    product=product,
                    user=user,
                    defaults={'rating': rating, 'comment': comment},
                )
                if created:
                    count += 1
            product.update_rating()
        self.stdout.write(f'  Reviews: {ProductReview.objects.count()} total ({count} new)')

    def _seed_wishlists(self, users: dict[str, User], products: list[Product]):
        customer = users['customer@example.com']
        WishlistItem.objects.filter(user=customer).delete()
        slugs = [
            'iphone-15-pro',
            'macbook-pro-14-m3',
            'nike-running-shoes-air-zoom',
            'floral-summer-dress',
            'gaming-mechanical-keyboard',
            'hydrating-face-serum',
            'atomic-habits-paperback',
            'air-fryer-6qt',
        ]
        for slug in slugs:
            product = self._product_by_slug(products, slug)
            if product and product.is_active:
                WishlistItem.objects.create(user=customer, product=product)
        self.stdout.write(f'  Wishlist: {WishlistItem.objects.filter(user=customer).count()} items for customer@')

    def _seed_cart(self, users: dict[str, User], products: list[Product]):
        customer = users['customer@example.com']
        cart, _ = Cart.objects.get_or_create(user=customer)
        cart.items.all().delete()
        picks = [p for p in products if p.is_active and p.stock > 0][:3]
        for product in picks:
            CartItem.objects.create(cart=cart, product=product, quantity=random.randint(1, 2))
        summer = PromoCode.objects.filter(code='SUMMER20').first()
        if summer:
            cart.applied_promo = summer
            cart.save(update_fields=['applied_promo', 'updated_at'])
        self.stdout.write(f'  Cart: {cart.items.count()} items for customer@')

    def _seed_orders_and_payments(self, users: dict[str, User], products: list[Product]):
        buyer = users['customer@example.com']
        buyer2 = users['customer2@example.com']
        seller1 = users['seller1@example.com'].seller_profile
        seller2 = users['seller2@example.com'].seller_profile
        summer = PromoCode.objects.filter(code='SUMMER20').first()
        now = timezone.now()

        scenarios = [
            # pending + failed payment
            {
                'buyer': buyer,
                'seller': seller1,
                'product': self._product_by_slug(products, 'iphone-15-pro'),
                'qty': 1,
                'status': 'pending',
                'payment_status': Payment.STATUS_FAILED,
                'fulfill': False,
                'days_ago': 2,
            },
            # pending, no payment yet
            {
                'buyer': buyer2,
                'seller': seller2,
                'product': self._product_by_slug(products, 'nike-running-shoes-air-zoom'),
                'qty': 1,
                'status': 'pending',
                'payment_status': None,
                'fulfill': False,
                'days_ago': 1,
            },
            # cancelled by customer before payment
            {
                'buyer': buyer,
                'seller': seller2,
                'product': self._product_by_slug(products, 'trail-running-backpack'),
                'qty': 1,
                'status': 'cancelled',
                'payment_status': None,
                'fulfill': False,
                'days_ago': 1,
            },
            # accepted + succeeded (seller1) — spread dates for charts
            {
                'buyer': buyer,
                'seller': seller1,
                'product': self._product_by_slug(products, 'macbook-pro-14-m3'),
                'qty': 1,
                'status': 'accepted',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 45,
            },
            {
                'buyer': buyer2,
                'seller': seller1,
                'product': self._product_by_slug(products, 'airpods-pro-2'),
                'qty': 2,
                'status': 'accepted',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 30,
            },
            {
                'buyer': buyer,
                'seller': seller1,
                'product': self._product_by_slug(products, 'gaming-mechanical-keyboard'),
                'qty': 1,
                'status': 'shipped',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 14,
            },
            {
                'buyer': buyer2,
                'seller': seller1,
                'product': self._product_by_slug(products, 'smart-watch-series-9'),
                'qty': 1,
                'status': 'delivered',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 7,
            },
            # seller2 fashion / beauty
            {
                'buyer': buyer,
                'seller': seller2,
                'product': self._product_by_slug(products, 'floral-summer-dress'),
                'qty': 1,
                'status': 'accepted',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 20,
                'promo': summer,
            },
            {
                'buyer': buyer2,
                'seller': seller2,
                'product': self._product_by_slug(products, 'hydrating-face-serum'),
                'qty': 3,
                'status': 'accepted',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 10,
            },
            {
                'buyer': buyer,
                'seller': seller2,
                'product': self._product_by_slug(products, 'leather-crossbody-bag'),
                'qty': 1,
                'status': 'accepted',
                'payment_status': Payment.STATUS_SUCCEEDED,
                'fulfill': True,
                'days_ago': 3,
            },
            # rejected after payment success would be refunded in production
            {
                'buyer': buyer2,
                'seller': seller1,
                'product': self._product_by_slug(products, 'vintage-film-camera'),
                'qty': 1,
                'status': 'rejected',
                'payment_status': Payment.STATUS_REFUNDED,
                'fulfill': False,
                'days_ago': 5,
            },
            # processing payment
            {
                'buyer': buyer2,
                'seller': seller2,
                'product': self._product_by_slug(products, 'classic-cotton-t-shirt'),
                'qty': 2,
                'status': 'pending',
                'payment_status': Payment.STATUS_PROCESSING,
                'fulfill': False,
                'days_ago': 0,
            },
        ]

        group_promo = new_checkout_group_id()
        for idx, spec in enumerate(scenarios):
            product = spec['product']
            if not product:
                continue
            unit_price = product.discount_price or product.price
            total = (unit_price * spec['qty']).quantize(Decimal('0.01'))
            created_at = now - timedelta(days=spec['days_ago'])

            order, _ = Order.objects.update_or_create(
                buyer=spec['buyer'],
                seller=spec['seller'],
                shipping_address=f'123 Seed Street, Apt {idx + 1}, QA City [{SEED_MARKER}]',
                defaults={
                    'total_amount': total,
                    'contact_phone': '+15550001111',
                    'status': spec['status'],
                    'checkout_group_id': group_promo if spec.get('promo') else uuid.uuid4(),
                    'applied_promo': spec.get('promo'),
                    'inventory_fulfilled': spec['fulfill'],
                    'promo_usage_recorded': bool(spec.get('promo') and spec['fulfill']),
                },
            )
            Order.objects.filter(pk=order.pk).update(created_at=created_at)

            OrderItem.objects.filter(order=order).delete()
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                price=unit_price,
                quantity=spec['qty'],
            )

            if spec['payment_status']:
                paid_at = created_at + timedelta(hours=2) if spec['payment_status'] == Payment.STATUS_SUCCEEDED else None
                payment, _ = Payment.objects.update_or_create(
                    order=order,
                    user=spec['buyer'],
                    defaults={
                        'provider': Payment.PROVIDER_MOCK,
                        'status': spec['payment_status'],
                        'amount': total,
                        'currency': 'usd',
                        'transaction_id': unique_tx_id('pay', order.id, str(idx)),
                        'client_secret': f'seed_secret_{order.id}',
                        'paid_at': paid_at,
                    },
                )
                Payment.objects.filter(pk=payment.pk).update(created_at=created_at)

            if spec['fulfill'] and not order.inventory_fulfilled:
                fulfill_order_on_payment(order)

        self.stdout.write(
            f'  Orders: {Order.objects.filter(buyer__email__in=SEED_EMAILS).count()} | '
            f'Payments: {Payment.objects.filter(user__email__in=SEED_EMAILS).count()}'
        )

    def _product_by_slug(self, products: list[Product], slug: str) -> Product | None:
        for p in products:
            if p.slug == slug:
                return p
        return Product.objects.filter(slug=slug).first()

    def _print_summary(self, users: dict[str, User], products: list[Product]):
        self.stdout.write(self.style.SUCCESS('\nSeed complete.\n'))
        self.stdout.write('Test accounts:')
        for email, spec in TEST_USERS.items():
            self.stdout.write(f'  {email} / {spec["password"]} ({spec["role"]})')
        self.stdout.write('\nCounts:')
        self.stdout.write(f'  Categories: {Category.objects.count()}')
        self.stdout.write(f'  Products (active): {Product.objects.filter(is_active=True).count()}')
        self.stdout.write(f'  Products (inactive): {Product.objects.filter(is_active=False).count()}')
        self.stdout.write(f'  Promos: {PromoCode.objects.count()}')
        self.stdout.write(f'  Reviews: {ProductReview.objects.count()}')
        self.stdout.write(f'  Wishlist items: {WishlistItem.objects.count()}')
        self.stdout.write(f'  Orders: {Order.objects.count()}')
        self.stdout.write(f'  Payments succeeded: {Payment.objects.filter(status=Payment.STATUS_SUCCEEDED).count()}')
        self.stdout.write(f'  Payments failed: {Payment.objects.filter(status=Payment.STATUS_FAILED).count()}')
