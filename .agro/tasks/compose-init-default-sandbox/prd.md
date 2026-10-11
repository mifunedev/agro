# PRD: Compose init as the default sandbox PID 1

Status: DRAFT

## User Stories

### US-001: Add one main script with a readiness marker

**Description:** As an operator, I want one sandbox main script that runs the bootstrap once and records readiness. The sandbox then boots without systemd and stays up for recovery when the bootstrap fails.

**Acceptance Criteria:**

- [ ] `.devcontainer/sandbox-main.sh` exists. The script deletes the readiness file, runs `entrypoint.sh`, writes the readiness file when `entrypoint.sh` exits 0, prints a warning when `entrypoint.sh` exits non-zero, and then runs `exec sleep infinity`.
- [ ] The readiness file path is `${AGRO_READY_FILE:-/run/agro/bootstrap.ready}`. The entrypoint path is `${AGRO_ENTRYPOINT_BIN:-/usr/local/bin/entrypoint.sh}`. A failure to write the readiness file prints a warning and does not stop the script.
- [ ] `.devcontainer/openshell-main.sh` sources `/etc/profile.d/agro-image-env.sh` and then runs `exec /usr/local/bin/sandbox-main.sh`. `OPENSHELL_MAIN` in `openshell-target.ts` stays `/usr/local/bin/openshell-main.sh`.
- [ ] `.devcontainer/Dockerfile` copies `sandbox-main.sh` to `/usr/local/bin/` with mode `0755`. The image keeps `CMD ["/sbin/init"]`, `ENTRYPOINT []`, `STOPSIGNAL SIGRTMIN+3`, `agro-bootstrap.service`, and the env generator.
- [ ] A new test `.agro/scripts/__tests__/sandbox-main.test.ts` runs the script with a stub entrypoint and a stub `sleep`, and proves three cases: success writes the readiness file, failure leaves no readiness file and prints the warning, and a stale readiness file is deleted before the stub entrypoint runs.
- [ ] `openshell-runtime-contract.test.ts` passes with the new `openshell-main.sh`.

### US-002: Make the healthcheck aware of the PID 1 type

**Description:** As an operator, I want the healthcheck to judge readiness from the readiness file when PID 1 is not systemd. One healthcheck then serves the Compose sandbox and VM image mode.

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-healthcheck.sh` reads the PID 1 command name from `${AGRO_PID1_COMM_FILE:-/proc/1/comm}`.
- [ ] When the PID 1 command name is `systemd`, the healthcheck keeps `require_unit agro-bootstrap.service`.
- [ ] When the PID 1 command name is not `systemd`, the healthcheck requires the readiness file `${AGRO_READY_FILE:-/run/agro/bootstrap.ready}` and records `bootstrap not ready: <path>` when the file is missing. The healthcheck does not call `systemctl` in this case.
- [ ] `sandbox-healthcheck.test.ts` covers four cases: systemd with an active unit passes, systemd with an inactive unit fails, `docker-init` with the readiness file passes, and `docker-init` without the readiness file fails.

### US-003: Switch both Compose base files to Compose init

**Description:** As an operator, I want the default sandbox to run without `SYS_ADMIN`, unconfined AppArmor, or a private cgroup. The sandbox then uses the Docker default privilege set.

**Acceptance Criteria:**

- [ ] `.devcontainer/docker-compose.yml` and `.devcontainer/docker-compose.image-only.yml` set `init: true`, `entrypoint: ["/usr/local/bin/sandbox-main.sh"]`, and `stop_signal: SIGTERM`.
- [ ] Neither file contains `cgroup:`, `cap_add:`, `security_opt:`, or `tmpfs:`.
- [ ] `sandbox-privilege-boundary.test.ts` asserts, for every compose file: no `privileged: true`, no `devices:`, no host cgroup bind, no `cap_add:`, no `security_opt:`, and no `cgroup:`. For both base files, the test asserts `init: true`, the `sandbox-main.sh` entrypoint, and `stop_signal: SIGTERM`. The test keeps the Dockerfile assertions for `CMD ["/sbin/init"]` and `STOPSIGNAL SIGRTMIN+3`, and names them as the VM image mode contract.
- [ ] `bash .agro/scripts/docker-compose.sh config --quiet` exits 0 on the host checkout.
- [ ] Every test that reads the compose files passes.

### US-004: Make the boot, upgrade, and first-install checks aware of the PID 1 type

**Description:** As a maintainer, I want the CI smokes, the boot banner, and the remote-sandbox rows to accept Compose init. CI then proves the new default, and VM image mode keeps its systemd checks.

**Acceptance Criteria:**

- [ ] `sandbox-boot-smoke.sh` requires PID 1 `docker-init` and the readiness file inside the container. The success message names Compose init.
- [ ] `sandbox-upgrade-smoke.sh` waits for the readiness file instead of `agro-bootstrap.service`, and reads the bootstrap log with `docker logs` instead of `journalctl`.
- [ ] `cli-first-install-smoke.sh` `verify_systemd` becomes a PID 1 check that requires `docker-init` and the readiness file. The function name states the new check.
- [ ] `.agro/install/banner.sh` prints `systemctl status agro-bootstrap.service` only when PID 1 is systemd. Otherwise the banner prints `agro logs` as the recovery command for the host.
- [ ] In `.agro/skills/remote-sandbox/checks/agro-rows.sh`, host mode R06 requires PID 1 `docker-init` and a passing healthcheck, and host mode R07 waits for a passing healthcheck. Image mode keeps the systemd checks. `references/rationale.md` describes both modes for R04, R06, and R07.
- [ ] `sandbox-boot-smoke.test.ts`, `sandbox-upgrade-smoke.test.ts`, `cli-first-install-smoke.test.ts`, and `boot-banner.test.ts` pass with fixtures for Compose init.
- [ ] The CI shellcheck command exits 0.

### US-005: Update the contract, the docs, and the changelog

**Description:** As an operator, I want `AGENTS.md`, the docs, and the changelog to describe Compose init so that the written contract matches the sandbox.

**Acceptance Criteria:**

- [ ] Root `AGENTS.md` non-negotiable 3 states that Compose init is PID 1 in the sandbox and runs the bootstrap once, and that the image keeps systemd for VM image mode. The file does not state that systemd is PID 1 in the sandbox.
- [ ] `docs/security-considerations.md` describes the default privilege posture: no added capability, the default AppArmor profile, and no private cgroup. The section states that VM image mode boots `/sbin/init`.
- [ ] `docs/deployment-prebuilt-image.md` describes the Compose boot through `sandbox-main.sh`. The `docker run` example uses `--init --entrypoint /usr/local/bin/sandbox-main.sh` and no systemd flags.
- [ ] `docs/runtimes/openshell.md` names `sandbox-main.sh` as the script that `openshell-main.sh` runs.
- [ ] `.agro/skills/t3/references/sandbox-processes.md` and `.agro/cli/src/cli.ts:216` do not state that systemd supervises the sandbox.
- [ ] `CHANGELOG.md` has one `**BREAKING:**` bullet under `### Changed` in `## [Unreleased]`. The bullet states that the Compose sandbox drops `SYS_ADMIN`, `apparmor=unconfined`, `cgroup: private`, and the tmpfs mounts, and runs Compose init. The bullet ends with `([#1393](https://github.com/mifunedev/agro/issues/1393))`.
- [ ] `npx vitest run .agro/cli/src/__tests__/docs-reference.test.ts` exits 0.

