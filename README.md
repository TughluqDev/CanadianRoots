# Canadian Roots (School Project)

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
./scripts/setup.ps1
./scripts/dev.ps1
```

**macOS / Linux**
```bash
chmod +x scripts/*.sh
./scripts/setup.sh
./scripts/dev.sh
```

Then open **http://localhost:5173**. The API is at http://127.0.0.1:8000, with interactive docs at http://127.0.0.1:8000/docs.

## 3. Manual setup (step by step)

Create the virtual environment from the repository root.

```bash
python -m venv backend/.venv
```

Activate it with `.\backend\.venv\Scripts\Activate.ps1` in PowerShell or `source backend/.venv/bin/activate` on macOS or Linux. Then install the backend dependencies and seed SQLite. You can run the seed again to update destination records by slug.

```bash
pip install -r backend/requirements.txt
python scripts/seed_database.py
```

To cache the destination photos locally, run `python scripts/fetch_images.py` while online.

Start FastAPI from the repository root.

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Open a second terminal at the repository root and start Vite.

```bash
cd frontend
npm install
npm run dev
```

## 4. Running tests

Run the backend tests from the repository root with the virtual environment active.

```bash
cd backend
python -m pytest -q
```

In the frontend directory, run the unit tests and type checks.

```bash
npm test
npm run typecheck
```

Playwright uses the frontend and backend servers, starting them if needed. Install Chromium once, then run the browser suite from the frontend directory.

```bash
npx playwright install chromium
npm run test:e2e
```

The end-to-end suite covers:

- **Scenario A:** 4 travellers drive from Toronto.
- **Scenario B:** a plane trip where one traveller prefers Atlantic Canada.
- **Scenario C:** 3 travellers with overlapping interests share a stop and are charged for it once. This test also edits the cost assumptions.
- Form validation.
- Reloading saved trips.
- Mobile layout with no horizontal scrolling.

## 5. Resetting the demo data

Resetting drops the existing tables, including parties and saved trips, and then seeds the destinations again.

```bash
python scripts/seed_database.py --reset
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

## 7. Hosting (Vercel frontend + Render backend)

The frontend is a static Vite build on **Vercel**. The API runs on **Render**, with the SQLite database file on a Render persistent disk.

**Backend on Render** (`render.yaml` at the repo root is a ready-made Blueprint):

1. Push the repo to GitHub, then in Render choose **New → Blueprint** and select it. This creates the `canadian-roots-api` web service:
   - root directory `backend`, Python 3.12
   - start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - health check `/api/health`
   - a 1 GB disk mounted at `/var/data`, with `DATABASE_URL=sqlite:////var/data/canadian_roots.db`
2. **The disk needs a paid instance (Starter or higher).** On the Free plan there is no disk: the database would be wiped on every deploy or restart, and saved trips lost. A service with a disk runs as a single instance, which is what SQLite needs anyway.
3. Nothing needs to be seeded by hand. On every start the server creates the schema and upserts the 25 destinations from `data/researched_experiences.json`. This never touches saved parties or trips, so data edits ship with each deploy. Set `SEED_ON_STARTUP=false` to turn it off.
4. After the frontend is deployed, set `CORS_ORIGINS` to its URL, e.g. `https://canadian-roots.vercel.app` (comma-separate several; no trailing slash). To also allow Vercel preview deployments, set `CORS_ORIGIN_REGEX`, e.g. `^https://canadian-roots(-[a-z0-9-]+)?\.vercel\.app$`.
5. Back up the database from the service's **Shell** tab, e.g. `python -c "import sqlite3; sqlite3.connect('/var/data/canadian_roots.db').backup(sqlite3.connect('/var/data/backup.db'))"`, then download it over SSH (`scp`). Render also snapshots disks daily.

**Frontend on Vercel:**

1. **Add New → Project**, import the repo, and set **Root Directory** to `frontend`. `frontend/vercel.json` sets the Vite build, the `dist` output, the SPA fallback (so `/journey/12` loads on refresh) and cache headers.
2. Add the environment variable `VITE_API_BASE_URL` = your Render URL, e.g. `https://canadian-roots-api.onrender.com` (no trailing slash). It is baked in at build time, so **redeploy after changing it**.
3. Destination photos in `frontend/public/images` are served by Vercel, and the API returns them as site-relative paths.

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
    planner.py       multi-region areas, flights, day scheduling
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

**Database initialization.** The schema is created with `metadata.create_all`. That is enough for a small demo with an idempotent seed; there are no migrations. The tables use foreign keys with cascades, unique constraints (for example, one row per experience–tag pair and one recommendation per trip–member pair), and check constraints on the transport method, month and pricing status.

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
3. **Areas and regions.** A trip is made of one or more *areas*. An area is a cluster of eligible destinations within 320 km of an anchor destination.
   - **Every preferred region is visited.** Each region a traveller picks gets its own area inside that region, and the whole group travels there together. The group is never squeezed into a single region. If nothing in that region matches anyone's interests, the trip still goes to the stop there that the traveller who picked it would enjoy most. If the region has nothing open that month, the app says so.
   - One more area is chosen anywhere when nobody named a region, or when someone still has no suitable stop.
   - There is no fixed trip length and no hard limit on distance. Every hour of travel to reach an area counts against its score, so nearby areas win unless a farther one suits the group much better.
   - Areas are visited in nearest-neighbour order from home. When travelling by plane, each hop (home to the first area, area to area, last area to home) is flown if the nearest airports differ and flying is faster; otherwise it is driven. An area reached by air should be within a 3.5 h drive of its arrival airport.
4. **Stop selection.** Within each area, stops are added one at a time, always picking the stop that most improves the group's best matches across the whole trip so far. This favours stops that suit several travellers. If only one stop is chosen, a second one the group still enjoys is added.
5. **Scheduling.**
   - Stops are ordered nearest-neighbour from the start point.
   - Each day has a 10-hour budget covering both driving and visits, with at most 3 stops a day. A long drive simply takes extra travel days.
   - **Trip length is calculated automatically:** it is the number of days needed for every stop plus the journey home. Travellers never pick a number of days, and no stop is dropped for lack of time.
6. **Choosing each area.** Each candidate area is scored as: how much it improves each traveller's best score, plus 15 for each traveller it serves for the first time, minus 3 per hour of travel to get there. The highest score wins. Ties are broken by shorter travel, then alphabetically by slug.
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
  - A sample fare per traveller: $80 + $0.085 per km for each flight, rounded to $10. A simple out-and-back trip is therefore $160 + $0.17 per km of one-way distance. Multi-region trips add a flight per hop. This is not a quote, and a direct route may not exist.
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
