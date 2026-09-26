# PRD: `agro workspace` door for host workspace lifecycle

Status: DRAFT

Source: issue #1086 (`work/issue-1086.md`). RFC: #1070.

## User Stories

### US-001: List host workspaces

**Description:** As an operator, I want `agro workspace list` to show each host workspace and mark the default so that I know which workspace an install uses.

**Acceptance Criteria:**

- [ ] `listWorkspaces(env, home)` returns the sorted names of the directories under `~/.agro/workspaces/` that match `SANDBOX_NAME_PATTERN` and hold a `.git` entry.
- [ ] `listWorkspaces` returns `[]` when `~/.agro/workspaces/` does not exist.
- [ ] `agro workspace list` prints one row per workspace with the name and the absolute root.
- [ ] `agro workspace list` marks exactly one row as the default when the root that `resolveHarnessRoot(undefined, env, home)` returns is a listed workspace. The command marks no row otherwise.
- [ ] `agro workspace list --json` prints a JSON array of `{ "name", "root", "default" }` objects and exits 0.
- [ ] When no workspace exists, `agro workspace list` prints a line that names `agro workspace create` and exits 0.
- [ ] `agro workspace list` writes no file under `~/.agro/`.

### US-002: Create a host workspace

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` to clone `mifunedev/agro` without an install so that workspace creation is an explicit step.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `https://github.com/mifunedev/agro.git` into `~/.agro/workspaces/default` through `ensureHostWorkspace`.
- [ ] `agro workspace create acme` clones into `~/.agro/workspaces/acme`.
- [ ] `agro workspace create --path /srv/agro` clones into `/srv/agro`.
- [ ] `agro workspace create acme --path /srv/agro` exits 1 and names both inputs in the error.
- [ ] An invalid name, for example `../x`, exits 1 with the `assertWorkspaceName` error and runs no `git clone`.
- [ ] If the target already holds a `.git` entry, the command prints `host workspace reused at <root>` and exits 0.
- [ ] If the target holds files but no `.git` entry, the command exits 1 with the `ensureHostWorkspace` error.
- [ ] The command applies `stateHomeRefusal` and `stateHomeRootRefusal` before it clones.
- [ ] After a successful create, `~/.agro/config.json` is byte-identical to its state before the command. The command never writes `harnessRoot`.
- [ ] The command runs no prompt.

### US-003: Wire `agro workspace` into the CLI

**Description:** As an operator, I want `agro workspace` in the top-level help and in its own help so that I can find the door.

**Acceptance Criteria:**

- [ ] `agro --help` shows a `workspace <args...>` line.
- [ ] `agro workspace --help` lists `create` and `list` with their flags and exits 0.
- [ ] `agro workspace` with an unknown subcommand exits 1 and names `create` and `list`.
- [ ] `agro workspace list` with an unexpected argument exits 1.
- [ ] `--json` on `create` exits 1. `--path` on `list` exits 1.
- [ ] `oh workspace list` behaves the same as `agro workspace list`.

### US-004: `harness install --host` refuses when no workspace exists

**Description:** As an operator, I want `agro harness install` to use an existing workspace and never clone one so that installs have no workspace side effect.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` resolves the root in this order: `--workspace <name>` or `--path <dir>`, then the recorded `harnessRoot`, then `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] The refusal names `${bin} workspace create`. When the root is under `~/.agro/workspaces/`, the command in the refusal carries the workspace name. Otherwise the command carries `--path <root>`.
- [ ] The refusal lists each name that `listWorkspaces` returns. When the list is empty, the refusal states that no workspace exists.
- [ ] An interactive run asks only the `Install <title> on the host? [y/N]` question. The `Workspace name [default]:` prompt no longer exists.
- [ ] If the resolved root holds a `.git` entry, the install succeeds and writes `harnessRoot` and the `hostHarnesses` receipt as before.

### US-005: `tool install --host` refuses when no workspace exists

**Description:** As an operator, I want `agro tool install` to use an existing workspace so that a tool install cannot record an uncreated `harnessRoot`.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/tool.ts` resolves the root in this order: `--path <dir>`, then the recorded `harnessRoot`, then `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] The refusal has the same shape as the US-004 refusal, with the `tool` prefix.
- [ ] An interactive run asks only the `Install <title> on the host? [y/N]` question. The `Harness root [<root>]:` prompt no longer exists.
- [ ] If the resolved root holds a `.git` entry, the install succeeds and writes `harnessRoot` and the `hostTools` receipt as before.

