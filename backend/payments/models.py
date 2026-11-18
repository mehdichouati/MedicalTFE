from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

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


class Invoice(models.Model):
    """F5 — Facture d'une consultation payee.

    Le numero est attribue une seule fois, a la premiere emission, puis ne
    change plus : une facture emise n'est jamais renumerotee. Format
    AAAA-NNNNNN, avec une sequence continue par annee civile, comme l'exige
    la numerotation des factures.

    on_delete=PROTECT : une facture doit etre conservee (obligation
    comptable), on ne peut donc pas supprimer le paiement qui la porte.
    """

    payment = models.OneToOneField(
        Payment, on_delete=models.PROTECT, related_name='invoice',
    )
    number = models.CharField('numéro', max_length=20, unique=True, editable=False)
    issued_at = models.DateTimeField("date d'émission", default=timezone.now, editable=False)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"Facture {self.number}"

    @classmethod
    def for_payment(cls, payment):
        """Retourne la facture du paiement, en la creant si besoin.

        Le verrou (select_for_update) et la contrainte unique sur le numero
        empechent deux factures d'obtenir le meme numero si deux demandes
        arrivent en meme temps ; en cas de conflit, on recommence.
        """
        existing = cls.objects.filter(payment=payment).first()
        if existing:
            return existing

        for _ in range(5):
            try:
                with transaction.atomic():
                    year = timezone.localdate().year
                    last = (
                        cls.objects.select_for_update()
                        .filter(number__startswith=f"{year}-")
                        .order_by('-number')
                        .first()
                    )
                    next_sequence = int(last.number.split('-')[1]) + 1 if last else 1
                    return cls.objects.create(payment=payment, number=f"{year}-{next_sequence:06d}")
            except IntegrityError:
                existing = cls.objects.filter(payment=payment).first()
                if existing:
                    return existing
        raise RuntimeError("Impossible d'attribuer un numero de facture.")