# US-011 journey transcript

Console: `http://localhost:3006`, the US-010 prototype (agro-console `task/1557-nprime-pause-notice` @ `20b522ca`), `features.pauseScopeNotice: true`. Warm pools at the start: agro n4 1/1 (`0fa08d49`, pooled 15:46:14Z) and sandbox n4 1/1 (`6e41c915`, pooled 06:08:33Z). Date: 2026-11-04. All times are UTC.

Browser: agent-browser 0.38.1, session `wppp-journey-88d5ded922fd`, desktop 1280x720, signed in as `dev@agro.local`, context `dev` (Personal).

Order: one live journey node at a time. Step 1, then Step 3 on the same agro node, then destroy it. Then Step 2, then destroy it. Then Step 4.

Screenshot selectors: before each annotated screenshot, the worker tagged each target element with a `data-journey` attribute (an exact-text match inside `main`). The callout selectors are `[data-journey=<name>]` and `[role=alertdialog]`.

## Step 1: create an agro node

UI: Create node, Free, Agro, Browser editor (code-server) on, T3 Code on, Docker on, name `wp-journey-agro`, Create free node.

- Create click: 16:38:52.694.
- The claim bound pool VM `0fa08d49-4d9f-466e-85be-6a391827be15` (IP 40.160.5.227). The page URL changed at 16:39:08.

`node_events` for the claim:

```text
bootstrapping|16:38:56.032   {"reason": "bind"}
running|16:39:22.739
boot_phase_t3_ready|16:39:32.848
```

- Create click to `running`: 30.0 s. Bind to `running`: 26.7 s.
- The node page showed `Running`, with Connect enabled.

The first attempt's node-page screenshot was replaced by the rerun (see "Step 1 rerun" below). `step-1-agro-running.png` now shows `wp-journey-agro-2`.

### Editor, first attempt: BLOCKED

Connect opened a new tab, `https://cs-witty-hawk-lpwv0d.mifune.dev/__agro/launch?...`. The tab then showed Cloudflare `502: Bad gateway`. The page stayed on 502 for over 60 s, and the result was the same after a reload and after a second Connect (16:46:30). The editor did not open, so the journey has no Create-to-editor time.

Screenshot: `step-1-editor-502.png`

Callouts: 1 is the gateway error. 2 is the editor host.

Cause, from the node sshd log (`sudo journalctl -u ssh`):

```text
/etc/ssh/authorized_keys/agroproxy:1: Authentication tried for agroproxy with correct key but not from a permitted host (host=40.160.94.106, ip=40.160.94.106, required=40.160.8.140/32).
error: Refused by key options
```

- This host egresses from `40.160.94.106` (`curl https://api.ipify.org`).
- The gateway key on the node is pinned to `from="40.160.8.140/32"` (`/etc/ssh/authorized_keys/agroproxy` and `agro-terminal`). The provisioner writes the pin from `PROVISIONER_EGRESS_IP` (`packages/shared/src/host-management-assets.ts:281`, `apps/provisioner/src/config.ts:126`).
- code-server itself was healthy on the node: `systemctl is-active agro-code-server` printed `active`, and `curl http://127.0.0.1:8080/healthz` printed `{"status":"expired",...}`.
- The fix is to set `PROVISIONER_EGRESS_IP` to the current egress IP and restart the provisioner, then refill the pools. That needs a server restart, which the dispatch rules forbid. The worker did not change it. The advisor made the fix later (see "Step 1 rerun").

## Step 3: pause and resume on the agro node

Over SSH as `sandbox@40.160.5.227` (exit 0):

```text
$ docker volume create jv
jv
$ docker run -d --name jc -v jv:/data busybox sh -c 'echo hi >/data/f; sleep infinity'
7e7eeb2773b1...
$ docker exec jc cat /data/f
hi
$ echo journey-$(date -u +%FT%TZ) > /home/sandbox/journey-marker.txt
journey-2026-11-04T16:49:42Z
$ docker ps
jc Up 3 seconds
```

UI: Pause. The confirmation dialog `Pause wp-journey-agro?` showed the notice "Pause keeps the home directory. Pause does not keep Docker data or system packages."

Screenshot: `step-3a-pause-notice.png`

