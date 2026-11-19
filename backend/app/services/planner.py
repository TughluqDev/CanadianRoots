"""Group-level trip planner.

Explainable heuristic (no solver):

1. Filter experiences to those open in the travel month (hard eligibility rule).
2. Score every eligible experience for every member.
3. Build the trip out of one or more *areas*. An area is a compact cluster of nearby eligible
   experiences around an anchor, which keeps each part of the trip geographically coherent.
   - Every region a traveller prefers gets its own area inside that region, so a member who
     asks for Northern Canada really goes there, and the rest of the group comes along.
   - If nobody states a region (or someone is still without a suitable stop), one more area is
     chosen anywhere, wherever it serves the group best.
4. Inside an area, greedily add the stop with the largest *marginal* gain for the group
   (how much it improves each member's best match so far), so shared stops that please several
   people win naturally. Then lightly top up with a stop the group still enjoys.
5. Visit areas in nearest-neighbour order from home. Each hop between areas is driven, or flown
   when travelling by plane and flying is faster.
6. Pack stops into days under a daily hour budget. There is no fixed trip length: the number of
   days is whatever the stops, the travel between them and the journey home actually need.
7. Choosing an area's anchor: highest group gain, with travel time counting against it.
   Ties break deterministically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import ceil

from ..domain import AIRPORT_CITIES, CITY_BY_ID, CULTURE_ADJ, INTEREST_LABEL, MONTH_NAMES, REGION_BY_ID, City
from ..models import Experience
from . import geo
from .scoring import MatchScore, MemberProfile, explain, is_in_season, score_member

DAY_HOURS = 10.0  # travel + activities per day
CLUSTER_RADIUS_KM = 320.0  # max straight-line radius of an area around its anchor
MAX_GROUND_FROM_AIRPORT_HOURS = 3.5
AIRPORT_TRANSFER_HOURS = 0.75  # minimum time to get to (or home from) an airport
MAX_STOPS_PER_DAY = 3
MIN_STOPS = 2  # top up an area to this many stops when the group still enjoys another one
MAX_STOPS_PER_AREA = 6  # sanity cap on itinerary size (not a day limit)
COVERAGE_BONUS = 15.0
TRAVEL_PENALTY_PER_HOUR = 3.0
LONG_DRIVE_DAYS = 2  # warn when one drive takes more than this many full days


class PlanningError(Exception):
    """Raised when no plausible trip can be generated; message is user-facing."""


@dataclass(frozen=True)
class PartySettings:
    origin: City
    transport: str
    month: int
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
    duration_days: int


@dataclass
class _Point:
    lat: float
    lon: float
    label: str
    home: bool = False  # the party's starting city


@dataclass
class _Hop:
    """Getting from one point to the next: driven, or flown then driven."""
    total_hours: float  # door to door, used for scheduling
    ground_km: float  # rental / own-car driving (counts toward fuel)
    drive_km: float  # the final drive shown to the user
    drive_hours: float
    label: str  # where that final drive starts
    flight: dict | None = None


# ----------------------------------------------------------------------------- helpers


def _nearest_airport(lat: float, lon: float) -> City:
    return min(AIRPORT_CITIES, key=lambda c: (geo.great_circle_km(lat, lon, c.latitude, c.longitude), c.id))


def _home_airport(origin: City) -> City:
    return origin if origin.airport else _nearest_airport(origin.latitude, origin.longitude)


def _hop(settings: PartySettings, a: _Point, b: _Point) -> _Hop:
    km = geo.road_km(a.lat, a.lon, b.lat, b.lon)
    h = geo.drive_hours(km)
    drive = _Hop(h, 0.0 if (a.home and b.home) else km, km, h, a.label)
    if settings.transport != "plane":
        return drive
    dep = _home_airport(settings.origin) if a.home else _nearest_airport(a.lat, a.lon)
    arr = _home_airport(settings.origin) if b.home else _nearest_airport(b.lat, b.lon)
    if dep.id == arr.id:
        return drive

    to_dep_km = geo.road_km(a.lat, a.lon, dep.latitude, dep.longitude)
    to_dep_h = max(AIRPORT_TRANSFER_HOURS, geo.drive_hours(to_dep_km))
    flight_km = geo.great_circle_km(dep.latitude, dep.longitude, arr.latitude, arr.longitude)
    flight_h = geo.flight_hours(flight_km)
    from_arr_km = geo.road_km(arr.latitude, arr.longitude, b.lat, b.lon)
    from_arr_h = geo.drive_hours(from_arr_km)
    if b.home:
        from_arr_h = max(AIRPORT_TRANSFER_HOURS, from_arr_h)
    total = to_dep_h + flight_h + from_arr_h
    if total >= h:
        return drive  # flying wouldn't be any faster
    # Getting to/from the airport at home is covered by the airport-transfer cost, not fuel.
    ground = (0.0 if a.home else to_dep_km) + (0.0 if b.home else from_arr_km)
    flight = {
        "from": {"code": dep.airport, "city": dep.name, "province": dep.province},
        "to": {"code": arr.airport, "city": arr.name, "province": arr.province},
        "km": round(flight_km),
        "hours": round(flight_h, 1),
        "to_airport_hours": round(to_dep_h, 1),
    }
    return _Hop(total, ground, from_arr_km, from_arr_h, f"{arr.name} airport ({arr.airport})", flight)


def _point(e: Experience) -> _Point:
    return _Point(e.latitude, e.longitude, e.name)


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


def _centroid(exps: list[Experience]) -> tuple[float, float]:
    return (sum(e.latitude for e in exps) / len(exps), sum(e.longitude for e in exps) / len(exps))


def _schedule(legs: list[tuple[Experience, _Hop]], home: _Hop) -> tuple[list[PlannedStop], int]:
    """Pack stops into days; returns the stops and the number of days the trip needs.

    Long legs (and flights) simply take extra travel days, so nothing is ever dropped for lack
    of time.
    """
    placed: list[PlannedStop] = []
    day, used, count = 1, 0.0, 0
    local_h = geo.drive_hours(geo.LOCAL_MIN_KM)

    for exp, hop in legs:
        remaining = hop.total_hours
        while not (count < MAX_STOPS_PER_DAY and used + remaining + exp.visit_duration_hours <= DAY_HOURS):
            if count == 0:
                if used == 0.0 and remaining <= local_h:
                    break  # a very long visit on its own day: schedule it anyway
                # Nothing planned yet today, so the day is spent travelling toward this stop.
                remaining = max(local_h, remaining - (DAY_HOURS - used))
            day, used, count = day + 1, 0.0, 0
        used += remaining + exp.visit_duration_hours
        count += 1
        placed.append(PlannedStop(exp, day, count, round(hop.drive_km, 1), round(hop.drive_hours, 2), hop.label))

    # The journey home: finish it on the last day if it fits, otherwise add travel days.
    overflow = used + home.total_hours - DAY_HOURS
    if overflow > 0:
        day += ceil(overflow / DAY_HOURS)
    return placed, day


# -------------------------------------------------------------------------- the planner


class _Selector:
    """Chooses areas, remembering each member's best match so far across the whole trip."""

    def __init__(self, settings: PartySettings, members: list[MemberProfile],
                 scores: dict[tuple[int, str], MatchScore]) -> None:
        self.settings = settings
        self.members = members
        self.scores = scores
        self.best_for: dict[int, float] = {m.id: 0.0 for m in members}
        self.home = _Point(settings.origin.latitude, settings.origin.longitude,
                           f"{settings.origin.name}, {settings.origin.province}", home=True)

    def _gain(self, e: Experience, best_for: dict[int, float]) -> float:
        return sum(
            max(0.0, self.scores[(m.id, e.slug)].score - best_for[m.id])
            for m in self.members if self.scores[(m.id, e.slug)].suitable
        )

    def _group_value(self, e: Experience) -> float:
        return sum(self.scores[(m.id, e.slug)].score for m in self.members if self.scores[(m.id, e.slug)].suitable)

    def _pick(self, cluster: list[Experience], anchor: Experience) -> tuple[list[Experience], dict[int, float]]:
        chosen: list[Experience] = []
        best_for = dict(self.best_for)
        pool = list(cluster)
        while pool and len(chosen) < MAX_STOPS_PER_AREA:
            cand = max(pool, key=lambda e: (self._gain(e, best_for), self._group_value(e), e.slug == anchor.slug, e.slug))
            if self._gain(cand, best_for) <= 0 and (len(chosen) >= MIN_STOPS or self._group_value(cand) <= 0):
                break
            chosen.append(cand)
            pool.remove(cand)
            for m in self.members:
                s = self.scores[(m.id, cand.slug)]
                if s.suitable:
                    best_for[m.id] = max(best_for[m.id], s.score)
        return chosen, best_for

    def best_area(self, candidates: list[Experience], *, region: str | None = None) -> list[Experience] | None:
        """Best area among ``candidates``. With ``region`` set, the area must be in that region
        even if nothing there suits anyone (the traveller asked to go there)."""

        def search(airport_filter: bool):
            best = None
            for anchor in candidates:
                hop = _hop(self.settings, self.home, _point(anchor))
                if airport_filter and hop.flight and hop.drive_hours > MAX_GROUND_FROM_AIRPORT_HOURS:
                    continue
                cluster = [
                    e for e in candidates
                    if geo.great_circle_km(anchor.latitude, anchor.longitude, e.latitude, e.longitude) <= CLUSTER_RADIUS_KM
                ]
                chosen, best_for = self._pick(cluster, anchor)
                if not chosen:
                    continue
                objective = sum(
                    best_for[m.id] - self.best_for[m.id] + (COVERAGE_BONUS if best_for[m.id] > 0 >= self.best_for[m.id] else 0.0)
                    for m in self.members
                ) - TRAVEL_PENALTY_PER_HOUR * hop.total_hours
                key = (round(objective, 6), -round(hop.total_hours, 6))
                # Higher objective, then shorter reach, then alphabetical anchor.
                if best is None or key > best[0] or (key == best[0] and anchor.slug < best[1]):
                    best = (key, anchor.slug, chosen, best_for)
            return best

        best = search(True) or search(False)
        if best is None and region is not None:
            # Nothing in the region suits anyone's interests: still go, to the stop the
            # travellers who asked for it would like most.
            wanted = [m for m in self.members if m.preferred_region == region]
            stop = max(candidates, key=lambda e: (
                sum(self.scores[(m.id, e.slug)].score for m in wanted), self._group_value(e), e.slug,
            ))
            return [stop]
        if best is None:
            return None
        _, _, chosen, best_for = best
        self.best_for = best_for
        return chosen

    def uncovered(self, eligible: list[Experience]) -> bool:
        """Someone still has no suitable stop, though a suitable one is open somewhere."""
        return any(
            self.best_for[m.id] <= 0 and any(self.scores[(m.id, e.slug)].suitable for e in eligible)
            for m in self.members
        )


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
    selector = _Selector(settings, members, scores)

    # One area per preferred region (in the order travellers asked for them).
    wanted_regions = list(dict.fromkeys(m.preferred_region for m in members if m.preferred_region))
    areas: list[list[Experience]] = []
    for region in wanted_regions:
        in_region = [e for e in eligible if e.region == region]
        if in_region:
            area = selector.best_area(in_region, region=region)
            if area:
                areas.append(area)
    # Plus the best area anywhere, when nobody named a region or someone is still left out.
    if not areas or selector.uncovered(eligible):
        used = {e.slug for a in areas for e in a}
        area = selector.best_area([e for e in eligible if e.slug not in used])
        if area:
            areas.append(area)

    if not areas:
        raise PlanningError(
            f"We couldn't find destinations open in {month_name} that suit your group. "
            "Try a different month or add more interests."
        )

    # Visit the areas in nearest-neighbour order from home, and each area's stops likewise.
    home = selector.home
    ordered_areas: list[list[Experience]] = []
    cur_lat, cur_lon = home.lat, home.lon
    remaining = list(areas)
    while remaining:
        nxt = min(remaining, key=lambda a: (geo.great_circle_km(cur_lat, cur_lon, *_centroid(a)), a[0].slug))
        remaining.remove(nxt)
        stops = _order_nearest_neighbour(cur_lat, cur_lon, nxt)
        ordered_areas.append(stops)
        cur_lat, cur_lon = stops[-1].latitude, stops[-1].longitude

    legs: list[tuple[Experience, _Hop]] = []
    prev = home
    for stops in ordered_areas:
        for i, e in enumerate(stops):
            here = _point(e)
            if i == 0:
                hop = _hop(settings, prev, here)  # between areas: may be a flight
            else:
                km = geo.road_km(prev.lat, prev.lon, here.lat, here.lon)
                hop = _Hop(geo.drive_hours(km), km, km, geo.drive_hours(km), prev.label)
            legs.append((e, hop))
            prev = here
    home_hop = _hop(settings, prev, home)

    placed, days = _schedule(legs, home_hop)
    return _finalize(settings, members, eligible, experiences, scores, placed, legs, home_hop, days,
                     wanted_regions)


