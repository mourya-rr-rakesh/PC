import json
import logging
import re
from difflib import SequenceMatcher

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RXNORM_URL = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_URL = "https://api.fda.gov/drug/label.json"


def get_medicine_information(query):
    """
    External medicine lookup system.

    Search flow:
    1. Gemini with Google Search grounding (web research & reliable verification).
    2. Structured sources (RxNorm and openFDA) as fallback/supplement.
    """
    query = (query or "").strip()

    if not query:
        return {
            "found": False,
            "source": None,
            "medicine_name": "",
            "composition": "Not available",
            "strength": "Not available",
            "dosage_form": "Not available",
            "description": "Not available",
            "common_uses": "Not available",
            "age_information": "Not available",
            "warnings": "Not available",
            "sources": [],
        }

    api_key = getattr(settings, "GEMINI_API_KEY", "")
    provider_errors = []

    # =========================================================
    # 1. Gemini + Google Search Grounding (Web Research)
    # =========================================================
    if api_key:
        try:
            gemini_result = search_with_gemini(query)
            if gemini_result.get("found"):
                return gemini_result
            if gemini_result.get("error"):
                # Technical failure occurred during Gemini call
                logger.error("Gemini search failed with error: %s", gemini_result.get("error"))
                provider_errors.append(gemini_result["error"])
        except Exception as exc:
            logger.exception("Unexpected error in search_with_gemini: %s", exc)
            provider_errors.append("Gemini search failed.")

    # =========================================================
    # 2. RxNorm Structured Search
    # =========================================================
    try:
        rxnorm_result = search_rxnorm(query)
        if rxnorm_result.get("found"):
            return rxnorm_result
    except Exception as exc:
        logger.warning("RxNorm search error: %s", exc)
        provider_errors.append("RxNorm search failed.")

    # =========================================================
    # 3. openFDA Structured Search
    # =========================================================
    try:
        fda_result = search_openfda(query)
        if fda_result.get("found"):
            fda_result.setdefault("sources", [])
            return fda_result
    except Exception as exc:
        logger.warning("openFDA search error: %s", exc)
        provider_errors.append("openFDA search failed.")

    # =========================================================
    # 4. Nothing reliably identified
    # =========================================================
    return {
        "found": False,
        "source": None,
        "medicine_name": query,
        "composition": "Not available",
        "strength": "Not available",
        "dosage_form": "Not available",
        "description": "Not available",
        "common_uses": "Not available",
        "age_information": "Not available",
        "warnings": "Not available",
        "sources": [],
        "error": provider_errors[0] if provider_errors else None,
    }


