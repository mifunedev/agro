# PRD: Harness Workspace Fallback

Status: DRAFT

## User Stories

### US-001: Resolve the implicit host workspace to `harness`

**Description:** As an operator, I want an unconfigured host install and a bare `agro workspace create` to use `~/.agro/workspaces/harness` so that the names match `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` sets `DEFAULT_WORKSPACE_NAME` to `"harness"`.
- [ ] `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")` in `host-config.test.ts`.
- [ ] `runWorkspaceCreate(undefined, …)` clones into `workspaces/harness` in `workspace.test.ts`, and the `--json` output reports `"name": "harness"`.
- [ ] With no flag and no recorded `harnessRoot`, `runHarnessInstall` with `host: true` records `workspaces/harness` as `harnessRoot` in `harness.test.ts`.
- [ ] With no flag and no recorded `harnessRoot`, the host `tool install` path resolves `workspaces/harness` in `tool.test.ts`. If that checkout is absent, the refusal names `workspaces/harness`.
- [ ] `runWorkspaceCreate("default", …)` clones into `workspaces/default` in `workspace.test.ts`.
- [ ] `runHarnessInstall` with `workspace: "default"` and a seeded `workspaces/default` checkout exits 0 and records `workspaces/default` in `harness.test.ts`.
- [ ] When `~/.agro/config.json` records `harnessRoot` as `workspaces/default`, `resolveHarnessRoot(undefined, …)` returns that path in `host-config.test.ts`. A host harness install with no flag also records that path again in `harness.test.ts`.
- [ ] `npx vitest run .agro/cli/src` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.

### US-002: Update CLI help, docs, and the changelog

**Description:** As an operator, I want the help text and the docs to name `~/.agro/workspaces/harness` as the fallback so that the documented behavior matches the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` and `printToolHelp` in `.agro/cli/src/cli.ts` name `~/.agro/workspaces/harness` as the fallback root.
- [ ] `printWorkspaceHelp` states that the default name is `harness`.
- [ ] The help-text test in `harness.test.ts` expects `~/.agro/workspaces/harness`.
- [ ] `git grep -n "workspaces/default" -- .agro/cli/src/cli.ts docs` exits 1.
- [ ] `docs/lifecycle-commands.md` states that the default name for `agro workspace create` is `harness`.
- [ ] `docs/harnesses/overview.md` and `docs/installation.md` name `~/.agro/workspaces/harness` in the harness root precedence.
- [ ] `.agro/knowledge/source/agro-cli-portable-lifecycle.md` states that the default name is `harness`.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one `### Changed` entry that links issue #1183. The entry states that `--workspace default` and a recorded `harnessRoot` still select `workspaces/default`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh CHANGELOG.md` reports no finding on the new entry.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` sets `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55`) joins that name onto `workspacesRoot`. `resolveHarnessRoot` (`host-config.ts:161`) uses the explicit path first, the recorded `harnessRoot` second, and `defaultHarnessRoot` last.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox project root is `/home/sandbox/harness` (`.devcontainer/Dockerfile:3`, `AGRO_PROJECT_ROOT`).
- `assertWorkspaceName` accepts both `default` and `harness`.
- The probe `.agro/evals/probes/host-workspace-namespace.sh` checks the registry shape. The probe does not check the name.

