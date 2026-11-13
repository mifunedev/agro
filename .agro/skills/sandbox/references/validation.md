# Remote validation

## Contents

1. [Choose when](#choose-when)
2. [Prerequisites](#prerequisites)
3. [Execute](#execute)
   - [Fresh install](#main-scenario-fresh-install)
   - [Hosting matrix](#second-scenario-the-agro-hosting-matrix)
   - [OpenShell journey](#third-scenario-the-openshell-journey)
   - [Hermes generated home](#fourth-scenario-the-hermes-generated-home)
   - [Docker egress](#fifth-scenario-the-docker-egress-allowlist)
   - [msb guest](#sixth-scenario-the-msb-microvm-guest)
   - [agro run modes](#seventh-scenario-the-agro-run-modes)
4. [Verify](#verify)
5. [Cleanup](#cleanup)
6. [Failure remedies](#failure-remedies)
7. [Commands and variables](#commands-and-variables)
8. [Adapter contract](#adapter-contract)

## Choose when

In this validation procedure, "VM" means the provider machine, and "sandbox" means the AGRO container inside that VM.
This terminology applies to validation rows, not to every execution route in the Sandbox skill.

The driver `scripts/run.sh` creates one VM, runs one check in the VM, and destroys the VM. A check is any script that prints `RESULT <id> <status> <detail>` lines and ends with a `SUMMARY` line or a `PROBE-END` line.

## Prerequisites

1. Get operator approval before each run. Each run creates billable VMs on a third-party host.
2. Send no GitHub token, Slack token, API token, or `.env` file into a VM.
3. Start the driver detached: in a named tmux session, or under `setsid nohup`. tmux is optional for the driver. The driver ignores `SIGHUP` and writes its output straight to the log file.
4. The VM runs no tmux machinery. The only tmux session in the VM is the `R09-disconnect` row under test.
5. Record owned resource names and approved teardown scope. Never delete an unrelated resource.
6. Have bash, ssh, curl, jq, awk, and python3 on the driver host.

## Execute

### Set up

1. Use validation adapter setup in `providers.md`, linked directly from SKILL.md.
   Sign in to `console` with `agro auth login` on the driver host, or set `AGRO_CONSOLE_TOKEN` in the driver environment.
2. Set `SKILL` to the canonical directory: `SKILL=.agro/skills/sandbox`.
   Run commands from the checkout root unless the command uses `$SKILL` explicitly.
3. Run the preflight on the driver host. The command prints `preflight ok: exedev` and exits 0:

   ```bash
   bash "$SKILL/scripts/run.sh" exedev --preflight
   ```

4. For the `console` and `msb` providers, the preflight runs `agro node check`. The preflight adds `--free-tier` unless `CONSOLE_FREE_TIER=0`. When `CONSOLE_SSH_KEY_ID` holds a value, the preflight adds `--ssh-key "$CONSOLE_SSH_KEY_ID"`. The preflight prints each check line and fails when one check fails. `console_create` runs the preflight first. When the preflight fails, `console_create` creates no node.

### Main scenario: fresh install

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

The first line of `run.out` is `log: <path>`.
Observe the detached driver with bounded harness completion monitoring.
In Pi, use `MonitorCreate` with an `onDone` completion wake.
Set a finite inactivity timeout that covers provider startup, the 2400-second check deadline, driver rows, and cleanup.
The driver redirects output into its log, so monitor stdout can remain idle throughout the run.
For monitor-owned execution, pass `setsid bash .agro/skills/sandbox/scripts/run.sh exedev` instead of the background launch above.
The monitor observes process completion without another shell polling loop.
The detached session and direct log writes still survive terminal disconnect.
In other harnesses, use the equivalent bounded completion monitor.
Do not add a shell polling loop. The driver's internal polling remains unchanged.
Read the reported log after the completion wake.

### Second scenario: the AGRO hosting matrix

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

Runs on different providers are independent. Start one run at a time on each provider, because a provider plan can cap concurrent VMs. The rationale reference linked from SKILL.md states each row's purpose and the historical baseline.

### Third scenario: the OpenShell journey

`checks/openshell-journey.sh` tests the `agro sandbox install openshell` journey on a new VM. The rows `O01` to `O21` check the AGRO install, the OpenShell install, the gateway, `agro sandbox install openshell`, `agro sandbox list`, and `agro shell`. The rows also check the policy allow and deny rules, the verb refusals, `openshell sandbox stop` and `start`, `agro destroy`, and the hint after a failed create.

The VM must have Docker 28 or later and Landlock. exe.dev qualifies: Ubuntu 24.04, kernel 6.12, and Docker 29. When `AGRO_JS_URL` holds `/releases/download/v<version>/`, row `O01` expects `<version>`. Otherwise row `O01` expects a SemVer string.

To test a release candidate, start the run detached on the driver host. Set `<release>` to the release download URL:

```bash
INSTALL_URL=<release>/install.sh AGRO_JS_URL=<release>/agro.js setsid nohup bash "$SKILL/scripts/run.sh" exedev checks/openshell-journey.sh > run.out 2>&1 < /dev/null &
cat run.out
```

### Fourth scenario: the Hermes generated home

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

The CLI under test comes from the clone, not from the released `agro.js`. Row `H03` runs `npm ci --ignore-scripts` and `npm run build` in `.agro/cli` of the clone. Each `agro harness install hermes` call then runs `node .agro/cli/dist/agro.js`. The installer supplies Node 22 or later: with `--yes`, the installer installs fnm and Node 24 when the VM has no usable Node. Row `H06` parses the file with the `yaml` package at the version in the clone `package.json`. The parse reads integers as `bigint`, so the row tells `85` from `85.0`. The log holds the file content after each install.

Set `AGRO_REF` to the branch under test. Start the run detached on the driver host:

```bash
tmux new-session -d -s rs-hermes "AGRO_REF=<branch> bash $SKILL/scripts/run.sh exedev checks/hermes-home.sh"
```

### Fifth scenario: the Docker egress allowlist

`checks/docker-egress.sh` tests `access.egress` `allowlist` on a new VM. The check installs AGRO with the curl installer at `INSTALL_URL`. Then the check clones `AGRO_REF` (default `development`), builds the CLI from the clone, and runs `agro config set access.egress allowlist` in the clone. `agro sandbox install docker --checkout <clone> --yes` reads that setting and builds the sandbox image from the clone.

The rows `E01` to `E20` check the install, the health, and the bootstrap readiness file `/run/agro/bootstrap.ready`. The rows also check the routes, an allowed GitHub request, a denied request with a `TCP_DENIED` line in `agro egress log`, `npm view`, and the Claude Code install. Then the rows check `agro egress reload` with a new host, three bypass attempts as root, and `agro destroy`.

To test a branch, start the run detached on the driver host. Set `<branch>` to the branch name:

```bash
AGRO_REF=<branch> setsid nohup bash "$SKILL/scripts/run.sh" exedev checks/docker-egress.sh > run.out 2>&1 < /dev/null &
cat run.out
```

### Sixth scenario: the msb microVM guest

The validation adapter `msb` creates an agro-console node and installs `msb` on that node.
It boots `IMAGE` as a microVM with `--init auto`.
This adapter is not the `local/msb` execution route.
The validation provider reference holds setup and known limits. `IMAGE` must be an `agro-msb` image. Build the image on a host with Docker:

```bash
docker build --target agro-msb -f .devcontainer/Dockerfile -t ghcr.io/mifunedev/agro:spike-msb-<sha> .
```

`checks/msb-guest.sh` runs in the guest. `msb_exec` sets `MSB_GUEST=1`, so the check uses microVM mode. Without `MSB_GUEST=1`, the check uses host mode and skips `M03` and `M05`. `MSB_GUEST_PHASE` selects the phase: `pre`, `restart`, or `restore`.

| Row | PASS when |
|---|---|
| `M01-dockerd` | `systemctl is-active docker` exits 0 and `docker run --rm hello-world` exits 0. |
| `M02-pid1` | PID 1 is `systemd`. |
| `M03-restart-persist` | In phase `restart`, `docker` is active and the tmux session `agro-mx-probe` exists. Phase `pre` creates the session and prints `SKIPPED`. |
| `M04-idle-memory` | After `MSB_IDLE_WAIT` seconds, `/proc/meminfo` gives the used memory in MiB. |
| `M05-snapshot-restore` | In phase `restore`, PID 1 is `systemd`. |
| `M06-image-size` | `IMAGE_SIZE_BYTES` is a byte count. Without `IMAGE_SIZE_BYTES`, the row prints `SKIPPED`. |

`run.sh` runs one phase on one new guest. Start the `pre` phase detached on the driver host:

```bash
tmux new-session -d -s rs-msb "IMAGE=ghcr.io/mifunedev/agro:spike-msb-<sha> bash $SKILL/scripts/run.sh msb checks/msb-guest.sh"
```

The phases must use the same guest: `pre`, then `msb_restart`, then `restart`, then `msb_snapshot_restore`, then `restore`.
`run.sh` creates a new guest for each invocation; separate runs cannot prove this phase chain.
No bundled driver orchestrates the full chain.
A separately approved orchestration must retain the guest and call these adapter hooks in order.
Record the guest identity and cleanup ownership before that orchestration.
Do not depend on an archived task script.

### Seventh scenario: the agro run modes

`checks/agro-run-matrix.sh` tests the `agro run` modes on a new `console` node. The check uses host mode. The check installs AGRO with the curl installer at `INSTALL_URL`, runs `sudo usermod -aG kvm "$USER"`, and installs msb `0.7.13` with `agro tool install microsandbox`. When the installed AGRO installs a different msb release, the check uses the pinned upstream installer. Then the check creates a scratch git repository under `mktemp`, writes `agro.json` in it for each row, and deletes it at the end. The new `kvm` group applies only to a new login, so each microVM row runs through `sg kvm`.

| Row | PASS when |
|---|---|
| `X01-container-exit` | `agro run -- sh -c 'exit 7'` exits 7. |
| `X02-service-reach` | With `run.services.postgres` (`postgres:17-alpine`, ready `pg_isready`), a `node -e` command connects to the host `postgres` on port 5432. |
| `X03-egress-allow` | With `access.egress` `allowlist` and `access.egressAllow` `["example.org"]`, `curl https://example.org` through the proxy returns 200. |
| `X04-egress-deny` | With the same configuration, the proxy refuses the CONNECT to `https://example.com` with 403. |
| `X05-microvm-exit` | `agro run --isolation microvm -- sh -c 'id -un; exit 7'` prints `sandbox` and exits 7. Without `/dev/kvm`, the row prints `SKIPPED`. |
| `X06-microvm-boot` | `X05` appended a line to `${AGRO_HOME:-~/.agro}/runs/microvm.jsonl`, and that line has `bootToExitMs`. The detail holds the value. Without `/dev/kvm`, the row prints `SKIPPED`. |
| `X07-refusals` | `--isolation microvm` with `run.services` exits 1, and `--isolation vm` exits 1. |
| `X08-leftovers` | Cleanup leaves no `agro-run-` Docker container, Docker network, or msb sandbox. |

The check needs the `console` provider, `CONSOLE_SSH_IDENTITY`, an `agro auth login` sign-in on the driver host, and the free tier node spec `n4`. Before the check creates the node, `agro node check --free-tier` must pass on the driver host. Run `bash "$SKILL/scripts/run.sh" console --preflight` to run the check first. When `INSTALL_URL` has no value and the host has AGRO `0.32.0` or later, the check skips the install. Start the run detached on the driver host:

```bash
setsid nohup bash "$SKILL/scripts/run.sh" console checks/agro-run-matrix.sh > run.out 2>&1 < /dev/null &
cat run.out
```

## Verify

Copy each result from the actual log. Never write a predicted result.
A check prints `RESULT <id> <PASS|FAIL|SKIPPED> <detail>` lines.
The check ends with `SUMMARY` or `PROBE-END`.
Record the CLI, ref, image, row results, and cleanup evidence.

## Cleanup

The driver destroys its VM on exit, `SIGINT`, or `SIGTERM`, unless `KEEP=1`.
A cleaned run ends with `remaining <tag> resources on <provider>: 0` and `RUN DONE`.
With `KEEP=1`, record the retained VM and owner; the log ends with `== keep <name>`.
If resources remain, inspect the validation provider cleanup instructions.
Delete only resources recorded for this approved run.

## Failure remedies

If preflight refuses, stop before creation and follow the reported remedy.
Do not retry a hands HTTP 403 or bypass a provider guard.
For `poll miss 6` or `poll deadline reached`, inspect the log for failed exec calls or the 2400-second deadline.
The driver skips later driver rows and cleans up.
Do not claim a pass from incomplete output.

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
| `IMAGE` | provider default | The OCI image that the VM boots. The `exedev` adapter reads `IMAGE`. The `msb` adapter needs `IMAGE` and exits 2 without it. |
| `KEEP` | `0` | `1` keeps the VM after the run. The log then ends with `== keep <name>`. |
| `MATRIX_OUT` | `$PWD/matrix-evidence` | The log directory. Per-run state goes to `$MATRIX_OUT/.state`. |
| `MATRIX_TAG` | `agro-matrix` | The tag on each VM. `<p>_list` counts the VMs with this tag. |
| `POLL_INTERVAL` | `15` | Seconds between two polls of the check log. |
| `DISCONNECT_WAIT` | `5` | Seconds between the start of the `r09` tmux session and the `R09-disconnect` check. |
| `REMOTE_SANDBOX_ADAPTERS` | empty | A colon-separated list of extra adapter directories. |
| `VERCEL_SCOPE` | none | The Vercel team slug. The `vercel` adapter needs this variable. |
| `AGRO_CONSOLE_URL` | CLI default | The console API URL. The `agro` CLI reads this variable. |
| `AGRO_CONSOLE_TOKEN` | none | The console API token on the driver host. The CLI reads it before the credentials file from `agro auth login`. |
| `CONSOLE_SSH_KEY_ID` | none | Optional. The UUID of the console SSH key. Without this variable, `agro node create` registers `~/.ssh/id_ed25519.pub` of the driver host. |
| `CONSOLE_SSH_IDENTITY` | none | The private key file for `ssh -i`. The `console` adapter needs this variable. |
| `CONSOLE_SPEC` | `n4` | The node spec of the `console` adapter. |
| `CONSOLE_FREE_TIER` | `1` | `0` turns off the console free tier. |
| `MSB_VERSION` | `v0.7.13` | The `msb` release that the `msb` adapter installs on the node. `msb_create` fails when `msb --version` shows a different release. |
| `MSB_GUEST_MEMORY` | `2G` | The `--memory` value of each msb guest. |
| `MSB_GUEST_CPUS` | `2` | The `--cpus` value of each msb guest. |
| `MSB_SSH_WAIT_TRIES` | `240` | The number of SSH attempts, 5 seconds apart, that `msb_create` makes before the node setup. |
| `MSB_SYSTEMD_WAIT_TRIES` | `120` | The number of attempts, 5 seconds apart, that the `msb` adapter makes until guest PID 1 is `systemd` and `systemctl is-system-running` prints `running` or `degraded`. |
| `MSB_GUEST_PHASE` | `pre` | The phase of `checks/msb-guest.sh`: `pre`, `restart`, or `restore`. `msb_exec` forwards the value into the guest. |
| `MSB_IDLE_WAIT` | `60` | Seconds that `checks/msb-guest.sh` waits before row `M04-idle-memory`. `msb_exec` forwards the value into the guest. |
| `IMAGE_SIZE_BYTES` | none | The image size in bytes for row `M06-image-size`. `msb_exec` forwards the value into the guest. |

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

For adapter setup, use the validation provider reference linked directly from SKILL.md.

Load validation provider setup and rationale directly from SKILL.md when those details apply.