def search_with_gemini(query):
    """
    Perform external web research using Gemini with Google Search grounding.

    Features:
    - Uses installed google-genai SDK.
    - Uses Google Search grounding tool to search live web.
    - Automatic multi-model fallback to handle model deprecations or quota limits.
    - Robust extraction that never fails due to non-strict JSON formatting.
    - Extracts verified web source URLs from grounding metadata.
    """
    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()

    if not api_key:
        return {
            "found": False,
            "source": None,
            "error": "GEMINI_API_KEY is not configured in Django settings.",
        }

    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        logger.error("google-genai SDK not installed: %s", e)
        return {
            "found": False,
            "source": None,
            "error": "google-genai package is not installed.",
        }

    client = genai.Client(api_key=api_key)

    prompt = f"""You are a medicine information retrieval assistant.

Search the web for the medicine, drug, or pharmaceutical product:
"{query}"

Your task:
1. Identify the exact medicine as reliably and factually as possible using authoritative sources (official regulators, government health agencies, manufacturer leaflets, RxNorm/NLM, openFDA, reputable medical and pharmacy references).
2. If the user query has a slight misspelling or typo (e.g. "Paracitamol" for Paracetamol, "Azithromicin" for Azithromycin), identify the intended medicine.
3. If the user query is a brand name (e.g. "Nicip", "Crocin", "Dolo 650", "Augmentin"), identify its active ingredient(s) / generic composition.
4. Return strength and dosage form separately when reliably available.
5. "description": Provide a clear, factual description. Do NOT invent dosage or give personalized diagnosis or treatment plans.
6. Return common uses, age information, and important warnings only when supported by the searched sources.
7. If the query cannot be reliably identified as a medicine or pharmaceutical product from the web search, set "found": false and set other fields to "Not available".
8. Do NOT invent facts or fabricate source names or URLs.

Return ONLY valid JSON with these keys:
{{
  "found": true or false,
  "medicine_name": "exact brand or generic name",
  "composition": "active ingredient(s) and strength/form if available",
    "strength": "strength or Not available",
    "dosage_form": "tablet, capsule, syrup, etc. or Not available",
  "description": "factual overview and common uses",
    "common_uses": "common indications or Not available",
    "age_information": "age or pediatric guidance or Not available",
    "warnings": "important warnings or Not available"
}}
"""

    # Prioritized list of currently supported models for grounded generation.
    configured_model = getattr(settings, "GEMINI_MODEL", "").strip()
    candidate_models = []
    if configured_model:
        candidate_models.append(configured_model)
    default_candidates = [
        "gemini-3.6-flash",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
    ]
    for m in default_candidates:
        if m not in candidate_models:
            candidate_models.append(m)

    response = None
    last_error = None

    grounding_tool = types.Tool(
        google_search=types.GoogleSearch()
    )
    config = types.GenerateContentConfig(
        tools=[grounding_tool]
    )

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            if response:
                break
        except Exception as exc:
            last_error = exc
            err_str = str(exc)
            logger.warning(
                "Gemini model '%s' failed with error: %s. Trying next model...",
                model_name,
                err_str[:120],
            )
            # If 429, 404, or 503, continue to next model
            continue

    if response is None:
        logger.error("All Gemini models failed. Last error: %s", last_error)
        error_text = str(last_error or "Gemini API request failed.")
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text or "quota" in error_text.lower():
            error_text = (
                "Gemini API quota exhausted. Please check billing/limits or configure "
                "another GEMINI_API_KEY, then try again."
            )
        return {
            "found": False,
            "source": None,
            "error": error_text,
        }

    raw_text = (getattr(response, "text", "") or "").strip()
    if not raw_text:
        return {
            "found": False,
            "source": None,
        }

    parsed = parse_gemini_response(raw_text, query)

    if not parsed.get("found"):
        return {
            "found": False,
            "source": None,
            "medicine_name": query,
            "composition": "Not available",
            "strength": "Not available",
            "dosage_form": "Not available",
            "description": "Not available",
            "common_uses": "Not available",
            "age_information": "Not available",
            "warnings": "Not available",
            "sources": [],
        }

    sources = extract_gemini_sources(response)

    return {
        "found": True,
        "source": "Gemini + Google Search",
        "medicine_name": parsed["medicine_name"],
        "composition": parsed["composition"],
        "strength": parsed["strength"],
        "dosage_form": parsed["dosage_form"],
        "description": parsed["description"],
        "common_uses": parsed["common_uses"],
        "age_information": parsed["age_information"],
        "warnings": parsed["warnings"],
        "sources": sources,
    }


