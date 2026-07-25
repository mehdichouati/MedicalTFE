from django.conf import settings
from django.db import models


class NotificationPreference(models.Model):
    """F7/F12 — Préférences de notification par utilisateur.

    Permet de désactiver les notifications (exigence F12 explicite), et de
    choisir le canal (email/SMS) — bonne pratique anti-spam (F7).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_preference',
    )
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)  # opt-in explicite, pas par defaut
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Préférences de {self.user} (email={self.email_enabled}, sms={self.sms_enabled})"


class Notification(models.Model):
    """F7 — Journal des notifications envoyées (email/SMS).

    Trace chaque envoi (ou tentative), utile pour le debug, la conformite
    (preuve d'envoi) et l'affichage cote patient/pro si besoin.
    """

    class Channel(models.TextChoices):
        EMAIL = 'EMAIL', 'Email'
        SMS = 'SMS', 'SMS'

    class NotificationType(models.TextChoices):
        APPOINTMENT_CONFIRMATION = 'APPOINTMENT_CONFIRMATION', 'Confirmation de rendez-vous'
        APPOINTMENT_CANCELLATION = 'APPOINTMENT_CANCELLATION', 'Annulation de rendez-vous'
        APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER', 'Rappel de rendez-vous'
        PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED', 'Paiement réussi'
        PAYMENT_REFUNDED = 'PAYMENT_REFUNDED', 'Remboursement'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        SENT = 'SENT', 'Envoyé'
        FAILED = 'FAILED', 'Échoué'
        SKIPPED = 'SKIPPED', 'Ignoré (préférence désactivée)'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications',
    )
    channel = models.CharField(max_length=10, choices=Channel.choices)
    notification_type = models.CharField(max_length=40, choices=NotificationType.choices)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_notification_type_display()} ({self.channel}) → {self.recipient} — {self.get_status_display()}"