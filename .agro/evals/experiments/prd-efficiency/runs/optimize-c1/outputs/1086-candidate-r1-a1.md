# PRD: agro workspace door for host workspaces

Status: DRAFT

## User Stories

### US-001: Add `agro workspace create` and `agro workspace list`

**Description:** As an operator, I want a verb that creates and lists host AGRO workspaces so that I can skip the harness install.

**Acceptance Criteria:**

- [ ] New file `.agro/cli/src/commands/workspace.ts` exports `runWorkspaceCreate` and `runWorkspaceList`.
- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into the `default` entry under `workspacesRoot(env, home)` through `ensureHostWorkspace`, and exits 0.
- [ ] `agro workspace create beta` clones into the `beta` entry. A second run reuses the entry, prints `host workspace reused at <root>`, and exits 0.
- [ ] `agro workspace create Bad_Name` exits 1 with the `assertWorkspaceName` message, and runs no `git clone`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`. `agro workspace create beta --path <dir>` exits 1 with a message that names both flags.
- [ ] `agro workspace create` runs `stateHomeRefusal` and `stateHomeRootRefusal` before the clone, and exits 1 when either refusal returns a message.
- [ ] After each `agro workspace create` run, the `harnessRoot` key in the host config is byte-identical to its value before the run, or stays absent.
- [ ] `agro workspace list` prints each directory under `workspacesRoot(env, home)` whose name matches `SANDBOX_NAME_PATTERN` and that holds `.git`, in sorted order.
- [ ] `agro workspace list` marks exactly one entry as the default: the entry whose root equals `resolveHarnessRoot(undefined, env, home)`. When no entry matches, `agro workspace list` marks no entry.
- [ ] `agro workspace list --json` prints a JSON array of `{ "name", "root", "default" }` objects. With no workspaces, the command prints `[]` and exits 0.
- [ ] `agro workspace --help` and `agro --help` list both subcommands.
- [ ] Typecheck passes: `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Make `harness install --host` refuse when no workspace exists

**Description:** As an operator, I want `agro harness install` to use an existing workspace and never clone one so that installs never create one.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` resolves the root in this order: `--workspace <name>` or `--path <dir>`, then `harnessRoot`, then the `default` entry.
- [ ] If the resolved root holds no `.git`, `installOnHost` exits 1, runs no `git clone`, and writes no host config.
- [ ] The refusal names `${bin} workspace create` and lists each workspace that `agro workspace list` reports. With no workspaces, the refusal states that no workspace exists.
- [ ] `installOnHost` no longer calls `ensureHostWorkspace` and no longer asks `Workspace name [default]:`. The interactive run asks only the `[y/N]` question.
- [ ] A successful install still writes `harnessRoot` and the `hostHarnesses` receipt as before.
- [ ] The tests at `.agro/cli/src/__tests__/harness.test.ts` that assert `host workspace cloned into` or `Workspace name [default]:` seed a workspace first, or assert the refusal.

### US-003: Make `tool install --host` refuse when no workspace exists

**Description:** As an operator, I want `agro tool install` to use an existing workspace and never clone one so that `harnessRoot` always names a real workspace.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/tool.ts` resolves the root in this order: `--path <dir>`, then `harnessRoot`, then the `default` entry.
- [ ] If the resolved root holds no `.git`, the tool install exits 1, runs no `git clone`, and writes no host config.
- [ ] The refusal text comes from the same helper that US-002 uses, with the `tool` prefix.
- [ ] `installOnHost` no longer calls `ensureHostWorkspace` and no longer asks `Harness root [<root>]:`.
- [ ] A successful install still writes `harnessRoot` and the `hostTools` receipt as before.
- [ ] `agro tool install` accepts no `--workspace` flag.

### US-004: Update help and documentation

**Description:** As an operator, I want the help text and the lifecycle reference to describe the new door so that the docs match the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` and `printToolHelp` in `.agro/cli/src/cli.ts` state that a host install needs an existing workspace, and name `${bin} workspace create`.
- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`, and no longer states that a host install clones the workspace.
- [ ] `docs/harnesses/overview.md` matches the new install behavior.
- [ ] `CHANGELOG.md` has one entry for the change.

## Summary

Today an operator creates a host workspace only as a side effect of an install.
`installOnHost` in `.agro/cli/src/commands/harness.ts` asks `Workspace name [default]:` and calls `ensureHostWorkspace` (lines 396-424).
`installOnHost` in `.agro/cli/src/commands/tool.ts` asks `Harness root [<root>]:` for a free-form path and calls `ensureHostWorkspace` (lines 437-455).
Both paths then write `harnessRoot` to the host config.

The selected approach:

1. Add `agro workspace create` as the only caller of `ensureHostWorkspace`.
2. Add `agro workspace list`, which scans `workspacesRoot` the way `listEntries` in `.agro/cli/src/lib/registry.ts` scans the sandbox registry.
3. Replace the clone step in both install paths with one shared check. The check refuses when the resolved root holds no `.git`.

