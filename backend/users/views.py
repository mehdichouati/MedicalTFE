from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, AuditLog, LegalGuardianLink
from .serializers import (
    RegisterSerializer, UserProfileSerializer, ChangePasswordSerializer,
    AdminUserSerializer, AdminUserCreateSerializer, AuditLogSerializer,
    CreateDependentSerializer, DependentSerializer, ResubmitProofSerializer,
    GuardianRequestSerializer, RejectGuardianRequestSerializer,
)
from .permissions import IsSecretaryOrAdmin


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """F15 — Bloque la connexion autonome des comptes mineurs de moins de
    16 ans : ils n'ont pas de connexion propre, seul le parent agit pour
    eux via son propre compte."""

    default_error_messages = {
        'minor_under_16': "Ce compte est géré par un parent ou tuteur légal. Veuillez vous connecter avec son compte.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_minor_under_16:
            self.fail('minor_under_16')
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """N1 — Throttle dedie (5/min) pour limiter les tentatives de
    connexion par force brute, en plus de la limite generale 'anon'."""

    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'login'


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
        qs = User.objects.exclude(role='ADMIN')
        if self.request.query_params.get('professionals_only') == 'true':
            qs = qs.exclude(role='PATIENT')
        return qs

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


class DependentsView(generics.ListCreateAPIView):
    """F15 — Liste et creation des comptes enfants rattaches au parent connecte.

    La liste inclut les liens en attente et refuses (pour afficher leur
    statut au parent) ; seuls les liens valides donnent des droits
    (voir _is_guardian_of dans appointments et payments).
    """

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateDependentSerializer
        return DependentSerializer

    def get_queryset(self):
        links = LegalGuardianLink.objects.filter(guardian=self.request.user, revoked_at__isnull=True)
        minor_ids = links.values_list('minor_id', flat=True)
        return User.objects.filter(id__in=minor_ids).select_related('guardian_link')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        minor = serializer.save()
        return Response(DependentSerializer(minor).data, status=status.HTTP_201_CREATED)


class DependentResubmitView(APIView):
    """F15 — Le parent renvoie un justificatif apres un refus du secretariat."""

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, pk):
        link = get_object_or_404(
            LegalGuardianLink, minor_id=pk, guardian=request.user, revoked_at__isnull=True,
        )
        if link.status != LegalGuardianLink.Status.REJECTED:
            return Response(
                {'detail': "Seule une demande refusée peut être renvoyée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ResubmitProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        link.proof_document = serializer.validated_data['proof_document']
        link.status = LegalGuardianLink.Status.PENDING
        link.rejection_reason = ''
        link.reviewed_by = None
        link.reviewed_at = None
        link.save()
        return Response(DependentSerializer(link.minor).data, status=status.HTTP_200_OK)


class GuardianRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """F15 — Validation des liens parentaux par le secretariat.

    GET    /auth/guardian-requests/?status=PENDING   liste des demandes
    GET    /auth/guardian-requests/<id>/document/    justificatif (protege)
    POST   /auth/guardian-requests/<id>/approve/     valider
    POST   /auth/guardian-requests/<id>/reject/      refuser (motif obligatoire)

    Apres la decision, le justificatif est supprime (minimisation RGPD).
    """

    permission_classes = (IsSecretaryOrAdmin,)
    serializer_class = GuardianRequestSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ('status',)

    def get_queryset(self):
        return LegalGuardianLink.objects.filter(revoked_at__isnull=True).select_related(
            'guardian', 'minor', 'reviewed_by',
        ).order_by('created_at')

    @action(detail=True, methods=['get'])
    def document(self, request, pk=None):
        link = self.get_object()
        if not link.proof_document:
            return Response({'detail': "Aucun justificatif disponible."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(link.proof_document.open('rb'), as_attachment=False)

    def _check_pending(self, link):
        if link.status != LegalGuardianLink.Status.PENDING:
            return Response(
                {'detail': "Cette demande a déjà été traitée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def _close_review(self, link, new_status, reason=''):
        if link.proof_document:
            link.proof_document.delete(save=False)
        link.proof_document = None
        link.status = new_status
        link.rejection_reason = reason
        link.reviewed_by = self.request.user
        link.reviewed_at = timezone.now()
        link.save()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        link = self.get_object()
        error = self._check_pending(link)
        if error:
            return error
        self._close_review(link, LegalGuardianLink.Status.APPROVED)
        _log_action(
            request.user, AuditLog.Action.GUARDIAN_LINK_APPROVED,
            f"{link.guardian.username} -> {link.minor.username}",
        )
        return Response(self.get_serializer(link).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        link = self.get_object()
        error = self._check_pending(link)
        if error:
            return error
        serializer = RejectGuardianRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['rejection_reason']
        self._close_review(link, LegalGuardianLink.Status.REJECTED, reason)
        _log_action(
            request.user, AuditLog.Action.GUARDIAN_LINK_REJECTED,
            f"{link.guardian.username} -> {link.minor.username} : {reason}",
        )
        return Response(self.get_serializer(link).data, status=status.HTTP_200_OK)