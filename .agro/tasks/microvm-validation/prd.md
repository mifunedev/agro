# PRD: Hosting-substrate expectation matrix for AGRO and agro-console

Status: DRAFT

## User Stories

### US-001: Provider-agnostic probe driver

**Description:** As the advisor, I want one driver that runs any check script on any provider. Each new provider then costs one adapter and no new test logic.

**Acceptance Criteria:**

- [ ] `.agro/tasks/microvm-validation/run.sh <provider> <check-script>` exists and accepts `vercel` as the first provider.
- [ ] The `vercel` adapter implements the four operations `create`, `exec`, `fetch-log`, and `destroy`.
- [ ] The driver starts the check script detached inside the VM and polls the remote log with short `exec` calls. No single `exec` call runs longer than 2 minutes.
- [ ] The driver writes the log to `.agro/tasks/microvm-validation/evidence/<provider>-<check>-<timestamp>.log`.
- [ ] The driver removes the VM on success, on failure, and on `SIGHUP`. After each run, `vercel sandbox list --scope mifunedev` shows no sandbox with the tag `purpose=agro-matrix`.
- [ ] `bash run.sh vercel cg-probe.sh` reproduces the recorded Vercel result: `memory FAIL` and `io FAIL` with `Operation not supported`.

### US-002: Expectation rows as one check script

**Description:** As the advisor, I want each AGRO operation to be one row with one `RESULT` line so that every provider gets the same rows.

**Acceptance Criteria:**

- [ ] `.agro/tasks/microvm-validation/rows.sh` emits one line `RESULT <row-id> <PASS|FAIL|SKIPPED> <detail>` for each row in the matrix row table in `## Summary`.
- [ ] Each row runs when an earlier row fails. The script exits with the count of `FAIL` rows.
- [ ] Row `R13-time-to-shell` reads the timestamps that the driver passes in and reports seconds from the `create` request to the first successful `exec`.
- [ ] A Vercel run of `rows.sh` reports `PASS` for rows `R01` and `R02` and `FAIL` for row `R04`. This matches the Phase 1 evidence.

### US-003: exe.dev adapter and matrix run

**Description:** As the advisor, I want the matrix result for exe.dev so that the matrix covers the closest competitor to the node route.

**Acceptance Criteria:**

- [ ] The `exedev` adapter creates and removes a VM through `ssh exe.dev` with no interactive prompt.
- [ ] `bash run.sh exedev cg-probe.sh` writes a log that states whether `+memory +io` delegation succeeds.
- [ ] `bash run.sh exedev rows.sh` writes a log with one `RESULT` line for each row.
- [ ] A second run creates the VM from `--image ghcr.io/mifunedev/agro:<tag>` and records whether the image boots as a VM with systemd as PID 1.
- [ ] After each run, the exe.dev VM list holds no VM that the driver created.

### US-004: Docker Cloud Sandboxes probe

**Description:** As the advisor, I want the cgroup probe result for Docker Cloud Sandboxes. The matrix then holds one more ephemeral-sandbox column.

**Acceptance Criteria:**

- [ ] The matrix records `SKIPPED: operator decision` for boxd.
- [ ] Docker Cloud Sandboxes has an adapter, or the matrix records `SKIPPED: <reason>` for Docker Cloud Sandboxes.
- [ ] For each provider with an adapter, `bash run.sh <provider> cg-probe.sh` writes a log that states the delegation result and the systemd container state.
- [ ] For each provider whose probe passes, `bash run.sh <provider> rows.sh` writes a log with one `RESULT` line for each row.
- [ ] The spend for this story stays inside each provider's free credit. The evidence log records the credit balance before and after the run.

### US-005: agro-console node baseline

**Description:** As the operator, I want the matrix result and the time to shell for an agro-console `n4` node. The competitor numbers then have a baseline.

**Acceptance Criteria:**

- [ ] The evidence log records seconds from the console provision request to the first successful SSH command on the node.
- [ ] The evidence log records seconds from the provision request to a node where `agro workspace list` prints the workspace.
- [ ] `rows.sh` runs on the node and writes one `RESULT` line for each row.
- [ ] The operator destroys the node after the run. The console node list shows the node as destroyed.

### US-006: Matrix, positioning brief, and AGRO change register

**Description:** As the operator, I want one brief that joins the matrix, the prices, and the possible AGRO changes. I then choose the agro-console direction from evidence.

**Acceptance Criteria:**

