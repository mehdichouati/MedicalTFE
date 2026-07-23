from django.db.models import Q
from rest_framework import serializers
from .models import WeeklyAvailability, Absence, Appointment, MedicalDocument

PROFESSIONAL_ROLES = ('MEDECIN', 'KINE', 'PSYCHOLOGUE')


class WeeklyAvailabilitySerializer(serializers.ModelSerializer):
    weekday_display = serializers.CharField(source='get_weekday_display', read_only=True)
    professional_username = serializers.CharField(source='professional.username', read_only=True)
    professional = serializers.PrimaryKeyRelatedField(queryset=WeeklyAvailability._meta.get_field('professional').related_model.objects.all(), required=False)

    class Meta:
        model = WeeklyAvailability
        fields = (
            'id', 'professional', 'professional_username', 'medical_house',
            'weekday', 'weekday_display', 'start_time', 'end_time',
        )
        read_only_fields = ('id',)

    def validate(self, attrs):
        if attrs['start_time'] >= attrs['end_time']:
            raise serializers.ValidationError("L'heure de début doit précéder l'heure de fin.")
        return attrs


class AbsenceSerializer(serializers.ModelSerializer):
    professional_username = serializers.CharField(source='professional.username', read_only=True)
    professional = serializers.PrimaryKeyRelatedField(queryset=Absence._meta.get_field('professional').related_model.objects.all(), required=False)

    class Meta:
        model = Absence
        fields = ('id', 'professional', 'professional_username', 'start_datetime', 'end_datetime', 'reason', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate(self, attrs):
        if attrs['start_datetime'] >= attrs['end_datetime']:
            raise serializers.ValidationError("La date de début doit précéder la date de fin.")
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    patient_username = serializers.CharField(source='patient.username', read_only=True)
    professional_username = serializers.CharField(source='professional.username', read_only=True)
    professional_role = serializers.CharField(source='professional.role', read_only=True)
    medical_house_name = serializers.CharField(source='medical_house.name', read_only=True)
    patient = serializers.PrimaryKeyRelatedField(
        queryset=Appointment._meta.get_field('patient').related_model.objects.all(), required=False,
    )
    professional = serializers.PrimaryKeyRelatedField(
        queryset=Appointment._meta.get_field('professional').related_model.objects.all(),
    )

    class Meta:
        model = Appointment
        fields = (
            'id', 'patient', 'patient_username', 'professional', 'professional_username',
            'professional_role', 'medical_house', 'medical_house_name',
            'start_datetime', 'end_datetime', 'status', 'reason',
            'cancelled_at', 'cancelled_by', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'status', 'cancelled_at', 'cancelled_by', 'created_at', 'updated_at')

    def validate(self, attrs):
        start = attrs['start_datetime']
        end = attrs['end_datetime']
        professional = attrs['professional']
        medical_house = attrs['medical_house']

        if start >= end:
            raise serializers.ValidationError("L'heure de début doit précéder l'heure de fin.")

        # F2 — "Choisir une discipline" : le professionnel visé doit bien être
        # un médecin, un kiné ou un psychologue (pas un patient/admin).
        if professional.role not in PROFESSIONAL_ROLES:
            raise serializers.ValidationError(
                "Le rendez-vous doit être pris avec un médecin, un kiné ou un psychologue."
            )

        # F2 — "Respecter les horaires et disponibilités" : le créneau doit
        # tomber dans une disponibilité hebdomadaire du professionnel...
        weekday = start.weekday()
        in_availability = WeeklyAvailability.objects.filter(
            professional=professional,
            medical_house=medical_house,
            weekday=weekday,
            start_time__lte=start.time(),
            end_time__gte=end.time(),
        ).exists()
        if not in_availability:
            raise serializers.ValidationError(
                "Ce créneau ne correspond à aucune disponibilité déclarée par le professionnel."
            )

        # ... ne doit pas tomber sur une absence déclarée...
        overlaps_absence = Absence.objects.filter(
            professional=professional,
            start_datetime__lt=end,
            end_datetime__gt=start,
        ).exists()
        if overlaps_absence:
            raise serializers.ValidationError("Le professionnel est absent sur ce créneau.")

        # ... et ne doit pas chevaucher un rendez-vous déjà pris (patient ou pro).
        qs = Appointment.objects.filter(
            start_datetime__lt=end,
            end_datetime__gt=start,
        ).exclude(status=Appointment.Status.CANCELLED)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.filter(professional=professional).exists():
            raise serializers.ValidationError("Le professionnel a déjà un rendez-vous sur ce créneau.")

        patient = attrs.get('patient', getattr(self.instance, 'patient', None))
        if patient is not None and qs.filter(patient=patient).exists():
            raise serializers.ValidationError("Vous avez déjà un rendez-vous sur ce créneau.")

        return attrs

class MedicalDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = MedicalDocument
        fields = (
            'id', 'patient', 'uploaded_by', 'uploaded_by_username',
            'document_type', 'document_type_display', 'title', 'file', 'uploaded_at',
        )
        read_only_fields = ('id', 'uploaded_by', 'uploaded_at')