import stripe
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, views
from payments.models import Payment
from payments.providers import get_payment_provider

from payments.serializers import (
    CreateIntentSerializer,
    PaymentHistorySerializer,
    PaymentSerializer,
    SimulateWebhookSerializer,
    VerifyPaymentSerializer,
)
from payments.services import (
    PaymentServiceError,
    apply_webhook_event,
    create_payment_intent,
    list_payments_for_account,
    verify_payment,
)
from users.mixins import ApiResponseMixin


class PaymentCreateIntentView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = CreateIntentSerializer(data=request.data)
        if not ser.is_valid():
            return self.error_response(message='Validation failed.', data=ser.errors)

        try:
            payment = create_payment_intent(
                user=request.user,
                order_id=ser.validated_data['order_id'],
                provider_name=ser.validated_data.get('provider'),
            )
        except PaymentServiceError as e:
            code = status.HTTP_404_NOT_FOUND if e.code == 'not_found' else status.HTTP_400_BAD_REQUEST
            return self.error_response(message=e.message, data={'code': e.code}, status_code=code)
        except ValueError as e:
            return self.error_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)

        return self.success_response(
            data=PaymentSerializer(payment).data,
            message='Payment intent created.',
            status_code=status.HTTP_201_CREATED,
        )


class PaymentVerifyView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = VerifyPaymentSerializer(data=request.data)
        if not ser.is_valid():
            return self.error_response(message='Validation failed.', data=ser.errors)

        client_secret = ser.validated_data.get('client_secret') or ''
        if ser.validated_data.get('session_id'):
            client_secret = ser.validated_data['session_id']

        try:
            payment = verify_payment(
                user=request.user,
                payment_id=ser.validated_data['payment_id'],
                client_secret=client_secret,
                simulate_outcome=ser.validated_data.get('simulate_outcome'),
            )
        except PaymentServiceError as e:
            st = status.HTTP_400_BAD_REQUEST
            if e.code == 'not_found':
                st = status.HTTP_404_NOT_FOUND
            return self.error_response(
                message=e.message,
                data={'code': e.code},
                status_code=st,
            )

        return self.success_response(
            data=PaymentSerializer(payment).data,
            message='Payment status updated.',
        )


class PaymentHistoryView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = list_payments_for_account(request.user)
        return self.success_response(
            data={'results': PaymentHistorySerializer(qs, many=True).data},
            message='OK',
        )


class PaymentSimulateWebhookView(ApiResponseMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, 'ENABLE_PAYMENT_WEBHOOK_SIMULATION', settings.DEBUG):
            return self.error_response(
                message='Webhook simulation is disabled.',
                status_code=status.HTTP_404_NOT_FOUND,
            )
        secret = request.headers.get('X-Payment-Webhook-Secret') or request.META.get(
            'HTTP_X_PAYMENT_WEBHOOK_SECRET'
        )
        expected = getattr(settings, 'PAYMENT_WEBHOOK_SECRET', '')
        if not expected or secret != expected:
            return self.error_response(
                message='Invalid webhook secret.',
                status_code=status.HTTP_403_FORBIDDEN,
            )

        ser = SimulateWebhookSerializer(data=request.data)
        if not ser.is_valid():
            return self.error_response(message='Validation failed.', data=ser.errors)

        try:
            payment = Payment.objects.only('provider').get(transaction_id=ser.validated_data['transaction_id'])
            provider = get_payment_provider(payment.provider)
            event_type, transaction_id = provider.parse_webhook_payload(
                {
                    'type': ser.validated_data['event'],
                    'transaction_id': ser.validated_data['transaction_id'],
                }
            )
            if event_type == 'ignored':
                return self.success_response(
                    message='Event ignored.',
                    data={'event': ser.validated_data['event']},
                )
            payment = apply_webhook_event(
                transaction_id=transaction_id,
                event=event_type,
            )
        except Payment.DoesNotExist:
            return self.error_response(message='Payment not found.', data={'code': 'not_found'}, status_code=status.HTTP_404_NOT_FOUND)
        except PaymentServiceError as e:
            st = status.HTTP_404_NOT_FOUND if e.code == 'not_found' else status.HTTP_400_BAD_REQUEST
            return self.error_response(message=e.message, data={'code': e.code}, status_code=st)
        except ValueError as e:
            return self.error_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)

        return self.success_response(
            data=PaymentSerializer(payment).data,
            message='Webhook processed.',
        )


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(ApiResponseMixin, views.APIView):
    """Stripe-signed webhooks (Checkout Session lifecycle)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '') or ''
        if not webhook_secret:
            return self.error_response(
                message='Stripe webhook secret is not configured.',
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except ValueError:
            return self.error_response(message='Invalid payload.', status_code=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError:
            return self.error_response(
                message='Invalid Stripe signature.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        event_payload = event.to_dict_recursive() if hasattr(event, 'to_dict_recursive') else event
        provider = get_payment_provider('stripe')
        event_type, transaction_id = provider.parse_webhook_payload(event_payload)
        if event_type == 'ignored':
            return self.success_response(message='Event ignored.', data={'type': event.type})

        try:
            payment = apply_webhook_event(transaction_id=transaction_id, event=event_type)
        except PaymentServiceError as e:
            if e.code == 'unsupported_event':
                return self.success_response(message='Event ignored.', data={'type': event.type})
            st = status.HTTP_404_NOT_FOUND if e.code == 'not_found' else status.HTTP_400_BAD_REQUEST
            return self.error_response(message=e.message, data={'code': e.code}, status_code=st)

        return self.success_response(
            data=PaymentSerializer(payment).data,
            message='Stripe webhook processed.',
        )
