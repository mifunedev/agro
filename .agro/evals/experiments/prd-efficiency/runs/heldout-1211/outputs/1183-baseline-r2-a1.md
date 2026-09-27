# PRD: Harness as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Resolve `harness` as the implicit host workspace

**Description:** As an operator, I want each implicit host workspace to be `~/.agro/workspaces/harness` so that the host name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` sets `DEFAULT_WORKSPACE_NAME = "harness"`.
- [ ] With no `harnessRoot` in `~/.agro/config.json`, `resolveHarnessRoot(undefined, {}, home)` returns `join(home, ".agro", "workspaces", "harness")`.
- [ ] `runWorkspaceCreate(undefined, …)` clones into `<state home>/workspaces/harness`.
- [ ] A host `agro harness install claude-code --host` with no config and a checkout at `<state home>/workspaces/harness` exits 0 and records that path as `harnessRoot`.
- [ ] `agro workspace create default` clones into `<state home>/workspaces/default`.
- [ ] `agro harness install <id> --workspace default` resolves `<state home>/workspaces/default`.
- [ ] If `~/.agro/config.json` records `harnessRoot` as `<state home>/workspaces/default`, `resolveHarnessRoot(undefined, …)` returns that recorded path.
- [ ] The `printHarnessHelp`, `printWorkspaceHelp`, and `tool` help texts in `.agro/cli/src/cli.ts` name `~/.agro/workspaces/harness` and the default name `harness`. No help text names `~/.agro/workspaces/default` as the fallback.
- [ ] `npx vitest run .agro/cli` exits 0 from the repository root.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Align docs, knowledge, and changelog with the new fallback

**Description:** As an operator, I want the docs to name `~/.agro/workspaces/harness` as the fallback so that the docs match the CLI behavior.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, and `docs/installation.md` name `~/.agro/workspaces/harness` wherever they name the implicit fallback or the bare `agro workspace create` target.
- [ ] `grep -rn "workspaces/default" docs .agro/cli/src/cli.ts` returns no line that describes the implicit fallback.
- [ ] `.agro/knowledge/source/agro-cli-portable-lifecycle.md` states that the default name is `harness`.
- [ ] `CHANGELOG.md` holds one `### Changed` entry under `## [Unreleased]` that cites issue #1183.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` and `bash .agro/evals/probes/host-workspace-door.sh` each exit 0.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` sets `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55-57`) joins `workspacesRoot` with that constant.
- `resolveHarnessRoot` (`host-config.ts:161-170`) applies this order: the explicit path, then the recorded `harnessRoot`, then `defaultHarnessRoot`.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox binds the harness checkout at `/home/sandbox/harness` (`.devcontainer/docker-compose.yml:13`, `.devcontainer/Dockerfile:3`).

Selected approach: change the value of the one constant `DEFAULT_WORKSPACE_NAME` to `"harness"`. Both the install fallback and the bare `workspace create` read the constant, so the two stay aligned. The precedence order stays the same. An explicit `--workspace default`, an explicit `workspace create default`, and a recorded `harnessRoot` keep working, because the name pattern accepts `default` and the recorded value outranks the fallback. Then update the help text, the tests, the docs, the knowledge page, and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Single source of the implicit workspace name |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Reads the constant for a bare `create` |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, `printWorkspaceHelp`, tool help text (lines 364, 393-395, 467) | Help text that names the fallback path and the default name |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot`, `resolveHarnessRoot` cases | Unit tests for the fallback path |
| `.agro/cli/src/__tests__/workspace.test.ts` | bare `create` case (line 286) | Test for the bare `create` target |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper (line 72), recorded root (line 674), help case (line 1500) | Host install and help tests |
| `.agro/cli/src/__tests__/tool.test.ts` | default root helper (line 93) | Host tool install tests |
| `docs/lifecycle-commands.md` | lines 302, 344, 347 | Operator docs |
| `docs/harnesses/overview.md` | lines 40, 82 | Harness root precedence docs |
| `docs/installation.md` | line 240 | Tool host install docs |
| `.agro/knowledge/source/agro-cli-portable-lifecycle.md` | line 100 | Knowledge page that names the default |
| `CHANGELOG.md` | `## [Unreleased]` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` with no name | Behavior change | Clones into `~/.agro/workspaces/harness` instead of `~/.agro/workspaces/default` |
| `agro harness install <id> --host` and `agro tool install <id> --host` with no config | Behavior change | Resolve `~/.agro/workspaces/harness` as the fallback root |
| `agro harness --help`, `agro workspace --help`, `agro tool --help` | Text change | Name `~/.agro/workspaces/harness` and the default name `harness` |
| `--workspace <name>`, `--path <dir>`, recorded `harnessRoot` | No change | Precedence and validation stay the same |

