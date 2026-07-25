from rest_framework import generics, permissions
from .models import NotificationPreference
from .serializers import NotificationPreferenceSerializer


class NotificationPreferenceView(generics.RetrieveUpdateAPIView):
    """F7/F12 — Préférences de notification de l'utilisateur connecté."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = NotificationPreferenceSerializer

    def get_object(self):
        preference, _ = NotificationPreference.objects.get_or_create(user=self.request.user)
        return preference