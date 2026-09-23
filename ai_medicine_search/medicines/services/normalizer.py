"""
medicines/services/normalizer.py

Pure, dependency-free helpers for normalizing ingredient names and
strength/dosage strings so that AI-extracted data and database records
can be compared on equal footing.

Nothing here talks to the network, the database, or the AI model —
it's just string/number normalization, so it's easy to unit test and
easy to extend as you discover new synonyms or formats in your data.
"""

import re
from dataclasses import dataclass
from typing import List, Optional


# ---------------------------------------------------------------------------
# Ingredient name normalization
# ---------------------------------------------------------------------------

# Pharmacopoeia / grade suffixes that don't change the active ingredient.
_GRADE_SUFFIXES = [
    "ip", "bp", "usp", "ph eur", "eur", "jp",
]

# Known synonym groups. Extend this as you find more in your own data.
# Each group maps a set of alternate spellings to one canonical name.
# Keep this list business/medically reviewed — it directly affects
# what gets treated as "the same ingredient".
_SYNONYM_GROUPS = [
    {"paracetamol", "acetaminophen"},
    {"salbutamol", "albuterol"},
    {"adrenaline", "epinephrine"},
    {"frusemide", "furosemide"},
    {"diclofenac sodium", "diclofenac potassium", "diclofenac"},
    {"cetirizine hydrochloride", "cetirizine hcl", "cetirizine"},
    {"metformin hydrochloride", "metformin hcl", "metformin"},
]

# Build a fast lookup: any known alias -> canonical name (first item of set)
_ALIAS_TO_CANONICAL = {}
for _group in _SYNONYM_GROUPS:
    canonical = sorted(_group)[0]
    for alias in _group:
        _ALIAS_TO_CANONICAL[alias] = canonical


def normalize_ingredient_name(raw_name: str) -> str:
    """
    Normalize an ingredient name for comparison purposes.

    Steps:
      1. Lowercase + strip whitespace.
      2. Remove pharmacopoeia grade suffixes (IP, BP, USP, ...).
      3. Collapse internal whitespace.
      4. Map known synonyms to a canonical name (e.g. acetaminophen -> paracetamol).

    This is NOT meant to change the display name shown to users —
    only used internally for matching. Always keep the original
    string for display.
    """
    if not raw_name:
        return ""

    name = raw_name.strip().lower()
    name = re.sub(r"[^\w\s+.-]", " ", name)  # strip stray punctuation
    name = re.sub(r"\s+", " ", name).strip()

    # Remove grade suffixes as whole trailing/standalone words
    tokens = name.split(" ")
    tokens = [t for t in tokens if t not in _GRADE_SUFFIXES]
    name = " ".join(tokens).strip()

    return _ALIAS_TO_CANONICAL.get(name, name)


# ---------------------------------------------------------------------------
# Strength / dosage normalization
# ---------------------------------------------------------------------------

# Canonical unit -> multiplier to convert into milligrams (mg) for mass units,
# or milliliters (ml) for volume units. Units of different kinds are never
# compared against each other.
_MASS_UNITS_TO_MG = {
    "mg": 1.0,
    "milligram": 1.0,
    "milligrams": 1.0,
    "g": 1000.0,
    "gram": 1000.0,
    "grams": 1000.0,
    "mcg": 0.001,
    "microgram": 0.001,
    "micrograms": 0.001,
    "ug": 0.001,
    "kg": 1_000_000.0,
}

_VOLUME_UNITS_TO_ML = {
    "ml": 1.0,
    "millilitre": 1.0,
    "milliliter": 1.0,
    "l": 1000.0,
    "litre": 1000.0,
    "liter": 1000.0,
}

_UNIT_PATTERN = re.compile(
    r"^\s*([\d.]+)\s*([a-zA-Z%]+)?\s*(?:/\s*([\d.]+)\s*([a-zA-Z%]+))?\s*$"
)


