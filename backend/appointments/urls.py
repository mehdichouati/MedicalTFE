from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    WeeklyAvailabilityViewSet, AbsenceViewSet, AppointmentViewSet,
    AvailableSlotsView, PatientHistoryView, MedicalDocumentViewSet, ReviewViewSet,
)

router = DefaultRouter()
router.register('availabilities', WeeklyAvailabilityViewSet, basename='availability')
router.register('absences', AbsenceViewSet, basename='absence')
router.register('appointments', AppointmentViewSet, basename='appointment')
router.register('medical-documents', MedicalDocumentViewSet, basename='medical-document')
router.register('reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('appointments/available-slots/', AvailableSlotsView.as_view(), name='available-slots'),
    path('patients/history/', PatientHistoryView.as_view(), name='patient-history'),
] + router.urls