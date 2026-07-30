from django.contrib import admin
from .models import NotificationPreference, Notification


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    """Préférences utilisateur : modifiables par un admin en cas de demande
    (ex. support), contrairement au journal d'envoi ci-dessous."""

    list_display = ('user', 'email_enabled', 'sms_enabled', 'updated_at')
    list_filter = ('email_enabled', 'sms_enabled')
    search_fields = ('user__username',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Journal des notifications envoyées : lecture seule, sert de preuve
    d'envoi (conformité N5) — ne doit pas pouvoir être modifié ou supprimé."""

    list_display = (
        'id', 'recipient', 'notification_type', 'channel', 'status', 'created_at', 'sent_at',
    )
    list_filter = ('notification_type', 'channel', 'status')
    search_fields = ('recipient__username', 'subject')
    readonly_fields = (
        'recipient', 'channel', 'notification_type', 'subject', 'body',
        'status', 'error_message', 'created_at', 'sent_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False