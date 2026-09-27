# PRD: Installation-aware recovery hint for a missing lifecycle script

Status: DRAFT

## User Stories

### US-001: Name the recovery that works for the running installation

**Description:** As an operator, I want an error hint that works for my installation so that I do not follow refused `agro update` advice.

**Acceptance Criteria:**

- [ ] For an `image` installation, the `requireLifecycleScript` error names the host image refresh: `<bin> stop`, then `<bin> sandbox install docker --name <name>`.
- [ ] For an `image` installation, the error text does not contain `` `agro update` ``.
- [ ] For an `npm`, `standalone`, `source`, `legacy-package`, or `unknown` installation, the error names `oh update` as the payload re-vendor verb.
- [ ] `refuseUnsupported` and `requireLifecycleScript` build the image refresh text from one exported function in `.agro/cli/src/commands/self-upgrade.ts`.
- [ ] A new test fails against the current message and passes after the change. The test asserts the `image` hint and the `npm` hint separately.
- [ ] The existing case "fails with the %s re-vendor hint when the entry carries no script" in `.agro/cli/src/__tests__/compose-verbs.test.ts` asserts the new hint and passes.
- [ ] Every existing `refuseUnsupported` image assertion in `.agro/cli/src/__tests__/self-upgrade.test.ts` passes without an edit to the expected text.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Name a generation mismatch

**Description:** As an operator, I want the error to name a generation mismatch so that I diagnose version skew instead of a guess.

**Acceptance Criteria:**

- [ ] If `<other control dir>/scripts/<rel>` exists and `<resolved control dir>/scripts/<rel>` does not exist, the error names both directories and the phrase `generation mismatch`.
- [ ] If neither control dir holds the script, the error does not contain `generation mismatch`.
- [ ] A test covers each of the two conditions above with a temporary project root.

### US-003: Document recovery for a sandbox that already fails

**Description:** As an operator, I want a recovery runbook for a sandbox that shows `missing lifecycle script <root>/.oh/scripts/gateway.sh` so that I can recover it safely.

**Acceptance Criteria:**

- [ ] `docs/repair-missing-lifecycle-script.md` exists and quotes the symptom string from issue #1080.
- [ ] The runbook identifies an old image bundle through `realpath /usr/local/bin/agro` and `agro --version` inside the sandbox.
- [ ] The runbook recovery steps run on the host and use only `agro stop <name>` and `agro sandbox install docker --name <name>`.
- [ ] The runbook states that `agro update` refuses an `image` installation.
- [ ] The runbook contains no step that writes to `/opt/oh`, creates a `.oh` symlink, or changes Slack credentials.
- [ ] `docs/README.md` links the runbook next to the two existing `repair-` entries.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/repair-missing-lifecycle-script.md` exits 0.

## Summary

Issue #1080 reports `missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh` from `agro gateway <name>`.
The failing binary is the v0.9.0 bundle at `/opt/oh/dist/agro.js`, which hardcodes `.oh/`.
Current source is v0.12.2 (`.agro/cli/package.json:3`).
Current source resolves the control dir through `resolveProjectLayout` (`.agro/cli/src/lib/compat.ts:204`), so the path defect is already fixed.

The live defect is the hint at `.agro/cli/src/lib/execution/runner.ts:75`.
The hint tells the operator to run `` `${activeBin()} update` ``.
For `agro`, `update` is CLI self-upgrade, not payload vendoring (`docs/lifecycle-commands.md:104-139`).
`classifyInstallation` returns `image` for each path under `/opt/oh/` (`.agro/cli/src/commands/self-upgrade.ts:70`, `:117`).
`refuseUnsupported` then refuses the upgrade (`self-upgrade.ts:185-191`).
Every sandbox installs the CLI under `/opt/oh/`, so the hint fails for its most likely reader.

The selected approach changes the diagnostic text only.
`requireLifecycleScript` classifies the running installation with `classifyInstallation(process.argv[1], ...)`.
An `image` installation gets the host image refresh procedure.
Each other installation kind gets `oh update`.
A second check names a generation mismatch when the other generation's control dir holds the script.
A new runbook covers a sandbox that already runs the old bundle, because no source change reaches that bundle.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` (lines 70-79) | Builds the error. Receives the new hint logic. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation` (line 122), `refuseUnsupported` (line 185), `defaultDeps` (line 438), `IMAGE_ROOT` (line 70) | This file classifies the installation. This file also owns the image refresh text, which becomes one shared function. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout` (line 204), `GENERATIONS`, `controlDirCandidates` (line 223) | Resolves the control dir and names the other generation. |
| `.agro/cli/src/lib/product.ts` | `activeBin` (line 41), `LEGACY_PRODUCT` | Supplies `<bin>` for the image procedure and `oh` for the payload verb. |
| `.agro/cli/src/commands/lifecycle.ts` | `runGateway` (line 378), compose callers (lines 173, 199, 276, 289) | Callers. No change. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | caller at line 143 | Caller. No change. |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | `CONFIG_RESOLUTION_FAILURES` (line 31) | Matches `/missing lifecycle script/`. The new text keeps that prefix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `requireLifecycleScript` error text | Modified | Keeps the prefix `missing lifecycle script <path>`. Replaces the `<bin> update` hint with an installation-aware hint. Adds a generation-mismatch clause. |
| `self-upgrade.ts` exports | Added | One exported function returns the image refresh procedure for a `bin`. |
| `docs/repair-missing-lifecycle-script.md` | Added | Operator recovery runbook. |
| `docs/README.md` | Modified | Adds one link to the runbook. |
| `mifunedev/agro-web` | Open question | The runbook is user-facing. See Open Questions. |

