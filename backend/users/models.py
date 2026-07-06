from django.contrib.auth.models import AbstractUser
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
