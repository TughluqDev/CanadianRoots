from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SEED_ON_STARTUP"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, get_session
from app import models
from app.main import app
from app.seed import DatasetIn, seed

ALL_YEAR = list(range(1, 13))


def rec(slug: str, *, province: str, region: str, lat: float, lon: float, culture: str,
        cultures: list[str] | None = None, tags: list[str], months: list[int] = ALL_YEAR,
        status: str = "verified", price: float | None = 20.0, hours: float = 2.5,
        basis: str = "per_person") -> dict:
    return {
        "slug": slug, "name": f"Test {slug.replace('-', ' ').title()}", "address": "1 Test Rd",
        "city": "Testville", "province": province, "region": region, "latitude": lat, "longitude": lon,
        "primary_culture": culture, "cultures": cultures or [culture], "community": None, "tags": tags,
        "short_description": "Synthetic test record.", "description": "Synthetic test record.",
        "agricultural_significance": "Synthetic.", "cultural_context": "Synthetic cultural context. More.",
        "food_spotlight": {"name": "Test food", "description": "Synthetic.", "included_in_admission": False},
        "activities": ["Guided farm tour", "Seasonal tasting"], "visit_duration_hours": hours,
        "available_months": months, "season_notes": None,
        "pricing": {"status": status, "adult_price_cad": price, "basis": basis,
                    "source_url": "https://example.org/price" if status == "verified" else None},
        "website": "https://example.org", "sources": [{"url": "https://example.org"}],
        "verified_at": "2026-11-18", "image": None,
    }


FIXTURE = {"experiences": [
    rec("ottawa-indigenous-farm", province="ON", region="central", lat=45.33, lon=-75.80,
        culture="indigenous", tags=["farming", "indigenous_culture", "food_tasting", "nature"],
        months=[5, 6, 7, 8, 9, 10], price=20.0),
    rec("ottawa-ag-museum", province="ON", region="central", lat=45.385, lon=-75.71,
        culture="british", tags=["animals", "history", "farming", "rural_life"], price=12.0),
    rec("townships-cheese", province="QC", region="central", lat=45.13, lon=-71.80,
        culture="french", tags=["cheese", "food_tasting", "rural_life"], status="estimate", price=15.0),
    rec("montreal-sugar-shack", province="QC", region="central", lat=45.60, lon=-73.90,
        culture="french", tags=["food_tasting", "cooking", "cold_weather"], months=[2, 3, 4],
        status="estimate", price=40.0),
    rec("niagara-orchard", province="ON", region="central", lat=43.15, lon=-79.25,
        culture="immigrant", cultures=["immigrant", "british"], tags=["fruit_picking", "warm_weather"],
        months=[6, 7, 8, 9, 10], status="estimate", price=10.0),
    rec("pei-village", province="PE", region="atlantic", lat=46.16, lon=-62.85,
        culture="british", tags=["history", "rural_life", "animals"], months=[6, 7, 8, 9], price=10.0),
    rec("ns-acadian-dykes", province="NS", region="atlantic", lat=45.10, lon=-64.31,
        culture="french", tags=["history", "scenic_landscapes", "farming"], months=[5, 6, 7, 8, 9, 10],
        price=8.0),
    rec("alberta-ukrainian", province="AB", region="prairies", lat=53.57, lon=-112.77,
        culture="immigrant", tags=["history", "traditional_crafts", "rural_life"], months=[5, 6, 7, 8, 9],
        price=15.0),
    rec("bc-orchard", province="BC", region="west_coast", lat=49.90, lon=-119.40,
        culture="immigrant", tags=["fruit_picking", "warm_weather", "scenic_landscapes"],
        months=[7, 8, 9], status="free", price=None),
    rec("yukon-farm", province="YT", region="northern", lat=60.80, lon=-135.10,
        culture="indigenous", tags=["cold_weather", "farming", "fishing"], months=[6, 7, 8],
        status="unavailable", price=None),
]}


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture()
def session(engine, tmp_path) -> Session:
    s = sessionmaker(bind=engine, expire_on_commit=False)()
    seed(s, DatasetIn.model_validate(FIXTURE), image_dir=tmp_path)
    yield s
    s.close()


@pytest.fixture()
def client(engine, session) -> TestClient:
    maker = sessionmaker(bind=engine, expire_on_commit=False)

    def _override():
        s = maker()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_session] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def member(name: str, cultures: list[str], interests: list[str] | None = None, region: str | None = None) -> dict:
    return {"name": name, "cultures": cultures, "interests": interests or [], "preferred_region": region}


def party_payload(members: list[dict], **kw) -> dict:
    return {"name": kw.get("name", "Test Party"), "starting_city_id": kw.get("city", "toronto"),
            "transportation_method": kw.get("transport", "car"), "departure_month": kw.get("month", 7),
            "budget_preference": kw.get("budget"),
            "members": members}


@pytest.fixture()
def make_trip(client):
    def _make(members: list[dict], **kw) -> dict:
        r = client.post("/api/parties", json=party_payload(members, **kw))
        assert r.status_code == 201, r.text
        t = client.post("/api/trips/generate", json={"party_id": r.json()["id"]})
        assert t.status_code == 201, t.text
        return t.json()
    return _make
