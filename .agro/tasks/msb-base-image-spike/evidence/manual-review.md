# Manual review: A1 run 3

This file holds the commands and outputs of A1 run 3 of the msb base-image spike.
Each block quotes a log under `.agro/tasks/msb-base-image-spike/evidence/`.
The symbol `…` marks trimmed lines.
The author of this file created no new live resource.

## Operator approval

The operator approved the live runs on 2026-11-03 in the plan approval.
The operator approved the use of the agro-console free tier in the same decision.
Each run used one free-tier node. Each run deleted its node before the next run started.

## Sequence

Source: `driver-seq3.out`. The driver script is `seq3.sh`.

```text
== a1 run 3 agro-rows start 2026-11-03T09:21:59Z
log: …/evidence/msb-agro-rows-20261103-092159.log
== a1 run 3 agro-rows exit=0 end 2026-11-03T09:31:12Z
== a1 run 3 chain start 2026-11-03T09:31:12Z
log: …/evidence/msb-guest-chain-20261103-093112.log
== a1 run 3 chain exit=0 end 2026-11-03T09:40:05Z
== a1 run 3 restart start 2026-11-03T09:40:05Z
log: …/evidence/msb-restart-settled-20261103-094005.log
== a1 run 3 restart exit=0 end 2026-11-03T09:49:54Z
A1-ALL-DONE
```

The driver ran these commands for run 3:

```bash
bash "$SK/scripts/run.sh" msb checks/agro-rows.sh
bash "$E/a1-guest-chain.sh"
bash "$SK/scripts/restart-test.sh" msb settled
```

The chain script `a1-guest-chain.sh` runs `checks/msb-guest.sh` in the guest in three phases.
The phases are `pre`, `restart`, and `restore`.

## A. The msb-guest.sh chain

Source: `msb-guest-chain-20261103-093112.log`, started 2026-11-03T09:31:12Z.

### A1. Create the node and the guest

```text
== msb chain agro-mx-1103-093112 image=ghcr.io/mifunedev/agro:spike-msb-55c35cea4 adapter=41169af93 date=2026-11-03T09:31:12Z
agro node create: node 52e53618-5df8-4b65-83b7-719b8761ac01 queued
…
agro node create: node 52e53618-5df8-4b65-83b7-719b8761ac01 running
{"id":"52e53618-5df8-4b65-83b7-719b8761ac01","status":"running","ssh":"ssh sandbox@ssh-bright-oak-sw96gx.mifune.dev"}
…
info Latest version: v0.7.13
…
done Checksum verified
…
done Installation complete! Run 'msb --help' to get started.

agro-mx-1103-093112
msb: agro-mx-1103-093112 pid1=systemd system=degraded
create rc=0
TIMING create_return_s=154.9 first_shell_s=155.4
```

The line `pid1=systemd` shows the systemd handoff in the guest.

### A2. Phase pre

```text
== phase pre guest=agro-mx-1103-093112
started
phase pre run_detached rc=0
== mode=microvm phase=pre user=root kernel=6.12.113
== M01
RESULT M01-dockerd PASS docker=active hello-world=ok
== M02
RESULT M02-pid1 PASS pid1=systemd
== M03
RESULT M03-restart-persist SKIPPED probe session agro-mx-probe created; run MSB_GUEST_PHASE=restart after msb stop and msb start
== M04
RESULT M04-idle-memory PASS 193MiB after 60s idle
== M05
RESULT M05-snapshot-restore SKIPPED phase pre checks M05 only in MSB_GUEST_PHASE=restore
== M06
RESULT M06-image-size PASS 2089MiB
SUMMARY fails=0
```

- `M01` runs `docker run --rm hello-world`. The result is `hello-world=ok`.
- `M02` reads PID 1 with `ps -p 1 -o comm=`. The result is `pid1=systemd`.
- `M03` creates the `tmux` session `agro-mx-probe` before the restart.

### A3. Run msb stop and msb start

