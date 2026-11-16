# PRD: Fold an opt-in review into /delegate

Status: DRAFT

## User Stories

### US-001: Add the opt-in review state to next.sh

**Description:** As the advisor, I want `next.sh` to print `review` after the first green CI when the task opts in. The code review then runs before Close and before `gh pr ready`.

**Acceptance Criteria:**

- [ ] When the top-level field `review` in `prd.json` is absent or `false`, `next.sh` prints the same state sequence as today: `story`, `close`, `push`, `ci`, `ready`, `done`.
- [ ] When `review` is `true`, every story passes, `pr` is set, `reviewed` is empty or absent, and CI is green on `HEAD`, `next.sh` prints `review`.
- [ ] When `review` is `true` and `reviewed` is empty, `next.sh` prints `push`, `ci`, or `ci-red` before `review` by the same rules that it uses before `ready` today.
- [ ] When `review` is `true`, `reviewed` is a non-empty string, and `## Lessons` in `prd.md` is empty, `next.sh` prints `close`.
- [ ] When `review` is `true`, `reviewed` is a non-empty string, and `## Lessons` is not empty, `next.sh` prints `push`, `ci`, `ci-red`, `ready`, or `done` by the current rules.
- [ ] The action line for `review` is `Run the code review per /delegate § Review, then write reviewed in prd.json.`
- [ ] Each current case in `next.test.mjs` passes with no change to its expected state.
- [ ] New cases in `next.test.mjs` cover each criterion above, and each new case fails before the `next.sh` change.
- [ ] `pnpm exec vitest run .agro/skills/delegate/scripts/__tests__/next.test.mjs` exits 0.

### US-002: Put the flow and the opt-in into the /delegate contract

**Description:** As the operator, I want `/delegate` to own the whole flow from approval to merge. One diagram and one state table describe the flow, and the review step runs only when I opt in.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Task lifecycle holds the flow diagram from the Summary of this plan, directly above the state table.
- [ ] The state table has a `review` row between `ci` and `close`. The row names § Review, the exit condition "`prd.json` has a non-empty `reviewed`", and the owner "Advisor; a worker repairs".
- [ ] § Task lifecycle states that the review step is off by default, and that `"review": true` in `prd.json` turns the step on.
- [ ] A new § Review section states the procedure: run the review on the task branch, repair each finding per § Repair, rerun the review, then write the reviewed commit SHA to `reviewed`.
- [ ] § Review links `https://code.claude.com/docs/en/code-review` as the reference for the review options. Claude Code runs `/code-review`. Codex, Pi, and another harness pick an option from the "Compare ways to get a review" table on that page.
- [ ] § Review states that the managed Code Review service skips draft pull requests. The PR is a draft at `review`, so the advisor does not wait for that service.
- [ ] When `review` is `true`, § Close starts after `review`, and step 3 of § Close tells the advisor to include each review finding in `## Lessons`.
- [ ] `.agro/skills/prd/references/tracker.md` documents the top-level fields `review` and `reviewed`, and the conversion flag `--review` that writes `"review": true`.
- [ ] § Field ownership in `tracker.md` lists `reviewed` as advisor-only.
- [ ] `.agro/skills/git/SKILL.md` § Ready for review adds this condition: when `review` is `true`, `prd.json` has a non-empty `reviewed`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` exits 0.

### US-003: Align the hook test, the harness docs, and the changelog

**Description:** As an operator on any harness, I want the Stop hook docs and tests to list `review` so that the documented contract matches `next.sh`.

**Acceptance Criteria:**

- [ ] The `it.each` list at `.agro/scripts/__tests__/hooks.test.ts:475` contains `review`.
- [ ] The Stop hook state list in `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md`, and `docs/harnesses/pi.md` contains `review` between `ci-red` and `ready`.
- [ ] `CHANGELOG.md` `## [Unreleased]` has one entry that states that `/delegate` can run an opt-in code review before Close, and marks the PR ready only after the retro.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.

### US-004: Capture manual review evidence

**Description:** As the operator, I want a command transcript of both state orders so that I can confirm the flow without a live PR.

**Acceptance Criteria:**

- [ ] `.agro/tasks/fold-review-into-delegate/evidence/manual-review.md` holds a transcript that runs `bash .agro/skills/delegate/scripts/next.sh --task <tmp slug>` in a new temp git repository with a stub `gh` on `PATH`.
- [ ] With `review` absent, the transcript shows this sequence: `story`, `close`, `push`, `ci`, `ready`, `done`.
- [ ] With `"review": true`, the transcript shows this sequence: `story`, `push`, `ci`, `review`, `close`, `push`, `ci`, `ready`, `done`.
- [ ] The story creates the temp repository under a new temp path, deletes the temp path at the end, and changes no existing task.

## Summary

