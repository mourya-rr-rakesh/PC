"""
medicines/services/ai_service.py

Isolation layer between Django views and whatever is actually
identifying medicines (today: your local/offline model; later:
a hosted production AI API).

Views should only ever call `get_medicine_from_local_ai(name)`.
Everything about *how* that answer is produced — local model today,
hosted API tomorrow — lives behind the AIProvider interface below,
so swapping providers is a one-line settings change, not a rewrite.

>>> THE ONE PLACE YOU NEED TO EDIT <<<
See `LocalModelAIProvider._call_local_model()` below. That's the only
method that needs to know how your local model is actually invoked
(HTTP call, subprocess, Python import, etc).
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class AIServiceError(Exception):
    """Base class for all AI-service failures the view layer should handle."""


class AIUnavailableError(AIServiceError):
    """The local/production AI model could not be reached at all."""


class AITimeoutError(AIServiceError):
    """The AI model took too long to respond."""


class AIResponseInvalidError(AIServiceError):
    """The AI responded, but the payload didn't pass validation."""


# ---------------------------------------------------------------------------
# Validated result shape
# ---------------------------------------------------------------------------

@dataclass
class AIComponent:
    ingredient: str
    strength: Optional[str] = None


@dataclass
class AIMedicineResult:
    medicine_name: str
    composition: List[AIComponent] = field(default_factory=list)
    description: Optional[str] = None
    age: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.medicine_name,
            "composition": [
                {"ingredient": c.ingredient, "strength": c.strength}
                for c in self.composition
            ],
            "description": self.description,
            "age": self.age,
        }


# ---------------------------------------------------------------------------
# Provider interface (the swappable part)
# ---------------------------------------------------------------------------

class AIProvider(ABC):
    """
    Common interface every AI backend must implement. Both the local
    adapter and a future production adapter implement this, so
    `ai_service.get_medicine_from_local_ai()` (and everything calling
    it) never needs to know which one is active.
    """

    @abstractmethod
    def identify_medicine(self, medicine_name: str) -> dict:
        """
        Return a raw dict matching the AI_RESPONSE_SCHEMA shape (see
        `_validate_and_parse_response` below). Implementations should
        raise AIUnavailableError / AITimeoutError on transport failures
        and let malformed-but-received payloads pass through to be
        validated centrally.
        """
        raise NotImplementedError


