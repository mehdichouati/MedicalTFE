"""F5 — Generation du PDF de la facture d'une consultation.

Le dessin est separe de la vue (views.py) : la vue verifie les droits et
les conditions, ce module ne fait que mettre la facture en page.
"""

import io

from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# Couleurs de la charte du site (memes valeurs que index.css).
PRIMARY = (10 / 255, 92 / 255, 120 / 255)
TEXT = (31 / 255, 41 / 255, 51 / 255)
MUTED = (82 / 255, 96 / 255, 109 / 255)
BORDER = (228 / 255, 231 / 255, 235 / 255)
INFO_BG = (238 / 255, 245 / 255, 248 / 255)
OK_BG = (238 / 255, 246 / 255, 240 / 255)
OK_TEXT = (31 / 255, 92 / 255, 57 / 255)

LEFT = 20 * mm
RIGHT = A4[0] - 20 * mm

VAT_MENTION = "Prestation de soins exemptée de TVA (art. 44, § 1er, 1° du Code de la TVA)."


def format_amount(cents):
    """2500 -> '25,00 €' (format belge)."""
    return f"{cents / 100:.2f} €".replace('.', ',')


def format_license(professional):
    """Numero INAMI au format officiel X-XXXXX-XX-XXX, ou numero Compsy."""
    number = professional.license_number
    if not number:
        return ''
    if professional.role == 'PSYCHOLOGUE':
        return f"Compsy {number}"
    if len(number) == 11 and number.isdigit():
        number = f"{number[0]}-{number[1:6]}-{number[6:8]}-{number[8:]}"
    return f"INAMI {number}"


def _text(pdf, x, y, value, size=10, bold=False, color=TEXT, align='left'):
    pdf.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    pdf.setFillColorRGB(*color)
    if align == 'right':
        pdf.drawRightString(x, y, value)
    else:
        pdf.drawString(x, y, value)


def _draw_header(pdf, invoice, house, top):
    """Coordonnees de la maison medicale a gauche, numero de facture a droite."""
    _text(pdf, LEFT, top, house.name, size=15, bold=True, color=PRIMARY)
    lines = [house.address, f"{house.postal_code} {house.city}"]
    contact = ' · '.join(value for value in (house.phone_number, house.email) if value)
    if contact:
        lines.append(contact)
    if house.company_number:
        lines.append(f"BCE {house.company_number}")
    y = top - 6 * mm
    for line in lines:
        _text(pdf, LEFT, y, line, size=9, color=MUTED)
        y -= 4.5 * mm

    _text(pdf, RIGHT, top, "FACTURE", size=20, bold=True, color=PRIMARY, align='right')
    _text(pdf, RIGHT, top - 7 * mm, f"N° {invoice.number}", size=10, bold=True, align='right')
    issued = timezone.localtime(invoice.issued_at).strftime('%d/%m/%Y')
    _text(pdf, RIGHT, top - 12 * mm, f"Émise le {issued}", size=9, color=MUTED, align='right')

    bottom = min(y, top - 16 * mm) - 2 * mm
    pdf.setStrokeColorRGB(*PRIMARY)
    pdf.setLineWidth(1.5)
    pdf.line(LEFT, bottom, RIGHT, bottom)
    return bottom


def _draw_parties(pdf, patient, professional, top):
    """Patient a gauche, praticien a droite."""
    y = top - 8 * mm
    _text(pdf, LEFT, y, "Patient", size=8.5, color=MUTED)
    _text(pdf, LEFT, y - 5 * mm, patient.get_full_name() or patient.username, size=11, bold=True)

    _text(pdf, RIGHT, y, "Praticien", size=8.5, color=MUTED, align='right')
    _text(pdf, RIGHT, y - 5 * mm, professional.get_full_name() or professional.username,
          size=11, bold=True, align='right')
    details = ' · '.join(
        value for value in (professional.get_role_display(), format_license(professional)) if value
    )
    _text(pdf, RIGHT, y - 10 * mm, details, size=9, color=MUTED, align='right')
    return y - 16 * mm


