# PRD: Retire /spec, /retro, and /wiki compile

Status: DRAFT

Issue: [#1156](https://github.com/mifunedev/agro/issues/1156) (also closes [#1153](https://github.com/mifunedev/agro/issues/1153))

## User Stories

### US-001: Remove the /spec skill and its dedicated probes

**Description:** As an operator, I want `/spec` removed so that the core chain is the only build path.

**Acceptance Criteria:**

- [ ] `.agro/skills/spec/` does not exist.
- [ ] These probes do not exist: `spec-execute-knowledge-impact.sh`, `spec-execute-running-contract.sh`, `spec-family-contract.sh`, `spec-no-advisor-session-coupling.sh`, `spec-no-agent-handoff.sh`, `spec-no-generated-prompt-contract.sh`, `spec-plan-knowledge-context.sh`, `spec-plan-reconciliation-gate.sh`, `spec-ready-finalization.sh`, `spec-single-owner.sh`, and `spec-task-artifact-contract.sh`.
- [ ] `.claude/protected-paths.txt` has no `spec`, `retro`, or `.agro/skills/spec/references/*` entry.
- [ ] `bash .agro/evals/probes/protected-paths-resolve.sh` exits 0.

### US-002: Remove /retro and /wiki compile

**Description:** As an operator, I want the `/retro` skill and the `/wiki compile` subcommand removed so that the Lessons section of each plan is the only lesson record.

**Acceptance Criteria:**

- [ ] `.agro/skills/retro/`, `.agro/skills/wiki/references/compile.md`, `.agro/evals/probes/retro-deterministic-contract.sh`, `.agro/evals/probes/wiki-compile-contract.sh`, and `.agro/evals/capability/tasks/CB-005-compile-a-lesson.md` do not exist.
- [ ] `.agro/skills/wiki/SKILL.md` routes three subcommands (`ingest`, `query`, `lint`) and names no `compile` subcommand and no `/retro` or `/spec`.
- [ ] `.agro/skills/wiki/references/query.md` and `.agro/skills/wiki/references/schema.md` name no `/retro`, `/spec`, or `compile` subcommand.
- [ ] `.agro/skills.lock` has no `retro` entry.
- [ ] `.agro/scripts/link-providers.sh` and `.agro/scripts/__tests__/hermes-links.test.ts` name no `retro` path, and `pnpm test:scripts` exits 0.
- [ ] The shellcheck step in `.github/workflows/ci-harness.yml` and `.github/workflows/release.yml` names no `retro/scripts` path.

### US-003: Repoint the skills that name /spec or /retro

**Description:** As an agent, I want each surviving skill to route to `/prd` and `/delegate` so that no skill sends work to a retired skill.

**Acceptance Criteria:**

- [ ] `grep -rnE "/spec\b|spec (plan|execute)|/retro\b" .agro/skills` prints nothing.
- [ ] `/prompt-miner` and `.agro/skills/audit/references/implementation.md` route no step to `/retro`.
- [ ] `/architect` hands off to `/prd` where it handed off to `/spec plan`.
- [ ] `/benchmark` states that the operator runs it, and names no automatic caller.
- [ ] `.agro/skills/t3/references/sandbox-processes.md` keeps the heading that `headless-tmux-preserved.sh` pins.

### US-004: Update docs, crons, and directory contracts

**Description:** As an operator, I want the docs and crons to describe the core chain only so that no reader follows a retired path.

**Acceptance Criteria:**

- [ ] `grep -rnE "/spec\b|spec (plan|execute)|/retro\b"` over `crons/`, `docs/` (except `docs/rfcs/`), `.agro/tasks/AGENTS.md`, `.agro/knowledge/AGENTS.md`, `.agro/memories/AGENTS.md`, `.gitignore`, and `.agro/evals/datasets/README.md` prints nothing.
- [ ] `docs/security-considerations.md` anchors the human merge gate to a surviving file.
- [ ] `.agro/evals/capability/tasks/CB-002-walk-the-workflow.md` describes the core chain (`/prd` → draft PR → `/delegate` → ready PR), and `CB-001-ship-harness-change.md` names the core chain.
- [ ] `bash .agro/evals/probes/capability-benchmark-schema.sh` exits 0.
- [ ] The two `kind: repo` knowledge pages that cite `/spec` files pin those sources `@<sha>`, per `.agro/skills/wiki/references/lint.md`.
- [ ] `CHANGELOG.md` `[Unreleased]` has one `### Removed` entry of at most 250 characters that links the task issue.

### US-005: Repoint the probes that name /spec or /retro

**Description:** As a reviewer, I want each surviving probe to check only surviving files so that no probe fails or turns `SKIPPED` because of the retirement.

**Acceptance Criteria:**

- [ ] Each probe in this list keeps its assertions on surviving files, drops its assertions on retired files, and is deleted when no assertion survives: `advisor-execution-contract`, `architect-skill-contract`, `audit-slop-gate`, `audit-stale-references`, `continual-learning-20260911b`, `delegate-worker-boundary`, `eval-gate`, `eval-runs-once-per-cycle`, `headless-tmux-preserved`, `knowledge-tracked-query-boundary`, `roles-are-skills`, `skills-vendored`, `submitted-by-trailers`, `task-completion-structured-state`, and `workflow-boundaries`.
- [ ] No surviving probe reads a path under `.agro/skills/spec/` or `.agro/skills/retro/`.
- [ ] `bash .claude/skills/eval/run.sh` reports no `PASS->REGRESSION` and no `PASS->SKIPPED` delta for a surviving probe.

## Summary

Verified current state (advisor and a read-only mapping agent, `development` at `51b44e10`, 2026-09-23):

- `/spec` has `SKILL.md`, three references, one template, and 11 dedicated `spec-*` probes. About 40 live files name it.
- `/retro` has `SKILL.md`, `scripts/validate-retro-report.sh`, and `retro-deterministic-contract.sh`. `/wiki compile` consumes only a `/retro` report. CI shellcheck, `link-providers.sh`, `hermes-links.test.ts`, and `skills.lock` name `retro` paths.
- Outside the `spec-*` probes, four probes fail when `.agro/skills/spec/` goes (`audit-slop-gate`, `workflow-boundaries`, `roles-are-skills`, `skills-vendored`), `audit-stale-references` fails on a tracked-path check, and seven probes turn `SKIPPED` and lose coverage of surviving files.
- `protected-path-deletion.sh` reads the protected list at the merge base. The PR body must name each removed protected entry: `spec`, `retro`, and the three `.agro/skills/spec/references/*.md` paths.
- #1137 (`experiment/minimal-core`, draft) also deletes `/spec` and `/retro`. This task lands the retirement on `development` first, which shrinks the #1137 diff.

Operator decisions (2026-09-23): retire `/spec`, `/retro`, and `/wiki compile`; keep `/benchmark` as an operator-run skill.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/skills/spec/`, `.agro/skills/retro/`, `.agro/skills/wiki/references/compile.md` | whole | Removed. |
| `.agro/evals/probes/` | 11 `spec-*` probes, `retro-deterministic-contract.sh`, `wiki-compile-contract.sh`, 15 repointed probes | Removed or repointed. |
| `.claude/protected-paths.txt` | `spec`, `retro`, spec reference entries | Entries removed. |
| `.agro/skills/*/SKILL.md` and references | `/spec` and `/retro` routes | Repointed to `/prd` and `/delegate`. |
| `crons/`, `docs/`, `.agro/*/AGENTS.md`, `.gitignore` | descriptions and contracts | Repointed. |
| `.github/workflows/ci-harness.yml`, `.github/workflows/release.yml` | shellcheck path list | `retro/scripts` removed. |
| `.agro/scripts/link-providers.sh`, `.agro/scripts/__tests__/hermes-links.test.ts`, `.agro/skills.lock` | `retro` entries | Removed. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Skills `/spec`, `/retro` | removal | The provider symlinks (`.claude/skills`, `.agents/skills`) follow `.agro/skills`. |
| `/wiki compile` | removal | `/wiki` keeps `ingest`, `query`, and `lint`. |
| `/benchmark` | trigger change | Operator-run only. |
| Public docs (`mifunedev/agro-web`) | check | The advisor checks for `/spec` and `/retro` pages at Close and proposes an issue if any exist. |

## Storage

N/A. Existing `.agro/tasks/archive/` folders and `.agro/knowledge/` pages stay as history.

## Architectural Decisions

- History stays: released `CHANGELOG.md` sections, `docs/rfcs/`, `.agro/knowledge/raw/` and `patterns/`, completed task folders, frozen datasets, and `.agro/evals/decisions/skill-impact.md`.
- A probe that loses its subject is deleted, not left to skip. A `SKIPPED` result hides lost coverage.
- Valuable assertions on surviving files move with their probe, for example the `pr-classify.sh` oracle in `continual-learning-20260911b` and the `/delegate` checks in `advisor-execution-contract`.
- Each removed protected path is named in the PR body so that `protected-path-deletion.sh` passes. The header of `.claude/protected-paths.txt` asks for removal in a separate PR; this PR removes the entries with the skills, as #1148 did for `ralph`, and states the exception in the PR body.
- CB-002 is rewritten for the core chain, not deleted, because `capability-benchmark-schema.sh` requires at least two capability tasks after CB-005 goes.
- Stories US-001 to US-004 own disjoint files and run in one parallel wave. US-005 depends on all four, because the probes pin the texts they change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `bash .claude/skills/eval/run.sh` | before the wave, then after each acceptance | No `PASS->REGRESSION` or `PASS->SKIPPED` delta for a surviving probe. |
| `.agro/evals/probes/protected-paths-resolve.sh` | US-001 | The protected list resolves. |
| `.agro/evals/probes/protected-path-deletion.sh` | Close, with the PR body | The PR body names each removed protected entry. |
| `pnpm test:scripts` | US-002 | `hermes-links.test.ts` passes without `retro`. |
| `grep -rnE "/spec\b\|spec (plan\|execute)\|/retro\b"` | US-003, US-004 | No live reference. |

The advisor records the full-suite baseline before the wave. Each story shows its target probe failing on the integrated branch before the story that repairs it, where the story order allows.

## Design Principles

- Delete obsolete paths instead of leaving dormant alternatives (root `AGENTS.md`, Taste).
- Keep history; change live instructions.
- Keep one lesson record: `prd.md` `## Lessons`.
- Add no probe and no explanatory comments.

## Out of Scope

- `/benchmark` retirement and the capability benchmark machinery beyond CB-002 and CB-005.
- The disabled crons `prompt-miner` and `heartbeat` stay disabled. US-004 repoints their text only.
- The rest of the minimal-core experiment (#1134, #1137).
- Rewriting history pages or archived tasks.
- #1155.

## Open Questions

None.

## Acceptance Criteria

- [ ] `.agro/skills/spec/` and `.agro/skills/retro/` do not exist.
- [ ] No live skill, probe, cron, doc, or directory contract names `/spec` or `/retro`.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red and no `PASS->SKIPPED` delta for a surviving probe.
- [ ] CI passes, including `protected-path-deletion` with the PR body.
- [ ] #1153 closes with this PR.

## Lessons

Filled by the advisor before undraft.
