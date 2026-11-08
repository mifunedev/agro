# PRD: Retro run guardrails

Status: DRAFT

## User Stories

### US-001: next.sh tracks an external story

**Description:** As an advisor, I want `next.sh` to skip an external story so that an operator-owned step does not block Close.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/references/tracker.md` defines an optional story field `external` (boolean) for a story that another agent or the operator controls.
- [ ] `.agro/skills/prd/references/tracker.md` defines an optional story field `external` (boolean). The field marks a story that another agent or the operator controls.
- [ ] `.agro/skills/delegate/scripts/next.sh` treats a story with `external: true` and `passes` other than `true` as tracked. The script prints no `story <id>` line for the story, and Close, push, CI, and ready proceed.
- [ ] `.agro/skills/delegate/scripts/__tests__/next.test.mjs` covers the skip, the dependency case, and a file without the field.
- [ ] The `external` rule in `.agro/skills/prd/SKILL.md` names the field; US-002 owns that edit.

### US-002: Probe stories and registry callers in plans

**Description:** As an advisor, I want probe stories and registry owners in plans so that no worker blocks on a missed fact.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` § 5 holds a probe rule for a plan that adds a new execution environment or runtime path. The first story of that plan measures the real environment before any design story.
- [ ] `.agro/skills/prd/SKILL.md` § 3 extends the caller rule to central registries, for example a verb table, a tool catalog, or a configuration field table. The advisor adds each registry file to the `files` of the story that adds an entry.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md` reports no new finding on the changed lines.

### US-003: Open branches take development after a release

**Description:** As an advisor, I want each open task branch to merge `development` after a release so that the changelog does not conflict at CI time.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Releases holds a merge rule. After a release merges into `development`, the advisor merges `development` into each open task branch of the advisor before the next push of that branch.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/git/SKILL.md` reports no new finding on the changed lines.

### US-004: agro node check

**Description:** As an operator, I want a read-only node check so that a node create fails before the console creates a node.

**Acceptance Criteria:**

- [ ] `agro node check [--free-tier] [--ssh-key <uuid>]...` calls only `GET` endpoints of the console in the stored credentials.
- [ ] Without `--ssh-key`, the check finds the public key `~/.ssh/id_ed25519.pub` among `GET /api/ssh-keys` by key identity. With `--ssh-key`, the check finds each id in that list.
- [ ] With `--free-tier`, the check reads `GET /api/free-tier` and fails unless `eligible` is `true`.
- [ ] The check prints one line for each check and exits 0 only when each check passes. A failure names the remedy.
- [ ] `NODE_VERBS` in `.agro/cli/src/command-table.ts` lists `check`, and the node help lists the verb.
- [ ] Tests in `.agro/cli/src/__tests__/` cover each check, each failure, and the absence of a `POST` call.
- [ ] `agro run -- pnpm typecheck` exits 0, and `agro run -- pnpm test` shows no new failure against `evidence/baseline.md`.

### US-005: Console preflight uses the node check

- [ ] `console_preflight` in `.agro/skills/remote-sandbox/adapters/console.sh` runs `agro node check` with `--free-tier` unless `CONSOLE_FREE_TIER=0`. When `CONSOLE_SSH_KEY_ID` holds a value, the preflight adds `--ssh-key "$CONSOLE_SSH_KEY_ID"`.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/SKILL.md` describes the preflight.
- [ ] `console_create` runs `console_preflight` first and creates no node when the preflight fails.
- [ ] `CONSOLE_SSH_IDENTITY` stays required, and the adapter sets no default identity path.
- [ ] `.agro/skills/remote-sandbox/SKILL.md` describes the preflight.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/remote-sandbox-adapters.test.ts` passes with a case for the preflight failure.

### US-006: Changelog and evidence

**Description:** As a reviewer, I want a changelog entry and a transcript so that I can confirm the node check against a live console.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` holds entries under `## [Unreleased]` that link the task issue.
- [ ] `.agro/tasks/retro-run-guardrails/evidence/manual-review.md` records `agro node check --free-tier` against the local console, with its output and exit code.

## Summary

The retro of the ADR #1575 cycle found these defects:

- The `external` label of `/prd` could not keep a story open, because `next.sh` requires `passes: true` on each story.
- The first `agro run` validation failed with 78 failures, because the plan had no probe story for the container path.
- A worker blocked on the verb registry `command-table.ts`.
- Three branches hit changelog conflicts after releases.
- Two live node attempts failed at `agro node create` for a missing default key and for `FREE_TIER_INELIGIBLE`, because the preflight checked only `agro node list`.

The console exposes `GET /api/ssh-keys` and `GET /api/free-tier`; the free-tier body holds `eligible`. The operator kept `CONSOLE_SSH_IDENTITY` required.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/delegate/scripts/next.sh` | story selection | External skip |
| `.agro/skills/prd/SKILL.md`, `references/tracker.md` | rules, schema | Probe, registry, external field |
| `.agro/skills/git/SKILL.md` | § Releases | Merge rule |
| `.agro/cli/src/commands/node.ts`, `command-table.ts` | `node check` | Read-only check |
| `.agro/skills/remote-sandbox/adapters/console.sh` | `console_preflight`, `console_create` | Fail fast |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `prd.json` | Added | Optional story field `external` |
| `agro node check` | Added | Read-only console check |

## Storage
N/A. The change keeps no state.

## Architectural Decisions
The node check calls only `GET` endpoints. The adapter keeps an explicit private key path.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/delegate/scripts/__tests__/next.test.mjs` | external skip, dependency, absent field | US-001 |
| `.agro/cli/src/__tests__/node.test.ts` (or the existing node test file) | key, free tier, failures, no POST | US-004 |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | preflight failure stops create | US-005 |

## Design Principles
Keep each rule in its owning skill. Keep the check read-only. Add no explanatory comments.

## Out of Scope
The secret-exposure guard. The npm token. The live node run of #1594.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons
