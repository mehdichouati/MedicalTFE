from django.conf import settings
from django.db import models

from appointments.models import Appointment


class Payment(models.Model):
    """F4 — Système de paiement en ligne.

    Aucune donnée de carte bancaire n'est stockee ici : uniquement
    l'identifiant Stripe (PaymentIntent), conformement a la contrainte
    PCI-DSS du cahier des charges. Stripe gere l'authentification forte
    (3D Secure), ce qui couvre l'exigence DSP2.
    """

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        SUCCEEDED = 'SUCCEEDED', 'Payé'
        REFUNDED = 'REFUNDED', 'Remboursé'
        PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', 'Remboursé partiellement'
        FAILED = 'FAILED', 'Échoué'

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name='payment',
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments',
    )

    amount_cents = models.PositiveIntegerField(help_text="Montant en centimes (ex: 2500 = 25,00 EUR).")
    currency = models.CharField(max_length=3, default='eur')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    refunded_amount_cents = models.PositiveIntegerField(default=0)

    # F4 (annulation tardive / no-show) : dette de 5 EUR si aucun
    # remboursement n'etait possible au moment du fait generateur.
    late_cancellation_fee_due_cents = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Paiement {self.amount_cents / 100:.2f} EUR — {self.patient} — {self.get_status_display()}"