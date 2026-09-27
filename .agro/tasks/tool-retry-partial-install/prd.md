# PRD: Tool install retry repairs a partial install

Status: DRAFT

## User Stories

### US-001: Red test for a skipped partial tool install

**Description:** As a maintainer, I want a failing test that reproduces issue #1246, so that the fix has a regression guard.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/__tests__/tool.test.ts` has a sandbox-path case: the first `tool install agent-browser` runs an install command that exits 1 after `verifyArgv` succeeds, and the second run must run the install command again.
- [ ] The test has a matching host-path case for a user-prefix tool with no receipt in `config.hostTools`.
- [ ] On the current code, both cases fail because the second run prints `already installed` and exits 0 (reproduction in issue #1246).

### US-002: Record tool completion only after the full install command exits 0

**Description:** As an operator, I want "already installed" to mean a completed tool install, so that a retry runs the failed steps again.

**Acceptance Criteria:**

- [ ] After the sandbox install command exits 0, `runToolInstall` writes the marker `/home/sandbox/.local/share/agro/tools/<id>.installed` through `target.exec` as the `sandbox` user.
- [ ] The sandbox path prints `already installed` only when `verifyArgv` succeeds and the marker exists.
- [ ] The host path prints `already installed` for a binary under `~/.local/bin` only when `config.hostTools[<id>]` exists. A binary outside `~/.local`, and a root-level tool (`hostInstallUser: "root"`), keep the current behavior.
- [ ] `agro tool uninstall <id>` removes the sandbox marker after a successful removal.
- [ ] The existing cases at `tool.test.ts` lines 355, 451, 546, 976, 1008, and 1784 pass, with fixture updates only for the marker check.
- [ ] `/home/sandbox/harness/node_modules/.bin/vitest run .agro/cli/src/__tests__/tool.test.ts` from the repository root exits 0, and `npx tsc --noEmit -p .` in `.agro/cli` exits 0.

### US-003: Documentation of the tool completion rule

**Description:** As an operator, I want the documentation to state when a tool counts as installed, so that a retry is predictable.

**Acceptance Criteria:**

- [ ] The completion paragraph in `docs/lifecycle-commands.md` that PR #1245 added also covers `agro tool install` and names `~/.local/share/agro/tools/<id>.installed`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` exits 0.

### US-004: CI evidence

**Description:** As a reviewer, I want CI evidence of the fix, so that I can accept it without a change to a live sandbox.

**Acceptance Criteria:**

- [ ] All PR checks pass, including "Typecheck, Build & Test".
- [ ] `.agro/tasks/tool-retry-partial-install/evidence/manual-review.md` records the PR run URL, the US-001 red output, and the green vitest output.
- [ ] The evidence changes no live sandbox.

## Summary

Verified on origin/development:

- `probeInstalled` in `.agro/cli/src/commands/tool.ts` (line 177) runs the `verifyArgv` of the catalog entry. For most tools, `verifyArgv` is `command -v <binary>`.
- `runToolInstall` (line 571) and `installOnHost` (line 472) print `already installed` when the probe succeeds. The sandbox path records no install state. The host path writes a receipt to `config.hostTools` (line 517), but the probe does not read it.
- `agent-browser` in `.agro/cli/src/lib/tools/catalog.ts` (line 40) runs `pnpm add -g`, then `chmod`, then `agent-browser install --with-deps`. The binary exists before the last step.
- `docker-engine` and `desktop` have `verifyArgv` commands that examine the full setup, so they have no partial-install gap.

Recommendation: use the #1244 model (PR #1245). Record completion after a full install, and treat a missing record as not installed. The alternative is a stronger `verifyArgv` for `agent-browser`. That alternative needs an unverified path for the browser download, and it leaves the gap open for the next multi-step tool.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/tool.ts` | `runToolInstall` (lines 539 to 600) | Sandbox probe, install, and marker write |
| `.agro/cli/src/commands/tool.ts` | `installOnHost` (lines 399 to 535) | Host probe; reads the existing receipt |
| `.agro/cli/src/commands/tool.ts` | `removeTool`, `runToolUninstall` (lines 603, 691) | Marker removal |
| `.agro/cli/src/lib/host-config.ts` | `HostToolReceipt`, `isRootToolReceipt` | Existing host record |
| `.agro/cli/src/commands/harness.ts` | `sandboxMarkerPath`, `sandboxMarkerExists`, `hostBinaryUnderPrefix` | Pattern from PR #1245 |
| `.agro/cli/src/__tests__/tool.test.ts` | cases listed in US-002 | Current "already installed" tests |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install <id>` | Behavior | A binary without a completion record runs the full install again |
| `agro tool uninstall <id>` | Behavior | Removes the sandbox marker |

## Storage

The sandbox marker is an empty file at `/home/sandbox/.local/share/agro/tools/<id>.installed` in the home mount. The host path uses the existing `config.hostTools` receipt.

## Architectural Decisions

- The completion record is the source of truth for "already installed". `verifyArgv` is necessary but not sufficient.
- Tools use a `tools` marker directory. The harness markers stay in `harnesses`, so a tool and a harness with the same id cannot collide.
- `agro tool status` and `agro tool list` keep `verifyArgv` alone.
- Root-level host tools keep the current behavior, because their `verifyArgv` examines the full setup.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool.test.ts` | the first run fails after the binary step; the second run runs the install command again (sandbox and host) | Issue #1246 repair |
| `.agro/cli/src/__tests__/tool.test.ts` | binary and record exist: the second run prints `already installed` | No reinstall of a complete install |
| `.agro/cli/src/__tests__/tool.test.ts` | uninstall removes the marker | Clean state after removal |

## Design Principles

- One completion model for harnesses and tools.
- No explanatory code comments.
- A shared helper only when the second use makes the duplicate larger than the helper.

## Out of Scope

- `docker-engine` and `desktop`.
- Changes to the upstream installers.
- A stronger `verifyArgv` for `agent-browser`.

## Open Questions

None. The operator approved both recommendations. The worker moves the marker helpers to a shared module only if a local copy exceeds the three small functions. An existing sandbox tool without a marker reinstalls one time.

## Acceptance Criteria

- [ ] A second `agro tool install <id>` after a failed first run runs the full install command again.
- [ ] A test proves the behavior with a partial install fixture.

## Lessons

1. The advisor created the first worker worktree under `.agro/tasks/tool-retry-partial-install/` in the main checkout, because the shell was in that directory. Outcome: dropped. The advisor removed the worktree with `git-maintenance.sh`, and the operator decides on the empty leftover directory.
2. A `--version` probe proves that the binary runs. The probe does not prove that the steps after the binary completed. Outcome: fixed in this PR by the completion record.
