# PRD: Hermes host install sets HERMES_HOME

Status: DRAFT

## User Stories

### US-001: Pass HERMES_HOME to the Hermes link step

**Description:** As an operator on a bare node host, I want `agro harness install hermes --host` to set `HERMES_HOME` for the link step. Then the install succeeds without a manual export.

**Acceptance Criteria:**

- [ ] `reconcileHermes()` in `.agro/cli/src/commands/harness.ts` passes `HERMES_HOME` with the value `<root>/.hermes` in the `env` of each `link-providers.sh --init --hermes-only` call.
- [ ] `reconcileHermes()` and the installer call read `HERMES_HOME` from one shared value. The file holds no second `${root}/.hermes` literal for the same root.
- [ ] A new case in `.agro/cli/src/__tests__/hermes-integration.test.ts` drives the host install path with no `HERMES_HOME` in the parent env. The case asserts that each `--hermes-only` call receives `HERMES_HOME` equal to `<root>/.hermes`.
- [ ] The new case fails on the current `development` branch before the change, and the case passes after the change.
- [ ] The existing sandbox-path cases in `hermes-integration.test.ts` pass with no edit to their assertions.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/hermes-integration.test.ts` exits 0.

### US-002: Report a Hermes link failure one time with a Hermes remediation

**Description:** As an operator, I want a failed `--hermes-only` run to print each error one time. I also want a Hermes-specific remediation that points at the real fix.

**Acceptance Criteria:**

- [ ] With `--init --hermes-only` and `HERMES_HOME` unset, `link-providers.sh` prints the line `ERROR: HERMES_HOME is unset; ...` exactly one time.
- [ ] With `--hermes-only`, a failure prints no `Remediation: bash .agro/scripts/link-providers.sh --init` line.
- [ ] With `--hermes-only`, a failure prints a remediation line that names `HERMES_HOME` and the command `agro harness install hermes`.
- [ ] Without `--hermes-only`, a failure prints the current `print_state` block with no change.
- [ ] `.agro/scripts/__tests__/hermes-links.test.ts` asserts the single `ERROR` line and the Hermes remediation line in the case "refuses an unset launch home before creating integration".
- [ ] `pnpm vitest run .agro/scripts/__tests__/hermes-links.test.ts` exits 0.

### US-003: Add a host-mode Hermes row to the remote-sandbox matrix

**Description:** As the advisor, I want a matrix row that runs the node-host failure path on a fresh VM. Then a remote run proves the fix before the PR leaves draft.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/checks/agro-rows.sh` holds a new row `R15-hermes-host-install` that runs only when `MODE=host`.
- [ ] The row runs after `R05` creates the workspace. The row stops the sandbox with `agro stop "$SBX"` before the install.
- [ ] The row runs `agro harness install hermes --host` as the VM user with `HERMES_HOME` unset.
- [ ] The row prints `RESULT R15-hermes-host-install PASS` when the install exits 0 and the output holds `Hermes OK: .hermes/skills/agro -> .agro/skills`. In any other case the row prints `FAIL` with the last 2 lines of the install log.
- [ ] After the row, the check starts the sandbox again with the `agro` lifecycle verb, so that the later rows `R14` and `R11` see the same state as before.
- [ ] `.agro/skills/remote-sandbox/SKILL.md` lists `R15` in the row range of the hosting matrix.
- [ ] `bash -n .agro/skills/remote-sandbox/checks/agro-rows.sh` exits 0.

### US-004: Document the host install and prepare the release entry

**Description:** As an operator, I want the Hermes documentation and the changelog to describe the host fix. Then the next AGRO release ships the fix with release notes.

**Acceptance Criteria:**

- [ ] `docs/harnesses/hermes.md` states that a host install sets `HERMES_HOME` to `<workspace>/.hermes` for the install and the link step.
- [ ] `.agro/skills/remote-sandbox/references/rationale.md` marks the `HERMES_HOME is unset` part of `C10` as fixed and names this task. The `/.dockerenv` detection part keeps its current status.
- [ ] `CHANGELOG.md` holds one entry for the fix in the `## [Unreleased]` section.

### US-005: Validate the branch build with remote-sandbox

**Description:** As the advisor, I want a remote-sandbox run against the task branch build before the final PR. Then the PR holds remote evidence for the node-host path.

**Acceptance Criteria:**

