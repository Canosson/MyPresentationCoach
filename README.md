# MyPresentationCoach

> Transparent, candidate-facing feedback on how you come across in video interviews — the part HireVue's AI no longer scores, but human recruiters still see.

**Live demo:** _will be added by the deploy subagent after Stage 5 of `docs/DEPLOYMENT.md`_

---

## The problem

Companies like HireVue used to analyze candidates' faces, body language, and tone of voice in recorded interview videos. After privacy lawsuits and FTC complaints, they removed all of it. Today their AI only reads the *transcript* of what candidates say.

But human recruiters still watch the videos. They form impressions in seconds — about framing, lighting, eye contact, vocal presence. Candidates have no feedback loop on the visual half of the interview they're being judged on.

MyPresentationCoach is a candidate-facing tool that gives them that feedback, transparently.

## What it does

You upload a short practice video — up to 10 seconds of you answering an interview-style question. The system analyzes it on six dimensions and returns a **Glass Box report**: every score comes with what the system observed, and one concrete thing to change next time.

The six dimensions:

1. **Framing** — centered, eye-level, appropriate distance from camera
2. **Lighting** — face clearly visible, not backlit or in shadow
3. **Background** — clean, professional, non-distracting
4. **Eye contact** — looking at the lens vs. reading off-screen
5. **Posture** — upright vs. slouched
6. **Vocal presence** — audibility, expressiveness, consistency

No emotion detection. No personality scoring. No lie detection. Only observable, fixable things.

## Architecture

```
┌──────────────────┐
│  Browser         │
│  Next.js (Vercel)│──┐
└──────────────────┘  │
         │            │ direct upload
         │ HTTPS      ▼
         │     ┌──────────────────┐
         │     │   Supabase       │
         │     │  Auth / Postgres │
         │     │  Storage         │
         │     └──────────────────┘
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Next.js server  │────▶│  Gemini 2.0 Flash│
│  /api/analyze    │     │  (visual)        │
│  (orchestrator)  │     └──────────────────┘
│                  │     ┌──────────────────┐
│                  │────▶│  Python service  │
└──────────────────┘     │  (Railway)       │
                         │  audio: librosa  │
                         └──────────────────┘
```

Two services. Next.js handles auth, upload, orchestration, and the visual AI call. A small FastAPI service handles audio extraction and vocal analysis — Python because `librosa` and `ffmpeg` are genuinely the right tools for it. Both analyses run in parallel; results are merged into one report.

Full diagram and reasoning in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Subagents — how this was built

This codebase was built by a small team of Claude Code subagents, each with a focused role. A Project Manager subagent decomposed the build plan, delegated tasks to specialists, and reviewed completed work. I (the developer) acted as reviewer, not implementer.

| Subagent | Responsibility |
|---|---|
| **pm** | Reads the plan, decomposes work, delegates to specialists, reviews output. Never writes code itself. |
| **frontend** | Next.js pages, React components, Tailwind + shadcn/ui, the Glass Box UI |
| **next-backend** | Next.js API routes, Supabase queries, auth middleware, parallel orchestration of Gemini and the Python service |
| **python-service** | FastAPI app, ffmpeg + librosa pipeline, Dockerfile for Railway |
| **ai-integration** | Gemini prompt engineering, response schema, Zod validation, rate-limit defenses |
| **deploy** | Vercel + Railway + Supabase setup, env vars, this README, end-to-end smoke testing |

Each agent's full system prompt lives in `.claude/agents/`.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 14 App Router | New stack for the developer (bootcamp requirement); great Vercel deploy story |
| Styling | Tailwind + shadcn/ui | Speed without compromising on polish |
| Audio service | FastAPI + librosa + ffmpeg | Audio is genuinely better in Python |
| Auth + DB + Storage | Supabase | Three primitives in one product, generous free tier, RLS for per-user isolation |
| Vision AI | Gemini 2.0 Flash | Free tier with native video input — no keyframe extraction needed |
| Web deploy | Vercel | One-command deploy, free tier covers demo |
| Audio service deploy | Railway | Docker-based, ffmpeg installs cleanly, free tier |

## Local development

### Prerequisites

- Node.js 20+
- Python 3.11+
- ffmpeg (`brew install ffmpeg` on macOS)
- Accounts on Supabase, Vercel, Railway, and Google AI Studio

### Setup

```bash
# Clone
git clone https://github.com/<your-username>/mypresentationcoach.git
cd mypresentationcoach

# Web service
cd web
npm install
cp .env.example .env.local  # fill in values per docs/ENV.md
npm run dev                  # http://localhost:3000

# Python service (in a separate terminal)
cd python-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in values
uvicorn main:app --reload --port 8000
```

Then set up Supabase: paste the SQL from `docs/CONTRACTS.md` into the Supabase SQL editor and run it.

### Environment variables

See [`docs/ENV.md`](docs/ENV.md) for the complete reference.

## Deployment

Three free-tier services: Vercel (web), Railway (Python), Supabase (data). Full step-by-step in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

A note on Railway free tier: cold starts take ~10 seconds. If you're demoing this, hit the `/health` endpoint 30 seconds before to warm it up.

## What's deliberately not built

- **Emotion / nervousness / honesty detection** — prohibited under the EU AI Act in employment contexts, and the underlying science doesn't replicate. Building this would be both illegal and dishonest.
- **Appearance commentary** — no comments on age, gender, race, attractiveness, clothing, hair. The Gemini prompt explicitly forbids it.
- **Black-box scoring** — every score is paired with the observation it's based on. No mystery rankings.

These are positions, not omissions. They define what the product is.

## What I'd build next

- **Conversational AI interviewer** — instead of a one-way upload, an AI that asks follow-up questions in real time and adapts to your answers
- **Glass Box for content** — analyze the answer transcript for STAR structure and offer rewritten versions
- **Progress tracking** — multi-session view that shows improvement on each dimension over time
- **Multi-language support** — same analysis, multiple interface languages
- **Mobile app** — practice anywhere

## Project documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — non-technical overview
- [`docs/PLAN.md`](docs/PLAN.md) — the build plan the PM agent works from
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design and reasoning
- [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — DB schema, API shapes, Zod schemas
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — Gemini prompt specification
- [`docs/ENV.md`](docs/ENV.md) — environment variables reference
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — step-by-step deployment playbook
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — manual test plan
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — first-30-minutes setup runbook
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — 6-minute presentation script

## Built in

Two days. Solo. With Claude Code.

## License

MIT.
