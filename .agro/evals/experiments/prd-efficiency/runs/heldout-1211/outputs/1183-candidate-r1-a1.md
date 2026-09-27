# PRD: Use `harness` as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Change the implicit workspace name to `harness`

**Description:** As an operator, I want the implicit host workspace to be `~/.agro/workspaces/harness` so that the host name matches the sandbox harness directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] Red test first: `defaultHarnessRoot({}, home)` in `.agro/cli/src/lib/__tests__/host-config.test.ts` expects `join(home, ".agro", "workspaces", "harness")`. The test fails before the constant changes and passes after the change.
- [ ] `resolveHarnessRoot(undefined, {}, home)` returns `<home>/.agro/workspaces/harness` when `~/.agro/config.json` has no `harnessRoot`.
- [ ] `runWorkspaceCreate(undefined, ...)` in `.agro/cli/src/__tests__/workspace.test.ts` clones into `workspacePath(home, "harness")`.
- [ ] A new case in `.agro/cli/src/__tests__/workspace.test.ts` runs `runWorkspaceCreate("default", ...)` and asserts a clone into `workspacePath(home, "default")`.
- [ ] A new case in `.agro/cli/src/lib/__tests__/host-config.test.ts` records `harnessRoot` as `<home>/.agro/workspaces/default` and asserts that `resolveHarnessRoot(undefined, {}, home)` returns that recorded path.
- [ ] The `defaultRoot` helpers at `.agro/cli/src/__tests__/harness.test.ts:72` and `.agro/cli/src/__tests__/tool.test.ts:93` return `join(home.dir, "workspaces", "harness")`.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Update help text, docs, and changelog

**Description:** As an operator, I want the CLI help and the docs to name `~/.agro/workspaces/harness` so that the documented fallback matches the resolved fallback.

**Acceptance Criteria:**

- [ ] `agro harness --help` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `agro tool --help` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `agro workspace --help` output states that the default name is `harness`.
- [ ] The assertion at `.agro/cli/src/__tests__/harness.test.ts:1500` expects `~/.agro/workspaces/harness`.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src/cli.ts` prints no line.
- [ ] `docs/lifecycle-commands.md` states that the default name for `agro workspace create` is `harness`.
- [ ] `CHANGELOG.md` has one `### Changed` entry under `## [Unreleased]` that links issue 1183.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` sets `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` at `.agro/cli/src/lib/host-config.ts:55` joins the workspace registry with `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` at `.agro/cli/src/lib/host-config.ts:161` uses this order: the explicit path, then `harnessRoot` from `~/.agro/config.json`, then `defaultHarnessRoot`.
- `runWorkspaceCreate` at `.agro/cli/src/commands/workspace.ts:80` uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox harness directory is `/home/sandbox/harness`. The entrypoint and compose tests under `.agro/scripts/__tests__/` assert this path.

Selected approach: change the value of `DEFAULT_WORKSPACE_NAME` to `"harness"`. The host install and `agro workspace create` both read `DEFAULT_WORKSPACE_NAME`, so the two fallbacks stay aligned. A recorded `harnessRoot` has precedence over the fallback, so recorded roots keep working. `assertWorkspaceName` accepts `default`, so an explicit `default` workspace keeps working.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the implicit workspace name and the root precedence |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` (line 80) | Uses the implicit name when the operator gives no name |
| `.agro/cli/src/cli.ts` | harness help (line 364), workspace help (line 395), tool help (line 467) | Prints the fallback path and the default name |
| `docs/lifecycle-commands.md` | lines 302, 344, 347, 355 | Documents the host install fallback and `agro workspace create` |
| `docs/harnesses/overview.md` | lines 40, 82 | Documents the harness root precedence |
| `docs/installation.md` | line 240 | Documents the host tool install fallback |
| `CHANGELOG.md` | `## [Unreleased]` | Records the user-facing change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install <id>` on the host | Behavior | With no `--workspace`, no `--path`, and no recorded `harnessRoot`, the command resolves `~/.agro/workspaces/harness`. |
| `agro tool install <id>` on the host | Behavior | The same fallback applies through `resolveHarnessRoot`. |
| `agro workspace create` | Behavior | With no name, the command clones into `~/.agro/workspaces/harness`. |
| `agro harness --help`, `agro tool --help`, `agro workspace --help` | Text | The help names `harness` as the fallback. |

## Storage

The registry stays at `${AGRO_HOME:-~/.agro}/workspaces/<name>/`. The `harnessRoot` key in `~/.agro/config.json` keeps its format. This task adds no migration and moves no directory.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the implicit name.
- The precedence in `resolveHarnessRoot` does not change.
- The CLI does not rename, move, or delete an existing `~/.agro/workspaces/default` directory.

Surface review:

- Host and sandbox: applied. The change is in the host CLI. The sandbox path `/home/sandbox/harness` does not change.
- Lifecycle door: applied. `agro harness`, `agro tool`, and `agro workspace` share the constant.
- Canonical and provider surfaces: not applicable. No skill or hook changes.
- Root and scaffold: applied to the root CLI only.
- Interactive and headless processes: not applicable. No process starts.
- Local and remote operation: not applicable. The resolution is a local path computation.
- Parallel operation: not applicable. No shared mutable state changes.
- Public documentation: applied. See the open question about `mifunedev/agro-web`.
- Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` cases at lines 87, 109, 117, 122 | The fallback is `workspaces/harness`, also with an `AGRO_HOME` override |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | New case: recorded `harnessRoot` at `workspaces/default` | A recorded root has precedence over the new fallback |
| `.agro/cli/src/__tests__/workspace.test.ts` | Case at line 286; new case with the explicit name `default` | The implicit create name is `harness`; an explicit `default` still works |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper (line 72), install case (line 674), help case (line 1500) | The host harness install records `workspaces/harness`; the help names the new path |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` helper (line 93) | The host tool install resolves `workspaces/harness` |

## Design Principles

- Keep one constant for the implicit name.
- Make the smallest change that aligns the host name with the sandbox name.
- Add no comments to tracked code.
- Add no legacy fallback machinery unless the operator asks for it.

## Out of Scope

- Migration or rename of an existing `~/.agro/workspaces/default` directory.
- Changes to the sandbox harness path `/home/sandbox/harness`.
- Changes to the `harnessRoot` config format.

## Open Questions

1. An operator can have `~/.agro/workspaces/default` without a recorded `harnessRoot`. After this change, a host install for that operator fails until the operator passes `--workspace default`. Is this break acceptable, or must the resolver also try `workspaces/default` when `workspaces/harness` does not exist? This plan assumes the break is acceptable.
2. What is the CLI test command? `.agro/cli/package.json` shows `typecheck`, but this plan did not verify the test script. Replace `<cli test command>` with the verified command.
3. Does `mifunedev/agro-web` name `~/.agro/workspaces/default`? If yes, the operator opens a matching change in that repository.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] `agro workspace create default` creates `~/.agro/workspaces/default`.
- [ ] A recorded `harnessRoot` that names `~/.agro/workspaces/default` still resolves to that path.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src` prints only lines in the new test cases for an explicit `default` workspace.
- [ ] `<cli test command>` exits 0.

## Lessons

Filled by the advisor before undraft.
