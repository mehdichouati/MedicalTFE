from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        PATIENT = 'PATIENT', 'Patient'
        MEDECIN = 'MEDECIN', 'Médecin généraliste'
        KINE = 'KINE', 'Kinésithérapeute'
        PSYCHOLOGUE = 'PSYCHOLOGUE', 'Psychologue'
        ADMIN = 'ADMIN', 'Administrateur'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True)
    language = models.CharField(max_length=5, default='fr', choices=[('fr', 'Français'), ('en', 'English')])
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class AuditLog(models.Model):
    """N5/N1 — Journal d'audit des actions administratives sensibles.

    Traçabilité des accès/modifications sur les comptes utilisateurs,
    conforme à l'exigence RGPD de tenue d'un registre des activités de
    traitement (art. 30) et aux bonnes pratiques de sécurité (N1).
    """

    class Action(models.TextChoices):
        USER_CREATED = 'USER_CREATED', 'Compte créé'
        USER_UPDATED = 'USER_UPDATED', 'Compte modifié'
        USER_ACTIVATED = 'USER_ACTIVATED', 'Compte activé'
        USER_DEACTIVATED = 'USER_DEACTIVATED', 'Compte désactivé'

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_actions',
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    target_description = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.get_action_display()} par {self.actor} — {self.target_description}"