```text
  ✓ Stopped             agro-mx-1103-093112 (0.8s)
  ✓ Started             agro-mx-1103-093112 (1.0s)
msb: agro-mx-1103-093112 pid1=systemd system=degraded
restart rc=0
TIMING msb_restart_to_systemd_s=9.1
```

### A4. Phase restart

```text
== phase restart guest=agro-mx-1103-093112
started
phase restart run_detached rc=0
== mode=microvm phase=restart user=root kernel=6.12.113
== M01
RESULT M01-dockerd PASS docker=active hello-world=ok
== M02
RESULT M02-pid1 PASS pid1=systemd
== M03
RESULT M03-restart-persist FAIL docker=active tmux_has_session=1
== M04
RESULT M04-idle-memory PASS 167MiB after 60s idle
== M05
RESULT M05-snapshot-restore SKIPPED phase restart checks M05 only in MSB_GUEST_PHASE=restore
== M06
RESULT M06-image-size PASS 2089MiB
SUMMARY fails=1
```

`M03` runs `tmux has-session -t agro-mx-probe` after the restart.
The exit status `tmux_has_session=1` shows that the session `agro-mx-probe` is absent.
Before the restart, the session existed. After `msb stop` and `msb start`, the session did not exist.
`brief.md` records this `M03` failure in 3 of 3 runs.

### A5. Snapshot and restore

```text
== snapshot restore
  ✓ Stopped             agro-mx-1103-093112 (0.7s)
  ✓ Snapshotted         agro-mx-1103-093112 (2.5s)
snap_9172fa0cb4cf2f95eb05c254f101343c
…
group agro-mx-1103-093112: head snap_9172fa0cb4cf2f95eb05c254f101343c (Initialized)
msb: agro-mx-1103-093112-r pid1=init.krun system=offline after 36 tries, systemd handoff not complete
TIMING snapshot_restore_s=4.7 systemd_s=212.6
snapshot_restore rc=1
RESULT M05-snapshot-restore FAIL msb_snapshot_restore rc=1: restored guest did not reach pid1=systemd within 36 tries
```

### A6. Delete the node

```text
== destroy agro-mx-1103-093112
deleted 52e53618-5df8-4b65-83b7-719b8761ac01
remaining agro-matrix resources on msb: 0
RUN DONE
```

The node delete also removes the guests `agro-mx-1103-093112` and `agro-mx-1103-093112-r` and the snapshot, because they live on the node.

## B. restart-test.sh msb settled

Source: `msb-restart-settled-20261103-094005.log`, started 2026-11-03T09:40:05Z.

```text
== msb agro-mx-rs-settled-094005 mode=settled image=ghcr.io/mifunedev/agro:spike-msb-55c35cea4 date=2026-11-03T09:40:05Z
agro node create: node 10c814e2-2723-4737-ac76-f8beb4a7c9f7 queued
…
agro node create: node 10c814e2-2723-4737-ac76-f8beb4a7c9f7 running
TIMING create_return_s=227.3 first_shell_s=227.8 healthy_s=228.4
settling 300s
written
  ✓ Stopped             agro-mx-rs-settled-094005 (1.1s)
  ✓ Started             agro-mx-rs-settled-094005 (2.1s)
msb: agro-mx-rs-settled-094005 pid1=systemd system=degraded
state: active
marker: marker
590 /home/sandbox/harness/agro.json
1362 /home/sandbox/harness/package.json
69345 /home/sandbox/harness/pnpm-lock.yaml
ext4_recovery_lines: 1
TIMING restart_to_settled_s=18.5
RESULT R08-vm-restart PASS mode=settled
== destroy agro-mx-rs-settled-094005
deleted 10c814e2-2723-4737-ac76-f8beb4a7c9f7
remaining agro-matrix resources on msb: 0
RUN DONE
```

After `msb stop` and `msb start`, PID 1 is `systemd`.
The bootstrap state is `active`. The marker file and the workspace files are intact.

