"""Runtime configuration read from environment variables (see backend/.env.example)."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


def _load_dotenv() -> None:
    """Minimal .env loader so we don't need python-dotenv as a dependency."""
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'canadian_roots.db').as_posix()}"
)
DATA_FILE: Path = Path(os.environ.get("DATA_FILE", REPO_ROOT / "data" / "researched_experiences.json"))
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
# Folder where locally cached, openly licensed destination photos live (served by Vite).
IMAGE_DIR: Path = REPO_ROOT / "frontend" / "public" / "images" / "experiences"