Callouts: 1 is the Pause confirmation dialog. 2 is the pause scope notice. 3 is Pause node.

Pause node click: 16:50:25.722. `node_events`:

```text
pausing|16:50:38.593
recovery_point_created|16:51:34.941   {"kind": "pause", "format": "archive"}
paused|16:51:36.559
```

`nodes.status` read `pausing` until about 17:06:56. The prototype web process also exited at 17:06:56 (`../web-exits.txt`). The node page showed `Paused` after that.

Screenshot: `step-3b-paused.png`

Callouts: 1 is the agro node name. 2 is the Paused status. 3 is Resume.

Screenshot: `step-3b-paused-snapshot-card.png` (the snapshot card sits below the 720 px fold, so it has its own screenshot)

Callouts: 1 is the Snapshot card. 2 is the pause scope notice.

UI: Resume, then Resume node. Resume node click: 17:08:18.453. `node_events`:

```text
resuming|17:08:29.396
running|17:09:18.956     {"poolNodeId": "249b7b7a-0f89-4f3d-a2ed-7cff339b9024"}
vm_swapped|17:09:18.956
```

- Resume click to `running`: 60.5 s. `resuming` to `running`: 49.6 s.
- New VM IP: 40.160.15.242.

Screenshot: `step-3c-resumed.png`

Callouts: 1 is the agro node name. 2 is the Running status after Resume. 3 is the new VM address.

Over SSH as `sandbox@40.160.15.242` after resume:

```text
$ docker ps -a                 -> (no rows)
$ docker inspect jc            -> exit=1
$ docker volume inspect jv     -> exit=1
$ docker images busybox        -> (no rows)
$ cat /home/sandbox/journey-marker.txt
journey-2026-11-04T16:49:42Z   exit=0
```

Result under A: the container `jc`, the volume `jv`, and the busybox image are lost. The file in `/home/sandbox` survived.

UI: Destroy, then Destroy node, at 17:10:06. `nodes.status` was `destroyed` at 17:10:22.

## Step 2: create a sandbox node

UI: Create node, Free, Sandbox, Docker on, name `wp-journey-sandbox`, Create free node.

- Create click: 17:11:05.513.
- The claim bound pool VM `6e41c915-1074-4e1a-8446-072934ff1485` (IP 135.148.101.21).

```text
bootstrapping|17:11:10.456
running|17:11:20.450
```

- Create click to `running`: 14.9 s. Bind to `running`: 10.0 s.

Over SSH as `sandbox@135.148.101.21`:

```text
$ docker info --format '{{.ServerVersion}}'
29.9.3
docker info exit=0
$ command -v agro
command -v agro exit=1
```

Screenshot: `step-2-sandbox-running.png`

Callouts: 1 is the sandbox node name. 2 is the Running status. 3 is the SSH address.

UI: Destroy, then Destroy node. `nodes.status` was `destroyed` at 17:12:11.

## Step 4: N′ pool state

US-009 picked N′, not H. The "one pool for each spec" check therefore does not apply. This step shows the N′ state instead: one agro pool and one sandbox pool for n4. Step 4 has no screenshot. The database is the source.

Journey start, 16:36 (`select id, profile, spec, status, pooled_at from nodes where status not in ('destroyed')`, pooled rows):

```text
6e41c915-1074-4e1a-8446-072934ff1485|sandbox|n4|pooled|2026-11-04 06:08:33.877+00
0fa08d49-4d9f-466e-85be-6a391827be15|agro|n4|pooled|2026-11-04 15:46:14.023+00
```

At the start, N′ held: two pools for n4, one agro and one sandbox. Step 1 claimed `0fa08d49` and Step 2 claimed `6e41c915`.

Journey end, 17:30:29 (`select profile, spec, status, pooled_at from nodes where status='pooled'`, exit 0):

```text
agro|n4|pooled|2026-11-04 17:12:34.516+00
```

