from rest_framework import serializers

from payments.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    buyer_email = serializers.SerializerMethodField()
    seller_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id',
            'order_id',
            'buyer_email',
            'seller_name',
            'provider',
            'status',
            'amount',
            'currency',
            'transaction_id',
            'client_secret',
            'checkout_url',
            'paid_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_buyer_email(self, obj):
        if obj.order_id and hasattr(obj.order, 'buyer') and obj.order.buyer_id:
            return obj.order.buyer.email
        return ''

    def get_seller_name(self, obj):
        if obj.order_id and hasattr(obj.order, 'seller') and obj.order.seller_id:
            return obj.order.seller.store_name
        return ''


class PaymentHistorySerializer(PaymentSerializer):
    class Meta(PaymentSerializer.Meta):
        fields = [f for f in PaymentSerializer.Meta.fields if f != 'client_secret']


class CreateIntentSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)
    provider = serializers.ChoiceField(
        choices=Payment.PROVIDER_CHOICES,
        required=False,
        default=Payment.PROVIDER_MOCK,
    )


class VerifyPaymentSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField(min_value=1)
    client_secret = serializers.CharField(max_length=512, required=False, allow_blank=True)
    session_id = serializers.CharField(max_length=256, required=False, allow_blank=True)
    simulate_outcome = serializers.ChoiceField(
        choices=['succeeded', 'failed', 'processing', 'pending', 'random'],
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        if not attrs.get('client_secret') and not attrs.get('session_id'):
            raise serializers.ValidationError(
                'Either client_secret or session_id is required.',
            )
        from django.conf import settings

        if attrs.get('simulate_outcome') and not settings.DEBUG:
            raise serializers.ValidationError(
                {'simulate_outcome': 'Simulation is only available in debug mode.'}
            )
        return attrs


class SimulateWebhookSerializer(serializers.Serializer):
    transaction_id = serializers.CharField(max_length=196)
    event = serializers.CharField(max_length=64)
