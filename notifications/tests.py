from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from notifications.models import Notification

User = get_user_model()

class NotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='test@example.com', password='password123', role='customer')
        self.client.force_authenticate(user=self.user)

    def test_list_notifications(self):
        Notification.objects.create(user=self.user, title='Test', message='Msg', notification_type='system')
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_mark_as_read(self):
        n = Notification.objects.create(user=self.user, title='Test', message='Msg', notification_type='system')
        response = self.client.post(f'/api/notifications/{n.id}/mark_as_read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        n.refresh_from_db()
        self.assertTrue(n.is_read)
