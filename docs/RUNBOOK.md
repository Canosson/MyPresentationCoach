# Runbook — Your First 30 Minutes

Follow these in order. Do NOT skip ahead. Do NOT open Claude Code until step 7.

## Prerequisites (check before you start)
- [ ] Node.js 20+ installed (`node --version`)
- [ ] Python 3.11+ installed (`python3 --version`)
- [ ] Git installed and configured with your GitHub account
- [ ] Claude Code installed (`claude --version`)
- [ ] ffmpeg installed locally (`ffmpeg -version`) — on macOS: `brew install ffmpeg`

## Step 1 — Get your API keys ready (5 min)
Open two browser tabs and grab these BEFORE touching code:

1. **Gemini API key** — go to https://aistudio.google.com/apikey, create a key, paste it into a temporary notes file. Verify `gemini-2.0-flash` is available on the free tier in your region.
2. **Supabase project** — go to https://supabase.com, create a new project (free tier), note down:
   - Project URL
   - `anon` public key
   - `service_role` secret key (under Settings → API)
3. **Railway account** — sign up at https://railway.app if you don't have one. No project yet, just the account.
4. **Vercel account** — sign up at https://vercel.com if you don't have one. Link it to your GitHub.

## Step 2 — Drop the prepared files into place (2 min)
The folder you downloaded contains:
```
mypresentationcoach/
├── .claude/agents/  (6 subagent definitions)
├── docs/PLAN.md     (the plan the PM reads)
├── .gitignore
└── README.md
```
Move this folder to wherever you keep code projects. Open a terminal in its root.

## Step 3 — Record your test clip (3 min)
Record a 10-second video of yourself talking — anything, doesn't matter what. Save it as `docs/test-clip.mp4`. The agents will use this for end-to-end testing. Without it, you'll waste 20 minutes later hunting for a sample.

> Note: `docs/test-clip.mp4` is in `.gitignore` — it won't be committed.

## Step 4 — Scaffold Next.js (5 min)
```bash
cd web
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias="@/*"
# When prompted about Turbopack, say no — keeps it simpler for first deploy
cd ..
```

## Step 5 — Scaffold Python service (5 min)
```bash
cd python-service
python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate
pip install --upgrade pip
pip install fastapi uvicorn librosa numpy pydub python-multipart httpx
pip freeze > requirements.txt
deactivate
cd ..
```

## Step 6 — Initialize git and push to GitHub (5 min)
```bash
git init
git add .
git commit -m "scaffold: monorepo with Next.js, FastAPI service, and Claude Code subagents"
```
Now create the GitHub repo (web UI is fastest), then:
```bash
git remote add origin git@github.com:<your-username>/mypresentationcoach.git
git branch -M main
git push -u origin main
```

## Step 7 — Kick off Claude Code (5 min)
From the repo root:
```bash
claude
```

When Claude Code opens, paste this exact prompt as your first message:

> Use the `pm` subagent. It should read `docs/PLAN.md`, then begin executing the TODO list by delegating tasks to the specialist subagents one at a time. The first task is verifying our two foundational dependencies work: (1) the Gemini API key successfully analyzes a sample video, and (2) ffmpeg + librosa successfully extract audio metrics from `docs/test-clip.mp4` locally. Both must succeed before any UI or auth work begins. Update `docs/PLAN.md` after every completed task.

The PM takes over from here. You're now a reviewer, not an implementer.

## What to do when the PM asks for input
The PM will ask you for things like:
- API keys to put in `.env` files
- Supabase schema confirmation
- Approval to move to the next phase

Answer concisely. Don't over-explain. Trust the plan.

## Hard cutoffs to enforce
- **Hour 3:** If Supabase auth isn't working, tell the PM to fake it with a hardcoded demo user and move on.
- **Hour 10 (end of Day 1):** You must have end-to-end JSON output working — login → upload → JSON report appears. UI can be ugly. If not there, cut auth tomorrow.
- **Hour 15:** Deployment must be live with at least 3 hours of buffer before your demo.

## Pre-demo checklist (do these 30 minutes before presenting)
- [ ] Hit the Python service `/health` endpoint to warm it up
- [ ] Run one analysis on the live URL to make sure Gemini hasn't hit a rate limit
- [ ] Have a backup pre-recorded demo video on your laptop in case anything fails live
- [ ] Slides open in a separate window, ready to go