## Storage

N/A. The change reads the filesystem and writes no state.

## Architectural Decisions

- `classifyInstallation` stays the single source of truth for the installation kind. `runner.ts` imports it. The import direction `lib/execution` → `commands` has no cycle, because `self-upgrade.ts` imports only `lib/compat` and `lib/product`.
- The image refresh procedure text has one owner in `self-upgrade.ts`. `refuseUnsupported` and `requireLifecycleScript` call it.
- The payload verb is `oh update` for every non-image kind, because `oh update` is the only payload vendor verb in the compatibility window (`docs/lifecycle-commands.md:127-139`).
- No ownership, lifecycle, or boot change. `/opt/oh` stays image-owned.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/execution/__tests__/runner.test.ts` (new) | image kind names host refresh and omits `` `agro update` ``; npm kind names `oh update` | US-001 |
| `.agro/cli/src/lib/execution/__tests__/runner.test.ts` (new) | other generation holds the script → `generation mismatch`; neither holds it → no mismatch clause | US-002 |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | "fails with the %s re-vendor hint when the entry carries no script" (line 125), updated expectation | US-001 |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | existing `refuseUnsupported` image cases, unchanged | US-001 shared text |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | existing `CONFIG_RESOLUTION_FAILURES` match | Prefix stability |
| `docs/repair-missing-lifecycle-script.md` | `ste-check.sh` exit 0 | US-003 |

Run the suite with `<cli test command>`. Run the typecheck with `npm --prefix .agro/cli run typecheck`.

## Design Principles

- Apply the smallest truthful change: text and one shared function, no new machinery.
- Keep one source of truth for the installation kind and for the image refresh text.
- Add no explanatory comments to tracked code.
- Keep the message prefix stable for existing matchers.
- Run the implementation inside the sandbox. The root orchestrator writes no application code.

## Out of Scope

- A `.oh` → `.agro` symlink.
- Automatic boot-time install or refresh of `/opt/oh`.
- Any mutation of `/opt/oh` on a running sandbox.
- Any change to Slack credentials.
- A change to `agro update` or `oh update` behavior.
- A patch to the v0.9.0 bundle.

## Open Questions

1. `<cli test command>`: `.agro/cli/package.json` defines no `test` script. Which command runs the vitest suite for `.agro/cli/src`?
2. US-002 reachability: `resolveProjectLayout` selects the generation whose control dir exists. With both dirs present, `resolvePair` requires equivalent trees (`compat.ts:166-168`). The current source then rarely reaches a state where only the other generation holds the script. Keep US-002, or drop US-002 under YAGNI?
3. Does the runbook need a matching page in `mifunedev/agro-web`?

## Acceptance Criteria

- [ ] Each US-001, US-002, and US-003 criterion passes.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `git grep -n 'to re-vendor it' .agro/cli/src/lib/execution/runner.ts` exits 1.
- [ ] The diff touches no file under `.devcontainer/` and no path under `/opt/oh`.

## Lessons

Filled by the advisor before undraft.