def parse_gemini_response(raw_text, original_query=""):
    """
    Robust multi-strategy parser for Gemini responses.

    Ensures the search system never fails merely because Gemini output
    contained markdown formatting, non-strict JSON, trailing commas,
    or plain text summaries.
    """
    cleaned = (raw_text or "").strip()
    data = None

    # Strategy 1: Strip markdown code fences (```json ... ```)
    fence_cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    fence_cleaned = re.sub(r"\s*```$", "", fence_cleaned).strip()
    try:
        candidate = json.loads(fence_cleaned)
        if isinstance(candidate, dict):
            data = candidate
    except Exception:
        pass

    # Strategy 2: Extract first JSON object using regex
    if not isinstance(data, dict):
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            try:
                candidate = json.loads(match.group(0))
                if isinstance(candidate, dict):
                    data = candidate
            except Exception:
                pass

    # Strategy 3: Key-Value Regex Fallback Extraction
    if not isinstance(data, dict):
        data = {}

        m_name = re.search(
            r'["\']?medicine_name["\']?\s*[:=]\s*["\']?([^"\'\n\r]+)',
            cleaned,
            re.IGNORECASE,
        )
        if m_name:
            data["medicine_name"] = m_name.group(1).strip()

        comp = re.search(
            r'["\']?composition["\']?\s*[:=]\s*["\']?([^"\'\n\r]+)',
            cleaned,
            re.IGNORECASE,
        )
        if comp:
            data["composition"] = comp.group(1).strip()

        desc = re.search(
            r'["\']?description["\']?\s*[:=]\s*["\']?([^"\'\n\r]+(?:\n[^\n\r]+)?)',
            cleaned,
            re.IGNORECASE,
        )
        if desc:
            data["description"] = desc.group(1).strip()

        age = re.search(
            r'["\']?age_information["\']?\s*[:=]\s*["\']?([^"\'\n\r]+)',
            cleaned,
            re.IGNORECASE,
        )
        if age:
            data["age_information"] = age.group(1).strip()

        for field, aliases in {
            "strength": r"strength",
            "dosage_form": r"dosage[_ ]form|formulation|form",
            "common_uses": r"common[_ ]uses|uses|indications",
            "warnings": r"warnings|important[_ ]warnings",
        }.items():
            field_match = re.search(
                rf'["\']?(?:{aliases})["\']?\s*[:=]\s*["\']?([^"\'\n\r]+)',
                cleaned,
                re.IGNORECASE,
            )
            if field_match:
                data[field] = field_match.group(1).strip()

        f_match = re.search(
            r'["\']?found["\']?\s*[:=]\s*(true|false)',
            cleaned,
            re.IGNORECASE,
        )
        if f_match:
            data["found"] = f_match.group(1).lower() == "true"

    medicine_name = str(data.get("medicine_name") or original_query).strip()
    composition = str(data.get("composition") or "").strip()
    strength = str(data.get("strength") or "").strip()
    dosage_form = str(data.get("dosage_form") or data.get("formulation") or data.get("form") or "").strip()
    description = str(data.get("description") or "").strip()
    common_uses = str(data.get("common_uses") or data.get("uses") or data.get("indications") or "").strip()
    age_info = str(data.get("age_information") or "").strip()
    warnings = str(data.get("warnings") or data.get("important_warnings") or "").strip()

    # Determine found state
    if "found" in data:
        found_value = data["found"]
        if isinstance(found_value, str):
            found = found_value.strip().lower() in ("true", "yes", "1")
        else:
            found = bool(found_value)
    else:
        found = bool(composition or description)

    # Check for negative identification signals
    neg_phrases = [
        "cannot be identified",
        "could not be identified",
        "not a recognized medicine",
        "no reliable information",
        "not found",
        "unable to identify",
    ]
    if not composition or composition.lower() in ("not available", "none", "unknown", ""):
        if any(p in cleaned.lower() for p in neg_phrases):
            found = False

    if not age_info or age_info.lower() in ("", "none", "null"):
        age_info = "Not available"

    if not composition:
        composition = "Not available"
    if not description:
        description = "Not available"
    if not strength:
        strength = "Not available"
    if not dosage_form:
        dosage_form = "Not available"
    if not common_uses:
        common_uses = "Not available"
    if not warnings:
        warnings = "Not available"

    return {
        "found": found,
        "medicine_name": medicine_name,
        "composition": composition,
        "strength": strength,
        "dosage_form": dosage_form,
        "description": description,
        "common_uses": common_uses,
        "age_information": age_info,
        "warnings": warnings,
    }


def extract_gemini_sources(response):
    """
    Extract source titles and URLs from Gemini Google Search grounding metadata.

    Handles different response representations across SDK versions safely.
    Deduplicates URLs and limits to top reliable sources.
    """
    sources = []
    seen_urls = set()

    try:
        candidates = getattr(response, "candidates", []) or []
        for candidate in candidates:
            metadata = getattr(candidate, "grounding_metadata", None)
            if not metadata:
                continue

            chunks = getattr(metadata, "grounding_chunks", None) or []
            for chunk in chunks:
                web = getattr(chunk, "web", None)
                if web:
                    title = (getattr(web, "title", "") or "").strip()
                    url = (getattr(web, "uri", "") or "").strip()
                    if url and url not in seen_urls:
                        sources.append({
                            "title": title or url,
                            "url": url,
                        })
                        seen_urls.add(url)
                elif isinstance(chunk, dict):
                    web_data = chunk.get("web", {}) or {}
                    title = str(web_data.get("title") or "").strip()
                    url = str(web_data.get("uri") or web_data.get("url") or "").strip()
                    if url and url not in seen_urls:
                        sources.append({
                            "title": title or url,
                            "url": url,
                        })
                        seen_urls.add(url)
    except Exception as exc:
        logger.warning("Failed to extract grounding sources: %s", exc)

    return sources[:10]


def search_rxnorm(query):
    """
    Search RxNorm REST API for medicine concepts.
    """
    response = requests.get(
        f"{RXNORM_URL}/approximateTerm.json",
        params={
            "term": query,
            "maxEntries": 10,
        },
        timeout=10,
    )

    if not response.ok:
        return {"found": False}

    data = response.json()
    candidates = (
        data.get("approximateGroup", {}).get("candidate", [])
    )
    candidates.sort(
        key=lambda x: float(x.get("score", 0)),
        reverse=True,
    )

    for candidate in candidates:
        if not is_relevant_rxnorm_candidate(query, candidate.get("name", "")):
            continue

        rxcui = candidate.get("rxcui")
        if not rxcui:
            continue

        info = get_rxnorm_drug_info(rxcui, query)
        composition = (info.get("composition") or "").strip()

        # A concept-name match alone is not enough to identify a medicine.
        # Require actual ingredient data before returning an RxNorm result.
        if composition and composition.lower() not in (query.lower(), "not available"):
            return {
                "found": True,
                "source": "RxNorm",
                "sources": [],
                **info,
            }

    return {"found": False}


