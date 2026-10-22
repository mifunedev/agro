---
name: remote-sandbox
description: |
  Test AGRO on a new provider VM with one command. The driver creates a VM on
  exe.dev, Vercel Sandbox, or agro-console, uploads a check, runs the check
  detached in the VM, polls the check log, and destroys the VM. The main scenario is the
  fresh install (F1 to F4). The second scenario is the AGRO hosting matrix
  (R01 to R15, R02b), the cgroup probe, and the VM restart test. A provider
  adapter of five functions and three optional hooks adds a provider. The
  Hermes generated-home check (H01 to H09) tests a branch on a new VM.
  TRIGGER when: asked to validate an AGRO release or candidate build on a
  fresh VM, run the fresh-install check, test the curl installer on a new VM,
  run the AGRO hosting matrix or a matrix row, run the cgroup probe or the VM
  restart test, run the OpenShell journey check, run the Hermes
  generated-home check, run the Docker egress check, or add a provider
  adapter.
license: MIT
compatibility: Needs bash, ssh, curl, jq, awk, and python3 on the driver host, plus an account on each provider under test (an exe.dev SSH key, the vercel CLI, or an `agro auth login` sign-in and an SSH key for the agro CLI). tmux is optional on the driver host.
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

1. Set up each provider with `references/providers.md`. To sign in to the `console` provider, run `agro auth login` on the driver host, or set `AGRO_CONSOLE_TOKEN` in the driver environment.
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

## Third scenario: the OpenShell journey

`checks/openshell-journey.sh` tests the `agro sandbox install openshell` journey on a new VM. The rows `O01` to `O21` check the AGRO install, the OpenShell install, the gateway, `agro sandbox install openshell`, `agro sandbox list`, and `agro shell`. The rows also check the policy allow and deny rules, the verb refusals, `openshell sandbox stop` and `start`, `agro destroy`, and the hint after a failed create.

The VM must have Docker 28 or later and Landlock. exe.dev qualifies: Ubuntu 24.04, kernel 6.12, and Docker 29. When `AGRO_JS_URL` holds `/releases/download/v<version>/`, row `O01` expects `<version>`. Otherwise row `O01` expects a SemVer string.

To test a release candidate, start the run detached on the driver host. Set `<release>` to the release download URL:

```bash
INSTALL_URL=<release>/install.sh AGRO_JS_URL=<release>/agro.js setsid nohup bash "$SKILL/scripts/run.sh" exedev checks/openshell-journey.sh > run.out 2>&1 < /dev/null &
cat run.out
```

## Fourth scenario: the Hermes generated home

`checks/hermes-home.sh` tests that `agro harness install hermes --host` generates `.hermes/config.yaml` in a workspace that tracks no `.hermes/` file. The check uses host mode on a plain VM. The rows run in this order:

| Row | PASS when |
|---|---|
| `H01-install-agro` | The curl installer at `INSTALL_URL` exits 0 and `agro --version` runs. |
| `H02-clone-ref` | `git clone --branch "$AGRO_REF"` of `https://github.com/mifunedev/agro` into `$HOME/.agro/workspaces/harness` succeeds. The row fails when `AGRO_REF` is unset. |
| `H03-cli-source` | The CLI build from the clone succeeds. The detail holds the CLI path, the CLI version, the clone commit, and the Node version. |
| `H04-untracked-home` | `git ls-files .hermes` in the workspace prints nothing. |
| `H05-first-install` | `env -u HERMES_HOME agro harness install hermes --host` exits 0. |
| `H06-seed-config` | `.hermes/config.yaml` holds each AGRO seed key with the correct YAML type, and `terminal.cwd` is the workspace path. |
| `H07-operator-value-kept` | After `hermes config set model.default agro-rcheck-sentinel-model`, a second install exits 0 and keeps the sentinel value. |
| `H08-clean-status` | `git status --short .hermes` prints nothing after both installs. |
| `H09-skills-link` | `.hermes/skills/agro` is the link `../../.agro/skills`. |

