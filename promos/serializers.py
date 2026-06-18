from decimal import Decimal
import re

from django.core.validators import RegexValidator
from rest_framework import serializers

from promos.models import PromoCode
from promos.services import PromoValidationResult


PROMO_CODE_VALIDATOR = RegexValidator(
    regex=r'^[A-Z0-9]+$',
    flags=re.IGNORECASE,
    message='Code must contain only alphanumeric characters.',
)


class PromoValidationResultSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    code = serializers.CharField(allow_blank=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    message = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_after_discount = serializers.DecimalField(max_digits=12, decimal_places=2)


def serialize_promo_validation_result(result: PromoValidationResult) -> dict:
    seria = PromoValidationResultSerializer(
        data={
            'valid': result.valid,
            'code': result.code,
            'discount_amount': result.discount_amount,
            'message': result.message,
            'subtotal': result.subtotal,
            'total_after_discount': result.total_after_discount,
        }
    )
    seria.is_valid(raise_exception=True)
    return seria.data


class PromoCodeSerializer(serializers.ModelSerializer):
    code = serializers.CharField(
        max_length=64,
        validators=[PROMO_CODE_VALIDATOR],
    )

    class Meta:
        model = PromoCode
        fields = [
            'id',
            'code',
            'discount_type',
            'value',
            'is_active',
            'max_uses',
            'used_count',
            'starts_at',
            'expires_at',
            'minimum_order_amount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('id', 'used_count', 'created_at', 'updated_at')

    def validate_code(self, value: str) -> str:
        v = (value or '').strip().upper()
        if not v:
            raise serializers.ValidationError('Code cannot be empty.')
        PROMO_CODE_VALIDATOR(v)
        return v

    def validate_value(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError('Value must be greater than zero.')
        return value

    def validate(self, attrs):
        dtype = attrs.get('discount_type') or getattr(self.instance, 'discount_type', None)
        val = attrs.get('value')
        if (
            dtype == PromoCode.DISCOUNT_PERCENTAGE
            and val is not None
            and val > Decimal('100')
        ):
            raise serializers.ValidationError({'value': 'Percentage cannot exceed 100.'})
        return attrs


class PromoValidateRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=64, validators=[PROMO_CODE_VALIDATOR])

    def validate_code(self, value: str) -> str:
        v = (value or '').strip().upper()
        if not v:
            raise serializers.ValidationError('Code cannot be empty.')
        PROMO_CODE_VALIDATOR(v)
        return v


class PromoApplyRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=64, validators=[PROMO_CODE_VALIDATOR])

    def validate_code(self, value: str) -> str:
        v = (value or '').strip().upper()
        if not v:
            raise serializers.ValidationError('Code cannot be empty.')
        PROMO_CODE_VALIDATOR(v)
        return v
