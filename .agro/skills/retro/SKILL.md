---
name: retro
argument-hint: "[--task <slug>] [--dry-run] [auto-approve]"
allowed-tools: Read, Grep, Bash, Edit
description: |
  Session-closing retrospective: scan the current conversation, state each
  lesson it taught, tag the lesson with a verdict (supported / refuted /
  inconclusive) and a confidence level backed by session evidence, then
  nominate the supported, sufficiently-confident, generalizing lessons as
  candidate probes under .agro/evals/probes/. The report is terminal output:
  /retro writes no file. /wiki compile turns the nominations into pattern pages.
  TRIGGER when: /retro invoked, or session closing with decisions,
  surprises, or failures worth preserving.
---

# Retro

Session-closing retrospective. Turn the current conversation's signals into lessons, tag each with a verdict and a confidence level that session evidence backs, and nominate the supported, sufficiently-confident, generalizing ones as candidate probes under `.agro/evals/probes/`.

`/retro` is **report-only**. It emits its report to the terminal and writes no file at all. There is no durable lessons ledger and no dated run log; code is the source of truth, and a lesson that matters graduates to a probe under `.agro/evals/probes/` or to a pattern page through `/wiki compile`. A lesson that cannot be argued into a probe is spoken once and left in the transcript.

`${CLAUDE_SKILL_DIR}/scripts/validate-retro-report.sh` checks a saved report against the format below.

## When to use

- `/retro` invoked explicitly to close a session.
- Proactively, after a session that produced decisions, surprises, regressions, or failure modes the next agent would benefit from knowing.

## When NOT to use

- **`/audit harness`**, **`/audit context`**, **`/audit skills`**, **`/wiki lint`** — the deep-dive tooling `/retro` points at, not what it runs. They audit code, context, skills, and the wiki; `/retro` reflects on one session.
- **Trivial sessions** — if the session contained only mechanical read-only queries or single-command invocations with no surprises, announce the skip and stop.

## Scope

Current conversation only. `/retro` does not read prior sessions or the `~/.claude/projects/...` auto-memory store. It works from what is already in context.

### `--task <slug>` — scope the pass to one build

`--task <slug>` anchors the pass to a just-built `.agro/tasks/<slug>/` run instead of
the whole ambient session. It changes **what counts as a signal** and nothing else.

With `--task <slug>`, gather signals primarily from that unit's own artifacts:

- `prd.md` — what the plan intended, and what its `## Plan Reconciliation` says
  grounding changed;
- `prd.json` — the task graph and which stories passed;
- `progress.txt` — what actually shipped, in order, with the run's own notes;
- the PR body (`gh pr view <N> --json body --jq .body`) — the divergences and the
  gaps the implementation owner recorded;
- the `implementation ⇄ audit` history — how many FAIL→build cycles, and why.

If `.agro/tasks/<slug>/` has no `prd.md`, there is no build to reflect on: say so
and fall back to a plain session-scoped pass.

`/spec retro <slug>` is a thin alias for this form
(`.agro/skills/spec/references/retro.md`). There is one retro ontology and it is
this skill's.

## Report format

```markdown
## Signals
- <what happened in this session>

## Lessons
- <lesson> [<verdict> · <confidence>] — for: <evidence>; against: <evidence, or none found in-session>

## Promotion candidates
Probe candidates:
- <principle> [<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis: <one clause>
```

Write `- none` under `Probe candidates:` when nothing qualified. `/wiki compile` parses the promotion line and gates on the lesson's verdict and confidence, so both tags keep their exact shape.

**Verdict:**

| Verdict | Meaning |
|---------|---------|
| `supported` | Session evidence backs the lesson and no in-session evidence contradicts it. |
| `refuted` | In-session evidence contradicts the lesson. |
| `inconclusive` | Evidence is mixed, thin, or absent; the session cannot decide. |

**Confidence:**

| Confidence | Meaning |
|------------|---------|
| `low` | A single weak signal. |
| `medium` | Clear single-session evidence. |
| `high` | Repeated or corroborated within the session. |

**Promotion rule:** only a `supported` lesson at `medium` or higher confidence that generalizes across sessions is nominated. A single session, however well-supported, is not a principle. `refuted`, `inconclusive`, and `low`-confidence lessons are reported and dropped.

A supported, medium-confidence lesson that does **not** generalize has no probe to land in. Say it in the report, name the code or doc change that would encode it, and let it go. That is the intended outcome, not a gap.

## Instructions

### 1. Gather signals

Scan the current conversation for:
- Decisions made and the reasoning behind them.
- Surprises — things that failed that seemed straightforward, or worked unexpectedly.
- Couplings, constraints, or edge cases that were non-obvious.
- Corrections the user made to the agent's behavior.
- Patterns in what the user asked for repeatedly.

