from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from medical_houses.models import MedicalHouse

# N1 — Types de fichiers autorises pour les documents medicaux, et taille
# maximale, pour eviter le depot de fichiers dangereux (executables, etc.)
# sur une plateforme manipulant des donnees de sante.
MEDICAL_DOCUMENT_MAX_SIZE_MB = 10


def validate_medical_document_size(file):
    if file.size > MEDICAL_DOCUMENT_MAX_SIZE_MB * 1024 * 1024:
        raise ValidationError(
            f"Le fichier dépasse la taille maximale autorisée ({MEDICAL_DOCUMENT_MAX_SIZE_MB} Mo)."
        )


class WeeklyAvailability(models.Model):
    class Weekday(models.IntegerChoices):
        LUNDI = 0, 'Lundi'
        MARDI = 1, 'Mardi'
        MERCREDI = 2, 'Mercredi'
        JEUDI = 3, 'Jeudi'
        VENDREDI = 4, 'Vendredi'
        SAMEDI = 5, 'Samedi'
        DIMANCHE = 6, 'Dimanche'

    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='availabilities')
    medical_house = models.ForeignKey(MedicalHouse, on_delete=models.CASCADE, related_name='availabilities')
    weekday = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ['weekday', 'start_time']

    def __str__(self):
        return f"{self.professional} - {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class Absence(models.Model):
    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='absences')
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_datetime']

    def __str__(self):
        return f"{self.professional} absent du {self.start_datetime} au {self.end_datetime}"


class Appointment(models.Model):
    """F2 — Prise de rendez-vous centralisée.

    Un rendez-vous réservé par un patient auprès d'un professionnel
    (médecin, kiné ou psychologue) dans une maison médicale donnée.
    """

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        CONFIRMED = 'CONFIRMED', 'Confirmé'
        CANCELLED = 'CANCELLED', 'Annulé'
        COMPLETED = 'COMPLETED', 'Terminé'
        NO_SHOW = 'NO_SHOW', 'Absence patient'

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments_as_patient',
    )
    professional = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments_as_professional',
    )
    medical_house = models.ForeignKey(
        MedicalHouse, on_delete=models.CASCADE, related_name='appointments',
    )
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(max_length=255, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='appointments_cancelled',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # F12 — Suivi des rappels deja envoyes, pour eviter les doublons lors
    # des passages periodiques de la tache Celery.
    reminder_24h_sent = models.BooleanField(default=False)
    reminder_2h_sent = models.BooleanField(default=False)

    class Meta:
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['professional', 'start_datetime']),
            models.Index(fields=['patient', 'start_datetime']),
        ]

    def __str__(self):
        return f"RDV {self.patient} avec {self.professional} le {self.start_datetime}"


class MedicalDocument(models.Model):
    """F5 — Documents medicaux (resultats, rapports) deposes par un medecin.

    Reserve aux medecins (pas kines/psychologues) : visibilite limitee au
    patient concerne et aux medecins ayant un lien de soin avec lui.
    """

    class DocumentType(models.TextChoices):
        LAB_RESULT = 'LAB_RESULT', 'Résultat de prise de sang'
        REPORT = 'REPORT', 'Rapport médical'
        PRESCRIPTION_KINE = 'PRESCRIPTION_KINE', 'Prescription pour kinésithérapeute'
        PSY_NOTE = 'PSY_NOTE', 'Note psychologique'
        OTHER = 'OTHER', 'Autre document'

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medical_documents',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medical_documents_uploaded',
    )
    document_type = models.CharField(max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER)
    title = models.CharField(max_length=255)
    file = models.FileField(
        upload_to='medical_documents/',
        validators=[
            FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
            validate_medical_document_size,
        ],
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.patient} ({self.uploaded_at:%d/%m/%Y})"

class Review(models.Model):
    """F13 — Evaluation des consultations par le patient.

    Un seul avis par rendez-vous termine. Le commentaire est obligatoire
    si la note est basse (<=3), facultatif sinon. Anonymisation possible
    (le nom du patient est alors masque dans tout affichage public).
    Moderation obligatoire avant affichage (statut PENDING par defaut).
    """

    class ModerationStatus(models.TextChoices):
        PENDING = 'PENDING', 'En attente de modération'
        APPROVED = 'APPROVED', 'Approuvé'
        REJECTED = 'REJECTED', 'Rejeté'

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name='review',
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_written',
    )
    rating = models.PositiveSmallIntegerField()  # 1 a 5
    comment = models.TextField(blank=True)
    is_anonymous = models.BooleanField(default=False)
    moderation_status = models.CharField(
        max_length=20, choices=ModerationStatus.choices, default=ModerationStatus.PENDING,
    )
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviews_moderated',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    moderated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Avis {self.rating}/5 sur RDV #{self.appointment_id} — {self.get_moderation_status_display()}"