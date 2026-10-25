# PRD: Task lifecycle owner

Status: DRAFT

## User Stories

### US-001: One approval runs the chain to a ready PR

**Description:** As the operator, I want one plan approval to run the task to a ready PR so that I give no nudges.

**Acceptance Criteria:**

- [ ] `git grep -n "Run the procedure only when the operator accepts" .agro/skills` exits 1.
- [ ] `git grep -n "authorizes no dispatch" .agro/skills` exits 1.
- [ ] `/prd` § 7 lists these steps in this order: open the issue, convert with `--issue <N>`, run `/git` § Draft PR steps 2 to 4, run `/delegate <slug>`.
- [ ] `.agro/skills/delegate/SKILL.md` has a `## Task lifecycle` section. The section has one table row for each state: `story`, `review`, `close`, `push`, `ci`, `ci-red`, `ready`, `done`, `blocked`, `none`.
- [ ] Each table row names the next action, the exit condition, and the owner.
- [ ] `## Task lifecycle` states the approval scope: the issue, `prd.json`, the draft PR, all waves, Close, the push, and `gh pr ready`. The merge stays with the operator.
- [ ] `## Task lifecycle` states that the run stops only at `done`, `blocked`, or `none`.
- [ ] `## Task lifecycle` states that live spend sets `blocked` and asks the operator.
- [ ] `/delegate` § Close puts proposed follow-up issues in the final report. Close does not wait for an answer. Issue creation still needs operator approval.
- [ ] `/git` § Draft PR links to `/delegate` § Task lifecycle for the approval rule and holds no second copy of the approval scope.
- [ ] The `/delegate` description triggers on an operator approval of the plan.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-002: Next-action script

**Description:** As the advisor, I want a script that prints the next state so that the next action comes from disk.

**Acceptance Criteria:**

- [ ] Write the red tests first in `.agro/skills/delegate/scripts/__tests__/next.test.mjs`. The tests fail before `next.sh` exists.
- [ ] `bash .agro/skills/delegate/scripts/next.sh` prints one state line, then one action line, and exits 0.
- [ ] The script finds the task when the current branch equals `prd.json.branchName` under `.agro/tasks/*/`.
- [ ] `--task <slug>` selects the task by slug instead of by branch.
- [ ] No match prints `none`. More than one match prints `blocked` with the matching slugs.
- [ ] An unreadable `prd.json` prints `blocked` with the path.
- [ ] The script evaluates the states in this order: `none`, `blocked`, `story`, `review`, `close`, `push`, `ci`, `ci-red`, `ready`, `done`.
- [ ] `story <id>` names the lowest-priority story with `passes: false` whose `dependsOn` stories pass.
- [ ] A story with `rounds` greater than 2 prints `blocked` with the story ID.
- [ ] `review` prints when `review.verdict` is not `pass`, or when `git diff --quiet <review.commit> HEAD -- . ':!.agro/tasks/<slug>'` exits 1.
- [ ] A commit that changes only `.agro/tasks/<slug>/` does not return the task to `review`.
- [ ] `close` prints when `prd.md` has no non-empty `## Lessons` section. The test uses the `awk` check from `/git` § Ready for review.
- [ ] `push` prints when local `HEAD` differs from the remote task branch head.
- [ ] `ci` prints when a PR check is pending. `ci-red` prints when a PR check failed.
- [ ] `ready` prints when the PR is a draft. `done` prints when the PR is not a draft.
- [ ] The tests run against fixture repositories with a stub `gh` on `PATH`. The tests make no network call.
- [ ] `.agro/skills/prd/references/tracker.md` documents the optional fields `pr`, `blocked`, `review`, and per-story `rounds` with no `schemaVersion` change.
- [ ] `pnpm test` exits 0.

### US-003: Stop hooks for Claude Code and Codex

**Description:** As the operator, I want the harness to refuse an early stop so that a session continues while an agent-actionable state remains.

**Acceptance Criteria:**

- [ ] Write the red tests first in `.agro/scripts/__tests__/hooks.test.ts`. The tests fail before `.agro/hooks/task-next-stop.sh` exists.
- [ ] For the states `story`, `review`, `close`, `push`, `ci`, `ci-red`, and `ready`, the hook prints JSON with `"decision": "block"`. The `reason` holds the `next.sh` output.
- [ ] For the states `none`, `blocked`, and `done`, the hook prints nothing and exits 0.
- [ ] If `next.sh` exits non-zero, the hook prints nothing and exits 0.
- [ ] The hook keeps a counter at `$(git rev-parse --git-path agro-next-stop)`. After 3 blocks with the same state and the same `HEAD`, the hook allows the stop.
- [ ] At that release, the hook runs `.agro/skills/escalate/scripts/escalate.sh` one time with `--key <slug>-<state>`.
- [ ] Two worktrees keep separate counters. A test proves that a block in one worktree does not change the counter of the other worktree.
- [ ] `.claude/settings.json` has a `Stop` entry that runs `.claude/hooks/task-next-stop.sh`.
- [ ] `.codex/hooks.json` has a `Stop` entry that runs `.codex/hooks/task-next-stop.sh`. The wrapper calls the canonical hook.
- [ ] `.agro/tasks/task-lifecycle-owner/evidence/codex-stop.md` records the installed Codex version and one executed Stop hook run. If Codex rejects the `Stop` event, the advisor removes the Codex entry and records the result.
- [ ] `required_execs` in `.agro/scripts/link-providers.sh` lists `.agro/hooks/task-next-stop.sh`. `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md`, and `docs/harnesses/pi.md` state the Stop hook behavior. The Pi page states that the operator or the agent runs `next.sh` by hand.
- [ ] `pnpm test` exits 0.