- [ ] The story depends on US-001, US-002, US-003, and US-004.
- [ ] The operator approves the billable exe.dev run before the run starts.
- [ ] The advisor builds `.agro/cli/dist/agro.js` from the pushed task branch with `npm --prefix .agro/cli run build`.
- [ ] The advisor runs `gh release create validate-hermes-host-install-home --repo mifunedev/agro --prerelease --target <task branch> --title "hermes-host-install-home validation" --notes "Temporary branch build for remote-sandbox validation." .agro/cli/dist/agro.js .agro/scripts/install.sh`.
- [ ] `gh release view --repo mifunedev/agro --json tagName -q .tagName` still prints the current stable tag, so that the prerelease does not become `latest`.
- [ ] The advisor runs `INSTALL_URL=https://github.com/mifunedev/agro/releases/download/validate-hermes-host-install-home/install.sh AGRO_JS_URL=https://github.com/mifunedev/agro/releases/download/validate-hermes-host-install-home/agro.js bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/agro-rows.sh` in a named tmux session.
- [ ] The run log names the branch build on the `build under test:` line.
- [ ] The run log holds `RESULT R15-hermes-host-install PASS` and `RESULT R14-hermes-install PASS`.
- [ ] The run log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.
- [ ] `.agro/tasks/hermes-host-install-home/evidence/manual-review.md` holds the command, the `build under test:` line, each `RESULT` line, the cleanup line, and the log path.
- [ ] The evidence file holds no secret, token, or `auth.json` content.
- [ ] After the run, the advisor runs `gh release delete validate-hermes-host-install-home --repo mifunedev/agro --cleanup-tag --yes`. `gh release view validate-hermes-host-install-home --repo mifunedev/agro` then exits 1.
- [ ] The advisor completes this story before the PR leaves draft.

## Summary

On a host with no running sandbox, `agro harness install hermes` takes the host path in `installOnHost()`. The operator log from a node host shows this failure:

```text
ERROR: HERMES_HOME is unset; recreate from the corrected image or export HERMES_HOME=/home/sandbox/.agro/workspaces/harness/.hermes in the launch environment before installing
ERROR: HERMES_HOME is unset; ...
Remediation: bash .agro/scripts/link-providers.sh --init
agro harness: Hermes integration failed (exit 1); no installation success reported.
```

Verified current state:

- `installOnHost()` computes `installEnv` with `HERMES_HOME: ${root}/.hermes` at `harness.ts:438-442`. Only the installer call and `probeInstalled()` receive `installEnv`.
- `reconcileHermes()` at `harness.ts:314-330` passes only `agroEnvPair("PROJECT_ROOT", root)`.
- `link-providers.sh` `hermes_paths_safe()` at line 208 fails when `--hermes-only` runs and `HERMES_HOME` is unset.
- Inside the sandbox, the `.devcontainer/Dockerfile` `ENV` sets `HERMES_HOME`. That `ENV` hides the defect on the sandbox path.
- On a node host, no process sets `HERMES_HOME`. The link step fails before the installer runs.
- In `--hermes-only` mode with `--init`, the script calls `init_hermes_link` and then `check_hermes_link`. Both call `hermes_paths_safe()`, so the same `ERROR` prints two times.
- On any failure, the script prints `print_state`. That block names the general provider remediation, which does not fix a Hermes failure.
- The matrix row `R14` in `agro-rows.sh` runs the install inside the sandbox through `in_sbx`. No row covers the host path.
- `run.sh` forwards `INSTALL_URL` and `AGRO_JS_URL` into the VM. `install.sh` reads `AGRO_JS_URL` at line 111.

Selected approach: compute the Hermes environment one time per target root, and pass that environment to `reconcileHermes()` and to the installer. In `link-providers.sh`, skip the Hermes check after a failed Hermes init, and print a Hermes-specific remediation in `--hermes-only` mode. Add a host-mode matrix row, and validate the branch build on exe.dev before the PR leaves draft.

Release path: the PR targets `development`. The operator runs `/release` for the next version, and the `## [Unreleased]` entry becomes the release notes.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/harness.ts` | `reconcileHermes()`, `hermesTargetRoot()` | Runs the `--hermes-only` link step. The fix adds `HERMES_HOME` here. |
| `.agro/cli/src/commands/harness.ts` | `installOnHost()` (`installEnv`, lines 438-486) | Host install path that fails today. |
| `.agro/cli/src/commands/harness.ts` | sandbox install path (`installEnv`, lines 682-720) | Sandbox path. Behavior stays the same. |
| `.agro/scripts/link-providers.sh` | `fail()`, `print_state()`, `hermes_paths_safe()`, `init_hermes_link()`, `check_hermes_link()`, `--hermes-only` dispatch (lines 376-390) | Emits the duplicated error and the general remediation. |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | `describe("Hermes installation postconditions")` | Holds the CLI cases for Hermes install. |
| `.agro/scripts/__tests__/hermes-links.test.ts` | "refuses an unset launch home before creating integration" | Holds the script cases for `--hermes-only`. |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | `MODE`, `in_sbx()`, row `R05`, row `R14` | Hosts the new row `R15-hermes-host-install`. |
| `.agro/skills/remote-sandbox/scripts/run.sh` | `INSTALL_URL`, `AGRO_JS_URL` forwarding | Runs the branch build on the VM. |
| `CHANGELOG.md` | `## [Unreleased]` | Source of the next release notes. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install hermes --host` | Behavior fix | The command succeeds on a host with `HERMES_HOME` unset. |
| `link-providers.sh --hermes-only` stderr | Output change | The script prints each error one time and prints a Hermes remediation. |
| remote-sandbox hosting matrix | New row | `R15-hermes-host-install` covers the node-host path. |
| `docs/harnesses/hermes.md` | Documentation | The page states the source of `HERMES_HOME` on a host install. |

