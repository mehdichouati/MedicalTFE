from django.conf import settings
from django.db import models
from medical_houses.models import MedicalHouse


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

    class Meta:
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['professional', 'start_datetime']),
            models.Index(fields=['patient', 'start_datetime']),
        ]

    def __str__(self):
        return f"RDV {self.patient} avec {self.professional} le {self.start_datetime}"