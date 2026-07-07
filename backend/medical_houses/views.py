from rest_framework import viewsets, permissions
from .models import MedicalHouse, MedicalHouseStaff
from .serializers import MedicalHouseSerializer, MedicalHouseStaffSerializer
from users.permissions import IsAdminRole


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class MedicalHouseViewSet(viewsets.ModelViewSet):
    queryset = MedicalHouse.objects.all()
    serializer_class = MedicalHouseSerializer
    permission_classes = (IsAdminOrReadOnly,)


class MedicalHouseStaffViewSet(viewsets.ModelViewSet):
    queryset = MedicalHouseStaff.objects.all()
    serializer_class = MedicalHouseStaffSerializer
    permission_classes = (IsAdminRole,)