Selected approach: change the one constant. Both call sites read the constant, so the install fallback and the create fallback stay equal. The precedence in `resolveHarnessRoot` does not change. An explicit `--workspace default` and a recorded `harnessRoot` therefore keep their current behavior.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the fallback name and the root precedence |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses the fallback name when the operator gives no name |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, `printWorkspaceHelp`, `printToolHelp` | Help text that names the fallback |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot`, `resolveHarnessRoot` cases | Unit tests for the fallback and the precedence |
| `.agro/cli/src/__tests__/workspace.test.ts` | "defaults the name to `default`" case | Test for the create fallback |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot`, host install cases, help-text case | Tests for the host harness install |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot`, host install cases | Tests for the host tool install |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` with no name | Behavior | Clones into `~/.agro/workspaces/harness` |
| `agro workspace create --json` with no name | Output | Reports `"name": "harness"` |
| `agro harness install <id> --host` with no recorded root | Behavior | Resolves `~/.agro/workspaces/harness` |
| `agro tool install <id>` on the host with no recorded root | Behavior | Resolves `~/.agro/workspaces/harness` |
| `agro harness --help`, `agro tool --help`, `agro workspace --help` | Help text | Name `~/.agro/workspaces/harness` and the default name `harness` |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `docs/installation.md` | Docs | Name the new fallback |
| `CHANGELOG.md` | Docs | One `### Changed` entry for #1183 |

## Storage

The storage layout does not change. Host workspaces stay under `${AGRO_HOME:-~/.agro}/workspaces/<name>/`. `~/.agro/config.json` keeps the `harnessRoot` key. The change writes no migration and moves no directory.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the one source of truth for the fallback name. The install path and the create path both read the constant.
- `resolveHarnessRoot` keeps its precedence: explicit flag, then recorded `harnessRoot`, then the fallback.
- The CLI adds no legacy fallback to `workspaces/default`. If no root resolves, the existing refusal lists every workspace, `default` included. The operator then passes `--workspace default`.
- The constant keeps its name `DEFAULT_WORKSPACE_NAME`. A rename adds churn and no behavior.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` cases expect `workspaces/harness` | The new fallback, with and without an `AGRO_HOME` override |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` with a recorded `workspaces/default` | A recorded root still wins |
| `.agro/cli/src/__tests__/workspace.test.ts` | Bare `create` clones into `workspaces/harness`; `create default` clones into `workspaces/default` | The create fallback and the explicit legacy name |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper returns `workspaces/harness`; `--workspace default` install; recorded `workspaces/default` install; help text | The install fallback, both compatibility paths, and the help text |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` helper returns `workspaces/harness`; refusal message | The host tool fallback |
| `.agro/evals/probes/host-workspace-namespace.sh` | Existing probe | The registry shape stays intact |

Write the failing expectations first. Then change the constant and the help text.

## Design Principles

- Change the smallest surface: one constant, its tests, and the text that names it.
- Keep one source of truth for the fallback name.
- Keep explicit operator choices stable. A flag or a recorded root always beats the fallback.
- Add no comments to tracked code.
- Write docs and the changelog entry in `/ste` style.

## Out of Scope

- A migration that moves or renames an existing `~/.agro/workspaces/default` checkout.
- A second fallback that tries `workspaces/default` when `workspaces/harness` is absent.
- The `DEFAULT` column in `agro workspace list`. That column marks the recorded `harnessRoot`, not the fallback name.
- The stale `--workspace` flag description "Workspace registry entry to clone into" in `printHarnessHelp`.
- The stale "clones the AGRO workspace" wording in `docs/lifecycle-commands.md:300`.
- Archived task plans under `.agro/tasks/archive/`.

## Open Questions

1. An operator who ran a bare `agro workspace create` before this change has `workspaces/default` and possibly no recorded `harnessRoot`. After this change, a bare host install exits 1 and lists `default`. This plan accepts that refusal and adds no legacy fallback. Confirm this choice, or request a fallback.
2. The operator decides whether `mifunedev/agro-web` needs a matching change. This plan did not read `mifunedev/agro-web`.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` with no name creates `~/.agro/workspaces/harness`.
- [ ] `agro workspace create default` and `--workspace default` still use `~/.agro/workspaces/default`.
- [ ] A recorded `harnessRoot` still takes precedence over the fallback.
- [ ] `npx vitest run .agro/cli/src` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.
- [ ] `git grep -n "workspaces/default" -- .agro/cli/src/cli.ts docs` exits 1.

## Lessons

Filled by the advisor before undraft.
