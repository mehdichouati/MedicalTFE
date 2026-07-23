from django.urls import path
from .views import AdminDashboardView

urlpatterns = [
    path('dashboard/admin/', AdminDashboardView.as_view(), name='admin-dashboard'),
]