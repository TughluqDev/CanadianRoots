"""Validate researched destination data and import it into SQLite idempotently (upsert by slug)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config
from .domain import CULTURE_IDS, INTEREST_IDS, PROVINCE_TO_REGION
from .models import Experience, ExperienceCulture, ExperienceSource, ExperienceTag, TripStop


class FoodIn(BaseModel):
    name: str
    description: str
    included_in_admission: bool = False


class PricingIn(BaseModel):
    status: Literal["verified", "estimate", "free", "unavailable"]
    adult_price_cad: float | None = Field(default=None, ge=0)
    child_price_cad: float | None = Field(default=None, ge=0)
    basis: Literal["per_person", "per_group"] = "per_person"
    notes: str | None = None
    source_url: str | None = None

    @model_validator(mode="after")
    def _consistent(self) -> PricingIn:
        if self.status in ("verified", "estimate") and self.adult_price_cad is None:
            raise ValueError(f"pricing status '{self.status}' requires adult_price_cad")
        if self.status == "free":
            self.adult_price_cad = 0.0
        if self.status == "verified" and not self.source_url:
            raise ValueError("verified prices need a source_url")
        return self


class SourceIn(BaseModel):
    url: str
    title: str | None = None
    publisher: str | None = None
    accessed: str | None = None


class ImageIn(BaseModel):
    url: str
    page_url: str | None = None
    author: str | None = None
    license: str | None = None
    caption: str | None = None


class ExperienceIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    name: str
    address: str | None = None
    city: str
    province: str
    region: str
    latitude: float = Field(ge=41.0, le=84.0)
    longitude: float = Field(ge=-142.0, le=-52.0)
    primary_culture: str
    cultures: list[str]
    community: str | None = None
    tags: list[str]
    short_description: str
    description: str
    agricultural_significance: str
    cultural_context: str
    food_spotlight: FoodIn | None = None
    activities: list[str] = Field(default_factory=list)
    visit_duration_hours: float = Field(gt=0, le=10)
    available_months: list[int]
    season_notes: str | None = None
    pricing: PricingIn
    website: str | None = None
    sources: list[SourceIn] = Field(min_length=1)
    verified_at: str | None = None
    image: ImageIn | None = None

    @field_validator("tags")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        bad = set(v) - INTEREST_IDS
        if bad:
            raise ValueError(f"unknown tags {sorted(bad)}")
        return sorted(set(v))

    @field_validator("available_months")
    @classmethod
    def _months(cls, v: list[int]) -> list[int]:
        if any(m < 1 or m > 12 for m in v):
            raise ValueError("months must be 1-12")
        return sorted(set(v))

    @model_validator(mode="after")
    def _cross(self) -> ExperienceIn:
        if self.province not in PROVINCE_TO_REGION:
            raise ValueError(f"unknown province {self.province}")
        if PROVINCE_TO_REGION[self.province] != self.region:
            raise ValueError(f"{self.province} is not in region {self.region}")
        if self.primary_culture not in CULTURE_IDS or set(self.cultures) - CULTURE_IDS:
            raise ValueError("unknown culture id")
        if self.primary_culture not in self.cultures:
            self.cultures = [self.primary_culture, *self.cultures]
        self.cultures = sorted(set(self.cultures))
        return self


class DatasetIn(BaseModel):
    experiences: list[ExperienceIn]

    @model_validator(mode="after")
    def _unique(self) -> DatasetIn:
        slugs = [e.slug for e in self.experiences]
        dupes = {s for s in slugs if slugs.count(s) > 1}
        if dupes:
            raise ValueError(f"duplicate slugs: {sorted(dupes)}")
        return self


def load_dataset(path: Path | None = None) -> DatasetIn:
    path = path or config.DATA_FILE
    return DatasetIn.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _local_image(slug: str, image_dir: Path) -> str | None:
    for ext in ("jpg", "jpeg", "png", "webp"):
        if (image_dir / f"{slug}.{ext}").exists():
            return f"/images/experiences/{slug}.{ext}"
    return None


def seed(session: Session, dataset: DatasetIn, image_dir: Path | None = None) -> dict[str, int]:
    image_dir = image_dir or config.IMAGE_DIR
    existing = {e.slug: e for e in session.scalars(select(Experience))}
    created = updated = removed = 0

    for rec in dataset.experiences:
        exp = existing.get(rec.slug)
        if exp is None:
            exp = Experience(slug=rec.slug)
            session.add(exp)
            created += 1
        else:
            updated += 1
        food = rec.food_spotlight
        img = rec.image
        exp.name = rec.name
        exp.address = rec.address
        exp.city = rec.city
        exp.province = rec.province
        exp.region = rec.region
        exp.latitude = rec.latitude
        exp.longitude = rec.longitude
        exp.primary_culture = rec.primary_culture
        exp.community = rec.community
        exp.short_description = rec.short_description
        exp.description = rec.description
        exp.agricultural_significance = rec.agricultural_significance
        exp.cultural_context = rec.cultural_context
        exp.food_spotlight_name = food.name if food else None
        exp.food_spotlight_description = food.description if food else None
        exp.food_included_in_admission = food.included_in_admission if food else False
        exp.activities = rec.activities
        exp.visit_duration_hours = rec.visit_duration_hours
        exp.available_months = rec.available_months
        exp.season_notes = rec.season_notes
        exp.pricing_status = rec.pricing.status
        exp.adult_price_cad = rec.pricing.adult_price_cad
        exp.child_price_cad = rec.pricing.child_price_cad
        exp.price_basis = rec.pricing.basis
        exp.pricing_notes = rec.pricing.notes
        exp.pricing_source_url = rec.pricing.source_url
        exp.website = rec.website
        # Prefer a locally cached copy of the openly licensed photo; fall back to the remote URL.
        exp.image_url = (_local_image(rec.slug, image_dir) or img.url) if img else None
        exp.image_page_url = img.page_url if img else None
        exp.image_author = img.author if img else None
        exp.image_license = img.license if img else None
        exp.image_caption = img.caption if img else None
        exp.verified_at = rec.verified_at
        # Diff association rows instead of replacing them, so unique constraints never collide.
        exp.tags = [t for t in exp.tags if t.tag in rec.tags] + [
            ExperienceTag(tag=t) for t in rec.tags if t not in {x.tag for x in exp.tags}
        ]
        exp.cultures = [c for c in exp.cultures if c.culture in rec.cultures] + [
            ExperienceCulture(culture=c) for c in rec.cultures if c not in {x.culture for x in exp.cultures}
        ]
        exp.sources = [ExperienceSource(**s.model_dump()) for s in rec.sources]
        session.flush()

    keep = {r.slug for r in dataset.experiences}
    referenced = set(session.scalars(select(TripStop.experience_id)))
    for slug, exp in existing.items():
        if slug not in keep and exp.id not in referenced:
            session.delete(exp)
            removed += 1
    session.commit()
    return {"created": created, "updated": updated, "removed": removed,
            "total": len(dataset.experiences)}
