from django.conf import settings
from django.contrib.auth import get_user_model

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import SellerProfile, UserAddress


User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['role'] = user.role
        token['user_id'] = str(user.id)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        if not self.user.is_verified:
            raise serializers.ValidationError(
                {"detail": "Please verify your email address before logging in."}
            )

        data['role'] = self.user.role
        data['user_id'] = str(self.user.id)
        return data

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    store_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'phone', 'role', 'password', 'password_confirm', 'store_name')

    def validate(self, attrs):
        role = attrs.get('role', 'customer')
        store_name = attrs.get('store_name')

        # 0. Normalize phone: convert empty string to None for unique constraint
        phone = attrs.get('phone')
        if not phone or phone.strip() == '':
            attrs['phone'] = None

        # 1. Password confirmation check
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})

        # 2. Only customer/seller may self-register
        if role not in ('customer', 'seller'):
            raise serializers.ValidationError(
                {"role": "Invalid role. Choose customer or seller."}
            )

        # 3. store_name logic based on role
        if role == 'seller':
            if not store_name or store_name.strip() == "":
                raise serializers.ValidationError({"store_name": "Store name is required for seller accounts."})
        else:
            # Clear store_name for non-sellers to ignore any input
            attrs['store_name'] = None
            
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        store_name = validated_data.pop('store_name', None)
        role = validated_data.get('role', 'customer')
        
        auto_verify = getattr(settings, 'REGISTER_AUTO_VERIFY', False)
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            phone=validated_data.get('phone'),
            role=role,
            is_verified=auto_verify,
        )

        # 3. Create or update SellerProfile for sellers
        # The post_save signal may have already created a SellerProfile with a default store_name,
        # so we use update_or_create to set the user-provided store_name without causing an IntegrityError.
        if role == 'seller' and store_name:
            SellerProfile.objects.update_or_create(
                user=user,
                defaults={'store_name': store_name}
            )
            
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    seller_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'phone', 'role', 'is_verified', 'created_at', 'seller_profile')
        read_only_fields = ('id', 'role', 'is_verified', 'created_at')

    def get_seller_profile(self, obj):
        if obj.role == 'seller' and hasattr(obj, 'seller_profile'):
            return {
                "id": obj.seller_profile.id,
                "store_name": obj.seller_profile.store_name,
                "description": obj.seller_profile.description,
                "is_approved": obj.seller_profile.is_approved,
                "balance": str(obj.seller_profile.balance)
            }
        return None

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'phone',
            'role',
            'is_active',
            'is_verified',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class SellerProfileSerializer(serializers.ModelSerializer):
    total_products = serializers.SerializerMethodField()
    total_sales = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    total_orders = serializers.SerializerMethodField()

    class Meta:
        model = SellerProfile
        fields = [
            'id', 'store_name', 'description', 'is_approved', 'balance',
            'total_products', 'total_sales', 'average_rating', 'total_orders'
        ]
        read_only_fields = ['id', 'is_approved', 'balance']

    def get_total_products(self, obj):
        return obj.products.count()

    def get_total_sales(self, obj):
        from orders.models import OrderItem
        from django.db.models import Sum
        return OrderItem.objects.filter(
            product__seller=obj,
            order__status='delivered'
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0

    def get_average_rating(self, obj):
        from django.db.models import Avg
        from products.models import ProductReview
        return ProductReview.objects.filter(product__seller=obj).aggregate(Avg('rating'))['rating__avg'] or 0.0

    def get_total_orders(self, obj):
        return obj.received_orders.count()


class UserAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAddress
        fields = ['id', 'street', 'city', 'country', 'postal_code', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']