The two install paths stay the only writers of `harnessRoot`. `resolveHarnessRoot` in `.agro/cli/src/lib/host-config.ts` stays the single resolution order.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal`; new `listHostWorkspaces`, new `missingWorkspaceRefusal` | Clone logic, refusals, and the new scan and refusal helpers |
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, `DEFAULT_WORKSPACE_NAME` | Workspace paths, name validation, and the default resolution order |
| `.agro/cli/src/lib/registry.ts` | `listEntries`, `SANDBOX_NAME_PATTERN` | Pattern for the directory scan |
| new file `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `runWorkspaceList` | The new verb |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Remove the clone and the name prompt; add the refusal |
| `.agro/cli/src/commands/tool.ts` | `installOnHost` | Remove the clone and the path prompt; add the refusal |
| `.agro/cli/src/cli.ts` | top-level dispatch near `if (first === "tool")`, new `parseWorkspaceArgs`, new `printWorkspaceHelp`, `printHarnessHelp`, `printToolHelp` | Argument parsing, dispatch, and help |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace. Never writes `harnessRoot`. |
| `agro workspace list [--json]` | New | Lists workspaces and marks the default. |
| `agro harness install <id> --host` | Changed | Refuses when the resolved root holds no `.git`. Never clones. |
| `agro harness install <id> --workspace <name>` | Changed | Refuses when the named entry does not exist. Never clones. |
| `agro tool install <id> --host` | Changed | Refuses when the resolved root holds no `.git`. Never clones. |
| Interactive host install | Changed | Asks only the `[y/N]` question. The workspace prompts go away. |
| `oh` alias | Unchanged | `oh workspace` works through the shared `bin` value. |

## Storage

The workspace entries are directories under `workspacesRoot(env, home)`, which resolves to the `workspaces` subdirectory of the host state home.
The feature adds no registry file.
`agro workspace list` derives each entry from the directory scan.
The host config keeps its schema. Only the two install paths write `harnessRoot`.

## Architectural Decisions

- `resolveHarnessRoot` is the single source of truth for the default workspace. `agro workspace list` marks the entry that `resolveHarnessRoot(undefined, env, home)` returns. The install paths resolve through the same function.
- A workspace exists when its root holds `.git`. This rule matches the `reused` branch in `ensureHostWorkspace`.
- `agro workspace create` is the only command that calls `ensureHostWorkspace`.
- `agro workspace create` runs on the host only. The command needs no sandbox.
- One helper builds the missing-workspace refusal for both install paths. The helper takes the command prefix, so each refusal names its own verb.

## Test Plan (TDD)

Run each test with `npx vitest run <test file>` from the repository root.

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/__tests__/workspace.test.ts` | create default; create named; reuse; invalid name; `--path`; name with `--path`; state-home refusals; `harnessRoot` unchanged | US-001 create |
| new file `.agro/cli/src/__tests__/workspace.test.ts` | list empty; list sorted; skip entries without `.git`; default mark from `harnessRoot`; default mark from the `default` entry; no mark for an outside `harnessRoot`; `--json` shape | US-001 list |
| new file `.agro/cli/src/__tests__/workspace.test.ts` | `parseWorkspaceArgs` accepts and rejects each flag; help lists both subcommands | US-001 parsing and help |
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | `listHostWorkspaces` scan; `missingWorkspaceRefusal` text with zero and with two workspaces | Shared helpers |
| `.agro/cli/src/__tests__/harness.test.ts` | `--host` without a workspace refuses and runs no `git clone`; `--workspace beta` without the entry refuses; interactive run asks one question; existing clone cases seed `.git` first | US-002 |
| `.agro/cli/src/__tests__/tool.test.ts` | `--host` without a workspace refuses and runs no `git clone`; `--path` to a directory without `.git` refuses; interactive run asks one question; existing host cases seed `.git` first | US-003 |
| `.agro/cli/src/__tests__/harness.test.ts`, `.agro/cli/src/__tests__/tool.test.ts` | help text names `workspace create` | US-004 |

Write each red test first. The red test for US-002 and US-003 asserts that no `git clone` call reaches the runner.

## Design Principles

- Keep one lifecycle door. `agro workspace` joins `agro`; the command adds no second binary.
- Keep one source of truth. `resolveHarnessRoot` owns the default, and the directory scan owns the list.
- Delete the obsolete path. Remove both install prompts and both install-time clones. Keep no fallback.
- Add no comments to tracked code.
- Apply YAGNI. Add no subcommand beyond `create` and `list`.

## Out of Scope

- `agro workspace use` and `agro workspace status`.
- `agro workspace remove`.
- A `--default` flag on `agro workspace create`.
- A `--workspace <name>` flag on `agro tool install`.
- A new registry file.
- A matching change in `mifunedev/agro-web`. The operator decides on a follow-up.
- Closing #1070. #1070 stays open as the RFC.

## Open Questions

1. `stateHomeRefusal` and `stateHomeRootRefusal` hardcode the `harness` prefix. Must `agro workspace create` print `workspace` in those refusals? Changing the prefix touches the existing harness tests.
2. When `harnessRoot` points outside the `workspaces` subdirectory, `agro workspace list` marks no entry. Must `agro workspace list` also print that recorded root?
3. Must `agro tool install --path <dir>` keep accepting an existing checkout outside the `workspaces` subdirectory? This plan keeps `--path`, and refuses only when `<dir>` holds no `.git`.
4. Must the public site `mifunedev/agro-web` document `agro workspace` in the same release?

## Acceptance Criteria

- [ ] `npx vitest run .agro/cli/src` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `git grep -n ensureHostWorkspace .agro/cli/src/commands` shows calls only in `.agro/cli/src/commands/workspace.ts`.
- [ ] `git grep -n "Workspace name \[" .agro/cli/src/commands` returns no match.
- [ ] `git grep -n "Harness root \[" .agro/cli/src/commands` returns no match.
- [ ] `git grep -n harnessRoot .agro/cli/src/commands/workspace.ts` shows no write of `harnessRoot`.
- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`.

## Lessons

Filled by the advisor before undraft.
