from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import Category, Product, ProductImage, ProductReview, WishlistItem
from orders.models import OrderItem

class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        validators=[UniqueValidator(queryset=Category.objects.all(), message="Category with this name already exists.")]
    )
    slug = serializers.SlugField(
        max_length=120,
        validators=[UniqueValidator(queryset=Category.objects.all(), message="Category with this slug already exists.")]
    )
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'parent', 'image', 'subcategories', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_subcategories(self, obj: Category) -> list[dict]:
        serializer = self.__class__(obj.subcategories.all(), many=True)
        return serializer.data

    def validate_parent(self, value: Category | None) -> Category | None:
        if value and self.instance and value.id == self.instance.id:
            raise serializers.ValidationError("A category cannot be its own parent.")
        return value


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary', 'order']


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )
    slug = serializers.SlugField(
        max_length=220,
        validators=[UniqueValidator(queryset=Product.objects.all(), message="Product with this slug already exists.")]
    )

    class Meta:
        model = Product
        fields = [
            'id', 'seller', 'category', 'name', 'slug', 'description',
            'price', 'discount_price', 'stock', 'is_active',
            'images', 'uploaded_images', 'average_rating', 'review_count', 'created_at'
        ]
        read_only_fields = ['id', 'seller', 'average_rating', 'review_count', 'created_at']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value

    def validate(self, attrs):
        price = attrs.get('price', getattr(self.instance, 'price', 0))
        discount_price = attrs.get('discount_price', getattr(self.instance, 'discount_price', None))

        if discount_price is not None and discount_price >= price:
            raise serializers.ValidationError({"discount_price": "Discount price must be less than the actual price."})
        return attrs

    def create(self, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        user = self.context['request'].user
        
        if not hasattr(user, 'seller_profile'):
            from users.models import SellerProfile
            SellerProfile.objects.create(user=user, store_name=f"{user.role.capitalize()} Store")
            
        seller_profile = user.seller_profile
        # FormData may send is_active as empty string → False; always publish new products
        validated_data['is_active'] = True
        product = Product.objects.create(seller=seller_profile, **validated_data)

        for index, image in enumerate(uploaded_images):
            ProductImage.objects.create(
                product=product,
                image=image,
                is_primary=(index == 0),
                order=index
            )
        return product


class ProductReviewSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    is_verified_purchase = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = ['id', 'product', 'user', 'user_email', 'rating', 'comment', 'is_verified_purchase', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_is_verified_purchase(self, obj):
        return OrderItem.objects.filter(
            order__buyer=obj.user,
            product=obj.product,
            order__status='delivered'
        ).exists()


class WishlistItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'product', 'product_details', 'created_at']
        read_only_fields = ['id', 'created_at']