## Storage

The storage layout stays the same. The registry stays `<state home>/workspaces/<name>/`, and `~/.agro/config.json` keeps the `harnessRoot` key. The task writes no migration: a recorded `harnessRoot` keeps its value, and an existing `default` checkout stays on disk.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the implicit name. No second constant for the install fallback exists.
- The precedence order in `resolveHarnessRoot` stays the same.
- The task adds no `default` fallback probe. An unconfigured host with only a `default` checkout gets the existing refusal from `resolveExistingWorkspace`, and that refusal lists `default` and names `--workspace <name>`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` names `<home>/.agro/workspaces/harness`, also under `AGRO_HOME` | New fallback path |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` without config returns `.../workspaces/harness`; with a recorded `.../workspaces/default` returns the recorded path | Fallback and recorded-root compatibility |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `workspaceRoot("default", …)` returns `.../workspaces/default` | Explicit `default` stays valid |
| `.agro/cli/src/__tests__/workspace.test.ts` | bare `create` clones into `workspaces/harness`; `create default` clones into `workspaces/default` | Bare and explicit `create` targets |
| `.agro/cli/src/__tests__/harness.test.ts` | unconfigured host install records `workspaces/harness`; `--workspace default` resolves `workspaces/default`; help contains `~/.agro/workspaces/harness` | Install fallback, explicit name, help text |
| `.agro/cli/src/__tests__/tool.test.ts` | host tool install with no config resolves `workspaces/harness` | Tool fallback |
| `.agro/evals/probes/host-workspace-namespace.sh`, `.agro/evals/probes/host-workspace-door.sh` | full probe | Registry shape stays intact |

Write each changed test first. Each test must fail before the constant change and pass after the constant change.

## Design Principles

- Change one constant. Do not add a new abstraction.
- Keep one source of truth for the implicit name.
- Add no code comments, per `AGENTS.md` principle 5.
- Surfaces:
  - Host and sandbox: applied. The change is host CLI behavior. The implementation owner edits and tests inside the sandbox.
  - Lifecycle door: applied. The `agro workspace`, `agro harness`, and `agro tool` verbs share the constant.
  - Canonical and provider surfaces: not applicable. No skill or hook changes.
  - Root and scaffold: applied to the root CLI only.
  - Interactive and headless processes: not applicable. No process starts.
  - Local and remote operation: not applicable. Path resolution is identical on both.
  - Parallel operation: not applicable. No shared mutable state is added.
  - Public documentation: applied. See open question 1.
  - Verification: applied. See the test plan.

## Out of Scope

- Migration or rename of an existing `~/.agro/workspaces/default` checkout.
- A second fallback that tries `default` after `harness`.
- A change to `harnessRoot` precedence or to the workspace name pattern.
- New `workspace` subcommands.

## Open Questions

1. Does `mifunedev/agro-web` name `~/.agro/workspaces/default` as the fallback? If yes, the operator opens a matching change in that repository. This task does not edit `mifunedev/agro-web`.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] Explicit `default` workspaces and recorded `harnessRoot` values resolve as before.
- [ ] CLI help, docs, the knowledge page, the changelog, and tests name the new fallback.
- [ ] `npx vitest run .agro/cli` and `npm --prefix .agro/cli run typecheck` each exit 0.

## Lessons

Filled by the advisor before undraft.
