"""F7 — PDF recapitulatif joint aux emails de rendez-vous et de paiement.

Le motif de consultation n'y figure jamais : une piece jointe peut etre
transferee ou stockee hors de la plateforme (minimisation, art. 5.1.c RGPD).
"""
import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PRIMARY_COLOR = HexColor('#0a5c78')
TEXT_COLOR = HexColor('#1a1a2e')
MUTED_COLOR = HexColor('#52606d')
LINE_COLOR = HexColor('#dbe2e8')
LEFT_MARGIN = 20 * mm
VALUE_MARGIN = 75 * mm


def _format_euros(cents):
    return f"{cents / 100:.2f} EUR"


def _draw_section(pdf, y, title, rows):
    width = A4[0]
    pdf.setFillColor(PRIMARY_COLOR)
    pdf.setFont('Helvetica-Bold', 12)
    pdf.drawString(LEFT_MARGIN, y, title)
    y -= 3 * mm
    pdf.setStrokeColor(LINE_COLOR)
    pdf.line(LEFT_MARGIN, y, width - LEFT_MARGIN, y)
    y -= 7 * mm

    for label, value in rows:
        pdf.setFillColor(MUTED_COLOR)
        pdf.setFont('Helvetica', 10)
        pdf.drawString(LEFT_MARGIN, y, label)
        pdf.setFillColor(TEXT_COLOR)
        pdf.drawString(VALUE_MARGIN, y, str(value))
        y -= 6 * mm

    return y - 5 * mm


def build_summary_pdf(appointment, document_title):
    """Renvoie le contenu du PDF recapitulatif d'un rendez-vous."""
    from payments.models import Payment

    payment = Payment.objects.filter(appointment=appointment).first()
    house = appointment.medical_house
    start = timezone.localtime(appointment.start_datetime)
    end = timezone.localtime(appointment.end_datetime)

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(document_title)

    width, height = A4
    pdf.setFillColor(PRIMARY_COLOR)
    pdf.rect(0, height - 32 * mm, width, 32 * mm, stroke=0, fill=1)
    pdf.setFillColor(HexColor('#ffffff'))
    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawString(LEFT_MARGIN, height - 16 * mm, document_title)
    pdf.setFont('Helvetica', 10)
    pdf.drawString(LEFT_MARGIN, height - 24 * mm, house.name)

    y = height - 46 * mm
    appointment_rows = [
        ("Référence", f"RDV-{appointment.id}"),
        ("Date", start.strftime('%d/%m/%Y')),
        ("Heure", f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"),
    ]
    if appointment.status not in (appointment.Status.PENDING, appointment.Status.CONFIRMED):
        appointment_rows.append(("Statut", appointment.get_status_display()))
    y = _draw_section(pdf, y, "Rendez-vous", appointment_rows)
    y = _draw_section(pdf, y, "Personnes concernées", [
        ("Patient", appointment.patient.get_full_name() or appointment.patient.username),
        ("Professionnel", appointment.professional.get_full_name() or appointment.professional.username),
    ])
    y = _draw_section(pdf, y, "Lieu", [
        ("Centre", house.name),
        ("Adresse", f"{house.address}, {house.postal_code} {house.city}"),
    ])

    if payment is None:
        payment_rows = [("Paiement", "Aucun paiement enregistré")]
    else:
        payment_rows = [
            ("Montant", _format_euros(payment.amount_cents)),
            ("Statut", payment.get_status_display()),
        ]
        if payment.refunded_amount_cents > 0:
            payment_rows.append(("Montant remboursé", _format_euros(payment.refunded_amount_cents)))
            retained_cents = payment.amount_cents - payment.refunded_amount_cents
            if retained_cents > 0:
                payment_rows.append(("Indemnité retenue", _format_euros(retained_cents)))
    _draw_section(pdf, y, "Paiement", payment_rows)

    pdf.setFillColor(MUTED_COLOR)
    pdf.setFont('Helvetica', 8)
    pdf.drawString(LEFT_MARGIN, 22 * mm, "Document récapitulatif généré automatiquement.")
    pdf.drawString(LEFT_MARGIN, 18 * mm, "Il ne remplace pas l'attestation de soins officielle et ne donne pas droit à un remboursement de la mutualité.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()