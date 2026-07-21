from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    WeeklyAvailabilityViewSet, AbsenceViewSet, AppointmentViewSet,
    AvailableSlotsView, PatientHistoryView,
)

router = DefaultRouter()
router.register('availabilities', WeeklyAvailabilityViewSet, basename='availability')
router.register('absences', AbsenceViewSet, basename='absence')
router.register('appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('appointments/available-slots/', AvailableSlotsView.as_view(), name='available-slots'),
    path('patients/history/', PatientHistoryView.as_view(), name='patient-history'),
] + router.urls