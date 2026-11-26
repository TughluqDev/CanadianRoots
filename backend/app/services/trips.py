from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..domain import CITY_BY_ID
from ..models import Experience, Party, Trip, TripRecommendation, TripStop
from ..schemas import (
    ExperienceOut, RecommendationOut, SourceOut, TripOut, TripStopOut, TripSummaryOut,
)
from . import costs
from .parties import party_out
from .planner import PartySettings, PlanningError, plan_trip
from .scoring import MemberProfile


def load_experiences(session: Session) -> list[Experience]:
    stmt = select(Experience).options(
        selectinload(Experience.tags), selectinload(Experience.cultures), selectinload(Experience.sources)
    ).order_by(Experience.slug)
    return list(session.scalars(stmt))


def member_profiles(party: Party) -> list[MemberProfile]:
    return [
        MemberProfile(
            id=m.id, index=i, name=m.name, interests=tuple(m.values("interest")),
            cultures=tuple(m.values("culture")), preferred_region=m.preferred_region,
        )
        for i, m in enumerate(party.members)
    ]


def _stop_inputs(trip: Trip) -> list[costs.StopCostInput]:
    return [
        costs.StopCostInput(s.experience.slug, s.experience.name, s.experience.pricing_status,
                            s.experience.adult_price_cad, s.experience.price_basis)
        for s in trip.stops
    ]


def _recompute(trip: Trip) -> None:
    party = trip.party
    budget = costs.compute_budget(
        travellers=len(party.members), duration_days=trip.duration_days,
        stops=_stop_inputs(trip), travel=trip.travel, assumptions=trip.assumptions,
    )
    by_slug = {i["slug"]: i["subtotal"] for i in budget["activities"]["items"]}
    for s in trip.stops:
        s.party_activity_cost = by_slug[s.experience.slug]
    trip.budget = budget
    trip.estimated_total = budget["total"]


def generate_trip(session: Session, party: Party) -> Trip:
    city = CITY_BY_ID.get(party.starting_city_id)
    if city is None:
        raise PlanningError("This party's starting city is no longer supported.")
    settings = PartySettings(city, party.transportation_method, party.departure_month,
                             party.budget_preference)
    plan = plan_trip(settings, member_profiles(party), load_experiences(session))

    trip = Trip(party=party, primary_region=plan.primary_region, duration_days=plan.duration_days,
                travel=plan.travel,
                notes=plan.notes, currency="CAD", budget={}, estimated_total=0.0)
    trip.assumptions = costs.default_assumptions(plan.primary_region, party.budget_preference, plan.travel)
    trip.stops = [
        TripStop(experience=p.experience, day_number=p.day, visit_order=p.order, party_activity_cost=0.0,
                 travel_km_from_previous=p.km_from_previous, travel_hours_from_previous=p.hours_from_previous,
                 previous_label=p.previous_label)
        for p in plan.stops
    ]
    members_by_id = {m.id: m for m in party.members}
    trip.recommendations = [
        TripRecommendation(
            member=members_by_id[r.member.id], experience=r.experience, score=r.match.score,
            explanation=r.explanation, matched_interests=r.match.matched_interests,
            matched_cultures=r.match.matched_cultures, region_match=r.match.region_match, unmet=r.unmet,
        )
        for r in plan.recommendations
    ]
    _recompute(trip)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


def update_assumptions(session: Session, trip: Trip, updates: dict[str, float]) -> Trip:
    costs.validate_assumptions(updates)
    trip.assumptions = {**trip.assumptions, **updates}
    _recompute(trip)
    session.commit()
    session.refresh(trip)
    return trip


def get_trip(session: Session, trip_id: int) -> Trip | None:
    return session.get(Trip, trip_id)


def experience_out(e: Experience) -> ExperienceOut:
    return ExperienceOut(
        id=e.id, slug=e.slug, name=e.name, address=e.address, city=e.city, province=e.province,
        region=e.region, latitude=e.latitude, longitude=e.longitude, primary_culture=e.primary_culture,
        cultures=e.culture_ids, community=e.community, tags=e.tag_ids,
        short_description=e.short_description, description=e.description,
        agricultural_significance=e.agricultural_significance, cultural_context=e.cultural_context,
        food_spotlight_name=e.food_spotlight_name, food_spotlight_description=e.food_spotlight_description,
        food_included_in_admission=e.food_included_in_admission, activities=list(e.activities or []),
        visit_duration_hours=e.visit_duration_hours, available_months=list(e.available_months or []),
        season_notes=e.season_notes, pricing_status=e.pricing_status, adult_price_cad=e.adult_price_cad,
        child_price_cad=e.child_price_cad, price_basis=e.price_basis, pricing_notes=e.pricing_notes,
        pricing_source_url=e.pricing_source_url, website=e.website, image_url=e.image_url,
        image_page_url=e.image_page_url, image_author=e.image_author, image_license=e.image_license,
        image_caption=e.image_caption, verified_at=e.verified_at,
        sources=[SourceOut.model_validate(s) for s in e.sources],
    )


def trip_regions(trip: Trip) -> list[str]:
    return list(dict.fromkeys(s.experience.region for s in trip.stops))


def trip_out(trip: Trip) -> TripOut:
    return TripOut(
        id=trip.id, generated_at=trip.generated_at, primary_region=trip.primary_region,
        regions=trip_regions(trip), duration_days=trip.duration_days, currency=trip.currency, estimated_total=trip.estimated_total, party=party_out(trip.party),
        stops=[
            TripStopOut(id=s.id, day_number=s.day_number, visit_order=s.visit_order,
                        party_activity_cost=s.party_activity_cost,
                        travel_km_from_previous=s.travel_km_from_previous,
                        travel_hours_from_previous=s.travel_hours_from_previous,
                        previous_label=s.previous_label, experience=experience_out(s.experience))
            for s in trip.stops
        ],
        recommendations=[
            RecommendationOut(member_id=r.member_id, member_name=r.member.name,
                              experience_slug=r.experience.slug if r.experience else None,
                              score=r.score, explanation=r.explanation,
                              matched_interests=r.matched_interests, matched_cultures=r.matched_cultures,
                              region_match=r.region_match, unmet=r.unmet)
            for r in trip.recommendations
        ],
        travel=trip.travel, assumptions=trip.assumptions, budget=trip.budget, notes=trip.notes,
    )


def trip_summary(trip: Trip) -> TripSummaryOut:
    party = trip.party
    cover = next((s.experience.image_url for s in trip.stops if s.experience.image_url), None)
    return TripSummaryOut(
        id=trip.id, generated_at=trip.generated_at, party_id=party.id, party_name=party.name,
        starting_city=party.starting_city, primary_region=trip.primary_region, regions=trip_regions(trip),
        duration_days=trip.duration_days, transportation_method=party.transportation_method,
        party_size=len(party.members), estimated_total=trip.estimated_total, stop_count=len(trip.stops),
        cover_image_url=cover, stop_names=[s.experience.name for s in trip.stops],
    )


def list_trips(session: Session) -> list[Trip]:
    return list(session.scalars(select(Trip).order_by(Trip.generated_at.desc(), Trip.id.desc())))


def assumptions_dict(patch: Any) -> dict[str, float]:
    return {k: v for k, v in patch.model_dump().items() if v is not None}
