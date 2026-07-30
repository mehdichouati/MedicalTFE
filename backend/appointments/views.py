from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, generics, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User, LegalGuardianLink, AuditLog
from triage.models import TriageAssessment
from triage.serializers import TriageAssessmentSerializer
from notifications.services import notify_appointment_confirmation, notify_appointment_cancellation

from .models import WeeklyAvailability, Absence, Appointment, MedicalDocument, Review
from .serializers import (
    WeeklyAvailabilitySerializer, AbsenceSerializer, AppointmentSerializer,
    MedicalDocumentSerializer, ReviewSerializer,
)

SLOT_DURATION_MINUTES = 30

# F4 — Politique d'annulation.
LATE_CANCELLATION_WINDOW = timedelta(hours=24)
LATE_CANCELLATION_FEE_CENTS = 500  # 5 EUR


def _is_guardian_of(guardian, patient_id):
    return LegalGuardianLink.objects.filter(
        guardian=guardian, minor_id=patient_id, revoked_at__isnull=True,
    ).exists()


def _apply_cancellation_policy(appointment, actor):
    """F4 — Applique la politique d'annulation/no-show a un rendez-vous."""
    from payments.models import Payment
    from notifications.services import notify_payment_refunded
    import stripe
    from django.conf import settings

    stripe.api_key = settings.STRIPE_SECRET_KEY

    payment = Payment.objects.filter(appointment=appointment).first()
    if payment is None:
        return

    now = timezone.now()
    is_late = (appointment.start_datetime - now) < LATE_CANCELLATION_WINDOW

    if payment.status == Payment.Status.SUCCEEDED:
        if is_late:
            refund_amount = max(payment.amount_cents - LATE_CANCELLATION_FEE_CENTS, 0)
            if refund_amount > 0:
                stripe.Refund.create(payment_intent=payment.stripe_payment_intent_id, amount=refund_amount)
            payment.refunded_amount_cents = refund_amount
            payment.status = (
                Payment.Status.PARTIALLY_REFUNDED if refund_amount > 0 else Payment.Status.REFUNDED
            )
            payment.save(update_fields=['refunded_amount_cents', 'status'])
            notify_payment_refunded(payment)
            AuditLog.objects.create(
                actor=actor,
                action=AuditLog.Action.PAYMENT_REFUNDED,
                target_description=f"Paiement #{payment.id} — {payment.refunded_amount_cents / 100:.2f} EUR remboursés — {payment.patient}",
            )
        else:
            stripe.Refund.create(payment_intent=payment.stripe_payment_intent_id)
            payment.refunded_amount_cents = payment.amount_cents
            payment.status = Payment.Status.REFUNDED
            payment.save(update_fields=['refunded_amount_cents', 'status'])
            notify_payment_refunded(payment)
            AuditLog.objects.create(
                actor=actor,
                action=AuditLog.Action.PAYMENT_REFUNDED,
                target_description=f"Paiement #{payment.id} — {payment.refunded_amount_cents / 100:.2f} EUR remboursés — {payment.patient}",
            )
    else:
        if is_late:
            payment.late_cancellation_fee_due_cents = LATE_CANCELLATION_FEE_CENTS
            payment.save(update_fields=['late_cancellation_fee_due_cents'])


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        return obj.professional_id == request.user.id


class WeeklyAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = WeeklyAvailabilitySerializer
    permission_classes = (IsOwnerOrAdmin,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return WeeklyAvailability.objects.all()
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return WeeklyAvailability.objects.filter(professional=user)
        return WeeklyAvailability.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            serializer.save(professional=user)
        else:
            serializer.save()


class AbsenceViewSet(viewsets.ModelViewSet):
    serializer_class = AbsenceSerializer
    permission_classes = (IsOwnerOrAdmin,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Absence.objects.all()
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return Absence.objects.filter(professional=user)
        return Absence.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            serializer.save(professional=user)
        else:
            serializer.save()


class IsPatientOwnerProOrAdmin(permissions.BasePermission):
    """Un patient ne voit/gère que ses propres RDV (et ceux de ses enfants
    rattaches, F15), un pro les siens, l'admin tout voit."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'ADMIN':
            return True
        if obj.patient_id == user.id or obj.professional_id == user.id:
            return True
        return _is_guardian_of(user, obj.patient_id)


class AppointmentViewSet(viewsets.ModelViewSet):
    """F2 — Prise de rendez-vous centralisée."""

    serializer_class = AppointmentSerializer
    permission_classes = (IsPatientOwnerProOrAdmin,)
    filter_backends = (DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ('status', 'medical_house', 'professional')
    ordering_fields = ('start_datetime',)
    ordering = ('-start_datetime',)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Appointment.objects.all()
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return Appointment.objects.filter(professional=user)
        dependent_ids = LegalGuardianLink.objects.filter(
            guardian=user, revoked_at__isnull=True,
        ).values_list('minor_id', flat=True)
        return Appointment.objects.filter(Q(patient=user) | Q(patient_id__in=dependent_ids))

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'PATIENT':
            target_patient = serializer.validated_data.get('patient')
            if target_patient and target_patient.id != user.id:
                if not _is_guardian_of(user, target_patient.id):
                    raise ValidationError(
                        "Vous ne pouvez réserver que pour vous-même ou pour un enfant rattaché à votre compte."
                    )
                appointment = serializer.save(patient=target_patient)
            else:
                appointment = serializer.save(patient=user)
        else:
            appointment = serializer.save()
        notify_appointment_confirmation(appointment)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if user.role == 'PATIENT' and 'patient' in serializer.validated_data:
            if serializer.validated_data['patient'].id != instance.patient_id:
                raise ValidationError("Vous ne pouvez pas modifier le patient d'un rendez-vous existant.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        appointment = self.get_object()
        appointment.status = Appointment.Status.CANCELLED
        appointment.cancelled_at = timezone.now()
        appointment.cancelled_by = request.user
        appointment.save(update_fields=['status', 'cancelled_at', 'cancelled_by'])
        _apply_cancellation_policy(appointment, request.user)
        notify_appointment_cancellation(appointment)
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-no-show')
    def mark_no_show(self, request, pk=None):
        appointment = self.get_object()
        if request.user.role not in ('MEDECIN', 'KINE', 'PSYCHOLOGUE', 'ADMIN'):
            return Response(
                {'detail': "Seul le professionnel concerné ou l'administrateur peut signaler une absence."},
                status=status.HTTP_403_FORBIDDEN,
            )
        appointment.status = Appointment.Status.NO_SHOW
        appointment.save(update_fields=['status'])
        _apply_cancellation_policy(appointment, request.user)
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'], url_path='mark-completed')
    def mark_completed(self, request, pk=None):
        appointment = self.get_object()
        if request.user.role not in ('MEDECIN', 'KINE', 'PSYCHOLOGUE', 'ADMIN'):
            return Response(
                {'detail': "Seul le professionnel concerné ou l'administrateur peut terminer une consultation."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.role != 'ADMIN' and appointment.professional_id != request.user.id:
            return Response(
                {'detail': "Vous ne pouvez terminer que vos propres consultations."},
                status=status.HTTP_403_FORBIDDEN,
            )
        appointment.status = Appointment.Status.COMPLETED
        appointment.save(update_fields=['status'])
        return Response(AppointmentSerializer(appointment).data)


class AvailableSlotsView(generics.GenericAPIView):
    """F2 — Renvoie les créneaux libres d'un professionnel pour une date donnée."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        professional_id = request.query_params.get('professional')
        medical_house_id = request.query_params.get('medical_house')
        date_str = request.query_params.get('date')

        if not (professional_id and medical_house_id and date_str):
            return Response(
                {'detail': "Paramètres requis : professional, medical_house, date (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        day = parse_date(date_str)
        if day is None:
            return Response({'detail': "Format de date invalide, attendu YYYY-MM-DD."},
                             status=status.HTTP_400_BAD_REQUEST)

        weekday = day.weekday()
        availabilities = WeeklyAvailability.objects.filter(
            professional_id=professional_id,
            medical_house_id=medical_house_id,
            weekday=weekday,
        )

        absences = list(Absence.objects.filter(
            professional_id=professional_id,
            start_datetime__date__lte=day,
            end_datetime__date__gte=day,
        ))

        booked = list(Appointment.objects.filter(
            professional_id=professional_id,
            start_datetime__date=day,
        ).exclude(status=Appointment.Status.CANCELLED))

        tz = timezone.get_current_timezone()
        slots = []
        for availability in availabilities:
            cursor = timezone.make_aware(datetime.combine(day, availability.start_time), tz)
            window_end = timezone.make_aware(datetime.combine(day, availability.end_time), tz)
            step = timedelta(minutes=SLOT_DURATION_MINUTES)

            while cursor + step <= window_end:
                slot_end = cursor + step

                blocked = any(a.start_datetime < slot_end and a.end_datetime > cursor for a in absences)
                taken = any(b.start_datetime < slot_end and b.end_datetime > cursor for b in booked)

                if not blocked and not taken:
                    slots.append({'start': cursor.isoformat(), 'end': slot_end.isoformat()})

                cursor = slot_end

        return Response({'date': date_str, 'professional': professional_id, 'slots': slots})


class PatientHistoryView(APIView):
    """F6 — Consultation de l'historique patient (F15 : accessible aussi
    au representant legal pour un enfant rattache)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient')

        if user.role == 'PATIENT':
            if patient_id and str(patient_id) != str(user.id):
                if not _is_guardian_of(user, patient_id):
                    return Response(
                        {'detail': "Vous ne pouvez consulter que votre historique ou celui de vos enfants rattachés."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                patient = User.objects.filter(pk=patient_id).first()
                if patient is None:
                    return Response({'detail': 'Patient introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            else:
                patient = user

        elif user.role == 'ADMIN':
            if not patient_id:
                return Response(
                    {'detail': "Le parametre 'patient' est requis pour ce role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            patient = User.objects.filter(pk=patient_id, role='PATIENT').first()
            if patient is None:
                return Response({'detail': 'Patient introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        elif user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            if not patient_id:
                return Response(
                    {'detail': "Le parametre 'patient' est requis pour ce role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            has_relation = Appointment.objects.filter(professional=user, patient_id=patient_id).exists()
            if not has_relation:
                return Response(
                    {'detail': "Vous n'avez pas accès à l'historique de ce patient."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            patient = User.objects.filter(pk=patient_id, role='PATIENT').first()
            if patient is None:
                return Response({'detail': 'Patient introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        else:
            return Response({'detail': 'Rôle non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        appointments = Appointment.objects.filter(patient=patient).order_by('-start_datetime')
        triage_assessments = TriageAssessment.objects.filter(patient=patient).order_by('-created_at')

        return Response({
            'patient': patient.id,
            'patient_username': patient.username,
            'appointments': AppointmentSerializer(appointments, many=True).data,
            'triage_assessments': TriageAssessmentSerializer(triage_assessments, many=True).data,
            'payments': [],
            'documents': [],
        })


class MedicalDocumentViewSet(viewsets.ModelViewSet):
    """F5 — Documents medicaux (resultats, rapports, prescriptions, notes).

    Regles d'acces par role :
    - Medecin : voit et depose tous types de documents pour ses patients.
    - Kine : voit et depose uniquement les documents de type
      PRESCRIPTION_KINE, pour ses propres patients.
    - Psychologue : voit et depose uniquement les documents de type
      PSY_NOTE, et uniquement ceux qu'elle/il a lui-meme deposes.
    """

    serializer_class = MedicalDocumentSerializer
    permission_classes = (permissions.IsAuthenticated,)
    http_method_names = ['get', 'post', 'head']

    def get_queryset(self):
        user = self.request.user

        if user.role == 'ADMIN':
            return MedicalDocument.objects.all()

        if user.role == 'PATIENT':
            return MedicalDocument.objects.filter(patient=user)

        if user.role == 'MEDECIN':
            patient_id = self.request.query_params.get('patient')
            if not patient_id:
                patient_ids = Appointment.objects.filter(professional=user).values_list('patient_id', flat=True)
                return MedicalDocument.objects.filter(patient_id__in=patient_ids)

            has_relation = Appointment.objects.filter(professional=user, patient_id=patient_id).exists()
            if not has_relation:
                return MedicalDocument.objects.none()
            return MedicalDocument.objects.filter(patient_id=patient_id)

        if user.role == 'KINE':
            patient_id = self.request.query_params.get('patient')
            base_qs = MedicalDocument.objects.filter(document_type=MedicalDocument.DocumentType.PRESCRIPTION_KINE)
            if not patient_id:
                patient_ids = Appointment.objects.filter(professional=user).values_list('patient_id', flat=True)
                return base_qs.filter(patient_id__in=patient_ids)

            has_relation = Appointment.objects.filter(professional=user, patient_id=patient_id).exists()
            if not has_relation:
                return MedicalDocument.objects.none()
            return base_qs.filter(patient_id=patient_id)

        if user.role == 'PSYCHOLOGUE':
            return MedicalDocument.objects.filter(
                uploaded_by=user, document_type=MedicalDocument.DocumentType.PSY_NOTE,
            )

        return MedicalDocument.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        document_type = serializer.validated_data.get('document_type')
        patient = serializer.validated_data.get('patient')

        if user.role == 'MEDECIN':
            has_relation = Appointment.objects.filter(professional=user, patient=patient).exists()
            if not has_relation:
                raise ValidationError("Vous ne pouvez déposer un document que pour un patient que vous avez déjà suivi.")
            serializer.save(uploaded_by=user)

        elif user.role == 'KINE':
            if document_type != MedicalDocument.DocumentType.PRESCRIPTION_KINE:
                raise ValidationError("Un kinésithérapeute ne peut déposer que des prescriptions pour kinésithérapeute.")
            has_relation = Appointment.objects.filter(professional=user, patient=patient).exists()
            if not has_relation:
                raise ValidationError("Vous ne pouvez déposer un document que pour un patient que vous avez déjà suivi.")
            serializer.save(uploaded_by=user)

        elif user.role == 'PSYCHOLOGUE':
            if document_type != MedicalDocument.DocumentType.PSY_NOTE:
                raise ValidationError("Un psychologue ne peut déposer que des notes psychologiques.")
            has_relation = Appointment.objects.filter(professional=user, patient=patient).exists()
            if not has_relation:
                raise ValidationError("Vous ne pouvez déposer un document que pour un patient que vous avez déjà suivi.")
            serializer.save(uploaded_by=user)

        else:
            raise ValidationError("Vous n'êtes pas autorisé à déposer un document médical.")


class IsAdminForModeration(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action in ('moderate',):
            return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')
        return bool(request.user and request.user.is_authenticated)


class ReviewViewSet(viewsets.ModelViewSet):
    """F13 — Evaluation des consultations."""

    serializer_class = ReviewSerializer
    permission_classes = (IsAdminForModeration,)
    http_method_names = ['get', 'post', 'patch', 'head']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Review.objects.all()
        if user.role == 'PATIENT':
            return Review.objects.filter(
                Q(patient=user) | Q(moderation_status=Review.ModerationStatus.APPROVED)
            )
        return Review.objects.filter(moderation_status=Review.ModerationStatus.APPROVED)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'PATIENT':
            raise ValidationError("Seul un patient peut déposer un avis.")

        appointment = serializer.validated_data.get('appointment')
        if appointment.patient_id != user.id:
            raise ValidationError("Vous ne pouvez évaluer que vos propres rendez-vous.")
        if appointment.status != Appointment.Status.COMPLETED:
            raise ValidationError("Seul un rendez-vous terminé peut être évalué.")
        if Review.objects.filter(appointment=appointment).exists():
            raise ValidationError("Ce rendez-vous a déjà été évalué.")

        serializer.save(patient=user)

    @action(detail=True, methods=['patch'], url_path='moderate')
    def moderate(self, request, pk=None):
        review = self.get_object()
        new_status = request.data.get('moderation_status')

        if new_status not in (Review.ModerationStatus.APPROVED, Review.ModerationStatus.REJECTED):
            return Response(
                {'detail': "Le statut doit être 'APPROVED' ou 'REJECTED'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review.moderation_status = new_status
        review.moderated_by = request.user
        review.moderated_at = timezone.now()
        review.save(update_fields=['moderation_status', 'moderated_by', 'moderated_at'])
        return Response(ReviewSerializer(review).data)


class MyPatientsView(generics.ListAPIView):
    """F5 — Liste des patients suivis par le professionnel connecte,
    avec recherche et tri, pour la carte 'Consulter les dossiers'."""

    permission_classes = (permissions.IsAuthenticated,)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering_fields = ('username', 'last_name', 'date_of_birth')
    ordering = ('last_name', 'username')

    def get_serializer_class(self):
        from users.serializers import DependentSerializer
        return DependentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return User.objects.none()

        patient_ids = Appointment.objects.filter(professional=user).values_list('patient_id', flat=True).distinct()
        return User.objects.filter(id__in=patient_ids, role='PATIENT')