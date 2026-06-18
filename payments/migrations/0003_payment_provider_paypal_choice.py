from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_payment_checkout_url'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='provider',
            field=models.CharField(
                choices=[
                    ('mock', 'Mock'),
                    ('stripe', 'Stripe'),
                    ('paypal', 'PayPal'),
                ],
                default='mock',
                max_length=20,
            ),
        ),
    ]
