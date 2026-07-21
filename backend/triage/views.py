from rest_framework import viewsets, permissions
from .models import TriageAssessment
from .serializers import TriageAssessmentSerializer


class TriageAssessmentViewSet(viewsets.ModelViewSet):
    """F11 — Systeme d'orientation par arbre de questions."""

    serializer_class = TriageAssessmentSerializer
    http_method_names = ['get', 'post', 'head']  # pas de modification/suppression d'une evaluation passee

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return TriageAssessment.objects.all()
        # Un patient ne voit que ses propres evaluations (F6 historique).
        # Un professionnel peut consulter celles de ses propres patients
        # si besoin plus tard ; pour l'instant, on reste strict : chacun
        # ne voit que ce qui le concerne directement.
        return TriageAssessment.objects.filter(patient=user)

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)
