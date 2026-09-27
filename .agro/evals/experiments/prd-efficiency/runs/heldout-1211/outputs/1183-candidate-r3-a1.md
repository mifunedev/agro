# PRD: Use `harness` as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Change the implicit host workspace name to `harness`

**Description:** As an operator, I want the implicit host workspace to be `~/.agro/workspaces/harness` so that the name matches the sandbox directory `/home/sandbox/harness`.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] `defaultHarnessRoot({}, home)` returns `join(home, ".agro", "workspaces", "harness")` in a clean home.
- [ ] In a state home with no `harnessRoot`, `agro harness install claude-code --host` records `harnessRoot` as `<state home>/workspaces/harness`.
- [ ] In a state home with no `harnessRoot`, `agro tool install` on the host reports `no AGRO workspace at <state home>/workspaces/harness` when that directory is absent.
- [ ] `runWorkspaceCreate(undefined, ...)` clones into `<state home>/workspaces/harness`.
- [ ] `agro workspace create default` still clones into `<state home>/workspaces/default`.
- [ ] `agro harness install <id> --workspace default` still resolves `<state home>/workspaces/default`.
- [ ] If `~/.agro/config.json` records `harnessRoot` as `<state home>/workspaces/default`, a host install without `--workspace` or `--path` resolves `<state home>/workspaces/default`.
- [ ] The tests in `.agro/cli/src/lib/__tests__/host-config.test.ts`, `.agro/cli/src/__tests__/harness.test.ts`, `.agro/cli/src/__tests__/tool.test.ts`, and `.agro/cli/src/__tests__/workspace.test.ts` fail before the constant change and pass after the constant change.
- [ ] `pnpm exec vitest run .agro/cli/src` exits 0.
- [ ] `pnpm --dir .agro/cli run typecheck` exits 0.

### US-002: Update CLI help, docs, and changelog for the new fallback

**Description:** As an operator, I want the help text and the docs to name `~/.agro/workspaces/harness` so that the documented fallback matches the CLI behavior.

**Acceptance Criteria:**

- [ ] `printHarnessHelp` output contains `~/.agro/workspaces/harness` and does not contain `~/.agro/workspaces/default`.
- [ ] The `agro workspace` help text in `.agro/cli/src/cli.ts` states that the default name is `harness`.
- [ ] The `agro tool` help text in `.agro/cli/src/cli.ts` names `~/.agro/workspaces/harness` as the last fallback.
- [ ] `git grep -n 'workspaces/default' -- docs .agro/cli/src/cli.ts` prints no line.
- [ ] `docs/harnesses/overview.md`, `docs/installation.md`, and `docs/lifecycle-commands.md` name `~/.agro/workspaces/harness` as the implicit fallback.
- [ ] `CHANGELOG.md` has one `### Changed` entry under `## [Unreleased]` that names the new fallback and links issue #1183.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/harness.test.ts` exits 0.

## Summary

Issue #1183 asks for `harness` instead of `default` as the implicit host workspace name.

Verified current state:

- `.agro/cli/src/lib/host-config.ts:12` defines `DEFAULT_WORKSPACE_NAME = "default"`.
- `defaultHarnessRoot` at `.agro/cli/src/lib/host-config.ts:55` joins `workspacesRoot` with `DEFAULT_WORKSPACE_NAME`.
- `resolveHarnessRoot` at `.agro/cli/src/lib/host-config.ts:161` checks the explicit root first, then the recorded `harnessRoot`, then `defaultHarnessRoot`.
- `runHarnessInstall` in `.agro/cli/src/commands/harness.ts` and the host path in `.agro/cli/src/commands/tool.ts` call `resolveHarnessRoot`.
- `runWorkspaceCreate` at `.agro/cli/src/commands/workspace.ts:80` uses `name ?? DEFAULT_WORKSPACE_NAME`.
- The sandbox mounts the repository at `/home/sandbox/harness` (`.devcontainer/docker-compose.yml:13`).

