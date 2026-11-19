from sqlalchemy import select

from app.domain import CITY_BY_ID
from app.models import Experience
from app.services import geo
from app.services.planner import CLUSTER_RADIUS_KM, ONE_WAY_LIMIT_HOURS
from app.services.scoring import MemberProfile, score_member
from conftest import member


def _exp(session, slug):
    return session.scalar(select(Experience).where(Experience.slug == "%s" % slug))


def test_scoring_weights(session):
    cheese = _exp(session, "townships-cheese")
    m = MemberProfile(1, 0, "Sarah", ("cheese", "food_tasting", "hiking"), ("french",), "central")
    s = score_member(m, cheese)
    # culture 40 + primary bonus 5 + 2 tags x 15 + region 25
    assert s.score == 40 + 5 + 30 + 25
    assert s.matched_interests == ["cheese", "food_tasting"] and s.region_match
    nomatch = MemberProfile(2, 1, "Z", ("fishing",), ("indigenous",), None)
    assert score_member(nomatch, cheese).score == 0 and not score_member(nomatch, cheese).suitable


def test_recommendations_reflect_preferences(make_trip):
    trip = make_trip([
        member("Sarah", ["french"], ["cheese", "food_tasting"]),
        member("Alex", ["british"], ["animals", "history"]),
    ], city="montreal", month=7, days=5)  # 5 days: Ottawa and Coaticook (~300 km) fit one cluster
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
    # In March only year-round stops and the sugar shack are open; Ottawa Indigenous farm is closed.
    trip = make_trip([member("A", ["french"], ["food_tasting", "cooking"])], city="montreal", month=3)
    slugs = {s["experience"]["slug"] for s in trip["stops"]}
    assert "montreal-sugar-shack" in slugs
    for s in trip["stops"]:
        assert 3 in s["experience"]["available_months"]
    july = make_trip([member("A", ["french"], ["food_tasting", "cooking"])], city="montreal", month=7)
    assert "montreal-sugar-shack" not in {s["experience"]["slug"] for s in july["stops"]}
    assert any("closed to visitors in July" in n for n in july["notes"])


def test_geographic_feasibility_single_region(make_trip):
    # Members with interests scattered across Canada, 3-day road trip from Toronto.
    trip = make_trip([
        member("Bob", ["indigenous"], ["cold_weather", "fishing"], "northern"),
        member("Sarah", ["french"], ["cheese"]),
        member("Alex", ["british"], ["animals", "history"], "atlantic"),
        member("Kim", ["immigrant"], ["fruit_picking"], "west_coast"),
    ], city="toronto", days=3, month=7)
    stops = trip["stops"]
    regions = {s["experience"]["region"] for s in stops}
    assert regions == {"central"}
    # Every stop lies within one cluster's diameter, and the drive in is under the limit.
    for a in stops:
        for b in stops:
            d = geo.great_circle_km(a["experience"]["latitude"], a["experience"]["longitude"],
                                    b["experience"]["latitude"], b["experience"]["longitude"])
            assert d <= 2 * CLUSTER_RADIUS_KM[3]
    assert trip["travel"]["outbound_hours"] <= ONE_WAY_LIMIT_HOURS[3]
    # Bob's northern preference couldn't be met — and the app says so.
    bob = next(r for r in trip["recommendations"] if r["member_name"] == "Bob")
    assert any("Northern Canada" in u for u in bob["unmet"])
    # Days are within duration and ordered
    assert all(1 <= s["day_number"] <= 3 for s in stops)


def test_plane_regional_preference(make_trip):
    trip = make_trip([
        member("Ana", ["british"], ["history", "rural_life"], "atlantic"),
        member("Ben", ["french"], ["history"]),
    ], city="toronto", transport="plane", days=3, month=7)
    assert trip["primary_region"] == "atlantic"
    assert trip["travel"]["effective_method"] == "plane"
    assert trip["travel"]["arrival_airport"]["code"] in {"YYG", "YHZ", "YQM"}
    ana = next(r for r in trip["recommendations"] if r["member_name"] == "Ana")
    assert ana["region_match"] is True
    airfare = next(i for i in trip["budget"]["transportation"]["items"] if "airfare" in i["label"])
    assert airfare["amount"] == trip["assumptions"]["airfare_per_person"] * 2


def test_plane_to_nearby_destinations_falls_back_to_ground(make_trip):
    trip = make_trip([member("A", ["british"], ["animals"])], city="ottawa", transport="plane", days=2)
    assert trip["travel"]["effective_method"] == "car"
    assert trip["assumptions"]["airfare_per_person"] == 0


def test_shared_destination_charged_once(make_trip):
    trip = make_trip([
        member("A", ["british"], ["animals", "history"]),
        member("B", ["british"], ["history", "rural_life"]),
        member("C", ["british"], ["animals"]),
    ], city="ottawa", days=2, month=7)
    recs = trip["recommendations"]
    assert {r["experience_slug"] for r in recs} == {"ottawa-ag-museum"}
    slugs = [s["experience"]["slug"] for s in trip["stops"]]
    assert slugs.count("ottawa-ag-museum") == 1
    item = next(i for i in trip["budget"]["activities"]["items"] if i["slug"] == "ottawa-ag-museum")
    assert item["subtotal"] == 12.0 * 3  # once for the party, not once per member
    # Personalized, distinct explanations mentioning companions
    assert len({r["explanation"] for r in recs}) == 3
    assert all(r["member_name"] in r["explanation"] for r in recs)
    assert "shared highlight" in recs[0]["explanation"]


def test_no_suitable_match_gives_fallback(make_trip):
    trip = make_trip([
        member("A", ["british"], ["animals"]),
        member("Zed", ["indigenous"], ["fishing"]),
    ], city="ottawa", days=1, month=1)
    zed = next(r for r in trip["recommendations"] if r["member_name"] == "Zed")
    assert zed["experience_slug"] is None
    assert "haven't forced a recommendation" in zed["explanation"]


def test_infeasible_trip_returns_friendly_error(client):
    from conftest import party_payload
    p = client.post("/api/parties", json=party_payload(
        [member("A", ["indigenous"], ["cold_weather"])], city="whitehorse", month=1, days=1)).json()
    # Only year-round fixture stops are far from Whitehorse; a 1-day car trip can't reach them.
    r = client.post("/api/trips/generate", json={"party_id": p["id"]})
    assert r.status_code == 422
    assert "Try a longer trip" in r.json()["detail"]


def test_itinerary_daily_capacity(make_trip):
    trip = make_trip([member(f"M{i}", ["british", "french", "indigenous", "immigrant"],
                             ["history", "farming", "food_tasting", "cheese"]) for i in range(3)],
                     city="ottawa", days=2, month=7)
    by_day: dict[int, float] = {}
    for s in trip["stops"]:
        by_day[s["day_number"]] = by_day.get(s["day_number"], 0) + s["travel_hours_from_previous"] + s["experience"]["visit_duration_hours"]
    assert all(h <= 10 for h in by_day.values())
    assert CITY_BY_ID["ottawa"]
