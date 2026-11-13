# Evidence: warm pool and pause protocol

This folder is local evidence. Git ignores it (`.agro/tasks/*/*`). Never edit a file under `runs/`.

## Commands

```bash
PIN_AGRO_VERSION=0.28.0 bash driver.sh e1 nprime agro [--docker] [--label X]
PIN_AGRO_VERSION=0.28.0 bash driver.sh e1 h sandbox
PIN_AGRO_VERSION=0.28.0 bash driver.sh e6 a 1g
bash driver.sh e6 v 4g --dry-run
python3 -I verdict.py
python3 -I verdict.py --fixture fixtures/pass
bash fixtures/test.sh
```

One call runs one sample. The caller repeats calls, interleaves the series, and repeats each invalid run.

Environment:

| Variable | Use |
|---|---|
| `PIN_AGRO_VERSION` | Required. A run with another AGRO version is invalid. |
| `AGRO_CONSOLE_TOKEN_FILE` | Bearer token file for the pause and resume API (e6 a). The default is the session `console-api.tok`. The driver writes the header to a 0600 temporary file and never prints the token. |
| `AGRO_CONSOLE_URL` | Default `http://127.0.0.1:3006`. |
| `AGRO_CONSOLE_REPO` | The agro-console checkout for `console_commit`. |
| `DRIVER_PREFLIGHT_WAIT_S` | Default 600. |

The `agro node` verbs use `AGRO_CONSOLE_URL` only when `AGRO_CONSOLE_TOKEN` is set. Otherwise they use the credentials file. The preflight stops the run (exit 3) when `agro node list` names a node that is not in the local database.

Exit codes: 0 valid sample, 2 usage, 3 preflight failed after the wait, 4 missing hook, 5 invalid sample, 6 failed sample, 7 a created node is still live at exit.

## Run log: `runs/<experiment>-<arm>-<variant>-<UTC ts>.json`

The driver writes a `.log` transcript next to each log. Times are epoch milliseconds. Durations are seconds from `t_request`.

| Field | Meaning |
|---|---|
| `experiment`, `arm`, `profile`, `size`, `label`, `docker` | Series identity. `size` is `small`, `1g`, or `4g` for e6, else null. |
| `node_id`, `pooled_at` | The claimed row. `pooled_at` null means a cold node. |
| `t_request` | e1: create request. e6 a: resume request. e6 v: create request of the restore node. |
| `claim_start` | First `node_events` `bootstrapping` with `detail.reason = bind` at or after `t_request` (e6 a: first `bootstrapping`). |
| `ack` | First `running` event at or after `claim_start`. |
| `ssh_s` | First SSH success. The probe runs every 0.5 s from `claim_start`. |
| `usable_s` | First usable probe success. agro: `agro workspace list` lists `harness`, code-server `127.0.0.1:8080` returns 200, and T3 `127.0.0.1:3773` returns 200. sandbox: `docker info` exits 0. |
| `usable_components` | The last probe result, for example `{"ws":"1","cs":"200","t3":"200"}`. |
| `valid`, `invalid_reason` | False when `pooled_at` is null on a warm claim, the console is unreachable at any 2 s check, the AGRO version differs from the pin, the preflight failed, or an e6 a resume lands on the same OVH instance. |
| `failed`, `failure_reason` | True when the usable probe times out (e1 300 s, e6 600 s) or a hook exits nonzero. |
| `agro_version`, `pin_agro_version` | Node version from `agro --version` over SSH (agro profile), else `nodes.agro_version`. |
| `image` | `image_id`, `image_key`, `pool_cloud_init_sha256` from `nodes`. |
| `archive_sha256` | From the hook output when the hook reports it. |
| `console_commit` | `git rev-parse HEAD` of agro-console. |
| `parity` | agro profile only: `{usable, claim_ack, docker_on, docker_off}`. The run tests one Docker state. The other field is null. |
| `hook` | Each hook's JSON output under its name (`after_claim`, `setup`, `pause`, `restore`). `hook.attach_mount_s` is promoted from any hook. |
| e6 only | `pause_request`, `paused_s`, `pause_to_usable_s`, `seed`, `scope_before`, `scope`, `instance` `{before, after}`. |
| `cleanup` | `{deleted, live_after}`. |

