"""Transparent, itemized cost estimation (CAD). Pure functions — no database access.

Tax treatment:
- Activity prices are used exactly as published/estimated; no tax is added on top.
- Accommodation: an explicit lodging tax rate (sales + accommodation levies) is added.
- Meal allowance is assumed to already include tax and tip.
- Fuel prices at the pump include taxes.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Any

from ..domain import REGION_BY_ID

DISCLAIMER = "Prices are estimates for trip-planning purposes and are not live booking quotes."

FOOD_BY_BUDGET = {"economy": 55.0, "moderate": 75.0, "premium": 110.0}
ROOM_MULTIPLIER_BY_BUDGET = {"economy": 0.8, "moderate": 1.0, "premium": 1.4}

# Bounds used to validate user-edited assumptions.
ASSUMPTION_BOUNDS: dict[str, tuple[float, float]] = {
    "fuel_price_per_litre": (0.5, 5.0),
    "fuel_consumption_l_per_100km": (3.0, 25.0),
    "vehicle_capacity": (1, 15),
    "parking_misc_per_vehicle_per_day": (0, 200),
    "airfare_per_person": (0, 5000),
    "airport_transfer_per_person": (0, 500),
    "rental_car_per_day": (0, 500),
    "nightly_room_rate": (30, 2000),
    "room_occupancy": (1, 6),
    "accommodation_tax_rate": (0, 0.3),
    "daily_food_per_person": (10, 500),
    "contingency_rate": (0, 0.5),
}


@dataclass(frozen=True)
class StopCostInput:
    slug: str
    name: str
    pricing_status: str  # verified | estimate | free | unavailable
    adult_price_cad: float | None
    price_basis: str  # per_person | per_group


def sample_airfare(flight_km: float) -> float:
    """Sample round-trip economy fare: a base fee plus a distance component, rounded to $10.
    Clearly labelled as a sample — not a quote, and not evidence that a route exists."""
    return float(round((160 + 0.17 * flight_km) / 10) * 10)


def default_assumptions(
    region: str, budget_preference: str | None, travel: dict[str, Any]
) -> dict[str, float]:
    tier = budget_preference or "moderate"
    return {
        "fuel_price_per_litre": 1.60,
        "fuel_consumption_l_per_100km": 9.0,
        "vehicle_capacity": 5,
        "parking_misc_per_vehicle_per_day": 15.0,
        "airfare_per_person": sample_airfare(travel.get("flight_km", 0)) if travel.get("effective_method") == "plane" else 0.0,
        "airport_transfer_per_person": 40.0,
        "rental_car_per_day": 80.0,
        "nightly_room_rate": round(REGION_BY_ID[region].nightly_rate * ROOM_MULTIPLIER_BY_BUDGET[tier]),
        "room_occupancy": 2,
        "accommodation_tax_rate": 0.15,
        "daily_food_per_person": FOOD_BY_BUDGET[tier],
        "contingency_rate": 0.10,
    }


def _money(x: float) -> float:
    return round(x + 1e-9, 2)


def activity_line(stop: StopCostInput, travellers: int) -> dict[str, Any]:
    price = stop.adult_price_cad or 0.0
    if stop.pricing_status in ("free",):
        subtotal, note = 0.0, "Free admission."
    elif stop.pricing_status == "unavailable" or stop.adult_price_cad is None:
        subtotal, note = 0.0, "Price unavailable — not included in the total. Check with the destination."
    elif stop.price_basis == "per_group":
        subtotal, note = price, "Fixed group price."
    else:
        subtotal = price * travellers
        note = (
            "Published adult admission × travellers."
            if stop.pricing_status == "verified"
            else "Demo estimate × travellers (not an official price)."
        )
    return {
        "slug": stop.slug, "name": stop.name, "pricing_status": stop.pricing_status,
        "unit_price": stop.adult_price_cad, "basis": stop.price_basis,
        "travellers": travellers, "subtotal": _money(subtotal), "note": note,
    }


def compute_budget(
    *,
    travellers: int,
    duration_days: int,
    stops: list[StopCostInput],
    travel: dict[str, Any],
    assumptions: dict[str, float],
) -> dict[str, Any]:
    if travellers < 1:
        raise ValueError("A trip needs at least one traveller.")
    a = assumptions
    nights = max(0, duration_days - 1)
    vehicles = ceil(travellers / int(a["vehicle_capacity"]))

    # Activities — one line per unique stop, so shared stops are never double-counted.
    seen: set[str] = set()
    activity_items = []
    for s in stops:
        if s.slug in seen:
            continue
        seen.add(s.slug)
        activity_items.append(activity_line(s, travellers))
    activities_total = _money(sum(i["subtotal"] for i in activity_items))

    # Transportation
    ground_km = float(travel.get("ground_km", 0))
    fuel_litres = ground_km * a["fuel_consumption_l_per_100km"] / 100 * vehicles
    fuel_cost = fuel_litres * a["fuel_price_per_litre"]
    t_items: list[dict[str, Any]] = []
    if travel.get("effective_method") == "plane":
        t_items.append({"label": "Round-trip airfare (sample)",
                        "detail": f"{travellers} × ${a['airfare_per_person']:.0f} sample fare",
                        "amount": _money(a["airfare_per_person"] * travellers)})
        t_items.append({"label": "Airport transfers",
                        "detail": f"{travellers} × ${a['airport_transfer_per_person']:.0f} at home",
                        "amount": _money(a["airport_transfer_per_person"] * travellers)})
        t_items.append({"label": "Rental car",
                        "detail": f"{vehicles} vehicle{'s' if vehicles > 1 else ''} × {duration_days} day{'s' if duration_days > 1 else ''} × ${a['rental_car_per_day']:.0f}",
                        "amount": _money(a["rental_car_per_day"] * vehicles * duration_days)})
        t_items.append({"label": "Fuel for local driving",
                        "detail": f"≈{ground_km:.0f} km × {a['fuel_consumption_l_per_100km']} L/100 km × ${a['fuel_price_per_litre']:.2f}/L × {vehicles} vehicle{'s' if vehicles > 1 else ''}",
                        "amount": _money(fuel_cost)})
    else:
        t_items.append({"label": "Fuel (round trip)",
                        "detail": f"≈{ground_km:.0f} km × {a['fuel_consumption_l_per_100km']} L/100 km × ${a['fuel_price_per_litre']:.2f}/L × {vehicles} vehicle{'s' if vehicles > 1 else ''}",
                        "amount": _money(fuel_cost)})
        t_items.append({"label": "Parking & incidentals",
                        "detail": f"{vehicles} vehicle{'s' if vehicles > 1 else ''} × {duration_days} day{'s' if duration_days > 1 else ''} × ${a['parking_misc_per_vehicle_per_day']:.0f}",
                        "amount": _money(a["parking_misc_per_vehicle_per_day"] * vehicles * duration_days)})
    transport_total = _money(sum(i["amount"] for i in t_items))

    # Accommodation
    occupancy = int(a["room_occupancy"])
    rooms = ceil(travellers / occupancy) if nights else 0
    lodging_before_tax = rooms * nights * a["nightly_room_rate"]
    lodging_tax = lodging_before_tax * a["accommodation_tax_rate"]
    accommodation = {
        "nights": nights, "rooms": rooms, "occupancy": occupancy,
        "nightly_rate": a["nightly_room_rate"], "subtotal_before_tax": _money(lodging_before_tax),
        "tax_rate": a["accommodation_tax_rate"], "tax": _money(lodging_tax),
        "total": _money(lodging_before_tax + lodging_tax),
    }

    meals_total = _money(a["daily_food_per_person"] * travellers * duration_days)
    meals = {
        "days": duration_days, "travellers": travellers, "daily_per_person": a["daily_food_per_person"],
        "total": meals_total,
        "note": "Daily allowance including tax and tip. Food spotlights and tastings are not assumed "
                "to be included in admission unless a destination states so.",
    }

    subtotal = _money(activities_total + transport_total + accommodation["total"] + meals_total)
    contingency = _money(subtotal * a["contingency_rate"])
    total = _money(subtotal + contingency)

    return {
        "currency": "CAD",
        "travellers": travellers,
        "vehicles": vehicles,
        "activities": {"items": activity_items, "total": activities_total},
        "transportation": {"method": travel.get("effective_method", "car"), "items": t_items, "total": transport_total},
        "accommodation": accommodation,
        "meals": meals,
        "subtotal": subtotal,
        "contingency_rate": a["contingency_rate"],
        "contingency": contingency,
        "total": total,
        "per_person": _money(total / travellers),
        "tax_note": "Activity prices are used as published, with no tax added; some destinations publish "
                    "prices before HST/GST (see each destination's pricing notes), so tax at the gate may "
                    "be slightly higher. Lodging tax is added explicitly. Meal allowance and pump fuel "
                    "prices include tax.",
        "disclaimer": DISCLAIMER,
    }


def validate_assumptions(updates: dict[str, float]) -> None:
    for key, value in updates.items():
        if key not in ASSUMPTION_BOUNDS:
            raise ValueError(f"Unknown assumption '{key}'.")
        lo, hi = ASSUMPTION_BOUNDS[key]
        if not (lo <= value <= hi):
            raise ValueError(f"'{key}' must be between {lo} and {hi}.")
