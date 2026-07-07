from rest_framework import serializers
from .models import WeeklyAvailability, Absence


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
