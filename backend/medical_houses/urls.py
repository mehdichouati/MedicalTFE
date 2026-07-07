from rest_framework.routers import DefaultRouter
from .views import MedicalHouseViewSet, MedicalHouseStaffViewSet

router = DefaultRouter()
router.register('medical-houses', MedicalHouseViewSet, basename='medical-house')
router.register('medical-house-staff', MedicalHouseStaffViewSet, basename='medical-house-staff')

urlpatterns = router.urls
