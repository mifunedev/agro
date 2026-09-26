# PRD: Harness workspace fallback

Status: DRAFT

## User Stories

### US-001: Resolve the implicit host workspace as `harness`

**Description:** As an operator, I want the implicit host workspace to be `~/.agro/workspaces/harness` so that the host name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` sets `DEFAULT_WORKSPACE_NAME` to `"harness"`.
- [ ] `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")` in a clean home.
- [ ] `runWorkspaceCreate(undefined, ...)` clones into `workspacePath(home, "harness")`.
- [ ] With no `harnessRoot` in `~/.agro/config.json` and no `--workspace` or `--path`, `agro harness install <id> --host` resolves `~/.agro/workspaces/harness`.
- [ ] With no `harnessRoot` in `~/.agro/config.json` and no `--path`, `agro tool install <id> --host` resolves `~/.agro/workspaces/harness`.
- [ ] `agro harness install <id> --workspace default` resolves `~/.agro/workspaces/default`.
- [ ] `agro workspace create default` clones into `~/.agro/workspaces/default`.
- [ ] A recorded `harnessRoot` of `~/.agro/workspaces/default` wins over the new fallback for `agro harness install` and for `agro tool install`.
- [ ] `npx vitest run .agro/cli/src/lib/__tests__/host-config.test.ts .agro/cli/src/__tests__/workspace.test.ts .agro/cli/src/__tests__/harness.test.ts .agro/cli/src/__tests__/tool.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.

### US-002: Update CLI help to name the new fallback

**Description:** As an operator, I want `agro harness --help`, `agro tool --help`, and `agro workspace --help` to name the `harness` fallback so that the help text matches the behavior.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `printToolHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `printWorkspaceHelp` output contains ``The default name is `harness`.``.
- [ ] `.agro/cli/src/__tests__/harness.test.ts` asserts `~/.agro/workspaces/harness` in the harness help text.
- [ ] `npx vitest run .agro/cli/src/__tests__/harness.test.ts .agro/cli/src/__tests__/tool.test.ts .agro/cli/src/__tests__/workspace.test.ts` exits 0.

### US-003: Update docs, knowledge pages, and the changelog

**Description:** As an operator, I want the docs and the changelog to name `~/.agro/workspaces/harness` as the fallback so that written guidance matches the CLI.

**Acceptance Criteria:**

- [ ] `git grep -n "workspaces/default" -- docs` prints no line.
- [ ] `docs/lifecycle-commands.md` states that the default `agro workspace create` name is `harness`.
- [ ] `docs/harnesses/overview.md` lists `~/.agro/workspaces/harness` as precedence step 3.
- [ ] `docs/lifecycle-commands.md` and `docs/harnesses/overview.md` state that `--workspace default` still selects an existing `~/.agro/workspaces/default`.
- [ ] `.agro/knowledge/source/agro-cli-portable-lifecycle.md` states that the default name is `harness`.
- [ ] `CHANGELOG.md` holds one `### Changed` entry under `## [Unreleased]` that links issue `#1183`.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` defines `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55`) joins `workspacesRoot` and `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` (`host-config.ts:161`) resolves an explicit path first, then the recorded `harnessRoot`, then `defaultHarnessRoot`.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox project root is `/home/sandbox/harness` (`.devcontainer/Dockerfile:3`).
- `printHarnessHelp`, `printWorkspaceHelp`, and `printToolHelp` in `.agro/cli/src/cli.ts` hard-code `~/.agro/workspaces/default` or `` `default` ``.
- `docs/harnesses/overview.md`, `docs/lifecycle-commands.md`, and `docs/installation.md` name `~/.agro/workspaces/default` as the fallback.

Selected approach: change the one constant `DEFAULT_WORKSPACE_NAME` to `"harness"`. Both call sites read the constant, so the install fallback and the `create` default stay aligned. The explicit-name path (`workspaceRoot`) and the recorded `harnessRoot` path do not read the constant, so explicit `default` workspaces and recorded roots keep working without new code. Then update the test fixtures, the help text, the docs, the knowledge pages, and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the implicit workspace name and the root precedence |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Applies the implicit name to `agro workspace create` |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, `printWorkspaceHelp`, `printToolHelp` | Help text that names the fallback |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` cases | Pins the fallback path |
| `.agro/cli/src/__tests__/workspace.test.ts` | `defaults the name to \`default\`` | Pins the `create` default |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot`, help-text case, `harnessRoot` assertion at line 674 | Pins host install resolution and help text |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` | Pins host tool install resolution |
| `.agro/evals/probes/host-workspace-namespace.sh` | `defaultHarnessRoot` shape check | Guards the registry location; reads no name literal |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` with no name | Behavior | Clones into `~/.agro/workspaces/harness` instead of `~/.agro/workspaces/default` |
| `agro harness install <id> --host` with no root and no record | Behavior | Resolves `~/.agro/workspaces/harness` |
| `agro tool install <id> --host` with no root and no record | Behavior | Resolves `~/.agro/workspaces/harness` |
| `agro harness --help`, `agro tool --help`, `agro workspace --help` | Text | Name `harness` as the fallback |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `docs/installation.md` | Docs | Name `~/.agro/workspaces/harness` as the fallback |
| `.agro/knowledge/source/agro-cli-portable-lifecycle.md`, `.agro/knowledge/source/fresh-machine-setup.md` | Knowledge | Replace the `default` name claim |
| `CHANGELOG.md` | Entry | One `### Changed` entry for `#1183` |

