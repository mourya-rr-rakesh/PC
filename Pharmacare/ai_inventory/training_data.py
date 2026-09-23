from datetime import datetime

from django.utils import timezone

from billing.models import InvoiceItem


def get_month_start(year, month):
    """
    Given year and month, return the first day of that month.
    """
    return datetime(
        year,
        month,
        1,
        tzinfo=timezone.get_current_timezone()
    )


def get_previous_month(year, month):
    """
    Return previous month as (year, month).
    """
    if month == 1:
        return year - 1, 12

    return year, month - 1


def build_demand_training_data():
    """
    Build historical training examples for medicine demand prediction.

    Each training example uses previous months' sales
    to predict the following month's sales.
    """

    items = (
        InvoiceItem.objects
        .select_related("invoice")
        .order_by("invoice__created_at")
    )

    # -------------------------------------------------
    # Step 1: Group sales month-wise for each medicine
    # -------------------------------------------------

    monthly_sales = {}

    for item in items:

        if not item.invoice_id:
            continue

        medicine_id = item.medicine_id

        sale_date = item.invoice.created_at

        year = sale_date.year
        month = sale_date.month

        key = (medicine_id, year, month)

        if key not in monthly_sales:
            monthly_sales[key] = 0

        monthly_sales[key] += item.qty

    # -------------------------------------------------
    # Step 2: Create training samples
    # -------------------------------------------------

    training_data = []

    medicine_ids = set(
        medicine_id
        for medicine_id, year, month in monthly_sales.keys()
    )

    for medicine_id in medicine_ids:

        # Get all months for this medicine
        medicine_months = sorted(
            [
                (year, month)
                for mid, year, month in monthly_sales.keys()
                if mid == medicine_id
            ]
        )

        # Need enough historical data
        if len(medicine_months) < 4:
            continue

        for index in range(3, len(medicine_months)):

            target_year, target_month = medicine_months[index]

            # Previous 3 months
            month_1_year, month_1_month = medicine_months[index - 1]
            month_2_year, month_2_month = medicine_months[index - 2]
            month_3_year, month_3_month = medicine_months[index - 3]

            sales_1 = monthly_sales.get(
                (medicine_id, month_1_year, month_1_month),
                0
            )

            sales_2 = monthly_sales.get(
                (medicine_id, month_2_year, month_2_month),
                0
            )

            sales_3 = monthly_sales.get(
                (medicine_id, month_3_year, month_3_month),
                0
            )

            # Target = sales in the month we want to predict
            target_sales = monthly_sales.get(
                (medicine_id, target_year, target_month),
                0
            )

            # Average of previous 3 months
            previous_3_month_avg = (
                sales_1 + sales_2 + sales_3
            ) / 3

            # Simple recent trend
            if sales_3 > 0:
                sales_growth = sales_1 / sales_3
            else:
                sales_growth = 0

            training_data.append(
                {
                    "medicine_id": medicine_id,

                    # Time feature
                    "month": target_month,

                    # Historical demand
                    "sales_previous_month": float(sales_1),
                    "sales_2_months_ago": float(sales_2),
                    "sales_3_months_ago": float(sales_3),

                    # Derived features
                    "previous_3_month_avg": round(
                        previous_3_month_avg,
                        2
                    ),

                    "sales_growth": round(
                        sales_growth,
                        2
                    ),

                    # What the model should learn to predict
                    "target_demand": float(target_sales),
                }
            )

    return training_data