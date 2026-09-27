# PRD: Use `harness` as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Change the implicit workspace name in the CLI

**Description:** As an operator, I want an unconfigured host install and a nameless `agro workspace create` to use `~/.agro/workspaces/harness` so that the host workspace name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` sets `DEFAULT_WORKSPACE_NAME` to `"harness"`.
- [ ] `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")` in a clean home, and the `host-config.test.ts` case for that return value passes.
- [ ] `runWorkspaceCreate(undefined, ...)` passes `workspaces/harness` as the clone target, and the `workspace.test.ts` case for a nameless create passes.
- [ ] `runWorkspaceCreate("default", ...)` passes `workspaces/default` as the clone target, and a new `workspace.test.ts` case asserts that path.
- [ ] If `~/.agro/config.json` records `harnessRoot` as `<state home>/workspaces/default`, a host harness install resolves that root. A `harness.test.ts` case asserts the resolved root.
- [ ] A host harness install with `--workspace default` resolves `<state home>/workspaces/default`. A `harness.test.ts` case asserts the resolved root.
- [ ] `printHarnessHelp`, `printWorkspaceHelp`, and the tool help in `.agro/cli/src/cli.ts` name `~/.agro/workspaces/harness` and the default name `harness`. No help text in `cli.ts` names `~/.agro/workspaces/default`.
- [ ] The `harness.test.ts` help assertion expects `~/.agro/workspaces/harness`.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` reports 0 failures.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.

### US-002: Update the documentation and the changelog

**Description:** As an operator, I want the docs to state the `harness` fallback so that the documented path matches the path that the CLI creates.

**Acceptance Criteria:**

- [ ] `docs/harnesses/overview.md`, `docs/installation.md`, and `docs/lifecycle-commands.md` name `~/.agro/workspaces/harness` as the fallback root and as the nameless `agro workspace create` target.
- [ ] `git grep -n 'workspaces/default' -- docs README.md .agro/cli/src/cli.ts` prints no line.
- [ ] `.agro/knowledge/source/agro-cli-portable-lifecycle.md` states that the default workspace name is `harness`.
- [ ] `CHANGELOG.md` has one `### Changed` entry under `## [Unreleased]` that links issue `#1183` and states that an explicit `default` workspace and a recorded `harnessRoot` continue to work.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 for each changed doc paragraph, or reports no new finding against the base branch.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` sets `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55`) joins `workspacesRoot()` and `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` (`host-config.ts:161`) resolves in this order: the explicit root, then the recorded `harnessRoot`, then `defaultHarnessRoot`.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox project root is `/home/sandbox/harness` (`.devcontainer/Dockerfile:3`, `AGRO_PROJECT_ROOT`).
- The help texts in `.agro/cli/src/cli.ts` hard-code `~/.agro/workspaces/default` at lines 364 and 467, and state "The default name is `default`" at line 395.
- Tests hard-code `"default"` in `harness.test.ts:72`, `harness.test.ts:674`, `harness.test.ts:1500`, `tool.test.ts:93`, `workspace.test.ts:286`, and `host-config.test.ts:87`, `:109`, `:117`, `:122`, `:265`.
- The docs name `~/.agro/workspaces/default` in `docs/harnesses/overview.md:40`, `:82`, `docs/installation.md:240`, `docs/lifecycle-commands.md:302`, `:344`, and `:347`.

Selected approach: change the one constant `DEFAULT_WORKSPACE_NAME` to `"harness"`. Both `defaultHarnessRoot` and `runWorkspaceCreate` read `DEFAULT_WORKSPACE_NAME`, so the install fallback and the nameless create stay aligned. The precedence in `resolveHarnessRoot` does not change. An explicit `--workspace default` and a recorded `harnessRoot` bypass the constant. The two legacy routes continue to work with no migration code. Then update the help text, the tests, and the docs to the new literal.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the implicit workspace name and the root precedence. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses the implicit name when the operator gives no name. |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, `printWorkspaceHelp`, tool help | States the fallback path to the operator. |
| `.agro/cli/src/lib/host-workspace.ts` | `resolveExistingWorkspace` | Refuses an absent root and lists the workspaces that exist. No change. |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` cases | Asserts the fallback path. |
| `.agro/cli/src/__tests__/workspace.test.ts` | nameless create case | Asserts the clone target. |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot`, help case, recorded-root case | Asserts the host install root and the help text. |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` | Asserts the host tool install root. |
| `.agro/evals/probes/host-workspace-namespace.sh` | structure checks on `host-config.ts` | Guards the registry shape. No change expected. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` with no name | Behavior | Clones into `~/.agro/workspaces/harness` instead of `~/.agro/workspaces/default`. |
| `agro harness install <id> --host` with no root and no recorded `harnessRoot` | Behavior | Resolves `~/.agro/workspaces/harness`. |
| `agro tool install <id> --host` with no root and no recorded `harnessRoot` | Behavior | Resolves `~/.agro/workspaces/harness`. |
| `agro harness --help`, `agro workspace --help`, `agro tool --help` | Text | Name `~/.agro/workspaces/harness` and the default name `harness`. |
| `docs/`, `.agro/knowledge/source/agro-cli-portable-lifecycle.md`, `CHANGELOG.md` | Text | State the new fallback. |

## Storage

The host registry stays at `~/.agro/workspaces/<name>/`. The host config stays at `~/.agro/config.json` with the unchanged `HostConfig` schema. This task adds no migration. A recorded `harnessRoot` keeps its value.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` in `host-config.ts` stays the single source of truth for the implicit name. Keep the constant name. The constant still names the default workspace.
- Keep the precedence in `resolveHarnessRoot`: explicit root, then recorded `harnessRoot`, then the fallback.
- Add no automatic fallback to `~/.agro/workspaces/default`. If a host has an unrecorded `default` checkout, `resolveExistingWorkspace` lists `default` in its refusal, and the operator passes `--workspace default`. Open question 1 asks the operator to confirm this decision.
- Execution location: every change and every check runs in the sandbox, in an isolated worktree. The implementation changes no host file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | clean home, legacy registry, state home override, beside the sandbox registry | `defaultHarnessRoot` returns `workspaces/harness`. |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` with a recorded `workspaces/default` | A recorded `harnessRoot` wins over the fallback. |
| `.agro/cli/src/__tests__/workspace.test.ts` | nameless create; new explicit `default` create | The nameless create clones into `workspaces/harness`. The explicit `default` create clones into `workspaces/default`. |
| `.agro/cli/src/__tests__/harness.test.ts` | help text; unconfigured host install; new recorded `default` root; new `--workspace default` | The help names `workspaces/harness`. The unconfigured install records `workspaces/harness`. Both legacy routes resolve `workspaces/default`. |
| `.agro/cli/src/__tests__/tool.test.ts` | cases that use `defaultRoot` | The host tool install resolves `workspaces/harness`. |

Write the new and changed assertions first. Confirm that each assertion fails against `"default"`. Then change the constant and the help text.

## Design Principles

- Change one constant. Do not add a second source for the implicit name.
- Keep the legacy paths working through the existing precedence, not through new code.
- Keep code, tests, and probes as evidence. Add no explanatory code comments.
- Apply `/ste` to every changed doc and help paragraph.

## Out of Scope

- Rename or move an existing `~/.agro/workspaces/default` checkout.
- Rewrite a recorded `harnessRoot` in `~/.agro/config.json`.
- Change the sandbox project root `/home/sandbox/harness`.
- Change `workspace list`, `resolveExistingWorkspace`, or the `HostConfig` schema.
- Correct unrelated stale wording in `docs/lifecycle-commands.md:300`, which states that a host install clones the workspace.

## Open Questions

1. Do you accept that an unrecorded `~/.agro/workspaces/default` checkout needs `--workspace default` after this change? The alternative adds a second fallback to `default` in `resolveHarnessRoot`. This plan selects no second fallback.
2. Does `mifunedev/agro-web` name `~/.agro/workspaces/default`? This task cannot read `mifunedev/agro-web`. If the public docs name the path, the operator opens a matching change there.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` resolve as before, and tests assert both.
- [ ] The CLI help, the docs, the knowledge page, the changelog, and the tests name the `harness` fallback.
- [ ] `pnpm typecheck` exits 0, and `pnpm test` reports 0 failures.
- [ ] `bash .agro/skills/eval/run.sh` reports no PASS-to-REGRESSION transition.

## Lessons

Filled by the advisor before undraft.
