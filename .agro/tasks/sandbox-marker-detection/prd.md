# PRD: detect the AGRO sandbox without /.dockerenv (C10a)

Status: DRAFT

Source: issue #1304 (C10a). The operator decided the direction on 2026-10-03. Issue #1320 (C10b) holds the image environment and the Hermes install.

## User Stories

### US-001: The image declares the sandbox marker

**Description:** As the AGRO image, I want an AGRO-owned marker file, so that the CLI detects the sandbox in container mode and VM mode.

**Acceptance Criteria:**

- [ ] The `final` stage of `.devcontainer/Dockerfile` creates the file `/etc/agro/sandbox`.
- [ ] A test reads `.devcontainer/Dockerfile` and proves that the `final` stage creates the path that `SANDBOX_MARKER_FILE` names.
- [ ] The test fails before the Dockerfile change.

### US-002: The CLI detects the sandbox from the marker

**Description:** As an operator, I want `agro` to read the AGRO marker, so that a VM with the AGRO image runs commands in place.

**Acceptance Criteria:**

- [ ] `SANDBOX_MARKER_FILE` in `.agro/cli/src/lib/execution/detect.ts` is `/etc/agro/sandbox`.
- [ ] `runningInsideSandbox()` returns true when the marker exists, with or without `/.dockerenv` and with or without `SANDBOX_NAME`.
- [ ] `runningInsideSandbox()` returns true when `/.dockerenv` exists and `SANDBOX_NAME` holds a value, without the marker. This fallback covers a newer CLI in the home volume of an older image.
- [ ] `runningInsideSandbox()` returns false when the marker is absent and `/.dockerenv` exists without `SANDBOX_NAME`.
- [ ] When detection succeeds only through the fallback, the CLI prints one warning line on stderr. The line names `/etc/agro/sandbox` and tells the operator to upgrade the image.
- [ ] When the marker exists, the CLI prints no fallback warning.
- [ ] `AGRO_EXECUTION_TARGET=local` and `AGRO_EXECUTION_TARGET=docker-compose` keep their override meaning.
- [ ] A test proves that `configuredContainerName()` returns the `name` field of `agro.json` when `SANDBOX_NAME` is unset.
- [ ] `docs/lifecycle-commands.md` states the new detection rule and the fallback.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/local-target.test.ts` passes. Each new case fails before the change.

### US-003: Manual review in container mode

**Description:** As the operator, I want a transcript that shows the detection in this sandbox, so that I confirm the change without VM spend.

**Acceptance Criteria:**

- [ ] `agro sandbox list` shows no entry named `zz-detect-probe`.
- [ ] Inside the sandbox, `node .agro/cli/dist/agro.js sandbox upgrade zz-detect-probe --version 0.16.2` from the branch build prints `agro sandbox upgrade: host-only — run this command on the host` and exits 1.
- [ ] With `AGRO_EXECUTION_TARGET=docker-compose`, the same command prints `agro sandbox upgrade: no sandbox entry named "zz-detect-probe"` and exits 1. The command writes no file under `$AGRO_HOME/sandboxes/`.
- [ ] The transcript states that this sandbox has no marker, so the run proves the fallback path. The unit tests prove the marker path.
- [ ] The transcript is in `.agro/tasks/sandbox-marker-detection/evidence/manual-review.md`.

## Summary

Verified current state:

- `runningInsideSandbox()` (`.agro/cli/src/lib/execution/detect.ts:9-16`) returns true when `/.dockerenv` exists and `SANDBOX_NAME` holds a value. `AGRO_EXECUTION_TARGET` overrides the check.
- Six callers use the check: `commands/harness.ts:667`, `commands/langfuse.ts:173`, `commands/lifecycle.ts:193`, `commands/tool.ts:585`, `lib/execution/index.ts:18`, and `services/sandbox-upgrade.ts:43`.
- A CLI in the home volume can run ahead of the image CLI. `.agro/install/path-env.sh` puts `~/.local/bin` ahead of `/usr/local/bin` on `PATH`, and the home volume survives `agro sandbox upgrade`.
- `SANDBOX_NAME` comes from Compose (`.devcontainer/docker-compose.yml:17`). `configuredContainerName()` (`commands/lifecycle.ts:228-230`) already falls back to the `name` field of `agro.json`.
- `.agro/cli/src/__tests__/local-target.test.ts:39-62` covers the current detection rule.
- `docs/lifecycle-commands.md:176-178` documents the `/.dockerenv` rule.
- The `final` stage of `.devcontainer/Dockerfile` starts at line 130.

Approach: the image writes `/etc/agro/sandbox`. The CLI treats the marker as the primary signal. The old rule stays as a fallback, because the home volume keeps `~/.local/bin/agro` across image upgrades, and a newer CLI can run on an older image.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `final` stage | Writes the marker |
| `.agro/cli/src/lib/execution/detect.ts` | `SANDBOX_MARKER_FILE`, `runningInsideSandbox` | Detection |
| `.agro/cli/src/lib/execution/index.ts` | export of `SANDBOX_MARKER_FILE` | Public symbol |
| `.agro/cli/src/commands/lifecycle.ts` | `configuredContainerName` | Name fallback, unchanged |
| `.agro/cli/src/services/sandbox-upgrade.ts` | detection check at line 43 | Sixth caller, unchanged; the manual review probe |
| `.agro/cli/src/__tests__/local-target.test.ts` | `describe("runningInsideSandbox")` | Detection tests |
| `docs/lifecycle-commands.md` | detection paragraph | Public documentation |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/etc/agro/sandbox` in the image | New | Empty marker file that the image owns |
| `SANDBOX_MARKER_FILE` | Changed | Value `/etc/agro/sandbox` |
| `runningInsideSandbox()` | Changed | Marker first, old rule as fallback |
| stderr of any command that detects the sandbox through the fallback | New | One warning line that names `/etc/agro/sandbox` |

