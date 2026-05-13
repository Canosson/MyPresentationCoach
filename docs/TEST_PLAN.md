# Test Plan

Manual test scenarios the developer (you) walks through before the demo. No automated tests in scope for a 2-day MVP — these are checklist-driven smoke tests.

Run all of these against the **production deployment**, not localhost. Localhost lies.

## Pre-test setup

- Test email account you can receive magic links on
- `docs/test-clip.mp4` — your 10-second sample
- A second test clip: 10 seconds of silence or near-silence (record with mic muted)
- A third test clip: 15+ seconds long (should be rejected)
- Latest production URL

## Happy path

| # | Step | Expected |
|---|---|---|
| 1 | Visit production URL while signed out | Redirected to /login |
| 2 | Enter email, click "Send link" | Confirmation message shown |
| 3 | Click link in email | Redirected to authed home / upload page |
| 4 | Drag `test-clip.mp4` onto the upload zone | File accepted, preview or filename shown |
| 5 | Click "Analyze" | Loading state appears, takes 15–25s |
| 6 | Wait | Glass Box report renders with 6 dimensions |
| 7 | Each card shows | Dimension name, score 1–5 (visual), observation, fix |
| 8 | Click /recordings | The recording appears in the list with status "ready" |
| 9 | Click the recording | The report renders again, identical to step 6 |
| 10 | Refresh the report page | Report still renders (persisted) |
| 11 | Log out and back in | Recording still visible on /recordings |

If any step fails, fix before demo.

## Edge cases

| Scenario | Expected |
|---|---|
| Upload a 15-second video | Client rejects before upload starts, clear error message |
| Upload a 30MB file | Either client or server rejects with size error |
| Upload a .txt file | Client rejects with "video files only" message |
| Upload a silent video | Report renders; vocal_presence score=1, observation about no audible voice |
| Hit /api/analyze with someone else's recording_id | Returns 404 (RLS prevents access) |
| Visit /recordings/[id] for a recording you don't own | 404 |
| Visit /recordings while logged out | Redirected to /login |
| Upload while logged out | Cannot reach upload page in the first place |
| Click "Analyze" twice quickly | Second click is a no-op or returns the same report (idempotent) |

## Failure handling

These deliberately break a piece of the system to verify the UI degrades gracefully.

| Scenario | How to test | Expected |
|---|---|---|
| Python service down | Stop the Railway service temporarily | Report renders with 5 dimensions, marked partial, UI shows "vocal analysis unavailable" |
| Gemini key invalid | Temporarily set wrong key in Vercel | Analyze returns 502 with clear error message; recording marked failed |
| Network drops during upload | Disable network mid-upload | Upload errors with retry option |
| Cold Railway start | Don't ping for 15+ minutes, then analyze | First analysis takes ~25s but completes |

## Security checks

| # | Check | Method |
|---|---|---|
| 1 | Service role key not in client bundle | Inspect production JS in DevTools, search for the key — should not appear |
| 2 | Gemini key not in client bundle | Same |
| 3 | Python secret not in client bundle | Same |
| 4 | Can't read another user's storage path | Sign in as user A, try to fetch user B's storage path via Supabase client — should 403 |
| 5 | Can't insert recording with someone else's user_id | RLS should reject |
| 6 | Magic link single-use | Click the link once, then click it again — second click should fail |
| 7 | No secrets in git history | `git log -p \| grep -iE 'AIza\|eyJ\|sk-'` returns nothing |

## Performance benchmarks

Loose targets. Not blockers, but if any is wildly off something is wrong.

| Action | Target |
|---|---|
| Page load (logged in) | < 2s |
| Upload 5MB video | < 8s |
| Gemini analysis | < 20s |
| Python analysis | < 8s |
| Total analyze time (parallel) | < 25s |
| Report page render after analysis | Instant (already in state) |

## Demo dry-run

Do this exactly once with a stopwatch, end-to-end, on the live URL, the day of the demo:

1. Start stopwatch
2. Open the production URL in a fresh incognito window
3. Walk through the happy path top to bottom
4. Stop stopwatch when the report renders

Should be under 90 seconds. If you can't do it in under 90s, you can't fit it in a 6-minute demo with talking. Rehearse until you can.

Record this dry-run as a video and keep it as the backup demo in case live fails.
