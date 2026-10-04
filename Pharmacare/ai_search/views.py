import json
import logging
from datetime import date

from django.http import JsonResponse
from django.views.decorators.http import require_POST

from inventory.models import Medicine

from .predictor import (
    SupervisedModelUnavailable,
    normalize_ingredient_names,
    supervised_medicine_predictor,
)

logger = logging.getLogger(__name__)


@require_POST
def supervised_medicine_search(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Your session has expired. Please log in again."},
            status=401,
        )

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Request body must contain valid JSON."}, status=400)

    query = payload.get("query") if isinstance(payload, dict) else None
    if not isinstance(query, str) or not query.strip():
        return JsonResponse({"error": "A medicine name is required."}, status=400)
    query = query.strip()
    if len(query) > 200:
        return JsonResponse({"error": "Medicine name must be 200 characters or fewer."}, status=400)

    try:
        prediction = supervised_medicine_predictor.predict(query)
    except SupervisedModelUnavailable as exc:
        logger.exception("Supervised medicine search model is unavailable")
        return JsonResponse({"error": str(exc)}, status=503)

    predicted_ingredients = normalize_ingredient_names(
        prediction["predicted_composition"]
    )
    inventory_matches = []
    if predicted_ingredients:
        medicines = Medicine.objects.filter(
            user=request.user,
        ).only(
            "id",
            "name",
            "composition",
            "stock",
            "mrp",
        ).order_by("name")

        for medicine in medicines.iterator():
            item = {
                "medicine_id": medicine.id,
                "medicine_name": medicine.name,
                "composition": medicine.composition,
                "stock": medicine.stock,
                "mrp": medicine.mrp,
            }
            medicine_ingredients = normalize_ingredient_names(medicine.composition)
            if (
                f" {predicted_ingredients} " in f" {medicine_ingredients} "
                and len(inventory_matches) < 10
            ):
                inventory_matches.append(item)

    return JsonResponse(
        {
            "supervised_prediction": prediction,
            "inventory_matches": inventory_matches,
        }
    )
