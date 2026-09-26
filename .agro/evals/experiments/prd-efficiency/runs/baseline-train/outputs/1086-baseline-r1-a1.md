# PRD: Add `agro workspace` and stop installs from creating workspaces

Status: DRAFT

Tracks GitHub issue #1086. Narrows the RFC in #1070 to two subcommands.

## User Stories

### US-001: Add the shared workspace scan and refusal

**Description:** As an implementation owner, I want one shared workspace scan and one shared refusal, so that `workspace list`, `harness install` and `tool install` report the same workspaces.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-workspace.ts` exports `listWorkspaces(env, home)`.
- [ ] `listWorkspaces` returns the sorted names of the directories under `workspacesRoot(env, home)` that match `SANDBOX_NAME_PATTERN` and hold a `.git` entry.
- [ ] `listWorkspaces` returns `[]` when `~/.agro/workspaces/` does not exist.
- [ ] `listWorkspaces` omits a directory that has no `.git` entry, and omits a file.
- [ ] `.agro/cli/src/lib/host-workspace.ts` exports `missingWorkspaceRefusal(bin, command, root, env, home)`.
- [ ] The refusal text contains `${bin} workspace create`, the missing root path, and each name that `listWorkspaces` returns.
- [ ] When `listWorkspaces` returns `[]`, the refusal text states that no workspace exists.
- [ ] `.agro/cli/src/lib/__tests__/host-workspace.test.ts` covers each case above, and the file passes under vitest.

### US-002: Add `agro workspace create`

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` to clone `mifunedev/agro` into a workspace, so that I can create a workspace without an install.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` and exits 0.
- [ ] `agro workspace create acme` clones into `~/.agro/workspaces/acme` and exits 0.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>` and exits 0.
- [ ] `agro workspace create acme --path <dir>` exits 1, clones nothing, and names both inputs in the error.
- [ ] An invalid name, for example `Acme`, exits 1 with the `assertWorkspaceName` message and clones nothing.
- [ ] When the target already holds a `.git` entry, the command prints `host workspace reused at <root>` and exits 0 without a clone.
- [ ] When `stateHomeRefusal` or `stateHomeRootRefusal` returns a message, the command prints that message, exits 1, and clones nothing.
- [ ] After each run, `~/.agro/config.json` has the same `harnessRoot` value as before the run. When the file did not exist before the run, the run does not create the file.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers each case above with a fake `LifecycleRunner`, and the file passes under vitest.

### US-003: Add `agro workspace list`

**Description:** As an operator, I want `agro workspace list [--json]` to show every workspace and mark the default, so that I know which workspace a host install uses.

**Acceptance Criteria:**

- [ ] `agro workspace list` prints one line for each name that `listWorkspaces` returns, with the name and the absolute root.
- [ ] The line whose root equals `resolveHarnessRoot(undefined, env, home)` carries a default marker.
- [ ] With no workspace, the command prints a line that names `agro workspace create` and exits 0.
- [ ] `agro workspace list --json` prints a JSON array of `{ "name", "root", "default" }` objects and exits 0.
- [ ] `agro workspace list` reads `~/.agro/config.json` and writes no file.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers text output, JSON output, the empty case, and the default marker for a recorded `harnessRoot` and for `default`.

### US-004: Make `agro harness install --host` refuse without a workspace

