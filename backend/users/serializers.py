import os
import re
from datetime import date

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, AuditLog, LegalGuardianLink


def _calculate_age(date_of_birth):
    today = date.today()
    return today.year - date_of_birth.year - (
        (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    )


def _validate_license_number(role, number):
    """F16 — Controle du format du numero d'habilitation selon le role.

    Medecin et kine : numero INAMI de 11 chiffres. Psychologue : numero
    d'inscription a la Commission des Psychologues, obligatoire. Le
    numero est verifie par l'admin dans le registre officiel avant
    d'etre encode.
    """
    number = (number or '').strip()

    if role in (User.Role.MEDECIN, User.Role.KINE) and not re.fullmatch(r'\d{11}', number):
        raise serializers.ValidationError({
            'license_number': "Le numéro INAMI doit contenir exactement 11 chiffres."
        })
    if role == User.Role.PSYCHOLOGUE and not number:
        raise serializers.ValidationError({
            'license_number': "Le numéro d'inscription à la Commission des Psychologues est obligatoire."
        })

    return number


class RegisterSerializer(serializers.ModelSerializer):
    """F1/F15 — Inscription autonome. Refusee pour les moins de 16 ans
    (un parent doit creer le compte de l'enfant depuis son propre profil)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    date_of_birth = serializers.DateField(required=True)
    # F1 — Consentement explicite au traitement des donnees de sante
    # (art. 9 RGPD), obligatoire pour finaliser l'inscription.
    health_data_consent = serializers.BooleanField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'phone_number', 'date_of_birth', 'health_data_consent')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Les deux mots de passe ne correspondent pas."})

        if not attrs.get('health_data_consent'):
            raise serializers.ValidationError({
                'health_data_consent': "Le consentement au traitement de vos données de santé est requis pour créer un compte."
            })

        age = _calculate_age(attrs['date_of_birth'])
        if age < 16:
            raise serializers.ValidationError({
                'date_of_birth': "Les comptes pour les moins de 16 ans doivent être créés par un parent ou "
                                  "tuteur légal depuis son propre profil."
            })

        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        validated_data.pop('password2')
        validated_data.pop('health_data_consent')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            # N1 — L'inscription publique cree uniquement des patients.
            # Les comptes professionnels sont crees par l'administrateur
            # apres verification de l'habilitation (INAMI / Commission).
            role=User.Role.PATIENT,
            phone_number=validated_data.get('phone_number', ''),
            date_of_birth=validated_data['date_of_birth'],
            password=validated_data['password'],
            health_data_consent_given=True,
            health_data_consent_at=timezone.now(),
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'role', 'phone_number',
            'language', 'profile_photo', 'is_email_verified', 'created_at',
        )
        read_only_fields = ('id', 'is_email_verified', 'created_at')

    def update(self, instance, validated_data):
        # F1/N1 — si l'email change, la verification precedente ne vaut
        # plus (elle etait valable pour l'ancienne adresse).
        if 'email' in validated_data and validated_data['email'] != instance.email:
            instance.is_email_verified = False
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """F9 — Changement de mot de passe (exige l'ancien pour confirmation)."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Ancien mot de passe incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Les deux nouveaux mots de passe ne correspondent pas."})
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """F10 — Gestion des utilisateurs par l'administrateur (liste, creation, activation)."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name', 'full_name', 'email',
            'role', 'phone_number', 'license_number', 'is_active', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def validate(self, attrs):
        # F16 — On ne controle le numero que si le role ou le numero
        # change (une simple activation/desactivation n'est pas bloquee).
        if 'role' in attrs or 'license_number' in attrs:
            role = attrs.get('role', getattr(self.instance, 'role', None))
            number = attrs.get('license_number', getattr(self.instance, 'license_number', ''))
            attrs['license_number'] = _validate_license_number(role, number)
        return attrs


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'role', 'phone_number', 'license_number', 'password')

    def validate(self, attrs):
        attrs['license_number'] = _validate_license_number(
            attrs.get('role'), attrs.get('license_number', ''),
        )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ('id', 'actor', 'actor_username', 'action', 'action_display', 'target_description', 'timestamp')


# F15 — Justificatif du lien parental : formats et taille acceptes.
PROOF_ALLOWED_EXTENSIONS = ('.pdf', '.jpg', '.jpeg', '.png')
PROOF_MAX_SIZE = 5 * 1024 * 1024  # 5 Mo


def _validate_proof_document(file):
    extension = os.path.splitext(file.name)[1].lower()
    if extension not in PROOF_ALLOWED_EXTENSIONS:
        raise serializers.ValidationError("Formats acceptés : PDF, JPG ou PNG.")
    if file.size > PROOF_MAX_SIZE:
        raise serializers.ValidationError("Le fichier ne doit pas dépasser 5 Mo.")
    return file


class CreateDependentSerializer(serializers.Serializer):
    """F15 — Creation d'un compte mineur par le parent.

    Moins de 16 ans : justificatif obligatoire, le lien reste en attente
    (PENDING) jusqu'a la validation par le secretariat.
    16-17 ans : declaration sur l'honneur suffisante, lien valide d'office.
    """

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    date_of_birth = serializers.DateField()
    attestation = serializers.BooleanField()
    proof_document = serializers.FileField(required=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cette adresse email est déjà utilisée.")
        return value

    def validate_date_of_birth(self, value):
        if value > date.today():
            raise serializers.ValidationError("La date de naissance ne peut pas être dans le futur.")
        age = _calculate_age(value)
        if age >= 18:
            raise serializers.ValidationError(
                "Cette fonctionnalité est réservée à la création de comptes pour des mineurs."
            )
        return value

    def validate_attestation(self, value):
        if not value:
            raise serializers.ValidationError(
                "Vous devez certifier être le représentant légal de ce mineur."
            )
        return value

    def validate_proof_document(self, value):
        return _validate_proof_document(value)

    def validate(self, attrs):
        age = _calculate_age(attrs['date_of_birth'])
        if age < 16 and not attrs.get('proof_document'):
            raise serializers.ValidationError({
                'proof_document': "Un justificatif (composition de ménage ou extrait d'acte de naissance) "
                                  "est obligatoire pour un enfant de moins de 16 ans.",
            })
        return attrs

    def create(self, validated_data):
        guardian = self.context['request'].user
        age = _calculate_age(validated_data['date_of_birth'])
        needs_review = age < 16

        import secrets
        temp_password = secrets.token_urlsafe(12)

        minor = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            role=User.Role.PATIENT,
            date_of_birth=validated_data['date_of_birth'],
            password=temp_password,
        )

        LegalGuardianLink.objects.create(
            guardian=guardian,
            minor=minor,
            attested_on_honour=True,
            status=LegalGuardianLink.Status.PENDING if needs_review else LegalGuardianLink.Status.APPROVED,
            proof_document=validated_data.get('proof_document') if needs_review else None,
        )

        description = "en attente de validation" if needs_review else "déclaration sur l'honneur"
        AuditLog.objects.create(
            actor=guardian,
            action=AuditLog.Action.USER_CREATED,
            target_description=f"Compte mineur {minor.username} créé par {guardian.username} ({description})",
        )

        return minor


class ResubmitProofSerializer(serializers.Serializer):
    """F15 — Nouveau justificatif envoye par le parent apres un refus."""

    proof_document = serializers.FileField()

    def validate_proof_document(self, value):
        return _validate_proof_document(value)


class DependentSerializer(serializers.ModelSerializer):
    """F15 — Affichage d'un enfant rattache, pour la liste cote parent."""

    age = serializers.IntegerField(read_only=True)
    link_status = serializers.CharField(source='guardian_link.status', read_only=True)
    rejection_reason = serializers.CharField(source='guardian_link.rejection_reason', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_of_birth', 'age', 'is_active', 'link_status', 'rejection_reason')


class GuardianRequestSerializer(serializers.ModelSerializer):
    """F15 — Demande de rattachement vue par le secretariat.

    Le fichier n'est jamais expose par URL : il est telecharge via une
    route protegee (secretariat / admin uniquement)."""

    guardian_username = serializers.CharField(source='guardian.username', read_only=True)
    guardian_email = serializers.CharField(source='guardian.email', read_only=True)
    minor_username = serializers.CharField(source='minor.username', read_only=True)
    minor_date_of_birth = serializers.DateField(source='minor.date_of_birth', read_only=True)
    minor_age = serializers.IntegerField(source='minor.age', read_only=True)
    has_document = serializers.SerializerMethodField()
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    class Meta:
        model = LegalGuardianLink
        fields = (
            'id', 'guardian_username', 'guardian_email', 'minor_username', 'minor_date_of_birth',
            'minor_age', 'status', 'has_document', 'rejection_reason', 'created_at',
            'reviewed_at', 'reviewed_by_username',
        )

    def get_has_document(self, obj):
        return bool(obj.proof_document)


class RejectGuardianRequestSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(max_length=255)