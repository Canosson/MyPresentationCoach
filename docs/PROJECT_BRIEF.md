# MyPresentationCoach — Project Brief

## The problem
Companies like HireVue used to analyze candidates' faces, body language, and tone of voice in recorded interview videos. After a wave of lawsuits and FTC complaints, they removed all of that. Today, their AI only reads the *transcript* of what candidates say.

But here's the catch: **human recruiters still watch the videos.** They form impressions in seconds — about how confident you look, whether you make eye contact, how your space is lit, whether your voice carries. Candidates get judged on all of this and have no idea how they're coming across.

That gap is the opportunity. MyPresentationCoach gives candidates a private, transparent rehearsal tool so they can see themselves the way a recruiter will.

## What it does
1. You log in and upload a short practice video — up to 10 seconds of you answering an interview-style question.
2. The system analyzes the video on six dimensions of presentation:
   - **Framing** — are you centered, at eye level, the right distance from the camera?
   - **Lighting** — is your face clearly visible?
   - **Background** — is your space clean or distracting?
   - **Eye contact** — are you looking at the lens or reading off-screen?
   - **Posture** — confident and upright, or slouched?
   - **Vocal presence** — is your voice audible, expressive, and consistent?
3. You get a "Glass Box" report — for each dimension you see a score, exactly what the system observed, and one concrete thing to change next time. No mystery rankings, no opaque grades.

## Why this is different
Most AI tools in this space are black boxes that judge candidates without explanation. MyPresentationCoach flips the model: **it's for the candidate, not the recruiter**, and **it shows its work**. Every score comes with the reasoning behind it.

It also deliberately avoids the territory that got HireVue in trouble — no emotion detection, no lie detection, no personality scoring. Just observable, fixable things about how you present.

## Who benefits
- Job seekers preparing for video interviews
- Career-services coaches at universities
- Returners to the workforce who haven't done video interviews before
- Anyone who has to record themselves on camera for work

## How it's built
A small team of AI subagents, each with a focused role, builds the system collaboratively under a Project Manager agent that delegates and reviews. The product itself runs on a modern web stack — a browser-based interface that calls a vision AI model for the visual analysis and a dedicated audio service for the voice analysis, then merges the results into one clean report.

## Timeline
Two days, solo, deployed live.

## What I'd build with more time
- A conversational AI interviewer that asks follow-up questions in real time
- AI-rewritten answer suggestions when the system notices weak structure
- Progress tracking across multiple practice sessions
- Multi-language support
- Mobile app

## What I won't build (and why)
No emotion recognition, no "honesty" scoring, no personality inference. These are banned in employment contexts under the EU AI Act and they don't actually work — the research on emotion-from-face inference doesn't hold up. Building those features would be both illegal and dishonest. The product stays focused on what's observable and fixable.