## Hook contract (`arms/<arm>/<name>.sh`)

The driver runs a hook when the arm needs one. A missing or non-executable required hook stops the driver with exit 4 before any create.

| Hook | Arguments | Required for | Job |
|---|---|---|---|
| `arms/h/after-claim.sh` | `<ip> <logfile>` | e1 h agro | Runs after SSH works on a claimed `sandbox` node. Fetch, verify, and extract the L2a archive, install root files and units, and start the apps. Honor `DRIVER_DOCKER`. |
| `arms/v/setup.sh` | `<ip> <logfile>` | e6 v | Before the seed: create and attach the OVH volume, and mount `/home/sandbox` and the Docker data root on it. Stop at the $10 cap with a nonzero exit. |
| `arms/v/pause.sh` | `<node_id> <ip> <logfile>` | e6 v | Stop Docker, unmount, and detach the volume. The driver then deletes the node. |
| `arms/v/restore.sh` | `<node_id> <ip> <logfile>` | e6 v | Runs on the new warm node after its create finishes. Attach and mount the volume, and start Docker. |

Environment for every hook: `DRIVER_NODE_ID`, `DRIVER_DOCKER` (`true` or `false`), `DRIVER_SIZE`, `DRIVER_PROFILE`, `DRIVER_SSH_OPTS`. A hook may append to the log file. The last stdout line, when it is a JSON object, goes into `hook.<name>`. Use `archive_sha256` for the archive digest and `attach_mount_s` for the V attach-to-mount time. A nonzero exit marks the run failed. A hook never deletes the node; the driver trap deletes it.

## Seed and scope

`lib/seed.sh <small|1g|4g>` runs on the node through `ssh ... bash -s`. It creates `~/seed/workspace` (a git repository with one commit), pulls `alpine:3.20` and `busybox:1.36`, runs container `seedc` with volume `seedvol`, installs apt package `sl`, and writes random filler of 0, 1024, or 4096 MiB to `~/seed/filler/blob`. It prints `~/seed/manifest.json`.

`lib/scope-probe.sh` prints one JSON object. Each key has the value `kept` or `lost`: `home`, `git_workspace`, `filler`, `docker_images`, `containers`, `volumes`, `apt_package`.

## Verdict inputs

`verdict.py` drops a run when `valid` is not true, when an e1 run has `pooled_at` null, or when a run that did not fail has no `usable_s`. A series passes with n ≥ 10, median ≤ bar, nearest-rank p90 ≤ 1.5 × bar, and 0 failures. Bars: e1 agro 32 s, e1 sandbox 20 s, e6 v 29 s at each size. e6 a has no bar and shows `RECORDED`.

| Line | Source | Format |
|---|---|---|
| E1 | e1 runs | H passes when `h agro` and `h sandbox` both pass. N′ is shown for reference. |
| E2 | `residue/summary.json` | `{"h_extra_entries": int or list, "h_agro_files_extra": int or list, "noise_floor_entries": int or list}`. Passes when both H counts are 0. |
| E3 | e1 h agro runs | Passes when n ≥ 10, no failure, every `parity.usable` and `parity.claim_ack` is true, no parity field is false, and at least one run has `docker_on` true and one has `docker_off` true. |
| E4 | `maintenance.json` | `{"nprime_total": int, "h_total": int}`. Favors H when `h_total < nprime_total`. |
| E5 | `scope-A.json`, `scope-V.json` | The `scope-probe.sh` object. V passes when `home`, `docker_images`, `containers`, and `volumes` are `kept`. |
| E6 | e6 runs | V passes at every size. Lines also show `pause_to_usable` and `attach_mount` medians. |
| E7 | `cost.json` | `{"v_monthly_usd_1g": number, "v_monthly_usd_4g": number}`. Passes when both are at most 2.00. |

A missing input prints `E<n>: PENDING (missing <file>)`. With `--fixture <dir>`, the script reads runs and inputs from that directory.

Fixtures: `fixtures/pass` (PASS), `fixtures/fail` (p90 above 1.5 × bar), `fixtures/invalid` (two `pooled_at` null runs dropped), `fixtures/inputs` (E2, E4, E5, E6, E7 inputs). `bash fixtures/test.sh` checks each fixture.
