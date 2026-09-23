from django.urls import path

from .views import (
    search_and_match_medicine,
    ai_search_page,
)


urlpatterns = [

    path(
        "search/",
        ai_search_page,
        name="ai_search_page"
    ),

    path(
        "api/search/",
        search_and_match_medicine,
        name="ai_medicine_search"
    ),

]