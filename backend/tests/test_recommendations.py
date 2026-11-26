from sqlalchemy import select

from app.domain import CITY_BY_ID
from app.models import Experience
from app.services import geo
from app.services.planner import CLUSTER_RADIUS_KM, DAY_HOURS
from app.services.scoring import MemberProfile, score_member
from conftest import member


def _exp(session, slug):
    return session.scalar(select(Experience).where(Experience.slug == "%s" % slug))


def test_scoring_weights(session):
    cheese = _exp(session, "townships-cheese")
    m = MemberProfile(1, 0, "Sarah", ("cheese", "food_tasting", "hiking"), ("french",), "central")
    s = score_member(m, cheese)
    assert s.score == 40 + 5 + 30 + 25
    assert s.matched_interests == ["cheese", "food_tasting"] and s.region_match
    nomatch = MemberProfile(2, 1, "Z", ("fishing",), ("indigenous",), None)
    assert score_member(nomatch, cheese).score == 0 and not score_member(nomatch, cheese).suitable


def test_recommendations_reflect_preferences(make_trip):
    trip = make_trip([
        member("Sarah", ["french"], ["cheese", "food_tasting"]),
        member("Alex", ["british"], ["animals", "history"]),
    ], city="montreal", month=7)
    recs = {r["member_name"]: r for r in trip["recommendations"]}
    assert recs["Sarah"]["experience_slug"] == "townships-cheese"
    assert recs["Alex"]["experience_slug"] == "ottawa-ag-museum"
    assert "Sarah" in recs["Sarah"]["explanation"] and "cheese" in recs["Sarah"]["explanation"]
    assert recs["Sarah"]["matched_cultures"] == ["french"]


def test_deterministic(make_trip):
    members = [member("A", ["french"], ["food_tasting"]), member("B", ["indigenous"], ["farming"]),
               member("C", ["immigrant"], ["fruit_picking"])]
    t1, t2 = make_trip(members), make_trip(members)
    strip = lambda t: ([(s["experience"]["slug"], s["day_number"], s["visit_order"]) for s in t["stops"]],
                       [(r["experience_slug"], r["explanation"]) for r in t["recommendations"]],
                       t["budget"]["total"])
    assert strip(t1) == strip(t2)


def test_season_filtering(make_trip):
    trip = make_trip([member("A", ["french"], ["food_tasting", "cooking"])], city="montreal", month=3)
    slugs = {s["experience"]["slug"] for s in trip["stops"]}
    assert "montreal-sugar-shack" in slugs
    for s in trip["stops"]:
        assert 3 in s["experience"]["available_months"]
    july = make_trip([member("A", ["french"], ["food_tasting", "cooking"])], city="montreal", month=7)
    assert "montreal-sugar-shack" not in {s["experience"]["slug"] for s in july["stops"]}
    assert any("closed in July" in n for n in july["notes"])


def test_every_preferred_region_is_visited(make_trip):
    trip = make_trip([
        member("Bob", ["indigenous"], ["cold_weather", "fishing"], "northern"),
        member("Sarah", ["french"], ["cheese"]),
        member("Alex", ["british"], ["animals", "history"], "atlantic"),
        member("Kim", ["immigrant"], ["fruit_picking"], "west_coast"),
    ], city="toronto", month=7)
    stops = trip["stops"]
    assert len(stops) <= len(trip["party"]["members"])
    regions = {s["experience"]["region"] for s in stops}
    assert {"northern", "atlantic", "west_coast"} <= regions
    assert set(trip["regions"]) == regions
    for name in ("Bob", "Alex", "Kim"):
        rec = next(r for r in trip["recommendations"] if r["member_name"] == name)
        assert not any("preferred" in u for u in rec["unmet"])
    for region in regions:
        here = [s for s in stops if s["experience"]["region"] == region]
        for a in here:
            for b in here:
                d = geo.great_circle_km(a["experience"]["latitude"], a["experience"]["longitude"],
                                        b["experience"]["latitude"], b["experience"]["longitude"])
                assert d <= 2 * CLUSTER_RADIUS_KM
    days = [s["day_number"] for s in stops]
    assert days == sorted(days) and all(1 <= d <= trip["duration_days"] for d in days)
    assert any(c.startswith("Regions on this trip:") for c in trip["travel"]["considerations"])


def test_multi_region_plane_trip_flies_between_regions(make_trip):
    trip = make_trip([
        member("Bob", ["indigenous"], ["farming"], "northern"),
        member("Alex", ["british"], ["history"], "atlantic"),
    ], city="toronto", transport="plane", month=7)
    assert set(trip["regions"]) == {"northern", "atlantic"}
    flights = trip["travel"]["flights"]
    assert len(flights) == 3
    assert flights[0]["from"]["code"] == "YYZ" and flights[-1]["to"]["code"] == "YYZ"
    assert flights[-1]["before_stop"] is None and trip["travel"]["return_flight"] is True
    airfare = next(i for i in trip["budget"]["transportation"]["items"] if "irfare" in i["label"])
    assert airfare["label"] == "Airfare, 3 flights (sample)"
    assert airfare["amount"] == trip["assumptions"]["airfare_per_person"] * 2


