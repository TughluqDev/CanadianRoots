import pytest

from app.services.costs import StopCostInput, compute_budget, default_assumptions, sample_airfare, validate_assumptions

STOPS = [
    StopCostInput("a", "A", "verified", 20.0, "per_person"),
    StopCostInput("b", "B", "estimate", 15.0, "per_person"),
    StopCostInput("c", "C", "free", 0.0, "per_person"),
    StopCostInput("d", "D", "unavailable", None, "per_person"),
    StopCostInput("e", "E", "verified", 100.0, "per_group"),
]
CAR = {"effective_method": "car", "ground_km": 500}


def car_budget(travellers: int = 4, days: int = 3, **over):
    a = {**default_assumptions("central", "moderate", CAR), **over}
    return compute_budget(travellers=travellers, duration_days=days, stops=STOPS, travel=CAR, assumptions=a)


def test_activity_costs_by_pricing_status():
    b = car_budget()
    items = {i["slug"]: i for i in b["activities"]["items"]}
    assert items["a"]["subtotal"] == 80.0  # 20 x 4
    assert items["b"]["subtotal"] == 60.0  # estimate 15 x 4
    assert items["c"]["subtotal"] == 0.0
    assert items["d"]["subtotal"] == 0.0 and "unavailable" in items["d"]["note"].lower()
    assert items["e"]["subtotal"] == 100.0  # fixed group price, not multiplied
    assert b["activities"]["total"] == 240.0


def test_shared_stop_not_double_counted():
    a = default_assumptions("central", "moderate", CAR)
    dup = [STOPS[0], STOPS[0]]
    b = compute_budget(travellers=3, duration_days=2, stops=dup, travel=CAR, assumptions=a)
    assert len(b["activities"]["items"]) == 1
    assert b["activities"]["total"] == 60.0


def test_car_cost_is_party_level():
    b = car_budget()
    fuel, parking = b["transportation"]["items"]
    assert fuel["amount"] == pytest.approx(500 * 9.0 / 100 * 1.60)  # 72.00, one vehicle
    assert parking["amount"] == 45.0
    assert b["transportation"]["total"] == 117.0
    # Six travellers need two vehicles at capacity 5
    six = car_budget(travellers=6)
    assert six["vehicles"] == 2
    assert six["transportation"]["items"][0]["amount"] == pytest.approx(144.0)


def test_plane_costs():
    travel = {"effective_method": "plane", "ground_km": 200, "flight_km": 1000}
    a = default_assumptions("atlantic", None, travel)
    assert a["airfare_per_person"] == sample_airfare(1000) == 330.0
    b = compute_budget(travellers=3, duration_days=2, stops=[], travel=travel, assumptions=a)
    amounts = {i["label"]: i["amount"] for i in b["transportation"]["items"]}
    assert amounts["Round-trip airfare (sample)"] == 990.0
    assert amounts["Airport transfers"] == 120.0
    assert amounts["Rental car"] == 160.0
    assert amounts["Fuel for local driving"] == pytest.approx(28.8)
    assert b["transportation"]["total"] == pytest.approx(1298.8)


def test_hotel_rooms_and_tax():
    b = car_budget(travellers=5)
    acc = b["accommodation"]
    assert acc["nights"] == 2 and acc["rooms"] == 3  # ceil(5 / 2)
    assert acc["subtotal_before_tax"] == 3 * 2 * 185
    assert acc["total"] == pytest.approx(1110 * 1.15)
    assert car_budget(days=1)["accommodation"]["total"] == 0  # day trip, no nights


def test_total_aggregation():
    b = car_budget()
    assert b["accommodation"]["total"] == pytest.approx(851.0)
    assert b["meals"]["total"] == 900.0
    assert b["subtotal"] == pytest.approx(240 + 117 + 851 + 900)
    assert b["contingency"] == pytest.approx(210.8)
    assert b["total"] == pytest.approx(2318.8)
    assert b["per_person"] == pytest.approx(579.7)
    assert b["currency"] == "CAD"
    assert "not live booking quotes" in b["disclaimer"]


def test_budget_preference_changes_defaults():
    eco = default_assumptions("central", "economy", CAR)
    prem = default_assumptions("central", "premium", CAR)
    assert eco["daily_food_per_person"] < prem["daily_food_per_person"]
    assert eco["nightly_room_rate"] < prem["nightly_room_rate"]


def test_assumption_validation():
    validate_assumptions({"fuel_price_per_litre": 1.9})
    with pytest.raises(ValueError):
        validate_assumptions({"fuel_price_per_litre": 99})
    with pytest.raises(ValueError):
        validate_assumptions({"bogus": 1})
