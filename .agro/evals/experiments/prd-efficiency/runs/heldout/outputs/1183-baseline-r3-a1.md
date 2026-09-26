# PRD: Harness as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Resolve the implicit host workspace to `harness`

**Description:** As an operator on a host without a sandbox, I want the implicit host workspace `~/.agro/workspaces/harness` so that the name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] If no `harnessRoot` exists in `config.json`, `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")`.
- [ ] If no `harnessRoot` exists in `config.json` and `workspaces/harness/.git` exists, `runHarnessInstall` with `host: true` records `<state home>/workspaces/harness` as `harnessRoot`.
- [ ] If no `harnessRoot` exists in `config.json` and `workspaces/harness/.git` exists, a host `runToolInstall` resolves `<state home>/workspaces/harness`.
- [ ] `runWorkspaceCreate(undefined, …)` clones into `<state home>/workspaces/harness`.
- [ ] `runWorkspaceCreate("default", …)` clones into `<state home>/workspaces/default`.
- [ ] `runHarnessInstall` with `workspace: "default"` installs from `<state home>/workspaces/default` when that checkout exists.
- [ ] If `config.json` records `harnessRoot` as `<state home>/workspaces/default`, `resolveHarnessRoot(undefined, env, home)` returns that path.
- [ ] `npx vitest run .agro/cli/src/lib/__tests__/host-config.test.ts .agro/cli/src/__tests__/workspace.test.ts .agro/cli/src/__tests__/harness.test.ts .agro/cli/src/__tests__/tool.test.ts` exits 0.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Document the `harness` fallback in help and docs

**Description:** As an operator who reads help or docs, I want the help and docs to name `harness` so that the text matches the resolved path.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `printToolHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] `printWorkspaceHelp` output states that the default name is `harness`.
- [ ] The help test in `.agro/cli/src/__tests__/harness.test.ts` asserts `~/.agro/workspaces/harness`.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src/cli.ts` prints no line.
- [ ] `docs/lifecycle-commands.md` states that the default name of `agro workspace create` is `harness`.
- [ ] `CHANGELOG.md` holds one `### Changed` entry under `## [Unreleased]` that links issue `#1183`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed file under `docs/`.
- [ ] `npx vitest run .agro/cli/src/__tests__/harness.test.ts .agro/cli/src/__tests__/tool.test.ts` exits 0.

## Summary

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` sets `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55`) joins `workspacesRoot` and `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` (`host-config.ts:161`) uses this precedence: the explicit path, then the recorded `harnessRoot`, then `defaultHarnessRoot`.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox mounts the project at `/home/sandbox/harness` (`.devcontainer/docker-compose.yml:13`, `.devcontainer/Dockerfile:3`).
- The help text in `.agro/cli/src/cli.ts` states `~/.agro/workspaces/default` as a literal in `printHarnessHelp` and `printToolHelp`. `printWorkspaceHelp` states "The default name is `default`."
- `docs/harnesses/overview.md`, `docs/lifecycle-commands.md`, and `docs/installation.md` state `~/.agro/workspaces/default`.

Selected approach: change the one constant `DEFAULT_WORKSPACE_NAME` to `"harness"`. The install fallback reads the constant. `agro workspace create` reads the same constant, so the two paths stay equal. The recorded `harnessRoot` keeps precedence over the fallback, so a host that recorded `workspaces/default` keeps that root. The name `default` stays a valid workspace name, so `--workspace default` and `agro workspace create default` keep working. Then update the help literals, the docs, the tests, and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Source of the implicit workspace name and the root precedence. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses `DEFAULT_WORKSPACE_NAME` when the operator gives no name. |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, `printWorkspaceHelp`, `printToolHelp` | Help text that states the fallback path and the default name. |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` cases, `workspaceRoot` cases | Asserts `workspaces/default` today. |
| `.agro/cli/src/__tests__/workspace.test.ts` | "defaults the name to `default`" | Asserts the implicit create target. |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot`, help-text case | Asserts the host install fallback and the help literal. |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` | Asserts the host tool install fallback. |
| `.agro/evals/probes/host-workspace-namespace.sh` | `defaultHarnessRoot` check | Guards the registry shape. The probe does not read the name, and the probe must stay green. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install <id> --host` | Changed default | With no `--workspace`, no `--path`, and no recorded `harnessRoot`, the root is `~/.agro/workspaces/harness`. |
| `agro tool install <id>` on the host | Changed default | The same fallback as `agro harness install`. |
| `agro workspace create` | Changed default | With no name and no `--path`, the target is `~/.agro/workspaces/harness`. |
| `agro harness --help`, `agro tool --help`, `agro workspace --help` | Text | State `harness` as the fallback name and path. |
| `docs/harnesses/overview.md`, `docs/lifecycle-commands.md`, `docs/installation.md` | Docs | State `~/.agro/workspaces/harness`. |
| `CHANGELOG.md` | Docs | One `### Changed` entry under `## [Unreleased]`. |
| `mifunedev/agro-web` | Docs | The public docs need the same change if they state `~/.agro/workspaces/default`. This task does not change `mifunedev/agro-web`. |

