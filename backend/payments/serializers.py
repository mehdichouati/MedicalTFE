from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    amount_eur = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id', 'appointment', 'patient', 'amount_cents', 'amount_eur', 'currency',
            'status', 'status_display', 'refunded_amount_cents',
            'late_cancellation_fee_due_cents', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'patient', 'status', 'stripe_payment_intent_id',
            'refunded_amount_cents', 'late_cancellation_fee_due_cents',
            'created_at', 'updated_at',
        )

    def get_amount_eur(self, obj):
        return round(obj.amount_cents / 100, 2)