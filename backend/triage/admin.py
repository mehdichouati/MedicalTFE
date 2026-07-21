from django.contrib import admin
from .models import TriageAssessment


@admin.register(TriageAssessment)
class TriageAssessmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'orientation', 'created_at')
    list_filter = ('orientation',)
    search_fields = ('patient__username',)
    readonly_fields = (
        'patient', 'signe_gravite_immediat', 'signe_visible_inquietant',
        'douleur_intense', 'impact_activites_quotidiennes',
        'depuis_plus_de_3_jours', 'orientation', 'created_at',
    )
