from users.models import LegalGuardianLink, AuditLog

import stripe
from django.conf import settings
from django.db.models import Q
from django.http import FileResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from notifications.services import notify_payment_succeeded
from .invoice_pdf import build_invoice_pdf
from .models import Invoice, Payment
from .serializers import PaymentSerializer

stripe.api_key = settings.STRIPE_SECRET_KEY


def _is_guardian_of(guardian, patient_id):
    return LegalGuardianLink.objects.filter(
        guardian=guardian, minor_id=patient_id, revoked_at__isnull=True,
        status=LegalGuardianLink.Status.APPROVED,
    ).exists()


def _mark_payment_succeeded(payment):
    """Confirme un paiement une seule fois, sans ecraser un remboursement."""
    if payment.status in (
        Payment.Status.SUCCEEDED,
        Payment.Status.PARTIALLY_REFUNDED,
        Payment.Status.REFUNDED,
    ):
        return

    payment.status = Payment.Status.SUCCEEDED
    payment.save(update_fields=['status'])
    notify_payment_succeeded(payment)
    AuditLog.objects.create(
        actor=None,  # confirmé par Stripe, aucun utilisateur authentifié
        action=AuditLog.Action.PAYMENT_SUCCEEDED,
        target_description=f"Paiement #{payment.id} de {payment.amount_cents / 100:.2f} EUR — {payment.patient}",
    )


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """F4 — Consultation des paiements (lecture seule : la creation passe
    par CreatePaymentIntentView, jamais par un POST direct sur ce ViewSet,
    pour garder Stripe comme unique source de verite sur le statut)."""

    serializer_class = PaymentSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Payment.objects.all()
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return Payment.objects.filter(appointment__professional=user)
        # F15 — le parent voit aussi les paiements de ses enfants rattaches.
        dependent_ids = LegalGuardianLink.objects.filter(
            guardian=user, revoked_at__isnull=True,
            status=LegalGuardianLink.Status.APPROVED,
        ).values_list('minor_id', flat=True)
        return Payment.objects.filter(Q(patient=user) | Q(patient_id__in=dependent_ids))


