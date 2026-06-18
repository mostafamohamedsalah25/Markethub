from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.core.signing import TimestampSigner

@shared_task
def send_verification_email(user_id, email):
    # Use TimestampSigner for a shorter, URL-safe token
    signer = TimestampSigner()
    token = signer.sign(str(user_id))
    
    verify_url = f"{settings.FRONTEND_URL}/verify_email/{token}"
    
    subject = 'Verify your email for MarketHub'
    message = f'Please click the link below to verify your email:\n\n{verify_url}'
    from_email = settings.DEFAULT_FROM_EMAIL
    
    # In Django 6.0, fail_silently must be passed as a keyword argument
    send_mail(
        subject, 
        message, 
        from_email, 
        [email], 
        fail_silently=False
    )

@shared_task
def send_password_reset_email(user_id, email):
    signer = TimestampSigner()
    token = signer.sign(str(user_id))
    
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{token}"
    
    subject = 'Reset your password for MarketHub'
    message = f'Please click the link below to reset your password:\n\n{reset_url}'
    from_email = settings.DEFAULT_FROM_EMAIL
    
    send_mail(
        subject,
        message,
        from_email,
        [email],
        fail_silently=False
    )
