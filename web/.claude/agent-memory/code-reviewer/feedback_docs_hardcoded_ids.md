---
name: feedback_docs_hardcoded_ids
description: CLAUDE.md and DEPLOYMENT.md contain hardcoded Supabase project ID, Vercel URL, and personal email in curl examples
metadata:
  type: feedback
---

`CLAUDE.md` (line ~49) and `docs/DEPLOYMENT.md` (line ~72, ~76) contain:
- Hardcoded Supabase project ID: `zukhknjsaobragzuuegd`
- Hardcoded Vercel URL: `web-sigma-eight-17.vercel.app`
- Hardcoded personal email: `ruben.creviser@gmail.com`

These appear inside curl examples for the admin bypass flow.

**Why:** They were added as a convenience during smoke testing and were not generalized before being committed. The project ID in the URL is low sensitivity (it is part of the public Supabase URL), but the email and Vercel URL are personal identifiers that reduce portability if the project is ever open-sourced or handed off.

**How to apply:** When editing or reviewing documentation that contains curl examples against Supabase admin endpoints, flag hardcoded personal identifiers and suggest replacing them with `<PLACEHOLDER>` tokens. See [[project_context]].
