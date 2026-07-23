from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView, ProfileView, ChangePasswordView,
    AdminUserViewSet, AuditLogViewSet,
)

router = DefaultRouter()
router.register('admin/users', AdminUserViewSet, basename='admin-user')
router.register('admin/audit-log', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('login/refresh/', TokenRefreshView.as_view(), name='login-refresh'),
    path('me/', ProfileView.as_view(), name='profile'),
    path('me/change-password/', ChangePasswordView.as_view(), name='change-password'),
] + router.urls