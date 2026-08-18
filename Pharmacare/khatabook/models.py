from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

User = get_user_model()


class Customer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='khatabook_customers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'name')  # Customer names must be unique per user
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class CustomerTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = (
        ('credit', 'Credit (Sold)'),
        ('debit', 'Debit (Purchased)'),
    )

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES, default='credit')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    product = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    invoice_file = models.FileField(upload_to='invoices/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.name} - {self.amount} - {self.created_at.strftime('%Y-%m-%d')}"

    @property
    def total_balance(self):
        """Calculate customer's total balance"""
        transactions = CustomerTransaction.objects.filter(customer=self.customer)
        credit_amount = transactions.filter(transaction_type='credit').aggregate(models.Sum('amount'))['amount__sum'] or 0
        debit_amount = transactions.filter(transaction_type='debit').aggregate(models.Sum('amount'))['amount__sum'] or 0
        return credit_amount - debit_amount
