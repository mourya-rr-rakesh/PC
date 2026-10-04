from django.db import models

class Medicine(models.Model):
    name = models.CharField(max_length=255)
    type_form = models.CharField(max_length=100)
    composition = models.CharField(max_length=255, db_index=True)
    clean_composition = models.CharField(max_length=255, db_index=True)
    mfg_date = models.DateField(null=True, blank=True)
    exp_date = models.DateField(null=True, blank=True)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.name} ({self.composition})"