### US-004: Repair cap and CI results

**Description:** As the advisor, I want each repair loop and CI wait to end in a named state so that no stop lacks a reason.

**Acceptance Criteria:**

- [ ] `git grep -n "Then fix the issue, commit, push" .agro/skills/ci-status/SKILL.md` exits 1.
- [ ] `/ci-status` reports exactly one of `PASS`, `FAIL`, `NO-RUN`, or `TIMEOUT`. `/ci-status` makes no edit.
- [ ] `/ci-status` waits with `timeout 900 gh pr checks <N> --watch`. Exit code 124 reports `TIMEOUT`.
- [ ] `/delegate` § Acceptance states the repair rule. The advisor reopens the story whose `files` hold the failing path: `passes: false` and `rounds` plus 1. The same worker repairs the story.
- [ ] `/delegate` § Acceptance states that the advisor sets `blocked` and runs `/escalate` one time in each of these cases: `rounds` is greater than 2, a round does not decrease the set of failed checks, no story owns the failing path, or `/ci-status` reports `NO-RUN` or `TIMEOUT`.
- [ ] `/git` § Draft PR replaces the two-push rule with one rule: the advisor pushes only when `next.sh` prints `push`.
- [ ] `/supervisor` reads `next.sh` output to judge done. `/supervisor` does not restate the lifecycle states.
- [ ] `pnpm test` exits 0.

### US-005: One reviewer at Close

**Description:** As the advisor, I want one fresh-context review of the PR diff so that a second reader checks the work.

**Acceptance Criteria:**

- [ ] `/delegate` has a `## Reviewer brief` section based on commit `ff1fbd5b`. The section drops the per-story `review: true` flag.
- [ ] The brief states that the reviewer starts in a fresh context, edits no file, and never continues an earlier worker.
- [ ] The brief states that the reviewer reads `git diff <base>...HEAD`.
- [ ] The brief states that a `blocking` finding names a reproducing command. A finding with no command is `non-blocking`.
- [ ] `/delegate` § Acceptance states that the advisor runs each blocking command before it reopens a story.
- [ ] The advisor writes `review.commit`, `review.verdict`, and `review.model` in `prd.json`.
- [ ] `/delegate` § Model policy states that the reviewer uses a model other than the implementer model when one is available. Otherwise the reviewer uses the implementer model in a fresh context, and `review.model` records that fact.
- [ ] Non-blocking findings go to the PR `## What remains unverified` section.

### US-006: Manual review evidence

**Description:** As the operator, I want a transcript of this task run so that I can verify the chain needs no nudges.

**Acceptance Criteria:**

