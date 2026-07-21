from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, permissions, generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User
from triage.models import TriageAssessment
from triage.serializers import TriageAssessmentSerializer

from .models import WeeklyAvailability, Absence, Appointment
from .serializers import WeeklyAvailabilitySerializer, AbsenceSerializer, AppointmentSerializer

SLOT_DURATION_MINUTES = 30


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
    """Un patient ne voit/gère que ses propres RDV, un pro les siens, l'admin tout voit."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'ADMIN':
            return True
        return obj.patient_id == user.id or obj.professional_id == user.id


class AppointmentViewSet(viewsets.ModelViewSet):
    """F2 — Prise de rendez-vous centralisée."""

    serializer_class = AppointmentSerializer
    permission_classes = (IsPatientOwnerProOrAdmin,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Appointment.objects.all()
        if user.role in ('MEDECIN', 'KINE', 'PSYCHOLOGUE'):
            return Appointment.objects.filter(professional=user)
        # Patient : uniquement ses propres rendez-vous.
        return Appointment.objects.filter(patient=user)

    def perform_create(self, serializer):
        user = self.request.user
        # Un patient ne peut réserver que pour lui-même. Seul un admin peut
        # créer un RDV pour un autre patient (ex. accueil téléphonique).
        if user.role == 'PATIENT':
            serializer.save(patient=user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        # Empêche un patient de "voler" un rendez-vous d'un autre patient
        # en changeant le champ `patient` lors d'une modification.
        instance = self.get_object()
        user = self.request.user
        if user.role == 'PATIENT' and 'patient' in serializer.validated_data:
            if serializer.validated_data['patient'].id != instance.patient_id:
                raise ValidationError("Vous ne pouvez pas modifier le patient d'un rendez-vous existant.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        # F2 : on n'efface pas un rendez-vous, on l'annule (traçabilité).
        appointment = self.get_object()
        appointment.status = Appointment.Status.CANCELLED
        appointment.cancelled_at = timezone.now()
        appointment.cancelled_by = request.user
        appointment.save(update_fields=['status', 'cancelled_at', 'cancelled_by'])
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_200_OK)


class AvailableSlotsView(generics.GenericAPIView):
    """F2 — Renvoie les créneaux libres d'un professionnel pour une date donnée.

    GET /api/appointments/available-slots/?professional=<id>&medical_house=<id>&date=YYYY-MM-DD
    """

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
    """F6 — Consultation de l'historique patient.

    GET /api/patients/history/                 -> historique du patient connecte
    GET /api/patients/history/?patient=<id>     -> historique d'un patient donne
                                                    (professionnel ou admin uniquement)

    Secret medical : un professionnel ne peut consulter l'historique que
    d'un patient avec lequel il a au moins un rendez-vous. Un admin peut
    tout consulter. Un patient ne voit que son propre historique.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient')

        if user.role == 'PATIENT':
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
            # Secret medical : il faut un lien de soin reel (au moins un RDV)
            # entre ce professionnel et ce patient pour autoriser l'acces.
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
            # F4 (paiements) et F5 (documents) pas encore implementes :
            # ces cles seront remplies quand ces cartes seront codees.
            'payments': [],
            'documents': [],
        })