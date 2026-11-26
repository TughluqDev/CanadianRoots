from __future__ import annotations

from dataclasses import dataclass, field

from ..domain import AIRPORT_CITIES, CITY_BY_ID, CULTURE_ADJ, INTEREST_LABEL, MONTH_NAMES, REGION_BY_ID, City
from ..models import Experience
from . import geo
from .scoring import MatchScore, MemberProfile, explain, is_in_season, score_member

DAY_HOURS = 10.0
CLUSTER_RADIUS_KM = 320.0
MAX_GROUND_FROM_AIRPORT_HOURS = 3.5
AIRPORT_TRANSFER_HOURS = 0.75
MAX_STOPS_PER_DAY = 3
MAX_STOPS_PER_AREA = 6
COVERAGE_BONUS = 15.0
TRAVEL_PENALTY_PER_HOUR = 3.0
LONG_DRIVE_DAYS = 2


class PlanningError(Exception):
    pass


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
    home: bool = False


@dataclass
class _Hop:
    total_hours: float
    ground_km: float
    drive_km: float
    drive_hours: float
    label: str
    flight: dict | None = None


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
        return drive
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


def _schedule(
    legs: list[tuple[Experience, _Hop]], home: _Hop
) -> tuple[list[PlannedStop], list[dict], int]:
    placed: list[PlannedStop] = []
    segments: list[dict] = []
    day, used, count = 1, 0.0, 0

    def travel(remaining: float, before_stop: str | None, flight: dict | None) -> None:
        nonlocal day, used, count
        elapsed = 0.0
        while remaining > 1e-8:
            portion = min(remaining, DAY_HOURS - used)
            if portion <= 1e-8:
                day, used, count = day + 1, 0.0, 0
                continue
            segment = {"day": day, "hours": round(portion, 2), "before_stop": before_stop}
            if flight and elapsed <= flight["to_airport_hours"] < elapsed + portion:
                segment["flight"] = {"from": flight["from"]["code"], "to": flight["to"]["code"]}
            segments.append(segment)
            elapsed += portion
            used += portion
            remaining -= portion

    for exp, hop in legs:
        if count and (count == MAX_STOPS_PER_DAY or used + hop.total_hours + exp.visit_duration_hours > DAY_HOURS):
            day, used, count = day + 1, 0.0, 0
        travel(hop.total_hours, exp.slug, hop.flight)
        if used + exp.visit_duration_hours > DAY_HOURS + 1e-8:
            day, used, count = day + 1, 0.0, 0
        used += exp.visit_duration_hours
        count += 1
        placed.append(PlannedStop(exp, day, count, round(hop.drive_km, 1), round(hop.drive_hours, 2), hop.label))

    travel(home.total_hours, None, home.flight)
    return placed, segments, day


class _Selector:

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
            max(0.0, self.scores[(member_id, e.slug)].score - best)
            for member_id, best in best_for.items() if self.scores[(member_id, e.slug)].suitable
        )

    def _group_value(self, e: Experience) -> float:
        return self._gain(e, dict.fromkeys(self.best_for, 0.0))

    def _pick(self, cluster: list[Experience], anchor: Experience, limit: int,
              preferred: dict[int, float]) -> tuple[list[Experience], dict[int, float], float]:
        chosen: list[Experience] = []
        best_for = dict(self.best_for)
        regional_best = dict(preferred)
        pool = list(cluster)
        while pool and len(chosen) < limit:
            cand = max(pool, key=lambda e: (
                self._gain(e, regional_best), self._gain(e, best_for),
                self._group_value(e), e.slug == anchor.slug, e.slug,
            ))
            if self._gain(cand, regional_best) <= 0 and self._gain(cand, best_for) <= 0:
                break
            chosen.append(cand)
            pool.remove(cand)
            for member_id in best_for:
                score = self.scores[(member_id, cand.slug)]
                if score.suitable:
                    best_for[member_id] = max(best_for[member_id], score.score)
                    if member_id in regional_best:
                        regional_best[member_id] = max(regional_best[member_id], score.score)
        return chosen, best_for, sum(regional_best.values())

    def best_area(self, candidates: list[Experience], limit: int, *, region: str | None = None) -> list[Experience] | None:
        preferred = {m.id: 0.0 for m in self.members if region is not None and m.preferred_region == region}
        limit = min(limit, MAX_STOPS_PER_AREA)

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
                chosen, best_for, regional_score = self._pick(cluster, anchor, limit, preferred)
                if not chosen:
                    continue
                objective = sum(
                    best_for[m.id] - self.best_for[m.id] + (COVERAGE_BONUS if best_for[m.id] > 0 >= self.best_for[m.id] else 0.0)
                    for m in self.members
                ) - TRAVEL_PENALTY_PER_HOUR * hop.total_hours
                key = (regional_score, round(objective, 6), -round(hop.total_hours, 6))
                if best is None or key > best[0] or (key == best[0] and anchor.slug < best[1]):
                    best = (key, anchor.slug, chosen, best_for)
            return best

        best = search(True) or search(False)
        if best is None and region is not None:
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

    wanted_regions = list(dict.fromkeys(m.preferred_region for m in members if m.preferred_region))
    areas: list[list[Experience]] = []
    for region in wanted_regions:
        in_region = [e for e in eligible if e.region == region]
        if in_region:
            limit = sum(m.preferred_region == region for m in members)
            area = selector.best_area(in_region, limit, region=region)
            if area:
                areas.append(area)
    used = {e.slug for area in areas for e in area}
    remaining_slots = len(members) - len(used)
    if remaining_slots and (not areas or selector.uncovered(eligible)):
        area = selector.best_area([e for e in eligible if e.slug not in used], remaining_slots)
        if area:
            areas.append(area)

    if not areas:
        raise PlanningError(
            f"We couldn't find destinations open in {month_name} that suit your group. "
            "Try a different month or add more interests."
        )

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
                hop = _hop(settings, prev, here)
            else:
                km = geo.road_km(prev.lat, prev.lon, here.lat, here.lon)
                hop = _Hop(geo.drive_hours(km), km, km, geo.drive_hours(km), prev.label)
            legs.append((e, hop))
            prev = here
    home_hop = _hop(settings, prev, home)

    placed, segments, days = _schedule(legs, home_hop)
    return _finalize(settings, members, eligible, experiences, scores, placed, legs, home_hop, segments, days)


