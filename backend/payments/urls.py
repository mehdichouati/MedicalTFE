from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, CreatePaymentIntentView, stripe_webhook

router = DefaultRouter()
router.register('payments', PaymentViewSet, basename='payment')

urlpatterns = [
    path('payments/create-intent/', CreatePaymentIntentView.as_view(), name='create-payment-intent'),
    path('payments/webhook/', stripe_webhook, name='stripe-webhook'),
] + router.urls