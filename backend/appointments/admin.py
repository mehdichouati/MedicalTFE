from django.contrib import admin
from .models import WeeklyAvailability, Absence, Appointment, MedicalDocument

admin.site.register(WeeklyAvailability)
admin.site.register(Absence)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'professional', 'medical_house', 'start_datetime', 'status')
    list_filter = ('status', 'medical_house')
    search_fields = ('patient__username', 'professional__username')


@admin.register(MedicalDocument)
class MedicalDocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'uploaded_by', 'document_type', 'title', 'uploaded_at')
    list_filter = ('document_type',)
    search_fields = ('patient__username', 'title')