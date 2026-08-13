from django.db import models
from django.conf import settings

class Invoice(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    customer_name = models.CharField(max_length=200, blank=True)
    subtotal = models.FloatField(default=0)
    total = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    medicine_id = models.IntegerField()
    medicine_name = models.CharField(max_length=200)
    qty = models.IntegerField()
    base_mrp = models.FloatField()
    per_item_markup = models.FloatField(default=0)