def _draw_service_table(pdf, appointment, payment, top):
    """Tableau de la prestation : Description | Date | Montant."""
    date_x = RIGHT - 60 * mm
    header_height = 8 * mm
    row_height = 13 * mm if appointment.reason else 9 * mm

    pdf.setFillColorRGB(*INFO_BG)
    pdf.rect(LEFT, top - header_height, RIGHT - LEFT, header_height, stroke=0, fill=1)
    text_y = top - 5.5 * mm
    _text(pdf, LEFT + 3 * mm, text_y, "Description", size=9.5, bold=True, color=PRIMARY)
    _text(pdf, date_x, text_y, "Date", size=9.5, bold=True, color=PRIMARY)
    _text(pdf, RIGHT - 3 * mm, text_y, "Montant", size=9.5, bold=True, color=PRIMARY, align='right')

    row_top = top - header_height
    first_line = row_top - 5.5 * mm
    _text(pdf, LEFT + 3 * mm, first_line, "Consultation", size=10)
    if appointment.reason:
        _text(pdf, LEFT + 3 * mm, first_line - 4.5 * mm, f"Motif : {appointment.reason[:70]}",
              size=8.5, color=MUTED)
    service_date = timezone.localtime(appointment.start_datetime).strftime('%d/%m/%Y')
    _text(pdf, date_x, first_line, service_date, size=10)
    _text(pdf, RIGHT - 3 * mm, first_line, format_amount(payment.amount_cents), size=10, align='right')

    table_bottom = row_top - row_height
    pdf.setStrokeColorRGB(*BORDER)
    pdf.setLineWidth(0.8)
    pdf.rect(LEFT, table_bottom, RIGHT - LEFT, top - table_bottom, stroke=1, fill=0)
    pdf.line(LEFT, row_top, RIGHT, row_top)
    return table_bottom


def _draw_totals(pdf, payment, top):
    """Sous-total, TVA, total et remboursement eventuel, alignes a droite."""
    label_x = RIGHT - 70 * mm
    y = top - 7 * mm
    rows = [
        ("Sous-total", format_amount(payment.amount_cents)),
        ("TVA (exemptée)", format_amount(0)),
    ]
    for label, value in rows:
        _text(pdf, label_x, y, label, size=9.5, color=MUTED)
        _text(pdf, RIGHT, y, value, size=9.5, align='right')
        y -= 5 * mm

    pdf.setStrokeColorRGB(*TEXT)
    pdf.setLineWidth(0.8)
    pdf.line(label_x, y + 3 * mm, RIGHT, y + 3 * mm)
    y -= 1.5 * mm
    _text(pdf, label_x, y, "Total", size=11, bold=True)
    _text(pdf, RIGHT, y, format_amount(payment.amount_cents), size=11, bold=True, align='right')

    if payment.refunded_amount_cents > 0:
        y -= 6 * mm
        _text(pdf, label_x, y, "Remboursé", size=9.5, color=MUTED)
        _text(pdf, RIGHT, y, f"- {format_amount(payment.refunded_amount_cents)}", size=9.5, align='right')
        y -= 5 * mm
        net = payment.amount_cents - payment.refunded_amount_cents
        _text(pdf, label_x, y, "Total net perçu", size=10, bold=True)
        _text(pdf, RIGHT, y, format_amount(net), size=10, bold=True, align='right')
    return y


def _draw_payment_status(pdf, payment, top):
    """Encadre vert indiquant comment et quand la facture a ete payee."""
    box_height = 9 * mm
    y = top - 8 * mm - box_height
    paid_on = timezone.localtime(payment.created_at).strftime('%d/%m/%Y')
    message = f"Payée le {paid_on} par carte bancaire (Stripe)"
    if payment.status == payment.Status.REFUNDED:
        message += ", remboursée intégralement"
    elif payment.status == payment.Status.PARTIALLY_REFUNDED:
        message += ", remboursée partiellement"

    pdf.setFillColorRGB(*OK_BG)
    pdf.roundRect(LEFT, y, RIGHT - LEFT, box_height, 1.5 * mm, stroke=0, fill=1)
    _text(pdf, LEFT + 4 * mm, y + 3.2 * mm, message, size=9.5, color=OK_TEXT)
    return y


def _draw_legal_footer(pdf):
    """Mentions legales en bas de page."""
    y = 30 * mm
    pdf.setStrokeColorRGB(*BORDER)
    pdf.setLineWidth(0.8)
    pdf.line(LEFT, y + 5 * mm, RIGHT, y + 5 * mm)
    lines = [
        VAT_MENTION,
        "Ce document n'est pas une attestation de soins INAMI (eAttest) et ne donne pas droit",
        "automatiquement à un remboursement de la mutualité.",
    ]
    for line in lines:
        _text(pdf, LEFT, y, line, size=8, color=MUTED)
        y -= 4 * mm


def build_invoice_pdf(invoice):
    """Retourne un buffer contenant le PDF de la facture."""
    payment = invoice.payment
    appointment = payment.appointment

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Facture {invoice.number}")

    y = _draw_header(pdf, invoice, appointment.medical_house, A4[1] - 25 * mm)
    y = _draw_parties(pdf, appointment.patient, appointment.professional, y)
    y = _draw_service_table(pdf, appointment, payment, y)
    y = _draw_totals(pdf, payment, y)
    _draw_payment_status(pdf, payment, y)
    _draw_legal_footer(pdf)

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer