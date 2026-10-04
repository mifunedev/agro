---
name: remote-sandbox
description: |
  Test AGRO on a new provider VM with one command. The driver creates a VM on
  exe.dev or Vercel Sandbox, uploads a check, runs the check detached in the
  VM, polls the check log, and destroys the VM. The main scenario is the
  fresh install (F1 to F4). The second scenario is the AGRO hosting matrix
  (R01 to R15, R02b), the cgroup probe, and the VM restart test. A provider
  adapter of five functions and three optional hooks adds a provider.
  TRIGGER when: asked to validate an AGRO release or candidate build on a
  fresh VM, run the fresh-install check, test the curl installer on a new VM,
  run the AGRO hosting matrix or a matrix row, run the cgroup probe or the VM
  restart test, or add a provider adapter.
license: MIT
compatibility: Needs bash, ssh, curl, jq, awk, and python3 on the driver host, plus an account on each provider under test (an exe.dev SSH key or the vercel CLI). tmux is optional on the driver host.
metadata:
  mifune:
    category: agro
    requires-tools: ["bash", "ssh", "curl", "jq", "awk", "python3"]
---

# Remote sandbox

A remote sandbox is a provider VM, and the AGRO sandbox runs inside the VM. This skill uses "VM" for the provider machine. This skill uses "sandbox" only for the AGRO container.

The driver `scripts/run.sh` creates one VM, runs one check in the VM, and destroys the VM. A check is any script that prints `RESULT <id> <status> <detail>` lines and ends with a `SUMMARY` line or a `PROBE-END` line.

## Rules

1. Get operator approval before each run. Each run creates billable VMs on a third-party host.
2. Send no GitHub token, Slack token, API token, or `.env` file into a VM.
3. Start the driver detached: in a named tmux session, or under `setsid nohup`. tmux is optional for the driver. The driver ignores `SIGHUP` and writes its output straight to the log file.
4. The VM runs no tmux machinery. The only tmux session in the VM is the `R09-disconnect` row under test.
5. Confirm the cleanup. The driver destroys each tagged VM on exit, `SIGINT`, or `SIGTERM`, unless `KEEP=1`. The log ends with `remaining <tag> resources on <provider>: 0` and `RUN DONE`. If the count is not 0, sweep by hand with `references/providers.md`.
6. Copy each result from a log. Never write a predicted result.

## Set up

1. Set up each provider with `references/providers.md`.
2. Set `SKILL` to the skill directory, for example `SKILL=.agro/skills/remote-sandbox`.
3. Run the preflight on the driver host. The command prints `preflight ok: exedev` and exits 0:

   ```bash
   bash "$SKILL/scripts/run.sh" exedev --preflight
   ```

## Main scenario: fresh install

`checks/fresh-install.sh` is the default check of `run.sh <provider>`. The check installs AGRO on a new VM with the curl installer at `INSTALL_URL`. Then the check runs `agro --version` four ways:

| Row | Command |
|---|---|
| `F1-new-login-shell` | `bash -lc "agro --version"` |
| `F2-new-interactive-shell` | `bash -ic "agro --version"` |
| `F3-absolute-path` | `$HOME/.local/bin/agro --version` |
| `F4-empty-environment` | `env -i HOME=$HOME PATH=/usr/bin:/bin $HOME/.local/bin/agro --version` |

Start the run detached on the driver host. Then read the log path from `run.out`:

```bash
setsid nohup bash "$SKILL/scripts/run.sh" exedev > run.out 2>&1 < /dev/null &
cat run.out
```

The first line of `run.out` is `log: <path>`. Wait for the end of the run with one command per log:

```bash
until grep -q "RUN DONE" <path>; do sleep 15; done
```

## Second scenario: the AGRO hosting matrix

Run these steps in order. A failed probe makes the later steps on that provider unnecessary.

1. Run the cgroup probe on a new provider. `memory FAIL` in the log means that the AGRO sandbox cannot run on that provider:

   ```bash
   tmux new-session -d -s rs-probe "bash $SKILL/scripts/run.sh exedev checks/cg-probe.sh"
   ```

2. Run the rows `R01` to `R15` and `R02b`. On a plain VM, `checks/agro-rows.sh` uses host mode. On a VM that booted the AGRO image, the check uses image mode:

   ```bash
   tmux new-session -d -s rs-rows "bash $SKILL/scripts/run.sh exedev checks/agro-rows.sh"
   tmux new-session -d -s rs-image "IMAGE=ghcr.io/mifunedev/agro:<version> bash $SKILL/scripts/run.sh exedev checks/agro-rows.sh"
   ```

3. Run the VM restart test for `R08-vm-restart`. The test needs a `<p>_restart` hook and a VM that boots the AGRO image. `IMAGE` defaults to `ghcr.io/mifunedev/agro:latest`:

   ```bash
   tmux new-session -d -s rs-sync "bash $SKILL/scripts/restart-test.sh exedev sync"
   tmux new-session -d -s rs-settled "bash $SKILL/scripts/restart-test.sh exedev settled"
   ```

