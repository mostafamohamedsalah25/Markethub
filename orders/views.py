from decimal import Decimal

from django.db import transaction
from rest_framework import generics, views, status, permissions
from rest_framework.response import Response

from products.models import Product
from promos.models import PromoCode
from orders.fulfillment import new_checkout_group_id
from promos.services import (
    allocate_order_totals,
    cart_subtotal,
    line_total_for_item,
    validate_promo_for_subtotal,
)

from .models import Cart, CartItem, Order, OrderItem
from .serializers import (
    CartSerializer, CartItemSerializer, OrderSerializer, CheckoutSerializer
)
from payments.models import Payment
from notifications.tasks import create_notification

class CartView(generics.RetrieveAPIView):
    serializer_class = CartSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        cart, _ = Cart.objects.prefetch_related(
            'items__product__seller',
            'items__product__category',
            'items__product__images',
            'applied_promo',
        ).get_or_create(user=self.request.user)
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

        cart = Cart.objects.select_for_update().filter(user=request.user).first()
        if cart is None:
            return Response({"error": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        items_qs = cart.items.select_related('product', 'product__seller').all()
        if not items_qs.exists():
            return Response({"error": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        shipping_address = serializer.validated_data['shipping_address']
        contact_phone = serializer.validated_data['contact_phone']

        subtotal = cart_subtotal(cart)
        if subtotal <= 0:
            return Response({"error": "Invalid cart total."}, status=status.HTTP_400_BAD_REQUEST)

        promo = None
        discount = Decimal('0')
        if cart.applied_promo_id:
            promo = PromoCode.objects.select_for_update().filter(pk=cart.applied_promo_id).first()
            if not promo:
                return Response({"error": "Applied promo is no longer available."}, status=status.HTTP_400_BAD_REQUEST)
            presult = validate_promo_for_subtotal(promo, subtotal)
            if not presult.valid:
                return Response({"error": presult.message}, status=status.HTTP_400_BAD_REQUEST)
            discount = presult.discount_amount

        seller_items = {}
        seller_raw = {}
        for item in items_qs:
            seller = item.product.seller
            seller_items.setdefault(seller, []).append(item)

        for seller, item_list in seller_items.items():
            seller_raw[seller] = sum(line_total_for_item(i) for i in item_list)

        raw_sum = sum(seller_raw.values(), start=Decimal('0')).quantize(Decimal('0.01'))
        if raw_sum != subtotal.quantize(Decimal('0.01')):
            return Response({"error": "Cart total mismatch."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_totals = allocate_order_totals(seller_raw, subtotal, discount)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        product_ids = {item.product_id for item in items_qs}
        locked_products = {
            p.id: p
            for p in Product.objects.select_for_update().filter(id__in=product_ids)
        }
        for item in items_qs:
            product = locked_products.get(item.product_id)
            if not product or product.stock < item.quantity:
                return Response(
                    {"error": f"Not enough stock for {item.product.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        checkout_group_id = new_checkout_group_id()
        orders_created = []

        for seller, items_list in seller_items.items():
            order_total = order_totals[seller]
            order = Order.objects.create(
                buyer=request.user,
                seller=seller,
                total_amount=order_total,
                shipping_address=shipping_address,
                contact_phone=contact_phone,
                status='pending',
                checkout_group_id=checkout_group_id,
                applied_promo=promo,
            )

            for item in items_list:
                price = item.product.discount_price if item.product.discount_price else item.product.price
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    price=price,
                    quantity=item.quantity,
                )

            orders_created.append(order)

        cart.applied_promo = None
        cart.save(update_fields=['applied_promo', 'updated_at'])
        cart.items.all().delete()

        orders_serializer = OrderSerializer(orders_created, many=True)
        return Response(orders_serializer.data, status=status.HTTP_201_CREATED)

class BuyerOrdersListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(buyer=self.request.user)
            .select_related('seller', 'buyer')
            .prefetch_related(
                'items__product__seller',
                'items__product__category',
                'items__product__images',
            )
            .order_by('-created_at')
        )

class SellerOrdersListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        base = Order.objects.select_related('seller', 'buyer').prefetch_related(
            'items__product__seller',
            'items__product__category',
            'items__product__images',
        )
        if self.request.user.role == 'admin':
            return base.order_by('-created_at')
        if self.request.user.role == 'seller' and hasattr(self.request.user, 'seller_profile'):
            return base.filter(seller=self.request.user.seller_profile).order_by('-created_at')
        return Order.objects.none()


class BuyerOrderCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        try:
            order = Order.objects.select_for_update().get(pk=pk, buyer=request.user)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'pending':
            return Response(
                {"error": "Only pending orders can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.payments.exclude(status__in=[Payment.STATUS_FAILED, Payment.STATUS_REFUNDED]).exists():
            return Response(
                {"error": "Orders with active or successful payments cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = 'cancelled'
        order.save(update_fields=['status', 'updated_at'])

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

class SellerOrderStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _seller_allowed_transition(self, current_status: str) -> set[str]:
        return {
            'pending': {'accepted'},
            'accepted': {'shipped'},
            'shipped': {'delivered'},
        }.get(current_status, set())

    @transaction.atomic
    def patch(self, request, pk):
        if request.user.role not in ('seller', 'admin'):
            return Response({"error": "Only sellers/admins can update orders."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            if request.user.role == 'admin':
                order = Order.objects.select_for_update().get(id=pk)
            else:
                order = Order.objects.select_for_update().get(id=pk, seller=request.user.seller_profile)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in Order.STATUS_CHOICES]
        
        if new_status not in valid_statuses:
            return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == 'seller':
            allowed = self._seller_allowed_transition(order.status)
            if new_status not in allowed:
                return Response(
                    {"error": f"Invalid transition from {order.status} to {new_status}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        order.status = new_status
        order.save()
        
        # Inform the buyer about the status change
        create_notification.delay(
            order.buyer.id,
            "Order Status Updated",
            f"Your order #{order.id} is now {new_status}.",
            'order_status_update'
        )

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)
