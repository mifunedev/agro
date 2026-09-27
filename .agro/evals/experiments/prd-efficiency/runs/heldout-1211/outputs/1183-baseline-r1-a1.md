# PRD: Harness workspace fallback

Status: DRAFT

## User Stories

### US-001: Rename the implicit host workspace to `harness`

**Description:** As an operator, I want the implicit host workspace to be `~/.agro/workspaces/harness` so that the host name matches the sandbox harness directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] With no `--workspace`, no `--path`, and no recorded `harnessRoot`, `resolveHarnessRoot(undefined, {}, home)` returns `<home>/.agro/workspaces/harness`.
- [ ] `runWorkspaceCreate(undefined, ...)` clones into `<state home>/workspaces/harness`.
- [ ] If `~/.agro/config.json` records `harnessRoot` as `<state home>/workspaces/default`, `resolveHarnessRoot` returns that recorded path.
- [ ] `agro workspace create default` still clones into `<state home>/workspaces/default`.
- [ ] `agro harness install <id> --workspace default` still resolves `<state home>/workspaces/default`.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Update help text, docs, and the changelog

**Description:** As an operator, I want the help text and docs to name `~/.agro/workspaces/harness` as the fallback so that the documented behavior matches the CLI.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] The `agro workspace` help text states that the default name is `harness`.
- [ ] The `agro tool` help text names `~/.agro/workspaces/harness` as the last fallback.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src/cli.ts` prints no line.
- [ ] `docs/lifecycle-commands.md` states that the default workspace name is `harness`.
- [ ] `CHANGELOG.md` holds one `### Changed` entry under `## [Unreleased]` that links issue #1183.
- [ ] `bash .agro/evals/probes/host-workspace-namespace.sh` exits 0.
- [ ] `pnpm test:scripts` exits 0.

## Summary

Issue #1183 changes the implicit host workspace name from `default` to `harness`.

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` defines `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` (`host-config.ts:55`) joins `workspacesRoot` and `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` (`host-config.ts:161`) checks the explicit root first. It then checks the recorded `harnessRoot`. It returns `defaultHarnessRoot` last.
- `runWorkspaceCreate` (`.agro/cli/src/commands/workspace.ts:80`) uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox harness directory is `/home/sandbox/harness` (`.devcontainer/Dockerfile:3`, `AGRO_PROJECT_ROOT`).
- `.agro/cli/src/cli.ts:364`, `:395`, and `:467` print `default` in help text.
- `docs/harnesses/overview.md:40`, `:82`, `docs/installation.md:240`, and `docs/lifecycle-commands.md:302`, `:344`, `:347`, `:355` name `default`.

Selected approach: change the one constant. Both fallbacks read the constant, so the install fallback and the `workspace create` fallback stay equal. The recorded `harnessRoot` keeps precedence over the fallback, so existing hosts keep their recorded `default` root. The name `default` still passes `assertWorkspaceName`, so explicit `default` workspaces keep working. Add no migration and no alias.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the fallback name and the root precedence |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses the fallback name when the operator passes no name |
| `.agro/cli/src/cli.ts` | `printHarnessHelp`, workspace help, tool help | Prints the fallback path to the operator |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot`, `resolveHarnessRoot` cases | Asserts the fallback path |
| `.agro/cli/src/__tests__/workspace.test.ts` | "defaults the name to `default`" | Asserts the `create` fallback |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot`, help-text case at line 1500, recorded-root case at line 674 | Asserts the install fallback and the help text |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` | Asserts the `agro tool install` fallback |
| `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `docs/installation.md` | fallback prose and examples | Public reference for the fallback |
| `.agro/knowledge/source/agro-cli-portable-lifecycle.md` | "the default name is `default`" | Knowledge page that states the old name |
| `CHANGELOG.md` | `## [Unreleased]` | Records the user-facing change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` with no name | Behavior | Clones into `~/.agro/workspaces/harness` instead of `~/.agro/workspaces/default` |
| `agro harness install --host` and `agro tool install --host` with no selector and no recorded root | Behavior | Resolve `~/.agro/workspaces/harness` |
| `agro harness --help`, `agro workspace --help`, `agro tool --help` | Text | Name `harness` as the fallback |
| `~/.agro/config.json` `harnessRoot` | None | The CLI reads a recorded value unchanged and rewrites no value |

