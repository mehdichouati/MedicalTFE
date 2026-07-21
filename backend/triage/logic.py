"""F11 — Logique de l'arbre d'orientation patient.

Arbre de décision strict a 5 questions fermees, inspire du principe
des echelles de triage par symptomes (sans lien avec le diagnostic),
notamment l'echelle belge ELISA et le Manchester Triage System.

IMPORTANT : ceci est un outil de PRE-ORIENTATION grand public,
pas un outil de triage clinique. Le resultat est une aide a
l'orientation, jamais une decision medicale definitive (cf. CDC F11).
"""

from .models import TriageAssessment


def calculer_orientation(
    signe_gravite_immediat: bool,
    signe_visible_inquietant: bool,
    douleur_intense: bool,
    impact_activites_quotidiennes: bool,
    depuis_plus_de_3_jours: bool,
) -> str:
    """Calcule l'orientation selon l'arbre de decision strict (F11).

    Q1 - Signe de gravite immediate (difficulte a respirer, douleur
         thoracique, perte de connaissance, saignement important) ?
      OUI -> URGENCE (fin, sans regarder le reste)
      NON -> Q2

    Q2 - Signe visible inquietant (plaie ouverte, gonflement important,
         rougeur etendue, fievre elevee) ?
      OUI -> Q3a : douleur intense ?
               OUI -> CONSULTATION_SUR_PLACE
               NON -> Q4a : impact total sur les activites quotidiennes ?
                        OUI -> CONSULTATION_SUR_PLACE
                        NON -> TELECONSULTATION
      NON -> Q3b : douleur intense ?
               OUI -> Q4b : depuis plus de 3 jours ?
                        OUI -> CONSULTATION_SUR_PLACE
                        NON -> TELECONSULTATION
               NON -> Q4c : impact sur les activites quotidiennes ?
                        OUI -> Q5 : depuis plus de 3 jours ?
                                 OUI -> TELECONSULTATION
                                 NON -> REPOS
                        NON -> REPOS
    """
    Orientation = TriageAssessment.Orientation

    # Q1 - garde-fou prioritaire, toujours verifie en premier.
    if signe_gravite_immediat:
        return Orientation.URGENCE

    # Q2
    if signe_visible_inquietant:
        # Q3a
        if douleur_intense:
            return Orientation.CONSULTATION_SUR_PLACE
        # Q4a
        if impact_activites_quotidiennes:
            return Orientation.CONSULTATION_SUR_PLACE
        return Orientation.TELECONSULTATION

    # Q3b
    if douleur_intense:
        # Q4b
        if depuis_plus_de_3_jours:
            return Orientation.CONSULTATION_SUR_PLACE
        return Orientation.TELECONSULTATION

    # Q4c
    if impact_activites_quotidiennes:
        # Q5
        if depuis_plus_de_3_jours:
            return Orientation.TELECONSULTATION
        return Orientation.REPOS

    return Orientation.REPOS
