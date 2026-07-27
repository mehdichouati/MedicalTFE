"""F12 — Taches Celery pour les rappels de rendez-vous.

Verifie periodiquement (toutes les 5 min, voir configuration Celery Beat)
les RDV dont l'heure approche, et envoie un rappel a 24h et 2h avant,
une seule fois chacun (grace aux champs reminder_24h_sent/reminder_2h_sent).
"""
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from notifications.services import notify_appointment_reminder
from .models import Appointment


@shared_task
def send_appointment_reminders():
    now = timezone.now()

    # Fenetre de tolerance de 5 minutes autour de l'echeance exacte, pour
    # ne pas rater le rappel si la tache tourne toutes les 5 minutes.
    window = timedelta(minutes=5)

    active_statuses = [Appointment.Status.PENDING, Appointment.Status.CONFIRMED]

    # Rappel 24h avant.
    target_24h = now + timedelta(hours=24)
    appointments_24h = Appointment.objects.filter(
        status__in=active_statuses,
        reminder_24h_sent=False,
        start_datetime__gte=target_24h - window,
        start_datetime__lte=target_24h + window,
    )
    count_24h = 0
    for appointment in appointments_24h:
        notify_appointment_reminder(appointment, hours_before=24)
        appointment.reminder_24h_sent = True
        appointment.save(update_fields=['reminder_24h_sent'])
        count_24h += 1

    # Rappel 2h avant.
    target_2h = now + timedelta(hours=2)
    appointments_2h = Appointment.objects.filter(
        status__in=active_statuses,
        reminder_2h_sent=False,
        start_datetime__gte=target_2h - window,
        start_datetime__lte=target_2h + window,
    )
    count_2h = 0
    for appointment in appointments_2h:
        notify_appointment_reminder(appointment, hours_before=2)
        appointment.reminder_2h_sent = True
        appointment.save(update_fields=['reminder_2h_sent'])
        count_2h += 1

    return f"Rappels envoyes : {count_24h} (24h), {count_2h} (2h)"