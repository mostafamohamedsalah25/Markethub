from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Product
from .serializers import ProductSerializer
from .permissions import IsSellerOwnerOrAdmin


class SellerProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsSellerOwnerOrAdmin]
    lookup_field = 'slug'

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Product.objects.prefetch_related('images').order_by('-created_at')
        if not hasattr(user, 'seller_profile'):
            return Product.objects.none()
        return Product.objects.filter(seller=user.seller_profile).prefetch_related('images').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save()


class SellerDashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'seller_profile'):
            return Response({"detail": "User is not a seller."}, status=status.HTTP_403_FORBIDDEN)

        seller = user.seller_profile
        stats = Product.objects.filter(seller=seller).aggregate(
            total_products=Count('id'),
            active_products=Count('id', filter=Q(is_active=True)),
            out_of_stock=Count('id', filter=Q(stock=0))
        )

        return Response({
            "store_name": seller.store_name,
            "balance": str(seller.balance),
            "is_approved": seller.is_approved,
            "stats": stats
        }, status=status.HTTP_200_OK)