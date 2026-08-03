from datetime import timedelta
from unittest.mock import Mock, patch

import stripe
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from appointments.models import Appointment
from appointments.views import _apply_cancellation_policy
from medical_houses.models import MedicalHouse
from users.models import AuditLog, User

from .models import Payment


class PaymentTestCaseBase(APITestCase):
    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_pay', email='doc_pay@test.be', password='Password123!', role='MEDECIN',
        )
        self.patient = User.objects.create_user(
            username='patient_pay', email='patient_pay@test.be', password='Password123!', role='PATIENT',
        )
        self.appointment = Appointment.objects.create(
            patient=self.patient, professional=self.medecin, medical_house=self.house,
            start_datetime=timezone.now() + timedelta(days=5),
            end_datetime=timezone.now() + timedelta(days=5, minutes=30),
        )


class CreatePaymentIntentViewTestCase(PaymentTestCaseBase):
    """F4 — Tests de la creation du PaymentIntent Stripe (Stripe mocke,
    aucun appel reseau reel)."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.patient)

    @patch('payments.views.stripe.PaymentIntent.create')
    def test_creation_payment_intent_cree_un_paiement_en_attente(self, mock_create):
        mock_create.return_value = Mock(id='pi_test_1', client_secret='secret_test_1')

        response = self.client.post('/api/payments/create-intent/', {
            'appointment': self.appointment.id, 'amount_cents': 2500,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['client_secret'], 'secret_test_1')
        payment = Payment.objects.get(appointment=self.appointment)
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertEqual(payment.stripe_payment_intent_id, 'pi_test_1')

    @patch('payments.views.stripe.PaymentIntent.retrieve')
    @patch('payments.views.stripe.PaymentIntent.create')
    def test_reutilise_le_payment_intent_existant_si_deja_en_attente(self, mock_create, mock_retrieve):
        mock_create.return_value = Mock(id='pi_test_2', client_secret='secret_test_2')
        mock_retrieve.return_value = Mock(id='pi_test_2', client_secret='secret_test_2')

        self.client.post('/api/payments/create-intent/', {'appointment': self.appointment.id, 'amount_cents': 2500})
        self.client.post('/api/payments/create-intent/', {'appointment': self.appointment.id, 'amount_cents': 2500})

        self.assertEqual(mock_create.call_count, 1)
        self.assertEqual(mock_retrieve.call_count, 1)

    def test_refuse_si_deja_paye(self):
        Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.SUCCEEDED,
        )
        response = self.client.post('/api/payments/create-intent/', {
            'appointment': self.appointment.id, 'amount_cents': 2500,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class StripeWebhookTestCase(PaymentTestCaseBase):
    """F4/N1 — Tests du webhook Stripe (source de verite pour le statut
    d'un paiement) et de sa journalisation dans l'audit log."""

    def setUp(self):
        super().setUp()
        self.payment = Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.PENDING,
            stripe_payment_intent_id='pi_webhook_test',
        )

    @patch('payments.views.stripe.Webhook.construct_event')
    def test_webhook_payment_succeeded_met_a_jour_le_statut_et_journalise(self, mock_construct):
        mock_construct.return_value = {
            'type': 'payment_intent.succeeded',
            'data': {'object': {'id': 'pi_webhook_test'}},
        }
        response = self.client.post(
            '/api/payments/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='fake_sig',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.SUCCEEDED)
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.Action.PAYMENT_SUCCEEDED).exists()
        )

    @patch('payments.views.stripe.Webhook.construct_event')
    def test_webhook_payment_failed_met_a_jour_le_statut_et_journalise(self, mock_construct):
        mock_construct.return_value = {
            'type': 'payment_intent.payment_failed',
            'data': {'object': {'id': 'pi_webhook_test'}},
        }
        response = self.client.post(
            '/api/payments/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='fake_sig',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.FAILED)
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.Action.PAYMENT_FAILED).exists()
        )

    @patch('payments.views.stripe.Webhook.construct_event')
    def test_webhook_signature_invalide_donne_400(self, mock_construct):
        mock_construct.side_effect = stripe.error.SignatureVerificationError('Signature invalide', 'fake_sig')
        response = self.client.post(
            '/api/payments/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='fake_sig',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PENDING)


class CancellationPolicyTestCase(PaymentTestCaseBase):
    """F4 — Tests de la politique de remboursement selon le delai
    d'annulation (>24h = remboursement total, <24h = penalite de 5 EUR)."""

    @patch('stripe.Refund.create')
    def test_annulation_precoce_donne_remboursement_total(self, mock_refund):
        self.appointment.start_datetime = timezone.now() + timedelta(days=3)
        self.appointment.save(update_fields=['start_datetime'])
        payment = Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.SUCCEEDED,
            stripe_payment_intent_id='pi_cancel_test_1',
        )

        _apply_cancellation_policy(self.appointment, self.patient)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.REFUNDED)
        self.assertEqual(payment.refunded_amount_cents, 2500)
        mock_refund.assert_called_once_with(payment_intent='pi_cancel_test_1')
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.PAYMENT_REFUNDED).exists())

    @patch('stripe.Refund.create')
    def test_annulation_tardive_donne_remboursement_partiel_avec_penalite(self, mock_refund):
        self.appointment.start_datetime = timezone.now() + timedelta(hours=5)
        self.appointment.save(update_fields=['start_datetime'])
        payment = Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.SUCCEEDED,
            stripe_payment_intent_id='pi_cancel_test_2',
        )

        _apply_cancellation_policy(self.appointment, self.patient)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PARTIALLY_REFUNDED)
        self.assertEqual(payment.refunded_amount_cents, 2000)  # 2500 - 500 (penalite)
        mock_refund.assert_called_once_with(payment_intent='pi_cancel_test_2', amount=2000)

    def test_annulation_tardive_sans_paiement_prealable_fixe_la_penalite_due(self):
        self.appointment.start_datetime = timezone.now() + timedelta(hours=5)
        self.appointment.save(update_fields=['start_datetime'])
        payment = Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.PENDING,
        )

        _apply_cancellation_policy(self.appointment, self.patient)

        payment.refresh_from_db()
        self.assertEqual(payment.late_cancellation_fee_due_cents, 500)
        self.assertEqual(payment.status, Payment.Status.PENDING)