# PRD: Use `harness` as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Change the implicit workspace name in the CLI

**Description:** As an operator, I want an unconfigured host install and a bare `agro workspace create` to use `~/.agro/workspaces/harness` so that the host workspace name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` sets `DEFAULT_WORKSPACE_NAME` to `"harness"`.
- [ ] `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")` in `.agro/cli/src/lib/__tests__/host-config.test.ts`.
- [ ] `resolveHarnessRoot(undefined, {}, home)` returns `join(home, ".agro", "workspaces", "harness")` when no config exists.
- [ ] `runWorkspaceCreate(undefined, ...)` clones into `workspacePath(home, "harness")` in `.agro/cli/src/__tests__/workspace.test.ts`.
- [ ] A host `agro harness install` with no flag and no config records `harnessRoot` as `<state home>/workspaces/harness` in `.agro/cli/src/__tests__/harness.test.ts`.
- [ ] The `defaultRoot` helpers in `harness.test.ts` and `tool.test.ts` return `join(home.dir, "workspaces", "harness")`.
- [ ] A new test in `workspace.test.ts` shows that `runWorkspaceCreate("default", ...)` clones into `workspacePath(home, "default")` and exits 0.
- [ ] A new test in `harness.test.ts` shows that a host install with `--workspace default` uses `<state home>/workspaces/default`.
- [ ] A new test in `harness.test.ts` shows that a host install with a recorded `harnessRoot` of `<state home>/workspaces/default` uses that root and does not use `workspaces/harness`.
- [ ] The harness help text and the tool help text in `.agro/cli/src/cli.ts` name `~/.agro/workspaces/harness` and do not name `~/.agro/workspaces/default`.
- [ ] The help assertion at `harness.test.ts:1500` expects `~/.agro/workspaces/harness`.
- [ ] `pnpm exec vitest run .agro/cli/src` exits 0.
- [ ] `pnpm run typecheck` exits 0.

### US-002: Update the documentation and the changelog

**Description:** As an operator, I want the documentation to name the new fallback so that the documented path matches the CLI behavior.

**Acceptance Criteria:**

- [ ] `git grep -n 'workspaces/default' -- docs .agro/cli/src/cli.ts` prints no line.
- [ ] `docs/harnesses/overview.md` names `~/.agro/workspaces/harness` in the harness root table and in precedence step 3.
- [ ] `docs/installation.md` names `~/.agro/workspaces/harness` in the host tool install paragraph.
- [ ] `docs/lifecycle-commands.md` names `~/.agro/workspaces/harness` in the harness install paragraph and in the two `agro workspace create` examples.
- [ ] `docs/lifecycle-commands.md` states "The default name is `harness`."
- [ ] `docs/lifecycle-commands.md` states that an explicit `default` workspace and a recorded `harnessRoot` continue to work.
- [ ] `CHANGELOG.md` has a `### Changed` entry under `## [Unreleased]` that links issue [#1183](https://github.com/mifunedev/agro/issues/1183).
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/docs.test.ts .agro/cli/src/__tests__/workspace.test.ts` exits 0.

## Summary

Issue #1183 asks for `harness` as the implicit host workspace name. The sandbox project root is `/home/sandbox/harness` (`.devcontainer/Dockerfile:3`). The host fallback today is `~/.agro/workspaces/default`.

One constant controls both fallbacks. `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts:12` holds `"default"`. `defaultHarnessRoot` at line 55 joins that constant to the workspaces root. `resolveHarnessRoot` returns `defaultHarnessRoot` at line 169 as the last candidate. `runWorkspaceCreate` uses the same constant at `.agro/cli/src/commands/workspace.ts:80`.

The selected approach changes the constant value to `"harness"`. The approach keeps the constant as the single source of truth. The install fallback and the create fallback therefore stay equal.

Existing homes keep working with no migration. An explicit `--workspace default` still resolves through `workspaceRoot`, because `"default"` passes `SANDBOX_NAME_PATTERN`. A recorded `harnessRoot` has priority over the fallback in `resolveHarnessRoot`. An operator with only an unrecorded `~/.agro/workspaces/default` checkout gets a refusal. The refusal lists every existing workspace and names `agro workspace create`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Holds the fallback name and resolves the host harness root |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses `DEFAULT_WORKSPACE_NAME` when the operator gives no name |
| `.agro/cli/src/cli.ts` | harness help text (lines 361-367), tool help text (lines 466-468) | Names the fallback path in CLI help |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot`, `resolveHarnessRoot` cases | Asserts the fallback path |
| `.agro/cli/src/__tests__/workspace.test.ts` | "defaults the name to `default`" | Asserts the create fallback |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper, host install cases, help case | Asserts the install fallback and the help text |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` helper | Seeds the fallback workspace for host tool installs |
| `docs/harnesses/overview.md`, `docs/installation.md`, `docs/lifecycle-commands.md` | fallback path text | Documents the fallback |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install --host` | Behavior | With no flag and no recorded `harnessRoot`, the root is `~/.agro/workspaces/harness` |
| `agro tool install` on the host | Behavior | With no flag and no recorded `harnessRoot`, the root is `~/.agro/workspaces/harness` |
| `agro workspace create` | Behavior | With no name, the target is `~/.agro/workspaces/harness` |
| `agro harness --help`, `agro tool --help` | Text | The help names `~/.agro/workspaces/harness` |

## Storage

The change adds no storage. The host config file `~/.agro/config.json` keeps its schema. The CLI reads an existing `harnessRoot` value with no change.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the install fallback and the create fallback.
- The CLI adds no migration and no second fallback candidate. A recorded `harnessRoot` and an explicit `--workspace default` cover existing homes.
- The constant keeps its current name. A rename is out of scope.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` clean home, legacy registry, state home override; `resolveHarnessRoot` with no config | The fallback is `workspaces/harness` |
| `.agro/cli/src/__tests__/workspace.test.ts` | bare create clones into `harness`; create `default` clones into `default` | The create fallback and the explicit `default` name |
| `.agro/cli/src/__tests__/harness.test.ts` | host install records `workspaces/harness`; `--workspace default`; recorded `harnessRoot` of `workspaces/default`; help text | The install fallback, backward compatibility, and help |
| `.agro/cli/src/__tests__/tool.test.ts` | existing host tool cases with the updated `defaultRoot` helper | The host tool install fallback |
| `.agro/cli/src/__tests__/docs.test.ts` | existing documentation assertions | The docs stay consistent with the CLI |

Write the new expectations first. Run the tests and confirm each new expectation fails. Then change the constant.

## Design Principles

- Change one constant. Do not add a parallel fallback path.
- Keep existing workspaces usable with no operator action.
- Add no comments to tracked code, per the root `AGENTS.md`.

## Out of Scope

- Automatic migration or rename of an existing `~/.agro/workspaces/default` directory.
- A fallback that probes `workspaces/default` after `workspaces/harness`.
- A rename of `DEFAULT_WORKSPACE_NAME` or of `defaultHarnessRoot`.
- Archived task files under `.agro/tasks/archive/`.
- Public site pages in `mifunedev/agro-web`.

## Open Questions

1. Does `mifunedev/agro-web` name `~/.agro/workspaces/default`? If a page names the path, the operator opens a matching change in that repository.

## Acceptance Criteria

- [ ] With no config, a host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` with no name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` of `~/.agro/workspaces/default` continue to work.
- [ ] CLI help, `docs/`, and tests name `~/.agro/workspaces/harness` as the fallback.
- [ ] `pnpm exec vitest run .agro/cli/src` exits 0.
- [ ] `pnpm run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
