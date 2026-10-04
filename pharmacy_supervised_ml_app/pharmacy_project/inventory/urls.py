from django.urls import path
from . import views

urlpatterns = [
    path('', views.substitute_finder, name='substitute_finder'),
]