### US-006: Record manual review evidence

**Description:** As the advisor, I want a command transcript that proves the new default so that the PR `## Manual review` section has evidence.

**Acceptance Criteria:**

- [ ] `.agro/tasks/compose-init-default-sandbox/evidence/manual-review.md` holds each command in this list with its output and exit status:
  - `git grep -n -E 'SYS_ADMIN|apparmor=unconfined|cgroup: private' -- .devcontainer`
  - `npx vitest run`
  - `pnpm run typecheck`
  - the CI shellcheck command
  - `bash .agro/scripts/docker-compose.sh config --quiet`
- [ ] The first `git grep` prints no line.
- [ ] The transcript records the CI run of `sandbox-boot-guard.yml` on the PR head: the boot smoke, the legacy-volume upgrade smoke, and the CLI-first install smoke.
- [ ] The transcript states that no live sandbox was rebuilt and that the remote-sandbox VM image mode rows were not run.
- [ ] This story depends on US-001, US-002, US-003, US-004, and US-005.

## Summary

Issue #1393 holds the Architecture Brief and its correction. The operator selected the revised option C: Compose init is the default PID 1, and AGRO ships no systemd overlay.

Verified facts:

- The Compose base files grant `cgroup: private`, `SYS_ADMIN`, `apparmor=unconfined`, and tmpfs mounts only so that systemd can run as PID 1.
- systemd supervises one unit, `agro-bootstrap.service`, which runs `entrypoint.sh`.
- `docker-engine` and `desktop` install on the host only (`catalog.ts:280-406`). No tool, harness, or script needs systemd inside the Docker sandbox.
- The OpenShell gateway hint in `openshell-target.ts` is a host instruction. The OpenShell sandbox already runs `openshell-main.sh` without systemd.
- VM image mode boots the image `CMD` as PID 1 and needs systemd. The image `CMD` therefore stays `/sbin/init`.
- `openshell-main.sh` already implements the needed boot pattern: run `entrypoint.sh`, stay up on failure, and run `exec sleep infinity`.

The stories add the main script and the readiness marker first. The healthcheck learns both PID 1 types second. The Compose switch comes third, because the switch needs the main script and the healthcheck. The checks and the docs follow.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/sandbox-main.sh` | new script | Main process of the Compose sandbox and of OpenShell. |
| `.devcontainer/openshell-main.sh` | wrapper | Sources the image env, then runs `sandbox-main.sh`. |
| `.devcontainer/Dockerfile` | `COPY`, `CMD`, `STOPSIGNAL` | Installs the main script. Keeps the VM image mode contract. |
| `.devcontainer/docker-compose.yml`, `docker-compose.image-only.yml` | `init`, `entrypoint`, `stop_signal`, privilege keys | Select Compose init and drop the systemd privileges. |
| `.agro/scripts/sandbox-healthcheck.sh` | `require_unit`, readiness check | Judges readiness for both PID 1 types. |
| `.agro/scripts/sandbox-boot-smoke.sh` | `verify_systemd_supervision` | CI boot smoke. |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | readiness wait, `journalctl` read | CI upgrade smoke. |
| `.agro/scripts/cli-first-install-smoke.sh` | `verify_systemd` | CI first-install smoke. |
| `.agro/install/banner.sh` | recovery lines | Login banner. |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | R06, R07 | Remote VM matrix. |
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | privilege and init assertions | Guards the privilege boundary. |
| `.agro/cli/src/lib/execution/openshell-target.ts` | `OPENSHELL_MAIN` | Stays unchanged for pinned OpenShell images. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| Compose sandbox PID 1 | Changed | `docker-init` (tini) replaces `systemd`. |
| Compose sandbox privileges | Removed | `SYS_ADMIN`, `apparmor=unconfined`, `cgroup: private`, and the tmpfs mounts are gone. |
| Bootstrap log | Changed | The log goes to the container log (`agro logs`, `docker logs`) instead of the journal. |
| Readiness | Added | `/run/agro/bootstrap.ready` marks a finished bootstrap when PID 1 is not systemd. |
| Image `CMD` | Unchanged | VM image mode keeps `/sbin/init`. |

## Storage

The readiness file `/run/agro/bootstrap.ready` lives in the container filesystem. `sandbox-main.sh` deletes the file at each start, so a container restart cannot report a stale ready state. No volume, schema, or migration changes.

## Architectural Decisions

- The Compose files own the default boot. The image `CMD` owns VM image mode.
- One main script owns the boot pattern. `openshell-main.sh` keeps its path for pinned images and delegates to `sandbox-main.sh`.
- The healthcheck selects its readiness test from the PID 1 command name.
- AGRO ships no systemd overlay. An operator who needs systemd inside a container can add an overlay through the existing `composeOverrides` list.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-main.test.ts` | success, failure, stale marker | Main script contract. |
| `.agro/cli/src/__tests__/openshell-runtime-contract.test.ts` | env source before main | OpenShell wrapper keeps its contract. |
| `.agro/scripts/__tests__/sandbox-healthcheck.test.ts` | systemd and `docker-init` cases | Mode-aware readiness. |
| `.agro/scripts/__tests__/sandbox-privilege-boundary.test.ts` | no privilege keys, Compose init keys, VM image contract | Privilege boundary. |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | PID 1 `docker-init`, readiness file | Boot smoke. |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | readiness wait, `docker logs` | Upgrade smoke. |
| `.agro/scripts/__tests__/cli-first-install-smoke.test.ts` | PID 1 check | First-install smoke. |
| `.agro/scripts/__tests__/boot-banner.test.ts` | recovery line per PID 1 type | Banner. |

Run `npx vitest run`, `pnpm run typecheck`, the CI shellcheck command, and hadolint on `.devcontainer/Dockerfile`. CI `sandbox-boot-guard.yml` boots the new default.

## Design Principles

- Delete privileges that no consumer needs. Do not keep an overlay without a consumer.
- Keep one source of truth for the boot pattern.
- Keep the VM image mode contract unchanged.
- Add no explanatory comments to tracked code.

## Out of Scope

- A systemd overlay for the Compose sandbox.
- Removal of systemd, `agro-bootstrap.service`, or the env generator from the image.
- Changes to `docker-engine`, `desktop`, or the OpenShell gateway.
- The systemd `EnvironmentFile` parse in the Langfuse fragment and the matching sentence in `docs/integrations/langfuse.md`. No systemd unit reads that file since #1391. A separate issue owns that cleanup.
- A live sandbox rebuild and the remote-sandbox VM image mode rows.

## Open Questions

None.

## Acceptance Criteria
- [ ] `npx vitest run` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] The CI shellcheck command and hadolint exit 0.
- [ ] `git grep -n -E 'SYS_ADMIN|apparmor=unconfined|cgroup: private' -- .devcontainer` prints no line.
- [ ] CI on the PR is green, including `sandbox-boot-guard.yml`.

## Lessons

1. The first Architecture Brief and the issue body stated that `docker-engine` and `desktop` need systemd inside the sandbox. Both tools install on the host only. Evidence: `hostInstallArgv` and `notInstallableReason` in `.agro/cli/src/lib/tools/catalog.ts`, and `--host` in `docs/installation.md`. Outcome: fixed in this PR. The correction comment on #1393 records the fact, and the operator selected the plan without the overlay.
2. The Langfuse fragment still has a systemd `EnvironmentFile` parse, and `docs/integrations/langfuse.md` states that systemd reads the fragment. No systemd unit reads the fragment since #1391. Outcome: proposed issue "Remove the systemd EnvironmentFile consumer from the Langfuse fragment".
3. The remote-sandbox VM image mode rows R05 to R08 did not run. Image mode keeps the unchanged image `CMD ["/sbin/init"]`. Outcome: dropped as a lesson. The PR lists the run under "What remains unverified".
