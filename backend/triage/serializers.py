from rest_framework import serializers
from .models import TriageAssessment
from .logic import calculer_orientation


class TriageAssessmentSerializer(serializers.ModelSerializer):
    orientation_display = serializers.CharField(source='get_orientation_display', read_only=True)

    class Meta:
        model = TriageAssessment
        fields = (
            'id', 'patient', 'signe_gravite_immediat', 'signe_visible_inquietant',
            'douleur_intense', 'impact_activites_quotidiennes', 'depuis_plus_de_3_jours',
            'orientation', 'orientation_display', 'created_at',
        )
        read_only_fields = ('id', 'patient', 'orientation', 'created_at')

    def create(self, validated_data):
        # F11 — le resultat n'est jamais fourni par le client : il est
        # recalcule ici, cote serveur, a partir des reponses brutes.
        validated_data['orientation'] = calculer_orientation(
            signe_gravite_immediat=validated_data['signe_gravite_immediat'],
            signe_visible_inquietant=validated_data['signe_visible_inquietant'],
            douleur_intense=validated_data['douleur_intense'],
            impact_activites_quotidiennes=validated_data['impact_activites_quotidiennes'],
            depuis_plus_de_3_jours=validated_data['depuis_plus_de_3_jours'],
        )
        return super().create(validated_data)
