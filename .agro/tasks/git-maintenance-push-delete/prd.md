# PRD: git-maintenance push-delete

Status: DRAFT

## User Stories

### US-001: Delete a remote branch through the git maintenance shim

**Description:** As the operator, I want agents to delete a merged remote branch through `git-maintenance.sh`. cc-safety-net then keeps its guard on every other destructive git command.

**Acceptance Criteria:**

- [ ] `bash .agro/scripts/git-maintenance.sh push-delete <remote> <branch>` runs `git push <remote> --delete <branch>` and prints `git-maintenance.sh: ran: git push <remote> --delete <branch>`.
- [ ] For `<branch>` equal to `development`, `main`, or `master`, the verb exits 2, prints a refusal to stderr, and runs no push.
- [ ] With a wrong argument count, the verb prints the usage and exits 2.
- [ ] The usage text, the `/git` maintenance block in `.agro/skills/git/SKILL.md`, and section 3 of `docs/security-considerations.md` name `push-delete`.
- [ ] `.agro/scripts/__tests__/git-maintenance.test.ts` covers a delete against a local bare remote, each refused branch, and the usage error.
- [ ] `pnpm test:scripts` exits 0.

## Summary

cc-safety-net denies `git push --delete` (rule `git.push-delete`), and nobody can allowlist its built-in git rules. The repository routes other blocked git maintenance through `.agro/scripts/git-maintenance.sh`. The operator chose a shim verb over disabling cc-safety-net.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/git-maintenance.sh` | `usage`, `case` verbs | New `push-delete` verb |
| `.agro/skills/git/SKILL.md` | "Destructive git under the cc-safety-net guard" | Names the verb |
| `docs/security-considerations.md` | section 3 | Names the verb |
| `.agro/scripts/__tests__/git-maintenance.test.ts` | new file | Verb tests |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `git-maintenance.sh` | Added | `push-delete <remote> <branch>` |

## Storage

N/A. The change adds one shim verb.

## Architectural Decisions

- The verb refuses the integration and release branches. The refusal list is `development`, `main`, and `master`.
- cc-safety-net stays on. The shim stays the one route for blocked git maintenance.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/git-maintenance.test.ts` | Delete on a bare remote; refuse `development`, `main`, `master`; usage error | US-001 |

## Design Principles

- Keep one route for blocked git maintenance.
- Refuse the destructive case that has no recovery path.

## Out of Scope

- Changes to cc-safety-net or its hook.
- A manual-review evidence story. The test covers the shim command against a local bare remote.

## Open Questions

None.

## Acceptance Criteria

- [ ] US-001 passes its acceptance criteria.
- [ ] On the PR for this task, CI: Harness finishes green.

## Lessons

Filled by the advisor before undraft.
