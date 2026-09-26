# PRD: Installation-aware recovery advice for a missing lifecycle script

Status: DRAFT

## User Stories

### US-001: Give installation-aware recovery advice in the missing-script error

**Description:** As a sandbox operator, I want working recovery advice in the missing-script error so that the CLI accepts my next step.

**Acceptance Criteria:**

- [ ] A red test in `.agro/cli/src/__tests__/lifecycle.test.ts` calls `runGateway` against a temporary project root that has an `.agro/` directory without the `.agro/scripts/gateway.sh` equivalent. The test asserts that the error text does not contain `` `agro update` ``. The test fails against the current message in `.agro/cli/src/lib/execution/runner.ts`.
- [ ] For an `image` installation, the error names the host image refresh: `agro stop <name>`, then `agro sandbox install docker --name <name>`.
- [ ] For an `npm`, `standalone`, `source`, `legacy-package`, or `unknown` installation, the error names `oh update` as the verb that re-vendors the control plane.
- [ ] The error still contains the full missing script path, for example `<root>/.agro/scripts/gateway.sh`.
- [ ] The error states the running CLI version and the resolved generation (`agro` or `legacy`).
- [ ] The image advice text has one source. `refuseUnsupported` in `.agro/cli/src/commands/self-upgrade.ts` and the missing-script error use the same exported value or function.
- [ ] The existing `/missing lifecycle script/` pattern in `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` still matches the new error.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `<cli test command>` exits 0 with the new cases green.

### US-002: Document recovery for a sandbox that already shows the error

**Description:** As an operator whose sandbox already prints "missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh", I want a recovery runbook so that I can restore `agro gateway` without guesswork.

**Acceptance Criteria:**

- [ ] New file `docs/repair-missing-lifecycle-script.md` quotes the exact error line from the issue.
- [ ] The runbook explains the cause: the image ships /opt/oh/dist/agro.js at v0.9.0, and that bundle reads the scripts directory under a `.oh` control directory.
- [ ] The runbook gives the host procedure, in order: `agro stop <name>`, then `agro sandbox install docker --name <name>`, then `agro gateway status` inside the sandbox.
- [ ] The runbook states that the operator must not edit /opt/oh inside a running sandbox and must not create a `.oh` symlink.
- [ ] `docs/README.md` links the new runbook next to the existing repair runbooks.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/repair-missing-lifecycle-script.md` exits 0.
- [ ] `CHANGELOG.md` has one `### Fixed` entry under `## [Unreleased]` that cites issue 1080.

## Summary

Issue 1080 reports that `agro gateway <name>` fails in a sandbox with the error "missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh". The sandbox runs the image copy of the CLI at v0.9.0. That bundle hardcodes the `.oh` control directory. The current source (v0.12.2) already resolves the control directory through `resolveProjectLayout` in `.agro/cli/src/lib/compat.ts`. The current source has no path defect.

The live defect is the recovery advice. `requireLifecycleScript` in `.agro/cli/src/lib/execution/runner.ts` tells the operator to run `` `${activeBin()} update` ``. For the `agro` binary, `update` is CLI self-upgrade, not payload vendoring (`printSelfUpgradeHelp` in `.agro/cli/src/cli.ts`). For an image installation under /opt/oh/, `classifyInstallation` returns `image`, and `runSelfUpgrade` refuses through `refuseUnsupported`. The advice leads the most likely reader to a dead end.

The selected approach changes only the message. `requireLifecycleScript` classifies the running installation only on the failure path. The function then builds the advice from the installation kind. The image branch reuses the advice text that `refuseUnsupported` already carries. The other branches name `oh update`, the payload-vendoring verb during the compatibility window.

