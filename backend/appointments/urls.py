from rest_framework.routers import DefaultRouter
from .views import WeeklyAvailabilityViewSet, AbsenceViewSet

router = DefaultRouter()
router.register('availabilities', WeeklyAvailabilityViewSet, basename='availability')
router.register('absences', AbsenceViewSet, basename='absence')

urlpatterns = router.urls
