from django.urls import path

from .views import supervised_medicine_search

urlpatterns = [
    path("api/search/", supervised_medicine_search, name="supervised_medicine_search"),
]