## Storage

No schema change. The host workspace registry stays at `${AGRO_HOME:-~/.agro}/workspaces/<name>/`. The CLI does not move, rename, or delete an existing `default` directory. `harnessRoot` in `~/.agro/config.json` keeps its current format.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the fallback name.
- The precedence order stays: explicit selector, then recorded `harnessRoot`, then the fallback.
- A host that has only `~/.agro/workspaces/default` and no recorded `harnessRoot` resolves `harness` after this change. The host install then refuses and lists `default` through `resolveExistingWorkspace`. This task accepts that refusal and adds no silent fallback to `default`.

Affected surfaces:

- **Host and sandbox:** applied. The change is in the host CLI. An application agent edits and tests the code inside the sandbox.
- **Lifecycle door:** applied. `agro workspace create`, `agro harness install`, and `agro tool install` share the constant.
- **Canonical and provider surfaces:** not applicable. The task changes no skill, hook, or mirror.
- **Root and scaffold:** applied to the CLI and the docs. Initialized projects need no change.
- **Interactive and headless processes:** not applicable. The task starts no process.
- **Local and remote operation:** applied. The fallback behaves the same on a laptop and on a remote VM.
- **Parallel operation:** not applicable. The task adds no shared mutable state.
- **Public documentation:** applied. See the open question about `mifunedev/agro-web`.
- **Verification:** applied. See the test plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` returns `<home>/.agro/workspaces/harness`; `resolveHarnessRoot` with no config returns that path | The install fallback |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `resolveHarnessRoot` returns a recorded `harnessRoot` of `<home>/.agro/workspaces/default` | Recorded roots keep precedence |
| `.agro/cli/src/__tests__/workspace.test.ts` | `create` with no name clones into `workspacePath(home, "harness")`; `create default` clones into `workspacePath(home, "default")` | The `create` fallback and explicit `default` |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` joins `harness`; help text contains `~/.agro/workspaces/harness`; `--workspace default` resolves the `default` entry | Install fallback, help text, explicit `default` |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` joins `harness` | The `agro tool install` fallback |
| `.agro/evals/probes/host-workspace-namespace.sh` | Existing probe | The registry shape stays intact |

Update each assertion first and confirm that the updated test fails. Then change the constant and the help text.

## Design Principles

- Change one constant. Do not add a second fallback name.
- Keep the recorded `harnessRoot` authoritative over the fallback.
- Add no migration for existing `default` directories.
- Add no explanatory code comments, per `AGENTS.md` property 5.
- Write the docs and the changelog entry in `/ste` style.

## Out of Scope

- Moving or renaming an existing `~/.agro/workspaces/default` directory.
- A compatibility fallback from `harness` to `default`.
- Changes to the `default` column in `agro workspace list`. That column marks the recorded root, not the fallback name.
- Changes to the sandbox path `/home/sandbox/harness`.
- Edits to archived task plans under `.agro/tasks/archive/`.

## Open Questions

1. Does `mifunedev/agro-web` name `~/.agro/workspaces/default`? If `mifunedev/agro-web` names that path, who opens the matching change, and does this task block on that change?
2. Should `.agro/knowledge/source/agro-cli-portable-lifecycle.md` and `.agro/knowledge/source/fresh-machine-setup.md` change in this task, or through a later `/wiki` ingest? This plan assumes a direct edit to the sentence that names `default` in `agro-cli-portable-lifecycle.md`.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` of `~/.agro/workspaces/default` both resolve unchanged.
- [ ] CLI help, `docs/`, and CLI tests name `harness` as the fallback.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
