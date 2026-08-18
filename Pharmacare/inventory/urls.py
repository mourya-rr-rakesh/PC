from django.urls import path # type: ignore
from .views import medicines, medicine_detail, soon_expiring, expired_medicines, export_medicines, import_medicines, search_medicines

urlpatterns = [
    path('medicines', medicines),
    path('medicines/<int:id>', medicine_detail),
    path('medicines/soon-expiring', soon_expiring),
    path('medicines/expired', expired_medicines),
    path('medicines/export', export_medicines),
    path('medicines/import', import_medicines),
    path('medicines/search', search_medicines),
]