- [ ] `.agro/tasks/microvm-validation/brief.md` holds the matrix with one column for each provider and one row for each row ID.
- [ ] Each `FAIL` cell carries one label: `provider-limit`, `agro-assumption`, or `both`.
- [ ] The brief lists the price per running hour for a 2 vCPU and 4 GB machine for each provider, with a source URL for each price.
- [ ] The brief lists each entry from the AGRO change register in `## Summary` with its current evidence and one status: `open`, `supported`, or `rejected`.
- [ ] An entry gets the status `supported` only when evidence from at least two providers supports the entry.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/microvm-validation/brief.md` exits 0.

### US-007: Manual review evidence

**Description:** As the advisor, I want one command transcript of a complete matrix run so that the review has evidence from real VMs.

**Acceptance Criteria:**

- [ ] `.agro/tasks/microvm-validation/evidence/manual-review.md` holds the commands and the outputs of one `run.sh` call for each provider with an adapter.
- [ ] The transcript shows the `destroy` output for each VM that the run created.
- [ ] The transcript shows that the operator approved each provider account and each spend before the run.

## Summary

The operator researches two questions together:

1. Which AGRO operations hold on which hosting substrate?
2. Which direction gives agro-console an edge in the market?

The agro-console README describes the current node model. Each node is a dedicated OVHcloud VM in host mode. Cloud-init installs the `agro` CLI, one workspace, and code-server. Docker and the sandbox container are absent by default. The `n4` spec has 2 vCPU, 4 GB, and costs $0.0450 for each running hour.

### Evidence from Phase 1 on Vercel Sandbox

The driver ran on the `mifunedev` Hobby team on 2026-09-30. The logs are in `.agro/tasks/microvm-validation/evidence/`.

- The VM runs Ubuntu 26.04.1 on kernel 6.18.49 with cgroup v2, Node v24.21.0, and git 2.53.0.
- Step 1 passed. Docker 29.8.2 and Compose v5.5.1 run with the `cgroupfs` driver.
- Step 2 passed. `get-agro.sh` installed agro 0.16.0. `agro workspace create` cloned the workspace into `~/.agro/workspaces/harness`.
- Step 3 failed. The `ghcr.io/mifunedev/agro:0.16.0` container restarted in a loop and reported `unhealthy` after 913 seconds.
- systemd as PID 1 exited with `Failed to create /init.scope control group: Structure needs cleaning`.
- The root cgroup starts as `domain`. A write of `+memory`, `+io`, or `+hugetlb` to `cgroup.subtree_control` fails with `os error 95`. A write of `+cpu`, `+cpuset`, or `+pids` succeeds.
- runc then puts the container cgroup in `threaded` mode. systemd cannot create domain cgroups in a threaded subtree.
- A plain `jrei/systemd-ubuntu:24.04` container fails in the same way. The failure is not specific to AGRO.
- The first run failed for a different cause. The CLI `exec` stream ended after about 6 minutes. The detached-run-and-poll design in US-001 removes that cause.

### Evidence from exe.dev

The probe ran on the operator's exe.dev trial on 2026-10-01. The log is in `evidence/exedev-image-*.log`.

- `ssh exe.dev new --image ghcr.io/mifunedev/agro:0.16.0` created a VM. The VM ran the image's systemd as PID 1 on kernel 6.12.93.
- The root `cgroup.subtree_control` holds `memory pids`.
- `agro-bootstrap` finished and `sandbox-healthcheck.sh` printed `sandbox healthcheck ok` about 25 seconds after the first journal entry.
- `systemd-modules-load.service` failed, so `systemctl is-system-running` reports `degraded`.
- After `ssh exe.dev restart`, ext4 ran recovery. Register entry `C8` records the result.
- The driver measured `create_return_s=1.5`, `first_shell_s=2.1`, and `healthy_s=25.2` for the AGRO image.
- A restart after `sync` passed. The sandbox was healthy again in 8.1 seconds, and all files kept their content.
- A restart 300 seconds after the sandbox became healthy passed. The sandbox was healthy again in 5.6 seconds.

### Two provider categories

- **Ephemeral execution sandboxes:** Vercel Sandbox, E2B, Daytona, Docker Cloud Sandboxes. These providers optimize for many short runs. They keep cgroup controllers, use a custom init, cap session time, and proxy egress.
- **Persistent VMs:** exe.dev, boxd, Fly.io Sprites, agro-console nodes. These providers give a full kernel, systemd, root, and a persistent disk.

### Matrix rows

| Row ID | AGRO operation |
|---|---|
| `R01-docker` | `dockerd` runs and `docker compose` is present |
| `R02-workspace` | `get-agro.sh` installs the CLI and `agro workspace create` clones the workspace |
| `R02b-noninteractive-cli` | `agro --version` succeeds in a non-interactive shell after `get-agro.sh` |
| `R03-docker-engine-host` | `agro tool install docker-engine --host` succeeds |
| `R04-cgroup-delegation` | `+memory +io` delegation succeeds |
| `R05-sandbox-boot` | `agro sandbox install docker --yes` reaches `healthy` |
| `R06-systemd` | PID 1 is `systemd`, `agro-cron` is active, `agro-bootstrap` result is `success` |
| `R07-container-restart` | `agro-cron` is active again after `docker restart` |
| `R08-vm-restart` | the sandbox is `healthy` again after a VM stop and start |
| `R09-disconnect` | a tmux session started before the client disconnects still runs after reconnect |
| `R10-ssh-inbound` | an SSH client outside the provider reaches the VM |
| `R11-https-port` | an HTTPS client outside the provider reaches a port on the VM |
| `R12-egress-tls` | `git ls-remote https://github.com/mifunedev/agro.git` succeeds inside the sandbox container |
| `R13-time-to-shell` | seconds from the `create` request to the first successful `exec` |
| `R14-hermes-install` | `.agro/scripts/hermes-install-smoke.sh` exits 0 in an `oh-hermes-*` sandbox |

