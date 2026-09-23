import json
import logging
import re

from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from inventory.models import Medicine

from .external_sources import get_medicine_information

logger = logging.getLogger(__name__)


@csrf_exempt
def search_and_match_medicine(request):
    """
    Search and identify medicines.

    Architecture:
    1. Check local inventory first.
    2. If found in inventory: return inventory details (and optional enrichment).
    3. If not found in inventory: perform external medicine research via Gemini
       grounded with live Google Search and verified reliable sources.
    4. Distinguish clearly between:
       - local inventory matches
       - external research success
       - inability to identify the medicine from available evidence
       - technical API / service errors
    """
    if request.method not in ["GET", "POST"]:
        return JsonResponse(
            {
                "error": "Method not allowed"
            },
            status=405
        )

    # -----------------------------------------
    # Get search query
    # -----------------------------------------
    if request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse(
                {
                    "error": "Invalid JSON"
                },
                status=400
            )

        query = data.get("query", "").strip()
        enrich = str(data.get("enrich", "")).lower() in ("true", "1")
    else:
        query = request.GET.get("query", "").strip()
        enrich = request.GET.get("enrich", "").lower() in ("true", "1")

    # -----------------------------------------
    # Empty query check
    # -----------------------------------------
    if not query:
        return JsonResponse(
            {
                "error": "Medicine query is required"
            },
            status=400
        )

    # =========================================
    # 1. SEARCH OWN INVENTORY FIRST
    # =========================================
    inventory_queryset = Medicine.objects.all()
    if getattr(request, "user", None) is not None and request.user.is_authenticated:
        inventory_queryset = inventory_queryset.filter(user=request.user)

    # Match the complete query first, then its meaningful words. This supports
    # names with strengths/forms without hard-coding individual medicines.
    local_query = Q(name__icontains=query) | Q(type__icontains=query) | Q(composition__icontains=query)
    query_terms = [term for term in re.findall(r"[\w.]+", query) if len(term) > 1]
    if query_terms:
        term_query = Q()
        for term in query_terms:
            term_query &= Q(name__icontains=term) | Q(type__icontains=term) | Q(composition__icontains=term)
        local_query |= term_query

    inventory_matches = inventory_queryset.filter(local_query).order_by("name")[:10]
    medicines = [
        {
            "medicine_id": medicine.id,
            "medicine_name": medicine.name,
            "composition": medicine.composition or "Not available",
            "stock": float(getattr(medicine, "stock", 0) or 0),
            "mrp": float(getattr(medicine, "mrp", 0.0) or 0.0),
        }
        for medicine in inventory_matches
    ]

    # =========================================
    # 2. NOT FOUND IN INVENTORY
    #    SEARCH EXTERNAL SOURCES VIA GEMINI + GOOGLE SEARCH
    # =========================================
    try:
        # External research is deliberately run even when local matches exist,
        # so the UI can show inventory and verified reference data together.
        external_info = get_medicine_information(query)
    except Exception as e:
        logger.exception("AI Medicine Search Service Exception: %s", e)
        external_info = {
            "found": False,
            "source": None,
            "error": "External medicine discovery is temporarily unavailable.",
            "medicine_name": query,
            "composition": "Not available",
            "description": "Not available",
            "age_information": "Not available",
            "sources": [],
        }

    # If external research encountered a technical failure (e.g., API key or network)
    if external_info.get("error") and not external_info.get("found"):
        logger.error("External search returned error: %s", external_info["error"])

    # =========================================
    # 3. RETURN EXTERNAL RESULT
    # =========================================
    return JsonResponse(
        {
            "searched_query": query,
            "source": "inventory" if medicines else "external",
            "found_in_inventory": bool(medicines),
            "inventory_matches": medicines,
            "external_info": external_info,
            "message": external_info.get("error") if external_info.get("error") else None,
        }
    )


def ai_search_page(request):
    """
    Render the AI Medicine Search interface page.
    """
    return render(
        request,
        "ai_search/search.html"
    )