### US-006: Document the workspace door

**Description:** As an operator, I want the documentation to describe `agro workspace` so that the documented lifecycle matches the CLI.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`.
- [ ] `docs/lifecycle-commands.md` and `docs/harnesses/overview.md` state that `harness install --host` and `tool install --host` refuse when no workspace exists. Neither file states that an install clones a workspace.
- [ ] The `harness` and `tool` help text in `.agro/cli/src/cli.ts` states that a host install needs an existing workspace and names `workspace create`.
- [ ] `grep -rn "Workspace name \[" .agro/cli/src docs` prints no line.

## Summary

Today an operator creates a host AGRO workspace only as a side effect of an install.
`installOnHost` in `.agro/cli/src/commands/harness.ts:338-424` prompts `Workspace name [default]:` and calls `ensureHostWorkspace`, which clones `mifunedev/agro`.
`installOnHost` in `.agro/cli/src/commands/tool.ts:378-455` holds a second copy of that flow.
The copy in `tool.ts` prompts for a free-form path. A `tool install` can therefore record a `harnessRoot` outside `~/.agro/workspaces/`.

This task adds a top-level `agro workspace` command with two subcommands: `create` and `list`.
`create` owns the clone. `create` reuses `ensureHostWorkspace` and never writes `~/.agro/config.json`.
`list` scans `~/.agro/workspaces/` the way `registry.listEntries` scans `~/.agro/sandboxes/`.
Both host install paths keep their root resolution and their `harnessRoot` write.
Both host install paths lose the clone and the workspace prompt. Each path refuses when the resolved root holds no checkout.

Behavior change: `agro harness install <id> --workspace beta` clones `beta` today. After this task, the command refuses when `beta` does not exist and names `agro workspace create beta`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal`, new `listWorkspaces`, new refusal helper | Clone, state-home guards, workspace scan, shared refusal text |
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, `DEFAULT_WORKSPACE_NAME` | Workspace paths, name validation, default resolution |
| `.agro/cli/src/lib/registry.ts` | `listEntries`, `SANDBOX_NAME_PATTERN` | Scan pattern that `listWorkspaces` follows |
| `.agro/cli/src/commands/workspace.ts` (new) | `runWorkspaceCreate`, `runWorkspaceList` | Command logic |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Remove the prompt and the clone. Add the refusal. |
| `.agro/cli/src/commands/tool.ts` | `installOnHost` | Remove the prompt and the clone. Add the refusal. |
| `.agro/cli/src/cli.ts` | `printOhHelp`, `printHarnessHelp`, `printToolHelp`, new `parseWorkspaceArgs`, new `printWorkspaceHelp`, `main` dispatch | CLI surface |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace. Writes no config. |
| `agro workspace list [--json]` | New | Lists workspaces and marks the default. |
| `agro harness install <id> --host` / `--workspace` / `--path` | Changed | Refuses when the resolved root holds no checkout. No clone, no workspace prompt. |
| `agro tool install <id> --host` / `--path` | Changed | Refuses when the resolved root holds no checkout. No clone, no root prompt. |
| `agro --help`, `agro harness --help`, `agro tool --help` | Changed | Help text names the workspace door. |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md` | Changed | Document the door and the refusal. |
| `mifunedev/agro-web` | Open | See Open Questions. |

## Storage

The task adds no persistent state and no registry file.
Workspaces stay git checkouts under `~/.agro/workspaces/<name>/`, or at a `--path` directory.
`~/.agro/config.json` keeps its schema. Only `harness install` and `tool install` write `harnessRoot`, as today.

## Architectural Decisions

- The filesystem is the source of truth for workspace existence. A workspace exists when its root holds a `.git` entry. `ensureHostWorkspace` uses the same test to choose `reused`.
- `listWorkspaces` follows `registry.listEntries`: read the directory, keep directories whose names match `SANDBOX_NAME_PATTERN`, require the marker entry (`.git`), sort.
- The default workspace is the root that `resolveHarnessRoot(undefined, env, home)` returns: the recorded `harnessRoot`, else `~/.agro/workspaces/default`.
- `create` is the only caller of `ensureHostWorkspace` after this task. The two install paths call an existence check and the shared refusal helper.
- One helper in `host-workspace.ts` builds the refusal text for both install paths, so the two messages cannot drift.
- `create` runs on the host. The command does not route through the sandbox execution target.

## Test Plan (TDD)

Run each test with `pnpm vitest run <file>` from the repository root. Run `pnpm run typecheck` from the repository root.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | missing root dir; non-matching names; directory without `.git`; sorted output; refusal text with an empty list and with a named list; refusal for a `--path` root | US-001, US-004, US-005 |
| `.agro/cli/src/__tests__/workspace.test.ts` (new) | `create`: default, named, `--path`, name plus `--path`, invalid name, reuse, non-empty directory, state-home refusals, unchanged config. `list`: text, `--json`, default marker, empty list | US-001, US-002 |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | top-level help shows `workspace` | US-003 |
| `.agro/cli/src/__tests__/workspace.test.ts` (new) | `parseWorkspaceArgs`: unknown subcommand, extra argument, `--json` on `create`, `--path` on `list`, `--help` | US-003 |
| `.agro/cli/src/__tests__/harness.test.ts` | replace the clone cases (`clones into a named workspace…`, the `Workspace name [default]:` cases) with refusal cases; keep the success cases against a pre-created checkout | US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | replace the clone and `Harness root [` cases with refusal cases; keep the success cases against a pre-created checkout | US-005 |

## Design Principles

- `agro` is the only lifecycle door. The workspace door joins the existing verbs in `.agro/cli/src/cli.ts`.
- One writer per key. `create` never writes `harnessRoot`.
- Reuse `ensureHostWorkspace`, `workspaceRoot`, and `resolveHarnessRoot`. Do not add a second clone path.
- Delete the two install-time prompts. Do not leave a dormant clone path behind a flag.
- Add no explanatory comments to tracked code.

Surface check:

- Host and sandbox: applied. All changes run on the host CLI. `create` clones on the host.
- Lifecycle door: applied. `workspace`, `harness install`, and `tool install` change together.
- Canonical and provider surfaces: not applicable. The task changes no skill, hook, or symlink.
- Root and scaffold: applied to the CLI only. Initialized projects need no change.
- Interactive and headless processes: not applicable. The commands are one-shot.
- Local and remote operation: applied. The commands take no terminal state and run the same on a remote VM.
- Parallel operation: applied. Two `create` runs on the same name race on `git clone`. `ensureHostWorkspace` keeps its present behavior. This task adds no lock.
- Public documentation: open. See Open Questions.
- Verification: applied. See Test Plan.

## Out of Scope

- `agro workspace use` and `agro workspace status`.
- `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- A change to `harness uninstall` or `tool uninstall`.
- Migration of an existing `harnessRoot` that points outside `~/.agro/workspaces/`.

## Open Questions

1. `list` scans only `~/.agro/workspaces/`. A workspace from `create --path`, or a recorded `harnessRoot` outside that directory, does not appear. Does `list` add the recorded `harnessRoot` as an extra row when that root lies outside `~/.agro/workspaces/`? This plan assumes no.
2. Does `create` accept `--path` together with a name, or refuse? This plan refuses, to match `parseHarnessArgs`.
3. Does the task need a matching change in `mifunedev/agro-web`? The public site documents host installs at `<agro-web page>`.
4. Which release note records the `--workspace` behavior change? This plan assumes the `CHANGELOG.md` convention in `.agro/skills/git/SKILL.md`.

## Acceptance Criteria

- [ ] Every story acceptance criterion above passes.
- [ ] `pnpm vitest run .agro/cli` exits 0 from the repository root.
- [ ] `pnpm run typecheck` exits 0 from the repository root.
- [ ] `grep -n "ensureHostWorkspace" .agro/cli/src/commands/harness.ts .agro/cli/src/commands/tool.ts` prints no line.
- [ ] `grep -rn "harnessRoot" .agro/cli/src/commands/workspace.ts` prints no line.
- [ ] The diff adds no explanatory comment to tracked code.

## Lessons

Filled by the advisor before undraft.
