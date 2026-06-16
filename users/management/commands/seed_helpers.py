"""Shared helpers and catalog definitions for seed_data management command."""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont
import urllib.request
import urllib.parse

SEED_MARKER = 'markethub-seed'
SEED_PRODUCT_SLUGS: set[str] = set()

TEST_USERS = {
    'admin@example.com': {
        'password': 'Admin123!',
        'role': 'admin',
        'is_staff': True,
        'is_superuser': True,
    },
    'seller1@example.com': {
        'password': 'Seller123!',
        'role': 'seller',
        'store_name': 'TechVault Electronics',
        'description': 'Premium gadgets, laptops, and smart home gear.',
        'balance': Decimal('12500.00'),
        'is_approved': True,
    },
    'seller2@example.com': {
        'password': 'Seller123!',
        'role': 'seller',
        'store_name': 'StyleHub Fashion',
        'description': 'Trend-forward apparel, footwear, and accessories.',
        'balance': Decimal('8320.50'),
        'is_approved': True,
    },
    'customer@example.com': {
        'password': 'Customer123!',
        'role': 'customer',
    },
    'customer2@example.com': {
        'password': 'Customer123!',
        'role': 'customer',
    },
    'customer3@example.com': {
        'password': 'Customer123!',
        'role': 'customer',
    },
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
    ('iPhone 15 Pro', 'iphone-15-pro', 'phones', 'seller1', '1199.00', '1099.00', 25, True),
    ('Samsung Galaxy S24 Ultra', 'samsung-galaxy-s24-ultra', 'phones', 'seller1', '1299.00', None, 18, True),
    ('Google Pixel 8', 'google-pixel-8', 'phones', 'seller1', '699.00', '649.00', 30, True),
    ('MacBook Pro 14 M3', 'macbook-pro-14-m3', 'laptops', 'seller1', '1999.00', None, 12, True),
    ('Dell XPS 15', 'dell-xps-15', 'laptops', 'seller1', '1599.00', '1449.00', 15, True),
    ('Lenovo ThinkPad X1 Carbon', 'lenovo-thinkpad-x1', 'laptops', 'seller1', '1399.00', None, 10, True),
    ('AirPods Pro 2', 'airpods-pro-2', 'accessories', 'seller1', '249.00', '219.00', 80, True),
    ('Anker 737 Power Bank', 'anker-737-power-bank', 'accessories', 'seller1', '149.00', None, 55, True),
    ('Logitech MX Master 3S', 'logitech-mx-master-3s', 'accessories', 'seller1', '99.00', '89.00', 60, True),
    ('Smart Watch Series 9', 'smart-watch-series-9', 'accessories', 'seller1', '399.00', '349.00', 40, True),
    ('4K Webcam Pro', '4k-webcam-pro', 'accessories', 'seller1', '89.00', None, 45, True),
    ('Portable SSD 2TB', 'portable-ssd-2tb', 'accessories', 'seller1', '179.00', '159.00', 35, True),
    ('Smart Home Hub', 'smart-home-hub', 'electronics', 'seller1', '129.00', None, 22, True),
    ('Coffee Machine Deluxe', 'coffee-machine-deluxe', 'home-kitchen', 'seller1', '299.00', '249.00', 20, True),
    ('Gaming Mechanical Keyboard', 'gaming-mechanical-keyboard', 'gaming', 'seller1', '149.00', '129.00', 50, True),
    ('Wireless Gaming Mouse', 'wireless-gaming-mouse', 'gaming', 'seller1', '79.00', None, 70, True),
    ('PlayStation 5 Slim', 'playstation-5-slim', 'gaming', 'seller1', '499.00', None, 8, True),
    ('Xbox Wireless Controller', 'xbox-wireless-controller', 'gaming', 'seller1', '59.00', '49.00', 90, True),
    ('Nike Running Shoes Air Zoom', 'nike-running-shoes-air-zoom', 'sports', 'seller2', '129.00', '99.00', 40, True),
    ('Yoga Mat Premium', 'yoga-mat-premium', 'sports', 'seller2', '45.00', None, 100, True),
    ('Adjustable Dumbbells Set', 'adjustable-dumbbells-set', 'sports', 'seller2', '349.00', '299.00', 15, True),
    ('Classic Cotton T-Shirt', 'classic-cotton-t-shirt', 'mens-clothing', 'seller2', '29.00', '24.00', 200, True),
    ('Slim Fit Denim Jeans', 'slim-fit-denim-jeans', 'mens-clothing', 'seller2', '79.00', None, 85, True),
    ('Wool Blend Overcoat', 'wool-blend-overcoat', 'mens-clothing', 'seller2', '189.00', '159.00', 25, True),
    ('Floral Summer Dress', 'floral-summer-dress', 'womens-clothing', 'seller2', '69.00', '59.00', 60, True),
    ('Leather Crossbody Bag', 'leather-crossbody-bag', 'womens-clothing', 'seller2', '120.00', None, 35, True),
    ('Silk Scarf Collection', 'silk-scarf-collection', 'womens-clothing', 'seller2', '55.00', '45.00', 50, True),
    ('Hydrating Face Serum', 'hydrating-face-serum', 'beauty', 'seller2', '42.00', '35.00', 75, True),
    ('Vitamin C Moisturizer', 'vitamin-c-moisturizer', 'beauty', 'seller2', '38.00', None, 80, True),
    ('Matte Lipstick Set', 'matte-lipstick-set', 'beauty', 'seller2', '28.00', '22.00', 120, True),
    ('Ceramic Non-Stick Cookware Set', 'ceramic-cookware-set', 'home-kitchen', 'seller1', '159.00', '139.00', 30, True),
    ('Air Fryer 6QT', 'air-fryer-6qt', 'home-kitchen', 'seller1', '89.00', None, 45, True),
    ('Robot Vacuum Cleaner', 'robot-vacuum-cleaner', 'home-kitchen', 'seller1', '399.00', '349.00', 18, True),
    ('Atomic Habits — Paperback', 'atomic-habits-paperback', 'books', 'seller2', '18.00', '14.00', 150, True),
    ('The Pragmatic Programmer', 'pragmatic-programmer-book', 'books', 'seller2', '45.00', None, 40, True),
    ('Python Crash Course 3rd Ed', 'python-crash-course', 'books', 'seller2', '39.00', '34.00', 55, True),
    ('Discontinued Smart Speaker', 'discontinued-smart-speaker', 'electronics', 'seller1', '79.00', None, 0, False),
    ('Vintage Film Camera', 'vintage-film-camera', 'accessories', 'seller1', '199.00', None, 5, False),
    ('Limited Edition Sneakers', 'limited-edition-sneakers', 'sports', 'seller2', '220.00', '199.00', 3, True),
    ('Bluetooth Noise-Canceling Headphones', 'bluetooth-nc-headphones', 'accessories', 'seller1', '199.00', '169.00', 42, True),
    ('USB-C Hub 7-in-1', 'usb-c-hub-7-in-1', 'accessories', 'seller1', '49.00', None, 95, True),
    ('Standing Desk Converter', 'standing-desk-converter', 'home-kitchen', 'seller1', '199.00', '179.00', 22, True),
    ('Linen Bed Sheet Set', 'linen-bed-sheet-set', 'home-kitchen', 'seller2', '89.00', '75.00', 38, True),
    ('Trail Running Backpack', 'trail-running-backpack', 'sports', 'seller2', '65.00', None, 48, True),
]

