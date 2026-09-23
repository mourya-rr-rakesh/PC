"""
medicines/views_ai_search.py

The new AI Medicine Search endpoint.

HOW TO WIRE THIS IN
--------------------
You have two options:

  1. (Recommended for a clean diff) Keep this as its own file and add
     one line to your existing medicines/urls.py:

         from medicines.views_ai_search import ai_medicine_search

  2. Or copy the `ai_medicine_search` function (and the two small
     helpers above it) into your existing medicines/views.py if you
     prefer everything in one file. Nothing here depends on anything
     else being in this specific file.

>>> THREE PLACES BELOW ARE MARKED "ADJUST ME" <<<
They exist because I don't have your actual Medicine model in front
of me. Everything else (AI call, validation, matching, JSON shape)
works as-is.
"""

import json
import logging

from django.contrib.auth.decorators import login_required  # remove if search is public
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .services.ai_service import (
    get_medicine_from_local_ai,
    AIServiceError,
    AIUnavailableError,
    AITimeoutError,
    AIResponseInvalidError,
)
from .services.ingredient_matcher import (
    CandidateComposition,
    MatchConfig,
    find_matches,
)
from .services.normalizer import parse_composition_string

logger = logging.getLogger(__name__)

# ADJUST ME (1 of 3): import your real Medicine model.
# from .models import Medicine


# ---------------------------------------------------------------------------
# Step 1: reuse the existing database search, if you have one.
# ---------------------------------------------------------------------------

def _find_existing_exact_match(medicine_name: str):
    """
    ADJUST ME (2 of 3): call your project's EXISTING search logic here
    (the same function/queryset your normal search bar already uses)
    so "check the database again" (spec step 2-3) reuses real logic
    instead of a second, divergent implementation.

    Return the existing Medicine instance if an exact/near-exact match
    is found, else return None. Example (adjust field name):

        return Medicine.objects.filter(name__iexact=medicine_name).first()

    If your project already has something like
    `medicines/services/search.py` or a `search_medicines(query)`
    helper, call that here instead of writing new query logic.
    """
    return None


def _existing_medicine_to_response_dict(medicine_obj) -> dict:
    """
    ADJUST ME (2 of 3, continued): map your existing Medicine model's
    fields into the response shape the frontend expects. Example:

        return {
            "name": medicine_obj.name,
            "composition": [
                {"ingredient": c.ingredient, "strength": c.strength}
                for c in medicine_obj.composition.all()
            ],
            "description": medicine_obj.description,
            "age": medicine_obj.age_group,
        }
    """
    raise NotImplementedError(
        "_existing_medicine_to_response_dict needs to be adjusted to your "
        "Medicine model's real fields."
    )


# ---------------------------------------------------------------------------
# Step 2: build candidates for the matcher from your existing DB.
# ---------------------------------------------------------------------------

def _build_candidate_compositions(ai_ingredient_names):
    """
    ADJUST ME (3 of 3): query your existing Medicine table for
    candidates worth scoring, then wrap each one as a
    CandidateComposition so the matcher can compare it against the
    AI-extracted composition.

    Only pull medicines that plausibly overlap (e.g. filter by any of
    the AI-detected ingredient names first) rather than scoring your
    entire medicine table on every request.

    Example, assuming a Medicine model with a free-text `composition`
    field (adjust to structured fields if you have them):

        from django.db.models import Q
        q = Q()
        for name in ai_ingredient_names:
            q |= Q(composition__icontains=name)
        queryset = Medicine.objects.filter(q)[:200]

        candidates = []
        for med in queryset:
            components = parse_composition_string(med.composition)
            candidates.append(
                CandidateComposition(
                    id=med.id,
                    name=med.name,
                    components=components,
                    composition_display=med.composition,
                )
            )
        return candidates
    """
    return []  # placeholder — see docstring above


# ---------------------------------------------------------------------------
# The endpoint
# ---------------------------------------------------------------------------

@require_POST
# @login_required  # uncomment if the medicine search requires auth
def ai_medicine_search(request):
    """
    POST /medicines/ai-search/
    Body: {"medicine_name": "XYZ 500"}

    See services/ai_service.py and services/ingredient_matcher.py for
    the actual AI call and matching logic — this view just wires the
    request/response together and handles errors gracefully.
    """
    try:
        body = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse(
            {"success": False, "error": "Invalid request body."}, status=400
        )

    medicine_name = (body.get("medicine_name") or "").strip()
    if not medicine_name:
        return JsonResponse(
            {"success": False, "error": "Please enter a medicine name to search."},
            status=400,
        )

    # --- Step 1: re-check the existing database first ---------------------
    try:
        existing = _find_existing_exact_match(medicine_name)
    except Exception:
        logger.exception("Existing database search failed during AI search fallback")
        existing = None

    if existing is not None:
        try:
            medicine_dict = _existing_medicine_to_response_dict(existing)
        except NotImplementedError:
            # Wiring not finished yet — fall through to AI path instead of
            # crashing, so the feature is testable before every TODO is done.
            medicine_dict = None

        if medicine_dict is not None:
            return JsonResponse(
                {
                    "success": True,
                    "source": "database",
                    "medicine": medicine_dict,
                    "matches": [],
                }
            )

    # --- Step 2: not found (or found) -> ask the local AI to identify it --
    try:
        ai_result = get_medicine_from_local_ai(medicine_name)
    except AITimeoutError:
        return JsonResponse(
            {"success": False, "error": "The AI model took too long to respond. Please try again."},
            status=504,
        )
    except AIUnavailableError:
        return JsonResponse(
            {"success": False, "error": "The local AI model is currently unavailable."},
            status=503,
        )
    except AIResponseInvalidError:
        return JsonResponse(
            {"success": False, "error": "The AI could not identify this medicine. Try a more specific name."},
            status=422,
        )
    except AIServiceError as exc:
        logger.exception("Unhandled AI service error")
        return JsonResponse(
            {"success": False, "error": "Something went wrong while searching. Please try again."},
            status=500,
        )

    medicine_payload = ai_result.to_dict()

    if not ai_result.composition:
        return JsonResponse(
            {
                "success": True,
                "source": "ai",
                "medicine": medicine_payload,
                "matches": [],
                "notice": "The AI could not detect a clear composition for this medicine.",
            }
        )

    # --- Step 3: database matching based on AI-extracted composition ------
    ingredient_names = [c.ingredient for c in ai_result.composition]

    try:
        candidates = _build_candidate_compositions(ingredient_names)
    except Exception:
        logger.exception("Failed to build candidate list for matching")
        candidates = []

    ai_composition_for_matcher = [
        {"ingredient": c.ingredient, "strength": c.strength} for c in ai_result.composition
    ]

    matches = find_matches(
        ai_composition_for_matcher,
        candidates,
        config=MatchConfig(),  # tune weights/thresholds here or via settings
    )

    matches_payload = [
        {
            "id": m.id,
            "name": m.name,
            "composition": m.composition_display,
            "ingredient_match": m.ingredient_match,
            "composition_match": m.composition_match,
            "overall_match": m.overall_match,
        }
        for m in matches
    ]

    response = {
        "success": True,
        "source": "ai",
        "medicine": medicine_payload,
        "matches": matches_payload,
        "disclaimer": (
            "Composition similarity does not confirm therapeutic equivalence. "
            "Verify with a qualified healthcare professional."
        ),
    }
    if not matches_payload:
        response["notice"] = (
            "No matching medicine was found in the database based on the "
            "detected composition."
        )

    return JsonResponse(response)
