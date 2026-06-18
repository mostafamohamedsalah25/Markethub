from django.urls import path
from .views import (
    CartView, CartItemCreateUpdateView, CartItemDeleteView, CartItemUpdateQuantityView,
    CheckoutView, BuyerOrdersListView, SellerOrdersListView, SellerOrderStatusUpdateView,
    BuyerOrderCancelView,
)

urlpatterns = [
    path('cart/', CartView.as_view(), name='cart-detail'),
    path('cart/items/', CartItemCreateUpdateView.as_view(), name='cart-item-add'),
    path('cart/items/<int:pk>/', CartItemDeleteView.as_view(), name='cart-item-delete'),
    path('cart/items/<int:pk>/quantity/', CartItemUpdateQuantityView.as_view(), name='cart-item-update'),
    
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    
    path('my-orders/', BuyerOrdersListView.as_view(), name='buyer-orders'),
    path('my-orders/<int:pk>/cancel/', BuyerOrderCancelView.as_view(), name='buyer-order-cancel'),
    path('seller-orders/', SellerOrdersListView.as_view(), name='seller-orders'),
    path('seller-orders/<int:pk>/status/', SellerOrderStatusUpdateView.as_view(), name='seller-order-status-update'),
]
