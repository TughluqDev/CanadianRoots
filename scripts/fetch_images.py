"""Download the openly licensed (Wikimedia Commons) photos listed in data/researched_experiences.json
into frontend/public/images/experiences/<slug>.<ext> so the app works offline.

Run once during setup (optional — without it the app hotlinks Commons, and falls back to an
illustration if offline). Re-run `python scripts/seed_database.py` afterwards so the database
points at the local copies. Attribution/licence metadata stays in the dataset and is shown in the UI.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "researched_experiences.json"
OUT = ROOT / "frontend" / "public" / "images" / "experiences"
HEADERS = {"User-Agent": "CanadianRootsLocalDemo/1.0 (educational trip-planner demo)"}
ALLOWED_HOST = "https://upload.wikimedia.org/"
EXT_BY_TYPE = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _download(url: str, attempts: int = 5) -> tuple[str, bytes]:
    """GET with exponential backoff on HTTP 429 (Wikimedia rate limiting)."""
    import urllib.error

    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                ctype = resp.headers.get_content_type()
                ext = EXT_BY_TYPE.get(ctype)
                if not ext:
                    raise ValueError(f"unexpected content type {ctype}")
                return ext, resp.read(15_000_000)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == attempts - 1:
                raise
            wait = int(exc.headers.get("Retry-After") or 0) or 15 * (2 ** attempt)
            print(f"    rate limited, waiting {wait}s…")
            time.sleep(min(wait, 120))
    raise RuntimeError("unreachable")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    records = json.loads(DATA.read_text(encoding="utf-8"))["experiences"]
    ok = skipped = failed = 0
    for rec in records:
        img = rec.get("image")
        if not img or not img.get("url", "").startswith(ALLOWED_HOST):
            skipped += 1
            continue
        slug = rec["slug"]
        if any((OUT / f"{slug}.{e}").exists() for e in EXT_BY_TYPE.values()):
            ok += 1
            continue
        try:
            ext, data = _download(img["url"])
            (OUT / f"{slug}.{ext}").write_bytes(data)
            ok += 1
            print(f"  ✓ {slug} ({len(data) // 1024} KB)")
            time.sleep(3)  # be polite to Wikimedia
        except Exception as exc:  # noqa: BLE001 — report and continue
            failed += 1
            print(f"  ✗ {slug}: {exc}")
    print(f"Images: {ok} cached, {skipped} without a Commons photo, {failed} failed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
