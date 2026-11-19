"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------- parties


class Party(Base):
    __tablename__ = "party"
    __table_args__ = (
        CheckConstraint("transportation_method IN ('car','plane')", name="ck_party_transport"),
        CheckConstraint("departure_month BETWEEN 1 AND 12", name="ck_party_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(120))
    starting_city_id: Mapped[str] = mapped_column(String(40))
    starting_city: Mapped[str] = mapped_column(String(80))
    starting_province: Mapped[str] = mapped_column(String(2))
    origin_latitude: Mapped[float] = mapped_column(Float)
    origin_longitude: Mapped[float] = mapped_column(Float)
    transportation_method: Mapped[str] = mapped_column(String(10))
    departure_month: Mapped[int] = mapped_column(Integer)
    departure_date: Mapped[date | None] = mapped_column(Date)
    budget_preference: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    members: Mapped[list[PartyMember]] = relationship(
        back_populates="party", cascade="all, delete-orphan", order_by="PartyMember.position"
    )
    trips: Mapped[list[Trip]] = relationship(back_populates="party", cascade="all, delete-orphan")


class PartyMember(Base):
    __tablename__ = "party_member"

    id: Mapped[int] = mapped_column(primary_key=True)
    party_id: Mapped[int] = mapped_column(ForeignKey("party.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(80))
    preferred_region: Mapped[str | None] = mapped_column(String(20))

    party: Mapped[Party] = relationship(back_populates="members")
    preferences: Mapped[list[MemberPreference]] = relationship(
        back_populates="member", cascade="all, delete-orphan", order_by="MemberPreference.id"
    )

    def values(self, kind: str) -> list[str]:
        return [p.preference_value for p in self.preferences if p.preference_type == kind]


class MemberPreference(Base):
    __tablename__ = "member_preference"
    __table_args__ = (
        UniqueConstraint("member_id", "preference_type", "preference_value", name="uq_member_pref"),
        CheckConstraint("preference_type IN ('interest','culture')", name="ck_pref_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("party_member.id", ondelete="CASCADE"), index=True
    )
    preference_type: Mapped[str] = mapped_column(String(20))
    preference_value: Mapped[str] = mapped_column(String(40))

    member: Mapped[PartyMember] = relationship(back_populates="preferences")


# ------------------------------------------------------------------------- experiences


class Experience(Base):
    __tablename__ = "experience"
    __table_args__ = (
        CheckConstraint(
            "pricing_status IN ('verified','estimate','free','unavailable')", name="ck_price_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(120))
    province: Mapped[str] = mapped_column(String(2))
    region: Mapped[str] = mapped_column(String(20), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    primary_culture: Mapped[str] = mapped_column(String(20))
    community: Mapped[str | None] = mapped_column(String(200))
    short_description: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    agricultural_significance: Mapped[str] = mapped_column(Text)
    cultural_context: Mapped[str] = mapped_column(Text)
    food_spotlight_name: Mapped[str | None] = mapped_column(String(200))
    food_spotlight_description: Mapped[str | None] = mapped_column(Text)
    food_included_in_admission: Mapped[bool] = mapped_column(Boolean, default=False)
    activities: Mapped[list[str]] = mapped_column(JSON, default=list)
    visit_duration_hours: Mapped[float] = mapped_column(Float, default=2.0)
    available_months: Mapped[list[int]] = mapped_column(JSON, default=list)
    season_notes: Mapped[str | None] = mapped_column(Text)
    pricing_status: Mapped[str] = mapped_column(String(20))
    adult_price_cad: Mapped[float | None] = mapped_column(Float)
    child_price_cad: Mapped[float | None] = mapped_column(Float)
    price_basis: Mapped[str] = mapped_column(String(20), default="per_person")
    pricing_notes: Mapped[str | None] = mapped_column(Text)
    pricing_source_url: Mapped[str | None] = mapped_column(String(500))
    website: Mapped[str | None] = mapped_column(String(500))
    image_url: Mapped[str | None] = mapped_column(String(800))
    image_page_url: Mapped[str | None] = mapped_column(String(800))
    image_author: Mapped[str | None] = mapped_column(String(300))
    image_license: Mapped[str | None] = mapped_column(String(100))
    image_caption: Mapped[str | None] = mapped_column(String(400))
    verified_at: Mapped[str | None] = mapped_column(String(20))

    tags: Mapped[list[ExperienceTag]] = relationship(
        back_populates="experience", cascade="all, delete-orphan", order_by="ExperienceTag.tag"
    )
    cultures: Mapped[list[ExperienceCulture]] = relationship(
        back_populates="experience", cascade="all, delete-orphan"
    )
    sources: Mapped[list[ExperienceSource]] = relationship(
        back_populates="experience", cascade="all, delete-orphan", order_by="ExperienceSource.id"
    )

    @property
    def tag_ids(self) -> list[str]:
        return [t.tag for t in self.tags]

    @property
    def culture_ids(self) -> list[str]:
        # primary first, then the rest alphabetically for stable output
        rest = sorted(c.culture for c in self.cultures if c.culture != self.primary_culture)
        return [self.primary_culture, *rest]


class ExperienceTag(Base):
    __tablename__ = "experience_tag"
    __table_args__ = (UniqueConstraint("experience_id", "tag", name="uq_experience_tag"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[int] = mapped_column(
        ForeignKey("experience.id", ondelete="CASCADE"), index=True
    )
    tag: Mapped[str] = mapped_column(String(40), index=True)

    experience: Mapped[Experience] = relationship(back_populates="tags")


class ExperienceCulture(Base):
    __tablename__ = "experience_culture"
    __table_args__ = (UniqueConstraint("experience_id", "culture", name="uq_experience_culture"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[int] = mapped_column(
        ForeignKey("experience.id", ondelete="CASCADE"), index=True
    )
    culture: Mapped[str] = mapped_column(String(20), index=True)

    experience: Mapped[Experience] = relationship(back_populates="cultures")


class ExperienceSource(Base):
    __tablename__ = "experience_source"

    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[int] = mapped_column(
        ForeignKey("experience.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(String(800))
    title: Mapped[str | None] = mapped_column(String(300))
    publisher: Mapped[str | None] = mapped_column(String(200))
    accessed: Mapped[str | None] = mapped_column(String(20))

    experience: Mapped[Experience] = relationship(back_populates="sources")


# ------------------------------------------------------------------------------- trips


class Trip(Base):
    __tablename__ = "trip"

    id: Mapped[int] = mapped_column(primary_key=True)
    party_id: Mapped[int] = mapped_column(ForeignKey("party.id", ondelete="CASCADE"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    primary_region: Mapped[str | None] = mapped_column(String(20))
    # Calculated by the planner from the stops and travel time (no user-chosen limit).
    duration_days: Mapped[int] = mapped_column(Integer)
    # Editable cost assumptions and the computed itemized budget are stored as JSON snapshots
    assumptions: Mapped[dict[str, Any]] = mapped_column(JSON)
    travel: Mapped[dict[str, Any]] = mapped_column(JSON)
    budget: Mapped[dict[str, Any]] = mapped_column(JSON)
    notes: Mapped[list[str]] = mapped_column(JSON, default=list)
    estimated_total: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="CAD")

    party: Mapped[Party] = relationship(back_populates="trips")
    stops: Mapped[list[TripStop]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="(TripStop.day_number, TripStop.visit_order)",
    )
    recommendations: Mapped[list[TripRecommendation]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", order_by="TripRecommendation.id"
    )


class TripStop(Base):
    __tablename__ = "trip_stop"
    __table_args__ = (UniqueConstraint("trip_id", "experience_id", name="uq_trip_stop_experience"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    experience_id: Mapped[int] = mapped_column(ForeignKey("experience.id"), index=True)
    day_number: Mapped[int] = mapped_column(Integer)
    visit_order: Mapped[int] = mapped_column(Integer)
    party_activity_cost: Mapped[float] = mapped_column(Float)
    travel_km_from_previous: Mapped[float] = mapped_column(Float, default=0)
    travel_hours_from_previous: Mapped[float] = mapped_column(Float, default=0)
    previous_label: Mapped[str | None] = mapped_column(String(200))

    trip: Mapped[Trip] = relationship(back_populates="stops")
    experience: Mapped[Experience] = relationship()


class TripRecommendation(Base):
    __tablename__ = "trip_recommendation"
    __table_args__ = (UniqueConstraint("trip_id", "member_id", name="uq_trip_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("party_member.id", ondelete="CASCADE"), index=True
    )
    # Nullable: when no suitable experience exists we store an explanatory fallback instead.
    experience_id: Mapped[int | None] = mapped_column(ForeignKey("experience.id"))
    score: Mapped[float] = mapped_column(Float, default=0)
    explanation: Mapped[str] = mapped_column(Text)
    matched_interests: Mapped[list[str]] = mapped_column(JSON, default=list)
    matched_cultures: Mapped[list[str]] = mapped_column(JSON, default=list)
    region_match: Mapped[bool] = mapped_column(Boolean, default=False)
    unmet: Mapped[list[str]] = mapped_column(JSON, default=list)

    trip: Mapped[Trip] = relationship(back_populates="recommendations")
    member: Mapped[PartyMember] = relationship()
    experience: Mapped[Experience | None] = relationship()
