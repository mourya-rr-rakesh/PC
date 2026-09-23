"""
medicines/services/ingredient_matcher.py

Computes composition-based match percentages between an AI-extracted
medicine (name + list of {ingredient, strength}) and candidate
medicines from the existing database.

Design goals:
  - The AI never decides which medicine is a "substitute" — it only
    identifies composition. All matching/ranking happens here, in
    plain, auditable Python.
  - Weights/thresholds live in one place (MatchConfig) so the
    algorithm is easy to tune without touching the scoring logic.
  - Works against a generic "candidate composition" shape, so it can
    be reused whether your DB stores composition as structured rows
    or as a free-text field (parse free text with
    normalizer.parse_composition_string first).
"""

from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Sequence

from .normalizer import (
    ParsedComponent,
    NormalizedStrength,
    normalize_ingredient_name,
    normalize_strength,
)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class MatchConfig:
    """
    All tunable knobs for the matcher in one place.

    ingredient_weight + composition_weight should sum to 1.0; they
    control how much "do the same ingredients appear at all" (ingredient
    match) counts versus "do the strengths line up too" (composition match)
    in the overall score.
    """
    ingredient_weight: float = 0.5
    composition_weight: float = 0.5

    # Strength difference tolerance, as a fraction of the AI-detected
    # strength, within which we still count it as a "full" strength match.
    # e.g. 0.05 = within 5% is treated as exact.
    strength_exact_tolerance: float = 0.05

    # Strength difference beyond which the pair scores 0 for that
    # ingredient's strength match (still counts for ingredient match).
    strength_max_diff_fraction: float = 1.0  # 100% off => 0 strength credit

    # Minimum overall_match (0-100) required for a candidate to be
    # returned at all. Keeps "basically unrelated" medicines out of
    # results even if they share one minor ingredient.
    minimum_overall_match: float = 30.0

    # Minimum ingredient overlap (0-100) required for a candidate to be
    # considered at all, independent of strength.
    minimum_ingredient_match: float = 1.0

    # How many results to return, sorted best-first.
    top_n: int = 10


# ---------------------------------------------------------------------------
# Input/output shapes
# ---------------------------------------------------------------------------

@dataclass
class CandidateComposition:
    """
    A candidate medicine from the database, reduced to just what the
    matcher needs. Build this from your real Medicine model in views.py
    (or wherever you query) — the matcher doesn't touch the ORM itself,
    so it stays easy to test and reuse.
    """
    id: int
    name: str
    components: List[ParsedComponent]
    # Free-text composition string, only used for display in results.
    composition_display: str = ""


@dataclass
class MatchResult:
    id: int
    name: str
    composition_display: str
    ingredient_match: float   # 0-100
    composition_match: float  # 0-100
    overall_match: float      # 0-100


def _components_from_ai(ai_composition: Sequence[dict]) -> List[ParsedComponent]:
    """
    Convert the AI service's composition list (list of
    {"ingredient": ..., "strength": ...} dicts) into ParsedComponent
    objects so it can go through the same scoring path as DB data.
    """
    result = []
    for item in ai_composition or []:
        ingredient = (item.get("ingredient") or "").strip()
        strength_raw = (item.get("strength") or "").strip() or None
        if not ingredient:
            continue
        result.append(
            ParsedComponent(
                ingredient=ingredient,
                ingredient_normalized=normalize_ingredient_name(ingredient),
                strength_raw=strength_raw,
                strength=normalize_strength(strength_raw) if strength_raw
                else NormalizedStrength(value=None, unit=None, raw=""),
            )
        )
    return result


def _strength_similarity(a: NormalizedStrength, b: NormalizedStrength, config: MatchConfig) -> Optional[float]:
    """
    Returns a 0.0-1.0 similarity for two normalized strengths of a single
    matched ingredient, or None if either side's strength is unknown/
    unparseable (caller decides how to treat "unknown").
    """
    if not a.is_parsed or not b.is_parsed:
        return None
    if a.unit != b.unit:
        # Different unit families (e.g. mg vs ml) — can't meaningfully compare.
        return None
    if a.value == 0 and b.value == 0:
        return 1.0
    if a.value == 0 or b.value == 0:
        return 0.0

    diff_fraction = abs(a.value - b.value) / max(a.value, b.value)

    if diff_fraction <= config.strength_exact_tolerance:
        return 1.0
    if diff_fraction >= config.strength_max_diff_fraction:
        return 0.0

    # Linear falloff between "exact" and "max diff" thresholds.
    span = config.strength_max_diff_fraction - config.strength_exact_tolerance
    return max(0.0, 1.0 - (diff_fraction - config.strength_exact_tolerance) / span)


def _score_pair(
    ai_components: List[ParsedComponent],
    candidate_components: List[ParsedComponent],
    config: MatchConfig,
) -> MatchResult:
    ai_by_norm = {c.ingredient_normalized: c for c in ai_components if c.ingredient_normalized}
    cand_by_norm = {c.ingredient_normalized: c for c in candidate_components if c.ingredient_normalized}

    if not ai_by_norm or not cand_by_norm:
        return None  # caller filters Nones

    shared = set(ai_by_norm) & set(cand_by_norm)
    union = set(ai_by_norm) | set(cand_by_norm)

    # Ingredient match: how much of the ingredient set overlaps (Jaccard-style).
    ingredient_match = (len(shared) / len(union)) * 100 if union else 0.0

    # Composition match: for each shared ingredient, how close are the strengths.
    # Ingredients present only on one side count as a 0 for this shared-strength
    # score, so a partial ingredient overlap can't fake a high composition score.
    strength_scores = []
    for norm_name in union:
        if norm_name in shared:
            sim = _strength_similarity(
                ai_by_norm[norm_name].strength,
                cand_by_norm[norm_name].strength,
                config,
            )
            if sim is None:
                # Unknown strength on one/both sides: give partial (neutral)
                # credit rather than punishing or rewarding fully.
                strength_scores.append(0.5)
            else:
                strength_scores.append(sim)
        else:
            strength_scores.append(0.0)

    composition_match = (sum(strength_scores) / len(strength_scores)) * 100 if strength_scores else 0.0

    overall_match = (
        ingredient_match * config.ingredient_weight
        + composition_match * config.composition_weight
    )

    return MatchResult(
        id=None,  # filled in by caller
        name=None,
        composition_display=None,
        ingredient_match=round(ingredient_match, 1),
        composition_match=round(composition_match, 1),
        overall_match=round(overall_match, 1),
    )


def find_matches(
    ai_composition: Sequence[dict],
    candidates: Iterable[CandidateComposition],
    config: Optional[MatchConfig] = None,
) -> List[MatchResult]:
    """
    Score every candidate against the AI-extracted composition and
    return the top matches, sorted best-first.

    ai_composition: list of {"ingredient": str, "strength": str} as
        produced by the AI service (see ai_service.py).
    candidates: iterable of CandidateComposition built from your
        existing Medicine records.
    """
    config = config or MatchConfig()
    ai_components = _components_from_ai(ai_composition)

    if not ai_components:
        return []

    scored: List[MatchResult] = []
    for candidate in candidates:
        result = _score_pair(ai_components, candidate.components, config)
        if result is None:
            continue
        if result.ingredient_match < config.minimum_ingredient_match:
            continue
        if result.overall_match < config.minimum_overall_match:
            continue

        result.id = candidate.id
        result.name = candidate.name
        result.composition_display = candidate.composition_display
        scored.append(result)

    scored.sort(key=lambda r: r.overall_match, reverse=True)
    return scored[: config.top_n]
