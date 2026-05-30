from django.urls import path, include
from rest_framework import routers
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, ProductReviewViewSet, WishlistItemViewSet
from .seller_views import SellerProductViewSet, SellerDashboardStatsView

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'reviews', ProductReviewViewSet, basename='review')
router.register(r'wishlist', WishlistItemViewSet, basename='wishlist')

seller_router = routers.DefaultRouter()
seller_router.register(r'my-products', SellerProductViewSet, basename='seller-product')

urlpatterns = [
    path('', include(router.urls)),

    path('seller/stats/', SellerDashboardStatsView.as_view(), name='seller-stats'),
    path('seller/', include(seller_router.urls)),
]