Today `/delegate` runs this state order: `story`, `close`, `push`, `ci`, `ci-red`, `ready`, `done`. Source: `.agro/skills/delegate/scripts/next.sh`. A code review runs outside the lifecycle, after `gh pr ready`.

This plan adds one opt-in state, `review`. The step is off by default, and the default state order does not change. When `prd.json` sets `"review": true`, Close moves after the review. Close already writes `## Lessons`, so Close is the retro. One retro then covers the stories and the review findings. `gh pr ready` stays the last advisor action in both orders.

The Stop hook `.agro/hooks/task-next-stop.sh` already lists `review` in its blocking `case`. The hook needs no change.

The diagram for § Task lifecycle:

```text
 OPERATOR            ADVISOR (/delegate, next.sh loop)              WORKERS / CI
 /prd ──▶ prd.md
 ◆ APPROVE ◆ ─▶ prd §7: issue #N → prd.json → DRAFT PR
                story <id> ──dispatch──────────────────────────▶ worker
                   ▲  verify → passes:true ◀──report────────────┘
                   └─ next story / wave
                ┌─ review: true (opt-in) ──────────────────────────┐
                │ push → ci ──ci-red──▶ reopen owning story        │
                │ review: harness review → repair → reviewed=<sha> │
                └──────────────────────────────────────────────────┘
                close (retro): checks + evidence + ## Lessons
                push → ci ──ci-red──▶ reopen owning story
                       │ green
                ready: gh pr ready
 ◆ MERGE ◆ ◀─── done
```

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/scripts/next.sh` | `emit`, the push and CI block, the Lessons `awk` check | State machine; gains the opt-in `review` gate |
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | `describe("close")`, `describe("ci and ci-red")` | State tests |
| `.agro/skills/delegate/scripts/__tests__/fixture.mjs` | `basePrd`, `story` | Fixture builders for opt-in cases |
| `.agro/skills/delegate/SKILL.md` | § Task lifecycle, § Repair, § Close | Lifecycle contract and diagram |
| `.agro/skills/prd/references/tracker.md` | top-level fields, § Field ownership, § Inputs | `prd.json` schema and `--review` flag |
| `.agro/skills/git/SKILL.md` | § Ready for review | Conditions for `gh pr ready` |
| `.agro/hooks/task-next-stop.sh` | `case "$state"` | Already blocks at `review`; no change |
| `.agro/scripts/__tests__/hooks.test.ts` | `it.each` at line 475 | Hook blocking states |
| `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md`, `docs/harnesses/pi.md` | § Task lifecycle Stop hook | Public state list |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `next.sh` output | New state | `review` with one action line, only when `review` is `true` |
| `prd.json` | New optional fields | Top-level `review` (boolean opt-in) and `reviewed` (the reviewed commit SHA) |
| Tracker conversion | New flag | `--review` writes `"review": true` |
| `/delegate` | Contract change | With the opt-in, review and retro run before `gh pr ready` |

## Storage

The top-level fields `review` and `reviewed` in `.agro/tasks/<slug>/prd.json` store the opt-in and the review result. The fields need no `schemaVersion` change, because each tool accepts a file without them.

## Architectural Decisions

- `/delegate` stays the only owner of the lifecycle. No new skill.
- `next.sh` stays the only state machine. `next.sh` reads `review` as the opt-in and checks only that `reviewed` is a non-empty string.
- The review step is off by default. A task without `review` keeps the current state order, so tasks in flight do not change.
- The operator opts in at conversion with `--review`, or edits `prd.json` before `/delegate` starts.
- Close is the retro. The plan adds no separate retro state.
- Review findings use § Repair. A worker repairs, and the advisor accepts.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | default order without `review`; `review: false`; with `review: true`: `push`, `ci`, `ci-red` before review, `review` after green CI, `close` after review, `ready` after Lessons and green CI | US-001 |
| `.agro/scripts/__tests__/hooks.test.ts` | hook blocks the stop at `review` | US-003 |

## Design Principles

- One source of truth for each policy: the state table and `next.sh` agree.
- Smallest change: one opt-in state, two optional fields, one conversion flag.
- Default behavior does not change.
- Harness portability: § Review links one external page for the review options. Each harness picks an option from that page.

## Out of Scope

- A new skill for review or retro.
- A change to `/code-review` itself.
- A check that `reviewed` is an ancestor of `HEAD`.
- A change to the Stop hook script.
- A repository-wide default that turns the review on for every task.

## Open Questions

None.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] Without `review`, `next.sh` prints the current state order.
- [ ] With `"review": true`, `next.sh` prints `review` before `close`, and `ready` only after `## Lessons` is non-empty and CI is green.
- [ ] The diagram and the state table in `.agro/skills/delegate/SKILL.md` list the same state order as `next.sh`.

## Lessons