## Storage

The host config `~/.agro/config.json` keeps its schema. The CLI writes no migration. A recorded `harnessRoot` stays authoritative. The workspace registry `~/.agro/workspaces/<name>/` keeps its layout. The CLI renames and moves no existing checkout.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the implicit name. The implementer adds no second constant and no alias.
- Root precedence stays unchanged: explicit `--workspace` or `--path`, then recorded `harnessRoot`, then `~/.agro/workspaces/harness`.
- The CLI adds no fallback to `~/.agro/workspaces/default`. If a host holds only `~/.agro/workspaces/default` and records no `harnessRoot`, the host install exits 1. The existing refusal from `resolveExistingWorkspace` lists `default` under `Workspaces that exist:` and names `--workspace <name>`. Open question 1 asks the operator to confirm this decision.
- `harness` passes `assertWorkspaceName`, because `harness` matches `SANDBOX_NAME_PATTERN`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` names `<home>/.agro/workspaces/harness` in a clean home, in a legacy-registry home, and under an `AGRO_HOME` override | US-001 fallback path |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` returns a recorded `<home>/.agro/workspaces/default` | US-001 recorded root |
| `.agro/cli/src/__tests__/workspace.test.ts` | `create` with no name clones into `harness`; `create default` clones into `default` | US-001 `create` default and explicit `default` |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` fixture returns `workspaces/harness`; `--workspace default` resolves `workspaces/default`; recorded `workspaces/default` wins | US-001 host harness install |
| `.agro/cli/src/__tests__/harness.test.ts` | help text contains `~/.agro/workspaces/harness` | US-002 |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` fixture returns `workspaces/harness`; recorded `workspaces/default` wins | US-001 host tool install |
| `.agro/evals/probes/host-workspace-namespace.sh` | unchanged probe | Registry location stays in `workspaces/` |

Write each changed assertion first. Confirm that the assertion fails against the current constant. Then change the constant.

## Design Principles

- Keep one source of truth for each policy. `DEFAULT_WORKSPACE_NAME` owns the implicit name.
- Delete obsolete paths. Add no compatibility fallback that the issue does not require.
- Add no explanatory comments to tracked code.
- Keep the change inside `.agro/cli/`, `docs/`, `.agro/knowledge/`, and `CHANGELOG.md`.

## Out of Scope

- Migration or rename of an existing `~/.agro/workspaces/default` checkout.
- Changes to the sandbox project root `/home/sandbox/harness`.
- New `agro workspace` verbs, such as `remove`, `use`, or `status`.
- Changes to the `DEFAULT` column of `agro workspace list`. That column marks the recorded `harnessRoot`, not the implicit name.
- Edits to archived task plans under `.agro/tasks/archive/`.

## Open Questions

1. If a host holds only `~/.agro/workspaces/default` and records no `harnessRoot`, must the host install still resolve `default`? The plan selects "no": the install exits 1 and the refusal names `default` and `--workspace <name>`.
2. Does `mifunedev/agro-web` name `~/.agro/workspaces/default`? If `mifunedev/agro-web` names that path, who opens the matching change in `mifunedev/agro-web`?

## Acceptance Criteria

- [ ] `git grep -n "DEFAULT_WORKSPACE_NAME = \"harness\"" -- .agro/cli/src/lib/host-config.ts` prints one line.
- [ ] `git grep -n "workspaces/default" -- .agro/cli/src docs` prints only test lines that exercise an explicit or recorded `default` workspace.
- [ ] `npm test` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.
- [ ] `CHANGELOG.md` links issue `#1183` under `## [Unreleased]`.

## Lessons

Filled by the advisor before undraft.
