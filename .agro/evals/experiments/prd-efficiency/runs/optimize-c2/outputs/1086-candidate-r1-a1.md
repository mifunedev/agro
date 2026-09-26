# PRD: Add the agro workspace door

Status: DRAFT

## User Stories

### US-001: Create and list host workspaces

**Description:** As an operator, I want `agro workspace` commands so that I create workspaces without an install.

**Acceptance Criteria:**

- [ ] The new file `.agro/cli/src/commands/workspace.ts` exports `runWorkspaceCreate` and `runWorkspaceList`.
- [ ] `agro workspace create` without a name clones `AGRO_REPO_URL` into `~/.agro/workspaces/default` through `ensureHostWorkspace`.
- [ ] `agro workspace create beta` clones into `~/.agro/workspaces/beta`.
- [ ] `agro workspace create --path <dir>` clones into the resolved `<dir>`.
- [ ] `agro workspace create` with both a name and `--path` exits 1, prints a usage error, and spawns no `git` process.
- [ ] `agro workspace create Bad_Name` exits 1 with the `assertWorkspaceName` message and creates no directory.
- [ ] If the target already holds a `.git` directory, `create` prints `host workspace reused at <root>`, spawns no `git clone`, and exits 0.
- [ ] After `create` exits 0, `harnessRoot` in `~/.agro/config.json` holds the value from before the run. If the file was absent, the file stays absent.
- [ ] `agro workspace list` prints one line per directory under `~/.agro/workspaces/` whose name matches `SANDBOX_NAME_PATTERN` and that holds a `.git` directory, sorted by name.
- [ ] `agro workspace list` marks exactly one line as the default: the line whose path equals `resolveHarnessRoot(undefined, env, home)`.
- [ ] If no workspace exists, `agro workspace list` prints `no workspaces — run agro workspace create` and exits 0.
- [ ] `agro workspace list --json` prints a JSON array of objects with the keys `name`, `path`, and `default`.
- [ ] `agro workspace --help` prints both subcommands, and the top-level help lists `workspace`.
- [ ] The test command `npx vitest run <new workspace test file>` exits 0 for the new file `.agro/cli/src/__tests__/workspace.test.ts`.

### US-002: Stop harness install from creating workspaces

**Description:** As an operator, I want `harness install --host` to refuse without a workspace so that installs never clone.

**Acceptance Criteria:**

- [ ] `installOnHost` in `.agro/cli/src/commands/harness.ts` never calls `ensureHostWorkspace`.
- [ ] The interactive run no longer asks `Workspace name [default]:`. The run still asks the `[y/N]` host-install question.
- [ ] If the resolved root holds no `.git` directory, the install exits 1, spawns no `git` process, and writes no `~/.agro/config.json`.
- [ ] The refusal names `${bin} workspace create` and lists each workspace name that `agro workspace list` reports.
- [ ] If no workspace exists, the refusal states that no workspace exists.
- [ ] If `~/.agro/workspaces/beta` holds a `.git` directory, `harness install <id> --workspace beta` installs into that workspace.
- [ ] A successful install still records `harnessRoot` and the `hostHarnesses` receipt.
- [ ] `npx vitest run .agro/cli/src/__tests__/harness.test.ts` exits 0.

### US-003: Stop tool install from creating workspaces

**Description:** As an operator, I want `tool install --host` to refuse without a workspace so that installs never clone.

**Acceptance Criteria:**

- [ ] The host path of `runToolInstall` in `.agro/cli/src/commands/tool.ts` never calls `ensureHostWorkspace`.
- [ ] The interactive run no longer asks the free-form `Harness root [<root>]:` question.
- [ ] If the resolved root holds no `.git` directory, the install exits 1, spawns no `git` process, and writes no `~/.agro/config.json`.
- [ ] The refusal text matches the US-002 refusal, with the `${bin} tool:` prefix.
- [ ] `tool install herdr --path <dir>` still installs when `<dir>` holds a `.git` directory, and records `harnessRoot` as `<dir>`.
- [ ] `npx vitest run .agro/cli/src/__tests__/tool.test.ts` exits 0.

### US-004: Document the workspace door

**Description:** As an operator, I want the docs to name `agro workspace` so that I find the create step.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list`.
- [ ] `docs/lifecycle-commands.md` states that a host install refuses when no workspace exists, and names `agro workspace create`.
- [ ] `printHarnessHelp` and `printToolHelp` in `.agro/cli/src/cli.ts` no longer state that a host install clones the workspace.
- [ ] `docs/harnesses/overview.md` states no clone during a host install.
- [ ] `CHANGELOG.md` holds one entry for the new door and the install refusal.

## Summary

Today a host workspace appears only as a side effect of an install. `installOnHost` asks for a workspace name and calls `ensureHostWorkspace` (`.agro/cli/src/commands/harness.ts:396-424`). The host path of `runToolInstall` carries a second wizard that asks for a free-form path (`.agro/cli/src/commands/tool.ts:437-455`). A tool install can therefore record a `harnessRoot` outside `~/.agro/workspaces/`.

The helpers exist in `.agro/cli/src/lib/host-config.ts`: `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `DEFAULT_WORKSPACE_NAME`, and `resolveHarnessRoot`. `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` clones or reuses a checkout. `listEntries` in `.agro/cli/src/lib/registry.ts` scans `~/.agro/sandboxes/` by directory, name pattern, and marker file.

The selected approach:

1. Add `listWorkspaces` to `.agro/cli/src/lib/host-config.ts`. The function follows the `listEntries` scan and uses a `.git` directory as the marker.
2. Add the new file `.agro/cli/src/commands/workspace.ts` with `create` and `list`. `create` is the only caller of `ensureHostWorkspace`.
3. Replace the clone step in both install paths with a presence check on the resolved root. The check refuses when the root holds no `.git` directory.
4. Wire `workspace` into the dispatcher in `.agro/cli/src/cli.ts`, next to the `harness` and `tool` branches.

Surface review:

- Host and sandbox: applied. The CLI change runs on the host. The application agent implements the change inside the sandbox.
- Lifecycle door: applied. `agro workspace` is a new verb of the one door. `oh` gets the verb through the shared bundle.
- Canonical and provider surfaces: not applicable. No skill, hook, or mirror changes.
- Root and scaffold: not applicable. Initialized projects carry no copy of this CLI code.
- Interactive and headless processes: not applicable. Each command exits when the command completes.
- Local and remote operation: applied. `create` clones over the network and needs no attached terminal.
- Parallel operation: not applicable. No new shared state. `create` writes only the target directory.
- Public documentation: applied. the mifunedev agro-web repository needs a matching change. See Open Questions.
- Verification: applied. See the Test Plan.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`, `resolveHarnessRoot`, new `listWorkspaces` | Workspace paths, name rules, default resolution, and the new scan |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `AGRO_REPO_URL` | Clone or reuse. Only `create` calls `ensureHostWorkspace` after this change |
| `.agro/cli/src/lib/registry.ts` | `listEntries`, `SANDBOX_NAME_PATTERN` | Pattern for the workspace scan |
| `.agro/cli/src/commands/harness.ts` | `installOnHost`, `stateHomeRefusal`, `stateHomeRootRefusal` | Remove the name prompt and the clone. Add the refusal |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall` host path | Remove the path prompt and the clone. Add the refusal |
| `.agro/cli/src/cli.ts` | dispatcher branch for `first === "harness"`, `printHarnessHelp`, `printToolHelp`, top-level help at line 123 | Add the `workspace` branch, its parser, and its help. Update the install help |
| `docs/lifecycle-commands.md` | host install section near line 294 | Document the door and the refusal |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New command | Clone the mifunedev agro repository into a named workspace or into `<dir>` |
| `agro workspace list [--json]` | New command | List workspaces under `~/.agro/workspaces/` and mark the default |
| `agro harness install <id> --host` | Behavior change | Refuse when the resolved root holds no checkout. No clone. No name prompt |
| `agro tool install <id> --host` | Behavior change | Refuse when the resolved root holds no checkout. No clone. No path prompt |
| `agro --help`, `agro harness --help`, `agro tool --help` | Text change | List `workspace`. Remove the clone statement |

## Storage

No new store. A workspace is a git checkout under `~/.agro/workspaces/<name>`. `list` derives the set from that directory on each run. `create` writes no key to `~/.agro/config.json`. The two install paths stay the only writers of `harnessRoot`.

## Architectural Decisions

- The filesystem is the source of truth for the workspace set. No registry file exists.
- A workspace counts when its directory name matches `SANDBOX_NAME_PATTERN` and the directory holds `.git`.
- The default workspace is the root that `resolveHarnessRoot(undefined, env, home)` returns. `list` and the install paths therefore agree on one default.
- An install resolves its root in the present order: `--workspace` or `--path`, then `harnessRoot`, then `~/.agro/workspaces/default`.
- `create` applies the same state-home guards that `installOnHost` applies: `stateHomeRefusal` and `stateHomeRootRefusal`.
- `create` and `list` accept the injected `run`, `env`, and `homedir` options that `runHarnessInstall` accepts, so tests stub `git`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/__tests__/workspace.test.ts` | clone into `default`; clone into `beta`; clone into `--path`; name plus `--path` refusal; invalid name; reuse; `harnessRoot` unchanged | US-001 `create` |
| new file `.agro/cli/src/__tests__/workspace.test.ts` | empty state; sorted names; skip a directory without `.git`; default mark follows `harnessRoot`; `--json` shape | US-001 `list` |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `listWorkspaces` on an absent root, a mixed root, and an invalid name | US-001 scan |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal without a checkout; refusal lists names; no name prompt; `--workspace beta` install; receipt still written | US-002 |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal without a checkout; no path prompt; `--path` with a checkout records `harnessRoot` | US-003 |

Write each red test first. Run each file with `npx vitest run <test file>` from the repository root. Run `npm --prefix .agro/cli run typecheck` after each story.

## Design Principles

- Keep one door per lifecycle action. `create` owns the clone. The install paths own the install.
- Delete the two install wizards. Leave no dormant prompt behind a flag.
- Reuse `ensureHostWorkspace`, `workspaceRoot`, and `resolveHarnessRoot`. Add no second path resolver.
- Make each refusal actionable: name the next command and list the choices.
- Add no comments to tracked code.

## Out of Scope

- `agro workspace use`, `agro workspace status`, and `agro workspace remove`.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file.
- A migration of an existing `harnessRoot` that points outside `~/.agro/workspaces/`.
- The RFC in #1070. That issue stays open.

## Open Questions

1. Does `agro workspace create` refuse inside the sandbox, as the host install paths do? This plan applies only the state-home guards.
2. Which the mifunedev agro-web repository page documents `agro workspace`? Name `<agro-web page>` before undraft.
3. Does `list` show a `--path` workspace outside `~/.agro/workspaces/` when `harnessRoot` names it? This plan shows only the scanned directory.

## Acceptance Criteria

- [ ] `npx vitest run .agro/cli` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `git grep -n ensureHostWorkspace -- .agro/cli/src/commands` shows matches only in the new file `.agro/cli/src/commands/workspace.ts`.
- [ ] `git grep -n "Workspace name \[" -- .agro/cli/src` returns no match.
- [ ] `git grep -n "Harness root \[" -- .agro/cli/src` returns no match.
- [ ] Each story acceptance criterion passes.

## Lessons

Filled by the advisor before undraft.
