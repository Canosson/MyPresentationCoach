"""
MyPresentationCoach — Python audio analysis service.

Endpoints
---------
GET  /health          No auth. Railway healthcheck.
POST /analyze-audio   Shared-secret auth. Accepts a Supabase storage path,
                      downloads the recording, extracts audio, computes vocal
                      presence metrics and a 1-5 score.

Auth
----
Every /analyze-audio request must carry one of:
  X-Service-Secret: <PYTHON_SERVICE_SECRET>
  Authorization: Bearer <PYTHON_SERVICE_SECRET>

Environment variables
---------------------
PYTHON_SERVICE_SECRET   Shared secret checked on every /analyze-audio call.
SUPABASE_URL            Supabase project URL (e.g. https://xyz.supabase.co).
SUPABASE_SERVICE_ROLE_KEY  Service-role key — bypasses RLS for storage download.
ALLOWED_ORIGINS         Comma-separated list of allowed CORS origins.
                        Defaults to http://localhost:3000.
PORT                    Bind port. Defaults to 8000 (Railway sets this).
"""

import os
import pathlib
import tempfile
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from python_service.audio import compute_metrics, extract_audio, score_vocal_presence

# ---------------------------------------------------------------------------
# Load .env file if present (manual implementation — python-dotenv not in venv)
# ---------------------------------------------------------------------------

def _load_dotenv(dotenv_path: pathlib.Path) -> None:
    """
    Parse a simple KEY=VALUE .env file and inject missing keys into os.environ.
    Lines starting with '#' and blank lines are ignored.
    Values may optionally be quoted with single or double quotes.
    Does NOT override variables that are already set in the environment.
    """
    if not dotenv_path.exists():
        return
    with dotenv_path.open() as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            # Strip surrounding quotes
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            if key and key not in os.environ:
                os.environ[key] = value


# Try loading from python-service/.env (one directory up from this file)
_SERVICE_DIR = pathlib.Path(__file__).resolve().parent.parent
_load_dotenv(_SERVICE_DIR / ".env")


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(
            f"Required environment variable '{name}' is not set. "
            "Copy python-service/.env.example to python-service/.env and fill in the values."
        )
    return value


def _get_allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate required env vars at startup so a misconfigured deploy fails
    # loudly rather than returning 500 on the first real request.
    try:
        _require_env("PYTHON_SERVICE_SECRET")
        _require_env("SUPABASE_URL")
        _require_env("SUPABASE_SERVICE_ROLE_KEY")
    except RuntimeError as exc:
        # Log to stderr (not stdout — we never log request content to stdout)
        import sys
        print(f"[startup] WARNING: {exc}", file=sys.stderr)
    yield


