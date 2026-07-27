from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

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


class PublicMedicalHouseView(APIView):
    """Page vitrine — infos publiques d'une maison medicale, sans authentification.

    Renvoie les infos de base, l'equipe (nom + role), et les avis patients
    approuves (avec moyenne), pour affichage sur la page d'accueil publique.
    """

    permission_classes = (permissions.AllowAny,)

    def get(self, request, pk=None):
        from appointments.models import Review

        house = MedicalHouse.objects.filter(pk=pk).first() if pk else MedicalHouse.objects.first()
        if house is None:
            return Response({'detail': 'Maison médicale introuvable.'}, status=404)

        staff = MedicalHouseStaff.objects.filter(medical_house=house).select_related('professional')
        staff_data = [
            {
                'id': s.professional.id,
                'full_name': s.professional.get_full_name() or s.professional.username,
                'role': s.professional.role,
            }
            for s in staff
        ]

        reviews = Review.objects.filter(
            appointment__medical_house=house,
            moderation_status=Review.ModerationStatus.APPROVED,
        ).select_related('patient').order_by('-created_at')

        reviews_data = [
            {
                'id': r.id,
                'rating': r.rating,
                'comment': r.comment,
                'author': 'Patient anonyme' if r.is_anonymous else r.patient.get_full_name() or r.patient.username,
                'created_at': r.created_at,
            }
            for r in reviews
        ]

        average_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None

        return Response({
            'id': house.id,
            'name': house.name,
            'address': house.address,
            'city': house.city,
            'postal_code': house.postal_code,
            'phone_number': house.phone_number,
            'email': house.email,
            'staff': staff_data,
            'reviews': reviews_data,
            'average_rating': average_rating,
            'review_count': len(reviews_data),
        })