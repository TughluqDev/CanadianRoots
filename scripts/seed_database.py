from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import config
from app.db import SessionLocal, engine, init_db
from app.seed import load_dataset, seed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="drop all tables (clears saved parties and trips)")
    args = parser.parse_args()

    if args.reset:
        from app.db import Base
        from app import models

        Base.metadata.drop_all(engine)
        print("Dropped all tables.")
    init_db()
    dataset = load_dataset()
    with SessionLocal() as session:
        result = seed(session, dataset)
    print(f"Seeded {config.DATABASE_URL}: {result}")


if __name__ == "__main__":
    main()
