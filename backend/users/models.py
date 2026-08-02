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
    date_of_birth = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # F1 — Preuve du consentement explicite au traitement des donnees de
    # sante (art. 9 RGPD), recueilli a l'inscription.
    health_data_consent_given = models.BooleanField(default=False)
    health_data_consent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        from django.utils import timezone
        today = timezone.localdate()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    @property
    def is_minor(self):
        age = self.age
        return age is not None and age < 18

    @property
    def is_minor_under_16(self):
        age = self.age
        return age is not None and age < 16


class LegalGuardianLink(models.Model):
    """F15 — Lien entre un representant legal (parent) et un compte mineur.

    Le parent a un acces complet (reservation, paiement, dossier) sur le
    compte de l'enfant, quel que soit son age. Les mineurs de moins de 16
    ans n'ont pas de connexion autonome (compte gere entierement par le
    parent) ; les 16-17 ans peuvent se connecter et agir eux-memes, en plus
    du parent qui garde un acces complet en parallele.

    Conformite : pas de verification documentaire (carte d'identite) -
    disproportionne au regard du RGPD (minimisation des donnees) et du cadre
    legal belge sur le controle des cartes d'identite (reserve a des
    personnes habilitees, AR du 25/03/2003). A la place, le parent atteste
    sur l'honneur etre le representant legal, declaration horodatee et
    journalisee (AuditLog) pour tracabilite en cas de litige.
    """

    guardian = models.ForeignKey(
        'User', on_delete=models.CASCADE, related_name='dependents_link',
    )
    minor = models.OneToOneField(
        'User', on_delete=models.CASCADE, related_name='guardian_link',
    )
    attested_on_honour = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.guardian} est representant legal de {self.minor}"


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
        PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED', 'Paiement confirmé'
        PAYMENT_FAILED = 'PAYMENT_FAILED', 'Paiement échoué'
        PAYMENT_REFUNDED = 'PAYMENT_REFUNDED', 'Paiement remboursé'
        
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