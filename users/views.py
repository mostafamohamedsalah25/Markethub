from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from rest_framework import status, generics, permissions, views, viewsets
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .serializers import (
    RegisterSerializer, 
    CustomTokenObtainPairSerializer, 
    UserProfileSerializer,
    AdminUserSerializer,
    SellerProfileSerializer
)
from .permissions import IsAdmin
from .tasks import send_verification_email
from .mixins import ApiResponseMixin

from .models import SellerProfile

User = get_user_model()

class RegisterView(ApiResponseMixin, generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Send verification email via Celery
            send_verification_email(user.id, user.email)
            
            return self.success_response(
                data=serializer.data,
                message="User registered successfully. Please verify your email.",
                status_code=status.HTTP_201_CREATED
            )
        return self.error_response(message="Registration failed", data=serializer.errors)

class LoginView(ApiResponseMixin, TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            user = User.objects.get(email=request.data.get('email'))
            return self.success_response(
                data={
                    'access': response.data.get('access'),
                    'refresh': response.data.get('refresh'),
                    'user': {
                        'email': user.email,
                        'role': user.role,
                    }
                },
                message="Login successful"
            )
        return response

class LogoutView(ApiResponseMixin, views.APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return self.success_response(message="Logged out successfully")
        except Exception as e:
            return self.error_response(message="Invalid token or already logged out")

class UserMeView(ApiResponseMixin, generics.RetrieveUpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response(data=serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return self.success_response(data=serializer.data, message="Profile updated successfully")
        return self.error_response(message="Update failed", data=serializer.errors)

class VerifyEmailView(ApiResponseMixin, views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        try:
            signer = TimestampSigner()
            user_id = signer.unsign(token, max_age=86400) # 24h
            user = User.objects.get(id=user_id)
            if not user.is_verified:
                user.is_verified = True
                user.save()
                return self.success_response(message="Email verified successfully")
            return self.success_response(message="Email already verified")
        except SignatureExpired:
            return self.error_response(message="Verification link expired")
        except (BadSignature, User.DoesNotExist):
            return self.error_response(message="Invalid verification link")

class ResendVerificationView(ApiResponseMixin, views.APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return self.error_response(message="Email is required")
        
        try:
            user = User.objects.get(email=email)
            if user.is_verified:
                return self.success_response(message="Email already verified")
            
            send_verification_email(user.id, user.email)
            return self.success_response(message="Verification email sent")
        except User.DoesNotExist:
            # Don't reveal if user exists or not for security, but here we can just say sent
            return self.success_response(message="If an account exists with this email, a verification link has been sent.")

# Admin Views
class AdminUserListView(ApiResponseMixin, generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = (IsAdmin,)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(data=serializer.data)

class AdminUserActivateView(ApiResponseMixin, views.APIView):
    permission_classes = (IsAdmin,)

    def patch(self, request, id):
        try:
            user = User.objects.get(id=id)
            is_active = request.data.get('is_active', True)
            user.is_active = is_active
            user.save()
            status_msg = "activated" if is_active else "deactivated"
            return self.success_response(message=f"User {status_msg} successfully")
        except User.DoesNotExist:
            return self.error_response(message="User not found", status_code=status.HTTP_404_NOT_FOUND)

class GoogleLoginView(ApiResponseMixin, views.APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        # Support both 'token' and 'id_token' keys for flexibility
        token = request.data.get('token') or request.data.get('id_token')
        if not token:
            return self.error_response(message="Google token is required")

        try:
            # Verify the ID token
            idinfo = id_token.verify_oauth2_token(
                token, 
                google_requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')

            email = idinfo['email']
            
            # Get or create user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'role': 'customer',
                    'is_verified': True, # Google emails are already verified
                }
            )

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return self.success_response(data={
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'email': user.email,
                    'role': user.role,
                    'is_new': created
                }
            }, message="Google login successful")

        except ValueError as e:
            return self.error_response(message=f"Invalid Google token: {str(e)}")
        except Exception as e:
            return self.error_response(message=f"Google authentication failed: {str(e)}")


class SellerProfileViewSet(ApiResponseMixin, viewsets.ModelViewSet):
    queryset = SellerProfile.objects.all()
    serializer_class = SellerProfileSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response(data=serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return self.error_response(message="You do not have permission to update this profile", status_code=status.HTTP_403_FORBIDDEN)
        
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return self.success_response(data=serializer.data, message="Seller profile updated successfully")
        return self.error_response(message="Update failed", data=serializer.errors)