Selected approach: change the one constant. Install fallback and `workspace create` share the constant, so the two paths stay aligned. Explicit names and recorded `harnessRoot` values take the existing code paths, so the change needs no migration code. Then update the help text, the docs, the tests, and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the implicit workspace name and the root precedence |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Uses `DEFAULT_WORKSPACE_NAME` when the operator passes no name |
| `.agro/cli/src/commands/harness.ts` | host install path near line 370 | Calls `resolveHarnessRoot`; no code change expected |
| `.agro/cli/src/commands/tool.ts` | host install path near line 437 | Calls `resolveHarnessRoot`; no code change expected |
| `.agro/cli/src/cli.ts` | `printHarnessHelp` (line 364), workspace help (line 393), tool help (line 467) | Help text that names the fallback |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install <id>` on the host | Behavior | The implicit root changes from `~/.agro/workspaces/default` to `~/.agro/workspaces/harness` |
| `agro tool install <id>` on the host | Behavior | The implicit root changes from `~/.agro/workspaces/default` to `~/.agro/workspaces/harness` |
| `agro workspace create` | Behavior | The nameless form clones into `~/.agro/workspaces/harness` |
| `agro harness --help`, `agro workspace --help`, `agro tool --help` | Text | The help text names the new fallback |
| `docs/harnesses/overview.md`, `docs/installation.md`, `docs/lifecycle-commands.md` | Text | The docs name the new fallback |
| `mifunedev/agro-web` | Text | Public docs that name `~/.agro/workspaces/default` need a matching change; see Open Questions |

## Storage

The storage schema does not change. The registry stays at `${AGRO_HOME:-~/.agro}/workspaces/<name>`. The `harnessRoot` key in `~/.agro/config.json` keeps its format. The CLI does not rename or move an existing `~/.agro/workspaces/default` directory.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the implicit name. Install fallback and `workspace create` both read the constant.
- The precedence stays: `--workspace` or `--path`, then recorded `harnessRoot`, then the implicit name.
- A recorded `harnessRoot` that points at `~/.agro/workspaces/default` keeps that root. The recorded value wins over the fallback, so existing installs keep their root.
- `default` stays a valid workspace name. `assertWorkspaceName` accepts `default` through `SANDBOX_NAME_PATTERN`.
- The change runs on the host CLI only. The sandbox harness path does not change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` clean home and legacy-registry cases (lines 115-122); `resolveHarnessRoot` fallback cases (lines 87, 109, 265) | The fallback is `workspaces/harness`; `default` stays a valid name (line 101) |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | New case: recorded `harnessRoot` at `workspaces/default` resolves to `workspaces/default` | Recorded roots keep working |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper (line 72); unconfigured install records the root (line 674); help text (line 1500) | The install fallback and the help text use `harness` |
| `.agro/cli/src/__tests__/harness.test.ts` | New case: `--workspace default` resolves `workspaces/default` | Explicit `default` keeps working |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` helper (line 93) and its callers (lines 694-954) | The `agro tool` host fallback uses `harness` |
| `.agro/cli/src/__tests__/workspace.test.ts` | Nameless create (line 286) | `workspace create` clones into `workspaces/harness` |
| `.agro/cli/src/__tests__/workspace.test.ts` | New case: `create default` clones into `workspaces/default` | Explicit `default` keeps working |

Run `pnpm exec vitest run .agro/cli/src` and `pnpm --dir .agro/cli run typecheck` from the repository root.

## Design Principles

- Change one constant. Add no alias, no migration, and no second fallback.
- Keep one source of truth for the implicit name.
- Keep recorded and explicit roots on the existing code paths.
- Add no comments to tracked code.

## Out of Scope

- Migration or rename of an existing `~/.agro/workspaces/default` directory.
- A fallback that probes `workspaces/default` when `workspaces/harness` is absent.
- Changes to the sandbox harness path `/home/sandbox/harness`.
- Changes to the `harnessRoot` config format.

## Open Questions

1. The repository does not hold `mifunedev/agro-web`. Does the operator want a matching docs change in `mifunedev/agro-web` as a separate issue?
2. An operator who ran `agro workspace create` before this change and never ran a host install has `~/.agro/workspaces/default` and no recorded `harnessRoot`. After this change, a host install for that operator exits 1. The issue does not name a migration. This plan accepts the exit and documents `--workspace default` in the changelog entry. Does the operator accept that behavior?

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] Explicit `default` workspaces and recorded `harnessRoot` values resolve to the same root as before the change.
- [ ] CLI help, `docs/`, tests, and `CHANGELOG.md` name `~/.agro/workspaces/harness` as the implicit fallback.
- [ ] `pnpm exec vitest run .agro/cli/src` exits 0.
- [ ] `pnpm --dir .agro/cli run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
