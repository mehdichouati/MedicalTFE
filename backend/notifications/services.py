"""F7 — Service centralise d'envoi de notifications (email).

Respecte les preferences utilisateur (F12 : possibilite de desactiver),
journalise chaque envoi (Notification), et ne bloque jamais le flux
principal (RDV, paiement) si l'envoi echoue.
"""
from django.core.mail import send_mail
from django.conf import settings

from .models import Notification, NotificationPreference


def _get_or_create_preference(user):
    preference, _ = NotificationPreference.objects.get_or_create(user=user)
    return preference


def send_notification_email(recipient, notification_type, subject, body):
    """Envoie un email si l'utilisateur ne l'a pas desactive, journalise le resultat."""
    preference = _get_or_create_preference(recipient)

    notification = Notification.objects.create(
        recipient=recipient,
        channel=Notification.Channel.EMAIL,
        notification_type=notification_type,
        subject=subject,
        body=body,
        status=Notification.Status.PENDING,
    )

    if not preference.email_enabled:
        notification.status = Notification.Status.SKIPPED
        notification.save(update_fields=['status'])
        return notification

    if not recipient.email:
        notification.status = Notification.Status.FAILED
        notification.error_message = "Aucune adresse email renseignee."
        notification.save(update_fields=['status', 'error_message'])
        return notification

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient.email],
            fail_silently=False,
        )
        notification.status = Notification.Status.SENT
        from django.utils import timezone
        notification.sent_at = timezone.now()
        notification.save(update_fields=['status', 'sent_at'])
    except Exception as e:
        notification.status = Notification.Status.FAILED
        notification.error_message = str(e)
        notification.save(update_fields=['status', 'error_message'])

    return notification


def notify_appointment_confirmation(appointment):
    subject = "Confirmation de votre rendez-vous"
    body = (
        f"Bonjour {appointment.patient.get_full_name() or appointment.patient.username},\n\n"
        f"Votre rendez-vous avec {appointment.professional.get_full_name() or appointment.professional.username} "
        f"est confirme le {appointment.start_datetime.strftime('%d/%m/%Y a %H:%M')} "
        f"a {appointment.medical_house.name}.\n\n"
        f"Motif : {appointment.reason or 'Non precise'}\n\n"
        f"Cordialement,\nMaison Medicale"
    )
    return send_notification_email(
        appointment.patient, Notification.NotificationType.APPOINTMENT_CONFIRMATION, subject, body,
    )


def notify_appointment_cancellation(appointment):
    subject = "Annulation de votre rendez-vous"
    body = (
        f"Bonjour {appointment.patient.get_full_name() or appointment.patient.username},\n\n"
        f"Votre rendez-vous du {appointment.start_datetime.strftime('%d/%m/%Y a %H:%M')} "
        f"avec {appointment.professional.get_full_name() or appointment.professional.username} "
        f"a ete annule.\n\n"
        f"Cordialement,\nMaison Medicale"
    )
    return send_notification_email(
        appointment.patient, Notification.NotificationType.APPOINTMENT_CANCELLATION, subject, body,
    )


def notify_payment_succeeded(payment):
    subject = "Confirmation de paiement"
    body = (
        f"Bonjour {payment.patient.get_full_name() or payment.patient.username},\n\n"
        f"Nous confirmons la reception de votre paiement de {payment.amount_cents / 100:.2f} EUR "
        f"pour votre rendez-vous du {payment.appointment.start_datetime.strftime('%d/%m/%Y a %H:%M')}.\n\n"
        f"Cordialement,\nMaison Medicale"
    )
    return send_notification_email(
        payment.patient, Notification.NotificationType.PAYMENT_SUCCEEDED, subject, body,
    )


def notify_payment_refunded(payment):
    subject = "Remboursement effectue"
    refunded_eur = payment.refunded_amount_cents / 100
    body = (
        f"Bonjour {payment.patient.get_full_name() or payment.patient.username},\n\n"
        f"Un remboursement de {refunded_eur:.2f} EUR a ete effectue pour votre rendez-vous "
        f"du {payment.appointment.start_datetime.strftime('%d/%m/%Y a %H:%M')}.\n\n"
        f"Cordialement,\nMaison Medicale"
    )
    return send_notification_email(
        payment.patient, Notification.NotificationType.PAYMENT_REFUNDED, subject, body,
    )


def notify_appointment_reminder(appointment, hours_before):
    subject = f"Rappel : rendez-vous dans {hours_before}h"
    body = (
        f"Bonjour {appointment.patient.get_full_name() or appointment.patient.username},\n\n"
        f"Nous vous rappelons votre rendez-vous avec "
        f"{appointment.professional.get_full_name() or appointment.professional.username} "
        f"le {appointment.start_datetime.strftime('%d/%m/%Y a %H:%M')} "
        f"a {appointment.medical_house.name}.\n\n"
        f"Motif : {appointment.reason or 'Non precise'}\n\n"
        f"Cordialement,\nMaison Medicale"
    )
    return send_notification_email(
        appointment.patient, Notification.NotificationType.APPOINTMENT_REMINDER, subject, body,
    )