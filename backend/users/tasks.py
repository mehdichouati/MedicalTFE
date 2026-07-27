"""F15 — Tache Celery : transition automatique a la majorite.

Revoque automatiquement le lien parental (LegalGuardianLink) le jour ou
le mineur rattache atteint 18 ans, conformement au droit belge (fin de
la representation legale a la majorite).
"""
from celery import shared_task
from django.utils import timezone

from .models import LegalGuardianLink


@shared_task
def revoke_guardian_links_at_majority():
    today = timezone.localdate()
    count = 0

    active_links = LegalGuardianLink.objects.filter(revoked_at__isnull=True).select_related('minor')
    for link in active_links:
        if link.minor.date_of_birth is None:
            continue
        age = link.minor.age
        if age is not None and age >= 18:
            link.revoked_at = timezone.now()
            link.save(update_fields=['revoked_at'])
            count += 1

    return f"Liens parentaux revoques (majorite atteinte) : {count}"