- [ ] `.agro/tasks/task-lifecycle-owner/evidence/manual-review.md` holds the `next.sh` output at each accepted-story commit of this task, from `story US-001` to `story US-006`.
- [ ] The transcript shows one Claude Code Stop hook block and the session continuing after the block.
- [ ] The transcript shows the no-progress release after 3 blocks in a fixture worktree.
- [ ] The transcript records the count of operator nudges between plan approval and `ready`. The target is 0.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <pr-body-file>` exits 0.

## Summary

Five explorers agreed on one cause. The plans are good. No single skill owns the path from approval to a ready PR. The transcripts hold about 141 bare operator nudges. About 44 of them fall at gates that the skills define.

Verified current state:

- `/prd` § 7 asks for approval, then only offers the draft PR.
- The `/delegate` description says that a plan "authorizes no dispatch".
- `/delegate` § Close waits for approval of proposed follow-up issues.
- `tracker.md` requires `--issue <N>`. `/git` § Draft PR creates the issue after the conversion.
- `/ci-status` tells the advisor to fix, commit, and push on FAIL. That rule conflicts with ADR #989 and with the two-push rule.
- `/ci-status` polls for 5 minutes and defines no result after that limit.
- `.claude/settings.json` and `.codex/hooks.json` have no `Stop` hook.

Selected approach: `/delegate` owns the lifecycle. `next.sh` derives one state from `prd.json`, git, and `gh`. Thin Stop hooks block an early stop. One repair rule and one reviewer at Close close the loop. The Architecture Brief in the planning conversation holds the options and the tradeoffs.

Recent `ci-harness.yml` runs finish in 0 to 1 minutes. Recent `sandbox-boot-guard.yml` runs finish in 1 to 2 minutes. The 900-second watch timeout gives more than 7 times that margin.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | `## Task lifecycle`, `## Acceptance`, `## Reviewer brief`, `## Close`, `## Model policy` | Owns the state table, repair rule, and reviewer |
| `.agro/skills/delegate/scripts/next.sh` | state derivation | New single source of the next action |
| `.agro/skills/prd/SKILL.md` | § 7 | Hands the approved plan to `/delegate` |
| `.agro/skills/prd/references/tracker.md` | optional fields | Documents `pr`, `blocked`, `review`, `rounds` |
| `.agro/skills/git/SKILL.md` | § Draft PR, § Ready for review | Keeps the mechanics, links the approval rule |
| `.agro/skills/ci-status/SKILL.md` | step 4, step 7 | Reports one of four results, makes no edit |
| `.agro/skills/supervisor/SKILL.md` | Definition of Done | Reads `next.sh` output |
| `.agro/hooks/task-next-stop.sh` | Stop hook | New canonical hook |
| `.claude/settings.json` | `hooks.Stop` | Claude Code adapter |
| `.codex/hooks.json`, `.codex/hooks/task-next-stop.sh` | `hooks.Stop` | Codex adapter |
| `.agro/scripts/link-providers.sh` | `required_execs` | Checks the new executables |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `next.sh` output | new | Line 1 holds the state and its argument. Line 2 holds the action. |
| `prd.json` | additive | Optional fields `pr`, `blocked`, `review`, and per-story `rounds` |
| Claude Code `Stop` event | new | `{"decision": "block", "reason": "<next.sh output>"}` |
| Codex `Stop` event | new | Same contract through the wrapper |
| `/ci-status` result | changed | `PASS`, `FAIL`, `NO-RUN`, or `TIMEOUT`, with no edit |

## Storage

The state stays in `.agro/tasks/<slug>/prd.json`. The new fields are optional, so `schemaVersion` stays `1`. The hook counter lives at `$(git rev-parse --git-path agro-next-stop)`. Git keeps that path per worktree and does not track the file.

## Architectural Decisions

- The presence of `prd.json` on the task branch is the approval record. `/prd` § 7 writes `prd.json` only after an explicit operator approval.
- The current branch binds a session to a task. Worker branches never match `branchName`, so the hook ignores workers.
- `next.sh` derives each state from facts. The advisor writes only `pr`, `blocked`, `review`, `rounds`, `passes`, `commit`, and `notes`.
- Repairs reopen the story that owns the failing path. The advisor never repairs, per ADR #989.
- The hook fails open. A script error or a missing `gh` allows the stop.
- Durable decision: propose `ADR: Plan approval runs a task to a ready PR; /delegate owns the task lifecycle`. The issue waits for operator approval.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | one fixture for each state; branch binding; `--task`; two matches; unreadable `prd.json`; task-folder-only commit; `rounds` cap | US-002 |
| `.agro/scripts/__tests__/hooks.test.ts` | block states; pass states; script error; counter release after 3; per-worktree counter; settings wiring | US-003 |
| `.agro/scripts/__tests__/hooks.test.ts` | `.claude/settings.json` and `.codex/hooks.json` hold the `Stop` entry | US-003 |
| `.agro/tasks/task-lifecycle-owner/evidence/manual-review.md` | live run of this task | US-006 |

## Design Principles

- Keep one source of truth: the state table in `/delegate` and the derivation in `next.sh`.
- Delete gate text instead of adding a second copy.
- Keep provider files thin. Keep each rule in `.agro/`.
- End every loop in a named state.
- Express intent in code and tests. Add no explanatory comments to tracked code.

## Out of Scope

- Auto-merge.
- A new `agro` verb.
- A Pi extension, a Prime Agent adapter, or an fx adapter.
- Per-story review.
- Fresh-VM verification for each story.
- Creation of the ADR issue before operator approval.

## Open Questions

None. US-003 settles Codex `Stop` support by an executed check.

## Acceptance Criteria

- [ ] Each story in `prd.json` has `passes: true`.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `/ci-status` reports `PASS` on the task branch.
- [ ] The operator gives 0 nudges between plan approval and `ready`, per the US-006 transcript.
- [ ] At Close, the advisor appends the `next.sh` output of the `review`, `close`, `push`, `ci`, and `ready` states to the US-006 transcript.
- [ ] At Close, the advisor appends the reviewer verdict and each blocking finding with its command result to the US-006 transcript.

## Lessons

Filled by the advisor before undraft.
