"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from . import config
from .api.routes import router
from .db import SessionLocal, init_db
from .seed import load_dataset, seed

log = logging.getLogger("canadian_roots")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if config.SEED_ON_STARTUP:
        with SessionLocal() as session:
            result = seed(session, load_dataset())
        log.warning("Seeded destinations on startup: %s", result)
    yield


app = FastAPI(title="Canadian Roots API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=config.CORS_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


def _friendly_field(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    if len(parts) >= 3 and parts[0] == "members" and parts[1].isdigit():
        return f"Traveller {int(parts[1]) + 1} — {parts[2].replace('_', ' ')}"
    return " → ".join(p.replace("_", " ") for p in parts) or "request"


@app.exception_handler(RequestValidationError)
async def validation_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": _friendly_field(tuple(e.get("loc", ()))),
         "message": str(e.get("msg", "Invalid value")).removeprefix("Value error, ")}
        for e in exc.errors()
    ]
    summary = "; ".join(f"{e['field']}: {e['message']}" for e in errors[:3])
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        content={"detail": f"Please check your details — {summary}", "errors": errors})


@app.exception_handler(SQLAlchemyError)
async def db_handler(_req: Request, exc: SQLAlchemyError) -> JSONResponse:
    log.exception("Database error", exc_info=exc)
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content={"detail": "Our trip database is unavailable right now. Please try again."})


@app.exception_handler(Exception)
async def fallback_handler(_req: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content={"detail": "Something went wrong on our side. Please try again."})