## C. agro-rows.sh on the guest

Source: `msb-agro-rows-20261103-092159.log`, started 2026-11-03T09:21:59Z.

```text
== msb agro-mx-1103-092159 check=agro-rows.sh image=ghcr.io/mifunedev/agro:spike-msb-55c35cea4 date=2026-11-03T09:21:59Z
agro node create: node 7e433dcd-d5d8-425f-95c9-bcd1f9594a54 queued
…
agro node create: node 7e433dcd-d5d8-425f-95c9-bcd1f9594a54 running
…
agro-mx-1103-092159
msb: agro-mx-1103-092159 pid1=systemd system=degraded
TIMING create_return_s=231.3 first_shell_s=232.0
…
RESULT R13-time-to-shell PASS 232.0s
RESULT R04-cgroup-delegation PASS already delegated: cpuset cpu io memory pids
…
RESULT R05-sandbox-boot PASS bootstrap active, healthcheck ok, uptime 23s
RESULT R06-systemd PASS failed units: systemd-modules-load.service systemd-sysctl.service 
…
RESULT R12-egress-tls PASS 679f1f3dfb82
…
RESULT R14-hermes-install FAIL install=0 smoke=64 ERROR: Hermes smoke requires sandbox user and no Docker socket 
…
SUMMARY fails=1
== driver rows
RESULT R09-disconnect PASS tmux session survives the client exit
RESULT R10-ssh-inbound PASS ssh sandbox@ssh-serene-kestrel-rvfpn8.mifune.dev
RESULT R11-https-port SKIPPED no adapter hook
== destroy agro-mx-1103-092159
deleted 7e433dcd-d5d8-425f-95c9-bcd1f9594a54
remaining agro-matrix resources on msb: 0
RUN DONE
```

## D. Guest state from msb ls

Source: `a1-smoke3-diag.txt`, captured 2026-11-03T08:01:23Z on the smoke run before run 1.

```text
# smoke3 agro-mx-1103-075338 2026-11-03T08:01:23Z
NAME                   IMAGE                                         STATUS     CREATED
agro-mx-1103-075338    ghcr.io/mifunedev/agro:spike-msb-55c35cea4    running    2026-11-03 07:56:39
```

Source: `driver-seq3.out`.

```text
smoke3 guest state at end: running
deleted 77b413ad-5b98-4912-b41b-0fb08267c7a2
smoke3 destroy rc=0 remaining=0
SMOKE3-OK
```

## Resources and deletions

| Resource | Created in | Deletion line |
|---|---|---|
| Node `7e433dcd-d5d8-425f-95c9-bcd1f9594a54` | `msb-agro-rows-20261103-092159.log` | `deleted 7e433dcd-d5d8-425f-95c9-bcd1f9594a54` |
| Node `52e53618-5df8-4b65-83b7-719b8761ac01` | `msb-guest-chain-20261103-093112.log` | `deleted 52e53618-5df8-4b65-83b7-719b8761ac01` |
| Node `10c814e2-2723-4737-ac76-f8beb4a7c9f7` | `msb-restart-settled-20261103-094005.log` | `deleted 10c814e2-2723-4737-ac76-f8beb4a7c9f7` |

After each deletion, the driver reports `remaining agro-matrix resources on msb: 0`.
The final `guard final` step in `seq3.sh` found no live `agro-mx-` node, and the driver printed `A1-ALL-DONE`.

## Reviewer steps

Each step creates one live free-tier node. Run a step only with operator approval.
Run the steps one at a time, because the free tier allows one live node.

### 1. Set the environment

Prerequisites: you signed in to the `agro` CLI, and the agro-console server runs at `AGRO_CONSOLE_URL`.
Location: sandbox, local, from the root of the task worktree.

