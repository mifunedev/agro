# PRD: agro workspace door

Status: DRAFT

Source: `work/issue-1086.md`. Issue #1070 stays open as the RFC.

## User Stories

### US-001: List host workspaces

**Description:** As an operator, I want `agro workspace list` to show each host workspace and the default workspace so that I know which workspace a host install uses.

**Acceptance Criteria:**

- [ ] `listWorkspaces(env, home)` in `.agro/cli/src/lib/host-workspace.ts` returns one entry for each directory under `workspacesRoot(env, home)` that matches `SANDBOX_NAME_PATTERN` and holds a `.git` entry. The entries are sorted by name.
- [ ] `listWorkspaces` returns an empty array when `~/.agro/workspaces/` does not exist.
- [ ] Each entry carries `name`, `root`, and `default`. `default` is `true` only for the entry whose `root` equals `resolveHarnessRoot(undefined, env, home)`.
- [ ] `agro workspace list` prints one line per workspace with the name and the root. The line of the default workspace carries a `*` marker.
- [ ] `agro workspace list --json` prints a JSON array of `{ "name", "root", "default" }` objects and exits 0.
- [ ] If no workspace exists, `agro workspace list` prints a line that names `agro workspace create` and exits 0.
- [ ] If `~/.agro/config.json` fails validation, `agro workspace list` prints the validation error to stderr and exits 1.
- [ ] `agro workspace list` writes no file and runs no `git` command.

### US-002: Create a host workspace

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` to clone `mifunedev/agro` without a harness install so that I can create a workspace as a separate step.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` through `ensureHostWorkspace` and exits 0.
- [ ] `agro workspace create beta` clones into `~/.agro/workspaces/beta`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`.
- [ ] `agro workspace create beta --path <dir>` exits 1 with an error that tells the operator to pass one, not both.
- [ ] `agro workspace create Bad_Name` exits 1 with the `assertWorkspaceName` error and runs no `git` command.
- [ ] If the target already holds a `.git` entry, the command prints `host workspace reused at <root>` and exits 0.
- [ ] If `ensureHostWorkspace` throws, the command prints the error to stderr and exits 1.
- [ ] If `stateHomeRefusal` or `stateHomeRootRefusal` returns a message, the command prints a message that starts with `agro workspace:` and exits 1 before any clone.
- [ ] After each `create` run, `~/.agro/config.json` holds no new `harnessRoot` key. If the file did not exist before the run, the file does not exist after the run.

### US-003: Wire the workspace verb into the CLI

**Description:** As an operator, I want `agro workspace` in the top-level help and a `agro workspace --help` page so that I can find the door.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `create [<name>] [--path <dir>]`, `list [--json]`, and `--help`.
- [ ] `parseWorkspaceArgs` rejects an unknown subcommand, an unknown flag, `--json` on `create`, `--path` on `list`, a bare `--path`, and a second positional argument.
- [ ] `agro --help` holds a `workspace <args...>` line.
- [ ] `agro workspace --help` lists `create` and `list` and states that `create` never writes `harnessRoot`.
- [ ] `oh workspace --help` prints the same page with `oh` as the command name.

### US-004: Harness host install refuses without a workspace

**Description:** As an operator, I want `agro harness install --host` to refuse without a workspace so that an install never creates a workspace.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` resolves the root in the present order: `--workspace <name>` or `--path <dir>`, then `harnessRoot`, then `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] The refusal names the resolved root, names `agro workspace create`, and lists the name and root of each workspace that `listWorkspaces` returns. If `listWorkspaces` returns nothing, the refusal states that no workspace exists.
- [ ] The interactive path asks the `[y/N]` question and no `Workspace name [default]:` question.
- [ ] If the resolved root holds a `.git` entry, the install records `harnessRoot` and the `hostHarnesses` receipt as it does today.
- [ ] `ensureHostWorkspace` has no caller in `.agro/cli/src/commands/harness.ts`.

### US-005: Tool host install refuses without a workspace

**Description:** As an operator, I want `agro tool install --host` to refuse without a workspace so that a tool install never records an unbacked `harnessRoot`.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/tool.ts` resolves the root in the present order: `--path <dir>`, then `harnessRoot`, then `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1, runs no `git clone`, and writes no `~/.agro/config.json`.
- [ ] The refusal uses the same helper as US-004 and carries the same content.
- [ ] The interactive path asks the `[y/N]` question and no `Harness root [<root>]:` question.
- [ ] If the resolved root holds a `.git` entry, the install records `harnessRoot` and the `hostTools` receipt as it does today.
- [ ] `ensureHostWorkspace` has no caller in `.agro/cli/src/commands/tool.ts`.

### US-006: Document the workspace door

**Description:** As an operator, I want the help text and the docs to describe `agro workspace` so that the documented install flow matches the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` and `printToolHelp` state that a host install needs an existing workspace and name `workspace create`.
- [ ] `docs/lifecycle-commands.md` lists `agro workspace create` and `agro workspace list`, and no sentence states that `harness install` or `tool install` clones a workspace.
- [ ] `docs/harnesses/overview.md` and `docs/installation.md` show `agro workspace create` before the first host install, and no sentence states that an interactive run asks for a workspace name.
- [ ] `grep -rn "Workspace name \[" docs .agro/cli/README.md` prints nothing.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file that already passed before the change.

## Summary

Verified current state:

- `installOnHost` in `.agro/cli/src/commands/harness.ts:341` asks `Workspace name [default]:` and calls `ensureHostWorkspace`, which clones `AGRO_REPO_URL` when the root holds no `.git` entry.
- `installOnHost` in `.agro/cli/src/commands/tool.ts:379` carries a second wizard. The wizard asks `Harness root [<root>]:` and accepts a free-form path. The wizard also calls `ensureHostWorkspace`.
- Both install paths write `harnessRoot` and a receipt to `~/.agro/config.json` only after a successful install.
- `resolveHarnessRoot` in `.agro/cli/src/lib/host-config.ts:161` resolves the explicit path, then `harnessRoot`, then `defaultHarnessRoot`.
- `workspaceRoot` and `assertWorkspaceName` in `.agro/cli/src/lib/host-config.ts` validate a name against `SANDBOX_NAME_PATTERN`.
- `listEntries` in `.agro/cli/src/lib/registry.ts:44` scans `~/.agro/sandboxes/` by directory and name pattern. No workspace scan exists.
- `stateHomeRefusal` and `stateHomeRootRefusal` in `.agro/cli/src/lib/host-workspace.ts` hard-code the `${bin} harness:` prefix.
- `cli.ts` dispatches `harness` and `tool` at `.agro/cli/src/cli.ts:1389` and `.agro/cli/src/cli.ts:1426`. No `workspace` verb exists.

Selected approach:

