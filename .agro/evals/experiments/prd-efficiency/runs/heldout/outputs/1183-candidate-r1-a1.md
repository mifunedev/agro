# PRD: Use harness as the implicit host workspace name

Status: DRAFT

## User Stories

### US-001: Change the implicit workspace name to harness

**Description:** As an operator, I want the implicit host workspace named harness so that host and sandbox names match.

**Acceptance Criteria:**

- [ ] `DEFAULT_WORKSPACE_NAME` in `.agro/cli/src/lib/host-config.ts` equals `"harness"`.
- [ ] With no recorded `harnessRoot`, `defaultHarnessRoot` returns the workspaces/harness directory under the state home.
- [ ] `runWorkspaceCreate` with no name clones into the workspaces/harness directory under the state home.
- [ ] `agro workspace create default` still creates the workspaces/default directory under the state home.
- [ ] A recorded `harnessRoot` that names the workspaces/default directory still resolves to that directory for host harness and host tool installs.
- [ ] Each test that asserts the old fallback now asserts the workspaces/harness directory, and the CLI test suite exits 0.

### US-002: Update help text and documentation

**Description:** As an operator, I want help and docs to name the harness fallback so that the text matches behavior.

**Acceptance Criteria:**

- [ ] The help text in `.agro/cli/src/cli.ts` names `~/.agro/workspaces/harness` at both fallback mentions, and no mention of `~/.agro/workspaces/default` remains in that file.
- [ ] `docs/harnesses/overview.md`, `docs/installation.md`, and `docs/lifecycle-commands.md` name `~/.agro/workspaces/harness` as the fallback.
- [ ] `git grep -n "workspaces/default" -- docs .agro/cli/src/cli.ts` returns no match.
- [ ] The help test in `.agro/cli/src/__tests__/harness.test.ts` asserts `~/.agro/workspaces/harness`.

## Summary

The constant `DEFAULT_WORKSPACE_NAME` at `.agro/cli/src/lib/host-config.ts:12` holds `"default"`. The function `defaultHarnessRoot` joins the constant to the workspaces root. The function `runWorkspaceCreate` in `.agro/cli/src/commands/workspace.ts:80` uses the same constant when the operator gives no name. One constant controls both fallbacks, so one change keeps the two fallbacks aligned. A recorded `harnessRoot` has precedence over the fallback, so existing configurations keep their root. The name `default` stays a valid workspace name, so explicit `default` workspaces keep working. The plan changes the constant value, the tests that assert the old path, the CLI help text, and three documentation files.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `DEFAULT_WORKSPACE_NAME`, `defaultHarnessRoot` | Source of the implicit workspace name |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate` | Reads the constant when the operator gives no name |
| `.agro/cli/src/cli.ts` | help text near lines 364 and 467 | Names the fallback path |
| `docs/harnesses/overview.md` | lines 40 and 82 | Fallback documentation |
| `docs/installation.md` | line 240 | Fallback documentation |
| `docs/lifecycle-commands.md` | lines 302, 344, and 347 | Fallback documentation and examples |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro workspace create` | Behavior | The command without a name creates the `harness` workspace. |
| Host harness and tool install | Behavior | An unconfigured install resolves the `harness` workspace. |
| CLI help | Text | The help names `~/.agro/workspaces/harness`. |

## Storage

The fallback directory moves to the workspaces/harness directory under the state home. The file `~/.agro/config.json` keeps its schema. The CLI performs no migration of existing directories.

## Architectural Decisions

- `DEFAULT_WORKSPACE_NAME` stays the single source of truth for both fallbacks.
- A recorded `harnessRoot` keeps precedence over the fallback.
- The CLI does not rename or move an existing workspaces/default directory.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/host-config.test.ts` | `defaultHarnessRoot` clean home, legacy registry, and state home override | Fallback resolves the `harness` workspace |
| `.agro/cli/src/__tests__/workspace.test.ts` | create with no name; create with explicit `default`; recorded `harnessRoot` unchanged | Implicit and explicit names |
| `.agro/cli/src/__tests__/harness.test.ts` | `defaultRoot` helper, line 674 assertion, help text at line 1500, recorded `harnessRoot` cases | Install fallback, help, and compatibility |
| `.agro/cli/src/__tests__/tool.test.ts` | `defaultRoot` helper and recorded root cases | Tool install fallback |

Write each changed assertion first. Confirm that the assertion fails before the constant changes. Run `<cli test command>` in `.agro/cli` to confirm that the suite exits 0.

## Design Principles

- Change one constant. Do not add a second fallback path.
- Keep explicit names and recorded roots unchanged.
- Add no explanatory comments to tracked code.

## Out of Scope

- Migration of an existing workspaces/default directory.
- Sandbox harness directory behavior.
- Changes to the workspace name validation rules.

## Open Questions

1. The exact CLI test command is not verified. Confirm `<cli test command>` from `.agro/cli/package.json`.
2. Does the public site mifunedev/agro-web name `~/.agro/workspaces/default`? If yes, open a matching change there.
3. Does the change need a CHANGELOG entry marked as breaking for operators who rely on the old implicit path?

## Acceptance Criteria
- [ ] An unconfigured host install resolves the workspaces/harness directory under the state home.
- [ ] `agro workspace create` without a name creates the workspaces/harness directory under the state home.
- [ ] Explicit `default` workspaces and recorded `harnessRoot` values resolve as before.
- [ ] CLI help, the three documentation files, and the tests name the `harness` fallback.
- [ ] The CLI test suite exits 0.

## Lessons

Filled by the advisor before undraft.