Do not invent signals not present in the conversation.

### 2. Judge each lesson

State each signal as one lesson. Cite the session evidence for it, look for evidence against it, and tag the line `[<verdict> · <confidence>]` per the rubrics above. Write `against: none found in-session` only after looking.

### 3. Qualify

Drop any lesson that matches a row below:

| Drop if | Reason |
|---------|--------|
| Contains a secret, token, or credential | Probes are committed |
| Is raw stdout or command output | Use interpretation, not transcript |
| Belongs in a commit message or PR body | Duplication causes drift |
| Is a step-by-step task plan | Plans belong in `.agro/tasks/<name>/prd.json` |
| Re-derivable in under a minute | Reading one file answers it — don't memorize |

Also drop any lesson already captured, verbatim or in substance, by an existing probe under `.agro/evals/probes/` — cite the probe id and skip; never double-write.

### 4. Nominate

For each lesson that clears the promotion rule, assign exactly one triage tag. Route to the **cheapest reliable surface** per the [correction-surface reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md#correction-surface-triage):

| Tag | Use when | Proposed artifact |
|-----|----------|-------------------|
| `harden` | Lesson is a guardrail — something that must not happen | A hook + a unit-test probe (`.agro/evals/probes/<id>.sh`, tier A) |
| `proceduralize` | Lesson is a technique — a step, pattern, or workflow improvement | A skill step addition + a doc-lint probe (`.agro/evals/probes/<id>.sh`, tier A) |
| `eval` | Genuine judgment residue only — cannot be mechanically checked | Tier-B deferred; never a hard gate |

**Default away from `eval`.** Proposing the `eval` tag requires an explicit justification note: state why neither `harden` nor `proceduralize` can close the lesson. Without one, demote to `proceduralize` (or `harden` if the lesson is a guardrail).

Emit one line per nomination:

```
- <principle> [<subsystem> · <confidence> · harden|proceduralize|eval] — probe: <id> | basis: <one clause>
```

`<subsystem>` is the knowledge base's vocabulary — the prefix a reader would grep for (`evals`, `wiki`, `docs`, `spec`, `delegate`) — so `/wiki compile` can derive its slug from it. The probe id follows `<subsystem>-<YYYYMMDD>` (for example `evals-20260921`). For `eval`-tagged lessons, use `probe: deferred-tier-b` and append the justification note. The probe id is a forward reference: the `.agro/evals/probes/<id>.sh` file is created separately and is out of scope for `/retro` itself.

This block is a nomination, not a write. `/retro` does not create `.agro/evals/probes/<id>.sh`, and does not write any file. Minting the probe is separate work performed by the operator or a follow-up task.

`--dry-run` and `auto-approve` remain accepted for call-site compatibility — including the owner running `/spec execute`'s tail — and produce the same report, because there is nothing to gate.

## Example

```markdown
## Signals
- The session required manual release, PR land, and duplicate-PR cleanup command sequences.
- Several workflow gaps surfaced; some were already encoded in skills.

## Lessons
- Multi-step release workflows should be scripted while judgment gates stay explicit. [supported · high] — for: release verification and PR cleanup repeated as command sequences; against: canonical PR choice still required judgment
- Every workflow gap found this session belongs in docs. [inconclusive · low] — for: several gaps were procedural; against: some were already encoded in skills and would duplicate them

## Promotion candidates
Probe candidates:
- Always script the deterministic substeps of a multi-step release workflow and leave the judgment gates explicit. [spec · high · proceduralize] — probe: spec-20260618 | basis: release and PR cleanup repeated as command sequences
```

## Auto-trigger note

Claude Code skills cannot self-trigger. True automatic firing at session end would require a `Stop` hook configured in `settings.json` via `/update-config`. That is explicitly deferred from v1 of this skill.

## Anti-patterns

- **Writing a file.** `/retro` writes nothing. Nominate the probe; never create it, and never append a lesson anywhere.
- **Double-writing.** If a lesson is already guarded by a probe under `.agro/evals/probes/`, cite the probe id and skip. Never nominate a duplicate.
- **Inventing a file to save a lesson in.** A supported lesson that does not generalize is reported and dropped. Do not create a ledger, a dated log, or a scratch note to hold it.
- **Graduating prematurely.** One session is evidence, not a principle. A probe candidate needs cross-session generalization.
- **Reading outside current context.** Do not read external transcripts. Scope is the open conversation only.
- **Scope creep into the lint tools.** Point at `/audit context`, `/wiki lint`, `/audit skills`, etc.; do not run them inline.