def _finalize(
    settings: PartySettings,
    members: list[MemberProfile],
    eligible: list[Experience],
    all_experiences: list[Experience],
    scores: dict[tuple[int, str], MatchScore],
    placed: list[PlannedStop],
    legs: list[tuple[Experience, _Hop]],
    home_hop: _Hop,
    duration_days: int,
    wanted_regions: list[str],
) -> Plan:
    month_name = MONTH_NAMES[settings.month - 1]
    region_counts: dict[str, int] = {}
    for p in placed:
        region_counts[p.experience.region] = region_counts.get(p.experience.region, 0) + 1
    visit_order = [p.experience.region for p in placed]
    primary_region = max(region_counts, key=lambda r: (region_counts[r], -visit_order.index(r)))
    regions = list(dict.fromkeys(visit_order))

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
    covered_cultures = {c for p in placed for c in p.experience.culture_ids}
    covered_tags = {t for p in placed for t in p.experience.tag_ids}
    for m in members:
        exp, match = picks[m.id]
        unmet: list[str] = []
        missing_cultures = [c for c in m.cultures if c not in covered_cultures]
        if missing_cultures:
            unmet.append(
                f"No stop on this route highlights {_join([CULTURE_ADJ[c] for c in missing_cultures])} "
                f"influences in {month_name}."
            )
        missing_tags = [INTEREST_LABEL[t] for t in m.interests if t not in covered_tags]
        if missing_tags:
            unmet.append(f"Interests not covered on this route: {', '.join(missing_tags)}.")
        if m.preferred_region and m.preferred_region not in region_counts:
            unmet.append(
                f"{m.name} preferred {REGION_BY_ID[m.preferred_region].name}, but none of our "
                f"destinations there are open in {month_name}."
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
    flights = []
    for e, hop in legs:
        if hop.flight:
            flights.append({**hop.flight, "before_stop": e.slug})
    if home_hop.flight:
        flights.append({**home_hop.flight, "before_stop": None})
    first_hop = legs[0][1]
    travel: dict = {
        "method": settings.transport,
        "effective_method": "plane" if flights else "car",
        "origin": {"city": settings.origin.name, "province": settings.origin.province,
                   "latitude": settings.origin.latitude, "longitude": settings.origin.longitude},
        "regions": regions,
        "flights": flights,
        "ground_km": round(sum(h.ground_km for _, h in legs) + home_hop.ground_km, 1),
        "outbound_hours": round(first_hop.total_hours, 1),
        "return_hours": round(home_hop.total_hours, 1),
        "return_km": round(home_hop.drive_km if not home_hop.flight else
                           geo.road_km(placed[-1].experience.latitude, placed[-1].experience.longitude,
                                       *_airport_latlon(home_hop.flight["from"]["code"])), 1),
        "return_label": (f"{home_hop.flight['from']['city']} airport ({home_hop.flight['from']['code']})"
                         if home_hop.flight else f"{settings.origin.name}, {settings.origin.province}"),
        "return_flight": bool(home_hop.flight),
    }
    if flights:
        out = flights[0]
        travel.update({
            "origin_airport": {"code": out["from"]["code"], "city": out["from"]["city"]},
            "arrival_airport": out["to"],
            "flight_km": out["km"],
            "flight_hours": out["hours"],
            "pre_flight_hours": out["to_airport_hours"],
            "total_flight_km": sum(f["km"] for f in flights),
        })
    elif settings.transport == "plane":
        travel["no_flight_reason"] = (
            f"These destinations are within driving distance of {settings.origin.name}, so no flight is "
            "needed; ground transport is estimated instead."
        )

    considerations = [
        "Distances are straight-line estimates multiplied by 1.25 for road detours, at an average "
        "80 km/h. Real driving routes and times will differ — check a routing service before you go.",
    ]
    for f in flights:
        considerations.append(
            f"Flight assumes service between {f['from']['city']} ({f['from']['code']}) and "
            f"{f['to']['city']} ({f['to']['code']}); a direct route may not exist in your month, and "
            "connections can add time. Check airline schedules."
        )
    if flights:
        cities = _join(list(dict.fromkeys(f["to"]["city"] for f in flights if f["before_stop"])))
        considerations.append(f"A rental car is assumed for getting around from {cities}.")
    if travel.get("no_flight_reason"):
        considerations.append(travel["no_flight_reason"])
    if len(regions) > 1:
        considerations.append(
            f"This trip covers {_join([REGION_BY_ID[r].name for r in regions])} so that every "
            "traveller's preferred region is included."
        )
    long_drives = [e.name for e, h in legs if not h.flight and h.total_hours > LONG_DRIVE_DAYS * DAY_HOURS]
    if long_drives:
        considerations.append(
            f"Reaching {_join(long_drives)} takes several days of driving; flying may be more practical."
        )
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
    notes.append(
        f"Trip length is worked out automatically: {duration_days} day{'s' if duration_days != 1 else ''} "
        "covers every stop at a comfortable pace, plus the travel there and back."
    )
    notes.append("Opening hours and seasonal programs change — confirm with each destination before visiting.")

    return Plan(placed, recs, primary_region, travel, notes, duration_days)


def _airport_latlon(code: str) -> tuple[float, float]:
    city = next(c for c in AIRPORT_CITIES if c.airport == code)
    return city.latitude, city.longitude


def _join(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + f" and {items[-1]}"


def city_or_none(city_id: str) -> City | None:
    return CITY_BY_ID.get(city_id)
