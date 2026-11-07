"""F7 — Service centralise d'envoi de notifications (email).

Respecte les preferences utilisateur (F12 : possibilite de desactiver),
journalise chaque envoi (Notification), et ne bloque jamais le flux
principal (RDV, paiement) si l'envoi echoue.
"""
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.text import slugify

from .models import Notification, NotificationPreference
from .pdf import build_summary_pdf

PRIMARY_COLOR = '#0a5c78'


def _get_or_create_preference(user):
    preference, _ = NotificationPreference.objects.get_or_create(user=user)
    return preference


def send_notification_email(recipient, notification_type, subject, body, html_body=None, attachment_builder=None):
    """Envoie un email si l'utilisateur ne l'a pas desactive, journalise le resultat.

    attachment_builder renvoie (nom du fichier, contenu du PDF). Il est appele
    dans le try pour qu'une erreur de PDF ne bloque jamais le flux principal.
    """
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
        email = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient.email],
        )
        if html_body:
            email.attach_alternative(html_body, 'text/html')
        if attachment_builder:
            filename, content = attachment_builder()
            email.attach(filename, content, 'application/pdf')
        email.send(fail_silently=False)
        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.save(update_fields=['status', 'sent_at'])
    except Exception as e:
        notification.status = Notification.Status.FAILED
        notification.error_message = str(e)
        notification.save(update_fields=['status', 'error_message'])

    return notification


def _person_name(user):
    return user.get_full_name() or user.username


def _format_datetime(value):
    """Convertit en heure locale : les dates sont stockees en UTC."""
    return timezone.localtime(value).strftime('%d/%m/%Y à %H:%M')


def _appointment_details(appointment):
    return [
        ("Date", _format_datetime(appointment.start_datetime)),
        ("Professionnel", _person_name(appointment.professional)),
        ("Lieu", appointment.medical_house.name),
    ]


def _build_html(title, greeting, paragraphs, details, house_name):
    paragraphs_html = ''.join(
        f'<p style="margin:0 0 14px;color:#1a1a2e;">{escape(paragraph)}</p>' for paragraph in paragraphs
    )
    rows_html = ''.join(
        f'<tr><td style="padding:6px 16px 6px 0;color:#52606d;">{escape(label)}</td>'
        f'<td style="padding:6px 0;color:#1a1a2e;font-weight:600;">{escape(value)}</td></tr>'
        for label, value in details
    )
    return (
        '<div style="background:#f7f9fb;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eef1f4;border-radius:12px;overflow:hidden;">'
        f'<div style="background:{PRIMARY_COLOR};color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">{escape(title)}</div>'
        '<div style="padding:24px;">'
        f'<p style="margin:0 0 14px;color:#1a1a2e;">{escape(greeting)}</p>'
        f'{paragraphs_html}'
        f'<table style="border-collapse:collapse;margin:8px 0 18px;">{rows_html}</table>'
        '<p style="margin:0;color:#52606d;font-size:13px;">Le récapitulatif de ce rendez-vous est joint à cet e-mail au format PDF.</p>'
        '</div>'
        f'<div style="padding:16px 24px;border-top:1px solid #eef1f4;color:#52606d;font-size:13px;">Cordialement,<br>{escape(house_name)}</div>'
        '</div></div>'
    )


def _send_appointment_email(appointment, notification_type, subject, title, paragraphs, details=None):
    """Construit et envoie un email professionnel avec son PDF recapitulatif."""
    recipient = appointment.patient
    greeting = f"Bonjour {_person_name(recipient)},"
    details = details or _appointment_details(appointment)
    house_name = appointment.medical_house.name

    details_text = '\n'.join(f"{label} : {value}" for label, value in details)
    paragraphs_text = '\n\n'.join(paragraphs)
    body = (
        f"{greeting}\n\n{paragraphs_text}\n\n{details_text}\n\n"
        f"Le récapitulatif de ce rendez-vous est joint à cet e-mail au format PDF.\n\n"
        f"Cordialement,\n{house_name}"
    )

    def attachment_builder():
        filename = f"{slugify(title)}-rdv-{appointment.id}.pdf"
        return filename, build_summary_pdf(appointment, title)

    return send_notification_email(
        recipient, notification_type, subject, body,
        html_body=_build_html(title, greeting, paragraphs, details, house_name),
        attachment_builder=attachment_builder,
    )


