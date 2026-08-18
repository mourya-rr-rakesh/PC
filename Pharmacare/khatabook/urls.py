from django.urls import path
from . import views

urlpatterns = [
    # Main Khatabook view
    path('khatabook.html', views.khatabook, name='khatabook'),
    
    # Customer management
    path('khatabook/add-customer/', views.add_customer, name='add_customer'),
    path('khatabook/customer/<int:customer_id>/edit/', views.edit_customer, name='edit_customer'),
    path('khatabook/customer/<int:customer_id>/delete/', views.delete_customer, name='delete_customer'),
    
    # Transaction management
    path('khatabook/customer/<int:customer_id>/add-transaction/', views.add_transaction, name='add_transaction'),
    path('khatabook/transaction/<int:transaction_id>/edit/', views.edit_transaction, name='edit_transaction'),
    path('khatabook/transaction/<int:transaction_id>/delete/', views.delete_transaction, name='delete_transaction'),
    
    # Invoice management
    path('khatabook/transaction/<int:transaction_id>/upload-invoice/', views.upload_invoice, name='upload_invoice'),
    
    # Messaging
    path('khatabook/customer/<int:customer_id>/send-message/', views.send_message_to_customer, name='send_message'),
    
    # Total customers page
    path('total-customers.html', views.total_customers, name='total_customers'),
]
