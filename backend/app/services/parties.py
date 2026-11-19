"""Party persistence and serialization."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..domain import CITY_BY_ID
from ..models import MemberPreference, Party, PartyMember
from ..schemas import MemberOut, PartyIn, PartyOut


def _apply(party: Party, data: PartyIn) -> None:
    city = CITY_BY_ID[data.starting_city_id]
    party.name = data.name
    party.starting_city_id = city.id
    party.starting_city = city.name
    party.starting_province = city.province
    party.origin_latitude = city.latitude
    party.origin_longitude = city.longitude
    party.transportation_method = data.transportation_method
    party.departure_month = data.departure_month  # type: ignore[assignment]  (validated non-null)
    party.departure_date = data.departure_date
    party.trip_duration_days = data.trip_duration_days
    party.budget_preference = data.budget_preference
    party.members.clear()
    for pos, m in enumerate(data.members):
        member = PartyMember(position=pos, name=m.name, preferred_region=m.preferred_region)
        member.preferences = [
            *(MemberPreference(preference_type="interest", preference_value=i) for i in m.interests),
            *(MemberPreference(preference_type="culture", preference_value=c) for c in m.cultures),
        ]
        party.members.append(member)


def create_party(session: Session, data: PartyIn) -> Party:
    party = Party()
    _apply(party, data)
    session.add(party)
    session.commit()
    session.refresh(party)
    return party


def update_party(session: Session, party: Party, data: PartyIn) -> Party:
    # Trips generated for the old party definition would reference replaced members and stale
    # preferences, so they are discarded. (The UI creates a new party per generation instead.)
    party.trips.clear()
    session.flush()
    _apply(party, data)
    session.commit()
    session.refresh(party)
    return party


def party_out(party: Party) -> PartyOut:
    return PartyOut(
        id=party.id, name=party.name, starting_city_id=party.starting_city_id,
        starting_city=party.starting_city, starting_province=party.starting_province,
        origin_latitude=party.origin_latitude, origin_longitude=party.origin_longitude,
        transportation_method=party.transportation_method, departure_month=party.departure_month,
        departure_date=party.departure_date, trip_duration_days=party.trip_duration_days,
        budget_preference=party.budget_preference, created_at=party.created_at,
        members=[
            MemberOut(id=m.id, name=m.name, interests=m.values("interest"),
                      cultures=m.values("culture"), preferred_region=m.preferred_region)
            for m in party.members
        ],
    )