The Slack-under-systemd row waits for the design decision in register entry `C7`.

### AGRO change register

| ID | Question | Evidence so far |
|---|---|---|
| `C1` | Does AGRO need the sandbox container when the host is an isolated VM? | Vercel fails `R04`. agro-console nodes run host mode with no container. The AGRO image boots as an exe.dev VM and passes `R05` and `R06`. |
| `C2` | Can the sandbox run with fewer privileges than `cgroup: private`, `SYS_ADMIN`, and `apparmor=unconfined`? | Vercel fails because of the cgroup requirement. |
| `C3` | Does the sandbox boot time cost agro-console its edge? | The healthcheck `start_period` is 600 seconds. On exe.dev, the container mode reached `healthy` in 22 seconds, and the image VM reached `healthy` in about 25 seconds. |
| `C4` | Does AGRO need CA passthrough for egress proxies? | Vercel documents that containers do not inherit the proxy CA. |
| `C5` | Does `hermes-install-smoke.sh` still require the retired `oh-hermes-*` prefix? | The script guard checks `oh-hermes-*`. |
| `C6` | Does `agro workspace create` need an option to set the default workspace? | The Vercel run printed `DEFAULT no`. Host installs then need `--workspace harness`. |
| `C7` | Does a systemd unit replace the tmux Slack gateway? | The operator prefers replacement. `hermes gateway install` writes a systemd unit. Non-negotiable 3 in `AGENTS.md` assigns gateways to named tmux. |
| `C8` | Does the first-boot seed survive a power loss? | On exe.dev, a `restart` 30 seconds after the first boot ran ext4 recovery. After recovery, `agro.json`, `package.json`, and `pnpm-lock.yaml` had 0 bytes. `agro-bootstrap` failed. `entrypoint.sh` copies the seed with `cp -a` and writes no `sync` before the `.image-seeded` marker. A restart after `sync` and a restart 300 seconds after boot both passed. |
| `C9` | Does `get-agro.sh` leave a CLI that works in a non-interactive shell? | On the exe.dev default image, Node is absent. `get-agro.sh` installs Node with nvm, and nvm loads only in interactive shells. `agro --version` then fails with `/usr/bin/env: 'node': No such file or directory` in a non-interactive shell. The agro-console `n4` node shows the same failure with agro 0.15.0 and 0.16.0. |
| `C10` | Does the image work when the image boots as a VM? | The CLI uses `/.dockerenv` as the sandbox marker, so `agro harness install hermes` printed `the sandbox is not running (absent)`. With `AGRO_EXECUTION_TARGET=local`, the install failed with `HERMES_HOME is unset`. The image sets `HERMES_HOME`, `AGRO_PROJECT_ROOT`, and `PATH` with Dockerfile `ENV`. exe.dev does not apply image `ENV` to VM processes. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/microvm-validation/lib.sh` | `vercel_*`, `exedev_*`, `poll_log`, `driver_rows`, `finish` | Provider adapters and the shared driver functions. |
| `.agro/tasks/microvm-validation/run.sh` | whole script | Driver entry point. |
| `.agro/tasks/microvm-validation/rows.sh` | `result`, `in_sbx`, `MODE` | Check script for the in-VM rows. |
| `.agro/tasks/microvm-validation/restart-test.sh` | `MODE` | Driver-side check for `R08`. |
| `.agro/tasks/microvm-validation/cg-probe.sh` | `cg` | cgroup delegation probe for `R04`. |
| `.agro/scripts/sandbox-healthcheck.sh` | whole script | Health oracle for `R05`. |
| `.agro/scripts/hermes-install-smoke.sh` | `AGRO_HERMES_SMOKE`, `SANDBOX_NAME` guard | Check for `R14`. |
| `.agro/scripts/get-agro.sh` | `install_node_via_nvm` | Source of `C9`. |
| `.agro/cli/src/lib/execution/detect.ts` | `SANDBOX_MARKER_FILE`, `EXECUTION_TARGET_ENV` | Source of `C10`. |
| `.devcontainer/entrypoint.sh` | seed copy, `.image-seeded` marker | Source of `C8`. |
| `.devcontainer/docker-compose.yml` | `cgroup`, `cap_add`, `security_opt`, `tmpfs`, `healthcheck` | Sandbox requirements that `R04` to `R07` test. |
| `mifunedev/agro-console` `README.md` | node specs, cloud-init flow | Baseline for US-005. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `run.sh <provider> <check-script>` | New local CLI | Driver entry point for each provider. `IMAGE=<ref>` selects the exe.dev base image. |
| `restart-test.sh <sync\|settled>` | New local CLI | exe.dev restart scenario. |
| `RESULT <row-id> <status> <detail>` | New line format | Machine-read result for each row. |
| Provider accounts | External | Vercel `mifunedev` Hobby team, exe.dev trial, Docker Cloud credit. |

## Storage

The task folder holds the scripts, the logs, and the brief. The pattern `.agro/tasks/*/*` in `.gitignore` ignores these files, so git does not track them. Git tracks only `prd.md` and `prd.json`. The brief stays in the task folder until the operator chooses the output actions.

## Architectural Decisions

- One check script defines each row. Each provider supplies only an adapter with `create`, `exec`, `destroy`, and `list`.
- The check runs detached inside the VM. The driver polls the log, so a dropped client stream does not end the check.
- The driver writes directly to the log file and ignores `SIGHUP`. A closed tmux session does not stop a run.
- The driver removes each VM that it creates on exit, on `SIGINT`, and on `SIGTERM`.
- No GitHub token, Slack token, or `.env` file goes into a provider VM.
- A change to AGRO starts only from a `supported` register entry and an `/architect` brief. This plan changes no AGRO file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `cg-probe.sh` | Vercel run | `R04` reproduces `os error 95` for `memory` and `io`. |
| `rows.sh` | Vercel run | `R01` and `R02` pass. `R04` fails. |
| `rows.sh` | exe.dev default image and AGRO image | Each row emits one `RESULT` line. |
| `run.sh` | `SIGTERM` during a run | The driver removes the VM and exits with code 130. |
| `run.sh` | tmux session closed during a run | The run completes and removes the VM. |

## Design Principles

- Use AGRO operations as rows. Do not use provider feature lists.
- Label each failure as a provider limit, an AGRO assumption, or both.
- Keep the driver small. Add an adapter only when a provider account exists.
- Record evidence as logs. Do not record a cell from documentation alone.
- Stay inside free credit. Ask the operator before any spend.

## Out of Scope

- Changes to AGRO code, compose files, or the image.
- Provisioning speedups for agro-console, such as prebuilt images, warm pools, or snapshots.
- The Slack-under-systemd design. Register entry `C7` tracks the design question.
- The fix for the agro-console GitHub description. The operator tracks that fix.
- E2B, Daytona, Fly.io Sprites, CodeSandbox, and boxd runs. The brief lists them from documentation only.

## Open Questions

1. Resolved: the exe.dev adapter uses the registered SSH key `key-1`. The operator revoked the `agro-matrix` API token.
2. Resolved: the exe.dev trial accepts `new --image ghcr.io/mifunedev/agro:0.16.0`, and the VM runs the image's systemd as PID 1.
3. Resolved: the operator declined Docker Cloud Sandboxes on 2026-10-01. The credit needs a payment card, and the exe.dev evidence covers the persistent-VM question. US-004 records `SKIPPED: operator decision`.
4. Resolved: US-005 starts after US-001 to US-004.
5. Resolved: the brief stays in `.agro/tasks/microvm-validation/` until the operator chooses the output actions.
6. Resolved in direction: the operator prefers a systemd unit in place of the tmux gateway. Register entry `C7` holds the design question for `/architect`.

## Acceptance Criteria

- [ ] The matrix holds one result for each row on Vercel, exe.dev, and the agro-console `n4` node.
- [ ] Each `FAIL` cell carries one label.
- [ ] Each change register entry carries one status and the evidence for that status.
- [ ] No VM that the driver created remains on any provider.

## Lessons

Filled by the advisor before undraft.
