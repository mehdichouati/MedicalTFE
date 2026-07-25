from rest_framework import serializers
from .models import NotificationPreference


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ('email_enabled', 'sms_enabled', 'updated_at')
        read_only_fields = ('updated_at',)