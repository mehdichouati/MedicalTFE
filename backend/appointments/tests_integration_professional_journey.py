"""#22 — Test d'integration : parcours professionnel de bout en bout.

Connexion -> terminer une consultation -> deposer un document medical ->
generer le justificatif de paiement PDF. Tout passe par les vraies routes
de l'API.
"""

from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Appointment
from medical_houses.models import MedicalHouse
from payments.models import Payment
from users.models import User


class ProfessionalJourneyIntegrationTestCase(APITestCase):
    """F2 (mark-completed) -> F5 (document) -> F5 (justificatif PDF)."""

    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_pro_journey', email='doc_pro_journey@test.be', password='Password123!', role='MEDECIN',
        )
        self.patient = User.objects.create_user(
            username='patient_pro_journey', email='patient_pro_journey@test.be', password='Password123!', role='PATIENT',
        )
        # RDV deja passe, condition necessaire pour pouvoir le marquer termine.
        self.appointment = Appointment.objects.create(
            patient=self.patient, professional=self.medecin, medical_house=self.house,
            start_datetime=timezone.now() - timedelta(days=1),
            end_datetime=timezone.now() - timedelta(days=1) + timedelta(minutes=30),
            status=Appointment.Status.PENDING,
        )
        Payment.objects.create(
            appointment=self.appointment, patient=self.patient,
            amount_cents=2500, status=Payment.Status.SUCCEEDED,
        )

    def test_parcours_professionnel_complet(self):
        # --- 1. Connexion du professionnel ---
        login_response = self.client.post('/api/auth/login/', {
            'username': 'doc_pro_journey', 'password': 'Password123!',
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # --- 2. Terminer la consultation (F2) ---
        complete_response = self.client.post(f'/api/appointments/{self.appointment.id}/mark-completed/')
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_response.data['status'], 'COMPLETED')

        # --- 3. Deposer un document medical (F5) ---
        fake_pdf = SimpleUploadedFile(
            'resultat_prise_de_sang.pdf', b'%PDF-1.4 contenu de test', content_type='application/pdf',
        )
        upload_response = self.client.post('/api/medical-documents/', {
            'patient': self.patient.id,
            'document_type': 'LAB_RESULT',
            'title': 'Résultat prise de sang',
            'file': fake_pdf,
        }, format='multipart')
        self.assertEqual(upload_response.status_code, status.HTTP_201_CREATED)

        # --- 4. Le patient retrouve bien le document dans son dossier (F6) ---
        patient_login = self.client.post('/api/auth/login/', {
            'username': 'patient_pro_journey', 'password': 'Password123!',
        })
        patient_token = patient_login.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {patient_token}')

        documents_response = self.client.get('/api/medical-documents/')
        documents = documents_response.data if isinstance(documents_response.data, list) else documents_response.data['results']
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]['title'], 'Résultat prise de sang')

        # --- 5. Generer le justificatif de paiement PDF (F5) ---
        receipt_response = self.client.get(f'/api/payments/receipt/{self.appointment.id}/')
        self.assertEqual(receipt_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt_response['Content-Type'], 'application/pdf')
        content = b''.join(receipt_response.streaming_content) if receipt_response.streaming else receipt_response.content
        self.assertTrue(content.startswith(b'%PDF'))