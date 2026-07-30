from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, AuditLog

admin.site.register(User, UserAdmin)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Journal d'audit en lecture seule (N1/N5) : aucune modification ou
    suppression possible depuis le back-office, pour garantir l'intégrité
    de la traçabilité."""

    list_display = ('timestamp', 'actor', 'action', 'target_description')
    list_filter = ('action',)
    search_fields = ('actor__username', 'target_description')
    readonly_fields = ('actor', 'action', 'target_description', 'timestamp')
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False