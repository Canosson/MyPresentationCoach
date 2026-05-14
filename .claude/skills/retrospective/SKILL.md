---
name: retrospective
description: Audits the just-completed session and surfaces a concise, targeted list of suggested improvements — to skills, docs, conventions, or workflow — or stays silent if nothing meaningful was learned. Use this proactively whenever a multi-step task has wrapped up, when a feature or run has been delivered, or when the user asks for a "retro" / "what could be improved" / "what did we learn" / "anything to update". Running this at session end is the design intent — don't undertrigger; running it once and finding nothing to say is fine, skipping it entirely loses the audit.
---

# Skill: retrospective

After a session of meaningful work completes, audit what happened and produce a concise list of suggested improvements to skills, docs, or workflow. Or stay silent — if the run was clean, that's the right output.

## When to use

Invoke at:

- **End of every meaningful session.** After a feature ships, a bug is fixed, a multi-step task wraps up, or the user signals they're done.
- **Manual request:** the user says "retro on this", "audit the session", "what could be improved?", "what did we learn?", "anything to update?", "lessons from this run".

Don't run mid-session. Wait until the work is delivered. Mid-session retros create noise.

## Inputs (what to audit)

You have the entire session transcript in context. Pull from these signals:

1. **Skill / doc instructions vs. reality.** Did any documented step fail when run as written? Wrong command, missing flag, unsupported path, stale name, broken example. These are the highest-value findings — they prevent the next run from hitting the same wall.

2. **User corrections.** When the user pushed back during the run, what was it? Distinguish:
   - **Stylistic / content choices** — NOT skill issues. Skip.
   - **Process / structural corrections** ("we should be using approach X", "rename that file", "this default is wrong") — ARE skill issues if they suggest the docs or defaults need updating.

3. **Silent failures discovered the hard way.** A test that "passed" but produced wrong output. A lint warning that turned out to be critical. A flag that produced unexpected behavior. These should become explicit failure modes documented in the relevant skill or `CLAUDE.md`.

4. **Drift between docs.** README, `CLAUDE.md`, skill files, project state, tooling. If any pair was out of sync (e.g., README references a renamed function, a doc points at a stub file), flag it.

5. **Workflow friction.** Steps that took multiple tries. Iteration loops that felt heavy. Decisions that were ambiguous because the relevant doc didn't speak to them.

6. **Patterns that emerged.** A new component, helper, or technique built fresh during the run that would benefit from being saved into a lib or doc for reuse next time.

## Output format

If you decide to speak (see "The silence path" below), produce a concise list, organized by category. Use the categories that apply — skip the ones that don't.

```markdown
## Retrospective — <session subject>

<Optional one-sentence framing of what was surprising or noteworthy. Skip if nothing surprising.>

### Stale docs
1. **<file or doc name>** — what's wrong, what to change.

### Skill / doc instructions that don't match reality
2. **<name>** — what failed, what the actual behavior is.

### Run-time lessons not captured
3. **<lesson>** — concise statement of what we learned and where to put it.

### Workflow gaps
4. **<friction point>** — what felt heavy, what could ease it.

### New skills or patterns
5. **<idea>** — what it would do, what real moment in the run motivated it.
```

Constraints on form:

- Each item is one to two terse lines, action-oriented. Number them across categories continuously.
- Group by category only if you have 5+ items total. Below that, a flat numbered list reads cleaner.
- No padding. Concise > comprehensive. If you have 2 items, the list is 2 items.
- Each item should trace to a specific moment from the session. If you can't say *what happened* that motivated the suggestion, it's not a real finding.

## The silence path

If the run was clean, output nothing. Don't say "no improvements", don't say "everything went smoothly", don't acknowledge the skill ran. Just don't speak.

This is real and intentional. The skill's value comes from filtering — only surfacing improvements when they'd actually be worth implementing. Acknowledging silence defeats the filter.

**Stay silent if all of these are true:**

- Every documented step worked as written on the first try.
- The user's feedback was limited to stylistic / content choices.
- No silent failures, no doc drift, no surprising behavior.
- No new patterns emerged that should be saved for reuse.

**Speak if any of these are true:**

- A documented step failed and you had to work around it.
- The user pushed back on a process or structural decision (not just content).
- You discovered a failure mode not in the docs.
- Any doc was out of date with reality.
- A new pattern was built that should be reusable.

The mental check: "would the user benefit from this becoming a permanent change to the project?" If yes, surface it. If it's a one-off that won't recur, skip.

## Examples

### Worth saying

> **Skill instructions that don't match reality**
> 1. **`<some-skill>/SKILL.md`** — install command says `npm install <name>` but the package was renamed last release. Should be `npm install @scope/<name>`.
> 2. **Stop hook config** — docs say to use `command` but the field was renamed to `cmd` in the latest harness version. Update the example.

Both items trace to specific moments (a command that errored, a config that didn't fire). Both are project-level fixes that would prevent the next run from hitting the same issue.

### Not worth saying

> "We chose option B over option A for the design decision."

Content choice — the user's call for that session. Not a skill issue.

> "The build took ~30s."

Observation without a proposed change. If build speed is a recurring problem, that's a finding; if it's just "happened this time," skip.

> "The implementation looked clean."

Praise. Not a finding.

> "We could maybe add a feature where the skill auto-detects ____."

If the run didn't actually reveal real friction, "could be nice" speculation isn't a finding — even good ideas need to trace to a specific moment that motivated them.

## Anti-patterns

- **Don't pad the list** with weak items to make it feel substantial. A 2-item list is fine.
- **Don't surface stylistic / content preferences** as skill issues. Those are per-session content decisions, not project-level changes.
- **Don't propose net-new skills** unless the run actually exposed real friction that the skill would have prevented. "Could be nice to have" is not a finding.
- **Don't speak when there's nothing worth saying.** Silence is a valid output.
- **Don't recommend changes you can't justify** with a specific moment from the session.
- **Don't auto-implement** the suggestions. Surface them. The user decides which to apply, when, and how. The retro is signal, not action.
- **Don't repeat findings across runs** — if a suggestion has been raised in a prior session and not yet acted on, mention it once briefly ("still applies from prior retro: X") rather than re-deriving it from scratch.