class LocalModelAIProvider(AIProvider):
    """
    Adapter for your existing offline/local AI model.

    Configure connection details in settings.py under AI_SEARCH_SETTINGS
    (see bottom of this file / README for the expected keys), then fill
    in `_call_local_model()` below to match how your model is actually
    exposed (HTTP server, local Python function, subprocess, etc).
    """

    def __init__(self):
        conf = getattr(settings, "AI_SEARCH_SETTINGS", {})
        self.endpoint = conf.get("LOCAL_AI_ENDPOINT", "http://127.0.0.1:8001/identify")
        self.timeout_seconds = conf.get("LOCAL_AI_TIMEOUT_SECONDS", 15)

    def identify_medicine(self, medicine_name: str) -> dict:
        return self._call_local_model(medicine_name)

    # =====================================================================
    # >>> CONFIGURE THIS METHOD to match your actual local AI model. <<<
    #
    # Below is a ready-to-use example assuming your local model is served
    # over HTTP (e.g. a small Flask/FastAPI wrapper, Ollama, LM Studio,
    # a llama.cpp server, etc). Replace the body with whatever fits your
    # setup. Whatever you do here, the return value must be a dict/JSON
    # roughly shaped like:
    #
    #   {
    #     "medicine_name": "...",
    #     "composition": [{"ingredient": "...", "strength": "..."}, ...],
    #     "description": "...",   # optional
    #     "age": "..."            # optional
    #   }
    #
    # It's fine if the raw model output is messier than this — do any
    # prompt-specific cleanup here, then let `_validate_and_parse_response`
    # do the strict/safe validation.
    # =====================================================================
    def _call_local_model(self, medicine_name: str) -> dict:
        import requests  # local import so this dependency is optional
        # until this method is actually wired up.

        prompt = self._build_prompt(medicine_name)

        try:
            response = requests.post(
                self.endpoint,
                json={"prompt": prompt, "medicine_name": medicine_name},
                timeout=self.timeout_seconds,
            )
        except requests.exceptions.Timeout as exc:
            raise AITimeoutError(f"Local AI model timed out: {exc}") from exc
        except requests.exceptions.RequestException as exc:
            raise AIUnavailableError(f"Local AI model unreachable: {exc}") from exc

        if response.status_code != 200:
            raise AIUnavailableError(
                f"Local AI model returned HTTP {response.status_code}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise AIResponseInvalidError("Local AI model did not return valid JSON") from exc

        return payload

    @staticmethod
    def _build_prompt(medicine_name: str) -> str:
        """
        Instructs the local model to answer with ONLY the structured
        JSON shape we expect. Tune wording to match your model's
        instruction-following style.
        """
        return (
            "You are a medicine identification assistant. Given a medicine "
            "name, respond with ONLY a JSON object (no extra text) in this "
            "exact shape:\n"
            '{\n'
            '  "medicine_name": "<name>",\n'
            '  "composition": [{"ingredient": "<name>", "strength": "<e.g. 500 mg>"}],\n'
            '  "description": "<short description or null>",\n'
            '  "age": "<e.g. Adults, Children, or null>"\n'
            '}\n'
            "Do not recommend other brands or substitutes. Only identify "
            f"this medicine's own composition.\n\nMedicine name: {medicine_name}"
        )


class ProductionAIProvider(AIProvider):
    """
    Placeholder for a future hosted/production AI API.

    Once you have a production endpoint, implement `identify_medicine`
    here the same way LocalModelAIProvider does (call the API, return
    the raw dict), then flip AI_SEARCH_SETTINGS["PROVIDER"] to
    "production" in settings.py. No other code — views, matcher,
    frontend — needs to change.
    """

    def identify_medicine(self, medicine_name: str) -> dict:
        raise NotImplementedError(
            "ProductionAIProvider is not configured yet. Implement "
            "identify_medicine() when your production AI API is ready."
        )


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------

def _get_provider() -> AIProvider:
    conf = getattr(settings, "AI_SEARCH_SETTINGS", {})
    provider_name = conf.get("PROVIDER", "local")

    if provider_name == "local":
        return LocalModelAIProvider()
    if provider_name == "production":
        return ProductionAIProvider()

    raise ImproperlyConfiguredAIProvider(provider_name)


class ImproperlyConfiguredAIProvider(AIServiceError):
    def __init__(self, provider_name):
        super().__init__(
            f"Unknown AI_SEARCH_SETTINGS['PROVIDER'] = {provider_name!r}. "
            "Expected 'local' or 'production'."
        )


# ---------------------------------------------------------------------------
# Response validation
# ---------------------------------------------------------------------------

def _validate_and_parse_response(raw: dict, fallback_name: str) -> AIMedicineResult:
    """
    Never trust the AI's output blindly. Validate shape and types,
    coerce what's reasonably coercible, and drop anything malformed
    rather than raising, EXCEPT when the response is unusable enough
    that there's nothing safe to return.
    """
    if not isinstance(raw, dict):
        raise AIResponseInvalidError("AI response was not a JSON object")

    medicine_name = raw.get("medicine_name") or fallback_name
    if not isinstance(medicine_name, str) or not medicine_name.strip():
        medicine_name = fallback_name

    raw_composition = raw.get("composition")
    components: List[AIComponent] = []

    if isinstance(raw_composition, list):
        for item in raw_composition:
            if not isinstance(item, dict):
                continue
            ingredient = item.get("ingredient")
            strength = item.get("strength")
            if not isinstance(ingredient, str) or not ingredient.strip():
                continue
            if strength is not None and not isinstance(strength, str):
                strength = str(strength)
            components.append(AIComponent(ingredient=ingredient.strip(), strength=strength))

    description = raw.get("description")
    if description is not None and not isinstance(description, str):
        description = None

    age = raw.get("age")
    if age is not None and not isinstance(age, str):
        age = None

    if not components:
        # Not fatal — the view can still show "no composition detected"
        # and skip the database matching step. Don't invent ingredients.
        logger.info("AI response for %r had no usable composition entries", fallback_name)

    return AIMedicineResult(
        medicine_name=medicine_name.strip(),
        composition=components,
        description=description.strip() if description else None,
        age=age.strip() if age else None,
    )


# ---------------------------------------------------------------------------
# Public entry point used by views.py
# ---------------------------------------------------------------------------

def get_medicine_from_local_ai(medicine_name: str) -> AIMedicineResult:
    """
    The one function views.py should call. Returns a validated
    AIMedicineResult, or raises an AIServiceError subclass on failure —
    callers should catch AIServiceError and turn it into a friendly
    JSON error response.
    """
    if not medicine_name or not medicine_name.strip():
        raise AIResponseInvalidError("Empty medicine name")

    provider = _get_provider()

    try:
        raw = provider.identify_medicine(medicine_name.strip())
    except AIServiceError:
        raise
    except Exception as exc:  # noqa: BLE001 - convert unexpected errors safely
        logger.exception("Unexpected error calling AI provider")
        raise AIUnavailableError(str(exc)) from exc

    return _validate_and_parse_response(raw, fallback_name=medicine_name.strip())