@dataclass
class NormalizedStrength:
    value: Optional[float]          # normalized numeric value, or None if unparseable
    unit: Optional[str]             # "mg" or "ml" (the canonical unit family), or None
    per_value: Optional[float] = None   # for "X/Yml" style (e.g. syrups), the denominator
    per_unit: Optional[str] = None
    raw: str = ""

    @property
    def is_parsed(self) -> bool:
        return self.value is not None and self.unit is not None


def normalize_strength(raw_strength: str) -> NormalizedStrength:
    """
    Parse a strength string like "500mg", "500 mg", "0.5 g", "125mg/5ml"
    into a NormalizedStrength with a canonical unit (mg or ml).

    Unparseable input returns a NormalizedStrength with value=None,
    which the matcher treats as "unknown strength" (partial credit only).
    """
    if not raw_strength:
        return NormalizedStrength(value=None, unit=None, raw=raw_strength or "")

    text = raw_strength.strip().lower().replace(" ", "")
    match = _UNIT_PATTERN.match(text)
    if not match:
        return NormalizedStrength(value=None, unit=None, raw=raw_strength)

    num_str, unit_str, per_num_str, per_unit_str = match.groups()

    try:
        num = float(num_str)
    except (TypeError, ValueError):
        return NormalizedStrength(value=None, unit=None, raw=raw_strength)

    unit_str = (unit_str or "").strip()

    if unit_str in _MASS_UNITS_TO_MG:
        value_mg = num * _MASS_UNITS_TO_MG[unit_str]
        result = NormalizedStrength(value=value_mg, unit="mg", raw=raw_strength)
    elif unit_str in _VOLUME_UNITS_TO_ML:
        value_ml = num * _VOLUME_UNITS_TO_ML[unit_str]
        result = NormalizedStrength(value=value_ml, unit="ml", raw=raw_strength)
    else:
        # Unknown unit (e.g. "%", "iu") — keep the raw number but mark unit
        # as-is; the matcher will only compare like-for-like units.
        result = NormalizedStrength(value=num, unit=unit_str or None, raw=raw_strength)

    # Optional "/5ml" style denominator (common for syrups)
    if per_num_str and per_unit_str:
        try:
            result.per_value = float(per_num_str)
            result.per_unit = per_unit_str.strip()
        except ValueError:
            pass

    return result


# ---------------------------------------------------------------------------
# Composition string parsing (for DB medicines stored as free text, e.g.
# "Paracetamol 500mg + Caffeine 30mg")
# ---------------------------------------------------------------------------

_COMPONENT_SPLIT_RE = re.compile(r"\s*\+\s*|\s*,\s*")
_NAME_STRENGTH_RE = re.compile(
    r"^(?P<name>[A-Za-z][A-Za-z0-9\-\s]*?)\s+(?P<strength>[\d.]+\s*[a-zA-Z%]+(?:/\s*[\d.]+\s*[a-zA-Z]+)?)\s*$"
)


@dataclass
class ParsedComponent:
    ingredient: str            # original, display-ready
    ingredient_normalized: str
    strength_raw: Optional[str]
    strength: NormalizedStrength


def parse_composition_string(composition_text: str) -> List[ParsedComponent]:
    """
    Parse a free-text composition string such as:
        "Paracetamol 500mg + Caffeine 30mg"
    into a list of ParsedComponent.

    Use this to turn an existing Medicine model's text composition field
    into the same shape the AI service returns, so both sides can go
    through the same matcher.
    """
    if not composition_text:
        return []

    parts = _COMPONENT_SPLIT_RE.split(composition_text.strip())
    components: List[ParsedComponent] = []

    for part in parts:
        part = part.strip()
        if not part:
            continue

        m = _NAME_STRENGTH_RE.match(part)
        if m:
            name = m.group("name").strip()
            strength_raw = m.group("strength").strip()
        else:
            # No strength found in this chunk — whole thing is the name.
            name = part
            strength_raw = None

        components.append(
            ParsedComponent(
                ingredient=name,
                ingredient_normalized=normalize_ingredient_name(name),
                strength_raw=strength_raw,
                strength=normalize_strength(strength_raw) if strength_raw else
                NormalizedStrength(value=None, unit=None, raw=""),
            )
        )

    return components
