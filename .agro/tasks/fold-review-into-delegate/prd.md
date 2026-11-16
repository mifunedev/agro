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

### US-005: Turn the review on by default at conversion

**Description:** As the operator, I want each new task to run the code review unless I opt out. `next.sh` keeps its rule, so tasks in flight do not change.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/references/tracker.md` tells the converter to write `"review": true` by default, and to write `"review": false` when the conversion has `--no-review`.
- [ ] `tracker.md` no longer documents a `--review` flag.
- [ ] The output schema example in `tracker.md` holds `"review": true`.
- [ ] `.agro/skills/delegate/SKILL.md` § Task lifecycle states that the conversion turns the review on by default, that `--no-review` turns it off, and that `next.sh` skips the review when `review` is absent or `false`.
- [ ] The `CHANGELOG.md` entry for #1658 states that new tasks run the code review by default.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on `tracker.md` and on `.agro/skills/delegate/SKILL.md`.
- [ ] `.agro/skills/delegate/scripts/next.sh` has no change in this story.

## Summary

Today `/delegate` runs this state order: `story`, `close`, `push`, `ci`, `ci-red`, `ready`, `done`. Source: `.agro/skills/delegate/scripts/next.sh`. A code review runs outside the lifecycle, after `gh pr ready`.

This plan adds one state, `review`. The tracker conversion turns the review on by default, and `--no-review` turns it off (US-005). A `prd.json` without `review` keeps the old order. When `prd.json` sets `"review": true`, Close moves after the review. Close already writes `## Lessons`, so Close is the retro. `gh pr ready` stays the last advisor action in both orders.

The Stop hook `.agro/hooks/task-next-stop.sh` already lists `review` in its blocking `case`. The hook needs no change.

The diagram for § Task lifecycle:

