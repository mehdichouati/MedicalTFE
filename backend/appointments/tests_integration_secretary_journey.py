"""#22 — Test d'integration : parcours secretariat de bout en bout.

Connexion -> recherche d'un patient -> creation d'un rendez-vous pour un
professionnel de sa maison medicale -> annulation, avec verification de
la tracabilite (audit log) a chaque etape sensible.
"""

from datetime import date, datetime, time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import WeeklyAvailability
from medical_houses.models import MedicalHouse, MedicalHouseStaff
from users.models import AuditLog, User


def _next_weekday(weekday):
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class SecretaryJourneyIntegrationTestCase(APITestCase):
    """F2 (secretariat) : recherche patient -> creation RDV -> annulation."""

    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_sec_journey', email='doc_sec_journey@test.be', password='Password123!', role='MEDECIN',
        )
        MedicalHouseStaff.objects.create(medical_house=self.house, professional=self.medecin)

        self.secretaire = User.objects.create_user(
            username='secretaire_journey', email='secretaire_journey@test.be', password='Password123!', role='SECRETAIRE',
        )
        MedicalHouseStaff.objects.create(medical_house=self.house, professional=self.secretaire)

        self.patient = User.objects.create_user(
            username='patient_sec_journey', email='patient_sec_journey@test.be', password='Password123!', role='PATIENT',
        )

        self.monday = _next_weekday(0)
        WeeklyAvailability.objects.create(
            professional=self.medecin, medical_house=self.house,
            weekday=0, start_time=time(9, 0), end_time=time(11, 0),
        )

    def test_parcours_secretariat_complet(self):
        # --- 1. Connexion de la secretaire ---
        login_response = self.client.post('/api/auth/login/', {
            'username': 'secretaire_journey', 'password': 'Password123!',
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # --- 2. Recherche du patient par nom d'utilisateur exact ---
        lookup_response = self.client.get('/api/patients/lookup/', {'username': 'patient_sec_journey'})
        self.assertEqual(lookup_response.status_code, status.HTTP_200_OK)
        self.assertEqual(lookup_response.data['id'], self.patient.id)

        # --- 3. Creation du rendez-vous pour le patient trouve ---
        start = timezone.make_aware(datetime.combine(self.monday, time(9, 0)))
        end = timezone.make_aware(datetime.combine(self.monday, time(9, 30)))
        create_response = self.client.post('/api/appointments/', {
            'professional': self.medecin.id, 'medical_house': self.house.id,
            'patient': lookup_response.data['id'],
            'start_datetime': start.isoformat(), 'end_datetime': end.isoformat(),
            'reason': 'Pris par le secretariat',
        })
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        appointment_id = create_response.data['id']
        self.assertTrue(
            AuditLog.objects.filter(actor=self.secretaire, action=AuditLog.Action.APPOINTMENT_CREATED_BY_STAFF).exists()
        )

        # --- 4. La secretaire retrouve bien le RDV dans l'agenda du professionnel ---
        list_response = self.client.get('/api/appointments/', {'professional': self.medecin.id})
        results = list_response.data if isinstance(list_response.data, list) else list_response.data['results']
        self.assertTrue(any(a['id'] == appointment_id for a in results))

        # --- 5. Annulation du rendez-vous ---
        cancel_response = self.client.delete(f'/api/appointments/{appointment_id}/')
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data['status'], 'CANCELLED')
        self.assertTrue(
            AuditLog.objects.filter(actor=self.secretaire, action=AuditLog.Action.APPOINTMENT_CANCELLED_BY_STAFF).exists()
        )