# PRD: remote-sandbox skill in mifunedev/agro

Status: DRAFT

Source decision: ADR #1314, migration step 1. The operator accepted the ADR on 2026-10-03.

## User Stories

### US-001: Lifecycle driver and adapter contract

**Description:** As an operator, I want one provider-generic VM lifecycle driver, so that every provider shares one copy of the lifecycle code. The driver creates a VM, runs a check detached, polls the check log, and destroys the VM.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/scripts/lib.sh` holds `wait_shell`, `upload`, `run_detached`, `poll_log`, `driver_rows`, and `finish`, ported from `skills/agro-host-matrix/scripts/lib.sh` in mifunedev/skills. The file holds no `vercel_*`, `exedev_*`, or `console_*` function.
- [ ] `lib.sh` loads `adapters/*.sh` from the skill directory first. Then `lib.sh` loads `*.sh` from each directory in the colon-separated `REMOTE_SANDBOX_ADAPTERS`.
- [ ] `run.sh <provider> --preflight` exits 2 with a usage line when no loaded adapter defines all five required functions: `<p>_preflight`, `<p>_create`, `<p>_exec`, `<p>_destroy`, and `<p>_list`.
- [ ] `driver_rows` calls `<p>_row_ssh`, `<p>_row_https`, and `<p>_restart` only when the adapter defines them. For each missing row hook, `driver_rows` prints `RESULT <row> SKIPPED no adapter hook`. `driver_rows` holds no `case` on `$PROVIDER`.
- [ ] When the operator names no check, `run.sh <provider>` runs `checks/fresh-install.sh`.
- [ ] `run.sh` forwards `INSTALL_URL`, `AGRO_JS_URL`, and `SANDBOX_IMAGE` to the check. `run.sh` does not read `GET_AGRO_URL`.
- [ ] The driver ignores SIGHUP. On exit, SIGINT, or SIGTERM, `finish` destroys the VM unless `KEEP=1`, and the log ends with `remaining … : <n>` and `RUN DONE`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/remote-sandbox.test.ts` passes. Each US-001 case fails before the implementation exists.

### US-002: exe.dev and Vercel adapters

**Description:** As an operator, I want `exedev` and `vercel` adapters that implement the contract, so that the driver has no provider branch.

**Acceptance Criteria:**

- [ ] `adapters/exedev.sh` defines the five required functions, `exedev_restart`, `exedev_row_ssh`, and `exedev_row_https`. The row hooks print the `R10-ssh-inbound` and `R11-https-port` lines that `driver_rows` prints today for `exedev`.
- [ ] `adapters/vercel.sh` defines the five required functions and `vercel_row_ssh`. `vercel_row_ssh` prints `RESULT R10-ssh-inbound FAIL API exec only, no standard SSH endpoint`. `adapters/vercel.sh` defines no `vercel_row_https`, so `driver_rows` prints `RESULT R11-https-port SKIPPED no adapter hook`.
- [ ] No adapter writes a secret into a VM. `bash -n` passes on both adapters.
- [ ] The test file proves that both adapters define the five required functions after `lib.sh` loads them.

### US-003: AGRO expectation suite

**Description:** As an operator, I want the fresh-install and matrix checks in the skill, so that one command tests AGRO on a new VM.

**Acceptance Criteria:**

- [ ] `checks/fresh-install.sh` installs from `INSTALL_URL`. The default is `https://github.com/mifunedev/agro/releases/latest/download/install.sh`.
- [ ] `checks/fresh-install.sh` prints one `RESULT` line for each of `F1-new-login-shell`, `F2-new-interactive-shell`, `F3-absolute-path`, and `F4-empty-environment`, with the commands from the scratch script `fresh-install.sh`. The last line is `SUMMARY`.
- [ ] `checks/agro-rows.sh` and `checks/cg-probe.sh` keep the row IDs `R01` to `R14` and `R02b` and the line format `RESULT <id> <status> <detail>` of `rows.sh` and `cg-probe.sh`.
- [ ] `scripts/restart-test.sh` calls `<p>_restart` through the contract and exits 2 when the adapter defines no `<p>_restart`.
- [ ] A test runs `checks/fresh-install.sh` locally with `INSTALL_URL` set to a `file://` fixture installer that writes a stub `agro` to `$HOME/.local/bin`. The test expects four `PASS` lines and a final `SUMMARY` line.

### US-004: SKILL.md and references

**Description:** As an agent, I want a `SKILL.md` that defines the term and documents the contract, so that I add an adapter without reading the scripts.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/SKILL.md` has frontmatter with `name: remote-sandbox`, a `description` with `TRIGGER when:`, and `metadata.mifune.category: agro`.
- [ ] The first body paragraph states: a remote sandbox is a provider VM, and the AGRO sandbox runs inside the VM.
- [ ] `SKILL.md` names the fresh install as the main scenario and the matrix as the second scenario. `SKILL.md` documents the five required functions, the three hooks, `REMOTE_SANDBOX_ADAPTERS`, and `INSTALL_URL`.
- [ ] `SKILL.md` states that each run needs operator approval for VM spend, and that tmux is optional for the driver.
- [ ] `references/rationale.md` holds the AGRO check rationale only. `references/providers.md` covers `exedev` and `vercel` only.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/remote-sandbox/SKILL.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` prints `Providers OK`.

### US-005: Portability exceptions

**Description:** As the registry maintainer, I want exceptions for the in-VM AGRO paths, so that the published copy passes the portability gate.

**Acceptance Criteria:**

- [ ] `.agro/scripts/registry-portability.md` holds one `ALLOW | AGRO-PATH | skills/remote-sandbox/<file> | <hash> | <reason>` entry for each in-VM AGRO path in the skill.
- [ ] A local registry checkout with a portable copy of `remote-sandbox` at `skills/remote-sandbox/` gives `neither: 0` for the files under `skills/remote-sandbox/`.
- [ ] The PR body states the merge order: the mifunedev/skills PR that publishes `remote-sandbox` (ADR step 2) merges first.

### US-007: Driver rows only after the matrix check

**Description:** As an operator, I want the driver rows to run only after `checks/agro-rows.sh`, so that a fresh-install log holds only fresh-install results.

**Acceptance Criteria:**

- [ ] `run.sh` calls `driver_rows` only when the check is `checks/agro-rows.sh`.
- [ ] A run of any other check prints no `R09-disconnect`, `R10-ssh-inbound`, or `R11-https-port` line.
- [ ] A run of `checks/agro-rows.sh` still prints the `R09`, `R10`, and `R11` lines.
- [ ] `SKILL.md` states that the driver rows run only after `checks/agro-rows.sh`, at the `scripts/run.sh` row and at the driver-rows paragraph.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/remote-sandbox.test.ts` passes, and the new case fails before the change.

### US-006: Manual review on exe.dev

**Description:** As the operator, I want one live exe.dev run of each scenario, so that I compare the new driver with the 2026-10-03 baseline.

**Acceptance Criteria:**

- [ ] US-007 passes before the run.
- [ ] The operator approves the VM spend before the run.
- [ ] `run.sh exedev` against v0.16.2 prints `PASS` for F1 to F4.
- [ ] `run.sh exedev checks/agro-rows.sh` matches the 2026-10-03 baseline row for row, `R14` included.
- [ ] Each log ends with `remaining … : 0` and `RUN DONE`.
- [ ] The transcript is in `.agro/tasks/remote-sandbox-skill/evidence/manual-review.md`.

## Summary

ADR #1314 splits `agro-host-matrix`. This task builds the agro half: `.agro/skills/remote-sandbox/`.

Verified current state:

- The source skill is `skills/agro-host-matrix/` in mifunedev/skills. The skill has 701 lines across `SKILL.md`, two references, and six scripts.
- `scripts/lib.sh` mixes the lifecycle (`wait_shell`, `upload`, `run_detached`, `poll_log`, `finish`), three adapters (`vercel_*`, `exedev_*`, `console_*`), and a `case "$PROVIDER"` in `driver_rows`.
- `scripts/run.sh` accepts only `vercel`, `exedev`, and `console`. `run.sh` forwards `GET_AGRO_URL`, `AGRO_JS_URL`, and `SANDBOX_IMAGE`.
- The fresh-install check exists only as the scratch script `fresh-install.sh`. The script defaults to `https://agro.mifune.dev/get-agro.sh`.
- `.agro/manifest.json` ships `skills/**`, so the new skill ships with AGRO.
- Five exceptions in `.agro/scripts/registry-portability.md` (lines 261 to 265) cover `agro-host-matrix`.
- Vitest tests in `.agro/scripts/__tests__/` cover skill scripts. `pnpm test` runs `vitest run`.

Approach: port the lifecycle into `lib.sh`, move each adapter into `adapters/<provider>.sh`, replace the `case` with hooks, and add `checks/fresh-install.sh` as the default check. A fake adapter in a fixture directory proves the contract without a VM.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/remote-sandbox/scripts/lib.sh` | `px`, `wait_shell`, `upload`, `run_detached`, `poll_log`, `driver_rows`, `finish`, adapter loader | Lifecycle and contract |
| `.agro/skills/remote-sandbox/scripts/run.sh` | provider check, default check, variable forwarding, traps | Entry point |
| `.agro/skills/remote-sandbox/scripts/restart-test.sh` | `<p>_restart` | Restart scenario |
| `.agro/skills/remote-sandbox/adapters/exedev.sh` | `exedev_*` | Built-in adapter |
| `.agro/skills/remote-sandbox/adapters/vercel.sh` | `vercel_*` | Built-in adapter |
| `.agro/skills/remote-sandbox/checks/fresh-install.sh` | `F1` to `F4` | Main scenario |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | `R01` to `R14`, `R02b` | Matrix scenario |
| `.agro/skills/remote-sandbox/checks/cg-probe.sh` | `PROBE-END` | cgroup probe |
| `.agro/scripts/registry-portability.md` | exception table | Portability gate |
| `skills/agro-host-matrix/` in mifunedev/skills | all files | Source, read only |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `run.sh <provider> [<check>\|--preflight]` | New | The check argument is optional. The default is `checks/fresh-install.sh`. |
| `REMOTE_SANDBOX_ADAPTERS` | New | Colon-separated list of extra adapter directories. |
| `INSTALL_URL` | New | Installer under test. Replaces `GET_AGRO_URL`. |
| `AGRO_JS_URL`, `SANDBOX_IMAGE`, `IMAGE`, `KEEP` | Unchanged | Same meaning as in `agro-host-matrix`. |
| `RESULT <id> <status> <detail>` | Unchanged | Line format for every check and hook. |

## Storage

N/A. The skill keeps no state. Each run writes one log file under the output directory and per-run files under the state directory, as `agro-host-matrix` does today.

## Architectural Decisions

- ADR #1314 is the source of truth for the boundaries and the contract.
- The canonical copy is `.agro/skills/remote-sandbox/`. The registry copy is a publish target (ADR step 2).
- The console adapter stays out of this repository. agro-console supplies the adapter through `REMOTE_SANDBOX_ADAPTERS` (ADR step 3).
- The exception entries stale-check against the registry. The registry PR (ADR step 2) merges before this PR, so the gate never reports stale entries on `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/remote-sandbox.test.ts` | loader reads `adapters/` and each `REMOTE_SANDBOX_ADAPTERS` directory | US-001 discovery |
| same | `run.sh fake --preflight` exits 2 when the fake adapter lacks `<p>_list` | US-001 contract |
| same | fake adapter run: `RESULT R10-ssh-inbound SKIPPED no adapter hook`, then `remaining … : 0` and `RUN DONE` | US-001 hooks and cleanup |
| same | SIGTERM to the driver: the fake `<p>_destroy` runs once | US-001 cleanup |
| same | `INSTALL_URL` reaches the check; `GET_AGRO_URL` does not | US-001 forwarding |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | `exedev` and `vercel` define the five required functions | US-002 |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | `checks/fresh-install.sh` with a `file://` fixture installer prints four `PASS` lines and `SUMMARY` | US-003 |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | `restart-test.sh` exits 2 with an adapter that lacks `<p>_restart` | US-003 |
| `.agro/scripts/__tests__/remote-sandbox.test.ts` | fake adapter run of a check other than `checks/agro-rows.sh` prints no `R09`, `R10`, or `R11` line | US-007 |

## Design Principles

- No explanatory comments in tracked code (root `AGENTS.md`, rule 5).
- Keep the contract small: five required functions and three hooks.
- Keep row IDs and the `RESULT` format stable, so the 2026-10 baseline stays comparable.
- No secret enters a provider VM. Each live run needs operator approval.
- Prose follows `/ste`.

## Out of Scope

- Publishing to mifunedev/skills and retiring `agro-host-matrix` (ADR step 2).
- The console adapter and the benchmark material in agro-console (ADR step 3).
- Deleting the `agro-host-matrix` exceptions (ADR step 4).
- A live Vercel run. The ADR validation names exe.dev only. The Vercel adapter gets static checks.
- Scheduled runs and CI runs.

## Open Questions

None. The operator approved the plan on 2026-10-03 with the recommended answer to question 1: the variables keep the names `MATRIX_OUT` and `MATRIX_TAG`.

## Acceptance Criteria

- [ ] Every story has `passes: true` in `prd.json`.
- [ ] `pnpm run typecheck`, `pnpm test`, and `pnpm run build` exit 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` prints `Providers OK`.
- [ ] `git diff --check` exits 0, and `bash -n` passes on every script in `.agro/skills/remote-sandbox/`.
- [ ] Draft PR opened: `FROM <prefix>/<issue#>-remote-sandbox-skill TO development`.

## Lessons

1. Claim: the driver ran `R09` to `R11` after every check, so a fresh-install log could show a false `R09` result. Evidence: the US-004 worker read `run.sh`, and the US-007 test failed on the old `run.sh`. Outcome: fixed in this PR (US-007).
2. Claim: a run with `KEEP=1` never logs `RUN DONE`. Evidence: `finish` in `scripts/lib.sh` returns before the `remaining` line. Outcome: issue #1317.
3. Claim: `summarize.sh` skips fresh-install and cgroup-probe logs. Evidence: the script globs only `*-rows-*.log` and `*-restart-*.log`. Outcome: issue #1318.
4. Claim: `Closes #N` in a PR into `development` did not close the issue at merge time. Evidence: #1305 and #1309 showed `OPEN` right after the merges of #1306 and #1311. Outcome: issue #1319.
5. Claim: the portability exceptions for `agro-host-matrix` go stale when mifunedev/skills#14 retires the skill. Evidence: the gate against the #14 branch reported `stale exceptions: 5`. Outcome: fixed in this PR; ADR #1314 step 4 folded in.