REVIEW_COMMENTS = [
    'Excellent quality, exactly as described.',
    'Fast shipping and great packaging.',
    'Good value for money. Would buy again.',
    'Works perfectly. Very satisfied.',
    'Nice product but delivery took a while.',
    'Average experience — does the job.',
    'Not what I expected, but acceptable.',
    'Outstanding! Exceeded my expectations.',
    'Solid build quality and premium feel.',
    'Perfect gift — recipient loved it.',
]

PROMOS = [
    ('SUMMER20', 'percentage', '20', True, None, None, 0, None),
    ('NEWUSER10', 'fixed', '10', True, None, None, 0, None),
    ('FLASH50', 'percentage', '50', True, None, timezone.now() + timedelta(days=7), 50, None),
    ('SAVE15', 'percentage', '15', True, timezone.now() - timedelta(days=30), timezone.now() + timedelta(days=60), 0, None),
    ('MIN100', 'fixed', '25', True, None, None, Decimal('100'), None),
    ('EXPIRED99', 'percentage', '99', True, None, timezone.now() - timedelta(days=30), 0, None),
    ('OLDCODE', 'fixed', '5', False, None, None, 0, None),
]


def register_product_slug(slug: str) -> None:
    SEED_PRODUCT_SLUGS.add(slug)


SEED_PRODUCT_SLUGS.update(row[1] for row in PRODUCTS)


def _generate_fallback_image(slug: str, label: str, color_index: int) -> ContentFile:
    """Fallback: توليد صورة أوفلاين بألوان داكنة أنيقة تتماشى مع التصميم الجديد في حال انقطاع الإنترنت"""
    IMAGE_COLORS = [
        (15, 23, 42),  # Dark Slate
        (30, 41, 59),  # Charcoal
        (17, 24, 39),  # Gray 900
        (3, 7, 18),  # Gray 950
    ]
    color = IMAGE_COLORS[color_index % len(IMAGE_COLORS)]
    img = Image.new('RGB', (800, 800), color)
    draw = ImageDraw.Draw(img)
    text = label[:28]

    # رسم إطار أنيق
    draw.rectangle([(20, 20), (780, 780)], outline=(148, 163, 184), width=2)
    # كتابة النص في المنتصف (تقريبياً)
    draw.text((40, 390), text, fill=(248, 250, 252))

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=85)
    filename = f'{slug}-{color_index}-fallback.jpg'
    return ContentFile(buf.getvalue(), name=filename)


def make_product_image_file(slug: str, label: str, order: int) -> ContentFile:
    """
    جلب صورة فوتوغرافية عالية الجودة من الإنترنت باستخدام خدمة مجانية ومستقرة.
    """
    width, height = 800, 800

    # استخدام خدمة Picsum المجانية (ستقوم بتوليد صورة فوتوغرافية ثابتة بناءً على الـ slug)
    url = f"https://picsum.photos/seed/{slug}{order}/{width}/{height}"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            image_bytes = response.read()
            filename = f"{slug}-{order}.jpg"
            return ContentFile(image_bytes, name=filename)

    except Exception as e:
        print(f"\n  [Network Warning] Could not fetch real image for '{label}' ({e}). Using offline fallback.")
        return _generate_fallback_image(slug, label, order)

def unique_tx_id(prefix: str, order_id: int, suffix: str = '') -> str:
    return f'seed_{prefix}_{order_id}_{suffix or uuid.uuid4().hex[:8]}'