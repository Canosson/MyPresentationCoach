# Environment Variables

Every variable used across both services, where it comes from, where it's used, and what happens if it's missing.

## Web service (Next.js, deployed to Vercel)

Lives in `/web/.env.local` for development, configured in Vercel's dashboard for production.

| Variable | Where to get it | Used by | If missing |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | Browser + server | App won't connect to Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public | Browser + server | Auth and client queries fail |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | Server only — NEVER expose to browser | Server-side writes fail |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Server only | Visual analysis fails |
| `PYTHON_SERVICE_URL` | Railway deployment URL (e.g. `https://mypresentationcoach-python.up.railway.app`) | Server only | Audio analysis fails, reports return as `partial` |
| `PYTHON_SERVICE_SECRET` | Generate yourself: `openssl rand -hex 32` | Server only | Python service rejects all calls |

The `NEXT_PUBLIC_` prefix matters in Next.js — variables without it are server-only and never bundled into the browser JS. Keep `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `PYTHON_SERVICE_SECRET` strictly server-side.

## Python service (FastAPI, deployed to Railway)

Lives in `/python-service/.env` for development, configured in Railway's dashboard for production.

| Variable | Where to get it | Used by | If missing |
|---|---|---|---|
| `PYTHON_SERVICE_SECRET` | Must exactly match the web service's value | Auth middleware | All requests return 401 |
| `ALLOWED_ORIGINS` | Comma-separated: `https://your-app.vercel.app,http://localhost:3000` | CORS middleware | Browser preflight requests fail |
| `PORT` | Provided automatically by Railway | uvicorn | Service won't bind |

## Local `.env.local` template (for /web)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gemini
GEMINI_API_KEY=AIza...

# Python service (point at local while developing)
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_SECRET=replace-with-openssl-rand-hex-32-output
```

## Local `.env` template (for /python-service)

```bash
PYTHON_SERVICE_SECRET=same-value-as-web-env
ALLOWED_ORIGINS=http://localhost:3000
PORT=8000
```

## Production checklist (before final demo)

- [ ] All Vercel env vars set in Production environment (not just Preview)
- [ ] All Railway env vars set
- [ ] `PYTHON_SERVICE_SECRET` matches exactly between Vercel and Railway
- [ ] `PYTHON_SERVICE_URL` in Vercel points to the production Railway URL (with https://)
- [ ] `ALLOWED_ORIGINS` in Railway includes the production Vercel domain
- [ ] No secrets accidentally committed to git: `git log -p | grep -iE 'key|secret|token|password'` returns nothing suspicious
- [ ] `.env*` files are in `.gitignore`

## Rotation

If a secret leaks during development:

- **Gemini:** revoke at https://aistudio.google.com/apikey, generate a new one, update Vercel
- **Supabase service_role:** Supabase dashboard → Settings → API → Reset. Update Vercel.
- **Supabase anon:** very hard to leak meaningfully (it's client-side by design and protected by RLS), but rotatable in the same place if needed
- **PYTHON_SERVICE_SECRET:** generate new value, update both Vercel and Railway simultaneously (there will be a brief window where calls fail)
