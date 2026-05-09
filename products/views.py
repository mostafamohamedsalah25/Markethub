from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from django.db.models import QuerySet, Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer
from .permissions import IsAdminOrReadOnly, IsSellerOwnerOrAdmin
from .filters import ProductFilter

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

