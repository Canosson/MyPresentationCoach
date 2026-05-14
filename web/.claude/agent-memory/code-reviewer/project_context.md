---
name: project_context
description: MyPresentationCoach production stack details -- Vercel + Railway + Supabase, auth via Supabase magic link, dual PKCE+implicit callback
metadata:
  type: project
---

Production stack (as of 2026-05-14):
- Next.js app on Vercel (web-sigma-eight-17.vercel.app -- may rotate)
- Python FastAPI audio service on Railway
- Supabase project: zukhknjsaobragzuuegd (URL may be referenced in docs)
- Auth: Supabase magic link (PKCE flow for normal sign-in; implicit flow for admin-generated links used when email is rate-limited)

The auth callback page (`web/app/auth/callback/page.tsx`) handles both flows client-side.

No automated test suite exists. Smoke tests are manual scripts in `scripts/` and documented in `docs/DEPLOYMENT.md`.

**Why:** Single-developer project, rapid MVP phase. Automated tests are a future concern.
**How to apply:** Do not flag absence of unit tests as critical; flag it as major. Frame test recommendations around the existing smoke-test pattern.