## Storage

The storage schema does not change. `config.json` under `${AGRO_HOME:-~/.agro}` keeps the `harnessRoot` key. The workspace registry stays `${AGRO_HOME:-~/.agro}/workspaces/<name>/`. Only the implicit `<name>` changes from `default` to `harness`. The change does not rename, move, or migrate an existing directory.

## Architectural Decisions

- **Source of truth:** `DEFAULT_WORKSPACE_NAME` in `host-config.ts` is the only source of the implicit name. The install fallback and `agro workspace create` both read the constant. Do not add a second literal.
- **State management:** The recorded `harnessRoot` keeps precedence over the fallback. No migration runs. An existing `~/.agro/workspaces/default` stays in place and stays selectable with `--workspace default`.
- **Auth / scoping:** N/A. The change adds no permission and no new state location.
- **Execution location:** The implementation owner edits and tests in the sandbox. The changed behavior runs on the host.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` in a clean home, in a legacy-registry home, and with `AGRO_HOME` set | The fallback is `<state home>/workspaces/harness`. |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` with a recorded `workspaces/default` | A recorded `harnessRoot` wins over the fallback. |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `assertWorkspaceName("default")` | `default` stays a valid name. |
| `.agro/cli/src/__tests__/workspace.test.ts` | "defaults the name to `harness`" | `agro workspace create` with no name targets `workspaces/harness`. |
| `.agro/cli/src/__tests__/workspace.test.ts` | `create` with the name `default` | The explicit `default` name still creates `workspaces/default`. |
| `.agro/cli/src/__tests__/harness.test.ts` | host install with no recorded root | The install records `workspaces/harness`. |
| `.agro/cli/src/__tests__/harness.test.ts` | host install with `--workspace default` | The explicit `default` workspace still installs. |
| `.agro/cli/src/__tests__/harness.test.ts` | help-text case | The help states `~/.agro/workspaces/harness`. |
| `.agro/cli/src/__tests__/tool.test.ts` | host install with no recorded root | `runToolInstall` resolves `workspaces/harness`. |
| `.agro/evals/probes/host-workspace-namespace.sh` | full probe | The registry shape stays intact. |

Write each changed assertion first and confirm that the assertion fails. Then change the constant and the help text.

## Design Principles

- Keep one source of truth: one constant owns the implicit name.
- Apply the smallest realistic change: change the constant, the help literals, the docs, and the tests. Add no migration and no compatibility fallback.
- Keep explicit operator state: a recorded `harnessRoot` and an explicit `--workspace default` keep their behavior.
- Add no explanatory comments to tracked code.

## Out of Scope

- A migration or rename of an existing `~/.agro/workspaces/default` directory.
- A second fallback that tries `workspaces/default` when `workspaces/harness` is absent.
- A rename of the `DEFAULT` column in `agro workspace list`. That column marks the recorded `harnessRoot`, not the implicit name.
- The stale `--workspace <name>` flag description "Workspace registry entry to clone into" in `printHarnessHelp`.
- The change to `mifunedev/agro-web`. The advisor tracks that change in a separate pull request in `mifunedev/agro-web`.

## Open Questions

1. A host can hold `~/.agro/workspaces/default` from an earlier `agro workspace create` and no recorded `harnessRoot`. After this change, a host install on that host exits 1 and lists `default`. This plan accepts that refusal, because the refusal names every workspace that exists. Confirm that no fallback to `default` is necessary.
2. `.agro/knowledge/source/agro-cli-portable-lifecycle.md` states "the default name is `default`". Confirm whether this task updates the knowledge page, or whether a later `/wiki ingest` refreshes the page.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` keep working.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src` prints no line outside tests that assert the explicit `default` name.
- [ ] `npx vitest run` exits 0.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.

## Lessons

Filled by the advisor before undraft.
