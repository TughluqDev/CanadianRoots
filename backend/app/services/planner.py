"""Group-level trip planner.

Explainable heuristic (no solver):

1. Filter experiences to those open in the travel month (hard eligibility rule).
2. Score every eligible experience for every member.
3. Treat each eligible experience as an *anchor* and form a compact cluster of nearby eligible
   experiences (radius grows with trip length). One cluster == one primary travel area, which
   keeps the shared trip geographically coherent.
4. Reject clusters that can't be reached from the origin within a one-way travel-time budget
   for the chosen transport mode and trip length.
5. Inside a cluster, greedily add the stop with the largest *marginal* gain for the group
   (how much it improves each member's best match), so shared stops that please several
   people win naturally. Then lightly fill remaining days with stops the group still enjoys.
6. Order stops by nearest-neighbour and pack them into days under a daily hour budget.
7. Score the resulting itinerary and keep the best cluster. Ties break deterministically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import ceil

from ..domain import AIRPORT_CITIES, CITY_BY_ID, CULTURE_ADJ, INTEREST_LABEL, MONTH_NAMES, REGION_BY_ID, City
from ..models import Experience
from . import geo
from .scoring import MatchScore, MemberProfile, explain, is_in_season, score_member

DAY_HOURS = 10.0  # travel + activities per day
# Maximum door-to-door one-way travel time by trip length (hours).
ONE_WAY_LIMIT_HOURS = {1: 2.5, 2: 4.5, 3: 6.5, 4: 8.0, 5: 9.5}
# Max straight-line radius (km) of a cluster around its anchor, by trip length.
CLUSTER_RADIUS_KM = {1: 80.0, 2: 150.0, 3: 220.0, 4: 280.0, 5: 320.0}
MAX_GROUND_FROM_AIRPORT_HOURS = 3.5
AIRPORT_TRANSFER_HOURS = 0.75  # home -> airport when the origin city has its own airport
MAX_STOPS_PER_DAY = 3
COVERAGE_BONUS = 15.0
TRAVEL_PENALTY_PER_HOUR = 3.0


class PlanningError(Exception):
    """Raised when no plausible trip can be generated; message is user-facing."""


@dataclass(frozen=True)
class PartySettings:
    origin: City
    transport: str
    month: int
    duration_days: int
    budget_preference: str | None


@dataclass
class PlannedStop:
    experience: Experience
    day: int
    order: int
    km_from_previous: float
    hours_from_previous: float
    previous_label: str


@dataclass
class MemberRecommendation:
    member: MemberProfile
    experience: Experience | None
    match: MatchScore
    explanation: str
    unmet: list[str] = field(default_factory=list)


@dataclass
class Plan:
    stops: list[PlannedStop]
    recommendations: list[MemberRecommendation]
    primary_region: str
    travel: dict
    notes: list[str]


@dataclass
class _Access:
    start_lat: float
    start_lon: float
    start_label: str
    offset_hours: float  # travel already spent before reaching the start point (flights)
    travel: dict


# ----------------------------------------------------------------------------- helpers


def _nearest_airport(lat: float, lon: float, exclude: str | None = None) -> City:
    candidates = [c for c in AIRPORT_CITIES if c.id != exclude]
    return min(candidates, key=lambda c: (geo.great_circle_km(lat, lon, c.latitude, c.longitude), c.id))


def _access_for(settings: PartySettings, anchor: Experience) -> _Access:
    o = settings.origin
    if settings.transport == "car":
        return _Access(o.latitude, o.longitude, f"{o.name}, {o.province}", 0.0, {
            "method": "car", "effective_method": "car",
        })

    origin_airport = o if o.airport else _nearest_airport(o.latitude, o.longitude)
    arrival = _nearest_airport(anchor.latitude, anchor.longitude)
    if arrival.id == origin_airport.id:
        # Destinations are served by the home airport: flying makes no sense, drive instead.
        return _Access(o.latitude, o.longitude, f"{o.name}, {o.province}", 0.0, {
            "method": "plane", "effective_method": "car",
            "no_flight_reason": (
                f"These destinations are within driving distance of {o.name}, so no flight is "
                "needed; ground transport is estimated instead."
            ),
        })

    pre_hours = (
        AIRPORT_TRANSFER_HOURS
        if o.airport
        else geo.drive_hours(geo.road_km(o.latitude, o.longitude, origin_airport.latitude, origin_airport.longitude))
    )
    flight_km = geo.great_circle_km(
        origin_airport.latitude, origin_airport.longitude, arrival.latitude, arrival.longitude
    )
    flight_h = geo.flight_hours(flight_km)
    return _Access(arrival.latitude, arrival.longitude, f"{arrival.name} airport ({arrival.airport})",
                   pre_hours + flight_h, {
        "method": "plane", "effective_method": "plane",
        "origin_airport": {"code": origin_airport.airport, "city": origin_airport.name},
        "arrival_airport": {"code": arrival.airport, "city": arrival.name,
                            "province": arrival.province},
        "flight_km": round(flight_km),
        "flight_hours": round(flight_h, 1),
        "pre_flight_hours": round(pre_hours, 1),
    })


def _order_nearest_neighbour(lat: float, lon: float, exps: list[Experience]) -> list[Experience]:
    remaining = sorted(exps, key=lambda e: e.slug)
    ordered: list[Experience] = []
    cur_lat, cur_lon = lat, lon
    while remaining:
        nxt = min(remaining, key=lambda e: (geo.great_circle_km(cur_lat, cur_lon, e.latitude, e.longitude), e.slug))
        ordered.append(nxt)
        remaining.remove(nxt)
        cur_lat, cur_lon = nxt.latitude, nxt.longitude
    return ordered


def _schedule(
    ordered: list[Experience], access: _Access, duration: int, per_day_max: int
) -> tuple[list[PlannedStop], list[Experience]]:
    placed: list[PlannedStop] = []
    dropped: list[Experience] = []
    day, used, count = 1, access.offset_hours, 0
    prev_lat, prev_lon, prev_label = access.start_lat, access.start_lon, access.start_label
    at_start = True

    def return_hours(e: Experience) -> float:
        return geo.drive_hours(geo.road_km(e.latitude, e.longitude, access.start_lat, access.start_lon)) + access.offset_hours

    for exp in ordered:
        km = geo.road_km(prev_lat, prev_lon, exp.latitude, exp.longitude)
        leg_h = geo.drive_hours(km)
        cur_day, cur_used, cur_count, cur_leg_h = day, used, count, leg_h
        while True:
            reserve = return_hours(exp) if cur_day == duration else 0.0
            if cur_count < per_day_max and cur_used + cur_leg_h + exp.visit_duration_hours + reserve <= DAY_HOURS:
                cur_used += cur_leg_h + exp.visit_duration_hours
                placed.append(PlannedStop(exp, cur_day, cur_count + 1, round(km, 1), round(leg_h, 2), prev_label))
                day, used, count = cur_day, cur_used, cur_count + 1
                prev_lat, prev_lon, prev_label = exp.latitude, exp.longitude, exp.name
                at_start = False
                break
            if cur_day < duration:
                if at_start and cur_count == 0:
                    # Day spent travelling toward the area; next morning's drive is local.
                    cur_leg_h = geo.drive_hours(geo.LOCAL_MIN_KM)
                cur_day, cur_used, cur_count = cur_day + 1, 0.0, 0
                continue
            dropped.append(exp)
            break
    return placed, dropped


# -------------------------------------------------------------------------- the planner


def plan_trip(
    settings: PartySettings, members: list[MemberProfile], experiences: list[Experience]
) -> Plan:
    if not members:
        raise PlanningError("Add at least one traveller before generating a journey.")
    if not experiences:
        raise PlanningError("The destination database is empty. Run the seed script first.")

    month_name = MONTH_NAMES[settings.month - 1]
    eligible = sorted((e for e in experiences if is_in_season(e, settings.month)), key=lambda e: e.slug)
    if not eligible:
        raise PlanningError(
            f"None of our destinations welcome visitors in {month_name}. Try a different month."
        )

    scores: dict[tuple[int, str], MatchScore] = {
        (m.id, e.slug): score_member(m, e, settings.budget_preference) for m in members for e in eligible
    }

    def group_value(e: Experience) -> float:
        return sum(scores[(m.id, e.slug)].score for m in members if scores[(m.id, e.slug)].suitable)

    limit = ONE_WAY_LIMIT_HOURS[settings.duration_days]
    radius = CLUSTER_RADIUS_KM[settings.duration_days]
    max_stops = min(2 * settings.duration_days, 6)
    fill_target = min(settings.duration_days + 1, max_stops)

    best: tuple[tuple[float, float, str], list[PlannedStop], _Access, list[Experience]] | None = None

    for anchor in eligible:
        access = _access_for(settings, anchor)
        if settings.transport == "plane" and access.travel["effective_method"] == "plane":
            ground = geo.drive_hours(geo.road_km(access.start_lat, access.start_lon, anchor.latitude, anchor.longitude))
            if ground > MAX_GROUND_FROM_AIRPORT_HOURS:
                continue
        reach = access.offset_hours + geo.drive_hours(
            geo.road_km(access.start_lat, access.start_lon, anchor.latitude, anchor.longitude)
        )
        if reach > limit:
            continue

        cluster = [
            e for e in eligible
            if geo.great_circle_km(anchor.latitude, anchor.longitude, e.latitude, e.longitude) <= radius
        ]

        # Greedy marginal-gain selection (anchor is always considered first among equals).
        chosen: list[Experience] = []
        best_for: dict[int, float] = {m.id: 0.0 for m in members}
        pool = list(cluster)
        while pool and len(chosen) < max_stops:
            def gain(e: Experience) -> float:
                return sum(
                    max(0.0, scores[(m.id, e.slug)].score - best_for[m.id])
                    for m in members if scores[(m.id, e.slug)].suitable
                )
            cand = max(pool, key=lambda e: (gain(e), group_value(e), e.slug == anchor.slug, e.slug))
            g = gain(cand)
            if g <= 0 and (len(chosen) >= fill_target or group_value(cand) <= 0):
                break
            chosen.append(cand)
            pool.remove(cand)
            for m in members:
                s = scores[(m.id, cand.slug)]
                if s.suitable:
                    best_for[m.id] = max(best_for[m.id], s.score)

        if not chosen:
            continue

        ordered = _order_nearest_neighbour(access.start_lat, access.start_lon, chosen)
        per_day = max(1, ceil(len(ordered) / settings.duration_days))
        placed, dropped = _schedule(ordered, access, settings.duration_days, per_day)
        if dropped and per_day < MAX_STOPS_PER_DAY:
            placed2, dropped2 = _schedule(ordered, access, settings.duration_days, MAX_STOPS_PER_DAY)
            if len(placed2) > len(placed):
                placed, dropped = placed2, dropped2
        if not placed:
            continue

        objective = 0.0
        for m in members:
            vals = [scores[(m.id, p.experience.slug)] for p in placed]
            suitable = [v.score for v in vals if v.suitable]
            if suitable:
                objective += max(suitable) + COVERAGE_BONUS
        objective -= TRAVEL_PENALTY_PER_HOUR * reach
        key = (round(objective, 6), -round(reach, 6), anchor.slug)
        # Higher objective, then shorter reach, then alphabetical anchor (reverse compare).
        if best is None or (key[0], key[1]) > (best[0][0], best[0][1]) or (
            (key[0], key[1]) == (best[0][0], best[0][1]) and key[2] < best[0][2]
        ):
            best = (key, placed, access, dropped)

    if best is None:
        mode = "drive" if settings.transport == "car" else "fly"
        raise PlanningError(
            f"We couldn't find destinations open in {month_name} that you can comfortably "
            f"{mode} to from {settings.origin.name} within a {settings.duration_days}-day trip. "
            "Try a longer trip, a different month, or the other travel method."
        )

    _, placed, access, dropped = best
    return _finalize(settings, members, eligible, experiences, scores, placed, access, dropped)


def _finalize(
    settings: PartySettings,
    members: list[MemberProfile],
    eligible: list[Experience],
    all_experiences: list[Experience],
    scores: dict[tuple[int, str], MatchScore],
    placed: list[PlannedStop],
    access: _Access,
    dropped: list[Experience],
) -> Plan:
    month_name = MONTH_NAMES[settings.month - 1]
    region_counts: dict[str, int] = {}
    for p in placed:
        region_counts[p.experience.region] = region_counts.get(p.experience.region, 0) + 1
    primary_region = max(region_counts, key=lambda r: (region_counts[r], -[p.experience.region for p in placed].index(r)))
    region_name = REGION_BY_ID[primary_region].name

    # --- per-member recommendation
    picks: dict[int, tuple[Experience | None, MatchScore]] = {}
    for m in members:
        best_stop: PlannedStop | None = None
        for p in placed:
            s = scores[(m.id, p.experience.slug)]
            if s.suitable and (best_stop is None or s.score > scores[(m.id, best_stop.experience.slug)].score):
                best_stop = p
        if best_stop:
            picks[m.id] = (best_stop.experience, scores[(m.id, best_stop.experience.slug)])
        else:
            picks[m.id] = (None, MatchScore(0.0))

    recs: list[MemberRecommendation] = []
    placed_slugs = {p.experience.slug for p in placed}
    for m in members:
        exp, match = picks[m.id]
        unmet: list[str] = []
        covered_cultures = {c for p in placed for c in p.experience.culture_ids}
        missing_cultures = [c for c in m.cultures if c not in covered_cultures]
        if missing_cultures:
            unmet.append(
                f"No stop on this route highlights {_join([CULTURE_ADJ[c] for c in missing_cultures])} "
                f"influences in {month_name}."
            )
        covered_tags = {t for p in placed for t in p.experience.tag_ids}
        missing_tags = [INTEREST_LABEL[t] for t in m.interests if t not in covered_tags]
        if missing_tags:
            unmet.append(f"Interests not covered on this route: {', '.join(missing_tags)}.")
        if m.preferred_region and m.preferred_region not in region_counts:
            unmet.append(
                f"{m.name} preferred {REGION_BY_ID[m.preferred_region].name}, but the shared trip is "
                f"centred in {region_name} to keep travel practical for the whole group from "
                f"{settings.origin.name} in {settings.duration_days} day"
                f"{'s' if settings.duration_days != 1 else ''}."
            )
        # Best match anywhere in season, to suggest a future trip.
        alt = max(
            (e for e in eligible if e.slug not in placed_slugs and scores[(m.id, e.slug)].suitable),
            key=lambda e: (scores[(m.id, e.slug)].score, e.slug), default=None,
        )
        if alt is not None and scores[(m.id, alt.slug)].score > match.score:
            unmet.append(
                f"{m.name}'s strongest match overall is {alt.name} ({alt.city}, {alt.province}) — "
                "worth saving for a future trip."
            )

        if exp is None:
            explanation = (
                f"None of the destinations on this route closely match {m.name}'s selected interests "
                f"or cultural preferences, so we haven't forced a recommendation. {m.name} is warmly "
                "welcome at every shared stop, and the notes below suggest better-suited destinations."
            )
        else:
            shared = [o.name for o in members if o.id != m.id and picks[o.id][0] is not None and picks[o.id][0].slug == exp.slug]
            explanation = explain(m, exp, match, shared)
        recs.append(MemberRecommendation(m, exp, match, explanation, unmet))

    # --- travel summary
    travel = dict(access.travel)
    legs_km = sum(p.km_from_previous for p in placed)
    last = placed[-1].experience
    return_km = geo.road_km(last.latitude, last.longitude, access.start_lat, access.start_lon)
    first_leg_h = placed[0].hours_from_previous
    travel.update({
        "origin": {"city": settings.origin.name, "province": settings.origin.province,
                   "latitude": settings.origin.latitude, "longitude": settings.origin.longitude},
        "ground_km": round(legs_km + return_km, 1),
        "outbound_hours": round(access.offset_hours + first_leg_h, 1),
        "return_hours": round(access.offset_hours + geo.drive_hours(return_km), 1),
        "return_km": round(return_km, 1),
        "return_label": access.start_label,
    })
    considerations = [
        "Distances are straight-line estimates multiplied by 1.25 for road detours, at an average "
        "80 km/h. Real driving routes and times will differ — check a routing service before you go.",
    ]
    if travel["effective_method"] == "plane":
        a, b = travel["origin_airport"], travel["arrival_airport"]
        considerations.append(
            f"Flight assumes service between {a['city']} ({a['code']}) and {b['city']} ({b['code']}); "
            "a direct route may not exist in your month, and connections can add time. Check airline schedules."
        )
        considerations.append(f"A rental car is assumed for getting around from {b['city']}.")
    if travel.get("no_flight_reason"):
        considerations.append(travel["no_flight_reason"])
    if any(p.experience.visit_duration_hours >= 4 for p in placed):
        considerations.append("Some stops are half-day visits; arrive early to make the most of them.")
    travel["considerations"] = considerations

    notes: list[str] = []
    closed = len(all_experiences) - len(eligible)
    if closed:
        plural = closed != 1
        notes.append(
            f"{closed} destination{'s are' if plural else ' is'} closed to visitors in {month_name} "
            f"and {'were' if plural else 'was'} not considered."
        )
    for d in dropped:
        notes.append(f"{d.name} was a good match but couldn't fit into the schedule without rushing.")
    notes.append("Opening hours and seasonal programs change — confirm with each destination before visiting.")

    return Plan(placed, recs, primary_region, travel, notes)


def _join(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + f" and {items[-1]}"


def city_or_none(city_id: str) -> City | None:
    return CITY_BY_ID.get(city_id)
