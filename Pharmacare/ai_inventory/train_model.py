import os

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATASET_PATH = os.path.join(
    BASE_DIR,
    "datasets",
    "raw_sales_transactions.csv"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "ai_inventory",
    "ml"
)

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "demand_model.pkl"
)


def build_training_data():

    print("Loading dataset...")

    df = pd.read_csv(DATASET_PATH)

    df["sale_date"] = pd.to_datetime(
        df["sale_date"]
    )

    # -------------------------------------------------
    # 1. Monthly sales
    # -------------------------------------------------

    monthly = (
        df.groupby(
            [
                "shop_id",
                "medicine_id",
                "medicine_name",
                df["sale_date"].dt.to_period("M")
            ],
            as_index=False
        )["quantity"]
        .sum()
    )

    monthly = monthly.rename(
        columns={
            "sale_date": "month",
            "quantity": "monthly_sales"
        }
    )

    monthly["month"] = (
        monthly["month"]
        .dt.to_timestamp()
    )

    training_rows = []

    # -------------------------------------------------
    # 2. Build history for every shop + medicine
    # -------------------------------------------------

    for (shop_id, medicine_id), group in monthly.groupby(
        ["shop_id", "medicine_id"]
    ):

        group = (
            group
            .sort_values("month")
            .reset_index(drop=True)
        )

        # Continuous monthly timeline
        full_months = pd.date_range(
            start=group["month"].min(),
            end=group["month"].max(),
            freq="MS"
        )

        group = (
            group
            .set_index("month")
            .reindex(full_months)
            .rename_axis("month")
            .reset_index()
        )

        # Missing months = zero sales
        group["monthly_sales"] = (
            group["monthly_sales"]
            .fillna(0)
        )

        # Restore identifiers
        group["shop_id"] = shop_id
        group["medicine_id"] = medicine_id

        # -------------------------------------------------
        # 3. Create ML features
        # -------------------------------------------------

        for i in range(3, len(group)):

            sales_1 = float(
                group.loc[
                    i - 1,
                    "monthly_sales"
                ]
            )

            sales_2 = float(
                group.loc[
                    i - 2,
                    "monthly_sales"
                ]
            )

            sales_3 = float(
                group.loc[
                    i - 3,
                    "monthly_sales"
                ]
            )

            previous_3_avg = (
                sales_1 +
                sales_2 +
                sales_3
            ) / 3

            target_demand = float(
                group.loc[
                    i,
                    "monthly_sales"
                ]
            )

            month_number = int(
                group.loc[
                    i,
                    "month"
                ].month
            )

            training_rows.append(
                {
                    "shop_id": shop_id,
                    "medicine_id": medicine_id,
                    "month": month_number,

                    "sales_previous_month": sales_1,

                    "sales_2_months_ago": sales_2,

                    "sales_3_months_ago": sales_3,

                    "previous_3_month_avg": (
                        previous_3_avg
                    ),

                    "target_demand": (
                        target_demand
                    ),
                }
            )

    return pd.DataFrame(training_rows)


def train_model():

    print(
        "\n========== DEMAND MODEL TRAINING =========="
    )

    # -------------------------------------------------
    # Build training dataset
    # -------------------------------------------------

    training_df = build_training_data()

    print(
        f"Training samples generated: "
        f"{len(training_df)}"
    )

    if training_df.empty:

        raise ValueError(
            "No training data could be generated."
        )

    if len(training_df) < 50:

        raise ValueError(
            f"Not enough training samples: "
            f"{len(training_df)}. "
            f"Need at least 50."
        )

    # -------------------------------------------------
    # Features
    # -------------------------------------------------

    feature_columns = [
        "shop_id",
        "medicine_id",
        "month",
        "sales_previous_month",
        "sales_2_months_ago",
        "sales_3_months_ago",
        "previous_3_month_avg",
    ]

    X = training_df[
        feature_columns
    ].copy()

    y = training_df[
        "target_demand"
    ].copy()

    # -------------------------------------------------
    # Convert shop IDs to numeric codes
    # -------------------------------------------------

    shop_mapping = {
        shop_id: index
        for index, shop_id
        in enumerate(
            sorted(
                X["shop_id"]
                .unique()
            )
        )
    }

    X["shop_id"] = (
        X["shop_id"]
        .map(shop_mapping)
        .astype(int)
    )

    # -------------------------------------------------
    # IMPORTANT:
    # Keep chronological order.
    # Do NOT randomly shuffle time-series data.
    # -------------------------------------------------

    split_index = int(
        len(X) * 0.80
    )

    X_train = X.iloc[
        :split_index
    ]

    X_test = X.iloc[
        split_index:
    ]

    y_train = y.iloc[
        :split_index
    ]

    y_test = y.iloc[
        split_index:
    ]

    print(
        f"Training rows: {len(X_train)}"
    )

    print(
        f"Validation rows: {len(X_test)}"
    )

    # -------------------------------------------------
    # Random Forest Demand Model
    # -------------------------------------------------

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )

    print(
        "\nTraining Random Forest..."
    )

    model.fit(
        X_train,
        y_train
    )

    # -------------------------------------------------
    # Validation
    # -------------------------------------------------

    predictions = model.predict(
        X_test
    )

    mae = mean_absolute_error(
        y_test,
        predictions
    )

    print(
        f"\nValidation MAE: "
        f"{mae:.2f} units"
    )

    # -------------------------------------------------
    # Save model
    # -------------------------------------------------

    os.makedirs(
        MODEL_DIR,
        exist_ok=True
    )

    model_package = {
        "model": model,

        "feature_columns": (
            feature_columns
        ),

        "shop_mapping": (
            shop_mapping
        ),

        "model_version": (
            "demand_v1"
        ),
    }

    joblib.dump(
        model_package,
        MODEL_PATH
    )

    print(
        "\nModel saved successfully:"
    )

    print(
        MODEL_PATH
    )


if __name__ == "__main__":

    train_model()