from django.contrib import admin
from .models import Medicine

@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ('name', 'type_form', 'composition', 'mrp', 'sell_price', 'stock')
    search_fields = ('name', 'composition')
