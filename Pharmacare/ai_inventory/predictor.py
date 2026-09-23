import joblib
import os

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "ml",
    "inventory_risk_model.pkl"
)

model = joblib.load(MODEL_PATH)


def predict_risk(features):

    values = [[
        features["sales_30d"],
        features["sales_90d"],
        features["current_stock"],
    ]]

    probability = model.predict_proba(values)[0][1]

    return probability