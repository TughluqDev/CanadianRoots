# Canadian Roots

*Discover Canada through its land, food, and cultures.*

Canadian Roots is a local web app for planning agritourism trips. You build a travel party and give each person their interests, the cultural influences they want to experience, and an optional preferred region. The app then plans one shared trip using **25 researched, real Canadian destinations**. The trip includes:

- a personalized recommendation and explanation for each traveller
- food spotlights and cultural/agricultural context for each stop
- a day-by-day itinerary
- a map of the stops
- an itemized budget in Canadian dollars that you can adjust

Everything runs on your own computer: FastAPI and SQLite for the backend, React and Vite for the frontend. No accounts, no paid APIs, and no AI calls while the app runs.

---

## 1. Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Python | 3.12 | 3.11+ should work |
| Node.js | 24 (npm 11) | 20+ should work |
| Internet | setup only | needed for packages and (optionally) caching photos |

## 2. Quick start

**Windows (PowerShell)**
```powershell
./scripts/setup.ps1     # venv + deps, cache photos, seed SQLite, npm install
./scripts/dev.ps1       # starts backend :8000 and frontend :5173
```

**macOS / Linux**
```bash
chmod +x scripts/*.sh
./scripts/setup.sh
./scripts/dev.sh
```

Then open **http://localhost:5173**. The API is at http://127.0.0.1:8000, with interactive docs at http://127.0.0.1:8000/docs.

## 3. Manual setup (step by step)

```bash
# Backend: create a virtual environment and install dependencies
python -m venv backend/.venv
#   Windows:      backend\.venv\Scripts\activate
#   macOS/Linux:  source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Optional: cache the openly licensed Wikimedia Commons photos locally (needs internet)
python scripts/fetch_images.py

# Create the SQLite schema and import data/researched_experiences.json.
# Safe to run again; it updates records by slug and never duplicates them.
python scripts/seed_database.py

# Start FastAPI
cd backend
uvicorn app.main:app --reload --port 8000

# In a second terminal, start Vite
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to :8000)
```

## 4. Running tests

```bash
# Backend: 39 pytest tests (API, scoring, planner, costs, seeding)
cd backend && python -m pytest -q

# Frontend: Vitest + React Testing Library
cd frontend && npm test
cd frontend && npm run typecheck

# End-to-end: Playwright drives the real UI against the real API and database
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e                  # reuses running servers, or starts them
```

The end-to-end suite covers:

- **Scenario A:** 4 travellers drive from Toronto for 3 days.
- **Scenario B:** a plane trip where one traveller prefers Atlantic Canada.
- **Scenario C:** 3 travellers with overlapping interests share a stop and are charged for it once. This test also edits the cost assumptions.
- Form validation.
- Reloading saved trips.
- Mobile layout with no horizontal scrolling.

## 5. Resetting the demo data

```bash
python scripts/seed_database.py --reset   # drops all tables (parties, trips) and re-seeds destinations
```
You can also delete `backend/canadian_roots.db` and run the seed script again.

## 6. What needs an internet connection

| Feature | Offline? |
|---|---|
| Planning, recommendations, itinerary, budget, saved trips | ✅ fully offline |
| Fonts | ✅ bundled via `@fontsource` |
| Destination photos | ✅ once cached by `fetch_images.py`. Otherwise they load from Wikimedia, and a designed illustration is shown when that fails |
| Map tiles (OpenStreetMap) | ❌ online only. Markers still render and a notice explains |
| Official-website and source links | ❌ online only |

---

## Architecture

```
backend/app/
  domain.py          stable IDs: 20 interests, 4 cultures, 5 regions, 24 origin cities
  models.py          SQLAlchemy ORM (Party, PartyMember, MemberPreference, Experience,
                     ExperienceTag, ExperienceCulture, ExperienceSource, Trip, TripStop,
                     TripRecommendation)
  schemas.py         Pydantic request/response contract (mirrored in frontend/src/types/api.ts)
  seed.py            validates the research JSON and upserts it
  services/
    scoring.py       per-member scoring and explanation templates
    planner.py       group-level clustering, feasibility, day scheduling
    costs.py         pure, itemized CAD cost engine
    trips.py         orchestration, persistence, serialization
  api/routes.py      REST endpoints
frontend/src/
  components/builder/   3-step party wizard (React Hook Form + Zod)
  components/journey/   hero, recommendation cards, destination features, map, timeline, budget
  pages/                Home, Plan, Journey, Destinations, Saved journeys
data/researched_experiences.json   25 sourced destinations
scripts/              seed_database.py, fetch_images.py, setup/dev helpers
```

**Database initialization.** The schema is created with `metadata.create_all`. That is enough for a small demo with an idempotent seed; there are no migrations. The tables use foreign keys with cascades, unique constraints (for example, one row per experience–tag pair and one recommendation per trip–member pair), and check constraints on the transport method, trip length, month and pricing status.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status + destination count |
| GET | `/api/preferences`, `/api/regions`, `/api/cities` | vocabularies |
| GET | `/api/experiences?region=&culture=&month=` | browse destinations |
| GET | `/api/experiences/{slug}` | one destination |
| POST / GET / PUT | `/api/parties`, `/api/parties/{id}` | create, read or replace a party |
| POST | `/api/trips/generate` | run the engine for a party → persisted trip |
| GET | `/api/trips`, `/api/trips/{id}` | saved trips |
| PATCH | `/api/trips/{id}/assumptions` | edit cost assumptions and recalculate |
| DELETE | `/api/trips/{id}` | remove a saved trip |

