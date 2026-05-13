# Deployment Playbook

End-to-end steps to get MyPresentationCoach live. The `deploy` subagent executes these; this doc is the script.

Deploy in this exact order. Each step depends on the previous one being ready.

## Stage 1 — Supabase (project + schema + auth)

1. Create a new Supabase project at https://supabase.com/dashboard. Note the project URL and keys (`anon` and `service_role`).
2. Open the SQL editor and paste the schema block from `docs/CONTRACTS.md`. Run it. Verify the two tables and the `recordings` storage bucket exist.
3. Go to Authentication → Providers → Email. Confirm "Email" is enabled and "Confirm email" is on. Magic links work via this provider.
4. Authentication → URL Configuration. Set:
   - Site URL: `http://localhost:3000` for now (update after Vercel deploy)
   - Redirect URLs: `http://localhost:3000/auth/callback`
5. Storage → confirm the `recordings` bucket exists, set to private (not public).

**Verify:** in the SQL editor run `select * from public.recordings limit 1;` — should return 0 rows, not an error.

## Stage 2 — Python service to Railway

1. Push the latest code to GitHub including the `/python-service` folder with a working `Dockerfile`.
2. Go to https://railway.app, create a new project from your GitHub repo.
3. Railway will detect the Dockerfile in `/python-service`. In the service settings:
   - Set **Root Directory** to `python-service`
   - Set **Healthcheck Path** to `/health`
4. Add environment variables in the Railway dashboard:
   - `PYTHON_SERVICE_SECRET` — generate via `openssl rand -hex 32`
   - `ALLOWED_ORIGINS` — `http://localhost:3000` (add Vercel URL after Stage 3)
5. Generate a public domain: Settings → Networking → Generate Domain. Copy the URL.

**Verify:** `curl https://<your-railway-url>/health` returns `{"status":"ok"}`.

**Verify ffmpeg:** Railway logs should show ffmpeg installed successfully during build. If not, the Dockerfile is wrong — fix it before moving on, this is the classic Day-2 5-minutes-before-demo failure.

## Stage 3 — Next.js to Vercel

1. Push the latest code to GitHub.
2. Go to https://vercel.com, import the repo.
3. In project settings:
   - Set **Root Directory** to `web`
   - Framework preset should auto-detect as Next.js
4. Add environment variables (all from `docs/ENV.md`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `PYTHON_SERVICE_URL` (the Railway URL from Stage 2)
   - `PYTHON_SERVICE_SECRET` (must match Railway exactly)
5. Deploy. Note the production URL (e.g. `https://mypresentationcoach.vercel.app`).

**Verify:** visit the URL, see the login page. Don't go further yet.

## Stage 4 — Cross-wire production URLs

This is the step everyone forgets and breaks the demo. Now that all three services exist:

1. **Supabase** → Authentication → URL Configuration:
   - Update Site URL to the Vercel production URL
   - Add `https://<vercel-url>/auth/callback` to Redirect URLs (keep localhost too for dev)
2. **Railway** → environment variables:
   - Update `ALLOWED_ORIGINS` to `https://<vercel-url>,http://localhost:3000`
   - Redeploy the Python service for the change to take effect
3. **Vercel** → confirm `PYTHON_SERVICE_URL` uses the production Railway URL with `https://`

## Stage 5 — End-to-end smoke test on production

This must pass before declaring deploy complete.

1. Open the Vercel URL in an incognito window
2. Sign in with a fresh email, click the magic link
3. Upload `docs/test-clip.mp4`
4. Wait for analysis (should complete in 15–25 seconds)
5. Verify all 6 dimensions render with scores, observations, and fixes
6. Refresh the page — report should persist (it's in Postgres now)
7. Go to /recordings — the test recording should appear in the list

If any step fails, fix it before moving on. Don't ship a broken demo.

## Stage 6 — Pre-demo warmup (30 minutes before presenting)

1. Hit `https://<railway-url>/health` to wake the Python service from cold start
2. Run one full end-to-end analysis on the live URL to confirm Gemini hasn't hit a daily limit
3. Verify the latest deploy on Vercel is the one you want to demo (check the commit hash)
4. Have your backup demo video file ready locally in case live demo fails
5. Open the production URL in your demo browser, already logged in, on the upload page

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Login email never arrives | Supabase email rate limit on free tier | Wait 60s, or use a different email |
| "Could not retrieve video from URL" from Python | Signed URL expired (>5min) | Regenerate signed URL in the analyze route |
| Python service returns 401 | `PYTHON_SERVICE_SECRET` mismatch | Verify both Vercel and Railway have identical values |
| Browser preflight fails with CORS error | `ALLOWED_ORIGINS` missing Vercel URL | Update Railway env var, redeploy |
| Gemini returns malformed JSON | Free-tier sometimes flakes | Retry logic should handle; if persistent, check prompt |
| Railway service slow on first call | Cold start | Expected, ~10s. Warmup ping before demo. |
| ffmpeg: command not found | Dockerfile missing apt-get install | Fix Dockerfile, redeploy |
| Vercel build fails on @supabase/ssr | Old Next.js version | Upgrade to Next.js 14+ |
| "Invalid storage path" on upload | RLS or path convention mismatch | Path must start with `recordings/{user_id}/...` |

## Rollback

If a deploy breaks production during the build window:

- **Vercel:** Deployments tab → find a previous green deploy → Promote to Production
- **Railway:** Deployments tab → previous deploy → Redeploy
- **Supabase:** schema changes are not auto-rollback; have a backup SQL ready if you change the schema after Day 1
