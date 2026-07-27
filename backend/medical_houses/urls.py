from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MedicalHouseViewSet, MedicalHouseStaffViewSet, PublicMedicalHouseView

router = DefaultRouter()
router.register('medical-houses', MedicalHouseViewSet, basename='medical-house')
router.register('medical-house-staff', MedicalHouseStaffViewSet, basename='medical-house-staff')

urlpatterns = [
    path('public/medical-house/', PublicMedicalHouseView.as_view(), name='public-medical-house'),
] + router.urls