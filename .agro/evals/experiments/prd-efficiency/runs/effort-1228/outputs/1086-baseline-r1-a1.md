# PRD: `agro workspace` door for host workspaces

Status: DRAFT

## User Stories

### US-001: List host workspaces

**Description:** As an operator, I want `agro workspace list` so that I see each host workspace and the default workspace.

**Acceptance Criteria:**

- [ ] A new function `listWorkspaces(env, home)` returns the sorted names of each directory under `workspacesRoot(env, home)` that matches `SANDBOX_NAME_PATTERN` and holds `.git`.
- [ ] `listWorkspaces` returns `[]` when `~/.agro/workspaces/` does not exist.
- [ ] `agro workspace list` prints one line per workspace and marks the workspace whose root equals `resolveHarnessRoot(undefined, env, home)`.
- [ ] `agro workspace list --json` prints a JSON array of `{ name, root, default }` objects.
- [ ] `agro workspace list` exits 0 and names `agro workspace create` when no workspace exists.
- [ ] `agro workspace list` writes no file under `~/.agro/`.
- [ ] `npx vitest run .agro/cli/src/__tests__/workspace.test.ts` exits 0.

### US-002: Create a host workspace

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` so that I create a workspace without a harness install.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` through `ensureHostWorkspace`.
- [ ] `agro workspace create acme` clones into `workspaceRoot("acme", env, home)`.
- [ ] `agro workspace create 'Bad Name'` exits 1 with the `assertWorkspaceName` error, and the test runner records no `git clone` call.
- [ ] `agro workspace create acme --path /tmp/x` exits 1 and names both flags, because a name and a path conflict.
- [ ] `agro workspace create --path <dir>` exits 1 with the `stateHomeRootRefusal` text when `<dir>` is the state home.
- [ ] A second `agro workspace create acme` prints `host workspace reused at <root>` and exits 0.
- [ ] After each `create` run, `readHostConfig(env, home).harnessRoot` equals the value before the run.
- [ ] `npx vitest run .agro/cli/src/__tests__/workspace.test.ts` exits 0.

### US-003: `harness install --host` refuses without a workspace

**Description:** As an operator, I want `agro harness install <id> --host` to refuse when the workspace does not exist so that an install never creates a workspace.

**Acceptance Criteria:**

- [ ] `runHarnessInstall` on the host calls no `git clone` in any test case.
- [ ] If the resolved root holds no `.git`, `runHarnessInstall` exits 1, names `${bin} workspace create`, and lists each name that `listWorkspaces` returns.
- [ ] If no workspace exists, the refusal prints `none` in place of the list.
- [ ] If the resolved root holds `.git`, `runHarnessInstall` installs the harness and records `harnessRoot` as before.
- [ ] The existing `--workspace <name>` and `--path <dir>` resolution order stays unchanged.
- [ ] The tests in `.agro/cli/src/__tests__/harness.test.ts` that expect a clone now expect the refusal, and `npx vitest run .agro/cli/src/__tests__/harness.test.ts` exits 0.

### US-004: `tool install --host` refuses without a workspace

**Description:** As an operator, I want `agro tool install <id> --host` to refuse without a workspace so that a tool install records no root outside a workspace.

**Acceptance Criteria:**

- [ ] `runToolInstall` on the host no longer asks `Harness root [<root>]:`.
- [ ] `runToolInstall` on the host calls no `git clone` in any test case.
- [ ] If the resolved root holds no `.git`, `runToolInstall` exits 1, names `${bin} workspace create`, and lists each name that `listWorkspaces` returns.
- [ ] If the resolved root holds `.git`, `runToolInstall` installs the tool and records `harnessRoot` and `hostTools` as before.
- [ ] `npx vitest run .agro/cli/src/__tests__/tool.test.ts` exits 0.

### US-005: Document the workspace door

**Description:** As an operator, I want the help text and the lifecycle reference to name `agro workspace` so that I find the door before an install refuses.

**Acceptance Criteria:**

- [ ] `agro --help` lists `workspace <args...>`.
- [ ] `agro workspace --help` lists `create` and `list` with their flags.
- [ ] `agro harness --help` and `agro tool --help` state that a host install needs an existing workspace and name `workspace create`.
- [ ] `docs/lifecycle-commands.md` describes `agro workspace create` and `agro workspace list` and no longer states that an install clones the workspace.
- [ ] `npx vitest run .agro/cli` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

## Summary

Issue #1086 accepts a narrowed form of the #1070 RFC. Today an operator creates a host workspace only as a side effect of an install.

Verified current state:

