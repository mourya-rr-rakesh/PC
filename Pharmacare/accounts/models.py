from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('admin', 'Admin'),
    )

    SUBSCRIPTION_CHOICES = (
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('inactive', 'Inactive'),
    )

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    org = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    place = models.CharField(max_length=255, blank=True)
    subscription_status = models.CharField(max_length=10, choices=SUBSCRIPTION_CHOICES, default='active')