def _finalize(
    settings: PartySettings,
    members: list[MemberProfile],
    eligible: list[Experience],
    all_experiences: list[Experience],
    scores: dict[tuple[int, str], MatchScore],
    placed: list[PlannedStop],
    legs: list[tuple[Experience, _Hop]],
    home_hop: _Hop,
    segments: list[dict],
    duration_days: int,
) -> Plan:
    month_name = MONTH_NAMES[settings.month - 1]
    region_counts: dict[str, int] = {}
    for p in placed:
        region_counts[p.experience.region] = region_counts.get(p.experience.region, 0) + 1
    visit_order = [p.experience.region for p in placed]
    primary_region = max(region_counts, key=lambda r: (region_counts[r], -visit_order.index(r)))
    regions = list(dict.fromkeys(visit_order))

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
        alt = max(
            (e for e in eligible if e.slug not in placed_slugs and scores[(m.id, e.slug)].suitable),
            key=lambda e: (scores[(m.id, e.slug)].score, e.slug), default=None,
        )
        if alt is not None and scores[(m.id, alt.slug)].score > match.score:
            unmet.append(
                f"Best match for a future trip: {alt.name} ({alt.city}, {alt.province})."
            )

        if exp is None:
            explanation = (
                f"No stop on this route closely matches {m.name}'s interests or cultural preferences."
            )
        else:
            shared = [o.name for o in members if o.id != m.id and picks[o.id][0] is not None and picks[o.id][0].slug == exp.slug]
            explanation = explain(m, exp, match, shared)
        recs.append(MemberRecommendation(m, exp, match, explanation, unmet))

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
        "segments": segments,
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
            f"This itinerary uses ground transport from {settings.origin.name}."
        )

    considerations = [
        "Driving estimates use straight-line distance × 1.25 and an average speed of 80 km/h. "
        "Check driving directions before you leave.",
    ]
    for f in flights:
        considerations.append(
            f"Check flights from {f['from']['city']} ({f['from']['code']}) to "
            f"{f['to']['city']} ({f['to']['code']}). Connections may add travel time."
        )
    if flights:
        cities = _join(list(dict.fromkeys(f["to"]["city"] for f in flights if f["before_stop"])))
        considerations.append(f"The budget includes a rental car for local travel from {cities}.")
    if travel.get("no_flight_reason"):
        considerations.append(travel["no_flight_reason"])
    if len(regions) > 1:
        considerations.append(
            f"Regions on this trip: {_join([REGION_BY_ID[r].name for r in regions])}."
        )
    long_drives = [e.name for e, h in legs if not h.flight and h.total_hours > LONG_DRIVE_DAYS * DAY_HOURS]
    if long_drives:
        considerations.append(
            f"Allow several days to drive to {_join(long_drives)}."
        )
    if any(p.experience.visit_duration_hours >= 4 for p in placed):
        considerations.append("Some visits take half a day.")
    travel["considerations"] = considerations

    notes: list[str] = []
    closed = len(all_experiences) - len(eligible)
    if closed:
        plural = closed != 1
        notes.append(
            f"{closed} destination{'s are' if plural else ' is'} closed in {month_name}."
        )
    notes.append(
        f"Allow {duration_days} day{'s' if duration_days != 1 else ''} for visits and round-trip travel."
    )
    notes.append("Confirm hours and seasonal programs before you visit.")

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
