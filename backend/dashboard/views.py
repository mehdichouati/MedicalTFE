from datetime import timedelta

from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from medical_houses.models import MedicalHouse
from payments.models import Payment
from users.models import User


class AdminDashboardView(APIView):
    """F10 — Tableau de bord administratif.

    Vue globale des rendez-vous, paiements, professionnels et frequentation,
    en temps reel (calcule a chaque requete, pas de cache).
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'ADMIN':
            return Response({'detail': "Réservé aux administrateurs."}, status=403)

        today = timezone.localdate()
        fourteen_days_ago = today - timedelta(days=13)

        # --- Cartes de synthese ---
        appointments_qs = Appointment.objects.all()

        total_appointments = appointments_qs.count()
        appointments_today = appointments_qs.filter(start_datetime__date=today).count()
        pending_appointments = appointments_qs.filter(status='PENDING').count()
        completed_appointments = appointments_qs.filter(status='COMPLETED').count()
        cancelled_appointments = appointments_qs.filter(status='CANCELLED').count()
        no_show_appointments = appointments_qs.filter(status='NO_SHOW').count()

        total_revenue_cents = Payment.objects.filter(
            status__in=['SUCCEEDED', 'PARTIALLY_REFUNDED']
        ).aggregate(total=Sum('amount_cents'))['total'] or 0
        total_refunded_cents = Payment.objects.aggregate(
            total=Sum('refunded_amount_cents')
        )['total'] or 0
        net_revenue_cents = total_revenue_cents - total_refunded_cents

        total_patients = User.objects.filter(role='PATIENT').count()
        total_professionals = User.objects.filter(role__in=['MEDECIN', 'KINE', 'PSYCHOLOGUE']).count()
        total_medical_houses = MedicalHouse.objects.count()

        # --- Graphique : RDV par jour sur les 14 derniers jours ---
        daily_counts = []
        for i in range(14):
            day = fourteen_days_ago + timedelta(days=i)
            count = appointments_qs.filter(start_datetime__date=day).count()
            revenue_cents = Payment.objects.filter(
                appointment__start_datetime__date=day,
                status__in=['SUCCEEDED', 'PARTIALLY_REFUNDED'],
            ).aggregate(total=Sum('amount_cents'))['total'] or 0
            daily_counts.append({
                'date': day.isoformat(),
                'appointments': count,
                'revenue_eur': round(revenue_cents / 100, 2),
            })

        # --- Repartition par maison medicale ---
        by_medical_house = []
        for house in MedicalHouse.objects.all():
            house_appointments = appointments_qs.filter(medical_house=house)
            by_medical_house.append({
                'id': house.id,
                'name': house.name,
                'total_appointments': house_appointments.count(),
                'completed': house_appointments.filter(status='COMPLETED').count(),
                'staff_count': house.staff_count if hasattr(house, 'staff_count') else None,
            })

        # --- Repartition par professionnel (top 5 par volume) ---
        by_professional = list(
            appointments_qs.values('professional__username', 'professional__role')
            .annotate(total=Count('id'))
            .order_by('-total')[:5]
        )

        return Response({
            'summary': {
                'total_appointments': total_appointments,
                'appointments_today': appointments_today,
                'pending_appointments': pending_appointments,
                'completed_appointments': completed_appointments,
                'cancelled_appointments': cancelled_appointments,
                'no_show_appointments': no_show_appointments,
                'total_revenue_eur': round(total_revenue_cents / 100, 2),
                'net_revenue_eur': round(net_revenue_cents / 100, 2),
                'total_patients': total_patients,
                'total_professionals': total_professionals,
                'total_medical_houses': total_medical_houses,
            },
            'daily_chart': daily_counts,
            'by_medical_house': by_medical_house,
            'by_professional': by_professional,
        })