**Description:** As an operator, I want a host harness install to use an existing workspace, so that only `agro workspace create` creates a workspace.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` no longer calls `ensureHostWorkspace`.
- [ ] `installOnHost` no longer asks `Workspace name [default]:`. The `[y/N]` confirmation stays.
- [ ] When the resolved root holds no `.git` entry, the command prints `missingWorkspaceRefusal`, exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] `--workspace <name>` and `--path <dir>` resolve the root as before, and the refusal applies to each of the two flags.
- [ ] When the resolved root holds a `.git` entry, the install runs and records `harnessRoot` and `hostHarnesses` as before.
- [ ] `.agro/cli/src/__tests__/harness.test.ts` replaces each clone assertion and each `Workspace name [default]:` assertion with the refusal behavior or a pre-created workspace, and the file passes under vitest.

### US-005: Make `agro tool install --host` refuse without a workspace

**Description:** As an operator, I want a host tool install to use an existing workspace, so that no tool install records a `harnessRoot` without a workspace.

**Acceptance Criteria:**

- [ ] The host install path in `.agro/cli/src/commands/tool.ts` no longer calls `ensureHostWorkspace`.
- [ ] The host install path no longer asks `Harness root [<root>]:`. The `[y/N]` confirmation stays.
- [ ] When the resolved root holds no `.git` entry, the command prints `missingWorkspaceRefusal`, exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] When the resolved root holds a `.git` entry, the install runs and records `harnessRoot` and `hostTools` as before.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers the refusal and the existing-workspace install, and the file passes under vitest.

### US-006: Wire the command and update the documentation

**Description:** As an operator, I want the help and the documentation to describe `agro workspace`, so that the documentation matches the behavior.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/cli.ts` dispatches `workspace` to `runWorkspaceCreate` and `runWorkspaceList`.
- [ ] `agro workspace --help` prints both subcommands and both flags, and exits 0.
- [ ] `agro workspace` with an unknown subcommand or an unknown flag exits 1 and prints the error.
- [ ] `printOhHelp` lists `workspace <args...>`.
- [ ] `printHarnessHelp` and `printToolHelp` state that a host install needs an existing workspace and name `workspace create`.
- [ ] `docs/lifecycle-commands.md` and `docs/harnesses/overview.md` describe `agro workspace create` and `agro workspace list`, and no longer describe an install-time clone or the `Workspace name [default]:` prompt.
- [ ] `CHANGELOG.md` `## [Unreleased]` carries an `Added` entry and a `Changed` entry that link issue #1086.
- [ ] `src/__tests__/cli-first-help.test.ts` or a new parser test in `workspace.test.ts` covers the dispatch and the parse errors.

## Summary

Verified current state:

- `installOnHost` asks `Workspace name [default]:` and calls `ensureHostWorkspace`, which clones `AGRO_REPO_URL` (`.agro/cli/src/commands/harness.ts:396-424`).
- The tool host install asks `Harness root [<root>]:` for a free-form path and calls `ensureHostWorkspace` (`.agro/cli/src/commands/tool.ts:437-455`). A tool install can therefore record a `harnessRoot` outside `~/.agro/workspaces/`.
- `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal` and `AGRO_REPO_URL` live in `.agro/cli/src/lib/host-workspace.ts`.
- `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `DEFAULT_WORKSPACE_NAME` and `resolveHarnessRoot` live in `.agro/cli/src/lib/host-config.ts`.
- `registry.listEntries` scans `~/.agro/sandboxes/` by directory name and `SANDBOX_NAME_PATTERN` (`.agro/cli/src/lib/registry.ts:44-53`).
- `.agro/cli/src/cli.ts` parses and dispatches each top-level verb by hand, for example `harness` at line 1389 and `tool` at line 1426.
- The root `package.json` runs tests with `vitest run` and type checks with `pnpm run typecheck`.

Selected approach:

1. Add `listWorkspaces` and `missingWorkspaceRefusal` to `host-workspace.ts`.
2. Add `.agro/cli/src/commands/workspace.ts` with `runWorkspaceCreate` and `runWorkspaceList`. `runWorkspaceCreate` reuses `ensureHostWorkspace`, `stateHomeRefusal` and `stateHomeRootRefusal`.
3. Remove the clone and the root prompt from both host install paths. Each path resolves the root with `resolveHarnessRoot`, then refuses when the root holds no `.git` entry.
4. Add the parser, the help text and the dispatch to `cli.ts`.
5. Update the documentation and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `listWorkspaces`, `missingWorkspaceRefusal`, `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal` | Workspace scan, refusal text, clone |
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `resolveHarnessRoot`, `readHostConfig` | Path resolution and the `harnessRoot` read |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `runWorkspaceList` | New command handlers |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Remove the clone and the name prompt; add the refusal |
| `.agro/cli/src/commands/tool.ts` | host install function at lines 379-512 | Remove the clone and the root prompt; add the refusal |
| `.agro/cli/src/cli.ts` | `printOhHelp`, `printHarnessHelp`, `printToolHelp`, new `printWorkspaceHelp`, new `parseWorkspaceArgs`, `main` | Help, parse, dispatch |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace. Writes no `harnessRoot`. |
| `agro workspace list [--json]` | New | Lists workspaces under `~/.agro/workspaces/` and marks the default. |
| `agro harness install <id> --host` | Changed | Refuses when the resolved root holds no checkout. Asks no workspace name. |
| `agro tool install <id> --host` | Changed | Refuses when the resolved root holds no checkout. Asks no harness root. |
| `agro --help`, `agro harness --help`, `agro tool --help` | Changed | Name `workspace` and the new precondition. |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md` | Changed | Describe the new door and remove the install-time clone. |
| `mifunedev/agro-web` | Possible change | See Open Question 4. |

