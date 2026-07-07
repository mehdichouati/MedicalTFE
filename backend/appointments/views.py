from rest_framework import viewsets, permissions
from .models import WeeklyAvailability, Absence
from .serializers import WeeklyAvailabilitySerializer, AbsenceSerializer


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
