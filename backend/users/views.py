from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status, viewsets, filters
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, AuditLog
from .serializers import (
    RegisterSerializer, UserProfileSerializer, ChangePasswordSerializer,
    AdminUserSerializer, AdminUserCreateSerializer, AuditLogSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    """F9 — Modification du profil (infos, langue, photo)."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """F9 — Changement de mot de passe."""

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Mot de passe modifié avec succès.'}, status=status.HTTP_200_OK)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


def _log_action(actor, action, target_description):
    AuditLog.objects.create(actor=actor, action=action, target_description=target_description)


class AdminUserViewSet(viewsets.ModelViewSet):
    """F10 — Gestion des utilisateurs (patients, professionnels) par l'administrateur.

    Recherche : ?search=nom
    Tri : ?ordering=username ou ?ordering=-username, last_name, created_at
    Filtre : ?role=PATIENT / MEDECIN / KINE / PSYCHOLOGUE / ADMIN, ?is_active=true/false
    """

    permission_classes = (IsAdmin,)
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ('role', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering_fields = ('username', 'first_name', 'last_name', 'created_at')
    ordering = ('last_name', 'first_name')

    def get_queryset(self):
        return User.objects.exclude(role='ADMIN')

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        _log_action(self.request.user, AuditLog.Action.USER_CREATED, f"{user.username} ({user.role})")

    def perform_update(self, serializer):
        user = serializer.save()
        _log_action(self.request.user, AuditLog.Action.USER_UPDATED, f"{user.username}")

    def destroy(self, request, *args, **kwargs):
        # Pas de suppression definitive : on desactive/reactive uniquement,
        # pour preserver l'historique et le secret medical.
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        action = AuditLog.Action.USER_ACTIVATED if user.is_active else AuditLog.Action.USER_DEACTIVATED
        _log_action(request.user, action, f"{user.username}")
        return Response(AdminUserSerializer(user).data, status=status.HTTP_200_OK)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """N1/N5 — Consultation du journal d'audit (lecture seule, admin uniquement)."""

    permission_classes = (IsAdmin,)
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    filter_backends = (filters.OrderingFilter,)
    ordering = ('-timestamp',)