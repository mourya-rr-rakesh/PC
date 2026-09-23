from django.db import models
from inventory.models import Medicine


class AIInventoryRiskPrediction(models.Model):

    RISK_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
    ]

    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.CASCADE,
        related_name="ai_risk_predictions"
    )

    prediction_date = models.DateField(auto_now_add=True)

    current_stock = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    predicted_demand_30d = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    predicted_demand_60d = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )

    risk_level = models.CharField(
        max_length=10,
        choices=RISK_CHOICES
    )

    expected_excess_qty = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    model_version = models.CharField(
        max_length=50,
        default="v1"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["medicine", "prediction_date"]
            ),
            models.Index(
                fields=["risk_level"]
            ),
        ]

    def __str__(self):
        return f"{self.medicine.name} - {self.risk_level} - {self.risk_score}%"