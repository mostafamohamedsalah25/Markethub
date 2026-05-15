from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from django.db import transaction
from .models import Cart, CartItem, Order, OrderItem
from .serializers import (
    CartSerializer, CartItemSerializer, OrderSerializer, CheckoutSerializer
)
from products.models import Product

class CartView(generics.RetrieveAPIView):
    serializer_class = CartSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        cart, created = Cart.objects.get_or_create(user=self.request.user)
        return cart

class CartItemCreateUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        product_id = request.data.get('product')
        quantity = int(request.data.get('quantity', 1))

        if quantity <= 0:
            return Response({"error": "Quantity must be positive."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        if product.stock < quantity:
            return Response({"error": "Not enough stock."}, status=status.HTTP_400_BAD_REQUEST)

        cart_item, created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not created:
            cart_item.quantity += quantity
            if cart_item.quantity > product.stock:
                return Response({"error": "Not enough stock for total quantity."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            cart_item.quantity = quantity
        
        cart_item.save()
        serializer = CartSerializer(cart)
        return Response(serializer.data, status=status.HTTP_200_OK)

class CartItemDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = CartItem.objects.all()

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user)

class CartItemUpdateQuantityView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartItemSerializer

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        quantity = request.data.get('quantity')
        if quantity is not None:
            quantity = int(quantity)
            if quantity <= 0:
                instance.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            
            if quantity > instance.product.stock:
                return Response({"error": "Not enough stock."}, status=status.HTTP_400_BAD_REQUEST)
                
            instance.quantity = quantity
            instance.save()
            return Response(CartItemSerializer(instance).data)
        return Response({"error": "Quantity not provided."}, status=status.HTTP_400_BAD_REQUEST)

class CheckoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response({"error": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        items = cart.items.all()
        if not items.exists():
            return Response({"error": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        shipping_address = serializer.validated_data['shipping_address']
        contact_phone = serializer.validated_data['contact_phone']

        # Group items by seller
        seller_items = {}
        for item in items:
            seller = item.product.seller
            if seller not in seller_items:
                seller_items[seller] = []
            seller_items[seller].append(item)

        orders_created = []

        for seller, items_list in seller_items.items():
            total_amount = sum(
                item.quantity * (item.product.discount_price if item.product.discount_price else item.product.price)
                for item in items_list
            )

            order = Order.objects.create(
                buyer=request.user,
                seller=seller,
                total_amount=total_amount,
                shipping_address=shipping_address,
                contact_phone=contact_phone,
                status='pending'
            )

            for item in items_list:
                price = item.product.discount_price if item.product.discount_price else item.product.price
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    price=price,
                    quantity=item.quantity
                )
                # Decrease stock
                item.product.stock -= item.quantity
                item.product.save()

            orders_created.append(order)

        # Clear cart
        cart.items.all().delete()

        orders_serializer = OrderSerializer(orders_created, many=True)
        return Response(orders_serializer.data, status=status.HTTP_201_CREATED)

class BuyerOrdersListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).order_by('-created_at')

class SellerOrdersListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admin sees ALL orders
        if self.request.user.role == 'admin':
            return Order.objects.all().order_by('-created_at')
        if self.request.user.role == 'seller' and hasattr(self.request.user, 'seller_profile'):
            return Order.objects.filter(seller=self.request.user.seller_profile).order_by('-created_at')
        return Order.objects.none()

class SellerOrderStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role not in ('seller', 'admin'):
            return Response({"error": "Only sellers/admins can update orders."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            if request.user.role == 'admin':
                order = Order.objects.get(id=pk)
            else:
                order = Order.objects.get(id=pk, seller=request.user.seller_profile)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in Order.STATUS_CHOICES]
        
        if new_status not in valid_statuses:
            return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        order.status = new_status
        order.save()
        
        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)