## Storage

N/A. The marker is an empty file in the image. The change keeps no state.

## Architectural Decisions

- Issue #1304 holds the decision. No ADR applies.
- The image owns its identity. The CLI reads the image marker and does not infer the sandbox from a Docker artifact.
- The fallback stays until a measurable condition holds: the first image with the marker is the minimum supported image. The removal comes no earlier than the next minor release after the marker ships. A follow-up issue tracks the removal. The council of 2026-10-03 chose this option over a fixed release.
- The fallback warning makes each dependence on the old rule visible.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/local-target.test.ts` | marker present, no `/.dockerenv`, no `SANDBOX_NAME`: true | US-002 |
| same | marker absent, `/.dockerenv` and `SANDBOX_NAME`: true | US-002 fallback |
| same | marker absent, `/.dockerenv`, no `SANDBOX_NAME`: false | US-002 |
| same | both overrides | US-002 |
| same | fallback path prints the warning; marker path prints none | US-002 |
| `<test file for configuredContainerName>` | `SANDBOX_NAME` unset: returns `agro.json` `name` | US-002 |
| `.agro/scripts/__tests__/<dockerfile marker test>.test.ts` | `final` stage creates `SANDBOX_MARKER_FILE` | US-001 |

## Design Principles

- No explanatory comments in tracked code (root `AGENTS.md`, rule 5).
- Change the canonical source: `detect.ts` and the Dockerfile.
- Keep container mode unchanged.

## Out of Scope

- The image environment and the Hermes install (#1320).
- A live image-mode run on exe.dev. #1320 holds that run, because the run needs a published candidate image.
- `.agro/skills/health-check/scripts/scope-preflight.sh`. The script detects a generic container for the Docker socket check, not the AGRO sandbox.
- agro-console create-to-connect work.

## Open Questions

None. The operator approved the council answers on 2026-10-03.

## Acceptance Criteria

- [ ] Every story has `passes: true` in `prd.json`.
- [ ] `pnpm run typecheck`, `pnpm test`, and `pnpm run build` exit 0.
- [ ] The CI boot guard passes on the PR.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry for the change.
- [ ] A follow-up issue tracks the fallback removal and names the removal condition.
- [ ] Draft PR opened: `FROM task/1304-sandbox-marker-detection TO development`.

## Lessons

1. Claim: the plan listed five callers of `runningInsideSandbox()`, and a sixth exists in `services/sandbox-upgrade.ts:43`. Evidence: two council members found the caller independently. Outcome: fixed in this PR; the plan names six callers and US-003 uses that caller as the probe.
2. Claim: a CLI in the home volume can run ahead of the image CLI, because `~/.local/bin` precedes `/usr/local/bin` on `PATH`. Evidence: `.agro/install/path-env.sh` and the live `PATH` in this sandbox. Outcome: fixed in this PR; the old rule stays as a warned fallback, and issue #1322 tracks its removal.
3. Claim: the fallback warning fires on every command in a sandbox without the marker. The warning also fires on commands without a detection check. Evidence: the command `agro sandbox list` prints the warning in this sandbox. Outcome: dropped. The warning stops when the image carries the marker. The warning makes the old-rule dependence visible on purpose.
