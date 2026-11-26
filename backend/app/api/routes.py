from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..domain import CITIES, CULTURES, INTERESTS, MONTH_NAMES, PROVINCE_NAMES, REGIONS
from ..models import Experience, Party, Trip
from ..schemas import (
    AssumptionsPatch, ExperienceOut, PartyIn, PartyOut, TripGenerateIn, TripOut, TripSummaryOut,
)
from ..services import parties, trips
from ..services.planner import PlanningError

router = APIRouter(prefix="/api")
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/health")
def health(session: SessionDep) -> dict[str, object]:
    count = session.scalar(select(func.count()).select_from(Experience)) or 0
    return {"status": "ok", "experiences": count}


@router.get("/preferences")
def preferences() -> dict[str, object]:
    return {
        "interests": [{"id": i, "label": label} for i, label, _ in INTERESTS],
        "cultures": [{"id": c, "label": label} for c, label, _ in CULTURES],
        "budget_preferences": [
            {"id": "economy", "label": "Economy"},
            {"id": "moderate", "label": "Moderate"},
            {"id": "premium", "label": "Premium"},
        ],
        "months": [{"id": i + 1, "label": m} for i, m in enumerate(MONTH_NAMES)],
    }


@router.get("/regions")
def regions() -> list[dict[str, object]]:
    return [
        {"id": r.id, "name": r.name, "provinces": [{"code": p, "name": PROVINCE_NAMES[p]} for p in r.provinces]}
        for r in REGIONS
    ]


@router.get("/cities")
def cities() -> list[dict[str, object]]:
    return [
        {"id": c.id, "name": c.name, "province": c.province, "province_name": PROVINCE_NAMES[c.province],
         "latitude": c.latitude, "longitude": c.longitude, "airport": c.airport}
        for c in CITIES
    ]


@router.get("/experiences", response_model=list[ExperienceOut])
def list_experiences(
    session: SessionDep,
    region: str | None = None,
    culture: str | None = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[ExperienceOut]:
    result = trips.load_experiences(session)
    if region:
        result = [e for e in result if e.region == region]
    if culture:
        result = [e for e in result if culture in e.culture_ids]
    if month:
        result = [e for e in result if month in (e.available_months or [])]
    return [trips.experience_out(e) for e in result]


@router.get("/experiences/{key}", response_model=ExperienceOut)
def get_experience(key: str, session: SessionDep) -> ExperienceOut:
    exp = session.scalar(select(Experience).where(Experience.slug == key))
    if exp is None and key.isdigit():
        exp = session.get(Experience, int(key))
    if exp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find that destination.")
    return trips.experience_out(exp)


def _party_or_404(session: Session, party_id: int) -> Party:
    party = session.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find that travel party.")
    return party


def _trip_or_404(session: Session, trip_id: int) -> Trip:
    trip = trips.get_trip(session, trip_id)
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find that journey.")
    return trip


@router.post("/parties", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(data: PartyIn, session: SessionDep) -> PartyOut:
    return parties.party_out(parties.create_party(session, data))


@router.get("/parties/{party_id}", response_model=PartyOut)
def get_party(party_id: int, session: SessionDep) -> PartyOut:
    return parties.party_out(_party_or_404(session, party_id))


@router.put("/parties/{party_id}", response_model=PartyOut)
def update_party(party_id: int, data: PartyIn, session: SessionDep) -> PartyOut:
    return parties.party_out(parties.update_party(session, _party_or_404(session, party_id), data))


@router.post("/trips/generate", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def generate_trip(data: TripGenerateIn, session: SessionDep) -> TripOut:
    party = _party_or_404(session, data.party_id)
    try:
        trip = trips.generate_trip(session, party)
    except PlanningError as exc:
        session.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return trips.trip_out(trip)


@router.get("/trips", response_model=list[TripSummaryOut])
def list_trips(session: SessionDep) -> list[TripSummaryOut]:
    return [trips.trip_summary(t) for t in trips.list_trips(session)]


@router.get("/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, session: SessionDep) -> TripOut:
    return trips.trip_out(_trip_or_404(session, trip_id))


@router.patch("/trips/{trip_id}/assumptions", response_model=TripOut)
def patch_assumptions(trip_id: int, patch: AssumptionsPatch, session: SessionDep) -> TripOut:
    trip = _trip_or_404(session, trip_id)
    try:
        trip = trips.update_assumptions(session, trip, trips.assumptions_dict(patch))
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return trips.trip_out(trip)


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, session: SessionDep) -> None:
    session.delete(_trip_or_404(session, trip_id))
    session.commit()
