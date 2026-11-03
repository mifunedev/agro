# Decision brief: msb-base-image-spike

Outcome: stay on HEAD

Decision rule clause 2 decides the outcome. A1 failed `M03` in 3 of 3 runs.

## Inputs

- `msb` release: `v0.7.13` on every A1 run.
- A0: agro-console `n4` node in host mode, AGRO release `main@679f1f3d`.
- A1: `msb run --init auto` on an agro-console `n4` node, image `ghcr.io/mifunedev/agro:spike-msb-55c35cea4`, 2 GiB and 2 vCPU for each guest.
- A0 valid runs: `console-agro-rows-20261103-053838`, `-061540`, `-063332`; `console-msb-guest-20261103-054913`, `-063019`, `-064825`.
- A0 void runs: `055245`, `060936`, `061238`. A console outage made `agro node create`, `agro node list`, and `agro node delete` return `request failed: fetch failed`.
- A1 valid runs: `msb-agro-rows-20261103-080136`, `-083141`, `-092159`; `msb-guest-chain-20261103-081016`, `-084021`, `-093112`; `msb-restart-settled-20261103-082106`, `-085029`, `-094005`.
- The A1 logs from before the image fix (`050212`, `052033`, `052733`, `065142`, `073702`, `075338`) prove mechanics only. This brief takes no value from them.

All logs are under `.agro/tasks/msb-base-image-spike/evidence/`.

## Results

A timed row shows the median of 3 runs and the 3 values. Another row shows the pass count.

| Row | A0 | A1 |
|---|---|---|
| R01-docker | 3/3 (server 29.9.2) | SKIPPED: image mode, no host layer (daemon active) |
| R02-workspace | 3/3 (`agro 0.28.0 ref=main@679f1f3d`) | SKIPPED: image mode, workspace seeded from `/opt/agro-seed` |
| R02b-noninteractive-cli | 3/3 | SKIPPED: `agro-rows.sh` emits the row in host mode only |
| R03-docker-engine-host | SKIPPED: docker already runs in the base image | SKIPPED: image mode, no host layer |
| R04-cgroup-delegation | 3/3 | 3/3 |
| R05-sandbox-boot | 3/3, median 65 s (61, 70, 65) | 3/3, guest uptime 23 s at healthcheck in each run |
| R06-systemd | 3/3 (`pid1=docker-init`) | 3/3 (`systemd-modules-load.service` and `systemd-sysctl.service` failed, system `degraded`) |
| R07-container-restart | 3/3, median 4 s (3, 4, 4) | SKIPPED: image mode, no container |
| R08-vm-restart | SKIPPED: A0 ran no VM restart check | 3/3, median 18.7 s (18.7, 1158.4, 18.5) |
| R09-disconnect | 3/3 | 3/3 |
| R10-ssh-inbound | 3/3 | 3/3 |
| R11-https-port | SKIPPED: no adapter hook | SKIPPED: no adapter hook |
| R12-egress-tls | 3/3 | 3/3 |
| R13-time-to-shell | 3/3, median 133.2 s (126.7, 133.2, 165.2) | 3/3, median 218.5 s (218.5, 214.6, 232.0) |
| R14-hermes-install | 3/3 | 0/3: `smoke=64 ERROR: Hermes smoke requires sandbox user and no Docker socket` |
| R15-hermes-host-install | 2/3 (run `061540`: `exit=1`, `installing hermes failed`) | SKIPPED: `agro-rows.sh` emits the row in host mode only |
| M01-dockerd | 3/3 | 3/3 before restart, 3/3 after restart |
| M02-pid1 | 3/3 (`pid1=systemd`) | 3/3 before restart, 3/3 after restart |
| M03-restart-persist | SKIPPED: no microVM. A0-reboot: node host 0/3, sandbox container 0/3 (`docker=active tmux_has_session=1`) | 0/3: `docker=active tmux_has_session=1` |
| M04-idle-memory | median 440 MiB (486, 431, 440) | median 193 MiB (200, 192, 193); after restart 167 MiB (174, 165, 167) |
| M05-snapshot-restore | SKIPPED: no microVM | 0/3: restored guest stays `pid1=init.krun` after 36 tries |
| M06-image-size | SKIPPED: no `IMAGE_SIZE_BYTES` from the driver | 2089 MiB in each run |

## Cost per tenant

Price source: `/home/sandbox/.agro/workspaces/harness/projects/mifunedev/agro-console/packages/shared/src/provider-catalog.json`, lines 25 to 33. Plan `n4` is OVH flavor `d2-4` with 2 vCPU and 4 GB. The catalog sets `hourlyCustomerPriceUsd` to `0.045` and `hourlyProviderCostUsd` to `0.0256`.

