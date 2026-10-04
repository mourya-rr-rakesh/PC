import os
import pickle
import re
from pathlib import Path

from .models import Medicine


class SupervisedMLPredictor:
    def __init__(self):
        self.model_path = Path(__file__).resolve().parent.parent / "supervised_model.pkl"
        self.vectorizer = None
        self.model = None
        self.algorithm = None
        self.training_records = 0
        self.target_column = None
        self.is_loaded = False
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, "rb") as model_file:
                data = pickle.load(model_file)
                self.vectorizer = data["vectorizer"]
                self.model = data["model"]
                self.algorithm = data.get("algorithm", "unknown")
                self.training_records = data.get("training_records", 0)
                self.target_column = data.get("target_column", "unknown")
                self.is_loaded = True

    def _margin_percentage(self, buy_price, sell_price):
        if not buy_price or buy_price <= 0:
            return 0.0
        return round(((sell_price - buy_price) / buy_price) * 100, 2)

    def _mrp_margin_percentage(self, mrp, sell_price):
        if not mrp or mrp <= 0:
            return 0.0
        return round(((mrp - sell_price) / mrp) * 100, 2)

    def predict_and_find_substitutes(self, query):
        if not self.is_loaded:
            self.load_model()
            if not self.is_loaded:
                return None, []

        query_vec = self.vectorizer.transform([query])
        predicted_salt = self.model.predict(query_vec)[0]
        probabilities = self.model.predict_proba(query_vec)[0]
        confidence = round(max(probabilities) * 100, 1)

        normalized_composition = re.sub(
            r"\s+",
            " ",
            predicted_salt.lower().replace("(", " ").replace(")", " "),
        ).strip()
        substitutes = Medicine.objects.filter(
            clean_composition=normalized_composition
        ).order_by("-stock", "sell_price")

        detailed_substitutes = []
        for sub in substitutes:
            detailed_substitutes.append(
                {
                    "id": sub.id,
                    "name": sub.name,
                    "type_form": sub.type_form,
                    "composition": sub.composition,
                    "mrp": sub.mrp,
                    "buy_price": sub.buy_price,
                    "sell_price": sub.sell_price,
                    "stock": sub.stock,
                    "margin_percentage": self._margin_percentage(sub.buy_price, sub.sell_price),
                    "mrp_margin_percentage": self._mrp_margin_percentage(sub.mrp, sub.sell_price),
                }
            )

        return {
            "predicted_composition": predicted_salt,
            "confidence": confidence,
            "algorithm": self.algorithm.upper() if isinstance(self.algorithm, str) else self.algorithm,
            "training_records": self.training_records,
            "target_column": self.target_column,
            "model_path": str(self.model_path),
        }, detailed_substitutes


supervised_ai = SupervisedMLPredictor()
