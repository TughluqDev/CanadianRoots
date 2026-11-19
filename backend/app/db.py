"""Database engine/session setup. Schema is created with ``Base.metadata.create_all``
(documented initialization strategy; the schema is small and seeded idempotently)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_dir(url: str) -> None:
    """Create the folder for a file-based SQLite database (e.g. a freshly mounted disk)."""
    path = make_url(url).database
    if path and path != ":memory:":
        Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def make_engine(url: str) -> Engine:
    sqlite = url.startswith("sqlite")
    if sqlite:
        _ensure_sqlite_dir(url)
    connect_args = {"check_same_thread": False, "timeout": 15} if sqlite else {}
    engine = create_engine(url, connect_args=connect_args)
    if sqlite:
        file_based = make_url(url).database not in (None, "", ":memory:")

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record) -> None:  # noqa: ANN001
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            if file_based:
                # Readers don't block the writer, which suits a single hosted instance.
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA synchronous=NORMAL")
            cur.close()

    return engine


engine = make_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(bind: Engine | None = None) -> None:
    from . import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind or engine)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