4. Build a Markdown table from the `*-rows-*.log` and `*-restart-*.log` files:

   ```bash
   bash "$SKILL/scripts/summarize.sh" "$MATRIX_OUT"
   ```

Runs on different providers are independent. Start one run at a time on each provider, because a provider plan can cap concurrent VMs. `references/rationale.md` states why each row and probe exists, and holds the baseline.

## Commands and variables

| Command | Use |
|---|---|
| `scripts/run.sh <provider> [<check>\|--preflight]` | Create a VM and run `<check>`. After `checks/agro-rows.sh`, run the driver rows. The default check is `checks/fresh-install.sh`. A check path resolves against the skill directory first. |
| `scripts/restart-test.sh <provider> <sync\|settled>` | Run `R08-vm-restart`. `sync` calls `sync` before the restart. `settled` waits 300 seconds before the restart. |
| `scripts/summarize.sh [<dir>]` | Print the matrix table from the logs in `<dir>`. The default is `MATRIX_OUT`. |

| Variable | Default | Effect |
|---|---|---|
| `INSTALL_URL` | `https://github.com/mifunedev/agro/releases/latest/download/install.sh` | The curl installer under test. |
| `AGRO_JS_URL` | release | The `agro.js` bundle that the installer installs. |
| `SANDBOX_IMAGE` | CLI default | The image for `agro sandbox install docker --image=<ref>`. |
| `IMAGE` | provider default | The OCI image that the VM boots. The `exedev` adapter reads `IMAGE`. |
| `KEEP` | `0` | `1` keeps the VM after the run. The log then ends with `== keep <name>`. |
| `MATRIX_OUT` | `$PWD/matrix-evidence` | The log directory. Per-run state goes to `$MATRIX_OUT/.state`. |
| `MATRIX_TAG` | `agro-matrix` | The tag on each VM. `<p>_list` counts the VMs with this tag. |
| `POLL_INTERVAL` | `15` | Seconds between two polls of the check log. |
| `REMOTE_SANDBOX_ADAPTERS` | empty | A colon-separated list of extra adapter directories. |
| `VERCEL_SCOPE` | none | The Vercel team slug. The `vercel` adapter needs this variable. |

`run.sh` forwards `INSTALL_URL`, `AGRO_JS_URL`, and `SANDBOX_IMAGE` into the VM and writes the build under test into the log. `run.sh` names each VM `agro-mx-<date>-<time>`. `run.sh` writes each log to `$MATRIX_OUT/<provider>-<check>-<YYYYmmdd-HHMMSS>.log`. `restart-test.sh` writes each log to `$MATRIX_OUT/<provider>-restart-<mode>-<YYYYmmdd-HHMMSS>.log`.

The driver rows run only after `checks/agro-rows.sh`. After that check prints `SUMMARY`, the driver runs three rows from outside the VM: `R09-disconnect`, `R10-ssh-inbound`, and `R11-https-port`. A run of any other check prints no driver row.

## Adapter contract

An adapter is a file `<provider>.sh` that defines shell functions with the prefix `<p>_`. `scripts/lib.sh` loads `adapters/*.sh` from the skill directory first. Then `lib.sh` loads `*.sh` from each directory in `REMOTE_SANDBOX_ADAPTERS`, in list order. A later definition of a function replaces an earlier one.

The adapter must define five functions:

| Function | Contract |
|---|---|
| `<p>_preflight` | Exit 0 when the account and the CLI work. |
| `<p>_create NAME` | Create a VM with the name `NAME` and the tag `$MATRIX_TAG`. Honor `IMAGE` when the provider supports an image. |
| `<p>_exec NAME CMD…` | Run `CMD…` in the VM through a shell. Return the exit status of `CMD`. Keep each call under 2 minutes. |
| `<p>_destroy NAME` | Destroy the VM. |
| `<p>_list` | Print the number of VMs with the tag `$MATRIX_TAG`. |

If no loaded adapter defines all five functions for `<provider>`, `run.sh` prints a usage line and exits 2.

Three hooks are optional:

| Hook | Contract | If the hook is missing |
|---|---|---|
| `<p>_row_ssh NAME` | Print one `RESULT R10-ssh-inbound …` line. | The driver prints `RESULT R10-ssh-inbound SKIPPED no adapter hook`. |
| `<p>_row_https NAME` | Print one `RESULT R11-https-port …` line. | The driver prints `RESULT R11-https-port SKIPPED no adapter hook`. |
| `<p>_restart NAME` | Restart the VM. | `restart-test.sh` prints a usage line and exits 2. |

To add a provider, follow "Add an adapter" in `references/providers.md`.

## References

| File | Holds |
|---|---|
| `references/rationale.md` | Why each F row, R row, probe, and driver rule exists, the baseline, and the known failure modes |
| `references/providers.md` | Setup and manual sweep for `exedev` and `vercel`, and the steps to add an adapter |
