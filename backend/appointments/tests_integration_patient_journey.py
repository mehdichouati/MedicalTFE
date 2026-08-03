"""#22 — Test d'integration : parcours patient complet de bout en bout.

Inscription -> connexion -> triage -> reservation -> paiement -> annulation
avec remboursement automatique. Contrairement aux tests unitaires (#21),
on n'appelle jamais directement une fonction interne : tout passe par les
vraies routes de l'API, comme le ferait un utilisateur reel. Seul Stripe
est simule (aucun appel reseau reel dans les tests).
"""

from datetime import date, datetime, time, timedelta
from unittest.mock import Mock, patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from appointments.models import WeeklyAvailability
from medical_houses.models import MedicalHouse
from notifications.models import Notification
from payments.models import Payment
from users.models import AuditLog, User


def _next_weekday(weekday):
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class PatientJourneyIntegrationTestCase(APITestCase):
    """F1 -> F11 -> F2 -> F4, scenario complet."""

    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_journey', email='doc_journey@test.be', password='Password123!', role='MEDECIN',
        )
        self.monday = _next_weekday(0)
        WeeklyAvailability.objects.create(
            professional=self.medecin, medical_house=self.house,
            weekday=0, start_time=time(9, 0), end_time=time(11, 0),
        )

    @patch('payments.views.stripe.Webhook.construct_event')
    @patch('stripe.Refund.create')
    @patch('payments.views.stripe.PaymentIntent.create')
    def test_parcours_patient_complet(self, mock_intent_create, mock_refund, mock_webhook_event):
        # --- 1. Inscription (F1) ---
        register_response = self.client.post('/api/auth/register/', {
            'username': 'patient_journey', 'email': 'patient_journey@test.be',
            'password': 'Password123!', 'password2': 'Password123!',
            'date_of_birth': '1995-06-15', 'health_data_consent': True,
        })
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='patient_journey')
        self.assertTrue(user.health_data_consent_given)

        # --- 2. Connexion (F1) ---
        login_response = self.client.post('/api/auth/login/', {
            'username': 'patient_journey', 'password': 'Password123!',
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # --- 3. Triage (F11) ---
        triage_response = self.client.post('/api/triage-assessments/', {
            'signe_gravite_immediat': False,
            'signe_visible_inquietant': False,
            'douleur_intense': False,
            'impact_activites_quotidiennes': False,
            'depuis_plus_de_3_jours': False,
        })
        self.assertEqual(triage_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(triage_response.data['orientation'], 'REPOS')

        # --- 4. Reservation (F2) ---
        start = timezone.make_aware(datetime.combine(self.monday, time(9, 0)))
        end = timezone.make_aware(datetime.combine(self.monday, time(9, 30)))
        booking_response = self.client.post('/api/appointments/', {
            'professional': self.medecin.id, 'medical_house': self.house.id,
            'start_datetime': start.isoformat(), 'end_datetime': end.isoformat(),
            'reason': 'Test parcours complet',
        })
        self.assertEqual(booking_response.status_code, status.HTTP_201_CREATED)
        appointment_id = booking_response.data['id']

        # --- 5. Paiement (F4) ---
        mock_intent_create.return_value = Mock(id='pi_journey_test', client_secret='secret_journey_test')
        payment_response = self.client.post('/api/payments/create-intent/', {
            'appointment': appointment_id, 'amount_cents': 2500,
        })
        self.assertEqual(payment_response.status_code, status.HTTP_200_OK)

        mock_webhook_event.return_value = {
            'type': 'payment_intent.succeeded',
            'data': {'object': {'id': 'pi_journey_test'}},
        }
        webhook_response = self.client.post(
            '/api/payments/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='fake_sig',
        )
        self.assertEqual(webhook_response.status_code, status.HTTP_200_OK)

        payment = Payment.objects.get(appointment_id=appointment_id)
        self.assertEqual(payment.status, Payment.Status.SUCCEEDED)

        payment_notification_exists = Notification.objects.filter(
            recipient=user, notification_type=Notification.NotificationType.PAYMENT_SUCCEEDED,
        ).exists()
        self.assertTrue(payment_notification_exists)

        # --- 6. Annulation avec remboursement automatique (F4) ---
        cancel_response = self.client.delete(f'/api/appointments/{appointment_id}/')
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data['status'], 'CANCELLED')

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.REFUNDED)
        self.assertEqual(payment.refunded_amount_cents, 2500)
        mock_refund.assert_called_once_with(payment_intent='pi_journey_test')

        refund_logged = AuditLog.objects.filter(action=AuditLog.Action.PAYMENT_REFUNDED).exists()
        self.assertTrue(refund_logged)

        cancellation_notification_exists = Notification.objects.filter(
            recipient=user, notification_type=Notification.NotificationType.APPOINTMENT_CANCELLATION,
        ).exists()
        self.assertTrue(cancellation_notification_exists)