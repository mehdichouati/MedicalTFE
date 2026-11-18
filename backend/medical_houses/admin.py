from django.contrib import admin
from .models import MedicalHouse, MedicalHouseStaff


class MedicalHouseStaffInline(admin.TabularInline):
    """Permet d'ajouter/retirer un professionnel directement depuis la
    fiche de la maison médicale, sans repasser par une autre page."""

    model = MedicalHouseStaff
    extra = 1
    autocomplete_fields = ('professional',)


@admin.register(MedicalHouse)
class MedicalHouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'postal_code', 'phone_number', 'company_number', 'is_active', 'created_at')
    list_filter = ('is_active', 'city')
    search_fields = ('name', 'city', 'postal_code', 'company_number')
    fieldsets = (
        ('Identité', {
            'fields': ('name', 'company_number', 'is_active'),
        }),
        ('Coordonnées', {
            'fields': ('address', 'postal_code', 'city', 'phone_number', 'email'),
        }),
    )
    inlines = [MedicalHouseStaffInline]


@admin.register(MedicalHouseStaff)
class MedicalHouseStaffAdmin(admin.ModelAdmin):
    list_display = ('professional', 'medical_house', 'joined_at')
    list_filter = ('medical_house',)
    search_fields = ('professional__username', 'medical_house__name')