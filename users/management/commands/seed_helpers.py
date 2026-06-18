"""Shared helpers and catalog definitions for seed_data management command."""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
import urllib.request

from django.core.files.base import ContentFile
from django.utils import timezone
from PIL import Image, ImageDraw

SEED_MARKER = 'markethub-seed'
SEED_PRODUCT_SLUGS: set[str] = set()

TEST_USERS = {
    'admin@example.com': {'password': 'Admin123!', 'role': 'admin', 'is_staff': True, 'is_superuser': True},
    'seller1@example.com': {
        'password': 'Seller123!', 'role': 'seller', 'store_name': 'TechVault Electronics',
        'description': 'Premium gadgets, laptops, and smart home gear.', 'balance': Decimal('12500.00'), 'is_approved': True
    },
    'seller2@example.com': {
        'password': 'Seller123!', 'role': 'seller', 'store_name': 'StyleHub Fashion',
        'description': 'Trend-forward apparel, footwear, and accessories.', 'balance': Decimal('8320.50'), 'is_approved': True
    },
    'customer@example.com': {'password': 'Customer123!', 'role': 'customer'},
    'customer2@example.com': {'password': 'Customer123!', 'role': 'customer'},
    'customer3@example.com': {'password': 'Customer123!', 'role': 'customer'},
}

CATEGORIES = [
    ('Electronics', 'electronics', None),
    ('Phones', 'phones', 'electronics'),
    ('Laptops', 'laptops', 'electronics'),
    ('Accessories', 'accessories', 'electronics'),
    ('Fashion', 'fashion', None),
    ("Men's Clothing", 'mens-clothing', 'fashion'),
    ("Women's Clothing", 'womens-clothing', 'fashion'),
    ('Home & Kitchen', 'home-kitchen', None),
    ('Gaming', 'gaming', None),
    ('Beauty', 'beauty', None),
    ('Sports', 'sports', None),
    ('Books', 'books', None),
]

# (name, slug, category_slug, seller_key, price, discount, stock, active)
PRODUCTS = [
    ('Samsung Galaxy S24 Ultra', 'samsung-galaxy-s24-ultra', 'phones', 'seller1', '1299.00', None, 18, True),
    ('MacBook Pro 14 M3', 'macbook-pro-14-m3', 'laptops', 'seller1', '1999.00', None, 12, True),
    ('Dell XPS 15', 'dell-xps-15', 'laptops', 'seller1', '1599.00', '1449.00', 15, True),
    ('Lenovo ThinkPad X1 Carbon', 'lenovo-thinkpad-x1', 'laptops', 'seller1', '1399.00', None, 10, True),
    ('AirPods Pro 2', 'airpods-pro-2', 'accessories', 'seller1', '249.00', '219.00', 80, True),
    ('Anker 737 Power Bank', 'anker-737-power-bank', 'accessories', 'seller1', '149.00', None, 55, True),
    ('Smart Home Hub', 'smart-home-hub', 'electronics', 'seller1', '129.00', None, 22, True),
    ('Coffee Machine Deluxe', 'coffee-machine-deluxe', 'home-kitchen', 'seller1', '299.00', '249.00', 20, True),
    ('Ceramic Non-Stick Cookware Set', 'ceramic-cookware-set', 'home-kitchen', 'seller1', '159.00', '139.00', 30, True),
    ('Air Fryer 6QT', 'air-fryer-6qt', 'home-kitchen', 'seller1', '89.00', None, 45, True),
    ('Robot Vacuum Cleaner', 'robot-vacuum-cleaner', 'home-kitchen', 'seller1', '399.00', '349.00', 18, True),
    ('Nike Running Shoes Air Zoom', 'nike-running-shoes-air-zoom', 'sports', 'seller2', '129.00', '99.00', 40, True),
    ('Adjustable Dumbbells Set', 'adjustable-dumbbells-set', 'sports', 'seller2', '349.00', '299.00', 15, True),
    ('Classic Cotton T-Shirt', 'classic-cotton-t-shirt', 'mens-clothing', 'seller2', '29.00', '24.00', 200, True),
    ('Slim Fit Denim Jeans', 'slim-fit-denim-jeans', 'mens-clothing', 'seller2', '79.00', None, 85, True),
    ('Floral Summer Dress', 'floral-summer-dress', 'womens-clothing', 'seller2', '69.00', '59.00', 60, True),
    ('Hydrating Face Serum', 'hydrating-face-serum', 'beauty', 'seller2', '42.00', '35.00', 75, True),
    ('Vitamin C Moisturizer', 'vitamin-c-moisturizer', 'beauty', 'seller2', '38.00', None, 80, True),
    ('Matte Lipstick Set', 'matte-lipstick-set', 'beauty', 'seller2', '28.00', '22.00', 120, True),
    ('Atomic Habits — Paperback', 'atomic-habits-paperback', 'books', 'seller2', '18.00', '14.00', 150, True),
    ('The Pragmatic Programmer', 'pragmatic-programmer-book', 'books', 'seller2', '45.00', None, 40, True),
]

