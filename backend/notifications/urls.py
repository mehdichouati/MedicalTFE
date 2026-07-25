from django.urls import path
from .views import NotificationPreferenceView

urlpatterns = [
    path('notifications/preferences/', NotificationPreferenceView.as_view(), name='notification-preferences'),
]