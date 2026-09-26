# PRD: Missing lifecycle script hint

Status: DRAFT

## User Stories

### US-001: Installation-aware recovery hint

**Description:** As an operator, I want a correct recovery hint so that I can repair a missing lifecycle script.

**Acceptance Criteria:**

- [ ] A red test in `.agro/cli/src/__tests__/compose-verbs.test.ts` fails against the current message and passes after the change.
- [ ] For an `image` installation, the message names the host image refresh: `agro stop`, then `agro sandbox install docker --name <name>`.
- [ ] For an `npm`, `standalone`, or `source` installation, the message names `oh update` as the payload vendoring verb.
- [ ] No message branch tells the operator to run `agro update` to re-vendor the payload.
- [ ] The message keeps the absolute script path that `requireLifecycleScript` resolved.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Generation mismatch diagnosis

**Description:** As an operator, I want the error to name a generation mismatch so that I diagnose version skew.

**Acceptance Criteria:**

- [ ] If the script is absent and the other generation's control directory holds the script, the message names both control directories.
- [ ] A test with a fixture root that holds only `.agro/scripts/gateway.sh` asserts the mismatch text for a lookup under `.oh`.
- [ ] A test with a fixture root that holds neither control directory asserts that the message contains no mismatch text.

### US-003: Operator recovery runbook

**Description:** As an operator, I want a recovery runbook so that I can repair a sandbox in this state.

**Acceptance Criteria:**

- [ ] New file `docs/repair-missing-lifecycle-script.md` states the symptom, the cause, and the recovery procedure for an image installation.
- [ ] The runbook states that the recovery runs on the host and never mutates /opt/oh inside a running sandbox.
- [ ] The ste checker exits 0 against the new file `docs/repair-missing-lifecycle-script.md`: `bash .agro/skills/ste/scripts/ste-check.sh docs/repair-missing-lifecycle-script.md`.
- [ ] `docs/lifecycle-commands.md` links to the new runbook.

## Summary

The issue reports that `agro gateway <name>` fails in a sandbox with an old image bundle. The old bundle hardcodes the `.oh` control directory. In current source, `resolveProjectLayout` in `.agro/cli/src/lib/compat.ts` resolves the control directory, so the path defect has a fix. The live defect is the error text in `requireLifecycleScript` at `.agro/cli/src/lib/execution/runner.ts:70`. The text tells the operator to run `agro update`. The `agro update` verb upgrades the CLI only, and `refuseUnsupported` in `.agro/cli/src/commands/self-upgrade.ts` refuses the verb for an `image` installation. The change replaces the text with an installation-aware hint. The hint also names a generation mismatch when the other control directory holds the script. A new runbook documents the recovery.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Builds the error message. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout`, `controlDirCandidates` | Resolves the control directory and lists both generations. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation`, `InstallKind`, `refuseUnsupported` | Classifies the running executable. Holds the image refresh text. |
| `.agro/cli/src/lib/product.ts` | `activeBin` | Names the running binary. |
| `.agro/cli/src/commands/lifecycle.ts` | callers at lines 173, 199, 276, 289, 381 | Call `requireLifecycleScript`. The signature stays unchanged. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | `requireLifecycleScript` caller | Calls the function for the compose target. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI error text | Modified | The `missing lifecycle script` message gets an installation-aware hint and a mismatch clause. |
| `docs/lifecycle-commands.md` | Modified | Adds a link to the runbook. |
| New file `docs/repair-missing-lifecycle-script.md` | Added | Operator recovery runbook. |

## Storage

N/A. The change reads the filesystem and writes no state.

## Architectural Decisions

- `classifyInstallation` stays the single source of truth for the installation kind. The runner imports it and does not copy the path rules.
- Extract the image refresh text from `refuseUnsupported` into one exported helper. Both the refusal and the new hint use that helper.
- Keep the hint builder a pure function of the installation kind, the binary, the script path, and the mismatch path. Tests call the function without a real /opt/oh.
- Keep the `requireLifecycleScript(root, rel)` signature. No caller changes.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | Update the case at line 125 that asserts the re-vendor hint | The old hint is absent. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | One case per installation kind: `image`, `npm`, `standalone`, `source` | US-001 hint per kind. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | Mismatch fixture and no-mismatch fixture | US-002. |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | Existing `image` refusal case | The refusal text stays unchanged after the extraction. |

Run the tests with `<cli test command>`.

## Design Principles

- Apply the smallest supported change. Change no ownership and no lifecycle.
- Tell the operator a verb that works for the installation that is running.
- Keep one source of truth for each recovery instruction.
- Add no explanatory comments to tracked code.

## Out of Scope

- A `.oh` to `.agro` symlink.
- Automatic boot-time install or refresh of /opt/oh.
- Any mutation of /opt/oh inside a running sandbox.
- Any change to Slack credentials.
- A fix to the v0.9.0 image bundle. A new image carries the fixed message.

## Open Questions

1. What is the CLI test command? The `.agro/cli/package.json` file shows a `typecheck` script, but grounding did not locate the test script name.
2. Does `.agro/cli/src/__tests__/docs.test.ts` require a registration for a new file under `docs`?
3. Does the runbook need a matching page in the mifunedev/agro-web repository?
4. After the compatibility window closes, which verb replaces `oh update` for payload vendoring?

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `git grep -n "to re-vendor it" .agro/cli/src` returns no match.

## Lessons

Filled by the advisor before undraft.