def test_preferred_region_closed_is_explained(make_trip):
    trip = make_trip([
        member("Bob", ["british"], ["history"], "northern"),
    ], city="ottawa", month=1)
    assert "northern" not in trip["regions"]
    bob = trip["recommendations"][0]
    assert any("Northern Canada" in u and "January" in u for u in bob["unmet"])


def test_plane_regional_preference(make_trip):
    trip = make_trip([
        member("Ana", ["british"], ["history", "rural_life"], "atlantic"),
        member("Ben", ["french"], ["history"]),
    ], city="toronto", transport="plane", month=7)
    assert trip["primary_region"] == "atlantic"
    assert trip["travel"]["effective_method"] == "plane"
    assert trip["travel"]["arrival_airport"]["code"] in {"YYG", "YHZ", "YQM"}
    ana = next(r for r in trip["recommendations"] if r["member_name"] == "Ana")
    assert ana["region_match"] is True
    airfare = next(i for i in trip["budget"]["transportation"]["items"] if "airfare" in i["label"])
    assert airfare["amount"] == trip["assumptions"]["airfare_per_person"] * 2


def test_plane_to_nearby_destinations_falls_back_to_ground(make_trip):
    trip = make_trip([member("A", ["british"], ["animals"])], city="ottawa", transport="plane")
    assert trip["travel"]["effective_method"] == "car"
    assert trip["assumptions"]["airfare_per_person"] == 0


def test_shared_destination_charged_once(make_trip):
    trip = make_trip([
        member("A", ["british"], ["animals", "history"]),
        member("B", ["british"], ["history", "rural_life"]),
        member("C", ["british"], ["animals"]),
    ], city="ottawa", month=7)
    recs = trip["recommendations"]
    assert {r["experience_slug"] for r in recs} == {"ottawa-ag-museum"}
    slugs = [s["experience"]["slug"] for s in trip["stops"]]
    assert slugs.count("ottawa-ag-museum") == 1
    item = next(i for i in trip["budget"]["activities"]["items"] if i["slug"] == "ottawa-ag-museum")
    assert item["subtotal"] == 12.0 * 3
    assert len({r["explanation"] for r in recs}) == 3
    assert all(r["member_name"] in r["explanation"] for r in recs)
    assert "Also recommended for" in recs[0]["explanation"]


def test_no_suitable_match_gives_fallback(make_trip):
    trip = make_trip([
        member("A", ["british"], ["animals"]),
        member("Zed", ["indigenous"], ["fishing"]),
    ], city="ottawa", month=1)
    zed = next(r for r in trip["recommendations"] if r["member_name"] == "Zed")
    assert zed["experience_slug"] is None
    assert "No stop on this route closely matches Zed" in zed["explanation"]


def test_infeasible_trip_returns_friendly_error(client):
    from conftest import party_payload
    p = client.post("/api/parties", json=party_payload(
        [member("A", ["indigenous"], ["cold_weather"])], city="whitehorse", month=1)).json()
    r = client.post("/api/trips/generate", json={"party_id": p["id"]})
    assert r.status_code == 422
    assert "suit your group" in r.json()["detail"]


def test_itinerary_daily_capacity(make_trip):
    trip = make_trip([member(f"M{i}", ["british", "french", "indigenous", "immigrant"],
                             ["history", "farming", "food_tasting", "cheese"]) for i in range(3)],
                     city="ottawa", month=7)
    by_day: dict[int, float] = {}
    for s in trip["stops"]:
        by_day[s["day_number"]] = by_day.get(s["day_number"], 0) + s["travel_hours_from_previous"] + s["experience"]["visit_duration_hours"]
    assert all(h <= DAY_HOURS for h in by_day.values())
    assert CITY_BY_ID["ottawa"]


def test_duration_is_calculated_from_the_itinerary(make_trip):
    near = make_trip([member("A", ["british"], ["animals"])], city="ottawa", month=7)
    assert near["duration_days"] == 1
    assert near["budget"]["accommodation"]["nights"] == 0
    far = make_trip([member("A", ["british"], ["animals"])], city="winnipeg", month=7)
    assert far["duration_days"] > near["duration_days"]
    assert far["duration_days"] >= max(s["day_number"] for s in far["stops"])
    scheduled_hours = {}
    for segment in far["travel"]["segments"]:
        day = segment["day"]
        scheduled_hours[day] = scheduled_hours.get(day, 0) + segment["hours"]
    for stop in far["stops"]:
        day = stop["day_number"]
        scheduled_hours[day] = scheduled_hours.get(day, 0) + stop["experience"]["visit_duration_hours"]
    assert set(scheduled_hours) == set(range(1, far["duration_days"] + 1))
    assert all(0 < hours <= DAY_HOURS + 0.01 for hours in scheduled_hours.values())
    assert all(segment["before_stop"] is None
               for segment in far["travel"]["segments"] if segment["day"] == far["duration_days"])
    assert far["budget"]["meals"]["days"] == far["duration_days"]
    assert any("for visits and round-trip travel" in n for n in far["notes"])