1. Add `listWorkspaces` beside `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts`.
2. Add `.agro/cli/src/commands/workspace.ts` with `runWorkspaceCreate` and `runWorkspaceList`.
3. `runWorkspaceCreate` reuses `workspaceRoot`, `stateHomeRefusal`, `stateHomeRootRefusal`, and `ensureHostWorkspace`. It never calls `writeHostConfig`.
4. Add one refusal helper, `missingWorkspaceRefusal(bin, verb, root, env, home)`, in `.agro/cli/src/lib/host-workspace.ts`. Both install paths call the helper when the resolved root holds no `.git` entry.
5. Remove the name prompt and the path prompt from both install paths. Keep the `[y/N]` confirmation.
6. Give `stateHomeRefusal` and `stateHomeRootRefusal` a verb argument, so that `create` prints `agro workspace:`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal`, new `listWorkspaces`, new `missingWorkspaceRefusal` | Clone, scan, and refusal logic |
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, `DEFAULT_WORKSPACE_NAME` | Name validation and root resolution |
| `.agro/cli/src/lib/registry.ts` | `listEntries`, `SANDBOX_NAME_PATTERN` | Scan pattern to follow |
| `.agro/cli/src/commands/workspace.ts` | new `runWorkspaceCreate`, `runWorkspaceList`, `WorkspaceIO` | The new verb |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Replace the clone with the refusal |
| `.agro/cli/src/commands/tool.ts` | `installOnHost` | Replace the clone with the refusal |
| `.agro/cli/src/cli.ts` | `printOhHelp`, `printHarnessHelp`, `printToolHelp`, new `printWorkspaceHelp`, new `parseWorkspaceArgs`, dispatch | Parse, help, and dispatch |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New command | Clones `mifunedev/agro` into a workspace. Writes no `harnessRoot`. |
| `agro workspace list [--json]` | New command | Lists workspaces under `~/.agro/workspaces/` and marks the default. |
| `agro harness install <id> --host` / `--workspace` / `--path` | Behavior change | Refuses with exit 1 when the resolved root holds no `.git` entry. Clones nothing. |
| `agro tool install <id> --host` / `--path` | Behavior change | Refuses with exit 1 when the resolved root holds no `.git` entry. Clones nothing. |
| Interactive host install | Behavior change | Asks only the `[y/N]` question. |
| `agro --help`, `agro harness --help`, `agro tool --help` | Text change | Name the `workspace` verb and the new refusal. |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `docs/installation.md` | Text change | Describe the workspace door. |

## Storage

`list` reads the directory `~/.agro/workspaces/` and reads `~/.agro/config.json` through `readHostConfig`. `create` writes only the git clone. No new registry file exists. The pattern to follow is `listEntries` in `.agro/cli/src/lib/registry.ts`. The `harnessRoot` key keeps two writers: `harness install` and `tool install`.

## Architectural Decisions

- **Source of truth:** A workspace exists when its root holds a `.git` entry. The directory scan is the registry.
- **Default workspace:** The default workspace is the root that `resolveHarnessRoot(undefined, env, home)` returns. `list` and both install paths use this one function.
- **Existence check:** Both install paths call `existsSync(join(root, ".git"))` after they resolve the root. The paths no longer call `ensureHostWorkspace`.
- **Refusal content:** One helper builds the refusal for both install paths. The helper calls `listWorkspaces`.
- **Execution location:** `agro workspace` runs on the host. `agro workspace` does not probe a sandbox.
- **Name and path:** `create` accepts a name or `--path <dir>`, not both. This matches `parseHarnessArgs`.
- **Surface check:**
  - Host and sandbox: applied. The change is host CLI code.
  - Lifecycle door: applied. `agro` and `oh` share the dispatch.
  - Canonical and provider surfaces: not applicable. No skill or hook changes.
  - Root and scaffold: applied to the CLI only.
  - Interactive and headless processes: not applicable. No persistent process.
  - Local and remote operation: applied. Every command exits. No step needs an attached terminal.
  - Parallel operation: not applicable. Each command reads or clones one directory.
  - Public documentation: applied. See open question 3.
  - Verification: applied. See the test plan.

## Test Plan (TDD)

Run each test from the repository root with `pnpm exec vitest run <test file>`. Run `pnpm run typecheck` after each story.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | `listWorkspaces` with no directory, with valid and invalid names, with and without `.git`, with `harnessRoot` recorded; `missingWorkspaceRefusal` with zero and two workspaces | US-001, US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` (new) | `create` default, named, `--path`, name with `--path`, bad name, reuse, clone failure, state-home refusal, no `harnessRoot` write; `list` text, `--json`, empty, invalid config | US-001, US-002 |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | top-level help holds `workspace`; `workspace --help` content | US-003 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `parseWorkspaceArgs` accept and reject cases | US-003 |
| `.agro/cli/src/__tests__/harness.test.ts` | Replace the clone cases at lines 698, 968, 1166, and 1261 with refusal cases; keep the install cases against a fixture root that holds `.git` | US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | Replace the clone cases at lines 719 and 877 with refusal cases; keep the install cases against a fixture root that holds `.git` | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts` | Help and docs text assertions that name the host install flow | US-006 |

## Design Principles

- Keep one door per lifecycle action. `workspace create` creates. `install` installs.
- Reuse `ensureHostWorkspace`, `workspaceRoot`, and `resolveHarnessRoot`. Add no second resolver.
- Delete the two install wizards. Leave no dormant clone path in `installOnHost`.
- Add no tracked-code comments. Express intent through names and tests.
- Refuse with an actionable message. Each refusal names the next command.

## Out of Scope

- `agro workspace use` and `agro workspace status`.
- `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- A change to `harnessRoot` semantics or to the `hostHarnesses` and `hostTools` receipts.
- A change to `harness uninstall` or `tool uninstall`.

## Open Questions

1. The issue does not state what the interactive install asks after the workspace prompt is gone. This plan keeps only the `[y/N]` question. Confirm, or name a replacement prompt.
2. `harnessRoot` can point outside `~/.agro/workspaces/`, for example after `--path`. `list` scans only `~/.agro/workspaces/`, so `list` marks no entry as default in that case. Confirm that `list` shows no extra row for an external `harnessRoot`.
3. The public documentation lives in `mifunedev/agro-web`. Decide whether this task opens a matching change there, or whether a follow-up issue tracks the change.

## Acceptance Criteria

- [ ] `pnpm exec vitest run .agro/cli` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `grep -n "ensureHostWorkspace" .agro/cli/src/commands/*.ts` prints matches only in `.agro/cli/src/commands/workspace.ts`.
- [ ] `grep -rn "Workspace name \[\|Harness root \[" .agro/cli/src` prints nothing.
- [ ] Each story acceptance criterion above passes.

## Lessons

Filled by the advisor before undraft.
