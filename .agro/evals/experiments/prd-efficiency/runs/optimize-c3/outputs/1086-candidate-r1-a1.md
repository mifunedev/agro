# PRD: Add the agro workspace door

Status: DRAFT

## User Stories

### US-001: Add agro workspace create and list

**Description:** As an operator, I want a workspace door so that I create workspaces without a harness install.

**Acceptance Criteria:**

- [ ] New file `.agro/cli/src/commands/workspace.ts` exports `runWorkspaceCreate` and `runWorkspaceList`.
- [ ] `agro workspace create beta` clones mifunedev/agro into `~/.agro/workspaces/beta` through `ensureHostWorkspace` and exits 0.
- [ ] `agro workspace create` with no name uses `DEFAULT_WORKSPACE_NAME` from `.agro/cli/src/lib/host-config.ts`.
- [ ] `agro workspace create --path <dir>` clones into `<dir>` and exits 0.
- [ ] If the target root fails `stateHomeRootRefusal`, `create` prints the refusal and exits 1.
- [ ] After `create`, `~/.agro/config.json` holds no new `harnessRoot` key.
- [ ] `agro workspace list` prints each directory under `~/.agro/workspaces/` in sorted order and marks the default workspace.
- [ ] `agro workspace list --json` prints a JSON array of objects with `name`, `root`, and `default` fields.
- [ ] If `~/.agro/workspaces/` is absent, `list` prints no workspace and exits 0.
- [ ] `.agro/cli/src/cli.ts` dispatches `workspace create` and `workspace list`, and `agro --help` names both subcommands.

### US-002: Refuse host installs without a workspace

**Description:** As an operator, I want installs to refuse without a workspace so that installs never clone a workspace.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/commands/harness.ts` no longer prompts `Workspace name [default]:`.
- [ ] `.agro/cli/src/commands/tool.ts` no longer prompts `Harness root [<root>]:`.
- [ ] If the resolved root holds no `.git` directory, `agro harness install <id> --host` exits 1 and clones nothing.
- [ ] If the resolved root holds no `.git` directory, `agro tool install <id> --host` exits 1 and clones nothing.
- [ ] Each refusal names `agro workspace create` with the active bin name and lists every workspace under `~/.agro/workspaces/`.
- [ ] If the resolved root holds a checkout, each install keeps its present output and writes `harnessRoot` as before.
- [ ] `docs/lifecycle-commands.md` documents `agro workspace create` and `agro workspace list` and states that installs refuse without a workspace.

## Summary

Today a host workspace exists only as a side effect of an install. `installOnHost` in `.agro/cli/src/commands/harness.ts` prompts for a workspace name near line 396. The function then calls `ensureHostWorkspace` near line 413. `.agro/cli/src/commands/tool.ts` holds a second copy near line 437, and that copy prompts for a free-form path. A tool install can therefore record a `harnessRoot` outside `~/.agro/workspaces/`.

The selected approach adds the new file `.agro/cli/src/commands/workspace.ts` as the only creator of workspaces. Both install paths keep root resolution through `resolveHarnessRoot` and `workspaceRoot`. Both install paths drop the clone step and refuse when the resolved root holds no checkout. `list` scans `~/.agro/workspaces/` the way `listEntries` in `.agro/cli/src/lib/registry.ts` scans the sandbox directory.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `installOnHost`, workspace-name prompt | Remove the prompt and the clone; add the refusal |
| `.agro/cli/src/commands/tool.ts` | host install path, `Harness root` prompt | Remove the prompt and the clone; add the refusal |
| `.agro/cli/src/lib/host-config.ts` | `workspaceRoot`, `DEFAULT_WORKSPACE_NAME`, `resolveHarnessRoot` | Resolve workspace roots and the default root |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `stateHomeRootRefusal` | Clone or reuse a checkout; refuse nested roots |
| `.agro/cli/src/lib/registry.ts` | `listEntries` | Pattern for the directory scan |
| `.agro/cli/src/cli.ts` | top-level dispatch near line 1389, help text | Route `workspace` subcommands |
| new file `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `runWorkspaceList` | The workspace door |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create [<name>] [--path <dir>]` | New command | Clone mifunedev/agro into a workspace |
| `agro workspace list [--json]` | New command | List workspaces and mark the default |
| `agro harness install --host` | Behavior change | Refuse when no workspace exists |
| `agro tool install --host` | Behavior change | Refuse when no workspace exists |
| `docs/lifecycle-commands.md` | Documentation | Document both subcommands and the refusal |

## Storage

The workspace directories under `~/.agro/workspaces/` are the only state. The task adds no registry file. `create` writes no key to `~/.agro/config.json`.

## Architectural Decisions

- The workspace directory tree is the source of truth for `list`.
- `create` is the only command that clones a workspace.
- The two install paths stay the only writers of `harnessRoot`.
- The default mark goes to the root that `resolveHarnessRoot` returns with no explicit path.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/cli/src/__tests__/workspace.test.ts` | create by name, create with no name, create with `--path`, nested-root refusal, no `harnessRoot` write | US-001 create |
| new file `.agro/cli/src/__tests__/workspace.test.ts` | list sorted, list default mark, list `--json`, list with no workspace directory | US-001 list |
| `.agro/cli/src/__tests__/harness.test.ts` | refusal with no workspace, refusal lists workspaces, no prompt, install into an existing workspace | US-002 harness |
| `.agro/cli/src/__tests__/tool.test.ts` | refusal with no workspace, refusal lists workspaces, no prompt, install into an existing workspace | US-002 tool |

Run the suite with `<test command>`. Run `npm run typecheck` in `.agro/cli` for the type check.

## Design Principles

- Keep one door per lifecycle concern. `agro` stays the only lifecycle door.
- Delete the two wizard copies. Do not keep a dormant clone path.
- Reuse `ensureHostWorkspace` and `workspaceRoot`. Add no parallel resolver.
- Add no comments to tracked code.

## Out of Scope

- `agro workspace use` and `agro workspace status`.
- `agro workspace remove`.
- A `--default` flag on `create`.
- A `--workspace <name>` flag on `tool install`.
- A new registry file.
- Changes to mifunedev/agro-web.

## Open Questions

1. Which command runs the CLI test suite? `.agro/cli/package.json` names no test script.
2. Must `list` show a workspace that `create --path` cloned outside `~/.agro/workspaces/`? This plan says no.
3. Must `harness install --path <dir>` refuse when `<dir>` holds no checkout? This plan says yes.
4. Does mifunedev/agro-web need a matching page for the new door?

## Acceptance Criteria

- [ ] Every US-001 and US-002 criterion passes.
- [ ] `<test command>` exits 0.
- [ ] `npm run typecheck` in `.agro/cli` exits 0.
- [ ] `git grep -n 'Workspace name \[' -- .agro/cli/src/commands` prints no match.

## Lessons

Filled by the advisor before undraft.
