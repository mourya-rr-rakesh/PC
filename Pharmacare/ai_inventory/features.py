from datetime import timedelta

from django.utils import timezone
from django.db.models import Sum

from billing.models import InvoiceItem


def get_medicine_features(medicine):
    today = timezone.now()

    start_30 = today - timedelta(days=30)
    start_90 = today - timedelta(days=90)
    start_180 = today - timedelta(days=180)

    # -----------------------------
    # Recent sales
    # -----------------------------

    items_30 = InvoiceItem.objects.filter(
        medicine_id=medicine.id,
        invoice__created_at__gte=start_30
    )

    items_90 = InvoiceItem.objects.filter(
        medicine_id=medicine.id,
        invoice__created_at__gte=start_90
    )

    items_180 = InvoiceItem.objects.filter(
        medicine_id=medicine.id,
        invoice__created_at__gte=start_180
    )

    sales_30 = sum(item.qty for item in items_30)
    sales_90 = sum(item.qty for item in items_90)
    sales_180 = sum(item.qty for item in items_180)

    # -----------------------------
    # Average monthly sales
    # -----------------------------

    monthly_sales_avg = sales_180 / 6

    # -----------------------------
    # Basic sales trend
    # -----------------------------

    if monthly_sales_avg > 0:
        sales_trend = sales_30 / monthly_sales_avg
    else:
        sales_trend = 0.0

    # -----------------------------
    # Current month sales
    # -----------------------------

    current_month_start = today.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    current_month_items = InvoiceItem.objects.filter(
        medicine_id=medicine.id,
        invoice__created_at__gte=current_month_start
    )

    current_month_demand = sum(
        item.qty for item in current_month_items
    )

    # -----------------------------
    # Month-wise historical sales
    # -----------------------------

    monthly_sales = {}

    for item in items_180.select_related("invoice"):
        month = item.invoice.created_at.month

        if month not in monthly_sales:
            monthly_sales[month] = 0

        monthly_sales[month] += item.qty

    # -----------------------------
    # Seasonal average
    # -----------------------------

    current_month = today.month

    historical_current_month_sales = monthly_sales.get(
        current_month,
        0
    )

    seasonal_average = historical_current_month_sales

    # -----------------------------
    # Seasonality ratio
    # -----------------------------

    if monthly_sales_avg > 0:
        seasonality_ratio = (
            seasonal_average / monthly_sales_avg
        )
    else:
        seasonality_ratio = 0.0

    # -----------------------------
    # Final features
    # -----------------------------

    return {
        "current_stock": float(medicine.stock),

        "sales_30d": float(sales_30),
        "sales_90d": float(sales_90),
        "sales_180d": float(sales_180),

        "monthly_sales_avg": round(
            float(monthly_sales_avg),
            2
        ),

        "sales_trend": round(
            float(sales_trend),
            2
        ),

        "monthly_sales": monthly_sales,

        "seasonal_average": round(
            float(seasonal_average),
            2
        ),

        "current_month_demand": float(
            current_month_demand
        ),

        "seasonality_ratio": round(
            float(seasonality_ratio),
            2
        ),
    }