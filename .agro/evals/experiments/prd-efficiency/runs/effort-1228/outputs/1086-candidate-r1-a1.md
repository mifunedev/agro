# PRD: Add the agro workspace door

Status: DRAFT

Source: `work/issue-1086.md` (issue #1086). The issue narrows RFC #1070 to two subcommands.

## User Stories

### US-001: Add the workspace listing helper

**Description:** As an operator, I want the CLI to list host workspaces from disk so that each command reads one source for workspace existence.

**Acceptance Criteria:**

- [ ] A new exported function in `.agro/cli/src/lib/host-config.ts` returns the sorted names of the directories under `workspacesRoot(env, home)` that hold a `.git` entry and pass `assertWorkspaceName`.
- [ ] The function returns `[]` when `workspacesRoot(env, home)` does not exist.
- [ ] `.agro/cli/src/lib/__tests__/host-config.test.ts` covers an empty home, two workspaces, and one directory without `.git`. The tests pass.

### US-002: Add `agro workspace create`

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` so that I can clone `mifunedev/agro` into a workspace without a harness install.

**Acceptance Criteria:**

- [ ] `agro workspace create acme` calls `ensureHostWorkspace` with `workspaceRoot("acme", env, home)` and exits 0.
- [ ] `agro workspace create` with no name uses `DEFAULT_WORKSPACE_NAME`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`.
- [ ] `agro workspace create` refuses a root that `stateHomeRootRefusal` rejects, and exits 1.
- [ ] After each `create` run, `~/.agro/config.json` holds the same `harnessRoot` value as before the run.
- [ ] `agro workspace create` runs no provider link and no harness or tool installer.

### US-003: Add `agro workspace list`

**Description:** As an operator, I want `agro workspace list [--json]` so that I can see each workspace and the default workspace.

**Acceptance Criteria:**

- [ ] `agro workspace list` prints one line per name from the US-001 helper, and marks the workspace whose root equals `resolveHarnessRoot(undefined, env, home)`.
- [ ] `agro workspace list --json` prints a JSON array. Each element holds `name`, `root`, and `default`.
- [ ] `agro workspace list` with no workspace prints a line that names `agro workspace create` and exits 0.
- [ ] `agro workspace --help` lists `create` and `list` only.

### US-004: Remove the workspace wizard from `harness install --host`

**Description:** As an operator, I want `agro harness install --host` to use an existing workspace so that an install never creates a workspace as a side effect.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` no longer asks `Workspace name [default]:`.
- [ ] When the resolved root has no `.git`, `agro harness install <id> --host` exits 1, runs no `git clone`, and prints `${bin} workspace create` plus each name from the US-001 helper.
- [ ] When the resolved root holds a workspace, the install records `harnessRoot` as the present code does.
- [ ] `.agro/cli/src/__tests__/harness.test.ts` replaces the clone-on-install cases with refusal cases. The tests pass.

### US-005: Remove the workspace wizard from `tool install --host`

**Description:** As an operator, I want `agro tool install --host` to use an existing workspace so that a tool install cannot record a `harnessRoot` outside `~/.agro/workspaces/`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/commands/tool.ts` no longer asks `Harness root [<root>]:`.
- [ ] When the resolved root has no `.git`, `agro tool install <id> --host` exits 1, runs no `git clone`, and prints `${bin} workspace create` plus each name from the US-001 helper.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers the refusal. The tests pass.

### US-006: Update help text and lifecycle docs

**Description:** As an operator, I want the help text and the verb reference to describe the new door so that the documentation matches the CLI.

**Acceptance Criteria:**

- [ ] The help text in `.agro/cli/src/cli.ts` near lines 329 and 406 names `agro workspace create` and no longer describes a clone during an install.
- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`, and the text near line 295 no longer describes a clone during an install.
- [ ] `.agro/cli/src/__tests__/docs.test.ts` and `.agro/cli/src/__tests__/cli-first-help.test.ts` pass.

## Summary

Verified current state:

- `installOnHost` asks `Workspace name [default]:` and clones through `ensureHostWorkspace` (`.agro/cli/src/commands/harness.ts:393-415`).
- `tool install --host` asks `Harness root [<root>]:` and accepts a free-form path (`.agro/cli/src/commands/tool.ts:437-456`).
- `harness install <id> --workspace <name>` clones with no prompt (`.agro/cli/src/commands/harness.ts:375-376`).
- `.agro/cli/src/lib/host-config.ts` exports `DEFAULT_WORKSPACE_NAME`, `assertWorkspaceName`, `workspacesRoot`, `workspaceRoot`, `defaultHarnessRoot`, and `resolveHarnessRoot`.
- `registry.listEntries` scans `~/.agro/sandboxes/` for directories (`.agro/cli/src/lib/registry.ts:44-52`).

Selected approach: add a `workspace` command module with `create` and `list`. Move the clone step out of both install paths. Each install path keeps the root resolution and refuses when the root holds no workspace.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `resolveHarnessRoot`, new list helper | Workspace paths and listing |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRootRefusal` | Clone and nested-root guard |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Remove wizard, add refusal |
| `.agro/cli/src/commands/tool.ts` | host install path near line 420 | Remove wizard, add refusal |
| `.agro/cli/src/commands/workspace.ts` | new `create`, `list` | New door |
| `.agro/cli/src/cli.ts` | command dispatch, help text near lines 329 and 406 | Register `workspace` |
| `docs/lifecycle-commands.md` | install section near line 295 | Verb reference |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace |
| `agro workspace list [--json]` | New | Lists workspaces and marks the default |
| `agro harness install --host` | Changed | Refuses when no workspace exists |
| `agro tool install --host` | Changed | Refuses when no workspace exists |

## Storage

Workspaces stay git clones under `~/.agro/workspaces/<name>`. `list` scans that directory. This task adds no registry file. `harnessRoot` in `~/.agro/config.json` keeps the two install paths as the only writers.

## Architectural Decisions

- The filesystem under `workspacesRoot` is the source of truth for workspace existence.
- The default workspace is the root that `resolveHarnessRoot(undefined, env, home)` returns.
- `create` never writes `harnessRoot`.
- Every command runs on the host. No command touches the sandbox.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | empty home, two workspaces, directory without `.git` | US-001 |
| `.agro/cli/src/__tests__/workspace.test.ts` | create by name, default name, `--path`, nested-root refusal, `harnessRoot` unchanged | US-002 |
| `.agro/cli/src/__tests__/workspace.test.ts` | list text, list `--json`, empty list, default mark | US-003 |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal names `workspace create` and lists workspaces; no `git clone` | US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal names `workspace create` and lists workspaces; no `git clone` | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts`, `cli-first-help.test.ts` | help and docs text | US-006 |

Run the suite with `<test command>` from `.agro/cli`.

## Design Principles

- Keep one door for one action: `workspace create` clones, and an install installs.
- Reuse `ensureHostWorkspace` and the `host-config.ts` path helpers. Add no second clone path.
- Add no comments to tracked code.
- Surfaces: host applied; lifecycle door applied; canonical `.agro/` source applied; provider mirrors not applicable; root and scaffold applied to the CLI only; interactive and headless processes not applicable; remote operation not applicable; parallel operation not applicable; public documentation applied in `mifunedev/agro-web`.

## Out of Scope

- `agro workspace use`, `agro workspace status`, and `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.

## Open Questions

1. What is the exact test command for `.agro/cli`? The plan writes `<test command>`.
2. If `harnessRoot` is unset, no `default` workspace exists, and another workspace exists, does an install refuse or pick that workspace? The plan assumes a refusal that lists each workspace.
3. Does an install with `--path <dir>` that names a directory without `.git` refuse? The plan assumes a refusal.
4. Does the change need a matching page in `mifunedev/agro-web`? The plan assumes yes.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `<test command>` exits 0 in `.agro/cli`.
- [ ] `git grep -n "Workspace name \[" .agro/cli/src/commands` returns no match.
- [ ] `git grep -n "Harness root \[" .agro/cli/src/commands` returns no match.

## Lessons

Filled by the advisor before undraft.