```text
 OPERATOR            ADVISOR (/delegate, next.sh loop)              WORKERS / CI
 /prd ──▶ prd.md
 ◆ APPROVE ◆ ─▶ prd §7: issue #N → prd.json → DRAFT PR
                story <id> ──dispatch──────────────────────────▶ worker
                   ▲  verify → passes:true ◀──report────────────┘
                   └─ next story / wave
                ┌─ review: true (set at conversion) ───────────────┐
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
| Tracker conversion | New default | The conversion writes `"review": true`; `--no-review` writes `"review": false` |
| `/delegate` | Contract change | With the opt-in, review and retro run before `gh pr ready` |

## Storage

The top-level fields `review` and `reviewed` in `.agro/tasks/<slug>/prd.json` store the opt-in and the review result. The fields need no `schemaVersion` change, because each tool accepts a file without them.

## Architectural Decisions

- `/delegate` stays the only owner of the lifecycle. No new skill.
- `next.sh` stays the only state machine. `next.sh` treats the review as current only when `reviewed` names a commit and no file outside `.agro/tasks` changed since that commit.
- `next.sh` treats an absent `review` as off. A task in flight without `review` keeps the old state order.
- The tracker conversion writes `"review": true` by default (US-005). The operator opts out with `--no-review`, or edits `prd.json` before `/delegate` starts.
- Revision (US-005, operator request): the conversion writes `"review": true` by default, and `--no-review` opts out. `next.sh` keeps absent as off, so tasks in flight do not change.
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

1. Claim: the plan named `docs/harnesses/pi.md` as a Stop hook state list. Evidence: `docs/harnesses/pi.md:145` states that Pi has no `Stop` hook, and the file lists no blocking states. Outcome: dropped. The advisor marked that US-003 criterion reasoned as not applicable. No file needs a change.
2. Claim: US-001 criterion 8 asked each new case to fail before the change. Evidence: 12 of 24 new cases guard the default order and pass on the old `next.sh` by design. Outcome: dropped. The finding is a plan wording observation, and the 12 new-behavior cases failed first.
3. Claim: `.gitignore` rule `.agro/tasks/*/*` ignores task evidence files, so each evidence commit needs `git add -f`. Evidence: `git check-ignore -v` on `evidence/baseline.md` printed `.gitignore:26`. Outcome: dropped. The finding is tooling friction, and other tasks already track evidence with `git add -f`.
4. Claim: the Safety Net hook blocked heredocs inside command groups in three worker sessions. Evidence: the US-001, US-003, and US-004 worker reports. Outcome: dropped. The finding is tooling friction, and each worker used the Write tool or the Edit tool instead.
5. Claim: the first `/code-review` pass on PR #1659 found that a plain review at `review` sees an empty diff. Evidence: `next.sh` prints `review` only when `HEAD` equals the upstream. Outcome: fixed in this PR. § Review runs `/code-review <pr>`.
6. Claim: the review found that `reviewed` stays set after a later repair. Evidence: `next.sh` checks only for a non-empty string. Outcome: fixed in this PR. § Repair deletes `reviewed` when the advisor reopens a story.
7. Claim: the review found that `green_ci_on_head` leaked `draft` to the final state check. Evidence: `next.sh` read `draft` after the function call. Outcome: fixed in this PR with the top-level `pr_draft`.
8. Claim: the review found that § Review omitted the repair loop and that `/prd` § 7 omitted `--no-review`, and that the diagram label was ambiguous. Evidence: review findings on `delegate/SKILL.md` and `prd/SKILL.md`. Outcome: fixed in this PR.
9. Claim: the review found no test for a reopened story after `reviewed`. Evidence: `next.test.mjs` had no such case. Outcome: fixed in this PR with a new case.
10. Claim: the review reported that the review default contradicts issue #1658, that unowned findings have no rule, and that forced evidence adds conflict with `.gitignore`. Evidence: the operator asked for the default in this session; § Repair blocks on an unowned path; `git/references/manual-review.md` requires `git add -f`. Outcome: dropped, because each item is an operator decision or an existing rule.
11. Claim: the second review pass found that the `reviewed` field could go stale after a merge or a manual push. Evidence: the catch-up merge `1ee51121` changed files without § Repair. Outcome: fixed in this PR. The state script `next.sh` now treats the review as current only when no file outside `.agro/tasks` changed after the `reviewed` commit.
12. Claim: the second pass found three gaps in § Repair and § Review before `3efc74bd`. Review repairs used the CI repair budget, late findings missed the retro, and unowned findings blocked the task. Evidence: the second review pass. Outcome: fixed in this PR.
13. Claim: the second pass reported that a string `review` value turns the review off and that `green_ci_on_head` returns state through globals. Evidence: tests pin the JSON boolean, and the globals are explicit top-level names. Outcome: dropped, because tests specify and cover both behaviors.
14. Claim: the third review pass found defects that the pass-2 fixes caused. Close did not run on the review path, the review loop had no bound, and each catch-up merge forced a new review. Evidence: the third review pass. Outcome: fixed in this PR with the simplification that the operator approved in `6ee971ac` and `8e6ea7b6`.
15. Claim: the third pass found that a symbolic `reviewed` value such as `HEAD` always counted as current, and that `/git` § Ready for review copied the review rule. Evidence: `review_is_current` before `8e6ea7b6`. Outcome: fixed in this PR. The `reviewed` value must be a hex SHA, and `/git` defers to `next.sh`.
16. Claim: the review loop ran three passes, and each fix added rules that the next pass flagged. Evidence: 27 findings over three passes. Outcome: dropped as a process observation. The operator set a hard stop after one final pass.
17. Claim: the final review pass found that the freshness check misses code that arrives inside a merge commit. A worker branch merged with `git merge`, or a conflict resolution in a catch-up merge, skips the new review. Evidence: `review_is_current` walks `--first-parent --no-merges`. Outcome: proposed issue for operator approval. The hard stop allows no further repair round in this PR.
18. Claim: the final pass found that the `reviewed` pattern rejects SHA-256 and uppercase object names, and accepts an all-hex ref name. Evidence: the pattern `^[0-9a-f]{7,40}$` in `next.sh`. Outcome: dropped. The harness uses SHA-1 and lowercase `git rev-parse` output, and the advisor writes the value from `git rev-parse HEAD`.
19. Claim: the final pass found two stale sentences: the `external` field text in `tracker.md` and the `close` sentence in `prd/SKILL.md` § 5. Evidence: both sentences omit the `review` state. Outcome: dropped under the hard stop. The next edit of these files can correct both sentences.
20. Claim: the final pass found three design issues. Four prose copies restate the freshness rule. Each review pass waits for full CI. Non-Claude harnesses use an external page. Evidence: `delegate/SKILL.md`, `tracker.md`, and `git/SKILL.md`. Outcome: dropped. The copies are summaries, the CI gate is a design choice, and the operator chose the external page.
