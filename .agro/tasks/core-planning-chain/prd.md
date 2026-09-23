# PRD: Consolidate the core planning chain

Status: DRAFT

Issue: [#1147](https://github.com/mifunedev/agro/issues/1147)

## User Stories

- As an **operator**, I want **one planning skill that writes one plan per task** so that **I review one document instead of a plan and a translated PRD**.
- As an **operator**, I want **the approved plan to land in a draft PR before implementation** so that **I can see that work started and inspect it while it runs**.
- As an **advisor session**, I want **`/delegate` to execute directly from `prd.json`** so that **one file holds the task list and its completion state**.
- As a **reviewer**, I want **the issue template, plan, and PR template to share one shape** so that **each PR answers the issue it closes**.

## Summary

The core chain becomes:

```
feat.md issue → /prd (prd.md + prd.json) → draft PR (plan commit) → /delegate (commit per story) → ready PR
```

Current state:

- `/plan` writes `.agro/plans/<slug>/plan.md` (gitignored). `/spec plan --plan` then runs `/prd`, which rewrites the plan as `.agro/tasks/<slug>/prd.md`. Two requirement documents describe one task.
- Slug rules exist in `/plan`, `/prd`, and `/spec plan`. Clarifying questions exist in `/plan` and `/prd`.
- `/ralph` contradicts itself: conversion rule 5 prefixes `branchName` with `ralph/`; the output format requires `<prefix>/<issue#>-<slug>`. Its example omits `schemaVersion`. It references "Amp" and `.claude/skills/git/SKILL.md`.
- `/delegate` (472 lines) builds its own graph in `delegate-graph.json`, forbids writes to `prd.json`, embeds one operator's model preferences, and couples to `/spec execute`.
- The `/git` issue title `<prefix>(<issue#>): <shortdesc>` cannot be typed at issue creation; `/spec execute` and `feat.md` use `<prefix>: `.
- `.gitignore` ignores `.agro/tasks/*` twice (lines 24–25 and 28–29) with different exceptions.

### Alignment with `minimal-core` (#1134, PR #1137)

The experiment deletes `/plan`, `/spec`, `/retro`, `/delegate`, and the probe suite, and keeps `/prd`, `/ralph`, and `/git`. This plan converges with it and differs in two places:

- `/delegate` stays, reduced to the Advisor/Worker pattern over `prd.json`. The experiment has no replacement for the execution half of the chain.
- The build adds no probe machinery. It removes or updates only the probes that check deleted skills, so that `/eval` on `development` reports no regression.

### Signal from `.agro/tasks/` (33 tasks, archives included)

- 15 tasks carry both `delegate-graph.json` and `prd.json`; in 8, `prd.json` shows every story passed while the graph shows unfinished tasks. `pattern-delegate-ledger-stale-at-acceptance` records the resulting duplicate-worker hazard.
- 24 of 33 PRDs name a source plan file: the plan-then-PRD translation is the common path.
- Every recorded worker brief uses `Max depth: 1`; the recursion gate has never authorized recursion.
- Delegate graphs hold 47 `unknown` values, mostly observed-settings fields.
- 29 of 33 tasks already record per-story acceptance evidence in `prd.json` `notes`; `pattern-delegate-reasoned-reported-as-executed` cites those notes. `progress.txt` duplicates that evidence; its unique content is `/spec` task-level detail (base commit, knowledge queries, drift, decisions). The core chain drops it; `/spec` keeps it.
- No `prd.json` uses a `ralph/` branch prefix; that contradiction is a documentation fix, not an observed failure.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/skills/prd/SKILL.md` | whole skill | Single planning skill: grounding, questions, `prd.md`, draft-PR offer after approval |
| `.agro/skills/prd/references/tracker.md` | new | `prd.md` → `prd.json` rules, story sizing, optional `dependsOn` / `files` / `commit` |
| `.agro/skills/plan/`, `.agro/skills/ralph/` | removed | Merged into `/prd` |
| `.agro/skills/delegate/SKILL.md` | whole skill | Opens with the Advisor/Worker pattern; executes stories from `prd.json`; commits and pushes per accepted story; updates the PR Stories checklist |
| `AGENTS.md` | glossary | Defines **worker** beside **advisor** |
| `.agro/skills/git/SKILL.md` | Issue Titles, new "Draft PR for a task" | `<prefix>: <shortdesc>` titles; issue → branch → plan commit → draft PR |
| `.agro/skills/spec/**` | path references only | Point `/spec plan` at `/prd` and `prd/references/tracker.md` |
| `.gitignore` | `.agro/tasks/*` rules | Track `prd.md` and `prd.json`; remove the duplicate block |
| `.agro/tasks/AGENTS.md` | artifact table | Core contract: `prd.md`, `prd.json`; `progress.txt` is `/spec`-only; `delegate-graph.json` removed |
| `.agro/evals/probes/*` | see Test Plan | Probes that pin the changed contracts |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| `/plan` | Remove | Merged into `/prd` |
| `/ralph` | Remove | Folded into `/prd` as a reference |
| `/prd` | Modify | Writes the plan to the task folder with `feat.md` headings; offers the draft PR after approval |
| `/delegate` | Modify | `prd.json` input; per-story commit and push |
| `.github/ISSUE_TEMPLATE/feat.md` | Modify | Remove `worktree_path` from Metadata; the environment owns worktree placement |
| `.github/pull_request_template.md` | Modify | Stories checklist near the top; evidence sections: what the issue asked for, what was built, divergence, unverified; Lessons summary |

## Storage

- **Persistence layer**: Git-tracked files in `.agro/tasks/<slug>/`: `prd.md`, `prd.json`.
- **Location / schema**: `prd.md` (prose plan) and `prd.json` (`schemaVersion: 1`, `userStories[]` with `passes`; new optional `dependsOn`, `files`, `commit`).
- **Pattern**: Only the active session writes `prd.json`. Workers never write it.

## Architectural Decisions

- **Source of truth**: `prd.md` owns intent; `prd.json` owns order and completion. Nothing else records story state.
- **State management**: Keep `passes` as the completion field so `jq -e 'all(.userStories[]; .passes == true)'` and `/spec` keep working. New fields are optional; no schema version bump.
- **Visibility**: After operator approval, the first branch commit is the plan and a draft PR opens immediately.
- **Evidence**: On acceptance, the active session writes the story's `notes`, marking each criterion `executed` (command and exit status) or `reasoned` (argument only). Decisions made during the build amend `prd.md`. The PR body summarizes both.
- **Orchestration**: `/delegate` follows the Advisor/Worker pattern. The advisor is the active session: it decides, assigns bounded stories, verifies, accepts, and alone writes `prd.json`. A worker is a bounded execution context: it implements one assignment inside its owned paths, reports each criterion as executed or reasoned, and never accepts its own result.
- **Lessons**: Before undraft, the advisor writes `## Lessons` at the end of `prd.md` as `/delegate`'s closing step. Each lesson states the claim, its evidence, and exactly one outcome: `fixed in this PR` (name the change), `issue #N`, or `dropped` (reason). Write "None" when the build taught nothing. No other lessons file, ledger, or skill; `/retro` is not part of the chain.
- **Naming**: Keep "worker" (25 skill, probe, and root files; `AGENTS.md` "One advisor, bounded workers"). Do not adopt "executor": `/spec` already uses it for a different role.
- **Scope of `/spec`**: Unchanged except for references to removed skills.

## Test Plan (TDD)

Update existing probes before the skill edits; each must fail against the current tree and pass after. Add no new probe.

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/prd-output-path-contract.sh` | `/prd` writes `.agro/tasks/<slug>/prd.md`; `references/tracker.md` exists; no `.agro/plans` path | US-001, US-002 |
| `.agro/evals/probes/plan-orchestration-contract.sh` | Remove or replace; no live reference to `skills/plan` | US-001 |
| `.agro/evals/probes/delegate-worker-boundary.sh`, `delegate-model-effort-policy.sh` | Advisor accepts; workers never write `prd.json`; no embedded provider model names | US-004 |
| `.agro/evals/probes/task-completion-structured-state.sh`, `spec-task-artifact-contract.sh` | Still pass with the two-file core contract; `/spec` tasks keep `progress.txt` | US-006 |
| one-time `grep` in US-007 (no new probe) | No live reference to `skills/plan`, `skills/ralph`, `.agro/plans`, or `ralph/` branch prefixes outside archives | US-007 |

## Design Principles

- Simplicity is beauty, complexity is pain.
- Achieve the goal in the least amount of changes.
- One source of truth for each rule: slug rules and story rules live once, in `/prd`.
- Templates own GitHub-facing shape; skills fill them.

## Out of Scope

- Trimming `/spec` beyond path references that keep it working.
- Reshaping `bug.md`, `task.md`, `audit.md`, `skill.md`.
- A fresh-context story loop runner.

## Decisions

Operator decisions recorded before execution.

- **Skill name**: `/prd` survives, with "write a plan" and "plan this" as triggers. `/plan` is deleted.
- **Private plans**: `.agro/plans/` retires. Unapproved drafts stay uncommitted in `.agro/tasks/<slug>/`. Existing local drafts are not moved or deleted.
- **Model preferences**: `/delegate` names no model. Worker model defaults live in the provider settings that already hold the session default (`.claude/settings.json`), through the Claude Code subagent-model setting. If that setting does not exist, the preferences are dropped and the operator names a model per run. Nothing is written to the home directory.
- **Execution**: This build runs under the new rules defined here: the active session is the advisor, workers take bounded stories, and evidence goes to `prd.json` `notes`. The current `/delegate` skill is not invoked.

## Acceptance Criteria

- [ ] `.agro/skills/plan/` and `.agro/skills/ralph/` no longer exist; no live reference points to them
- [ ] `/prd` writes `.agro/tasks/<slug>/prd.md` with `feat.md` headings and `prd.json` via `references/tracker.md`
- [ ] `/delegate` opens with the Advisor/Worker pattern; `AGENTS.md` glossary defines worker
- [ ] `/delegate` runs from `prd.json`, writes no `delegate-graph.json`, and records executed-versus-reasoned evidence in each story's `notes`
- [ ] `/git` documents the draft-PR-for-task procedure and `<prefix>: <shortdesc>` titles
- [ ] PR template has a Stories checklist and evidence sections
- [ ] `git check-ignore` does not match `.agro/tasks/<slug>/prd.md` or `prd.json`
- [ ] `prd.md` ends with `## Lessons`; `/git` refuses undraft without it ("None" allowed)
- [ ] No new probe is added; `/eval` has no REGRESSION
- [ ] CHANGELOG entry under `[Unreleased]`
- [ ] Draft PR opened: `FROM feat/1147-core-planning-chain TO development`

## Lessons

Filled by the advisor before undraft. Candidates recorded during planning; each outcome is set at undraft.

| Lesson | Evidence | Outcome |
| --- | --- | --- |
| Check where data is actually read before keeping or dropping the file that holds it; a usage count alone misleads. | `progress.txt` was kept on a 30-of-33 usage count, then dropped when `prd.json` `notes` already held the per-story evidence in 29 of 33 tasks. | pending |
| The secret-exposure hook blocks any command containing the word "history", including commit messages. | Two pushes on this branch were denied until the commit message changed to "task-record". | pending |
| Separate documented contradictions from observed failures when ranking fixes. | The `ralph/` branch-prefix contradiction appears in 0 `prd.json` files. | pending |
| Worker briefs must forbid restoring or discarding files by any route a hook blocks; generated-file cleanup belongs to the advisor through the maintenance shim. | The US-006 worker restored `RESULTS.md` with `git show HEAD:<file> >` after the hook denied `git checkout --`. | pending |
| The secret-exposure hook also blocks a `jq '.env'` filter on `.claude/settings.json`, which holds no secret. | An advisor probe of the settings `env` block was denied as a secret-file read. | pending |
