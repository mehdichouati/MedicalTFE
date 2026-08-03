from django.test import TestCase

from .logic import calculer_orientation
from .models import TriageAssessment


class CalculerOrientationTestCase(TestCase):
    """F11 — Tests unitaires de l'arbre de decision (9 chemins distincts,
    couverture exhaustive de la logique dans triage/logic.py)."""

    def test_q1_signe_gravite_immediat_donne_urgence(self):
        """Q1=OUI -> URGENCE, peu importe les autres reponses (garde-fou
        prioritaire, teste ici avec des valeurs 'douces' pour verifier
        que Q1 court-circuite bien tout le reste de l'arbre)."""
        resultat = calculer_orientation(
            signe_gravite_immediat=True,
            signe_visible_inquietant=False,
            douleur_intense=False,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.URGENCE)

    def test_q2_oui_q3a_douleur_intense_donne_consultation_sur_place(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=True,
            douleur_intense=True,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.CONSULTATION_SUR_PLACE)

    def test_q2_oui_q4a_impact_total_donne_consultation_sur_place(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=True,
            douleur_intense=False,
            impact_activites_quotidiennes=True,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.CONSULTATION_SUR_PLACE)

    def test_q2_oui_sans_douleur_ni_impact_donne_teleconsultation(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=True,
            douleur_intense=False,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.TELECONSULTATION)

    def test_q3b_douleur_intense_plus_3_jours_donne_consultation_sur_place(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=False,
            douleur_intense=True,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=True,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.CONSULTATION_SUR_PLACE)

    def test_q3b_douleur_intense_recente_donne_teleconsultation(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=False,
            douleur_intense=True,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.TELECONSULTATION)

    def test_q4c_impact_quotidien_plus_3_jours_donne_teleconsultation(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=False,
            douleur_intense=False,
            impact_activites_quotidiennes=True,
            depuis_plus_de_3_jours=True,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.TELECONSULTATION)

    def test_q4c_impact_quotidien_recent_donne_repos(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=False,
            douleur_intense=False,
            impact_activites_quotidiennes=True,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.REPOS)

    def test_aucun_symptome_donne_repos(self):
        resultat = calculer_orientation(
            signe_gravite_immediat=False,
            signe_visible_inquietant=False,
            douleur_intense=False,
            impact_activites_quotidiennes=False,
            depuis_plus_de_3_jours=False,
        )
        self.assertEqual(resultat, TriageAssessment.Orientation.REPOS)