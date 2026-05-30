from rest_framework import viewsets, filters, status, serializers
from rest_framework.response import Response
from django.db.models import QuerySet, Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product, ProductReview, WishlistItem
from .serializers import CategorySerializer, ProductSerializer, ProductReviewSerializer, WishlistItemSerializer
from .permissions import IsAdminOrReadOnly, IsSellerOwnerOrAdmin, IsOwnerOrReadOnly
from .filters import ProductFilter
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from orders.models import OrderItem

# Create your views here.
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by(
        '-created_at'
    )
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'slug'

    def get_queryset(self) -> QuerySet[Category]:
        return super().get_queryset().prefetch_related('subcategories')

class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsSellerOwnerOrAdmin]
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = ProductFilter
    ordering_fields = ['price', 'created_at']

    def get_queryset(self) -> QuerySet[Product]:
        queryset = Product.objects.select_related('seller','category').prefetch_related('images').filter(is_active=True)

        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({"message": "Product deactivated successfully."}, status=status.HTTP_204_NO_CONTENT)


class ProductReviewViewSet(viewsets.ModelViewSet):
    queryset = ProductReview.objects.all()
    serializer_class = ProductReviewSerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsOwnerOrReadOnly()]
        return [IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        product_id = self.request.data.get('product')
        user = self.request.user
        
        # Check if user has already reviewed this product
        if ProductReview.objects.filter(product_id=product_id, user=user).exists():
            raise serializers.ValidationError("You have already reviewed this product.")

        # Check for verified purchase
        has_purchased = OrderItem.objects.filter(
            order__buyer=user,
            product_id=product_id,
            order__status='delivered'
        ).exists()
        
        if not has_purchased:
            raise serializers.ValidationError("You can only review products you have purchased and received.")

        instance = serializer.save(user=user)
        instance.product.update_rating()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.product.update_rating()

    def perform_destroy(self, instance):
        product = instance.product
        instance.delete()
        product.update_rating()


class WishlistItemViewSet(viewsets.ModelViewSet):
    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

