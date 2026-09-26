# PRD: Harness workspace fallback

Status: DRAFT

## User Stories

### US-001: Rename the implicit workspace to harness

**Description:** As an operator, I want the implicit host workspace named harness so that host and sandbox names match.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] With no explicit root and no recorded `harnessRoot`, `resolveHarnessRoot` returns `<home>/.agro/workspaces/harness`.
- [ ] `agro workspace create` with no name clones into `~/.agro/workspaces/harness`.
- [ ] `agro workspace create default` still clones into `~/.agro/workspaces/default`.
- [ ] A recorded `harnessRoot` that names `~/.agro/workspaces/default` still resolves to that directory.
- [ ] Each test case in the Test Plan fails before the change and passes after the change.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Update help and docs for the new fallback

**Description:** As an operator, I want help and docs to name the harness fallback so that the text matches behavior.

**Acceptance Criteria:**

- [ ] The help text in `.agro/cli/src/cli.ts` names `~/.agro/workspaces/harness` at each fallback mention.
- [ ] `docs/harnesses/overview.md`, `docs/installation.md`, and `docs/lifecycle-commands.md` name `~/.agro/workspaces/harness` as the implicit fallback.
- [ ] `git grep -n "workspaces/default" -- .agro/cli/src docs` returns only lines that test or document an explicit `default` workspace.
- [ ] `CHANGELOG.md` has one entry that states the new fallback name.

## Summary

The host fallback workspace name comes from one constant. `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"default"`. `defaultHarnessRoot` joins the constant to the workspaces directory. `resolveHarnessRoot` uses an explicit path first, then the recorded `harnessRoot`, then `defaultHarnessRoot`. `agro workspace create` in `.agro/cli/src/commands/workspace.ts` uses the same constant when the operator gives no name. The selected approach changes the constant value to `"harness"`. The approach keeps the resolution order. A recorded `harnessRoot` therefore still wins, and an explicit `default` name stays valid under `assertWorkspaceName`. Help text, docs, and tests then change to name the new fallback.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot`, `resolveHarnessRoot` | Owns the fallback name and the resolution order |
| `.agro/cli/src/commands/workspace.ts` | `name ?? DEFAULT_WORKSPACE_NAME` at line 80 | Picks the implicit name for `agro workspace create` |
| `.agro/cli/src/cli.ts` | Help text at lines 364 and 467 | Names the fallback root to the operator |
| `docs/harnesses/overview.md` | Harness root table row and resolution list | Documents the fallback |
| `docs/installation.md` | Host install resolution text | Documents the fallback |
| `docs/lifecycle-commands.md` | Host install text and `agro workspace create` examples | Documents the fallback |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` | Behavior change | The implicit name changes from `default` to `harness` |
| `agro harness install` on the host | Behavior change | The unconfigured fallback root changes to `~/.agro/workspaces/harness` |
| CLI help | Text change | The help names the new fallback root |

## Storage

The change keeps the `~/.agro/config.json` schema. The change writes no migration. A recorded `harnessRoot` keeps its value.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for the implicit name.
- The resolution order stays: explicit path, recorded `harnessRoot`, fallback.
- The change moves no existing `~/.agro/workspaces/default` directory.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | Clean-home `defaultHarnessRoot` and `resolveHarnessRoot` cases expect the harness workspace directory | Unconfigured fallback |
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | A recorded `harnessRoot` at the default workspace directory resolves unchanged | Existing records keep working |
| `.agro/cli/src/__tests__/workspace.test.ts` | Nameless create clones into the harness workspace directory; explicit `default` clones into the default workspace directory | Create fallback and explicit name |
| `.agro/cli/src/__tests__/harness.test.ts` | Install records the harness workspace directory; help contains `~/.agro/workspaces/harness` | Install fallback and help |
| `.agro/cli/src/__tests__/tool.test.ts` | Fixture helper at line 93 names the harness workspace directory | Host tool install fallback |

Run the suite with `<cli test command>`.

## Design Principles

- Change one constant. Add no new abstraction.
- Keep one resolution path for install and create.
- Add no explanatory comments to tracked code.

## Out of Scope

- Migration or rename of an existing `~/.agro/workspaces/default` directory.
- Changes to sandbox harness directory names.
- Changes to the public site repository mifunedev/agro-web, which Open Questions tracks.

## Open Questions

1. The `.agro/cli/package.json` file defines no `test` script. What command runs the CLI test suite? The plan uses `<cli test command>`.
2. Does mifunedev/agro-web name `~/.agro/workspaces/default`? If yes, open a matching docs change there.
3. Does `.agro/evals/probes/host-workspace-door.sh` depend on the fallback name? The grounding grep found no `default` match in the probe.

## Acceptance Criteria

- [ ] An unconfigured host install resolves `~/.agro/workspaces/harness`.
- [ ] `agro workspace create` without a name creates `~/.agro/workspaces/harness`.
- [ ] An explicit `default` workspace and a recorded `harnessRoot` keep working.
- [ ] CLI help, docs, and tests name the new fallback.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