REVIEW_COMMENTS = [
    'Excellent quality, exactly as described.',
    'Fast shipping and great packaging.',
    'Good value for money. Would buy again.',
    'Works perfectly. Very satisfied.',
    'Nice product but delivery took a while.',
    'Average experience — does the job.',
    'Outstanding! Exceeded my expectations.',
    'Solid build quality and premium feel.',
]

PROMOS = [
    ('SUMMER20', 'percentage', '20', True, None, None, 0, None),
    ('NEWUSER10', 'fixed', '10', True, None, None, 0, None),
    ('FLASH50', 'percentage', '50', True, None, timezone.now() + timedelta(days=7), 50, None),
]

# 100% Confirmed Working IDs
PRODUCT_IMAGE_MAPPING = {
    'samsung-galaxy-s24-ultra': ['1610945415295-d9bbf067e59c'],
    'macbook-pro-14-m3': ['1517336714731-489689fd1ca8'],
    'dell-xps-15': ['1593640408182-31c70c8268f5'],
    'lenovo-thinkpad-x1': ['1588872657578-7efd1f1555ed'],
    'airpods-pro-2': ['1606220588913-b3aacb4d2f46'],
    'anker-737-power-bank': ['1605464315542-bda3e2f4e605'],
    'smart-home-hub': ['1558089687-f282ffcbc126'],
    'coffee-machine-deluxe': ['1517668808822-9ebb02f2a0e6'],
    'ceramic-cookware-set': ['1584346062534-8c8194cf9833'],
    'air-fryer-6qt': ['1626200424590-f04bf4ce8f73'],
    'robot-vacuum-cleaner': ['1589831998595-580790802c0b'],
    'nike-running-shoes-air-zoom': ['1542291026-7eec264c27ff'],
    'adjustable-dumbbells-set': ['1584735935682-2f2b69dff9d2'],
    'classic-cotton-t-shirt': ['1521572163474-6864f9cf17ab'],
    'slim-fit-denim-jeans': ['1541099649105-f69ad21f3246'],
    'floral-summer-dress': ['1515372039744-b8f02a3ae446'],
    'hydrating-face-serum': ['1620916566398-39f1143ab7be'],
    'vitamin-c-moisturizer': ['1608248543803-ba4f8c70ae0b'],
    'matte-lipstick-set': ['1586495777744-4413f21062fa'],
    'atomic-habits-paperback': ['1544947950-fa07a98d237f'],
    'pragmatic-programmer-book': ['1532012197267-da84d127e765'],
}

def register_product_slug(slug: str) -> None:
    SEED_PRODUCT_SLUGS.add(slug)

SEED_PRODUCT_SLUGS.update(row[1] for row in PRODUCTS)

def make_product_image_file(slug: str, label: str, order: int) -> ContentFile:
    width, height = 800, 800
    photo_ids = PRODUCT_IMAGE_MAPPING.get(slug, ['1550751827-4bd374c3f58b'])
    photo_id = photo_ids[order] if order < len(photo_ids) else photo_ids[0]
    url = f"https://images.unsplash.com/photo-{photo_id}?w={width}&h={height}&fit=crop&auto=format"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            image_bytes = response.read()
            filename = f"{slug}-{order}.jpg"
            return ContentFile(image_bytes, name=filename)
    except Exception as e:
        # Fallback in case of temporary network outage
        img = Image.new('RGB', (width, height), (30, 41, 59))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(20, 20), (780, 780)], outline=(148, 163, 184), width=2)
        draw.text((40, 390), label[:28], fill=(248, 250, 252))
        buf = BytesIO()
        img.save(buf, format='JPEG', quality=85)
        return ContentFile(buf.getvalue(), name=f'{slug}-fallback.jpg')

def unique_tx_id(prefix: str, order_id: int, suffix: str = '') -> str:
    return f'seed_{prefix}_{order_id}_{suffix or uuid.uuid4().hex[:8]}'