from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

InterestId = Literal[
    "cold_weather", "warm_weather", "adventure", "relaxation", "nature", "hiking", "fishing",
    "animals", "farming", "fruit_picking", "cheese", "food_tasting", "cooking", "history",
    "photography", "indigenous_culture", "cultural_festivals", "traditional_crafts",
    "rural_life", "scenic_landscapes",
]
CultureId = Literal["indigenous", "british", "french", "immigrant"]
RegionId = Literal["central", "atlantic", "prairies", "northern", "west_coast"]
TransportMethod = Literal["car", "plane"]
BudgetPreference = Literal["economy", "moderate", "premium"]

INTERESTS: list[tuple[str, str, str]] = [
    ("cold_weather", "Cold Weather", "crisp, cold-weather outings"),
    ("warm_weather", "Warm Weather", "warm-weather days outdoors"),
    ("adventure", "Adventure", "a sense of adventure"),
    ("relaxation", "Relaxation", "slow, relaxing days"),
    ("nature", "Nature", "time in nature"),
    ("hiking", "Hiking", "hiking"),
    ("fishing", "Fishing", "fishing"),
    ("animals", "Animals", "being around animals"),
    ("farming", "Farming", "hands-on farming"),
    ("fruit_picking", "Fruit Picking", "picking fruit straight from the field"),
    ("cheese", "Cheese", "artisan cheese"),
    ("food_tasting", "Food Tasting", "tasting local food"),
    ("cooking", "Cooking", "cooking"),
    ("history", "History", "history"),
    ("photography", "Photography", "photography"),
    ("indigenous_culture", "Indigenous Culture", "Indigenous culture"),
    ("cultural_festivals", "Cultural Festivals", "cultural festivals"),
    ("traditional_crafts", "Traditional Crafts", "traditional crafts"),
    ("rural_life", "Rural Life", "rural life"),
    ("scenic_landscapes", "Scenic Landscapes", "scenic landscapes"),
]
INTEREST_IDS: frozenset[str] = frozenset(i[0] for i in INTERESTS)
INTEREST_LABEL = {i[0]: i[1] for i in INTERESTS}
INTEREST_PHRASE = {i[0]: i[2] for i in INTERESTS}

CULTURES: list[tuple[str, str, str]] = [
    ("indigenous", "Indigenous Influences", "Indigenous"),
    ("british", "British Influences", "British"),
    ("french", "French Influences", "French"),
    ("immigrant", "Immigrant Influences", "immigrant"),
]
CULTURE_IDS: frozenset[str] = frozenset(c[0] for c in CULTURES)
CULTURE_LABEL = {c[0]: c[1] for c in CULTURES}
CULTURE_ADJ = {c[0]: c[2] for c in CULTURES}


@dataclass(frozen=True)
class Region:
    id: str
    name: str
    provinces: tuple[str, ...]
    nightly_rate: float


REGIONS: list[Region] = [
    Region("central", "Central Canada", ("ON", "QC"), 185.0),
    Region("atlantic", "Atlantic Canada", ("PE", "NL", "NS", "NB"), 175.0),
    Region("prairies", "Prairies", ("MB", "SK", "AB"), 165.0),
    Region("northern", "Northern Canada", ("YT", "NT", "NU"), 245.0),
    Region("west_coast", "West Coast", ("BC",), 215.0),
]
REGION_BY_ID = {r.id: r for r in REGIONS}
REGION_IDS: frozenset[str] = frozenset(REGION_BY_ID)
PROVINCE_TO_REGION = {p: r.id for r in REGIONS for p in r.provinces}

PROVINCE_NAMES = {
    "ON": "Ontario", "QC": "Quebec", "PE": "Prince Edward Island", "NL": "Newfoundland and Labrador",
    "NS": "Nova Scotia", "NB": "New Brunswick", "MB": "Manitoba", "SK": "Saskatchewan",
    "AB": "Alberta", "BC": "British Columbia", "YT": "Yukon", "NT": "Northwest Territories",
    "NU": "Nunavut",
}


@dataclass(frozen=True)
class City:
    id: str
    name: str
    province: str
    latitude: float
    longitude: float
    airport: str | None


CITIES: list[City] = [
    City("toronto", "Toronto", "ON", 43.6532, -79.3832, "YYZ"),
    City("ottawa", "Ottawa", "ON", 45.4215, -75.6972, "YOW"),
    City("hamilton", "Hamilton", "ON", 43.2557, -79.8711, None),
    City("london-on", "London", "ON", 42.9849, -81.2453, "YXU"),
    City("kingston", "Kingston", "ON", 44.2312, -76.4860, None),
    City("montreal", "Montréal", "QC", 45.5019, -73.5674, "YUL"),
    City("quebec-city", "Québec City", "QC", 46.8139, -71.2080, "YQB"),
    City("sherbrooke", "Sherbrooke", "QC", 45.4042, -71.8929, None),
    City("halifax", "Halifax", "NS", 44.6488, -63.5752, "YHZ"),
    City("charlottetown", "Charlottetown", "PE", 46.2382, -63.1311, "YYG"),
    City("moncton", "Moncton", "NB", 46.0878, -64.7782, "YQM"),
    City("fredericton", "Fredericton", "NB", 45.9636, -66.6431, "YFC"),
    City("st-johns", "St. John's", "NL", 47.5615, -52.7126, "YYT"),
    City("winnipeg", "Winnipeg", "MB", 49.8951, -97.1384, "YWG"),
    City("regina", "Regina", "SK", 50.4452, -104.6189, "YQR"),
    City("saskatoon", "Saskatoon", "SK", 52.1332, -106.6700, "YXE"),
    City("calgary", "Calgary", "AB", 51.0447, -114.0719, "YYC"),
    City("edmonton", "Edmonton", "AB", 53.5461, -113.4938, "YEG"),
    City("vancouver", "Vancouver", "BC", 49.2827, -123.1207, "YVR"),
    City("victoria", "Victoria", "BC", 48.4284, -123.3656, "YYJ"),
    City("kelowna", "Kelowna", "BC", 49.8880, -119.4960, "YLW"),
    City("whitehorse", "Whitehorse", "YT", 60.7212, -135.0568, "YXY"),
    City("yellowknife", "Yellowknife", "NT", 62.4540, -114.3718, "YZF"),
    City("iqaluit", "Iqaluit", "NU", 63.7467, -68.5170, "YFB"),
]
CITY_BY_ID = {c.id: c for c in CITIES}
AIRPORT_CITIES = [c for c in CITIES if c.airport]

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
]

