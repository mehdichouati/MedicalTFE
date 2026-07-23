import io

import stripe
from django.conf import settings
from django.http import FileResponse
from django.views.decorators.csrf import csrf_exempt
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
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

class ReceiptPDFView(APIView):
    """F5 — Genere le document justificatif de paiement (PDF) pour un RDV.

    Conditions : le RDV doit etre marque COMPLETED par le professionnel
    (F5) et le paiement doit etre SUCCEEDED ou PARTIALLY_REFUNDED/REFUNDED
    (on genere le justificatif meme apres un remboursement partiel, il
    documente ce qui a reellement ete percu).

    ATTENTION : ceci n'est PAS l'attestation de soins officielle INAMI
    (qui necessite l'integration eHealth/MyCareNet, cf. F14/#26 — hors
    scope). C'est un document justificatif de paiement, conforme a
    l'obligation de remise d'un document justificatif au patient (loi SSI,
    art. 53 §1er/2), que le patient peut le cas echeant transmettre
    lui-meme a sa mutuelle.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appointment_id):
        appointment = Appointment.objects.filter(pk=appointment_id).first()
        if appointment is None:
            return Response({'detail': 'Rendez-vous introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_owner_patient = user.role == 'PATIENT' and appointment.patient_id == user.id
        is_owner_professional = user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE') and appointment.professional_id == user.id
        is_admin = user.role == 'ADMIN'
        if not (is_owner_patient or is_owner_professional or is_admin):
            return Response({'detail': "Vous n'avez pas accès à ce document."}, status=status.HTTP_403_FORBIDDEN)

        if appointment.status != Appointment.Status.COMPLETED:
            return Response(
                {'detail': "Le document justificatif n'est disponible qu'une fois la consultation terminée."},
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

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        y = height - 30 * mm

        p.setFont('Helvetica-Bold', 16)
        p.drawString(20 * mm, y, "Document justificatif de paiement")
        y -= 8 * mm

        p.setFont('Helvetica', 9)
        p.setFillColorRGB(0.4, 0.4, 0.4)
        p.drawString(20 * mm, y, "Ceci n'est pas une attestation de soins INAMI officielle.")
        y -= 12 * mm

        p.setFillColorRGB(0, 0, 0)
        p.setFont('Helvetica-Bold', 11)
        p.drawString(20 * mm, y, "Praticien")
        y -= 6 * mm
        p.setFont('Helvetica', 10)
        p.drawString(20 * mm, y, f"{appointment.professional.get_full_name() or appointment.professional.username}")
        y -= 5 * mm
        p.drawString(20 * mm, y, f"Rôle : {appointment.professional.get_role_display() if hasattr(appointment.professional, 'get_role_display') else appointment.professional.role}")
        y -= 5 * mm
        p.drawString(20 * mm, y, f"{appointment.medical_house.name} — {appointment.medical_house.address}, {appointment.medical_house.city}")
        y -= 10 * mm

        p.setFont('Helvetica-Bold', 11)
        p.drawString(20 * mm, y, "Patient")
        y -= 6 * mm
        p.setFont('Helvetica', 10)
        p.drawString(20 * mm, y, f"{appointment.patient.get_full_name() or appointment.patient.username}")
        y -= 10 * mm

        p.setFont('Helvetica-Bold', 11)
        p.drawString(20 * mm, y, "Prestation")
        y -= 6 * mm
        p.setFont('Helvetica', 10)

        from django.utils import timezone as django_timezone
        local_start = django_timezone.localtime(appointment.start_datetime)
        p.drawString(20 * mm, y, f"Date : {local_start.strftime('%d/%m/%Y à %H:%M')}")
        y -= 5 * mm
        p.drawString(20 * mm, y, f"Motif : {appointment.reason or 'Consultation'}")
        y -= 10 * mm

        p.setFont('Helvetica-Bold', 11)
        p.drawString(20 * mm, y, "Paiement")
        y -= 6 * mm
        p.setFont('Helvetica', 10)
        p.drawString(20 * mm, y, f"Montant payé : {payment.amount_cents / 100:.2f} EUR")
        y -= 5 * mm
        if payment.refunded_amount_cents > 0:
            p.drawString(20 * mm, y, f"Montant remboursé : {payment.refunded_amount_cents / 100:.2f} EUR")
            y -= 5 * mm
            net = (payment.amount_cents - payment.refunded_amount_cents) / 100
            p.drawString(20 * mm, y, f"Montant net perçu : {net:.2f} EUR")
            y -= 5 * mm
        p.drawString(20 * mm, y, f"Statut : {payment.get_status_display()}")
        y -= 15 * mm

        p.setFont('Helvetica', 8)
        p.setFillColorRGB(0.4, 0.4, 0.4)
        p.drawString(20 * mm, y, "Ce document ne donne pas automatiquement droit à un remboursement de la mutualité.")
        y -= 4 * mm
        p.drawString(20 * mm, y, "Pour un remboursement INAMI, l'attestation de soins électronique officielle (eAttest) doit être émise par le praticien.")

        p.showPage()
        p.save()
        buffer.seek(0)

        filename = f"justificatif-paiement-rdv-{appointment.id}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type='application/pdf')