Errors come back as JSON `{ "detail": "<friendly message>" }` with the matching HTTP status: 404 for not found, 422 for validation or planning problems, 503 for database errors. Stack traces are never sent to the browser.

## Recommendation engine (deterministic, no AI)

1. **Season filter.** A destination is excluded if it isn't open in the travel month. A destination whose season is unknown is also excluded.
2. **Per-member score.**
   - +40 if the destination matches any of the traveller's cultural influences, plus 5 more if it matches the destination's *primary* influence.
   - +15 for each matching interest tag.
   - +25 if the destination is in the traveller's preferred region.
   - ±5 adjustment for economy budgets.

   A destination only counts as *suitable* for a traveller if at least one interest or culture matches.
3. **Group clustering.**
   - Each eligible destination is treated as an anchor. Every eligible destination within a radius of it joins its cluster. The radius depends on trip length: 80 km for 1 day, 150, 220, 280, and 320 km for 5 days.
   - A cluster is rejected if the one-way trip there takes too long: 2.5 h for a 1-day trip, then 4.5, 6.5, 8, and 9.5 h for 5 days.
   - For flights: the arrival airport is the one nearest the anchor, and the anchor must be within a 3.5 h drive of it. If that airport is the same as the home airport, the trip is planned as a drive instead.
4. **Stop selection.** Stops are added one at a time, always picking the stop that most improves the group's best matches. This favours stops that suit several travellers, and lightly fills extra days.
5. **Scheduling.**
   - Stops are ordered nearest-neighbour from the start point.
   - Each day has a 10-hour budget covering both driving and visits. The last day also reserves time for the trip home.
   - A stop that doesn't fit is dropped, and the app says so.
6. **Choosing the trip.** Each candidate itinerary is scored as: sum of each traveller's best score, plus 15 for each traveller served, minus 3 per hour of travel to get there. The highest score wins. Ties are broken by shorter travel, then alphabetically by slug.
7. **Recommendations and explanations.**
   - Each traveller is recommended the scheduled stop with their highest score.
   - Explanations are built from templates using that traveller's matches and wording taken from the destination record. Templates rotate between travellers so the text doesn't repeat.
   - If nothing suitable is on the route, no recommendation is forced. The app explains why instead.
   - The app also lists any preferences that weren't met and the traveller's best-matching destination elsewhere.

Distances are straight-line distances × 1.25 at 80 km/h. They are always shown as approximate, and the map draws no route lines.

## Budget assumptions (all editable on the Journey page except where noted)

- **Activities:** published adult price × number of travellers, or a fixed group price.
  - Each stop is counted once, even when several travellers share it.
  - "Demo estimate" prices are clearly labelled.
  - "Price unavailable" stops are left out of the total and flagged.
  - Everyone is priced at the adult rate.
- **Car:** round-trip distance × 9 L/100 km × $1.60/L for each vehicle (5 seats per vehicle), plus $15 per vehicle per day for parking and incidentals. This is a cost for the whole party, not per person.
- **Plane:**
  - A sample round-trip fare per traveller: $160 + $0.17 per km of flight distance, rounded to $10. This is not a quote, and a direct route may not exist.
  - Plus $40 per person for airport transfers, a rental car at $80 per day, and fuel for local driving.
- **Lodging:**
  - Rooms = travellers ÷ 2 per room, rounded up. Nights = trip days − 1.
  - Average nightly rate by region (CAD, demo estimates):
    - Central $185
    - Atlantic $175
    - Prairies $165
    - Northern $245
    - West Coast $215

    Economy budgets use 0.8× these rates; premium uses 1.4×.
  - 15% lodging tax is added.
- **Meals:** $55, $75 or $110 per person per day (economy, moderate, premium). This includes tax and tip. Food spotlights are never assumed to be included in admission.
- **Contingency:** 10% of the subtotal.
- **Taxes:** published activity prices are used as-is. Some are listed before HST/GST, and each destination's pricing note says so.

> Prices are estimates for trip-planning purposes and are not live booking quotes.

## Data & research

See [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md) for the research method, source types, pricing status and known gaps. Every destination record includes its source URLs, the date it was researched, a pricing status (verified, estimate, free or unavailable), and photo author/licence where there is a photo.

## Known limitations

- Coverage is thin in some places: nothing in Newfoundland and Labrador or Nunavut, and the North relies on Dawson City and Inuvik. Some northern cultural labels are loose fits, and these are flagged in the data.
- There is no real routing or live flight, hotel or price data. Everything is a heuristic and labelled that way.
- Seasons for a few sites are approximate because 2027 dates weren't published yet.
- Starting cities are limited to 24 supported Canadian cities with known coordinates.
- Editing a party with `PUT` replaces its members and discards trips generated for the old version. The UI avoids this by creating a new party each time you regenerate.
