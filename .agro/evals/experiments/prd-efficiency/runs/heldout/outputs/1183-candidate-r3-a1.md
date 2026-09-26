# PRD: Use harness as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Rename the implicit host workspace to harness

**Description:** As an operator, I want the implicit host workspace named harness so that it matches the sandbox directory.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] A red test first asserts that `defaultHarnessRoot({}, home)` returns the `harness` entry under the workspaces root. The test then passes.
- [ ] An unconfigured host install records `harnessRoot` as the `harness` workspace path in `.agro/cli/src/__tests__/harness.test.ts` and `.agro/cli/src/__tests__/tool.test.ts`.
- [ ] `runWorkspaceCreate(undefined, ...)` clones into the `harness` workspace path in `.agro/cli/src/__tests__/workspace.test.ts`.
- [ ] A test proves that `--workspace default` still resolves the `default` workspace path.
- [ ] A test proves that a recorded `harnessRoot` at the old `default` workspace path still wins over the fallback.
- [ ] The CLI test suite exits 0.

### US-002: Update help text and docs to the harness fallback

**Description:** As an operator, I want help and docs to name the harness fallback so that they match the CLI.

**Acceptance Criteria:**

- [ ] The harness help and the tool help in `.agro/cli/src/cli.ts` name `~/.agro/workspaces/harness`.
- [ ] `git grep -n "workspaces/default" -- .agro/cli/src/cli.ts docs` returns no match.
- [ ] `docs/harnesses/overview.md`, `docs/installation.md`, and `docs/lifecycle-commands.md` name `~/.agro/workspaces/harness` as the fallback.
- [ ] The help assertion at line 1500 of `.agro/cli/src/__tests__/harness.test.ts` expects `~/.agro/workspaces/harness`.

## Summary

`DEFAULT_WORKSPACE_NAME` is `"default"` at line 12 of `.agro/cli/src/lib/host-config.ts`. `defaultHarnessRoot` joins this name to the workspaces root. `resolveHarnessRoot` falls back to `defaultHarnessRoot` after `--path` and the recorded `harnessRoot`. `runWorkspaceCreate` in `.agro/cli/src/commands/workspace.ts` uses the same constant when the operator gives no name. The sandbox uses the harness directory name under the sandbox home. The fix changes the one constant to `"harness"`. The fix then updates tests, CLI help, and docs. The resolution order stays the same, so a recorded `harnessRoot` still wins. The name `default` stays valid for `--workspace` and for `agro workspace create default`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the fallback name |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Applies the fallback name when the operator omits a name |
| `.agro/cli/src/cli.ts` | harness help near line 364, tool help near line 467 | Help text names the fallback |
| `docs/harnesses/overview.md` | lines 40 and 82 | Documents the fallback |
| `docs/installation.md` | line 240 | Documents the fallback |
| `docs/lifecycle-commands.md` | lines 302, 344, 347 | Documents the fallback |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install` on the host | Behavior | The fallback root is `~/.agro/workspaces/harness` |
| `agro tool install` on the host | Behavior | The fallback root is `~/.agro/workspaces/harness` |
| `agro workspace create` | Behavior | The implicit name is `harness` |
| CLI help | Text | The help names the new fallback |

## Storage

The host workspace registry directory changes its implicit entry name. The host config file keeps its schema. The CLI does not migrate or rename an existing `default` workspace.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the fallback name.
- The resolution order stays: `--path`, then `--workspace`, then the recorded `harnessRoot`, then the fallback.
- The CLI adds no migration and no alias from `default` to `harness`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` in a clean home; `resolveHarnessRoot` fallback | The fallback is `harness` |
| `.agro/cli/src/__tests__/workspace.test.ts` | create without a name; create with `default` | The implicit name is `harness`; `default` still works |
| `.agro/cli/src/__tests__/harness.test.ts` | unconfigured install; recorded `harnessRoot` at the old path; help text | Install fallback, compatibility, help |
| `.agro/cli/src/__tests__/tool.test.ts` | unconfigured host tool install | The `agro tool install` fallback is `harness` |

## Design Principles

- Change one constant. Keep one source of truth.
- Keep existing explicit and recorded roots working.
- Add no comments to tracked code.

## Out of Scope

- Migration of an existing `default` workspace directory.
- Changes to the sandbox harness path.
- Changes to the public site in mifunedev/agro-web, unless the operator requests the change.

## Open Questions

1. The CLI package has no `test` script in its manifest. Which command runs the CLI tests? Use `<cli test command>` until the operator confirms it.
2. Does the public site in mifunedev/agro-web name `~/.agro/workspaces/default`? If yes, open a matching change there.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` still resolve.
- [ ] CLI help, docs, and tests name the `harness` fallback.
- [ ] `<cli test command>` exits 0.

## Lessons

Filled by the advisor before undraft.
