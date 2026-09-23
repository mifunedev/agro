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

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/skills/prd/SKILL.md` | whole skill | Single planning skill: grounding, questions, `prd.md`, draft-PR offer after approval |
| `.agro/skills/prd/references/tracker.md` | new | `prd.md` → `prd.json` rules, story sizing, optional `dependsOn` / `files` / `commit` |
| `.agro/skills/plan/`, `.agro/skills/ralph/` | removed | Merged into `/prd` |
| `.agro/skills/delegate/SKILL.md` | whole skill | Executes stories from `prd.json`; commits and pushes per accepted story; updates the PR Stories checklist |
| `.agro/skills/git/SKILL.md` | Issue Titles, new "Draft PR for a task" | `<prefix>: <shortdesc>` titles; issue → branch → plan commit → draft PR |
| `.agro/skills/spec/**` | path references only | Point `/spec plan` at `/prd` and `prd/references/tracker.md` |
| `.gitignore` | `.agro/tasks/*` rules | Track `prd.md` and `prd.json`; remove the duplicate block |
| `.agro/tasks/AGENTS.md` | artifact table | Two-file core contract; `progress.txt` and delegate files become `/spec`-only or removed |
| `.agro/evals/probes/*` | see Test Plan | Probes that pin the changed contracts |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| `/plan` | Remove | Merged into `/prd` |
| `/ralph` | Remove | Folded into `/prd` as a reference |
| `/prd` | Modify | Writes the plan to the task folder with `feat.md` headings; offers the draft PR after approval |
| `/delegate` | Modify | `prd.json` input; per-story commit and push |
| `.github/ISSUE_TEMPLATE/feat.md` | Modify | Remove `worktree_path` from Metadata; the environment owns worktree placement |
| `.github/pull_request_template.md` | Modify | Stories checklist near the top; evidence sections: what the issue asked for, what was built, divergence, unverified |

## Storage

- **Persistence layer**: Git-tracked files in `.agro/tasks/<slug>/`.
- **Location / schema**: `prd.md` (prose plan) and `prd.json` (`schemaVersion: 1`, `userStories[]` with `passes`; new optional `dependsOn`, `files`, `commit`).
- **Pattern**: Only the active session writes `prd.json`. Workers never write it.

## Architectural Decisions

- **Source of truth**: `prd.md` owns intent; `prd.json` owns order and completion. Nothing else records story state.
- **State management**: Keep `passes` as the completion field so `jq -e 'all(.userStories[]; .passes == true)'` and `/spec` keep working. New fields are optional; no schema version bump.
- **Visibility**: After operator approval, the first branch commit is the plan and a draft PR opens immediately. The PR timeline replaces `progress.txt` in the core chain.
- **Scope of `/spec`**: Unchanged except for references to removed skills.

## Test Plan (TDD)

Update or add probes before the skill edits; each must fail against the current tree and pass after.

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/prd-output-path-contract.sh` | `/prd` writes `.agro/tasks/<slug>/prd.md`; `references/tracker.md` exists; no `.agro/plans` path | US-001, US-002 |
| `.agro/evals/probes/plan-orchestration-contract.sh` | Remove or replace; no live reference to `skills/plan` | US-001 |
| `.agro/evals/probes/delegate-worker-boundary.sh`, `delegate-model-effort-policy.sh` | Advisor accepts; workers never write `prd.json`; no embedded provider model names | US-004 |
| `.agro/evals/probes/task-completion-structured-state.sh`, `spec-task-artifact-contract.sh` | Still pass with the two-file core contract | US-006 |
| new `core-chain-references.sh` | No live reference to `skills/plan`, `skills/ralph`, `.agro/plans`, or `ralph/` branch prefixes outside archives | US-007 |

## Design Principles

- Simplicity is beauty, complexity is pain.
- Achieve the goal in the least amount of changes.
- One source of truth for each rule: slug rules and story rules live once, in `/prd`.
- Templates own GitHub-facing shape; skills fill them.

## Out of Scope

- Trimming `/spec` beyond path references that keep it working.
- Reshaping `bug.md`, `task.md`, `audit.md`, `skill.md`.
- A fresh-context story loop runner.

## Open Questions

- Where do the Claude Code model preferences removed from `/delegate` live: operator-level user config or `agro.json`?
- Keep `/plan` as a one-line alias for `/prd`, or delete it outright? Default: delete.

## Acceptance Criteria

- [ ] `.agro/skills/plan/` and `.agro/skills/ralph/` no longer exist; no live reference points to them
- [ ] `/prd` writes `.agro/tasks/<slug>/prd.md` with `feat.md` headings and `prd.json` via `references/tracker.md`
- [ ] `/delegate` runs from `prd.json` and writes no `delegate-graph.json`
- [ ] `/git` documents the draft-PR-for-task procedure and `<prefix>: <shortdesc>` titles
- [ ] PR template has a Stories checklist and evidence sections
- [ ] `git check-ignore` does not match `.agro/tasks/<slug>/prd.md` or `prd.json`
- [ ] `/eval` has no REGRESSION
- [ ] CHANGELOG entry under `[Unreleased]`
- [ ] Draft PR opened: `FROM feat/1147-core-planning-chain TO development`
