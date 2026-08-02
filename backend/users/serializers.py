from datetime import date

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, AuditLog, LegalGuardianLink


def _calculate_age(date_of_birth):
    today = date.today()
    return today.year - date_of_birth.year - (
        (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    )

class RegisterSerializer(serializers.ModelSerializer):
    """F1/F15 — Inscription autonome. Refusee pour les moins de 16 ans
    (un parent doit creer le compte de l'enfant depuis son propre profil)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    date_of_birth = serializers.DateField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'role', 'phone_number', 'date_of_birth')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Les deux mots de passe ne correspondent pas."})

        age = _calculate_age(attrs['date_of_birth'])
        if age < 16:
            raise serializers.ValidationError({
                'date_of_birth': "Les comptes pour les moins de 16 ans doivent être créés par un parent ou "
                                  "tuteur légal depuis son propre profil."
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            role=validated_data.get('role', User.Role.PATIENT),
            phone_number=validated_data.get('phone_number', ''),
            date_of_birth=validated_data['date_of_birth'],
            password=validated_data['password'],
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
            'role', 'phone_number', 'is_active', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'role', 'phone_number', 'password')

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

class CreateDependentSerializer(serializers.Serializer):
    """F15 — Creation d'un compte mineur par le parent, avec declaration
    sur l'honneur (pas de document d'identite, cf. justification dans
    LegalGuardianLink)."""

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    date_of_birth = serializers.DateField()
    attestation = serializers.BooleanField()

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cette adresse email est déjà utilisée.")
        return value

    def validate_date_of_birth(self, value):
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

    def create(self, validated_data):
        guardian = self.context['request'].user

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
        )

        AuditLog.objects.create(
            actor=guardian,
            action=AuditLog.Action.USER_CREATED,
            target_description=f"Compte mineur {minor.username} créé par {guardian.username} (déclaration sur l'honneur)",
        )

        return minor


class DependentSerializer(serializers.ModelSerializer):
    """F15 — Affichage d'un enfant rattache, pour la liste cote parent."""

    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_of_birth', 'age', 'is_active')