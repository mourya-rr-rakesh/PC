import os
import pickle
import re
from pathlib import Path

from django.conf import settings


class SupervisedModelUnavailable(Exception):
    pass


def _predict_sparse_cosine_knn(model, vector):
    import numpy as np

    similarities = np.asarray((model._fit_X @ vector.T).toarray()).reshape(-1)
    neighbor_count = model.n_neighbors
    neighbor_indices = np.argpartition(-similarities, neighbor_count - 1)[
        :neighbor_count
    ]
    distances = np.clip(1.0 - similarities[neighbor_indices], 0.0, 2.0)
    zero_distances = distances == 0
    if zero_distances.any():
        weights = zero_distances.astype(float)
    else:
        weights = 1.0 / distances

    class_weights = np.bincount(
        model._y[neighbor_indices].astype(np.intp),
        weights=weights,
        minlength=len(model.classes_),
    )
    total_weight = class_weights.sum()
    predicted_class = int(class_weights.argmax())
    return (
        str(model.classes_[predicted_class]),
        round(float(class_weights[predicted_class] / total_weight) * 100, 1),
    )


class SupervisedMedicinePredictor:
    def __init__(self):
        self._model_data = None

    def _model_paths(self):
        configured_path = os.environ.get("PHARMACARE_SUPERVISED_MODEL_PATH")
        if configured_path:
            return [Path(configured_path)]

        app_model_path = Path(__file__).resolve().parent / "supervised_model.pkl"
        development_model_path = (
            settings.BASE_DIR.parent
            / "pharmacy_supervised_ml_app"
            / "pharmacy_project"
            / "supervised_model.pkl"
        )
        return [app_model_path, development_model_path]

    def _load_model(self):
        if self._model_data is not None:
            return self._model_data

        model_path = next((path for path in self._model_paths() if path.is_file()), None)
        if model_path is None:
            raise SupervisedModelUnavailable(
                "Supervised medicine model is missing. Set "
                "PHARMACARE_SUPERVISED_MODEL_PATH or add "
                "ai_search/supervised_model.pkl."
            )

        try:
            with model_path.open("rb") as model_file:
                model_data = pickle.load(model_file)
        except (
            OSError,
            EOFError,
            pickle.PickleError,
            ImportError,
            AttributeError,
            ValueError,
        ) as exc:
            raise SupervisedModelUnavailable(
                "Could not load the supervised medicine model artifact."
            ) from exc

        if not isinstance(model_data, dict) or not {
            "vectorizer",
            "model",
        }.issubset(model_data):
            raise SupervisedModelUnavailable(
                f"The supervised medicine model at {model_path} has an invalid format."
            )

        if hasattr(model_data["model"], "n_jobs"):
            model_data["model"].n_jobs = 1

        self._model_data = model_data
        return self._model_data

    def predict(self, query):
        model_data = self._load_model()
        try:
            vector = model_data["vectorizer"].transform([query])
            model = model_data["model"]
            confidence = None
            from sklearn.neighbors import KNeighborsClassifier
            from scipy.sparse import issparse

            if (
                isinstance(model, KNeighborsClassifier)
                and model.metric == "cosine"
                and model.weights == "distance"
                and model_data["vectorizer"].norm == "l2"
                and issparse(model._fit_X)
            ):
                composition, confidence = _predict_sparse_cosine_knn(model, vector)
            else:
                composition = str(model.predict(vector)[0])
                if hasattr(model, "predict_proba"):
                    confidence = round(
                        float(max(model.predict_proba(vector)[0])) * 100, 1
                    )
        except (AttributeError, KeyError, TypeError, ValueError) as exc:
            raise SupervisedModelUnavailable(
                "The supervised medicine model could not process this search."
            ) from exc

        algorithm = model_data.get("algorithm")
        return {
            "predicted_composition": composition,
            "confidence": confidence,
            "algorithm": algorithm.upper() if isinstance(algorithm, str) else algorithm,
            "training_records": model_data.get("training_records"),
            "target_column": model_data.get("target_column"),
        }


def normalize_composition(value):
    normalized = str(value or "").casefold()
    normalized = re.sub(r"(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", " ", normalized)
    return " ".join(re.findall(r"[a-z0-9]+", normalized))


def normalize_ingredient_names(value):
    normalized = str(value or "").casefold()
    normalized = re.sub(
        r"\b\d+(?:\.\d+)?\s*(?:mcg|μg|ug|mg|g|ml|l|iu|units?)\b",
        " ",
        normalized,
    )
    return " ".join(re.findall(r"[a-z]+", normalized))


supervised_medicine_predictor = SupervisedMedicinePredictor()