A source change reaches operators only through a newer image or package. The runbook in US-002 covers the sandboxes that run the old bundle today.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Builds the missing-script error. The only message change. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation`, `defaultDeps`, `refuseUnsupported` | Classifies the installation. Owns the image advice text. The change exports that text for two call sites. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout`, `GENERATIONS` | Supplies the resolved generation and control directory. No change. |
| `.agro/cli/src/lib/product.ts` | `activeBin` | Supplies the running binary name for the advice. No change. |
| `.agro/cli/src/commands/lifecycle.ts` | `runGateway` and the compose verbs | Callers of `requireLifecycleScript`. No change. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | `requireLifecycleScript` call | Caller. No change. |
| `docs/README.md` | repair runbook list | Links the new runbook. |
| `CHANGELOG.md` | `## [Unreleased]` | Records the fix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI error text for a missing lifecycle script | Modified | Advice depends on the installation kind. The text keeps the prefix `missing lifecycle script <path>`. |
| `self-upgrade.ts` exports | Added | One exported image-advice value or function, shared by two call sites. |
| Operator documentation | Added | New file `docs/repair-missing-lifecycle-script.md`. |

## Storage

N/A. The change reads the file system and writes no state.

## Architectural Decisions

- `classifyInstallation` stays the single source of truth for the installation kind. The runner does not detect /opt/oh/ itself.
- The runner classifies only when the script is absent. The success path does no extra file-system work.
- The image advice text has one owner in `.agro/cli/src/commands/self-upgrade.ts`.
- No ownership or lifecycle change. The plan adds no `.oh` to `.agro` symlink, no boot-time refresh of /opt/oh, and no change to Slack credentials.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `runGateway` on a root without `gateway.sh`: the error omits `` `agro update` `` and keeps the script path. Red first. | US-001 red test and path retention |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | One case per installation kind (`image`, `npm`, `standalone`, `source`): the advice names the host image refresh for `image` and `oh update` for the others. | US-001 installation-aware advice |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | `runSelfUpgrade` on an `image` installation still prints the same refusal text. | Shared image advice keeps the self-upgrade behavior |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | Existing `/missing lifecycle script/` pattern. No edit. | Error prefix stays stable |

## Design Principles

- Apply the smallest truthful change. Change the advice, not the resolution.
- Keep one source for each policy text.
- Add no explanatory comments to tracked code.
- Make every advice line an executable command for the reader's installation.

## Out of Scope

- A `.oh` to `.agro` symlink.
- Automatic installation or refresh of /opt/oh at boot.
- Any mutation of /opt/oh in a running sandbox.
- Any change to Slack credentials.
- A new payload-vendoring verb under `agro`.
- A rebuild or release of the sandbox image.

## Open Questions

1. The issue asks the error to name a generation mismatch when the other generation's control directory exists. `resolvePair` in `.agro/cli/src/lib/compat.ts` picks the only directory present. The function throws `CompatConflictError` when both directories exist and differ. The current source therefore cannot reach that branch. The plan prints the CLI version and the resolved generation instead. Confirm this substitute, or name a reachable mismatch case.
2. `.agro/cli/package.json` has no `test` script. Name `<cli test command>`, the runner that executes `.agro/cli/src/__tests__/*.test.ts`.
3. The injection seam for the installation kind is open. Option A: `requireLifecycleScript` takes an optional classifier argument. Option B: the tests set `process.argv[1]` to a fixture path. The plan recommends option A.
4. The import from `.agro/cli/src/lib/execution/runner.ts` to `.agro/cli/src/commands/self-upgrade.ts` crosses from `lib` into `commands`. Confirm this direction, or move `classifyInstallation` and the image advice into `lib`.
5. Confirm whether `mifunedev/agro-web` needs a matching recovery page.

## Acceptance Criteria

- [ ] Every US-001 and US-002 criterion passes.
- [ ] No tracked file in the diff adds an explanatory code comment.
- [ ] `git diff --name-only` lists no path under `.devcontainer/` and no path under /opt/oh.
- [ ] `<cli test command>` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

## Lessons

Filled by the advisor before undraft.
