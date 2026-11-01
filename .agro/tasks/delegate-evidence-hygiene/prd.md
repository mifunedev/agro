# PRD: Delegate evidence hygiene

Status: DRAFT

## User Stories

### US-001: Name the cleanup route and process cleanup in the worker brief

**Description:** As an advisor, I want each worker to clean up worktrees, branches, and processes through the sanctioned route. The advisor then stops resolving guard blocks and orphan processes by hand.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Worker brief has a rule that a worker removes a worktree only with `bash .agro/scripts/git-maintenance.sh worktree-remove <path>` and deletes a branch only with `bash .agro/scripts/git-maintenance.sh branch-delete <branch>`.
- [ ] § Worker brief has a rule that a worker stops each process that the worker starts before the worker reports, and reports each process that the worker cannot stop.
- [ ] § Worker brief has a rule that a worker never stops a process that the worker did not start.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md` reports no finding on a changed line.
- [ ] `pnpm test` exits 0.

### US-002: Make evidence stories safe to run

**Description:** As a worker, I want the evidence rules of `/prd` to match the guards and the shared environment. An evidence story then runs without an advisor decision.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` § Stories states that an evidence story passes environment values inline on the command and never writes an env file.
- [ ] § Stories states that, before a live or local boot, the evidence story checks that each port the boot binds is free. If a port is busy, the story sets `blocked`, names the process that holds the port, and stops no process.
- [ ] § 3 Ground the plan states that each route, path, and command that the plan cites resolves on the current node, and that the plan names a placeholder and an open question for each one that does not resolve.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` reports no finding on a changed line.
- [ ] `pnpm test` exits 0.

### US-003: Report a merge conflict as the cause of NO-RUN

**Description:** As an advisor, I want `/ci-status` to name a merge conflict when an open PR has no checks. I then merge the base branch at once instead of waiting.

**Acceptance Criteria:**

- [ ] `.agro/skills/ci-status/SKILL.md` step 2 runs `gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable --jq .mergeable` when `gh pr checks` prints no rows.
- [ ] When that command prints `CONFLICTING`, the skill reports NO-RUN with the cause: the PR conflicts with its base branch, and GitHub runs no `pull_request` workflow until the author merges the base branch.
- [ ] The NO-RUN entry of step 6 names the conflict cause.
- [ ] The skill still reports exactly one of PASS, FAIL, NO-RUN, or TIMEOUT.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ci-status/SKILL.md` reports no finding on a changed line.
- [ ] `pnpm test` exits 0.

## Summary

Verified at `671cc4c8`. A session on 2026-10-31 ran three agro-console tasks (PRs #639, #643, #641) through `/delegate`. The advisor stepped in for these causes:

- Guards blocked `git worktree remove --force`, `git checkout <ref> -- <path>`, and `rm -rf "$VAR"` from workers. `/delegate` § Worker brief (lines 113-129) does not name `.agro/scripts/git-maintenance.sh`. `/git` names the shim at `.agro/skills/git/SKILL.md:174-178`.
- Workers left seven orphan processes from manual probes. § Worker brief has no process rule.
- An evidence story told a worker to write a temp env file. The secret-exposure guard denies each env-file write. `/prd` § Stories (lines 174-182) prescribes no way to pass values.
- An evidence story needed ports 3005 and 8788, which the operator's dev stack held. `/prd` has no port preflight.
- Two plans cited a route and a checker path that did not exist on the node. `/prd` § 3 (lines 78-90) does not require resolution of cited paths.
- PR #643 conflicted with its base. `gh pr checks` printed no rows, and `/ci-status` (lines 57 and 99) names no conflict cause.

Approach: add short rules to the three canonical skill files. No script or hook changes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/SKILL.md` | § Worker brief | Worker cleanup rules |
| `.agro/skills/prd/SKILL.md` | § 3 Ground the plan, § Stories | Evidence story rules |
| `.agro/skills/ci-status/SKILL.md` | step 2, step 6 NO-RUN | Conflict cause |
| `.agro/scripts/git-maintenance.sh` | `worktree-remove`, `branch-delete` | Existing route; unchanged |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/delegate` worker brief | Added rules | Cleanup route and process cleanup |
| `/prd` plans | Added rules | Inline values, port preflight, resolved citations |
| `/ci-status` report | Added cause | NO-RUN names a merge conflict |

## Storage

N/A. The change edits skill text only.

## Architectural Decisions

- Each rule lives in one canonical file under `.agro/skills/`. `.claude/skills` links to `.agro/skills`, so no mirror changes.
- `/ci-status` keeps four outcomes. The conflict is a cause of NO-RUN, not a fifth outcome.
- No guard changes. The rules route work through paths that the guards allow.

Affected surfaces:

- Host and sandbox: not applicable. The change edits text only.
- Lifecycle door: not applicable.
- Canonical and provider surfaces: applied. The change edits canonical files only.
- Root and scaffold: applied. Initialized projects receive the skills.
- Interactive and headless processes: applied. Workers stop the processes that they start.
- Local and remote operation: not applicable.
- Parallel operation: applied. A worker stops only its own processes.
- Public documentation: not applicable. No `docs/` page describes these rules.
- Verification: applied. `pnpm test` and the checker prove the change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | existing cases | Skill links still resolve |
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | existing cases | `next.sh` unchanged |
| `.agro/skills/ste/scripts/ste-check.sh` | three changed files | Prose rules |

## Design Principles

- Add the smallest rule that removes each observed intervention.
- Keep one copy of each rule. Link to `/git` for the shim list instead of a second list.
- Write in Simplified Technical English.

## Out of Scope

- A change to a guard, including the jq `env` false positive.
- A new `/retro` skill.
- A manual review evidence story. The change has no user interface, server, CLI, or API surface. Close fills the PR `## Manual review` section with the `grep` commands that show each new rule.

## Open Questions

None.

## Acceptance Criteria

- [ ] `pnpm test` exits 0 at the harness root.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` reports no finding on a changed line of the three skill files.
- [ ] `git diff --name-only origin/development...HEAD` lists only the three skill files and the task files.

## Lessons

1. Claim: the first `/ci-status` edit made "Otherwise" ambiguous, and GitHub can report `mergeable` as `UNKNOWN` right after a push. Evidence: first review, findings 1 and 2. Outcome: fixed in this PR (US-003 repair round 1). The `UNKNOWN` retry goes beyond the plan criteria, and this lesson records the addition.
2. Claim: the shim always forces removal, and the process rule has no exception for a service that the brief asks a worker to keep. Evidence: first review, findings 3 and 4. Outcome: dropped, because the advisor removes worker worktrees at Accept and no current brief asks a worker to keep a service.
3. Claim: "apply the same rule" after a second `UNKNOWN` can read as another retry. Evidence: second review, finding 1. Outcome: dropped, because the text says "one more time".
4. Claim: a route check cannot run against a server while the plan grounds statically. Evidence: second review, finding 2. Outcome: dropped, because a planner confirms a route in its source definition, which the static grounding rule allows.
5. Claim: the secret-exposure guard denied `jq` commands whose literal text held the words "env file" or `dev-env`. Evidence: this run and the three agro-console runs. Outcome: dropped, because the plan puts guard changes out of scope. The operator decides on a guard change.
