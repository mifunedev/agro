# PRD: Align worktree documentation with the main-checkout default

Status: DRAFT

## User Stories

### US-001: Point the advisor section of AGENTS.md at /worktrees

**Description:** As an agent that reads `AGENTS.md`, I want the advisor section to name `/worktrees` § DECIDE so that I do not assume a worktree.

**Files:** `AGENTS.md`

**Depends on:** none

**Acceptance Criteria:**

- [ ] `grep -c 'worktree boundaries' AGENTS.md` prints `0`.
- [ ] The section `## One advisor, bounded workers` in `AGENTS.md` names `/worktrees` § DECIDE as the owner of the worktree decision.
- [ ] `git diff <base> -- AGENTS.md` shows no change to `### 4. Parallel work does not share mutable state`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/behavioral-training-replay.test.ts .agro/scripts/__tests__/unrequested-action-replay.test.ts` exits 0.

### US-002: Show the main checkout first in the README quickstart

**Description:** As a new user, I want the quickstart to start work in the project clone so that I learn the default flow first.

**Files:** `README.md`

**Depends on:** none

**Acceptance Criteria:**

- [ ] `grep -c 'Then ask for an isolated workspace' README.md` prints `0`.
- [ ] The quickstart states that the agent works in the main checkout of the project clone by default.
- [ ] The quickstart keeps `Create a worktree in <owner>/<repo> for issue #123.` as a request that the user can make.
- [ ] The quickstart keeps the statement that each parallel agent gets its own branch and worktree.

### US-003: Replace the worktree tips in the harness documents

**Description:** As a harness user, I want the tips to match `/worktrees` so that the Claude Code and Codex documents give the same guidance.

**Files:** `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md`

**Depends on:** US-001, US-002

**Acceptance Criteria:**

- [ ] `grep -c 'Use worktrees to' docs/harnesses/claude-code.md docs/harnesses/codex.md` prints `0` for each file.
- [ ] Each of the two `## Tips` sections states that work starts in the main checkout and names `/worktrees` § DECIDE.
- [ ] Neither document restates the § DECIDE conditions.

## Summary

PR #1564 made the main checkout the default and made `/worktrees` § DECIDE the only copy of the worktree rule. Four documents still read as worktree-first:

- `AGENTS.md:68` says "preserve the sandbox and worktree boundaries" and gives no parallel condition.
- `README.md:306-319` shows the worktree request as the only quickstart path.
- `docs/harnesses/claude-code.md:80` and `docs/harnesses/codex.md:102` advise worktrees with no condition.

This task is also the first real run of the `/delegate` wave loop. US-001 and US-002 share wave 1 and own different files. § DECIDE answers worktree for both stories, so wave 1 runs in parallel and consolidates into the main checkout. US-003 is the only story in wave 2. § DECIDE answers main checkout for US-003, so wave 2 runs in the task checkout.

The dependency of US-003 on US-001 and US-002 is deliberate. US-003 uses the wording of the two earlier stories, and the dependency also gives the trial a second wave.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `AGENTS.md` | `## One advisor, bounded workers` | Root context that names the owner of the worktree decision |
| `README.md` | Quickstart lines 306-319 | First worktree guidance that a new user reads |
| `docs/harnesses/claude-code.md` | `## Tips` | Claude Code guidance |
| `docs/harnesses/codex.md` | `## Tips` | Codex guidance |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Root agent context | Modify | One sentence in `AGENTS.md` |
| Public documentation | Modify | README quickstart and two harness documents |

## Storage

N/A. The task changes documents and stores no data.

## Architectural Decisions

- `/worktrees` § DECIDE stays the only copy of the decision rule. Each document points to § DECIDE and restates no condition.
- `AGENTS.md` non-negotiable 4 stays unchanged.
- An idle session is not an agent that works in the checkout. When a session in the main checkout starts work during the run, § DECIDE answers worktree for the next story.
- The task records each wave-loop problem in `## Lessons` and fixes no skill in this PR.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/behavioral-training-replay.test.ts` | Existing `AGENTS.md` replay cases | The `AGENTS.md` edit keeps the replay contract |
| `.agro/scripts/__tests__/unrequested-action-replay.test.ts` | Existing `AGENTS.md` replay cases | The `AGENTS.md` edit keeps the replay contract |

The other criteria are `grep` checks. The task adds no test, because the change is documentation only.

## Design Principles

- Change the smallest amount of text that removes the worktree-first reading.
- Keep one source of truth for each policy.
- Run acceptance in the main checkout.

## Out of Scope

- `/delegate`, `/worktrees`, `/git`, `/rsi`, and `/supervisor` skill text.
- `README.md:19`, `.worktrees/AGENTS.md`, and `docs/integrations/herdr.md`. These documents describe parallel work or the worktree location, not a default.
- An evidence story. The plan has no user interface change and no server, CLI, or API change.

## Open Questions

None

## Acceptance Criteria

- [ ] `grep -nEi 'isolated workspace|worktree boundaries|Use worktrees to' AGENTS.md README.md docs/harnesses/claude-code.md docs/harnesses/codex.md` prints nothing.
- [ ] The worktree decision conditions appear only in `.agro/skills/worktrees/SKILL.md`.
- [ ] The advisor verifies each story in the main checkout.
- [ ] `## Lessons` records each wave-loop problem that the run exposes, with one outcome for each problem.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]`, or the PR states that the change is a pure chore.

## Lessons

- **The wave loop ran as written.** Evidence: wave 1 used two worktrees and consolidated with no conflict. Wave 2 ran in the task checkout. The run did not use repair, a consolidation conflict, or the detached switch. Outcome: dropped, because the run found no defect.
- **The Stop hook blocks the stop while workers run.** Evidence: the hook printed `story US-001` during wave 1. A third block allows the stop and runs `/escalate` with no real problem. Outcome: dropped as tooling friction. The advisor waited in a foreground call.
- **The advisor ran a stray `git commit --no-verify`.** Evidence: the US-001 acceptance command made that commit and undid it with a soft reset. The kept commit `a21840128` ran the hooks. Outcome: dropped as a process error. The operator receives this report.
- **The run did not measure the install cost of each worktree.** Evidence: the wave 1 setup recorded no duration. Outcome: dropped, because the evidence supports no change.
- **`next.sh` cannot read CI state on `gh` 2.45.0.** Evidence: `next.sh` printed `blocked gh unavailable: unknown flag: --json` after CI passed. Outcome: issue #1567.
