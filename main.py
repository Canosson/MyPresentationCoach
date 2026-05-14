"""
Demo launcher for MyPresentationCoach.

What it does:
  1. Warms the Railway Python service (avoids cold-start during the demo)
  2. Generates a fresh magic-link login via the Supabase Admin API
  3. Opens the browser directly to the authenticated upload page

Setup:
  Secrets are read from demo.env (gitignored). Copy demo.env.example to
  demo.env and fill in SUPABASE_SERVICE_ROLE_KEY.

Usage:
    python3 main.py
"""

import json
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://zukhknjsaobragzuuegd.supabase.co"
APP_URL      = "https://web-sigma-eight-17.vercel.app"
RAILWAY_URL  = "https://mypresentationcoach-python-production.up.railway.app"

# ── Load secrets from demo.env ────────────────────────────────────────────────

def _load_demo_env() -> dict:
    env_file = Path(__file__).parent / "demo.env"
    if not env_file.exists():
        sys.exit(
            "demo.env not found. Copy demo.env.example to demo.env and fill in "
            "SUPABASE_SERVICE_ROLE_KEY."
        )
    result = {}
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result

_env = _load_demo_env()
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or _env.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEMO_EMAIL   = os.environ.get("DEMO_EMAIL") or _env.get("DEMO_EMAIL", "")

if not SERVICE_KEY:
    sys.exit("SUPABASE_SERVICE_ROLE_KEY not set in demo.env or environment.")
if not DEMO_EMAIL:
    sys.exit("DEMO_EMAIL not set in demo.env or environment.")

# ── Helpers ───────────────────────────────────────────────────────────────────

def curl_get(url: str) -> dict:
    r = subprocess.run(
        ["curl", "-sf", url],
        capture_output=True, text=True, timeout=15,
    )
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout else {}


def curl_post(url: str, data: dict, headers: dict) -> dict:
    header_args = []
    for k, v in headers.items():
        header_args += ["-H", f"{k}: {v}"]
    r = subprocess.run(
        ["curl", "-sf", "-X", "POST", url, *header_args, "-d", json.dumps(data)],
        capture_output=True, text=True, timeout=15,
    )
    if not r.stdout:
        raise RuntimeError(f"curl returned nothing (exit {r.returncode}): {r.stderr[:200]}")
    return json.loads(r.stdout)


def warm_railway() -> bool:
    return curl_get(f"{RAILWAY_URL}/health").get("status") == "ok"


def generate_magic_link() -> str:
    data = curl_post(
        f"{SUPABASE_URL}/auth/v1/admin/generate_link",
        data={
            "type": "magiclink",
            "email": DEMO_EMAIL,
            "redirect_to": f"{APP_URL}/auth/callback",
        },
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "apikey": SERVICE_KEY,
            "Content-Type": "application/json",
        },
    )
    link = data.get("action_link")
    if not link:
        raise RuntimeError(f"No action_link in response: {data}")
    return link

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("MyPresentationCoach — demo launcher")
    print("─" * 38)

    print("  Warming Railway audio service...", end=" ", flush=True)
    print("ok" if warm_railway() else "cold (first request may take ~10s)")

    print("  Generating sign-in link...", end=" ", flush=True)
    try:
        url = generate_magic_link()
    except Exception as exc:
        print(f"\n  Error: {exc}", file=sys.stderr)
        sys.exit(1)
    print("done")

    print(f"\n  Opening browser → {APP_URL}")
    print("  Upload demo-clip.mp4 from your Desktop, then click Analyze.\n")
    webbrowser.open(url)


if __name__ == "__main__":
    main()
