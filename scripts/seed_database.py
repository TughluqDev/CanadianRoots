"""Initialize the SQLite schema and import data/researched_experiences.json (idempotent).

Usage (from the repo root, with the backend virtualenv active):
    python scripts/seed_database.py            # create tables + upsert destinations
    python scripts/seed_database.py --reset    # delete the database file first (clears saved trips)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import config  # noqa: E402
from app.db import SessionLocal, engine, init_db  # noqa: E402
from app.seed import load_dataset, seed  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="drop all tables (clears saved parties and trips)")
    args = parser.parse_args()

    if args.reset:
        from app.db import Base
        from app import models  # noqa: F401

        Base.metadata.drop_all(engine)
        print("Dropped all tables.")
    init_db()
    dataset = load_dataset()
    with SessionLocal() as session:
        result = seed(session, dataset)
    print(f"Seeded {config.DATABASE_URL}: {result}")


if __name__ == "__main__":
    main()
