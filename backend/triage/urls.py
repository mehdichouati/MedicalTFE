from rest_framework.routers import DefaultRouter
from .views import TriageAssessmentViewSet

router = DefaultRouter()
router.register('triage-assessments', TriageAssessmentViewSet, basename='triage-assessment')

urlpatterns = router.urls
