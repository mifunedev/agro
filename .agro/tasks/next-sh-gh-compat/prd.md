# PRD: Read CI state in next.sh on gh 2.45.0

Status: DRAFT

## User Stories

### US-001: Read CI state from statusCheckRollup

**Description:** As an advisor, I want `next.sh` to read CI state on `gh` 2.45.0 so that a `/delegate` run does not stop at `blocked`.

**Files:** `.agro/skills/delegate/scripts/next.sh`, `.agro/skills/delegate/scripts/__tests__/fixture.mjs`, `.agro/skills/delegate/scripts/__tests__/next.test.mjs`, `.agro/skills/delegate/SKILL.md`, `CHANGELOG.md`

**Depends on:** none

**Acceptance Criteria:**

- [ ] `grep -c 'gh pr checks' .agro/skills/delegate/scripts/next.sh` prints `0`.
- [ ] The test stub exits non-zero with `unknown flag: --json` for `gh pr checks --json`.
- [ ] A test proves that a failed result and a later passing result of one check do not print `ci-red`.
- [ ] A test proves that a `CheckRun` and a `StatusContext` both map to each state: pass, skipping, cancel, pending, and fail.
- [ ] `pnpm exec vitest run .agro/skills/delegate/scripts/__tests__/next.test.mjs` exits 0.
- [ ] `/delegate` § Waves tells the advisor to wait in a foreground call for worker commits.

## Summary

`next.sh:116` calls `gh pr checks --json bucket`. `gh` 2.45.0 has no `--json` flag on `gh pr checks`, so `next.sh` prints `blocked gh unavailable: unknown flag: --json`. Issue #1567 records the defect.

`gh pr view 1566 --json statusCheckRollup` returned the check data on `gh` 2.45.0. A `CheckRun` entry has `name`, `workflowName`, `status`, `conclusion`, and `startedAt`. The plan reads the rollup in the `gh pr view` call at `next.sh:110`, because a test requires one `gh pr view` call.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/scripts/next.sh` | `pr_state`, `buckets` | Reads the PR head, the draft state, and the checks |
| `.agro/skills/delegate/scripts/__tests__/fixture.mjs` | `gh` stub | Must reject the flag that `gh` 2.45.0 rejects |
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | `ci and ci-red`, `gh failures` | Pins the state output |
| `.agro/skills/delegate/SKILL.md` | § Waves | Tells the advisor how to wait for workers |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `next.sh` output | None | The states and the action lines stay the same |

## Storage

N/A. The script stores no data.

## Architectural Decisions

- Map the rollup to the labels that `next.sh` uses: `pass`, `skipping`, `cancel`, `pending`, and `fail`.
- Keep the entry with the latest `startedAt` for each `workflowName` and `name`, so that a re-run replaces the earlier result.
- Keep the current order: a failure wins over a pending check, and no checks print `ci`.
- `/ci-status` stays unchanged, because `gh pr checks --watch` works on `gh` 2.45.0.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | Existing `ci and ci-red` cases through the new stub | The states stay the same |
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | Re-run case, one case for each mapped label | The rollup mapping and the latest-result rule |

## Design Principles

- Change the smallest amount of code that removes the failed call.
- Make the stub reject what the real `gh` rejects.

## Out of Scope

- A Stop hook change that detects workers.
- A `gh` upgrade.
- An evidence story. The advisor runs `next.sh` against the real PR at each lifecycle state, and the PR records that output.

## Open Questions

None

## Acceptance Criteria

- [ ] On `gh` 2.45.0, `bash .agro/skills/delegate/scripts/next.sh` prints `ready` for the task PR when CI passes and the PR is a draft.
- [ ] The advisor verifies the story in the main checkout.

## Lessons

- **The plan asked `StatusContext` to map to each state.** Evidence: `StatusContext` has no skipping or cancel state. The tests cover pass, pending, and fail for `StatusContext`. Outcome: dropped, because the plan wording was wrong and the code is correct.
- **The zero-time rule for a queued re-run comes from memory of the `gh` source.** Evidence: the worker did not observe the `0001-` value on real data. A test covers the rule. Outcome: dropped, because the rule makes a queued re-run print `ci`, and `ci` is the safe state.
