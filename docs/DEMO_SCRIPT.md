# Demo Script — 6-Minute Presentation

The bootcamp brief says: start with a hook, demo first, then slides, then learnings and future work. Budget below assumes 6:00 total.

## Time budget

| Segment | Duration | Cumulative |
|---|---|---|
| Hook | 0:25 | 0:25 |
| The problem (slides) | 0:45 | 1:10 |
| Live demo | 2:00 | 3:10 |
| How it's built (slides) | 1:30 | 4:40 |
| Challenges + learnings | 0:45 | 5:25 |
| What's next | 0:25 | 5:50 |
| Buffer | 0:10 | 6:00 |

## The opening hook (0:25)

Pick ONE of these, rehearse it cold:

**Option A — Anecdote:**
> "Three months ago I recorded a video application for a job I really wanted. I never heard back. A friend who works in recruiting watched the same video and told me in five seconds what went wrong: my laptop camera was angled up at me, my background looked like a college dorm, and my voice trailed off at the end of every answer. The AI grading system didn't tell me any of that. It legally can't anymore. So I built the tool I wish I'd had."

**Option B — Bold statement:**
> "HireVue used to grade you on your face, your eye contact, and your tone of voice. After lawsuits and FTC complaints, they removed all of it. But here's the catch — human recruiters still watch the videos. Candidates are walking into interviews blindfolded. I built MyPresentationCoach to fix that."

**Option C — Rhetorical question:**
> "Quick question: how do you look on camera right now? Not what you sound like, not what you say — how you LOOK. If you're job-hunting in 2026, that question matters more than ever, and almost no one can answer it. Today I'll show you a tool that can."

Pick whichever feels least awkward to say out loud. Practice 5 times before the real thing.

## The problem (0:45)

One slide. Three beats:

1. **The setup** — Video interviews are now standard. Companies like HireVue used to score candidates on face, body language, and tone.
2. **The retreat** — Lawsuits and the FTC forced them to stop. Today their AI only reads the transcript of what you said.
3. **The gap** — But human recruiters still watch the recording. Candidates have no feedback loop on the visual half of the interview.

Land the line: *"This is a gap I'm legally allowed to fill — because I'm building for the candidate, not the employer."*

## The live demo (2:00)

Have the production URL open in a clean browser, already logged in, sitting on the upload page. Don't show login — that costs 30 seconds and isn't the point.

1. *(0:00)* "Here's the tool. I've already logged in. I'm going to upload a 10-second clip I recorded earlier of myself doing a sample answer."
2. *(0:10)* Drag the video onto the upload zone. Click Analyze.
3. *(0:15)* "While it's running, I want to point out what's happening behind the scenes. Two AI services are working in parallel — one analyzing what you can see in the video, one analyzing how my voice sounds. The whole thing takes about 20 seconds."
4. *(0:35)* "And here's the report."
5. *(0:40)* Walk through 3 of the 6 cards, NOT all 6 — pick the most interesting ones for your specific clip. For each:
   - Read the dimension name and score
   - Read the observation
   - Read the fix
   - Add one sentence of color: *"Notice how it's not just a score — it tells me exactly what it saw, and exactly what to do next time. That's the Glass Box principle: no mystery rankings."*
6. *(1:50)* Scroll briefly to show the remaining cards exist.
7. *(2:00)* "That's the product."

If anything goes wrong: don't fight it. Smoothly say *"the live deploy is being grumpy, I have a backup recording"* and play the pre-recorded demo video. Lose 10 seconds, not 90.

## How it's built (1:30)

Three slides max. Keep it visual.

**Slide 1 — Architecture diagram**
Show the ASCII diagram from ARCHITECTURE.md (or redraw it cleaner). One line:
> "Next.js handles the user and orchestration. A Python service handles audio because Python has the better libraries for it. Both call out to Gemini for the visual part."

**Slide 2 — The subagents**
List the 6 build-time subagents. One line about the PM:
> "I didn't write this code line by line. I used Claude Code with six specialized subagents — a Project Manager that delegates, plus five specialists each focused on one part of the stack. The PM read a plan I wrote, broke it into tasks, and assigned them to the right specialist. I reviewed, didn't implement."

This is the line the bootcamp is grading you on. Land it cleanly.

**Slide 3 — Tech stack with one line each**
- Next.js 14 (App Router) — first time using it, deployed on Vercel
- FastAPI + librosa — audio extraction and analysis
- Supabase — Postgres, Auth, Storage
- Gemini 2.0 Flash — visual analysis, free tier
- Railway — Python service host

## Challenges and learnings (0:45)

Pick THREE. Honest ones land best. Examples to choose from:

- *"Two services means two failure modes. I spent real time making the report degrade gracefully when one of them fails, rather than just crashing."*
- *"Next.js was new. The App Router model of server vs client components took half a day to internalize. The subagent for the frontend kept reminding me when I was about to mix them up."*
- *"The hardest part wasn't code — it was deciding what NOT to build. Emotion detection would've been the flashy demo, but it's illegal in the EU and the science doesn't hold up. The pivot to coaching-not-judging is the project's real foundation."*
- *"Designing the PM subagent to actually delegate, not just write code itself, took a few iterations. Saying 'NEVER write code yourself' in the system prompt was the breakthrough."*
- *"Free tier limits made me think hard about caching. I left hooks for it but didn't ship it. Real-world deployment would need that."*

## What's next (0:25)

The brief asks for this explicitly. Pick 2–3:

- A conversational AI interviewer that asks follow-up questions in real-time
- AI-rewritten answer suggestions when the report flags weak structure
- Progress tracking across multiple practice sessions to show improvement over time
- Multi-language support
- A native mobile app for practicing on the go

Close with one sentence:
> "The bigger idea is that AI in hiring should be a tool the candidate uses on themselves, not a black box used on the candidate. That's the direction I'd want to take this."

## Backup plan if live demo fails

Pre-recorded screen capture of the happy path, on your laptop, ready to play in QuickTime / VLC at a one-click distance. If the live demo dies, you say *"the live URL is being grumpy, let me show you the recorded version"* and you don't miss a beat.

Rehearse the FAILURE path too. The fastest way to recover is to have rehearsed recovering.

## Final-day checklist (30 min before)

- [ ] Production URL works end-to-end (run the smoke test from TEST_PLAN.md)
- [ ] Logged into demo account in your demo browser
- [ ] Browser zoom set so the report fits on screen without scrolling much
- [ ] Backup demo video open in a separate window
- [ ] Slides open in a separate window
- [ ] Phone on silent
- [ ] Water nearby
- [ ] Notifications off (no Slack popups during the demo)
- [ ] Stopwatch or timer visible to you, not to audience

## Things to avoid saying

- "Hopefully this works" — don't telegraph nerves
- "It's just an MVP" — undermines what you built
- "I didn't have time to..." — save it for the "what's next" slide where it's framed positively
- "The AI thinks you're nervous" — never. This product does not infer mental states. Don't accidentally say it does during the demo.
- Anything that implies emotion or personality scoring. The legal framing matters; stay disciplined.