def is_relevant_rxnorm_candidate(query, candidate_name):
    """Reject approximate matches that share only an incidental short token."""
    query_tokens = {
        token for token in re.findall(r"[a-z0-9]+", (query or "").lower())
        if len(token) >= 3
    }
    candidate_tokens = {
        token for token in re.findall(r"[a-z0-9]+", (candidate_name or "").lower())
        if len(token) >= 3
    }

    if query_tokens & candidate_tokens:
        return True

    normalized_query = re.sub(r"[^a-z0-9]+", "", (query or "").lower())
    normalized_candidate = re.sub(r"[^a-z0-9]+", "", (candidate_name or "").lower())
    if not normalized_query or not normalized_candidate:
        return False

    return SequenceMatcher(None, normalized_query, normalized_candidate).ratio() >= 0.65


def get_rxnorm_drug_info(rxcui, original_query=""):
    """
    Fetch concept details from RxNorm by RxCUI.
    """
    try:
        properties_response = requests.get(
            f"{RXNORM_URL}/rxcui/{rxcui}/properties.json",
            timeout=10,
        )
        concept_name = ""
        if properties_response.ok:
            properties_data = properties_response.json()
            properties = properties_data.get("properties", {})
            concept_name = properties.get("name") or ""

        response = requests.get(
            f"{RXNORM_URL}/rxcui/{rxcui}/allrelated.json",
            timeout=10,
        )
        if not response.ok:
            return {}

        data = response.json()
        groups = data.get("allRelatedGroup", {}).get("conceptGroup", [])

        ingredients = []
        for group in groups:
            term_type = group.get("tty")
            for concept in group.get("conceptProperties", []):
                name = (concept.get("name") or "").strip()
                if not name:
                    continue
                if term_type in ["IN", "PIN", "MIN"]:
                    ingredients.append(name)

        ingredients = list(dict.fromkeys(ingredients))

        composition = ", ".join(ingredients)

        description = f"RxNorm medicine concept: {concept_name}" if concept_name else "Not available"

        return {
            "medicine_name": concept_name or original_query,
            "composition": composition or "Not available",
            "strength": "Not available",
            "dosage_form": "Not available",
            "description": description,
            "common_uses": "Not available",
            "age_information": "Not available",
            "warnings": "Not available",
            "sources": [{
                "title": "RxNorm / NLM",
                "url": f"{RXNORM_URL}/rxcui/{rxcui}/properties.json",
            }],
        }
    except requests.RequestException:
        return {}


def search_openfda(query):
    """
    Search openFDA drug labels API.
    """
    try:
        query_variants = [query]
        base_query = re.sub(
            r"\b(?:tablet|tablets|tab|capsule|cap|syrup|injection|cream|gel)\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%)\b",
            " ",
            query,
            flags=re.IGNORECASE,
        ).strip()
        if base_query and base_query.lower() != query.lower():
            query_variants.append(base_query)

        results = []
        for query_variant in query_variants:
            response = requests.get(
                OPENFDA_URL,
                params={
                    "search": f'openfda.brand_name:"{query_variant}"',
                    "limit": 5,
                },
                timeout=10,
            )
            if response.ok:
                results = response.json().get("results", [])
            if results:
                break

        if not results:
            return {"found": False}

        result = results[0]

        composition = first_value(result.get("active_ingredient"))
        if not composition:
            composition = first_value(result.get("openfda", {}).get("generic_name"))

        description = first_value(result.get("description"))
        if not description:
            description = first_value(result.get("indications_and_usage"))

        age_information = first_value(result.get("pediatric_use"))
        if not age_information:
            age_information = first_value(result.get("use_in_specific_populations"))

        medicine_name = first_value(result.get("openfda", {}).get("brand_name"))

        return {
            "found": True,
            "source": "openFDA",
            "medicine_name": medicine_name or query,
            "composition": composition or "Not available",
            "strength": "Not available",
            "dosage_form": "Not available",
            "description": description or "Not available",
            "common_uses": "Not available",
            "age_information": age_information or "Not available",
            "warnings": "Not available",
            "sources": [{
                "title": "openFDA drug label",
                "url": OPENFDA_URL,
            }],
        }
    except requests.RequestException:
        return {"found": False, "sources": []}


def first_value(value):
    """
    Return first non-empty string from an API field.
    """
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                item = item.strip()
                if item:
                    return item
    elif isinstance(value, str):
        value = value.strip()
        if value:
            return value
    return ""