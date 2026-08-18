from django.contrib import admin
from .models import Customer, CustomerTransaction


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'user', 'created_at')
    list_filter = ('user', 'created_at')
    search_fields = ('name', 'phone', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CustomerTransaction)
class CustomerTransactionAdmin(admin.ModelAdmin):
    list_display = ('customer', 'transaction_type', 'amount', 'product', 'created_at')
    list_filter = ('transaction_type', 'created_at', 'customer__user')
    search_fields = ('customer__name', 'product', 'description')
    readonly_fields = ('created_at', 'updated_at')