class CreatePaymentIntentView(APIView):
    """F4 — Cree (ou reutilise) un Stripe PaymentIntent pour un rendez-vous.

    POST /api/payments/create-intent/  { "appointment": <id>, "amount_cents": 2500 }
    Renvoie le client_secret que le frontend utilise avec Stripe Elements
    pour afficher le formulaire de carte et confirmer le paiement.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        appointment_id = request.data.get('appointment')
        amount_cents = request.data.get('amount_cents')

        if not appointment_id or not amount_cents:
            return Response(
                {'detail': "Les champs 'appointment' et 'amount_cents' sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appointment = Appointment.objects.filter(pk=appointment_id).first()
        if appointment is None:
            return Response({'detail': 'Rendez-vous introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        # F15 — le patient concerne, son parent (representant legal), ou un
        # admin peuvent initier le paiement.
        if request.user.role == 'PATIENT' and appointment.patient_id != request.user.id:
            if not _is_guardian_of(request.user, appointment.patient_id):
                return Response({'detail': "Vous ne pouvez pas payer ce rendez-vous."}, status=status.HTTP_403_FORBIDDEN)

        payment, created = Payment.objects.get_or_create(
            appointment=appointment,
            defaults={
                'patient': appointment.patient,
                'amount_cents': amount_cents,
            },
        )

        if not created and payment.status == Payment.Status.SUCCEEDED:
            return Response({'detail': 'Ce rendez-vous est déjà payé.'}, status=status.HTTP_400_BAD_REQUEST)

        # Reutilise le PaymentIntent existant s'il y en a deja un en attente,
        # sinon en cree un nouveau cote Stripe.
        intent = None
        previous_intent_id = payment.stripe_payment_intent_id

        if previous_intent_id:
            intent = stripe.PaymentIntent.retrieve(previous_intent_id)

            # Le webhook a pu etre manque : on resynchronise avec Stripe.
            if intent.status == 'succeeded':
                _mark_payment_succeeded(payment)
                return Response(
                    {'detail': 'Ce rendez-vous est déjà payé.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Un PaymentIntent annule ne peut plus servir.
            if intent.status == 'canceled':
                intent = None

        if intent is None:
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='eur',
                metadata={'appointment_id': str(appointment.id), 'payment_id': str(payment.id)},
                # DSP2 : Stripe declenche automatiquement le 3D Secure quand
                # la banque emettrice l'exige, sans code supplementaire ici.
                automatic_payment_methods={'enabled': True},
                # Idempotence : si cet appel est declenche deux fois de suite
                # (ex. React StrictMode en dev), Stripe renvoie le MEME
                # PaymentIntent au lieu d'en creer un second, evitant toute
                # incoherence entre le formulaire affiche et la base.
                idempotency_key=f"payment-intent-appointment-{appointment.id}-{previous_intent_id or 'initial'}",
            )
            payment.stripe_payment_intent_id = intent.id
            payment.amount_cents = amount_cents
            payment.save(update_fields=['stripe_payment_intent_id', 'amount_cents'])

        return Response({
            'client_secret': intent.client_secret,
            'payment_id': payment.id,
        })


class SyncPaymentView(APIView):
    """F4 — Resynchronise un paiement avec Stripe au retour du formulaire.

    POST /api/payments/sync/  { "payment_intent": "pi_..." }
    Le statut est lu cote serveur chez Stripe : le frontend ne fait que
    transmettre l'identifiant, il ne decide jamais du resultat.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        intent_id = request.data.get('payment_intent')
        if not intent_id:
            return Response(
                {'detail': "Le champ 'payment_intent' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = Payment.objects.filter(stripe_payment_intent_id=intent_id).first()
        if payment is None:
            return Response({'detail': 'Paiement introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'PATIENT' and payment.patient_id != user.id:
            if not _is_guardian_of(user, payment.patient_id):
                return Response({'detail': "Vous n'avez pas accès à ce paiement."}, status=status.HTTP_403_FORBIDDEN)

        intent = stripe.PaymentIntent.retrieve(intent_id)
        if intent.status == 'succeeded':
            _mark_payment_succeeded(payment)

        return Response({'status': payment.status})


@csrf_exempt
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """F4 — Webhook Stripe : source de verite pour confirmer un paiement.

    On ne fait JAMAIS confiance a un simple retour frontend pour marquer un
    paiement comme reussi : seul cet evenement, signe par Stripe, fait foi.
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        return Response(status=status.HTTP_400_BAD_REQUEST)

    if event['type'] == 'payment_intent.succeeded':
        intent = event['data']['object']
        payment = Payment.objects.filter(stripe_payment_intent_id=intent['id']).first()
        if payment:
            _mark_payment_succeeded(payment)

    elif event['type'] == 'payment_intent.payment_failed':
        intent = event['data']['object']
        payment = Payment.objects.filter(stripe_payment_intent_id=intent['id']).first()
        if payment:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            AuditLog.objects.create(
                actor=None,
                action=AuditLog.Action.PAYMENT_FAILED,
                target_description=f"Paiement #{payment.id} de {payment.amount_cents / 100:.2f} EUR — {payment.patient}",
            )

    return Response(status=status.HTTP_200_OK)


class ReceiptPDFView(APIView):
    """F5 — Genere la facture (PDF) d'un RDV paye.

    Conditions : le RDV doit etre marque COMPLETED par le professionnel
    (F5) et le paiement doit etre SUCCEEDED ou PARTIALLY_REFUNDED/REFUNDED
    (la facture reste disponible apres un remboursement : elle indique le
    montant rembourse et le net reellement percu).

    La facture recoit un numero unique a sa premiere emission
    (Invoice.for_payment) ; les telechargements suivants renvoient la meme
    facture, avec le meme numero.

    ATTENTION : ceci n'est PAS l'attestation de soins officielle INAMI
    (qui necessite l'integration eHealth/MyCareNet, cf. F14/#26 — hors
    scope). Le PDF le precise au patient.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appointment_id):
        appointment = (
            Appointment.objects
            .select_related('patient', 'professional', 'medical_house')
            .filter(pk=appointment_id)
            .first()
        )
        if appointment is None:
            return Response({'detail': 'Rendez-vous introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_owner_patient = user.role == 'PATIENT' and appointment.patient_id == user.id
        is_guardian = user.role == 'PATIENT' and _is_guardian_of(user, appointment.patient_id)
        is_owner_professional = user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE') and appointment.professional_id == user.id
        is_admin = user.role == 'ADMIN'
        if not (is_owner_patient or is_guardian or is_owner_professional or is_admin):
            return Response({'detail': "Vous n'avez pas accès à ce document."}, status=status.HTTP_403_FORBIDDEN)

        if appointment.status != Appointment.Status.COMPLETED:
            return Response(
                {'detail': "La facture n'est disponible qu'une fois la consultation terminée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = Payment.objects.filter(appointment=appointment).first()
        if payment is None or payment.status not in (
            Payment.Status.SUCCEEDED, Payment.Status.PARTIALLY_REFUNDED, Payment.Status.REFUNDED,
        ):
            return Response(
                {'detail': "Aucun paiement enregistré pour cette consultation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice = Invoice.for_payment(payment)
        buffer = build_invoice_pdf(invoice)

        filename = f"facture-{invoice.number}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')