def notify_appointment_confirmation(appointment):
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.APPOINTMENT_CONFIRMATION,
        subject="Confirmation de votre rendez-vous",
        title="Rendez-vous confirmé",
        paragraphs=["Votre rendez-vous a bien été enregistré. Voici ses informations :"],
    )


def notify_appointment_cancellation(appointment):
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.APPOINTMENT_CANCELLATION,
        subject="Annulation de votre rendez-vous",
        title="Rendez-vous annulé",
        paragraphs=["Votre rendez-vous a bien été annulé. Voici les informations du rendez-vous concerné :"],
    )


def notify_appointment_cancelled_by_professional(appointment):
    """Changement d'horaire — le motif de l'absence n'est volontairement pas
    communique au patient (vie privee du professionnel, art. 5.1.c RGPD)."""
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.APPOINTMENT_CANCELLED_BY_PROFESSIONAL,
        subject="Votre rendez-vous a été annulé par le centre",
        title="Rendez-vous annulé par le centre",
        paragraphs=[
            "Nous sommes au regret de vous informer que votre rendez-vous a été annulé suite à un changement d'horaire de votre professionnel.",
            "Si vous aviez payé ce rendez-vous, vous serez intégralement remboursé. Vous pouvez reprendre un rendez-vous depuis votre espace patient.",
        ],
    )


def notify_payment_succeeded(payment):
    appointment = payment.appointment
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.PAYMENT_SUCCEEDED,
        subject="Confirmation de votre paiement",
        title="Paiement confirmé",
        paragraphs=[f"Nous avons bien reçu votre paiement de {payment.amount_cents / 100:.2f} EUR."],
    )


def notify_payment_refunded(payment):
    appointment = payment.appointment
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.PAYMENT_REFUNDED,
        subject="Confirmation de votre remboursement",
        title="Remboursement effectué",
        paragraphs=[
            f"Un remboursement de {payment.refunded_amount_cents / 100:.2f} EUR a été demandé auprès de notre prestataire de paiement. "
            "Le délai d'apparition sur votre compte dépend de votre banque."
        ],
    )


def notify_late_cancellation_fee(payment):
    """F4 — Informe le patient de l'indemnite retenue sur son remboursement."""
    appointment = payment.appointment
    retained_cents = payment.amount_cents - payment.refunded_amount_cents
    if appointment.status == appointment.Status.NO_SHOW:
        reason = "Vous ne vous êtes pas présenté(e) à votre rendez-vous et celui-ci n'avait pas été annulé."
    else:
        reason = "Votre rendez-vous a été annulé moins de 24 heures avant son début."

    return _send_appointment_email(
        appointment,
        Notification.NotificationType.PAYMENT_REFUNDED,
        subject="Indemnité d'annulation tardive",
        title="Indemnité d'annulation tardive",
        paragraphs=[
            reason,
            f"Conformément aux conditions acceptées lors de la réservation, une indemnité de {retained_cents / 100:.2f} EUR "
            f"a été retenue sur votre paiement de {payment.amount_cents / 100:.2f} EUR.",
            "Si votre absence est due à un cas de force majeure, vous pouvez contacter le secrétariat.",
        ],
    )


def notify_appointment_reminder(appointment, hours_before):
    return _send_appointment_email(
        appointment,
        Notification.NotificationType.APPOINTMENT_REMINDER,
        subject=f"Rappel : votre rendez-vous dans {hours_before} heures",
        title="Rappel de rendez-vous",
        paragraphs=[f"Votre rendez-vous a lieu dans environ {hours_before} heures. Voici ses informations :"],
    )