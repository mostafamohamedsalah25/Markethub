from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

@shared_task
def send_order_confirmation_email(order_id, user_email):
    subject = f'Order Confirmation - #{order_id}'
    message = f'Thank you for your order! Your order #{order_id} has been received and is being processed.'
    from_email = settings.DEFAULT_FROM_EMAIL
    
    send_mail(
        subject,
        message,
        from_email,
        [user_email],
        fail_silently=False
    )

@shared_task
def create_notification(user_id, title, message, notification_type):
    try:
        user = User.objects.get(id=user_id)
        Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type
        )
    except User.DoesNotExist:
        pass
