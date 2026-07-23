import stripe
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from .models import Payment
from .serializers import PaymentSerializer

stripe.api_key = settings.STRIPE_SECRET_KEY


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
        return Payment.objects.filter(patient=user)


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

        # Seul le patient concerne (ou un admin) peut initier le paiement.
        if request.user.role == 'PATIENT' and appointment.patient_id != request.user.id:
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
        if payment.stripe_payment_intent_id:
            intent = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)

        else:
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
                idempotency_key=f'payment-intent-appointment-{appointment.id}',
            )
       
            payment.stripe_payment_intent_id = intent.id
            payment.amount_cents = amount_cents
            payment.save(update_fields=['stripe_payment_intent_id', 'amount_cents'])

        return Response({
            'client_secret': intent.client_secret,
            'payment_id': payment.id,
        })


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
        Payment.objects.filter(stripe_payment_intent_id=intent['id']).update(status=Payment.Status.SUCCEEDED)

    elif event['type'] == 'payment_intent.payment_failed':
        intent = event['data']['object']
        Payment.objects.filter(stripe_payment_intent_id=intent['id']).update(status=Payment.Status.FAILED)

    return Response(status=status.HTTP_200_OK)