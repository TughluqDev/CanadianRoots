from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0
ROAD_DETOUR_FACTOR = 1.25
AVERAGE_DRIVE_KMH = 80.0
FLIGHT_CRUISE_KMH = 750.0
FLIGHT_OVERHEAD_HOURS = 2.0
LOCAL_MIN_KM = 5.0


def great_circle_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = p2 - p1, radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def road_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return max(LOCAL_MIN_KM, great_circle_km(lat1, lon1, lat2, lon2) * ROAD_DETOUR_FACTOR)


def drive_hours(km: float) -> float:
    return km / AVERAGE_DRIVE_KMH


def flight_hours(gc_km: float) -> float:
    return gc_km / FLIGHT_CRUISE_KMH + FLIGHT_OVERHEAD_HOURS