The CLI under test comes from the clone, not from the released `agro.js`. Row `H03` runs `npm ci --ignore-scripts` and `npm run build` in `.agro/cli` of the clone. Each `agro harness install hermes` call then runs `node .agro/cli/dist/agro.js`. The installer supplies Node 22 or later: with `--yes`, the installer installs nvm and Node 24 when the VM has no usable Node. Row `H06` parses the file with the `yaml` package at the version in the clone `package.json`. The parse reads integers as `bigint`, so the row tells `85` from `85.0`. The log holds the file content after each install.

Set `AGRO_REF` to the branch under test. Start the run detached on the driver host:

```bash
tmux new-session -d -s rs-hermes "AGRO_REF=<branch> bash $SKILL/scripts/run.sh exedev checks/hermes-home.sh"
```

## Fifth scenario: the Docker egress allowlist

`checks/docker-egress.sh` tests `access.egress` `allowlist` on a new VM. The check installs AGRO with the curl installer at `INSTALL_URL`. Then the check clones `AGRO_REF` (default `development`), builds the CLI from the clone, and runs `agro config set access.egress allowlist` in the clone. `agro sandbox install docker --checkout <clone> --yes` reads that setting and builds the sandbox image from the clone.

The rows `E01` to `E20` check the install, the health, and the bootstrap readiness file `/run/agro/bootstrap.ready`. The rows also check the routes, an allowed GitHub request, a denied request with a `TCP_DENIED` line in `agro egress log`, `npm view`, and the Claude Code install. Then the rows check `agro egress reload` with a new host, three bypass attempts as root, and `agro destroy`.

To test a branch, start the run detached on the driver host. Set `<branch>` to the branch name:

```bash
AGRO_REF=<branch> setsid nohup bash "$SKILL/scripts/run.sh" exedev checks/docker-egress.sh > run.out 2>&1 < /dev/null &
cat run.out
```

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
| `AGRO_REF` | default branch | The ref that row `R02` clones into the host workspace. `checks/hermes-home.sh` needs `AGRO_REF` and builds the CLI from that ref. |
| `IMAGE` | provider default | The OCI image that the VM boots. The `exedev` adapter reads `IMAGE`. |
| `KEEP` | `0` | `1` keeps the VM after the run. The log then ends with `== keep <name>`. |
| `MATRIX_OUT` | `$PWD/matrix-evidence` | The log directory. Per-run state goes to `$MATRIX_OUT/.state`. |
| `MATRIX_TAG` | `agro-matrix` | The tag on each VM. `<p>_list` counts the VMs with this tag. |
| `POLL_INTERVAL` | `15` | Seconds between two polls of the check log. |
| `DISCONNECT_WAIT` | `5` | Seconds between the start of the `r09` tmux session and the `R09-disconnect` check. |
| `REMOTE_SANDBOX_ADAPTERS` | empty | A colon-separated list of extra adapter directories. |
| `VERCEL_SCOPE` | none | The Vercel team slug. The `vercel` adapter needs this variable. |
| `CONSOLE_SSH_KEY_ID` | none | Optional. The UUID of the console SSH key. Without this variable, `agro node create` registers `~/.ssh/id_ed25519.pub` of the driver host. |
| `CONSOLE_SSH_IDENTITY` | none | The private key file for `ssh -i`. The `console` adapter needs this variable. |
| `CONSOLE_SPEC` | `n4` | The node spec of the `console` adapter. |
| `CONSOLE_FREE_TIER` | `1` | `0` turns off the console free tier. |

`run.sh` forwards `INSTALL_URL`, `AGRO_JS_URL`, `SANDBOX_IMAGE`, and `AGRO_REF` into the VM and writes the build under test into the log. `run.sh` names each VM `agro-mx-<date>-<time>`. `run.sh` writes each log to `$MATRIX_OUT/<provider>-<check>-<YYYYmmdd-HHMMSS>.log`. `restart-test.sh` writes each log to `$MATRIX_OUT/<provider>-restart-<mode>-<YYYYmmdd-HHMMSS>.log`.

A branch run has three sources. `AGRO_JS_URL` sets the CLI bundle. `AGRO_REF` sets the host workspace scripts. `SANDBOX_IMAGE` sets the sandbox image. Image mode ignores `AGRO_REF`, because image mode uses the image seed.

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
| `references/providers.md` | Setup and manual sweep for `exedev`, `vercel`, and `console` (agro-console), and the steps to add an adapter |
