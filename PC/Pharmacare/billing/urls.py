from django.urls import path
from .views import (
    billing_medicines,
    billing_medicine,
    get_markup,
    set_markup,
    create_invoice
)

urlpatterns = [
    path('billing/medicines', billing_medicines),
    path('billing/medicine/<int:id>', billing_medicine),
    path('billing/markup', get_markup),
    path('billing/markup/set', set_markup),
    path('billing/invoice', create_invoice),
]
