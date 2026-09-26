# PRD: `agro workspace` command for host workspaces

Status: DRAFT

Source: `work/issue-1086.md` (issue #1086). The RFC is #1070.

## User Stories

### US-001: Share workspace discovery in `host-workspace.ts`

**Description:** As a CLI maintainer, I want one shared workspace scan so that `workspace list` and both install refusals report the same set.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-workspace.ts` exports `listHostWorkspaces(env, home)`.
- [ ] `listHostWorkspaces` returns the sorted names of the directories under `workspacesRoot(env, home)` that match `SANDBOX_NAME_PATTERN` and hold a `.git` entry.
- [ ] `listHostWorkspaces` returns `[]` when `~/.agro/workspaces/` does not exist.
- [ ] `listHostWorkspaces` skips a directory with no `.git` entry and skips a name that fails `SANDBOX_NAME_PATTERN`.
- [ ] `stateHomeRefusal` and `stateHomeRootRefusal` accept the command label, so that `agro workspace create` prints `agro workspace:` and not `agro harness:`.
- [ ] `.agro/cli/src/lib/__tests__/host-workspace.test.ts` covers each case above, and `pnpm test` exits 0.

### US-002: Add `agro workspace create`

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` so that I can clone `mifunedev/agro` into a host workspace without an install.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` through `ensureHostWorkspace` and exits 0.
- [ ] `agro workspace create acme` clones into `~/.agro/workspaces/acme`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`.
- [ ] When the target already holds a `.git` entry, the command prints `host workspace reused at <root>`, runs no `git clone`, and exits 0.
- [ ] An invalid name, for example `../../.ssh`, exits 1 with `invalid workspace name "../../.ssh"` and creates no directory.
- [ ] When the state home is split or legacy, the command prints the `stateHomeRefusal` text with the `agro workspace:` label and exits 1.
- [ ] When the target equals the state home, the command prints the `stateHomeRootRefusal` text and exits 1.
- [ ] After each outcome above, `~/.agro/config.json` is byte-identical to the file before the run, or still absent. The command writes no `harnessRoot`.
- [ ] `agro workspace create a b` and an unknown flag exit 1 with a parse error.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers each case above, and `pnpm test` exits 0.

### US-003: Add `agro workspace list`

**Description:** As an operator, I want `agro workspace list [--json]` so that I can see each host workspace and the workspace that an install uses.

**Acceptance Criteria:**

- [ ] `agro workspace list` prints one row for each name from `listHostWorkspaces`, with the name and the absolute root.
- [ ] The row whose root equals `resolveHarnessRoot(undefined, env, home)` carries a default marker. No other row carries the marker.
- [ ] With no workspace, `agro workspace list` prints a line that names `agro workspace create` and exits 0.
- [ ] `agro workspace list --json` prints a JSON array of `{ "name", "root", "default" }` objects, and `jq -e .` accepts the output.
- [ ] `agro workspace list` writes no file and runs no `git` process.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers each case above, and `pnpm test` exits 0.

### US-004: Register `agro workspace` in the CLI door

**Description:** As an operator, I want `agro workspace` in the top-level help and dispatch so that I find the command next to `harness` and `tool`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/cli.ts` exports `parseWorkspaceArgs` and dispatches `workspace create` and `workspace list` to `.agro/cli/src/commands/workspace.ts`.
- [ ] `agro workspace --help` prints the usage for `create` and `list`, and exits 0.
- [ ] `agro workspace` with no subcommand, or with an unknown subcommand, exits 1 and names `create` and `list`.
- [ ] `agro --help` lists `agro workspace <args...>`.
- [ ] `oh workspace list` prints the same rows as `agro workspace list`.
- [ ] `pnpm test` exits 0, and `pnpm run typecheck` exits 0.

### US-005: Stop `agro harness install` from creating a workspace

**Description:** As an operator, I want `agro harness install --host` to require an existing workspace so that a harness install never clones as a side effect.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` no longer calls `ensureHostWorkspace` and no longer asks `Workspace name [default]:`.
- [ ] When the resolved root holds a `.git` entry, the install proceeds as before: `link-providers.sh --init`, the install, the receipt, and `harnessRoot` in `~/.agro/config.json`.
- [ ] When the resolved root holds no `.git` entry, the command exits 1 before any `git`, `link-providers.sh`, or installer process runs, and leaves `~/.agro/config.json` unchanged.
- [ ] The refusal names `agro workspace create` with the matching argument: `<name>` for `--workspace <name>`, `--path <dir>` for `--path <dir>`, and no argument for the default root.
- [ ] The refusal lists every name from `listHostWorkspaces`, or states that no workspace exists.
- [ ] `--workspace beta` with no `~/.agro/workspaces/beta` checkout refuses and runs no `git clone`.
- [ ] The tests in `.agro/cli/src/__tests__/harness.test.ts` that assert a clone or the `Workspace name [default]:` prompt now assert the refusal or a pre-created workspace, and `pnpm test` exits 0.

### US-006: Stop `agro tool install` from creating a workspace

**Description:** As an operator, I want `agro tool install --host` to require an existing workspace so that a tool install never records an unbacked `harnessRoot`.

**Acceptance Criteria:**

- [ ] The host path of `runToolInstall` in `.agro/cli/src/commands/tool.ts` no longer calls `ensureHostWorkspace` and no longer asks `Harness root [<root>]:`.
- [ ] When the resolved root holds a `.git` entry, the install proceeds as before and records `hostTools` and `harnessRoot`.
- [ ] When the resolved root holds no `.git` entry, the command exits 1 before any `git` or installer process runs, and leaves `~/.agro/config.json` unchanged.
- [ ] The refusal names `agro workspace create` and lists every name from `listHostWorkspaces`, or states that no workspace exists.
- [ ] The tests in `.agro/cli/src/__tests__/tool.test.ts` that assert a clone now assert the refusal or a pre-created workspace, and `pnpm test` exits 0.

### US-007: Update help text and repository documentation

**Description:** As an operator, I want the help text and docs to name `agro workspace create` as the only workspace creator so that the docs match the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` and `printToolHelp` in `.agro/cli/src/cli.ts` state that a host install uses an existing workspace and name `agro workspace create`. Neither text says that an install clones.
- [ ] `docs/lifecycle-commands.md` lists `agro workspace create` and `agro workspace list`.
- [ ] `docs/harnesses/overview.md` and `docs/installation.md` describe `agro workspace create` as the step before a host install, and no longer describe a clone during an install or the workspace-name prompt.
- [ ] `grep -rn "clones the AGRO workspace" docs .agro/cli/src/cli.ts` prints no line.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed doc section, or reports no finding inside the changed lines.

## Summary

Verified current state:

- `installOnHost` (`.agro/cli/src/commands/harness.ts:342`) resolves a root, asks `Workspace name [default]:` on an interactive first install, then calls `ensureHostWorkspace`, which clones `AGRO_REPO_URL` when no `.git` exists.
- The host path of `runToolInstall` (`.agro/cli/src/commands/tool.ts:418-455`) carries a second copy of that flow. The copy asks `Harness root [<root>]:` and accepts a free-form path.
- `ensureHostWorkspace` (`.agro/cli/src/lib/host-workspace.ts`) already clones or reuses a checkout, and refuses a non-empty directory with no checkout.
- `workspaceRoot`, `workspacesRoot`, `assertWorkspaceName`, `DEFAULT_WORKSPACE_NAME`, and `resolveHarnessRoot` live in `.agro/cli/src/lib/host-config.ts`.
- `registry.listEntries` (`.agro/cli/src/lib/registry.ts:44`) scans `~/.agro/sandboxes/` for directories that match `SANDBOX_NAME_PATTERN`. No equivalent scan exists for `~/.agro/workspaces/`.
- Both install paths write `harnessRoot` after a successful install. No other code path writes the key.

Selected approach: add `.agro/cli/src/commands/workspace.ts` with `runWorkspaceCreate` and `runWorkspaceList`. `create` wraps `ensureHostWorkspace`. `list` wraps a new `listHostWorkspaces` scan. Both install paths keep root resolution: `--workspace`/`--path`, then `harnessRoot`, then `~/.agro/workspaces/default`. Both install paths drop the clone and the root prompt. Each install path refuses when the resolved root holds no checkout. The `[y/N]` host-install confirmation stays.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal`, new `listHostWorkspaces` | Clone, refusal text, workspace scan |
| `.agro/cli/src/lib/host-config.ts` | `workspaceRoot`, `workspacesRoot`, `resolveHarnessRoot`, `DEFAULT_WORKSPACE_NAME` | Name validation and root resolution |
| `.agro/cli/src/lib/registry.ts` | `listEntries`, `SANDBOX_NAME_PATTERN` | Pattern for the workspace scan |
| `.agro/cli/src/commands/workspace.ts` | new `runWorkspaceCreate`, `runWorkspaceList` | New command bodies |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Remove clone and name prompt; add refusal |
| `.agro/cli/src/commands/tool.ts` | host path of `runToolInstall` | Remove clone and root prompt; add refusal |
| `.agro/cli/src/cli.ts` | `printOhHelp`, `printHarnessHelp`, `printToolHelp`, new `printWorkspaceHelp`, new `parseWorkspaceArgs`, dispatch | CLI door |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clone `mifunedev/agro` into a host workspace |
| `agro workspace list [--json]` | New | List host workspaces and mark the default |
| `agro harness install <id> --host` / `--workspace` / `--path` | Behavior change | Refuse when the resolved root holds no checkout; no clone |
| `agro tool install <id> --host` / `--path` | Behavior change | Refuse when the resolved root holds no checkout; no clone |
| Interactive host install prompts | Removed | `Workspace name [default]:` and `Harness root [<root>]:` |
| `agro --help`, `agro harness --help`, `agro tool --help` | Text change | Name `agro workspace` |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `docs/installation.md` | Text change | Match the new flow |
| `mifunedev/agro-web` | Follow-up | Public docs that describe the install clone need a matching change |

## Storage

`~/.agro/workspaces/<name>/` stays the workspace location. `list` scans that directory. This task adds no registry file and no config key. `create` writes no key to `~/.agro/config.json`. The install paths keep their present writes of `harnessRoot`, `hostHarnesses`, and `hostTools`.

## Architectural Decisions

- The filesystem is the source of truth for workspaces. A workspace exists when `<root>/.git` exists.
- `harnessRoot` has two writers: `harness install` and `tool install`. `workspace create` never writes the key.
- `list` derives the default from `resolveHarnessRoot(undefined, env, home)`, the same resolution that an install without flags uses.
- `agro workspace` is the only command that clones `mifunedev/agro` on the host.
- The command runs on the host only. It needs no sandbox and no Docker.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | missing root, empty root, valid checkouts, directory without `.git`, invalid name, sort order | US-001 |
| `.agro/cli/src/__tests__/workspace.test.ts` | create default, create named, create `--path`, reuse, invalid name, split state home, root equals state home, config unchanged | US-002 |
| `.agro/cli/src/__tests__/workspace.test.ts` | list empty, list rows, default marker from `harnessRoot`, default marker for `default`, `--json` shape, no writes | US-003 |
| `.agro/cli/src/__tests__/workspace.test.ts` or `cli-first-help.test.ts` | `parseWorkspaceArgs` errors, `--help`, top-level help line | US-004 |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal without checkout for default, `--workspace`, `--path`; listed names; no `git` call; install on a pre-created workspace | US-005 |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal without checkout; listed names; no `git` call; install on a pre-created workspace | US-006 |

Run from the repository root: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`.

## Design Principles

- Apply the `AGENTS.md` non-negotiables. The change touches host lifecycle code only and adds no persistent process.
- Keep one clone path: `ensureHostWorkspace`, reached only from `agro workspace create`.
- Keep one workspace scan: `listHostWorkspaces`, shared by `list` and both refusals.
- Delete the two root-selection prompts. Keep no dormant alternative.
- Add no tracked comments.

## Out of Scope

- `agro workspace use`, `agro workspace status`, and `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- A change to `harness uninstall`, `tool uninstall`, `harness list/status`, or `tool list/status`.
- The `mifunedev/agro-web` change. This task records the follow-up only.

## Open Questions

1. When the operator passes both `<name>` and `--path <dir>` to `create`, what happens? The plan refuses the pair, which matches the `harness install` rule for `--workspace` and `--path`. The issue synopsis shows both arguments in one line.
2. `create --path <dir>` and a recorded `harnessRoot` can point outside `~/.agro/workspaces/`. The scan does not find that workspace. Does `list` add a row for a recorded `harnessRoot` outside the registry? The plan adds no row.
3. When `harnessRoot` records a root with no checkout, an install refuses. Does the refusal suggest `create --path <harnessRoot>`, or a new name? The plan suggests `create --path <harnessRoot>`.
4. Does `create` print the next step, for example `agro harness install <id> --host`? The plan prints the root only.
5. Who opens the `mifunedev/agro-web` follow-up, and when?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0 from the repository root.
- [ ] `pnpm run typecheck` exits 0 from the repository root.
- [ ] `pnpm run lint` exits 0 from the repository root.
- [ ] `grep -n "ensureHostWorkspace" .agro/cli/src/commands/*.ts` prints lines from `workspace.ts` only.
- [ ] `grep -rn "Workspace name \[\|Harness root \[" .agro/cli/src` prints no line.
- [ ] `grep -n "harnessRoot" .agro/cli/src/commands/workspace.ts` prints no line.

## Lessons

Filled by the advisor before undraft.
