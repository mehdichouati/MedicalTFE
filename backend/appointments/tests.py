from datetime import date, datetime, time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from medical_houses.models import MedicalHouse, MedicalHouseStaff
from users.models import AuditLog, LegalGuardianLink, User

from .models import Absence, Appointment, WeeklyAvailability


def _next_weekday(weekday):
    """Renvoie la prochaine date (strictement future) correspondant au
    jour de semaine donne (0=lundi ... 6=dimanche), pour des tests stables
    independamment du jour ou ils sont executes."""
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class AvailableSlotsViewTestCase(APITestCase):
    """F2 — Tests du calcul des creneaux disponibles."""

    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.medecin = User.objects.create_user(
            username='doc_test', email='doc_test@test.be', password='Password123!', role='MEDECIN',
        )
        self.patient = User.objects.create_user(
            username='patient_test', email='patient_test@test.be', password='Password123!', role='PATIENT',
        )
        self.client.force_authenticate(user=self.patient)

        # Disponibilite : lundi 09h00-11h00 -> 4 creneaux de 30 min attendus.
        self.monday = _next_weekday(0)
        WeeklyAvailability.objects.create(
            professional=self.medecin, medical_house=self.house,
            weekday=0, start_time=time(9, 0), end_time=time(11, 0),
        )

    def _get_slots(self, day=None):
        response = self.client.get('/api/appointments/available-slots/', {
            'professional': self.medecin.id,
            'medical_house': self.house.id,
            'date': (day or self.monday).isoformat(),
        })
        return response

    def test_creneaux_disponibles_correctement_calcules(self):
        response = self._get_slots()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['slots']), 4)

    def test_parametres_manquants_donne_400(self):
        response = self.client.get('/api/appointments/available-slots/', {'professional': self.medecin.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_absence_bloque_le_creneau_correspondant(self):
        tz = timezone.get_current_timezone()
        Absence.objects.create(
            professional=self.medecin,
            start_datetime=timezone.make_aware(datetime.combine(self.monday, time(10, 0)), tz),
            end_datetime=timezone.make_aware(datetime.combine(self.monday, time(10, 30)), tz),
        )
        response = self._get_slots()
        self.assertEqual(len(response.data['slots']), 3)

    def test_rdv_deja_reserve_bloque_le_creneau(self):
        tz = timezone.get_current_timezone()
        Appointment.objects.create(
            patient=self.patient, professional=self.medecin, medical_house=self.house,
            start_datetime=timezone.make_aware(datetime.combine(self.monday, time(9, 30)), tz),
            end_datetime=timezone.make_aware(datetime.combine(self.monday, time(10, 0)), tz),
            status=Appointment.Status.PENDING,
        )
        response = self._get_slots()
        self.assertEqual(len(response.data['slots']), 3)

    def test_rdv_annule_ne_bloque_pas_le_creneau(self):
        tz = timezone.get_current_timezone()
        Appointment.objects.create(
            patient=self.patient, professional=self.medecin, medical_house=self.house,
            start_datetime=timezone.make_aware(datetime.combine(self.monday, time(9, 30)), tz),
            end_datetime=timezone.make_aware(datetime.combine(self.monday, time(10, 0)), tz),
            status=Appointment.Status.CANCELLED,
        )
        response = self._get_slots()
        self.assertEqual(len(response.data['slots']), 4)


class AppointmentBookingRulesTestCase(APITestCase):
    """F2/F15 — Tests des regles de reservation (patient, enfant rattache,
    secretariat)."""

    def setUp(self):
        self.house = MedicalHouse.objects.create(
            name='Centre Test', address='Rue Test 1', city='Bruxelles', postal_code='1000',
        )
        self.other_house = MedicalHouse.objects.create(
            name='Autre Centre', address='Rue Autre 2', city='Liège', postal_code='4000',
        )
        self.medecin = User.objects.create_user(
            username='doc_test2', email='doc_test2@test.be', password='Password123!', role='MEDECIN',
        )
        MedicalHouseStaff.objects.create(medical_house=self.house, professional=self.medecin)
        WeeklyAvailability.objects.create(
            professional=self.medecin, medical_house=self.house,
            weekday=0, start_time=time(9, 0), end_time=time(11, 0),
        )

        self.other_medecin = User.objects.create_user(
            username='doc_test3', email='doc_test3@test.be', password='Password123!', role='MEDECIN',
        )
        MedicalHouseStaff.objects.create(medical_house=self.other_house, professional=self.other_medecin)
        WeeklyAvailability.objects.create(
            professional=self.other_medecin, medical_house=self.other_house,
            weekday=0, start_time=time(9, 0), end_time=time(11, 0),
        )

        self.patient = User.objects.create_user(
            username='patient_test2', email='patient_test2@test.be', password='Password123!', role='PATIENT',
        )
        self.other_patient = User.objects.create_user(
            username='patient_test3', email='patient_test3@test.be', password='Password123!', role='PATIENT',
        )
        self.dependent = User.objects.create_user(
            username='enfant_test', email='enfant_test@test.be', password='Password123!', role='PATIENT',
        )
        LegalGuardianLink.objects.create(guardian=self.patient, minor=self.dependent, attested_on_honour=True)

        self.secretaire = User.objects.create_user(
            username='secretaire_test', email='secretaire_test@test.be', password='Password123!', role='SECRETAIRE',
        )
        MedicalHouseStaff.objects.create(medical_house=self.house, professional=self.secretaire)

        monday = _next_weekday(0)
        tz = timezone.get_current_timezone()
        self.start = timezone.make_aware(datetime.combine(monday, time(9, 0)), tz)
        self.end = timezone.make_aware(datetime.combine(monday, time(9, 30)), tz)

    def _payload(self, professional, patient_id=None, start=None, end=None):
        data = {
            'professional': professional.id,
            'medical_house': self.house.id,
            'start_datetime': (start or self.start).isoformat(),
            'end_datetime': (end or self.end).isoformat(),
            'reason': 'Test',
        }
        if patient_id:
            data['patient'] = patient_id
        return data

    def test_patient_reserve_pour_lui_meme(self):
        self.client.force_authenticate(user=self.patient)
        response = self.client.post('/api/appointments/', self._payload(self.medecin))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['patient'], self.patient.id)

    def test_patient_reserve_pour_enfant_rattache(self):
        self.client.force_authenticate(user=self.patient)
        response = self.client.post('/api/appointments/', self._payload(self.medecin, patient_id=self.dependent.id))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['patient'], self.dependent.id)

    def test_patient_ne_peut_pas_reserver_pour_patient_non_rattache(self):
        self.client.force_authenticate(user=self.patient)
        response = self.client.post('/api/appointments/', self._payload(self.medecin, patient_id=self.other_patient.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_secretaire_reserve_pour_professionnel_de_sa_maison(self):
        self.client.force_authenticate(user=self.secretaire)
        response = self.client.post('/api/appointments/', self._payload(self.medecin, patient_id=self.patient.id))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            AuditLog.objects.filter(actor=self.secretaire, action=AuditLog.Action.APPOINTMENT_CREATED_BY_STAFF).exists()
        )

    def test_secretaire_ne_peut_pas_reserver_hors_de_sa_maison(self):
        self.client.force_authenticate(user=self.secretaire)
        response = self.client.post(
            '/api/appointments/',
            self._payload(self.other_medecin, patient_id=self.patient.id),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)