```bash
export AGRO_CONSOLE_URL=http://127.0.0.1:3006
export CONSOLE_SSH_IDENTITY=<path to the console SSH private key>
export CONSOLE_SPEC=n4
export IMAGE=ghcr.io/mifunedev/agro:spike-msb-55c35cea4
export IMAGE_SIZE_BYTES=2190546500
export MSB_VERSION=v0.7.13
export SK=$PWD/.agro/skills/remote-sandbox
export MATRIX_OUT=$PWD/.agro/tasks/msb-base-image-spike/evidence
```

Expected exit status: 0.

### 2. Run agro-rows.sh on the guest

Prerequisites: step 1. No live `agro-mx-` node exists.
Location: sandbox, local. The check runs on a remote node.

```bash
bash .agro/skills/remote-sandbox/scripts/run.sh msb .agro/skills/remote-sandbox/checks/agro-rows.sh
```

Expected output, from `msb-agro-rows-20261103-092159.log`:

```text
msb: agro-mx-1103-092159 pid1=systemd system=degraded
RESULT R05-sandbox-boot PASS bootstrap active, healthcheck ok, uptime 23s
RESULT R06-systemd PASS failed units: systemd-modules-load.service systemd-sysctl.service 
RESULT R14-hermes-install FAIL install=0 smoke=64 ERROR: Hermes smoke requires sandbox user and no Docker socket 
SUMMARY fails=1
remaining agro-matrix resources on msb: 0
RUN DONE
```

Expected exit status: 0. The driver deletes its node.

Failure path. Run the driver with the provider name `nosuchprovider`. No adapter has this name.

```bash
bash .agro/skills/remote-sandbox/scripts/run.sh nosuchprovider
```

Expected output: `usage: run.sh <console|exedev|msb|vercel> [<check>|--preflight]`. Expected exit status: 2.
This failure path creates no resource.

### 3. Run the msb-guest.sh chain

Prerequisites: step 1. No live `agro-mx-` node exists.
Location: sandbox, local. The check runs in a guest on a remote node.

```bash
bash .agro/tasks/msb-base-image-spike/evidence/a1-guest-chain.sh
```

The script prints the log path and writes the run to that log.
Expected log lines, from `msb-guest-chain-20261103-093112.log`:

```text
RESULT M01-dockerd PASS docker=active hello-world=ok
RESULT M02-pid1 PASS pid1=systemd
RESULT M03-restart-persist SKIPPED probe session agro-mx-probe created; run MSB_GUEST_PHASE=restart after msb stop and msb start
…
RESULT M03-restart-persist FAIL docker=active tmux_has_session=1
…
RESULT M05-snapshot-restore FAIL msb_snapshot_restore rc=1: restored guest did not reach pid1=systemd within 36 tries
deleted 52e53618-5df8-4b65-83b7-719b8761ac01
remaining agro-matrix resources on msb: 0
RUN DONE
```

Expected exit status: 0. The `RESULT` lines carry the check outcome.

### 4. Run the restart test

Prerequisites: step 1. No live `agro-mx-` node exists.
Location: sandbox, local. The test runs on a remote node.

```bash
bash .agro/skills/remote-sandbox/scripts/restart-test.sh msb settled
```

Expected output, from `msb-restart-settled-20261103-094005.log`:

```text
msb: agro-mx-rs-settled-094005 pid1=systemd system=degraded
state: active
marker: marker
TIMING restart_to_settled_s=18.5
RESULT R08-vm-restart PASS mode=settled
remaining agro-matrix resources on msb: 0
RUN DONE
```

Expected exit status: 0.

### 5. Cleanup

Prerequisites: step 1. Location: sandbox, local.
Do this step after each of steps 2 to 4, and after an interrupted step.

```bash
agro node list --json
```

Find each node with the `name` prefix `agro-mx-` and a `status` other than `destroyed`.
Delete each of these nodes:

```bash
agro node delete <id> --yes
```

Expected output: `deleted <id>`. Expected exit status: 0.
Run `agro node list --json` again. Expected result: no `agro-mx-` node has a `status` other than `destroyed`.