- `runHarnessInstall` asks `Workspace name [default]:` and calls `ensureHostWorkspace` to clone into the root (`.agro/cli/src/commands/harness.ts:394-424`).
- `runToolInstall` asks `Harness root [<root>]:` for a free-form path and also calls `ensureHostWorkspace` (`.agro/cli/src/commands/tool.ts:437-455`).
- `ensureHostWorkspace` clones, reuses a checkout, or refuses a non-empty directory (`.agro/cli/src/lib/host-workspace.ts:96`).
- `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, and `resolveHarnessRoot` live in `.agro/cli/src/lib/host-config.ts`.
- `registry.listEntries` scans `~/.agro/sandboxes/` for directories that match `SANDBOX_NAME_PATTERN` (`.agro/cli/src/lib/registry.ts:44`).
- `.agro/cli/src/cli.ts` dispatches each verb by the first argument, for example `if (first === "harness")` at line 1389.

Selected approach: add `listWorkspaces` beside `workspacesRoot`. Add `.agro/cli/src/commands/workspace.ts` with `runWorkspaceCreate` and `runWorkspaceList`. Add `parseWorkspaceArgs` and a dispatch branch in `cli.ts`. Replace the clone step in both install paths with a check for `.git` and a refusal.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, new `listWorkspaces` | Workspace names, paths, and the default root |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRootRefusal`, `AGRO_REPO_URL` | Clone logic that only `workspace create` calls after this change |
| `.agro/cli/src/commands/workspace.ts` | new `runWorkspaceCreate`, `runWorkspaceList` | The new door |
| `.agro/cli/src/commands/harness.ts` | `runHarnessInstall` (lines 371-424) | Replace the clone with a refusal |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall` (lines 417-455) | Remove the root prompt and replace the clone with a refusal |
| `.agro/cli/src/cli.ts` | top-level help (line 110), `parseHarnessArgs`, `parseToolArgs`, dispatch at line 1389, new `parseWorkspaceArgs` | Argument parsing, dispatch, and help text |
| `.agro/cli/src/lib/registry.ts` | `listEntries` | Pattern for the directory scan |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace. Writes no `harnessRoot`. |
| `agro workspace list [--json]` | New | Lists workspaces and marks the default. |
| `agro harness install <id> --host` | Changed | Refuses when the resolved root holds no checkout. |
| `agro tool install <id> --host` | Changed | Removes the root prompt. Refuses when the resolved root holds no checkout. |
| `agro --help`, `agro harness --help`, `agro tool --help` | Changed | Name the new door. |
| `docs/lifecycle-commands.md` | Changed | Describes the new door and the refusal. |

## Storage

The workspace directories under `~/.agro/workspaces/<name>/` stay the only storage. This task adds no registry file. `list` scans the directory the same way that `registry.listEntries` scans `~/.agro/sandboxes/`. `create` never writes `~/.agro/config.json`.

## Architectural Decisions

- The filesystem is the source of truth for workspaces. A workspace is a directory under `workspacesRoot` with a valid name and a `.git` entry.
- `harnessRoot` in `~/.agro/config.json` keeps two writers: `runHarnessInstall` and `runToolInstall`.
- The default workspace is the root that `resolveHarnessRoot(undefined, env, home)` returns. `list` reuses that function, so `list` and each install agree on the default.
- `ensureHostWorkspace` keeps its clone, reuse, and refusal behavior. Only `runWorkspaceCreate` calls it after this change.
- Both install paths share one refusal helper, so the two messages stay identical.
- The command runs on the host. `~/.agro/` is host state.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `listWorkspaces` returns `[]` for a missing root; skips a directory without `.git`; skips an invalid name; sorts names | US-001 scan rules |
| `.agro/cli/src/__tests__/workspace.test.ts` | `list` text output and default marker; `list --json` shape; empty `list` names `workspace create` | US-001 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `create` default name; named create; invalid name; name with `--path`; state-home refusal; reuse; `harnessRoot` unchanged | US-002 |
| `.agro/cli/src/__tests__/harness.test.ts` | Refusal without a checkout lists workspaces; refusal prints `none`; install into an existing checkout records `harnessRoot`; no `git clone` call | US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | No `Harness root` prompt; refusal without a checkout; install into an existing checkout records `hostTools` | US-004 |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` or `.agro/cli/src/__tests__/docs.test.ts` | Help text names `workspace create` and `workspace list` | US-005 |

Write each red test before the change. Run `npx vitest run .agro/cli` from the repository root. Run `npm --prefix .agro/cli run typecheck` for the type check.

## Design Principles

- Keep one door per lifecycle action. `workspace create` creates. An install consumes.
- Reuse `ensureHostWorkspace`, `workspaceRoot`, and `resolveHarnessRoot`. Add no second clone path.
- Delete the free-form `Harness root` prompt from `tool install`. Leave no dormant alternative.
- Add no explanatory comments to tracked code.
- Write each refusal so that the operator can copy the next command from the refusal.

## Out of Scope

- `agro workspace use`, `agro workspace status`, and `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- Closing #1070. That RFC stays open.
- Changes to sandbox installs. The sandbox path does not clone a host workspace.

## Open Questions

1. `--path <dir>` on `create` clones outside `~/.agro/workspaces/`. `list` does not show that directory. Is that acceptable, or does `list` also show a `harnessRoot` outside `workspacesRoot`?
2. The `harness install` prompt `Workspace name [default]:` stays in this plan as a selection of an existing workspace. Is removal of that prompt the operator's intent instead?
3. `harness install --path <dir>` and `tool install --path <dir>` refuse in this plan when `<dir>` holds no checkout. Confirm that the refusal also covers an explicit `--path`.
4. `mifunedev/agro-web` documents the lifecycle verbs. Does this task need a matching change in `agro-web`, and who owns that change?

## Acceptance Criteria

- [ ] `agro workspace create` and `agro workspace list [--json]` work as US-001 and US-002 state.
- [ ] No host install path calls `ensureHostWorkspace` or `git clone`.
- [ ] Each host install refusal names `${bin} workspace create` and lists each existing workspace.
- [ ] `create` never changes `harnessRoot`.
- [ ] `npx vitest run .agro/cli` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
