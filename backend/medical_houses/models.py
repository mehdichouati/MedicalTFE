from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


# Numero d'entreprise belge (Banque-Carrefour des Entreprises) :
# 10 chiffres au format 0123.456.789, commencant par 0 ou 1.
company_number_validator = RegexValidator(
    regex=r'^[01]\d{3}\.\d{3}\.\d{3}$',
    message="Format attendu : 0123.456.789 (numéro BCE à 10 chiffres).",
)


class MedicalHouse(models.Model):
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=10)
    phone_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    company_number = models.CharField(
        'numéro BCE',
        max_length=12,
        blank=True,
        validators=[company_number_validator],
        help_text="Numéro d'entreprise affiché sur les factures et le site (ex. 0123.456.789).",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.city})"


class MedicalHouseStaff(models.Model):
    medical_house = models.ForeignKey(MedicalHouse, on_delete=models.CASCADE, related_name='staff')
    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medical_houses')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('medical_house', 'professional')

    def __str__(self):
        return f"{self.professional} @ {self.medical_house}"