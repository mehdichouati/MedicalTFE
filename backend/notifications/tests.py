from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase
from django.utils import timezone

from appointments.models import Appointment
from appointments.views import _apply_cancellation_policy
from medical_houses.models import MedicalHouse
from payments.models import Payment
from users.models import User

from .services import notify_appointment_confirmation


class AppointmentEmailTestCase(TestCase):
    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_mail', email='doc_mail@test.be', password='Password123!', role='MEDECIN',
        )
        self.patient = User.objects.create_user(
            username='patient_mail', email='patient_mail@test.be', password='Password123!', role='PATIENT',
        )
        self.appointment = Appointment.objects.create(
            patient=self.patient, professional=self.medecin, medical_house=self.house,
            start_datetime=timezone.now() + timedelta(hours=5),
            end_datetime=timezone.now() + timedelta(hours=5, minutes=30),
            reason='Motif confidentiel',
        )

    def test_email_contient_html_et_pdf_sans_le_motif(self):
        notify_appointment_confirmation(self.appointment)

        email = mail.outbox[0]
        self.assertEqual(email.alternatives[0][1], 'text/html')
        filename, content, mimetype = email.attachments[0]
        self.assertTrue(filename.endswith('.pdf'))
        self.assertTrue(content.startswith(b'%PDF'))
        self.assertEqual(mimetype, 'application/pdf')
        self.assertNotIn('Motif confidentiel', email.body)

    @patch('stripe.Refund.create')
    def test_annulation_tardive_envoie_le_mail_d_indemnite(self, mock_refund):
        Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.SUCCEEDED,
            stripe_payment_intent_id='pi_mail_test',
        )

        _apply_cancellation_policy(self.appointment, self.patient)

        subjects = [email.subject for email in mail.outbox]
        self.assertIn("Confirmation de votre remboursement", subjects)
        self.assertIn("Indemnité d'annulation tardive", subjects)
        fee_email = mail.outbox[subjects.index("Indemnité d'annulation tardive")]
        self.assertIn('5.00 EUR', fee_email.body)