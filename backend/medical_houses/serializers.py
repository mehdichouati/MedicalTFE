from rest_framework import serializers
from .models import MedicalHouse, MedicalHouseStaff


class MedicalHouseStaffSerializer(serializers.ModelSerializer):
    professional_username = serializers.CharField(source='professional.username', read_only=True)
    professional_role = serializers.CharField(source='professional.role', read_only=True)

    class Meta:
        model = MedicalHouseStaff
        fields = ('id', 'medical_house', 'professional', 'professional_username', 'professional_role', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class MedicalHouseSerializer(serializers.ModelSerializer):
    staff_count = serializers.IntegerField(source='staff.count', read_only=True)

    class Meta:
        model = MedicalHouse
        fields = (
            'id', 'name', 'address', 'city', 'postal_code',
            'phone_number', 'email', 'is_active', 'staff_count', 'created_at',
        )
        read_only_fields = ('id', 'created_at')
