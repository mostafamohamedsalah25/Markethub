from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, 
    LoginView, 
    LogoutView, 
    UserMeView, 
    VerifyEmailView, 
    ResendVerificationView,
    AdminUserListView,
    AdminUserActivateView,
    GoogleLoginView,
    SellerProfileViewSet
)

router = DefaultRouter()
router.register(r'seller-profiles', SellerProfileViewSet, basename='seller-profile')

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', UserMeView.as_view(), name='me'),
    path('auth/verify-email/<str:token>/', VerifyEmailView.as_view(), name='verify_email'),
    path('auth/resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    
    # Admin
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<uuid:id>/activate/', AdminUserActivateView.as_view(), name='admin_user_activate'),
    
    # Profiles
    path('', include(router.urls)),
]
