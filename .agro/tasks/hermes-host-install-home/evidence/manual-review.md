# Manual review evidence: hermes-host-install-home

## A. Remote-sandbox run on the branch build

Prerequisites: the operator approved the billable exe.dev run. The advisor built `.agro/cli/dist/agro.js` from `bug/1325-hermes-host-install-home` at `6b0b6516` and published the temporary prerelease `validate-hermes-host-install-home` with `agro.js` and `install.sh`. `gh release view --repo mifunedev/agro --json tagName -q .tagName` printed `v0.16.2` after the publish.

Location: the advisor ran the driver in the sandbox, local, in tmux session `rs-hermes1325`. The checks ran on a fresh exe.dev VM in host mode.

```bash
U=https://github.com/mifunedev/agro/releases/download/validate-hermes-host-install-home
MATRIX_OUT=<scratchpad>/matrix INSTALL_URL=$U/install.sh AGRO_JS_URL=$U/agro.js \
  bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/agro-rows.sh
```

Log: `exedev-agro-rows-20261004-103447.log` (advisor scratchpad). Lines from the log, unedited:

```text
build under test: install=https://github.com/mifunedev/agro/releases/download/validate-hermes-host-install-home/install.sh agro_js=https://github.com/mifunedev/agro/releases/download/validate-hermes-host-install-home/agro.js sandbox_image=cli default vm_image=provider default
== mode=host user=exedev kernel=6.12.93 cgroupfs=cgroup2fs
RESULT R13-time-to-shell PASS 2.3s
RESULT R04-cgroup-delegation PASS already delegated: cpuset cpu io memory pids
RESULT R02b-noninteractive-cli PASS agro runs in a non-interactive shell
RESULT R02-workspace PASS agro 0.16.2
RESULT R03-docker-engine-host SKIPPED docker already running in base image
RESULT R01-docker PASS server=29.1.3 cgroup=2 driver=systemd
RESULT R05-sandbox-boot PASS 22s
RESULT R06-systemd PASS failed units:
RESULT R07-container-restart PASS 3s
RESULT R12-egress-tls PASS 99987664f47c
RESULT R15-hermes-host-install PASS
RESULT R14-hermes-install PASS install=0
SUMMARY fails=0
RESULT R09-disconnect PASS tmux session survives the client exit
RESULT R10-ssh-inbound PASS ssh agro-mx-1004-103447.exe.xyz
RESULT R11-https-port SKIPPED proxy answers 307: private by default, needs share
1 VM deleted successfully
remaining agro-matrix resources on exedev: 0
RUN DONE
```

Exit status: the driver ended with `RUN DONE` and 0 remaining resources. The check reported `SUMMARY fails=0`. `R03` and `R11` are expected skips on exe.dev.

## B. Failure path before the fix

The operator log from a node host on `v0.16.2` showed this output for `agro harness install hermes`:

```text
ERROR: HERMES_HOME is unset; recreate from the corrected image or export HERMES_HOME=/home/sandbox/.agro/workspaces/harness/.hermes in the launch environment before installing
ERROR: HERMES_HOME is unset; recreate from the corrected image or export HERMES_HOME=/home/sandbox/.agro/workspaces/harness/.hermes in the launch environment before installing
Remediation: bash .agro/scripts/link-providers.sh --init
agro harness: Hermes integration failed (exit 1); no installation success reported.
```

## C. Link-step failure output after the fix

Location: the task worktree in the sandbox, local. This direct script run keeps `HERMES_HOME` unset on purpose.

```bash
AGRO_PROJECT_ROOT=$PWD env -u HERMES_HOME bash .agro/scripts/link-providers.sh --init --hermes-only
```

```text
ERROR: HERMES_HOME is unset; recreate from the corrected image or export HERMES_HOME=/home/sandbox/harness/.worktrees/bug/1325-hermes-host-install-home/.hermes in the launch environment before installing
Remediation: resolve each ERROR above, set HERMES_HOME=/home/sandbox/harness/.worktrees/bug/1325-hermes-host-install-home/.hermes in the launch environment, then run agro harness install hermes
```

Exit status: 1. The `ERROR` line prints one time.

## Cleanup

```bash
gh release delete validate-hermes-host-install-home --repo mifunedev/agro --cleanup-tag --yes
```

`gh release view validate-hermes-host-install-home --repo mifunedev/agro` then exited 1. `git ls-remote --tags origin validate-hermes-host-install-home` printed no line. The latest release stayed `v0.16.2`. The driver deleted the VM.

## Not covered by the remote run

The VM workspace comes from the released image seed, so the remote run used the released `link-providers.sh`. Section C and `.agro/scripts/__tests__/hermes-links.test.ts` cover the US-002 output change.
