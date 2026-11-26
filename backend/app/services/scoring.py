from __future__ import annotations

from dataclasses import dataclass, field

from ..domain import CULTURE_ADJ, INTEREST_PHRASE, REGION_BY_ID
from ..models import Experience

CULTURE_WEIGHT = 40.0
PRIMARY_CULTURE_BONUS = 5.0
INTEREST_WEIGHT = 15.0
REGION_WEIGHT = 25.0
ECONOMY_PRICE_THRESHOLD = 40.0
BUDGET_ADJUSTMENT = 5.0
SUITABILITY_THRESHOLD = INTEREST_WEIGHT


@dataclass(frozen=True)
class MemberProfile:
    id: int
    index: int
    name: str
    interests: tuple[str, ...]
    cultures: tuple[str, ...]
    preferred_region: str | None


@dataclass
class MatchScore:
    score: float
    matched_interests: list[str] = field(default_factory=list)
    matched_cultures: list[str] = field(default_factory=list)
    region_match: bool = False

    @property
    def suitable(self) -> bool:
        return self.score >= SUITABILITY_THRESHOLD and (
            bool(self.matched_interests) or bool(self.matched_cultures)
        )


def is_in_season(exp: Experience, month: int) -> bool:
    return month in (exp.available_months or [])


def score_member(
    member: MemberProfile, exp: Experience, budget_preference: str | None = None
) -> MatchScore:
    exp_tags = set(exp.tag_ids)
    exp_cultures = set(exp.culture_ids)
    matched_interests = [t for t in member.interests if t in exp_tags]
    matched_cultures = [c for c in member.cultures if c in exp_cultures]

    score = INTEREST_WEIGHT * len(matched_interests)
    if matched_cultures:
        score += CULTURE_WEIGHT
        if exp.primary_culture in matched_cultures:
            score += PRIMARY_CULTURE_BONUS
    region_match = member.preferred_region is not None and member.preferred_region == exp.region
    if region_match:
        score += REGION_WEIGHT

    if budget_preference == "economy" and (matched_interests or matched_cultures):
        price = exp.adult_price_cad or 0.0
        if exp.pricing_status == "free" or price <= 15:
            score += BUDGET_ADJUSTMENT
        elif price > ECONOMY_PRICE_THRESHOLD:
            score -= BUDGET_ADJUSTMENT

    return MatchScore(score, matched_interests, matched_cultures, region_match)


def _join(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + f" and {items[-1]}"


_CULTURE_KEYWORDS = {
    "indigenous": ("indigenous", "first nation", "métis", "metis", "inuit", "inuvialuit", "gwich", "wendat",
                   "cree", "syilx", "osoyoos", "haudenosaunee", "anishinaabe", "algonquin", "tr'ondëk",
                   "hän", "nation"),
    "british": ("british", "loyalist", "english", "scottish", "scots", "irish", "britain"),
    "french": ("french", "acadian", "québec", "quebec", "jesuit", "benedictine", "oblate", "francophone"),
    "immigrant": ("immigra", "ukrainian", "mennonite", "german", "japanese", "chinese", "newcomer", "settler"),
}


def _sentences(text: str) -> list[str]:
    import re

    return [s.strip() for s in re.split(r"(?<=[.!?])(?<!\bSt\.)(?<!\b[A-Z]\.)\s+", (text or "").strip()) if s.strip()]


def cultural_sentence(exp: Experience, cultures: list[str]) -> str:
    pool = _sentences(exp.cultural_context) + _sentences(exp.agricultural_significance)
    keys = [k for c in cultures for k in _CULTURE_KEYWORDS.get(c, ())]
    for s in pool:
        low = s.lower()
        if any(k in low for k in keys):
            return s
    return pool[0] if pool else ""


_OPENERS = [
    "{exp} matches {name}'s interest in {interests}.",
    "We picked {exp} for {name} based on their interest in {interests}.",
    "{name} can explore {interests} at {exp}.",
    "For {name}'s interest in {interests}, try {exp}.",
]
_CULTURE_ONLY_OPENERS = [
    "{exp} matches {name}'s interest in {cultures} culture.",
    "{name} can explore {cultures} heritage at {exp}.",
]


def explain(member: MemberProfile, exp: Experience, match: MatchScore, shared_with: list[str]) -> str:
    variant = member.index
    interests = [INTEREST_PHRASE[t] for t in match.matched_interests[:3]]
    cultures = [CULTURE_ADJ[c] for c in match.matched_cultures]
    parts: list[str] = []

    if interests:
        parts.append(
            _OPENERS[variant % len(_OPENERS)].format(
                name=member.name, interests=_join(interests), exp=exp.name
            )
        )
        if cultures:
            parts.append(f"It also matches their interest in {_join(cultures)} culture.")
            parts.append(cultural_sentence(exp, match.matched_cultures))
    else:
        parts.append(
            _CULTURE_ONLY_OPENERS[variant % len(_CULTURE_ONLY_OPENERS)].format(
                name=member.name, cultures=_join(cultures), exp=exp.name
            )
        )
        parts.append(cultural_sentence(exp, match.matched_cultures))

    activities = [a.rstrip(". ") for a in (exp.activities or [])[:2]]
    if activities and not cultures:
        parts.append(f"Activities: {_join(activities)}.")
    if match.region_match:
        parts.append(
            f"It’s in their preferred region, {REGION_BY_ID[exp.region].name}."
        )
    if shared_with:
        parts.append(f"Also recommended for {_join(shared_with)}.")
    return " ".join(parts)