The spike did not measure usable node memory. The A1 rows below use 4096 MiB as an upper bound. The real tenant count is lower than or equal to the count in each row.

| Arm | Tenants per node | Customer price per tenant per hour | Provider cost per tenant per hour |
|---|---|---|---|
| A0 | 1 | $0.0450 | $0.0256 |
| A1, median `M04` 193 MiB | floor(4096 / 193) = 21 | $0.0450 / 21 = $0.0021 | $0.0256 / 21 = $0.0012 |
| A1, allocated guest 2048 MiB | floor(4096 / 2048) = 2 | $0.0450 / 2 = $0.0225 | $0.0256 / 2 = $0.0128 |

Each A1 row gives a lower cost than A0. Decision rule clause 3 does not decide the outcome, because clause 2 applies first.

## Decision rule

1. Clause 1 does not apply. US-001 found `/dev/kvm` on the node.
2. Clause 2 applies. A1 passed `R05`, `R06`, `M01`, and `M02` in 3 of 3 runs. A1 failed `M03` in 3 of 3 runs. Clause 2 decides the outcome.

## Findings

- `M03` compares unlike events. On A1, `msb stop` and `msb start` do a full VM reboot, and a reboot ends every `tmux` session. The US-005 A0 runs had no node reboot, so those runs report `M03` as `SKIPPED`. US-009 adds the A0 value for the same event. `R08-vm-restart` on A1 passed 3 of 3 runs, with `docker` active and the workspace files intact after the reboot.
- The A0-reboot check (US-009) runs `M03` across a full A0 node reboot. Logs: `a0-reboot-1-20261103-162614`, `a0-reboot-2-20261103-163036`, `a0-reboot-3-20261103-163526`. Before each reboot, the check started `agro-mx-probe` on the node host and `agro-mx-probe-ctr` in the sandbox container. After `sudo systemctl reboot`, SSH answered in 26.6 s, 27.2 s, and 26.6 s. `docker` was active, and the sandbox container was healthy again after 35.0 s, 35.3 s, and 35.0 s. Both `tmux` sessions were gone in 3 of 3 runs. Thus A0 also fails `M03` after the same event. The `M03` failure on A1 shows a property of a reboot, not a defect of the microVM layer. The outcome does not change, because clause 2 counts only A1 runs.
- `M05` fails because the restored guest never reaches systemd. In `msb` `v0.7.13`, `msb snap restore` has no init handoff. The restored guest stays `pid1=init.krun` with system state `offline`. The snapshot step took 9.9 s, 6.5 s, and 4.7 s.
- `R14` fails on A1 because the check precondition conflicts with the A1 design. The Hermes smoke script refuses a Docker socket. The `agro-msb` image runs `dockerd` in the guest, so the guest has a Docker socket. The Hermes install itself exited 0 in each run.
- The spike found these `msb` lifecycle requirements:
  - Under `--init auto`, `msb` also runs the image `CMD`. The `CMD` must stay alive, so `agro-msb` sets `CMD ["sleep","infinity"]`. With `CMD ["/sbin/init"]`, the command exits 1 and `msb` shuts down the guest.
  - The guest maps `ctrl-alt-del.target` to `poweroff.target`. Without this map, guest systemd enters `reboot.target` and the guest drains.
  - The `sandbox` user needs the `kvm` group in a new login session.
  - `~/.microsandbox` must not be group-writable.
  - The default 512 MiB guest drains under `--init auto`. The spike sets 2 GiB and 2 vCPU for each guest.
- The console infrastructure had 2 issues:
  - In the US-001 probe, the console status stayed `waiting_for_boot` for 903 s, but SSH answered on the first attempt. The advisor attributes this to a tunnel and port mismatch. `kvm-probe.log` does not record the cause. Thus `create_return_s` and `R13` include console delay, not only node boot time.
  - An outage of the console web process voided A0 runs `055245`, `060936`, and `061238`.
- A1 run `085029` reports `restart_to_settled_s=1158.4` and `remaining agro-matrix resources on msb: 1`. The sequencer deleted node `8f87c7ae-4a07-40cc-af0d-73c8163a58e2` on retry. The `R08` median excludes no run, so the outlier stays in the values.

## Deviations

- The 2 arms used different AGRO commits. A0 ran release `main@679f1f3d`. A1 ran the branch image `spike-msb-55c35cea4`. PRD US-005 requires the same AGRO commit.
- The operator kept the spike code. PRD US-006 requires the task PR to remove the `agro-msb` stage and `adapters/msb.sh` on a `stay on HEAD` outcome. The operator made this decision on 2026-11-03.
