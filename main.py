"""
Demo launcher for MyPresentationCoach.

What it does:
  1. Warms the Railway Python service (avoids cold-start during the demo)
  2. Generates a fresh magic-link login via the Supabase Admin API
  3. Opens the browser directly to the authenticated upload page

Usage:
    python3 main.py
"""

import json
import subprocess
import sys
import webbrowser

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://zukhknjsaobragzuuegd.supabase.co"
SERVICE_KEY  = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a2hrbmpzYW9icmFnenV1ZWdkIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY3NDgzNywiZXhwIjoyMDk0MjUwODM3fQ"
    ".VG0HacQtw_xrhwQvB45oK8pMsdy49YpUHdGKlRMs0QI"
)
DEMO_EMAIL   = "ruben.creviser@gmail.com"
APP_URL      = "https://web-sigma-eight-17.vercel.app"
RAILWAY_URL  = "https://mypresentationcoach-python-production.up.railway.app"

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
        ["curl", "-sf", "-X", "POST", url, *header_args,
         "-d", json.dumps(data)],
        capture_output=True, text=True, timeout=15,
    )
    if not r.stdout:
        raise RuntimeError(f"curl returned nothing (exit {r.returncode}): {r.stderr[:200]}")
    return json.loads(r.stdout)


def warm_railway() -> bool:
    result = curl_get(f"{RAILWAY_URL}/health")
    return result.get("status") == "ok"


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
