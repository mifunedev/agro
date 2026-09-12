# PRD: supervisor skill

Issue: [#1057](https://github.com/mifunedev/agro/issues/1057)
Branch: `skill/1057-supervisor-skill`
Source material: `.agro/plans/supervisor-skill/observations.md`

## Introduction

A long build run needs an accountable owner who does not implement and does not
review code. That role ran live on 2026-09-12. A middle-manager session drove an
advisor session that implemented `asset-tracker-mvp` in another Herdr pane. The
role worked. The role existed only in that conversation.

`/supervisor` turns the role into a repository artifact. The canonical file is
`.agro/skills/supervisor/SKILL.md`. A reader who never saw the source run must
supervise from the file alone.

The supervisor owns one Herdr workspace and one or more advisor sessions inside
it. Each advisor session owns one contract and one Definition of Done. The
supervisor stays accountable for every owned session reaching its Definition of
Done.

The supervisor holds five duties:

1. Start an advisor session at the harness root.
2. Brief the advisor with a pointer, not a copy.
3. Monitor progress and role fidelity from artifacts.
4. Own each advisor's context budget.
5. Receive advisor escalations and escalate to the operator.

## Goals

- G-1: Publish `/supervisor` as a canonical skill that a new reader executes
  without the source conversation.
- G-2: Encode every failure mode the source run produced, with the correction.
- G-3: Compose `/delegate`, `/spec`, `/prd`, `/plan`, `/herdr`, `/escalate`, and
  `/ste`. Restate none of them.
- G-4: Keep the supervisor out of implementation and out of code review.
- G-5: Pass the deterministic gates: `ste-check.sh` exits 0, and
  `link-providers.sh --check` exits 0.
- G-6: Route an advisor escalation to its supervisor session before the Slack
  channel, and keep the Slack path working when no supervisor resolves.

## User Stories

### US-001: Scaffold the canonical skill directory

**Description:** As a harness maintainer, I want the skill to exist at the
canonical path so that provider mirrors resolve to one source.

**Acceptance Criteria:**

- [ ] `.agro/skills/supervisor/SKILL.md` exists.
- [ ] Frontmatter carries `name: supervisor`, a trigger-rich `description`, and
      `allowed-tools`.
- [ ] `name` matches the directory name.
- [ ] The file declares no argument that the body ignores.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-002: Define the role boundary

**Description:** As a reader, I want the first section to state what the
supervisor owns and what the supervisor never does, so that I do not drift into
implementation.

**Acceptance Criteria:**

- [ ] The body states that the supervisor does not write application code.
- [ ] The body states that the supervisor does not review code.
- [ ] The body states that the supervisor stays accountable for the advisor
      reaching its Definition of Done.
- [ ] The body names the advisor, the worker, and the operator, and separates the
      three.

### US-003: Duty 1 — start an advisor session

**Description:** As a supervisor, I want a procedure to open an advisor tab so
that the advisor starts at the harness root.

**Acceptance Criteria:**

- [ ] The body gives the `herdr` commands that create a tab and read its pane.
- [ ] The body requires `herdr pane get <pane>` to confirm the working directory
      after creation.
- [ ] The body states that the tab creation payload does not prove the resolved
      working directory.
- [ ] The body states the failure: a tab opened in a project clone puts the
      advisor below the sandbox boundary.
- [ ] The body points at `/herdr` for command detail and repeats no catalog.

### US-004: Duty 2 — brief the advisor

**Description:** As a supervisor, I want a brief template so that the brief
points at the contract instead of copying it.

**Acceptance Criteria:**

- [ ] The body states that a brief is a pointer, not a copy.
- [ ] The brief template names the contract file and the exact section.
- [ ] The brief template names the route file and its story range.
- [ ] The brief template defines "done" as: the named command ran, the expected
      result appeared, and the output landed in `evidence.md` under its D-ID.
- [ ] The brief template names the escalation triggers.
- [ ] The brief template carries the criteria already satisfied.
- [ ] The brief template carries the facts the advisor cannot read from a file.
- [ ] The body states that a brief which says "implement" produces an
      implementer, and gives the corrected wording that assigns tracked edits to
      bounded workers.
- [ ] The body points at `/delegate` for fan-out policy and repeats no worker
      limit or model policy.
- [ ] The body gives the two-step send: send the text, then send `Enter`.

### US-005: Duty 3 — monitor

**Description:** As a supervisor, I want a monitoring loop so that I read state
from evidence instead of from the pane's claims.

**Acceptance Criteria:**

- [ ] The body states: read the pane, never attach.
- [ ] The body gives the three commands: `herdr agent list`,
      `herdr pane read`, and `herdr agent wait`.
- [ ] The body states that `herdr pane read` returns plain text and that the
      other groups return one JSON line.
- [ ] The body names the three signals read in one look: `agent_status`, the
      context percentage, and the last screen.
- [ ] The body gives the status-line format that carries the context percentage.
- [ ] The body names the three role-fidelity artifacts: the commit log, the
      `passes` flags in `prd.json`, and `progress.txt`.
- [ ] The body states that an announcement interrupt costs more than it
      delivers, and that a file on disk needs no message.

### US-006: Duty 4 — own the context budget

**Description:** As a supervisor, I want a context budget table and a compaction
procedure so that an advisor compacts at a clean seam.

**Acceptance Criteria:**

- [ ] The body carries the four-band table: below 50%, 50% to 70%, 70% to 80%,
      above 85%.
- [ ] The body defines a clean seam: a story committed, gates green, no
      half-written edit, and no worker still running.
- [ ] The body lists the carry-forward items: the contract path, the current
      story and its criteria, the invariants, the decisions since the last
      compaction, and the open deviations.
- [ ] The body states what the compaction drops: tool output and file dumps.
- [ ] The body states the re-anchor rule: point at the files.
- [ ] The body states that durable state belongs in `progress.txt` and
      `evidence.md`, appended per story.

### US-007: Duty 5 — escalate

**Description:** As a supervisor, I want one escalation path so that a blocked
advisor reaches a person.

**Acceptance Criteria:**

- [ ] The body names the three escalation triggers: a blocked prerequisite, a
      decision outside the contract, and a criterion that fails twice.
- [ ] The body requires the escalation to quote the pane output it rests on.
- [ ] The body forbids reporting an agent state without the `agent list` or
      `pane read` output behind it.
- [ ] The body states that an advisor escalation arrives at the supervisor
      first.
- [ ] The body states that the supervisor asks the operator in its own session
      when the operator is reachable there.
- [ ] The body states that `/escalate` delivers to the supervisor pane first
      and sends the Slack notification second.
- [ ] The body states that the Slack notification no-ops when no channel exists,
      and that the operator returns to the session to decide.
- [ ] The body points at `/escalate` and repeats no gateway detail.

### US-008: Supervise more than one advisor

**Description:** As a supervisor, I want a rule for owning two or more advisor tabs
so that parallel advisors do not share mutable state.

**Acceptance Criteria:**

- [ ] The body states that each advisor owns one branch and one worktree.
- [ ] The body states that two advisors never share one checkout.
- [ ] The body gives the poll order across advisors and the signal that ranks
      attention.
- [ ] The body states the per-supervisor advisor cap and the reason for it.

### US-009: Record the failure modes

**Description:** As a reader, I want the observed failure modes so that I do not
repeat them.

**Acceptance Criteria:**

- [ ] The body carries a failure-mode section with the five observed entries.
- [ ] Each entry states the symptom, the cause, and the correction.
- [ ] Each entry rests on the source run and invents no case.

### US-010: Pass the prose gate

**Description:** As a maintainer, I want the skill to read one way so that no
sentence resolves two ways.

**Acceptance Criteria:**

- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/supervisor/SKILL.md`
      exits 0.
- [ ] `SKILL.md` stays below 500 lines.
- [ ] `git diff --check` reports no whitespace error.

### US-011: Decide the probe

**Description:** As a maintainer, I want a recorded probe decision so that the
suite gains no probe without an oracle.

**Acceptance Criteria:**

- [ ] The decision states whether a deterministic oracle exists for a named
      `/supervisor` behavior.
- [ ] A probe lands under `.agro/evals/probes/` only when the oracle exists.
- [ ] When no probe lands, the PR body carries the reason.
- [ ] `bash .agro/evals/run.sh` reports no new regression when a probe lands.

### US-013: Give `/escalate` a supervisor destination

**Description:** As an advisor, I want my escalation to reach my supervisor
session so that a live owner acts on it before the Slack channel does.

`.agro/skills/escalate/scripts/escalate.sh` delivers to Slack only. The
supervisor runs in a Herdr pane and reads that pane. This story adds the
supervisor as a second destination and leaves the Slack path intact.

**Acceptance Criteria:**

- [ ] `escalate.sh` accepts `--supervisor <target>` and resolves the target in
      this order: the flag, then `AGRO_SUPERVISOR_PANE` from the environment.
- [ ] `escalate.sh` delivers to the supervisor with `herdr agent send`, then
      submits with `herdr pane send-keys <pane> Enter`.
- [ ] A recorded transcript proves that `herdr agent send` alone leaves the text
      unsubmitted and that the `send-keys Enter` call submits it.
- [ ] The supervisor delivery no-ops when `herdr` is absent, the server is down,
      or the target does not resolve. The script exits 0 and names the reason.
- [ ] The Slack delivery runs unchanged when no supervisor target resolves.
- [ ] Stdout carries a `destinations` object with one entry per attempted
      destination, each with `ok` and `reason`.
- [ ] `.ok` is true when at least one destination delivered, and false when none
      did.
- [ ] `--dry-run` prints the resolved supervisor target and the rendered text
      without sending.
- [ ] Each attempt appends one JSON line to `.agro/logs/escalations.jsonl` with
      the per-destination result.
- [ ] The `--key` quiet window suppresses every destination together.
- [ ] `.agro/skills/escalate/SKILL.md` documents the flag, the resolution order,
      the `destinations` object, the new `.ok` rule, and the exit-code table.
- [ ] `/supervisor` states that the supervisor starts an advisor with
      `herdr agent start --cwd <harness root> --env AGRO_SUPERVISOR_PANE=<pane>`
      so that the advisor resolves its supervisor without a flag.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/escalate/SKILL.md`
      exits 0.
- [ ] `bash .agro/skills/escalate/scripts/escalate.sh --help` exits 0 and lists
      the flag.
- [ ] `escalate.sh` reads `AGRO_PROJECT_ROOT` for the harness root and keeps
      `OH_PROJECT_ROOT` resolving as the SLA alias.
- [ ] `escalate.sh` resolves its state directory to `$HOME/.agro/escalate` and
      keeps an existing `$HOME/.oh/escalate` resolving.
- [ ] `escalate.sh` sources no sibling script. The resolution is inline.
- [ ] `.agro/skills/escalate/SKILL.md` names `.agro/escalate` and
      `AGRO_PROJECT_ROOT`, and names no `OH_` spelling as current.
- [ ] A grep for `OH_` and `.oh` across `.agro/skills/escalate/` and
      `.agro/skills/supervisor/` returns only SLA alias mentions.
- [ ] Evidence captured in `evidence.md` under D-US-013.

### US-012: Land the PR

**Description:** As a maintainer, I want the change on `development` with a
changelog entry.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` carries one entry for the new skill and one entry for the
      `/escalate` destination, both under `## [Unreleased]`, each at most 250
      characters, each linking the PR.
- [ ] A `PROPOSED` record lands in `.agro/evals/decisions/skill-impact.md` with
      the next `SI-nnnn` id.
- [ ] The PR title reads `FROM skill/1057-supervisor-skill TO development`.
- [ ] The PR body carries `Closes #1057`.
- [ ] `/ci-status` reports green.

## Functional Requirements

- FR-1: The canonical file is `.agro/skills/supervisor/SKILL.md`. The
  implementation edits no provider mirror.
- FR-2: The skill loads on request and on the model's own match. The
  `description` front-loads the triggers.
- FR-3: The skill states the role boundary before any procedure.
- FR-4: The skill gives one procedure per duty, in duty order.
- FR-5: The skill cites `/delegate`, `/spec`, `/prd`, `/plan`, `/herdr`,
  `/escalate`, and `/ste` by name at the point each applies.
- FR-6: The skill repeats no worker limit, no model policy, no Herdr command
  catalog, and no Slack gateway detail.
- FR-7: Every command in the skill runs in this sandbox as written.
- FR-8: The skill carries the context budget table with the four bands from the
  source run.
- FR-9: The skill carries the five observed failure modes.
- FR-10: The skill assigns every advisor its own branch and its own worktree.
- FR-11: The skill requires evidence behind every reported agent state.
- FR-12: The skill stays below 500 lines and passes `ste-check.sh`.
- FR-13: `escalate.sh` resolves a supervisor target from `--supervisor` or
  `AGRO_SUPERVISOR_PANE`, delivers to it through Herdr, and keeps the Slack path
  unchanged when no target resolves.
- FR-14: A destination that fails no-ops. `escalate.sh` exits 0, names the
  reason per destination, and sets `.ok` true when one destination delivered.

## Non-Goals

- NG-1: No change to `/escalate` beyond the supervisor destination in US-013.
  The Slack transport, the quiet window, the token resolution, and the log path
  keep their current behavior.
- NG-2: No change to `/delegate`, `/spec`, `/herdr`, or `/ste`.
- NG-8: No reply channel. `/escalate` stays one-way. The supervisor reads its
  own pane; the script waits for no answer.
- NG-3: No code review procedure. The supervisor does not review code.
- NG-4: No implementation procedure. The supervisor does not write application
  code.
- NG-5: No new script. The skill ships prose and existing commands.
- NG-6: No probe without a deterministic oracle.
- NG-7: No supervisor-of-supervisors recursion.

## Technical Considerations

- TC-1: The source material is `.agro/plans/supervisor-skill/observations.md`.
  `.gitignore` excludes `.agro/plans/`, so the observations stay out of the PR.
  Every
  claim the skill keeps must stand on its own in `SKILL.md`.
- TC-2: `.agro/skills/builder/references/skill.md` owns the skill shape. The
  implementation follows its validate list.
- TC-3: `ste-check.sh` scans narrative prose. It skips frontmatter, fenced
  blocks, and headings. Tables are prose.
- TC-4: `link-providers.sh --check` proves the mirrors resolve after a new
  canonical directory lands.
- TC-5: The source run observed Herdr v0.7.4. The skill names no version and
  points at `/herdr` for the command surface.
- TC-6: `herdr agent send` writes literal text. `herdr pane send-keys <pane>
  Enter` submits it. `herdr pane run <pane> <command>` sends command text plus
  Enter and suits a shell, not a prompt to a running agent.
- TC-7: `herdr agent start <name> --cwd <path> --env KEY=VALUE` starts an agent
  with a working directory and an environment. US-013 uses `--env` to place
  `AGRO_SUPERVISOR_PANE` in the advisor session.
- TC-8: No file outside `.agro/skills/escalate/` calls `escalate.sh`. The
  `.ok` change in US-013 breaks no caller in this repository.
- TC-9: `AGRO_` is the canonical environment prefix and `.agro` is the canonical
  control directory. `OH_` and `.oh` are SLA aliases. Every file this task
  writes uses the canonical spelling.
- TC-10: `.agro/compat-inventory.json` lists no escalate entry, so
  `$HOME/.oh/escalate` is an unmigrated straggler. US-013 migrates it and adds
  the inventory entry.

## Success Metrics

- SM-1: A reader who never saw the source run opens the skill and briefs an
  advisor without asking a question.
- SM-2: The next supervised run produces no repeat of the five recorded failure
  modes.
- SM-3: Both gates exit 0 on the first full run in CI.

## Open Questions

- OQ-1: What is the advisor cap per supervisor? The source run observed one.
  US-008 requires a stated cap. Set it from the monitoring cost, and record the
  reason.
- OQ-2: Does a deterministic oracle exist for any `/supervisor` behavior?
  US-011 decides. A grep for a cited skill name measures the text, not the
  behavior, and is a Goodhart target.
- OQ-3: Does a supervisor target belong in a state file as well as
  `AGRO_SUPERVISOR_PANE`? An environment variable dies with the pane. US-013
  ships the environment variable. Record the gap when a cron advisor needs it.

## Knowledge Context

- **Base commit**: `c158648f58ded06cfa1405b51780f3f826d56642`
- **Queries**: `skills supervisor delegate`, `escalate herdr pane`, `evals probes oracle --patterns`, `scripts compat rename --patterns`
- **Knowledge used**: `[[pattern-scripts-sibling-dependency-standalone-copies]]`,
  `[[pattern-evals-prose-literal-pinning]]`, `[[pattern-evals-unexercised-oracle]]`
- **Grounded against**: `.agro/skills/builder/SKILL.md`,
  `.agro/skills/builder/references/skill.md`, `.agro/skills/escalate/SKILL.md`,
  `.agro/skills/escalate/scripts/escalate.sh`, `.agro/skills/delegate/SKILL.md`,
  `.agro/skills/herdr/SKILL.md`, `.agro/skills/ste/SKILL.md`,
  `.agro/skills/ste/scripts/ste-check.sh`, `.agro/scripts/compat.sh`,
  `.agro/scripts/registry-portability.md`, `.agro/compat-inventory.json`,
  `.agro/cli/src/lib/registry.ts`, `.devcontainer/Dockerfile`, `package.json`,
  `README.md`, `herdr --help` output at v0.7.4
- **Conflicts discovered**: The source observations state that the supervisor
  sends the text, then sends `Enter`. `herdr` v0.7.4 also offers
  `herdr pane run`, which sends command text plus Enter in one call. The two
  primitives serve different targets. The skill states both and names the target
  for each.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `pattern-supervisor-brief-verb-selects-role`,
  `pattern-escalate-destination-fan-out`
- **Affected source paths**: `.agro/skills/supervisor/**`,
  `.agro/skills/escalate/**`, `.agro/compat-inventory.json`
- **Reason**: The task introduces a reusable agent role, adds a destination to a
  control-plane skill, changes the `escalate.sh` output contract, and adds the
  shared term supervisor to the harness vocabulary.

## Plan Reconciliation

- **Source plan**: `.agro/plans/supervisor-skill/observations.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: Four constraints, none of which
  contradicts the approved intent.
  1. `escalate.sh` must source no sibling script.
     `[[pattern-scripts-sibling-dependency-standalone-copies]]` records that a
     sourced sibling breaks every standalone copy site.
     `.agro/scripts/registry-portability.md` forbids a published skill copy from
     naming a path an installer lacks. US-013 resolves the state directory
     inline.
  2. `.agro/compat-inventory.json` carries no escalate entry, so
     `$HOME/.oh/escalate` is an unmigrated straggler. US-013 migrates it and adds
     the entry.
  3. A probe that pins skill prose measures the text, not the behavior.
     `[[pattern-evals-prose-literal-pinning]]` records that such a probe breaks
     on a rewrap. US-011 rejects that oracle class.
  4. `[[pattern-evals-unexercised-oracle]]` records that a probe which has never
     failed carries an unverified oracle, and requires fault injection. US-011
     admits a probe only with a recorded failing input.
- **Orchestration preserved**: NOT-APPLICABLE
