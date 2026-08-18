from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'first_name', 'role', 'org', 'phone', 'subscription_status')
    list_filter = ('role', 'subscription_status')
    search_fields = ('username', 'email', 'first_name', 'org')
    ordering = ('username',)

