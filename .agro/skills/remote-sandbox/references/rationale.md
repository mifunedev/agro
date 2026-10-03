# Rationale: why each check, row, probe, and driver rule exists

## Contents

1. [The question the checks answer](#the-question-the-checks-answer)
2. [Why each fresh-install row](#why-each-fresh-install-row)
3. [Why each matrix row](#why-each-matrix-row)
4. [Why each probe and scenario](#why-each-probe-and-scenario)
5. [Why the driver works this way](#why-the-driver-works-this-way)
6. [Baseline results](#baseline-results)
7. [Known failure modes of the driver](#known-failure-modes-of-the-driver)

## The question the checks answer

AGRO turns a host into a durable workspace for coding agents. The AGRO sandbox is a container with systemd as PID 1. The sandbox needs `cgroup: private`, `SYS_ADMIN`, `apparmor=unconfined`, and a tmpfs on `/sys/fs`. Agents keep working after the operator disconnects.

The checks ask one question for each VM: which AGRO operations hold on this VM? Each row is an AGRO operation, not a provider feature. A new `FAIL` against the baseline is a regression in AGRO or a change in the provider. Find the cause before you report the cell.

## Why each fresh-install row

The fresh install is the first thing that a new operator does. Each row runs `agro --version` in a different shell context after the curl installer at `INSTALL_URL` completes. A context that fails is a context where the operator, a script, or a service cannot run `agro`.

| Row | AGRO expectation | A failure means |
|---|---|---|
| `F1-new-login-shell` | A new login shell finds `agro` on `PATH`. | The installer did not put `agro` on the `PATH` of a login shell, for example an `ssh` session. |
| `F2-new-interactive-shell` | A new interactive shell finds `agro` on `PATH`. | The installer did not put `agro` on the `PATH` of an interactive terminal. |
| `F3-absolute-path` | `$HOME/.local/bin/agro` runs. | The installer did not write the launcher, or the launcher cannot start. |
| `F4-empty-environment` | The launcher runs with `PATH=/usr/bin:/bin` and no other variable except `HOME`. | The launcher depends on the user environment. Cron, systemd units, and `ssh host cmd` cannot run `agro`. The log prints the launcher shebang for diagnosis. |

## Why each matrix row

| Row | AGRO expectation | A failure means |
|---|---|---|
| `R13-time-to-shell` | An operator gets a shell fast. | The provider is slow on the first session. The driver measures seconds from the `create` request to the first successful `exec`. |
| `R04-cgroup-delegation` | The VM delegates the `memory` and `io` cgroup controllers. | systemd cannot run as PID 1 in a container. runc puts the container cgroup in `threaded` mode, and systemd exits with `Structure needs cleaning`. Every sandbox row then fails. |
| `R02-workspace` | The installer at `INSTALL_URL` installs the CLI, and `agro workspace create` clones a workspace. | The documented host install path is broken. |
| `R02b-noninteractive-cli` | `agro --version` succeeds in a non-interactive shell after the install. | Cron, systemd units, cloud-init, and `ssh host cmd` cannot run `agro`. mifunedev/agro#1262 fixed this case for nvm installs. |
| `R03-docker-engine-host` | `agro tool install docker-engine --host` installs Docker. | The documented Docker path is broken on that base image. |
| `R01-docker` | `dockerd` runs and `docker compose` is present. | The VM cannot run the sandbox container. |
| `R05-sandbox-boot` | `agro sandbox install docker --yes` reaches `healthy`. In image mode, `agro-bootstrap` is active and the healthcheck passes. | The AGRO sandbox does not start. |
| `R06-systemd` | PID 1 is `systemd`. The `agro-cron` unit runs. The `agro-bootstrap` unit reports `success`. | Unattended schedules do not run. |
| `R07-container-restart` | `agro-cron` is active again after `docker restart`. | A container restart loses the unattended runtime. |
| `R08-vm-restart` | The sandbox is healthy again after a VM restart, and files keep their content. | A VM restart loses work or corrupts state. |
| `R09-disconnect` | A tmux session survives the client exit. | Work stops with the terminal. This breaks the AGRO rule that remote and unattended operation is normal. |
| `R10-ssh-inbound` | A standard SSH client outside the provider reaches the VM. | `agro shell`, editors, and remote operators cannot attach. |
| `R11-https-port` | An HTTPS client outside the provider reaches a port on the VM. | Previews and code-server need a tunnel. |
| `R12-egress-tls` | `git ls-remote https://github.com/mifunedev/agro.git HEAD` succeeds inside the sandbox. | An egress proxy breaks TLS for containers. Vercel documents that containers do not inherit the proxy CA. |
| `R14-hermes-install` | `agro harness install hermes` and `hermes-install-smoke.sh` succeed. | A harness install path fails on that VM. The smoke needs a sandbox name that starts with `oh-hermes-` and no Docker socket in the sandbox. |

`checks/agro-rows.sh` detects one of two modes:

- **host mode:** the VM is a plain host. The check installs AGRO and runs the sandbox container.
- **image mode:** the VM booted the AGRO image. `/opt/agro-seed` exists, PID 1 is systemd, and the `agro-bootstrap` unit exists. The check skips the host rows and checks the VM itself.

## Why each probe and scenario

| Script | Why |
|---|---|
| `checks/fresh-install.sh` | The main scenario. `fresh-install.sh` runs the curl installer on a new VM with no AGRO state. |
| `checks/cg-probe.sh` | The cheapest test that decides whether a provider can host the AGRO sandbox. The probe installs Docker, tries to enable each controller, and starts a plain `jrei/systemd-ubuntu:24.04` container. A failure with a plain image proves that the cause is the provider, not AGRO. Run the probe first on a new provider. |
| `checks/agro-rows.sh` | The full set of in-VM rows, one `RESULT` line each. Each row runs when an earlier row fails, so one run gives the whole column. |
| `scripts/restart-test.sh <p> sync` | Restarts the VM after `sync`. This run separates a hard reset by the provider from a defect in AGRO. |
| `scripts/restart-test.sh <p> settled` | Restarts the VM 300 seconds after the sandbox is healthy. This run shows the expected case. |
| `driver_rows` in `scripts/lib.sh` | `R09`, `R10`, and `R11` need a second client connection from outside the VM, so the driver runs these rows, not the check. |

## Why the driver works this way

| Rule | Reason |
|---|---|
| The check runs detached inside the VM, and the driver polls `/tmp/check.log` with `exec` calls of 2 minutes or less. | The first Vercel run used one long `exec` stream. The stream ended after about 6 minutes with `Stream ended before command finished`, and the run lost the remaining steps. |
| The VM runs no tmux machinery. The check starts under `setsid nohup`. | `setsid nohup` detaches the check from the `exec` call, so the check needs no terminal multiplexer in the VM. The only tmux session in the VM is the `R09-disconnect` row under test. |
| The driver writes straight to the log file and ignores `SIGHUP`. tmux is optional for the driver. | An earlier driver piped its output through `tee`. When the tmux session closed, the `tee` process stopped first. The next cleanup write stopped the shell, and the VM stayed. A closed terminal must not stop a run. |
| `finish` destroys the VM on exit, on `SIGINT`, and on `SIGTERM`. After the destroy, `finish` counts the tagged VMs that remain. | A leftover VM spends quota and money. The count line proves the cleanup in the log. |
| Every VM carries the tag `$MATRIX_TAG` and the name prefix `agro-mx-`. | The cleanup count and a manual sweep find each VM that the driver created. They never touch other VMs. |
| No GitHub token, Slack token, API token, or `.env` file goes into a VM. | Provider VMs are third-party hosts. |
| Timing uses `date` and `awk`. | `bc` is absent from some hosts, and `python3` is absent from the AGRO image. |
| Optional hooks replace a `case` on the provider. | An adapter from another repository adds a provider through `REMOTE_SANDBOX_ADAPTERS` with no edit to the driver. |

## Baseline results

On 2026-10-03, v0.16.1 passed `F1` to `F4` and every matrix row, `R14` included, on a new exe.dev VM.

The table holds the matrix baseline from 2026-09-30 to 2026-10-01. Compare a new run against these values. A difference is drift in a provider, in AGRO, or in the checks.

| Row | Vercel host | exe.dev container | exe.dev image VM |
|---|---|---|---|
| `R13-time-to-shell` | 2.4 s | 2.1 s | 2.0 s |
| `R04-cgroup-delegation` | FAIL, the provider keeps the controllers | PASS | PASS |
| `R02-workspace` | PASS | PASS | SKIPPED |
| `R02b-noninteractive-cli` | PASS | FAIL (fixed by mifunedev/agro#1263) | SKIPPED |
| `R03-docker-engine-host` | PASS | SKIPPED | SKIPPED |
| `R01-docker` | PASS | PASS | SKIPPED |
| `R05-sandbox-boot` | FAIL | PASS 22 s | PASS |
| `R06-systemd` | FAIL | PASS | PASS |
| `R07-container-restart` | FAIL | PASS 4 s | SKIPPED |
| `R08-vm-restart` | not run | not run | PASS 5.6 s to 8.1 s |
| `R09-disconnect` | PASS | PASS | PASS |
| `R10-ssh-inbound` | FAIL, API exec only | PASS | PASS |
| `R11-https-port` | SKIPPED | SKIPPED, HTTP 307 | SKIPPED, HTTP 307 |
| `R12-egress-tls` | FAIL | PASS | PASS |
| `R14-hermes-install` | FAIL | PASS | FAIL, see `C10` |

AGRO findings from the baseline:

| ID | Finding | Status on 2026-10-03 |
|---|---|---|
| `C8` | `entrypoint.sh` copies the seed with `cp -a` and writes the `.image-seeded` marker with no `sync`. A hard reset in the first seconds after the first boot left `agro.json`, `package.json`, and `pnpm-lock.yaml` at 0 bytes. | open |
| `C9` | nvm Node made `agro` fail in non-interactive shells. | fixed in mifunedev/agro#1263 |
| `C10` | The image booted as a VM has no `/.dockerenv` and no Dockerfile `ENV`. `agro harness install hermes` refuses, then fails with `HERMES_HOME is unset`. | open |

## Known failure modes of the driver

| Symptom | Cause | Action |
|---|---|---|
| `Stream ended before command finished` | A long `exec` stream on Vercel. | Keep each `exec` under 2 minutes. `run.sh` already does. |
| A VM remains after the terminal closed. | A driver version that piped output through `tee`. | Use the current `run.sh`. Destroy the VM with the manual sweep in `references/providers.md`. |
| The log shows `boot=success` before the bootstrap ran. | systemd reports the default value `Result=success` for a unit before the first run. | Check `systemctl is-active agro-bootstrap` together with the result. |
| The marker file is missing after an exe.dev restart. | `ssh exe.dev restart` is a hard reset. ext4 runs journal recovery, and writes from the last seconds can vanish. | Call `sync` before the restart, or wait 30 seconds. |
| `poll miss 6` or `poll deadline reached` | Six `exec` calls failed in sequence, or the check ran longer than 2400 seconds. | Read the log above the line. The driver skips the driver rows and destroys the VM. |
