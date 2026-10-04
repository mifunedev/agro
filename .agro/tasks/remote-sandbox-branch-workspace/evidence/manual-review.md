# Manual review evidence: remote-sandbox-branch-workspace

## A. Remote-sandbox run with AGRO_REF

Prerequisites: the operator approved the push of `feat/1327-remote-sandbox-branch-workspace` and one billable exe.dev VM. The pushed head was `0eefaae0`.

Location: the advisor ran the driver in the sandbox, local, in tmux session `rs-1327`. The checks ran on a fresh exe.dev VM in host mode. The CLI came from the released `0.17.0`.

```bash
AGRO_REF=feat/1327-remote-sandbox-branch-workspace \
  bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/agro-rows.sh
```

Log: `exedev-agro-rows-20261004-112539.log` (advisor scratchpad). Lines from the log, unedited:

```text
build under test: install=release agro_js=release sandbox_image=cli default agro_ref=feat/1327-remote-sandbox-branch-workspace vm_image=provider default
== mode=host user=exedev kernel=6.12.93 cgroupfs=cgroup2fs
RESULT R13-time-to-shell PASS 1.9s
RESULT R04-cgroup-delegation PASS already delegated: cpuset cpu io memory pids
RESULT R02b-noninteractive-cli PASS agro runs in a non-interactive shell
RESULT R02-workspace PASS agro 0.17.0 ref=feat/1327-remote-sandbox-branch-workspace@0eefaae0
RESULT R03-docker-engine-host SKIPPED docker already running in base image
RESULT R01-docker PASS server=29.1.3 cgroup=2 driver=systemd
RESULT R05-sandbox-boot PASS 22s
RESULT R06-systemd PASS failed units:
RESULT R07-container-restart PASS 3s
RESULT R12-egress-tls PASS eec6b976695f
RESULT R15-hermes-host-install PASS
RESULT R14-hermes-install PASS install=0
SUMMARY fails=0
RESULT R09-disconnect PASS tmux session survives the client exit
RESULT R10-ssh-inbound PASS ssh agro-mx-1004-112539.exe.xyz
RESULT R11-https-port SKIPPED proxy answers 307: private by default, needs share
1 VM deleted successfully
remaining agro-matrix resources on exedev: 0
RUN DONE
```

Exit status: the driver ended with `RUN DONE` and 0 remaining resources. The check reported `SUMMARY fails=0`.

Result: `R02-workspace` reports `ref=feat/1327-remote-sandbox-branch-workspace@0eefaae0`. That ref equals the pushed head, so the VM workspace used the branch.

## B. Default behavior without AGRO_REF

`.agro/scripts/__tests__/remote-sandbox.test.ts` asserts `agro_ref=default branch` on the `build under test:` line and `CHECK AGRO_REF=unset` in the check when `AGRO_REF` is unset.

## Cleanup

The driver deleted the VM. The run created no other resource.
