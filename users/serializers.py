from django.contrib.auth import get_user_model

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import SellerProfile

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

        # 2. store_name logic based on role
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
        
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            phone=validated_data.get('phone'),
            role=role,
            is_verified=True # Auto-verify for easy testing
        )

        # 3. Create SellerProfile only for sellers
        if role == 'seller' and store_name:
            SellerProfile.objects.create(user=user, store_name=store_name)
            
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
                "store_name": obj.seller_profile.store_name,
                "description": obj.seller_profile.description,
                "is_approved": obj.seller_profile.is_approved,
                "balance": str(obj.seller_profile.balance)
            }
        return None

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
