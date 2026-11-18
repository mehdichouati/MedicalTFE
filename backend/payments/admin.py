from django.contrib import admin
from .models import Invoice, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Paiements : lecture seule sur tous les champs. Stripe reste l'unique
    source de vérité sur le statut (cf. docstring du modèle) — le back-office
    ne doit jamais permettre de créer, modifier ou supprimer un paiement,
    pour éviter toute désynchronisation ou falsification."""

    list_display = (
        'id', 'patient', 'appointment', 'amount_display', 'status',
        'refunded_amount_cents', 'created_at',
    )
    list_filter = ('status', 'currency')
    search_fields = ('patient__username', 'stripe_payment_intent_id')
    readonly_fields = (
        'appointment', 'patient', 'amount_cents', 'currency', 'status',
        'stripe_payment_intent_id', 'refunded_amount_cents',
        'late_cancellation_fee_due_cents', 'created_at', 'updated_at',
    )

    def amount_display(self, obj):
        return f"{obj.amount_cents / 100:.2f} {obj.currency.upper()}"
    amount_display.short_description = 'Montant'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """F5 — Factures : consultation uniquement. Une facture est créée
    automatiquement à sa première émission et ne peut jamais être modifiée
    ni supprimée (numérotation continue, obligation de conservation)."""

    list_display = ('number', 'issued_at', 'patient_display', 'amount_display', 'payment_status')
    list_filter = ('issued_at',)
    search_fields = ('number', 'payment__patient__username', 'payment__patient__last_name')
    readonly_fields = ('number', 'issued_at', 'payment')
    list_select_related = ('payment__patient',)

    def patient_display(self, obj):
        return obj.payment.patient.get_full_name() or obj.payment.patient.username
    patient_display.short_description = 'Patient'

    def amount_display(self, obj):
        return f"{obj.payment.amount_cents / 100:.2f} {obj.payment.currency.upper()}"
    amount_display.short_description = 'Montant'

    def payment_status(self, obj):
        return obj.payment.get_status_display()
    payment_status.short_description = 'Statut du paiement'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False