from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem
from products.models import Product
from products.serializers import ProductSerializer

class CartItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)
    
    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_details', 'quantity']
        read_only_fields = ['id', 'product_details']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'created_at']

    def get_total_price(self, obj):
        total = sum(
            item.quantity * (item.product.discount_price if item.product.discount_price else item.product.price)
            for item in obj.items.all()
        )
        return str(total)

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_details', 'product_name', 'price', 'quantity']
        read_only_fields = ['id', 'product_details', 'product_name', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source='seller.store_name', read_only=True)
    buyer_email = serializers.CharField(source='buyer.email', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'seller', 'seller_name', 'buyer_email', 'status', 'total_amount',
            'shipping_address', 'contact_phone', 'created_at', 'items'
        ]
        read_only_fields = ['id', 'seller', 'seller_name', 'buyer_email', 'total_amount', 'created_at', 'items']

class CheckoutSerializer(serializers.Serializer):
    shipping_address = serializers.CharField(required=True)
    contact_phone = serializers.CharField(required=True)
