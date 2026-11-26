from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .domain import CITY_BY_ID, CULTURE_IDS, INTEREST_IDS, REGION_IDS

MAX_PARTY_SIZE = 100


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    return [v for v in values if not (v in seen or seen.add(v))]


class MemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    interests: list[str] = Field(default_factory=list)
    cultures: list[str] = Field(min_length=1)
    preferred_region: str | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("interests")
    @classmethod
    def _valid_interests(cls, v: list[str]) -> list[str]:
        bad = [i for i in v if i not in INTEREST_IDS]
        if bad:
            raise ValueError(f"Unknown interest tag(s): {', '.join(bad)}")
        return _dedupe(v)

    @field_validator("cultures")
    @classmethod
    def _valid_cultures(cls, v: list[str]) -> list[str]:
        bad = [c for c in v if c not in CULTURE_IDS]
        if bad:
            raise ValueError(f"Unknown cultural preference(s): {', '.join(bad)}")
        if not v:
            raise ValueError("Choose at least one cultural preference.")
        return _dedupe(v)

    @field_validator("preferred_region")
    @classmethod
    def _valid_region(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if v not in REGION_IDS:
            raise ValueError(f"Unknown region '{v}'.")
        return v


class PartyIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    starting_city_id: str
    transportation_method: Literal["car", "plane"]
    departure_month: int | None = Field(default=None, ge=1, le=12)
    departure_date: date | None = None
    budget_preference: Literal["economy", "moderate", "premium"] | None = None
    members: list[MemberIn] = Field(min_length=1, max_length=MAX_PARTY_SIZE)

    @field_validator("name")
    @classmethod
    def _blank_name(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @field_validator("starting_city_id")
    @classmethod
    def _known_city(cls, v: str) -> str:
        if v not in CITY_BY_ID:
            raise ValueError("Unsupported starting city. Choose one of the listed Canadian cities.")
        return v

    @model_validator(mode="after")
    def _month_or_date(self) -> PartyIn:
        if self.departure_date is not None:
            if self.departure_date < date.today():
                raise ValueError("Departure date can't be in the past.")
            if self.departure_month is not None and self.departure_month != self.departure_date.month:
                raise ValueError("Departure month doesn't match the departure date.")
            self.departure_month = self.departure_date.month
        if self.departure_month is None:
            raise ValueError("Choose a travel month or departure date.")
        return self


class MemberOut(BaseModel):
    id: int
    name: str
    interests: list[str]
    cultures: list[str]
    preferred_region: str | None


class PartyOut(BaseModel):
    id: int
    name: str | None
    starting_city_id: str
    starting_city: str
    starting_province: str
    origin_latitude: float
    origin_longitude: float
    transportation_method: str
    departure_month: int
    departure_date: date | None
    budget_preference: str | None
    created_at: datetime
    members: list[MemberOut]


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    url: str
    title: str | None
    publisher: str | None
    accessed: str | None


class ExperienceOut(BaseModel):
    id: int
    slug: str
    name: str
    address: str | None
    city: str
    province: str
    region: str
    latitude: float
    longitude: float
    primary_culture: str
    cultures: list[str]
    community: str | None
    tags: list[str]
    short_description: str
    description: str
    agricultural_significance: str
    cultural_context: str
    food_spotlight_name: str | None
    food_spotlight_description: str | None
    food_included_in_admission: bool
    activities: list[str]
    visit_duration_hours: float
    available_months: list[int]
    season_notes: str | None
    pricing_status: str
    adult_price_cad: float | None
    child_price_cad: float | None
    price_basis: str
    pricing_notes: str | None
    pricing_source_url: str | None
    website: str | None
    image_url: str | None
    image_page_url: str | None
    image_author: str | None
    image_license: str | None
    image_caption: str | None
    verified_at: str | None
    sources: list[SourceOut]


class TripGenerateIn(BaseModel):
    party_id: int


class AssumptionsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fuel_price_per_litre: float | None = None
    fuel_consumption_l_per_100km: float | None = None
    parking_misc_per_vehicle_per_day: float | None = None
    airfare_per_person: float | None = None
    airport_transfer_per_person: float | None = None
    rental_car_per_day: float | None = None
    nightly_room_rate: float | None = None
    room_occupancy: int | None = None
    accommodation_tax_rate: float | None = None
    daily_food_per_person: float | None = None
    contingency_rate: float | None = None


class TripStopOut(BaseModel):
    id: int
    day_number: int
    visit_order: int
    party_activity_cost: float
    travel_km_from_previous: float
    travel_hours_from_previous: float
    previous_label: str | None
    experience: ExperienceOut


class RecommendationOut(BaseModel):
    member_id: int
    member_name: str
    experience_slug: str | None
    score: float
    explanation: str
    matched_interests: list[str]
    matched_cultures: list[str]
    region_match: bool
    unmet: list[str]


class TripOut(BaseModel):
    id: int
    generated_at: datetime
    primary_region: str | None
    regions: list[str]
    duration_days: int
    currency: str
    estimated_total: float
    party: PartyOut
    stops: list[TripStopOut]
    recommendations: list[RecommendationOut]
    travel: dict[str, Any]
    assumptions: dict[str, float]
    budget: dict[str, Any]
    notes: list[str]


class TripSummaryOut(BaseModel):
    id: int
    generated_at: datetime
    party_id: int
    party_name: str | None
    starting_city: str
    primary_region: str | None
    regions: list[str]
    duration_days: int
    transportation_method: str
    party_size: int
    estimated_total: float
    stop_count: int
    cover_image_url: str | None
    stop_names: list[str]
