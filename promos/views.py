from rest_framework import generics, permissions, status, views

from orders.models import Cart
from orders.serializers import CartSerializer
from promos.models import PromoCode
from promos.serializers import (
    PromoApplyRequestSerializer,
    PromoCodeSerializer,
    PromoValidateRequestSerializer,
    serialize_promo_validation_result,
)
from promos.services import cart_subtotal, validate_promo_for_subtotal
from users.mixins import ApiResponseMixin
from users.permissions import IsAdmin


def _get_cart_for_user(user):
    cart, _ = Cart.objects.select_related('applied_promo').prefetch_related(
        'items__product__seller',
        'items__product__category',
        'items__product__images',
    ).get_or_create(user=user)
    return cart


class PromoValidateView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = PromoValidateRequestSerializer(data=request.data)
        if not ser.is_valid():
            return self.error_response(message='Validation failed.', data=ser.errors)

        cart = _get_cart_for_user(request.user)
        if not cart.items.exists():
            return self.error_response(message='Cart is empty.')

        subtotal = cart_subtotal(cart)
        promo = PromoCode.objects.filter(code=ser.validated_data['code']).first()
        result = validate_promo_for_subtotal(promo, subtotal)
        return self.success_response(
            data=serialize_promo_validation_result(result),
            message=result.message,
        )


class PromoApplyView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = PromoApplyRequestSerializer(data=request.data)
        if not ser.is_valid():
            return self.error_response(message='Validation failed.', data=ser.errors)

        cart = _get_cart_for_user(request.user)
        if not cart.items.exists():
            return self.error_response(message='Cart is empty.')

        subtotal = cart_subtotal(cart)
        promo = PromoCode.objects.filter(code=ser.validated_data['code']).first()
        result = validate_promo_for_subtotal(promo, subtotal)
        if not result.valid:
            return self.error_response(
                message=result.message,
                data=serialize_promo_validation_result(result),
            )

        cart.applied_promo = promo
        cart.save(update_fields=['applied_promo', 'updated_at'])
        return self.success_response(
            data=serialize_promo_validation_result(result),
            message='Promo code applied to your cart.',
        )


class PromoRemoveView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        cart = _get_cart_for_user(request.user)
        if cart.applied_promo_id is not None:
            cart.applied_promo = None
            cart.save(update_fields=['applied_promo', 'updated_at'])
        return self.success_response(
            data=CartSerializer(cart).data,
            message='Promo code removed from your cart.',
        )


class AdminPromoListCreateView(ApiResponseMixin, generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = PromoCode.objects.all()
    serializer_class = PromoCodeSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return self.success_response(data={'results': response.data}, message='OK')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return self.success_response(
                data=serializer.data,
                message='Promo created.',
                status_code=status.HTTP_201_CREATED,
            )
        return self.error_response(message='Create failed.', data=serializer.errors)


class AdminPromoDetailView(ApiResponseMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = PromoCode.objects.all()
    serializer_class = PromoCodeSerializer
    lookup_field = 'pk'

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
            return self.success_response(data=serializer.data, message='Promo updated.')
        return self.error_response(message='Update failed.', data=serializer.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response(message='Promo deleted.')
