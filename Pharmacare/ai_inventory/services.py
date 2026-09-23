from .features import get_medicine_features
from .predictor import predict_risk


def generate_inventory_risk(medicine):

    features = get_medicine_features(medicine)

    risk_probability = predict_risk(features)

    if risk_probability >= 0.75:
        risk_level = "HIGH"
    elif risk_probability >= 0.40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "risk_probability": risk_probability,
        "risk_level": risk_level,
    }