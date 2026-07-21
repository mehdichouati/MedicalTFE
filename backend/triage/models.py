from django.conf import settings
from django.db import models


class TriageAssessment(models.Model):
    """F11 — Système d'orientation par arbre de questions.

    Enregistre chaque évaluation réalisée par un patient : les réponses
    brutes fournies, et l'orientation calculée côté serveur (jamais fournie
    par le client, pour éviter toute falsification).

    Méthodologie inspirée du principe des échelles de triage par symptômes
    (sans lien avec le diagnostic), notamment l'échelle belge ELISA
    (CHU Liège) et le Manchester Triage System — adapté ici en un outil de
    PRÉ-ORIENTATION grand public, sans valeur de triage clinique.
    """

    class Orientation(models.TextChoices):
        REPOS = 'REPOS', 'Repos et surveillance'
        TELECONSULTATION = 'TELECONSULTATION', 'Téléconsultation'
        CONSULTATION_SUR_PLACE = 'CONSULTATION_SUR_PLACE', 'Consultation sur place'
        URGENCE = 'URGENCE', 'Urgence — appeler les secours / se rendre aux urgences'

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='triage_assessments',
    )

    # Réponses brutes aux 5 questions de l'arbre (F11).
    signe_gravite_immediat = models.BooleanField()
    signe_visible_inquietant = models.BooleanField()
    douleur_intense = models.BooleanField()
    impact_activites_quotidiennes = models.BooleanField()
    depuis_plus_de_3_jours = models.BooleanField()

    orientation = models.CharField(max_length=30, choices=Orientation.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Triage {self.patient} — {self.get_orientation_display()} ({self.created_at:%d/%m/%Y})"