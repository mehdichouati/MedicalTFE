import shutil
import tempfile
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import AuditLog, LegalGuardianLink, User


def _birth_date_for_age(age):
    today = date.today()
    return date(today.year - age, 1, 1)


def _pdf(name='composition_menage.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 test', content_type='application/pdf')


# Les justificatifs envoyes pendant les tests vont dans un dossier
# temporaire, supprime a la fin, pour ne pas polluer backend/media/.
TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class GuardianLinkValidationTests(TestCase):
    """F15 — Rattachement d'un enfant : justificatif et validation par le secretariat."""

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.parent = User.objects.create_user(
            username='parent_test', email='parent_test@test.be', password='Password123!', role='PATIENT',
        )
        self.secretary = User.objects.create_user(
            username='secretaire_f15', email='secretaire_f15@test.be', password='Password123!', role='SECRETAIRE',
        )

    def _create_child(self, age, with_document=True, username='enfant_test'):
        self.client.force_authenticate(self.parent)
        data = {
            'username': username,
            'email': f'{username}@test.be',
            'date_of_birth': _birth_date_for_age(age).isoformat(),
            'attestation': True,
        }
        if with_document:
            data['proof_document'] = _pdf()
        return self.client.post('/api/auth/dependents/', data, format='multipart')

    def test_under_16_without_document_is_refused(self):
        response = self._create_child(age=10, with_document=False)
        self.assertEqual(response.status_code, 400)
        self.assertIn('proof_document', response.data)

    def test_under_16_with_document_is_pending(self):
        response = self._create_child(age=10)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['link_status'], 'PENDING')

    def test_16_or_more_is_approved_without_document(self):
        response = self._create_child(age=16, with_document=False)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['link_status'], 'APPROVED')

    def test_wrong_file_format_is_refused(self):
        self.client.force_authenticate(self.parent)
        response = self.client.post('/api/auth/dependents/', {
            'username': 'enfant_exe',
            'email': 'enfant_exe@test.be',
            'date_of_birth': _birth_date_for_age(8).isoformat(),
            'attestation': True,
            'proof_document': SimpleUploadedFile('virus.exe', b'MZ', content_type='application/octet-stream'),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_patient_cannot_access_guardian_requests(self):
        self.client.force_authenticate(self.parent)
        response = self.client.get('/api/auth/guardian-requests/')
        self.assertEqual(response.status_code, 403)

    def test_secretary_approves_and_document_is_deleted(self):
        self._create_child(age=10)
        link = LegalGuardianLink.objects.get(guardian=self.parent)
        self.assertTrue(link.proof_document)

        self.client.force_authenticate(self.secretary)
        document = self.client.get(f'/api/auth/guardian-requests/{link.id}/document/')
        self.assertEqual(document.status_code, 200)

        response = self.client.post(f'/api/auth/guardian-requests/{link.id}/approve/')
        self.assertEqual(response.status_code, 200)

        link.refresh_from_db()
        self.assertEqual(link.status, LegalGuardianLink.Status.APPROVED)
        self.assertFalse(link.proof_document)
        self.assertEqual(link.reviewed_by, self.secretary)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.GUARDIAN_LINK_APPROVED).exists())

    def test_reject_requires_reason_then_parent_can_resubmit(self):
        self._create_child(age=10)
        link = LegalGuardianLink.objects.get(guardian=self.parent)

        self.client.force_authenticate(self.secretary)
        no_reason = self.client.post(f'/api/auth/guardian-requests/{link.id}/reject/', {})
        self.assertEqual(no_reason.status_code, 400)

        response = self.client.post(
            f'/api/auth/guardian-requests/{link.id}/reject/',
            {'rejection_reason': 'Document illisible'},
        )
        self.assertEqual(response.status_code, 200)
        link.refresh_from_db()
        self.assertEqual(link.status, LegalGuardianLink.Status.REJECTED)

        self.client.force_authenticate(self.parent)
        resubmit = self.client.post(
            f'/api/auth/dependents/{link.minor_id}/resubmit/',
            {'proof_document': _pdf('nouveau.pdf')},
            format='multipart',
        )
        self.assertEqual(resubmit.status_code, 200)
        link.refresh_from_db()
        self.assertEqual(link.status, LegalGuardianLink.Status.PENDING)

    def test_pending_link_gives_no_access_to_child_history(self):
        self._create_child(age=10)
        link = LegalGuardianLink.objects.get(guardian=self.parent)

        self.client.force_authenticate(self.parent)
        response = self.client.get('/api/patients/history/', {'patient': link.minor_id})
        self.assertEqual(response.status_code, 403)