## Storage

N/A. The change adds no persistent state. The host install continues to write `<workspace>/.hermes` and the existing host receipt.

## Architectural Decisions

- The CLI owns the `HERMES_HOME` value for each install target. The value is `<target root>/.hermes` on the host and in the sandbox.
- The `link-providers.sh` refusal for an unset `HERMES_HOME` stays. The refusal protects a manual `--hermes-only` run from a missing launch home.
- An operator export of `HERMES_HOME` that conflicts with `<root>/.hermes` still fails through the existing conflict check. The CLI value replaces the parent value only for the child process.
- Remote validation reuses `run.sh` and `agro-rows.sh`. The task adds one row and no new check script.
- The branch build ships as the temporary GitHub prerelease `validate-hermes-host-install-home`. `release.yml` runs only on a push to `main`, `master`, or `experiment/**`, so the prerelease starts no release workflow. The advisor deletes the prerelease and its tag after the run.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | Host install with `HERMES_HOME` unset passes `HERMES_HOME=<root>/.hermes` to each `--hermes-only` call | US-001 fix |
| `.agro/cli/src/__tests__/hermes-integration.test.ts` | Existing sandbox cases | No sandbox regression |
| `.agro/scripts/__tests__/hermes-links.test.ts` | Unset `HERMES_HOME` prints one `ERROR` line and a Hermes remediation | US-002 output |
| `.agro/scripts/__tests__/hermes-links.test.ts` | Existing cases | No link regression |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` on exe.dev | `R15-hermes-host-install`, `R14-hermes-install` | US-005 end-to-end proof on the branch build |

Write each new unit case first. Each new unit case must fail before the change.

## Design Principles

- Keep one source of truth for the Hermes home value per target.
- Make the smallest change that fixes the host path. Do not add new detection machinery.
- Do not add explanatory comments to tracked code.
- An error message names the real remediation.
- Prove the fix on a fresh VM from the branch build before the PR leaves draft.

## Out of Scope

- Sandbox detection on an image booted as a VM. That part of `C10` concerns `/.dockerenv` and `/etc/agro/sandbox`, and a separate task owns it.
- Hermes entries in the agro-console node setup guide at `projects/mifunedev/agro-console/apps/web/components/node-setup-guide.tsx`.
- Changes to the Hermes installer or the Hermes package manager.
- The release run itself. The operator runs `/release` after the merge.

## Open Questions

1. Does the host workspace on the VM come from the task branch? `link-providers.sh` runs from the workspace, so US-002 needs the branch copy. The answer depends on the source that `agro sandbox install docker` uses for `<workspace>`.
2. Does the agro-console node setup guide need a Hermes install row? This plan does not change the console.

## Acceptance Criteria

- [ ] `pnpm vitest run .agro/cli/src/__tests__/hermes-integration.test.ts .agro/scripts/__tests__/hermes-links.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] The exe.dev run in US-005 reports `R15-hermes-host-install PASS` on the branch build before the PR leaves draft.
- [ ] The PR targets `development`, and CI on the PR is green.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds the fix entry at merge time, so that the next release notes include the fix.

## Lessons

1. Claim: a remote-sandbox run on a branch build tests only the CLI bundle. Evidence: the VM workspace comes from the released image seed in `/opt/agro-seed`, so the run used the released `link-providers.sh`. Outcome: issue #1327.
2. Claim: the VM-boot part of `C10` stays open after this task. Evidence: the image `ENV` is missing when the AGRO image boots as a VM. Outcome: issue #1320.
3. Claim: the agro-console node setup guide lists no Hermes install command. Evidence: `apps/web/components/node-setup-guide.tsx` lists only `claude-code` and `pi`. Outcome: issue mifunedev/agro-console#273.