- The agro pool refilled: `1f5d465f` went from `creating_vm` 17:08:56 to `pooled` 17:12:34.
- The sandbox pool did not refill. `830d26ad` went from `creating_vm` 17:11:25 to `boot_phase_ssh_ready` and `bootstrapping` 17:12:47. Then it went to `failed` 17:26:56 with `READY_TIMEOUT: the node did not register within 15 minutes after waiting_for_boot`, and the provisioner released the instance at 17:26:57. A normal sandbox fill went from `bootstrapping` to `pooled` in 49 s (`6e41c915`, 06:07:44 to 06:08:33).
- At 17:30:29 the provisioner had not started a new sandbox fill. The worker did not diagnose the failed VM further and did not restart any service.

After the advisor restarted the provisioner (see "Step 1 rerun"), the pools refilled with the new pin: agro `7b102484` (pooled 17:35:37) and sandbox `cfc3e4aa` (pooled 17:39:16). The rerun claimed `7b102484`, so the agro pool refilled again. Final pooled rows:

17:45:41 (`select profile, spec, status, pooled_at from nodes where status='pooled' order by profile`, exit 0):

```text
agro|n4|pooled|2026-11-04 17:45:37.067+00
sandbox|n4|pooled|2026-11-04 17:39:16.452+00
```

N′ holds at the end: one agro pool (`e168d641`) and one sandbox pool (`cfc3e4aa`) for n4.

## End state

```text
$ AGRO_CONSOLE_URL=http://127.0.0.1:3006 agro node list --json
exit=0, total 182, live (status other than destroyed) 0
```

The first `agro node list` at 17:20 failed with `request failed: fetch failed`. The prototype web process exited at 17:20:10 (`../web-exits.txt`) and was back before 17:20:21 (`/signin` returned 307 on each probe from 17:20:21 to 17:21:27). The retry succeeded.

Browser session `wppp-journey-88d5ded922fd` closed with `agent-browser --session wppp-journey-88d5ded922fd close`.

## Step 1 rerun (after the egress pin fix)

The advisor restarted the provisioner with `PROVISIONER_EGRESS_IP=40.160.94.106` and retired the agro pool node with the old pin. The new pools were agro `7b102484` (pooled 17:35:37) and sandbox `cfc3e4aa` (pooled 17:39:16). The browser session was relaunched (`--no-sandbox`, 1280x720) and signed in again as `dev@agro.local`, context `dev` (Personal).

UI: Create node, Free, Agro, Browser editor (code-server) on, T3 Code on, Docker on, name `wp-journey-agro-2`, Create free node.

| Event | Time (UTC) |
|---|---|
| Create click | 17:41:13.710 |
| `bootstrapping` (`reason: bind`), node `7b102484-8708-45b1-8c78-c94a6f4f31fd` | 17:41:22.239 |
| `running` (`node_events`) | 17:41:45.615 |
| Node page loaded (URL left `/nodes/create`) | 17:41:53.049 |
| `boot_phase_t3_ready` | 17:41:55.322 |
| Connect enabled on the node page | 17:42:15.245 |
| Connect click | 17:42:15.308 |
| Editor open: `.monaco-workbench` present, title `agro (Workspace) - code-server` | 17:42:39.114 |

- Create click to open editor: 85.4 s (wall clock).
- Create click to `running`: 31.9 s. Bind to `running`: 23.4 s.
- `running` to Connect enabled: 29.6 s. Connect click to open editor: 23.8 s.
- Gateway pin on the node, over SSH as `sandbox@40.160.98.52`: `/etc/ssh/authorized_keys/agroproxy` starts with `from="40.160.94.106/32"`, and sshd logged 1 `Accepted publickey for agroproxy`.

Screenshot: `step-1-agro-running.png`

Callouts: 1 is the agro node name. 2 is the Running status. 3 is Connect.

Screenshot: `step-1-editor-open.png` (selectors `.monaco-workbench .tabs-container .tab.active` and a `data-journey` tag on the Explorer heading `agro (Workspace)`)

Callouts: 1 is the opened README.md. 2 is the agro workspace in the Explorer.

UI: Destroy, then Destroy node. `nodes.status` was `destroyed` at 17:44:08.

## End state after the rerun

```text
$ AGRO_CONSOLE_URL=http://127.0.0.1:3006 agro node list --json
exit=0, total 184, live (status other than destroyed) 0
```

Browser session `wppp-journey-88d5ded922fd` closed with `agent-browser --session wppp-journey-88d5ded922fd close`.