## Storage

The command adds no registry file. `workspace list` derives state from the directories under `~/.agro/workspaces/`, the way `registry.listEntries` derives sandbox state from `~/.agro/sandboxes/`. `workspace create` writes only the clone. `harnessRoot` in `~/.agro/config.json` keeps its present writers: the two host install paths.

## Architectural Decisions

- The filesystem is the source of truth for the set of workspaces. A directory under `~/.agro/workspaces/<name>/` with a `.git` entry is a workspace.
- `resolveHarnessRoot(undefined, env, home)` is the source of truth for the default workspace. The resolution order stays: the recorded `harnessRoot`, then `~/.agro/workspaces/default`.
- `agro workspace create` is the only command that clones a host workspace. The install paths only resolve a root and check the root.
- `create` rejects a name together with `--path`. This matches the `harness install` rule for `--workspace` and `--path` (`.agro/cli/src/cli.ts:958-962`).
- The command runs where the operator invokes `agro`. The command adds no sandbox detection. See Open Question 3.

## Test Plan (TDD)

Run each test file with `pnpm exec vitest run <file>` from the repository root. Run `pnpm run typecheck` after each story.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | missing root, empty root, checkout and non-checkout directories, invalid names, refusal with and without workspaces | US-001 |
| `.agro/cli/src/__tests__/workspace.test.ts` | create default, create by name, create with `--path`, name with `--path`, invalid name, reuse, state-home refusals, `harnessRoot` unchanged | US-002 |
| `.agro/cli/src/__tests__/workspace.test.ts` | list text, list JSON, empty list, default marker for recorded `harnessRoot`, default marker for `default` | US-003 |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal without a checkout, no clone call, no config write, install into a pre-created workspace, no name prompt | US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal without a checkout, no clone call, no config write, install into a pre-created workspace, no root prompt | US-005 |
| `.agro/cli/src/__tests__/workspace.test.ts` or `.agro/cli/src/__tests__/cli-first-help.test.ts` | help output, unknown subcommand, unknown flag, top-level help line | US-006 |

## Design Principles

- Keep one door for each lifecycle action. `workspace create` creates. An install installs.
- Keep one source of truth. The directory scan owns the workspace set. `resolveHarnessRoot` owns the default.
- Reuse `ensureHostWorkspace` and the state-home refusals. Do not copy the clone logic.
- Delete the two install-time prompts. Do not keep them as a dormant alternative.
- Add no explanatory comments to tracked code.

## Out of Scope

- `agro workspace use` and `agro workspace status`.
- `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- A change to the `harnessRoot` writers or to the receipt schema.

## Open Questions

1. The issue writes `create [<name>] [--path <dir>]`. This plan rejects a name together with `--path`. The operator confirms this rule or states the meaning of both inputs together.
2. A recorded `harnessRoot` can point outside `~/.agro/workspaces/`, because a tool install accepted a free-form path. `list` scans only the registry directory, so `list` then marks no row as default. The operator confirms this output or names the line that `list` prints for that root.
3. The issue does not state where `agro workspace` runs. The operator confirms that the command needs no sandbox refusal inside the container, or names the refusal.
4. The operator confirms whether `mifunedev/agro-web` documents the install-time workspace prompt. If `agro-web` documents the prompt, the task needs a matching change in `agro-web`.
5. The issue does not give the exact refusal wording or the default marker for `list`. The implementation owner proposes both in the pull request for operator review.

## Acceptance Criteria

- [ ] `pnpm exec vitest run .agro/cli` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `grep -n "ensureHostWorkspace" .agro/cli/src/commands/harness.ts .agro/cli/src/commands/tool.ts` prints nothing.
- [ ] `grep -rn "Workspace name \[" .agro/cli/src docs` prints nothing.
- [ ] `grep -n "harnessRoot" .agro/cli/src/commands/workspace.ts` prints nothing.
- [ ] A host `harness install --host` and a host `tool install --host` with no workspace each exit 1 and print `workspace create`.
- [ ] `CHANGELOG.md` links issue #1086 under `## [Unreleased]`.

## Lessons

Filled by the advisor before undraft.
