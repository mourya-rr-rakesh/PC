"""
URL configuration for pharmacare project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from .views import *
from inventory.views import expired_medicines, soon_expiring, soon_expiring_page, expired_medicines as expired_medicines_api
from . import views

urlpatterns = [
    # Main pages
    path('', home, name='home'),
    path('login.html', login_page, name='login'),
    path('registration.html', register_page, name='register'),
    path('register.html', register_page, name='register_page'),
    path('logout.html', logout_view, name='logout'),
    
    # Auth endpoints
    path('register', register_view, name='register_view'),
    path('login', login_view, name='login_view'),
    path('logout', logout_view, name='logout_view'),
    path('profile_api', profile_api, name='profile_api'),
    path('update-profile', update_profile, name='update_profile'),
    
    # Dashboard pages
    path('dashboard.html', dashboard, name='dashboard'),
    path('profile.html', profile, name='profile'),
    path('total-medicines.html', total_medicines, name='total_medicines'),
    path('soon-expiring.html', soon_expiring_page, name='soon_expiring'),
    path('expired-medicine.html', views.expired_medicines_page, name='expired_medicines'),  # For backward compatibility
    path('expired-medicines/', views.expired_medicines_page, name='expired_medicines_page'),  # ✅ HTML page
    path('medicines/expired', expired_medicines_api, name='expired_medicines_api'),         # ✅ JSON API
    path('billing.html', billing, name='billing'),
    path('admin.html', admin_panel, name='admin'),
    
    # Admin API endpoints
    path('admin/users', admin_users_api, name='admin_users_api'),
    path('admin/users/<str:email>', admin_delete_user, name='admin_delete_user'),
    path('admin/users/<str:email>/subscription', admin_update_subscription, name='admin_update_subscription'),
    path('api/ai-search/', ai_search, name='ai_search'),

    # Include app URLs
    path('', include('accounts.urls')),
    path('', include('inventory.urls')),
    path('', include('billing.urls')),
    path('', include('khatabook.urls')),


]