app = FastAPI(title="MyPresentationCoach Audio Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Service-Secret"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AnalyzeAudioRequest(BaseModel):
    storage_path: str  # e.g. "recordings/user_id/recording_id.mp4"


class AudioMetrics(BaseModel):
    mean_db: float
    std_db: float
    silence_ratio: float
    dynamic_range_db: float
    duration_seconds: float


class AnalyzeAudioResponse(BaseModel):
    dimension: str = "vocal_presence"
    score: int
    observation: str
    fix: str
    metrics: AudioMetrics


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _check_auth(
    x_service_secret: str | None,
    authorization: str | None,
) -> None:
    """
    Accept the shared secret via either:
      X-Service-Secret: <secret>
      Authorization: Bearer <secret>

    Raises HTTP 401 if neither matches.
    """
    expected = os.environ.get("PYTHON_SERVICE_SECRET", "")
    if not expected:
        raise HTTPException(status_code=500, detail="Service secret not configured")

    # Check X-Service-Secret header
    if x_service_secret and x_service_secret == expected:
        return

    # Check Authorization: Bearer <token>
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token == expected:
            return

    raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Railway healthcheck — no auth required."""
    return {"status": "ok"}


@app.post("/analyze-audio", response_model=AnalyzeAudioResponse)
async def analyze_audio(
    body: AnalyzeAudioRequest,
    x_service_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    """
    Download a recording from Supabase Storage, extract audio, compute vocal
    presence metrics and return a scored dimension result.

    Auth: X-Service-Secret or Authorization: Bearer <PYTHON_SERVICE_SECRET>
    """
    _check_auth(x_service_secret, authorization)

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase credentials not configured on this service",
        )

    # The storage path coming from the client is expected to be the path within
    # the bucket, e.g. "user_id/recording_id.mp4".  The bucket is "recordings".
    # Strip a leading "recordings/" prefix if the caller included the bucket name.
    storage_path = body.storage_path
    if storage_path.startswith("recordings/"):
        storage_path = storage_path[len("recordings/"):]

    # Build the Supabase Storage REST URL
    # https://supabase.com/docs/guides/storage/serving/downloads
    download_url = (
        f"{supabase_url}/storage/v1/object/recordings/{storage_path}"
    )

    mp4_tmp: pathlib.Path | None = None
    wav_tmp: pathlib.Path | None = None

    try:
        # ------------------------------------------------------------------
        # 1. Stream-download the video (cap at 25 MB)
        # ------------------------------------------------------------------
        MAX_BYTES = 25 * 1024 * 1024  # 25 MB

        mp4_suffix = pathlib.Path(storage_path).suffix or ".mp4"
        mp4_fd, mp4_tmp_str = tempfile.mkstemp(suffix=mp4_suffix)
        mp4_tmp = pathlib.Path(mp4_tmp_str)
        os.close(mp4_fd)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "GET",
                    download_url,
                    headers={
                        "Authorization": f"Bearer {service_role_key}",
                        "apikey": service_role_key,
                    },
                ) as response:
                    if response.status_code == 404:
                        raise HTTPException(
                            status_code=422,
                            detail="Could not retrieve video from URL — file not found in storage",
                        )
                    if response.status_code != 200:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Could not retrieve video from URL — storage returned {response.status_code}",
                        )

                    bytes_written = 0
                    with mp4_tmp.open("wb") as fh:
                        async for chunk in response.aiter_bytes(chunk_size=65536):
                            bytes_written += len(chunk)
                            if bytes_written > MAX_BYTES:
                                raise HTTPException(
                                    status_code=400,
                                    detail="Video exceeds 25MB limit",
                                )
                            fh.write(chunk)
        except HTTPException:
            raise
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not retrieve video from URL — network error: {exc}",
            )

        # ------------------------------------------------------------------
        # 2. Extract audio to WAV via ffmpeg
        # ------------------------------------------------------------------
        wav_fd, wav_tmp_str = tempfile.mkstemp(suffix=".wav")
        wav_tmp = pathlib.Path(wav_tmp_str)
        os.close(wav_fd)

        try:
            extract_audio(mp4_tmp, wav_tmp)
        except RuntimeError as exc:
            return JSONResponse(
                status_code=500,
                content={"error": "Audio extraction failed", "detail": str(exc)},
            )

        # ------------------------------------------------------------------
        # 3. Compute metrics
        # ------------------------------------------------------------------
        try:
            metrics = compute_metrics(wav_tmp)
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={"error": "Metric computation failed", "detail": str(exc)},
            )

        # ------------------------------------------------------------------
        # 4. Score vocal presence
        # ------------------------------------------------------------------
        score, observation, fix = score_vocal_presence(metrics)

        return AnalyzeAudioResponse(
            dimension="vocal_presence",
            score=score,
            observation=observation,
            fix=fix,
            metrics=AudioMetrics(**metrics),
        )

    except HTTPException:
        raise
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": str(exc)},
        )
    finally:
        # Always clean up temp files, even on exception
        for tmp_path in (mp4_tmp, wav_tmp):
            if tmp_path is not None and tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass


# ---------------------------------------------------------------------------
# Entry point for local development
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("python_service.main:app", host="0.0.0.0", port=port, reload=True)
