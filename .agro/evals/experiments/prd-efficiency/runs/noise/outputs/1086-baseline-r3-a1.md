# PRD: `agro workspace` command for host workspace lifecycle

Status: DRAFT

Source: `work/issue-1086.md` (issue #1086). The issue narrows the RFC in #1070.

## User Stories

### US-001: Share workspace discovery and the missing-workspace refusal

**Description:** As an operator, I want one shared workspace scan and one shared refusal text so that every command reports workspaces the same way.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-workspace.ts` exports a function that returns the sorted names of the directories under `workspacesRoot(env, home)`. Each returned name matches `SANDBOX_NAME_PATTERN` and holds a `.git` entry.
- [ ] The function returns an empty list when `~/.agro/workspaces/` does not exist.
- [ ] The function skips a directory without `.git` and skips a name that fails `SANDBOX_NAME_PATTERN`.
- [ ] `.agro/cli/src/lib/host-workspace.ts` exports a function that returns the refusal text. The text names `${bin} workspace create` and lists every workspace name that the discovery function returns.
- [ ] If no workspace exists, the refusal text states that no workspace exists.
- [ ] `.agro/cli/src/lib/__tests__/host-workspace.test.ts` covers each criterion above, and `npx vitest run .agro/cli/src/lib/__tests__/host-workspace.test.ts` exits 0.

### US-002: Add `agro workspace create`

**Description:** As an operator, I want `agro workspace create [<name>] [--path <dir>]` so that I can clone `mifunedev/agro` into a workspace without a harness install.

**Acceptance Criteria:**

- [ ] `agro workspace create` with no argument clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` through `ensureHostWorkspace`.
- [ ] `agro workspace create beta` clones into `~/.agro/workspaces/beta`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`.
- [ ] `agro workspace create beta --path <dir>` exits 1 and states that the name and `--path` exclude each other. The command clones nothing.
- [ ] An invalid name exits 1 with the `invalid workspace name` message from `assertWorkspaceName`. The command creates no directory.
- [ ] If the target already holds a `.git` entry, the command prints `host workspace reused at <root>` and exits 0 without a `git clone` call.
- [ ] If the target holds files and no `.git` entry, the command exits 1 with the `ensureHostWorkspace` message.
- [ ] If `stateHomeRefusal` or `stateHomeRootRefusal` returns text, the command prints that text and exits 1 before any clone.
- [ ] After each run, `~/.agro/config.json` holds the same `harnessRoot` value as before the run. When the file did not exist before the run, the file does not exist after the run.
- [ ] A failed `git clone` exits 1 and prints the `could not clone` message.
- [ ] `.agro/cli/src/commands/__tests__/workspace.test.ts` covers each criterion above with a stub `LifecycleRunner`, and `npx vitest run .agro/cli/src/commands/__tests__/workspace.test.ts` exits 0.

### US-003: Add `agro workspace list`

**Description:** As an operator, I want `agro workspace list [--json]` so that I can see each host workspace and the workspace that installs use by default.

**Acceptance Criteria:**

- [ ] `agro workspace list` prints one row per name from the US-001 discovery function.
- [ ] The row whose root equals `resolveHarnessRoot(undefined, env, home)` carries a default marker.
- [ ] `agro workspace list --json` prints a JSON array. Each element holds `name`, `root`, and `default` (boolean).
- [ ] If no workspace exists, the text output names `${bin} workspace create` and exits 0. The JSON output is `[]` and exits 0.
- [ ] `agro workspace list` writes no file and runs no `git` command.
- [ ] `.agro/cli/src/commands/__tests__/workspace.test.ts` covers each criterion above, and the test file passes under `npx vitest run`.

### US-004: Route `agro workspace` in the CLI

**Description:** As an operator, I want `agro workspace` in the top-level help and in the argument parser so that I can discover and run the command.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/cli.ts` exports `parseWorkspaceArgs` and `printWorkspaceHelp`, and dispatches `workspace` to the US-002 and US-003 functions.
- [ ] `parseWorkspaceArgs` accepts `--path <dir>` and `--path=<dir>` on `create`, and `--json` on `list`.
- [ ] `parseWorkspaceArgs` rejects each of these inputs with exit 1: an unknown subcommand, an unknown flag, `--path` without a value, `--path` on `list`, `--json` on `create`, and a name on `list`.
- [ ] `agro --help` lists `workspace`. `agro workspace --help` lists `create` and `list` and exits 0.
- [ ] `agro workspace use`, `agro workspace status`, and `agro workspace remove` exit 1 with the unknown-subcommand error.
- [ ] `oh workspace list` behaves the same as `agro workspace list`, with `oh` as `${bin}` in each message.
- [ ] `npm run typecheck` in `.agro/cli` exits 0.
- [ ] The parser cases pass under `npx vitest run .agro/cli/src/__tests__/cli.property.test.ts` or a new `workspace` parser test file.

### US-005: Stop `agro harness install --host` from creating a workspace

**Description:** As an operator, I want `agro harness install --host` to use an existing workspace and refuse otherwise so that a harness install never clones as a side effect.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` resolves the root in this order: `--workspace <name>`, `--path <dir>`, the recorded `harnessRoot`, `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1 with the US-001 refusal text. The command makes no `git clone` call and creates no directory.
- [ ] The interactive run no longer asks `Workspace name [default]:`. The interactive run still asks `Install <title> on the host? [y/N]`.
- [ ] If the resolved root holds a `.git` entry, the install proceeds as today: link-providers, install, and the receipt.
- [ ] A successful install still writes `harnessRoot` and the `hostHarnesses` receipt, as today.
- [ ] `ensureHostWorkspace` has no call site in `harness.ts`.
- [ ] `.agro/cli/src/__tests__/harness.test.ts` replaces each test that expects a clone from `install` with a test that seeds a `.git` entry or expects the refusal. `npx vitest run .agro/cli/src/__tests__/harness.test.ts` exits 0.

### US-006: Stop `agro tool install --host` from creating a workspace

**Description:** As an operator, I want `agro tool install --host` to refuse without an existing workspace so that a tool install never records a `harnessRoot` outside a checkout.

**Acceptance Criteria:**

- [ ] The host install in `.agro/cli/src/commands/tool.ts` resolves the root in this order: `--path <dir>`, the recorded `harnessRoot`, `~/.agro/workspaces/default`.
- [ ] If the resolved root holds no `.git` entry, the command exits 1 with the US-001 refusal text. The command makes no `git clone` call and creates no directory.
- [ ] The interactive run no longer asks `Harness root [<root>]:`. The interactive run still asks `Install <title> on the host? [y/N]`.
- [ ] A successful install still writes `harnessRoot` and the `hostTools` receipt, as today.
- [ ] `parseToolArgs` still rejects `--workspace`.
- [ ] `ensureHostWorkspace` has no call site in `tool.ts`.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` replaces each test that expects a clone from `install` with a test that seeds a `.git` entry or expects the refusal. `npx vitest run .agro/cli/src/__tests__/tool.test.ts` exits 0.

### US-007: Update help text and documentation

**Description:** As an operator, I want the help text and the docs to describe `agro workspace` so that the documented install flow matches the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` and `printToolHelp` in `.agro/cli/src/cli.ts` state that a host install needs an existing workspace and name `${bin} workspace create`. Neither help text states that `install` clones.
- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`.
- [ ] `docs/harnesses/overview.md` and `docs/installation.md` no longer describe the `Workspace name [default]:` prompt or a clone during install.
- [ ] `.agro/cli/README.md` shows `agro workspace create` before the first host install example.
- [ ] `CHANGELOG.md` holds one entry under the unreleased section for the new command and the changed install behavior.
- [ ] `grep -rn "Workspace name \[" docs .agro/cli/README.md .agro/cli/src --exclude-dir=__tests__` prints no match.
- [ ] `npx vitest run .agro/cli/src/__tests__/docs.test.ts .agro/cli/src/__tests__/cli-first-help.test.ts` exits 0.

## Summary

Verified current state:

- `installOnHost` in `.agro/cli/src/commands/harness.ts` resolves a root, asks `Workspace name [default]:` on an interactive run, and calls `ensureHostWorkspace`. That call clones `AGRO_REPO_URL` when the root holds no `.git` entry.
- The host install in `.agro/cli/src/commands/tool.ts` holds a second copy of that flow. The copy asks `Harness root [<root>]:` and accepts a free-form path.
- Both install paths write `harnessRoot` and a receipt to `~/.agro/config.json` after a successful install.
- `.agro/cli/src/lib/host-config.ts` owns `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `DEFAULT_WORKSPACE_NAME`, and `resolveHarnessRoot`.
- `.agro/cli/src/lib/host-workspace.ts` owns `ensureHostWorkspace`, `stateHomeRefusal`, and `stateHomeRootRefusal`.
- `registry.listEntries` in `.agro/cli/src/lib/registry.ts` scans `~/.agro/sandboxes/` for directories that match `SANDBOX_NAME_PATTERN`. No registry file exists.
- `.agro/cli/src/cli.ts` has no `workspace` verb.

Selected approach:

1. Add a discovery function and a refusal function to `host-workspace.ts`.
2. Add `.agro/cli/src/commands/workspace.ts` with `runWorkspaceCreate` and `runWorkspaceList`. `runWorkspaceCreate` reuses `ensureHostWorkspace` and the two state-home refusals.
3. Route `workspace` in `cli.ts`.
4. Remove the clone and the name or root prompt from both install paths. Keep the consent prompt. Refuse when the resolved root holds no `.git` entry.
5. Update help text and docs.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRefusal`, `stateHomeRootRefusal`, new discovery and refusal functions | Clone logic and workspace discovery |
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, `DEFAULT_WORKSPACE_NAME` | Workspace paths and root resolution |
| `.agro/cli/src/lib/registry.ts` | `SANDBOX_NAME_PATTERN`, `listEntries` | Name pattern and the scan pattern to follow |
| `.agro/cli/src/commands/workspace.ts` (new) | `runWorkspaceCreate`, `runWorkspaceList` | New command bodies |
| `.agro/cli/src/commands/harness.ts` | `installOnHost` | Removes the clone and the name prompt |
| `.agro/cli/src/commands/tool.ts` | host install path near the `Harness root [` prompt | Removes the clone and the root prompt |
| `.agro/cli/src/cli.ts` | `printOhHelp`, `printHarnessHelp`, `printToolHelp`, new `parseWorkspaceArgs`, `printWorkspaceHelp`, dispatch | Routing and help |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New | Clones `mifunedev/agro` into a workspace. Never writes `harnessRoot`. |
| `agro workspace list [--json]` | New | Lists workspaces under `~/.agro/workspaces/` and marks the default. |
| `agro harness install <id> --host` | Changed | Refuses when the resolved root holds no `.git` entry. Never clones. |
| `agro tool install <id> --host` | Changed | Refuses when the resolved root holds no `.git` entry. Never clones. |
| Interactive host install prompts | Removed | `Workspace name [default]:` and `Harness root [<root>]:` no longer appear. |
| `oh` alias | Unchanged contract | `oh workspace` routes through the same dispatch. |
| `mifunedev/agro-web` docs | Changed | Public install docs must name `agro workspace create`. |

## Storage

No new storage. A workspace is a git checkout at `~/.agro/workspaces/<name>` or at a `--path` directory. `list` scans `~/.agro/workspaces/` the way `registry.listEntries` scans `~/.agro/sandboxes/`. `~/.agro/config.json` keeps its schema. Only the two install paths write `harnessRoot`.

## Architectural Decisions

- **Source of truth:** the filesystem. A workspace exists when its directory holds a `.git` entry. No registry file.
- **Single clone owner:** `agro workspace create` is the only caller of `ensureHostWorkspace` after this change.
- **Default workspace:** `resolveHarnessRoot(undefined, env, home)` defines the default. `list` marks the row that equals that root.
- **`harnessRoot` ownership:** the two install paths stay the only writers. `create` reads nothing from `harnessRoot` and writes nothing to `harnessRoot`.
- **Execution location:** every `agro workspace` verb runs on the host. The verbs make no Docker call.
- **Scope of the install change:** install still accepts `--path` and, for harness, `--workspace`. Install only stops cloning.

Surface review:

| Surface | Status |
|---|---|
| Host and sandbox | applied: host-only verbs; code changes run in the sandbox |
| Lifecycle door | applied: `agro` and `oh` gain `workspace` |
| Canonical and provider surfaces | not applicable: no skill or hook changes |
| Root and scaffold | applied: CLI package only |
| Interactive and headless processes | not applicable: short-lived commands |
| Local and remote operation | applied: works the same on a remote VM host |
| Parallel operation | applied: `create` on an existing checkout reuses the checkout; no shared lock needed |
| Public documentation | applied: `mifunedev/agro-web` needs a matching change |
| Verification | applied: vitest suites and `npm run typecheck` |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-workspace.test.ts` | discovery with no directory, with checkouts, with a non-checkout, with a bad name; refusal text with zero and with two workspaces | US-001 |
| `.agro/cli/src/commands/__tests__/workspace.test.ts` | `create` default, named, `--path`, name plus `--path`, invalid name, reuse, blocked directory, state-home refusals, clone failure, `harnessRoot` unchanged | US-002 |
| `.agro/cli/src/commands/__tests__/workspace.test.ts` | `list` text, `--json`, default marker from recorded `harnessRoot`, empty state, no writes | US-003 |
| `.agro/cli/src/__tests__/cli.property.test.ts` or a new parser test | `parseWorkspaceArgs` accept and reject cases; help output | US-004 |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal without `.git`; install with seeded `.git`; no name prompt; `--workspace` to a missing entry refuses | US-005 |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal without `.git`; install with seeded `.git`; no root prompt; `--path` to a missing checkout refuses | US-006 |
| `.agro/cli/src/__tests__/docs.test.ts`, `.agro/cli/src/__tests__/cli-first-help.test.ts` | help and docs consistency | US-007 |

Run the full suite with `npx vitest run` from the repository root. Run `npm run typecheck` in `.agro/cli`.

## Design Principles

- Keep one door per lifecycle action. `workspace create` clones; `install` installs.
- Reuse `ensureHostWorkspace` and the state-home refusals. Do not copy the clone logic.
- Delete the two prompt copies. Do not leave a dormant wizard.
- Follow the `registry.listEntries` scan. Add no registry file.
- Add no comments to tracked code.
- Keep each refusal actionable: name the next command and list the workspaces that exist.

## Out of Scope

- `agro workspace use`, `agro workspace status`, and `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- Changes to `harness uninstall`, `harness status`, `tool uninstall`, and `tool status`.
- Closing #1070.

## Open Questions

1. `stateHomeRefusal` and `stateHomeRootRefusal` print the prefix `${bin} harness:`. Should `workspace create` print its own prefix? Default in this plan: `workspace create` prints `${bin} workspace:` through a new prefix parameter.
2. A `--path` workspace lives outside `~/.agro/workspaces/`, so `list` does not show the workspace. If the recorded `harnessRoot` points outside `~/.agro/workspaces/`, should `list` add a row for that root? Default in this plan: no extra row; the issue limits `list` to the scan.
3. The issue does not state whether the interactive install keeps a prompt that picks among existing workspaces. Default in this plan: remove the name and root prompts and keep only the consent prompt.
4. Does the refusal for an explicit `--workspace <name>` or `--path <dir>` differ from the refusal for the default root? Default in this plan: one refusal text that names the resolved root, `${bin} workspace create`, and the existing workspaces.

## Acceptance Criteria

- [ ] `npx vitest run` from the repository root exits 0.
- [ ] `npm run typecheck` in `.agro/cli` exits 0.
- [ ] `grep -n "ensureHostWorkspace" .agro/cli/src/commands/*.ts` prints matches only in `.agro/cli/src/commands/workspace.ts`.
- [ ] `agro workspace create` followed by `agro harness install claude-code --host` installs without a second clone.
- [ ] `agro harness install claude-code --host` with no workspace exits 1 and prints `workspace create`.
- [ ] `agro tool install herdr --host` with no workspace exits 1 and prints `workspace create`.
- [ ] `agro workspace create` leaves the `harnessRoot` value in `~/.agro/config.json` unchanged.
- [ ] A matching `mifunedev/agro-web` change exists or the PR body links an issue that tracks the change.

## Lessons

Filled by the advisor before undraft.
