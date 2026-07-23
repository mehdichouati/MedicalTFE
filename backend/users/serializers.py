from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, AuditLog


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'role', 'phone_number')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Les deux mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            role=validated_data.get('role', User.Role.PATIENT),
            phone_number=validated_data.get('phone_number', ''),
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