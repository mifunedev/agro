# US-004 cleanup

## Round 2

The worker deleted each node, SSH key, and token of round 2 on 2026-11-11 from 17:47 to 18:04 UTC. The host log is `raw/round2/runlog.txt`, and the pool override calls are in `raw/round2/pool-overrides.txt`.

### Steps

| Time (UTC) | Step | Result |
|---|---|---|
| 17:47:08 | `agro hands destroy 369 --yes` (the fork) on the brain. | `destroyed 369`. The database marked it `destroyed` at 17:47:23. |
| 17:47:09 | `agro hands destroy 368 --yes` (the hand) on the brain. | `destroyed 368`. The database marked it `destroyed` at 17:47:24. |
| 17:47:26 | Delete the CLI copy `~/agro-hands-test.js` on the brain. | `ls` reports no such file. |
| 17:47:27 | Delete the brain #367 through the browser session. | HTTP 202. The database marked it `destroyed` at 17:47:47. |
| 17:48:00 | Delete the key `ab-handslive2` (`5317898a-…`). | HTTP 200. |
| 17:48:01 | Delete the token `ab-handslive2` (`37151f8a-…`). | HTTP 200. The row has `revoked_at` set. |
| 17:48:01 | Check `ssh_keys` for the throwaway key and for the brain key of #367. | No row. |
| 17:48:01 | Check the brain tokens of #367. | The console revoked both rows (`23383953-…`, `502b65e7-…`). |
| 17:48:01 | Delete the throwaway private key, its public key, and the token file from the scratch folder. | Done. |

### Pool overrides

| Time (UTC) | Override | Response |
|---|---|---|
| 17:40:10 | n4 min 1, max 1, for the pool VM of the brain. | HTTP 200 |
| 17:42:18 | n4 min 0, max 0, 5 s after the brain create. | HTTP 200 |
| 18:00:43 | n4 min 0, max 1, once, 15 min 42 s after the last create (17:45:01). | HTTP 200 |

The only refill was `vivid-raven-6vhe3i`, which the pool started at the brain claim (17:42:13) and destroyed at 17:44:15. The hand and the fork booted cold. After the 18:00:43 reset, no VM started in 180 s, and the database had no live node at 18:03:45.

### Provider lists

Before round 2 (17:39:39, `raw/round2/provider-before.txt`) and after round 2 (18:03:52, `raw/round2/provider-final.txt`), the provider held the same objects:

```
instance fecb66c6-9365-481e-9eb9-117654b0a258 ACTIVE 135.148.204.74 created 2026-11-11T05:32:52Z
instance 96e111f7-b7f8-43c3-8c8c-086dbe350f8d ACTIVE 135.148.235.21 created 2026-11-06T16:46:54Z
instance 6fbdfabd-db7d-4ec3-9cd3-8719b5d7a440 ACTIVE 40.160.69.59   created 2026-11-11T11:35:53Z
volume af55fb9f-… agro-node-ba14e8125bbde5c2-golden available 50GB
volume df54a785-… agro-node-05ac271347d3d20a-golden available 50GB
instances=3 volumes=2 snapshots=2
```

Only the order of the lines differs. None of the three instances is a node of this round. The worker did not touch them.

## Round 1

The worker deleted each node, SSH key, and token of the round on 2026-11-11 from 16:56 to 17:13 UTC. The host log is `raw/runlog.txt`.

### Steps

| Time (UTC) | Step | Result |
|---|---|---|
| 16:56:22 | `agro hands destroy 366 --yes` (the fork) on the brain. | `destroyed 366`. The database marked it `destroyed` at 16:56:39. |
| 16:56:23 | `agro hands destroy 365 --yes` (the hand) on the brain. | `destroyed 365`. The database marked it `destroyed` at 16:56:45. |
| 16:56:48 | Delete the CLI copy `~/agro-hands-test.js` on the brain. | `ls` reports no such file. |
| 16:56:49 | Delete the brain #364 through the browser session. | HTTP 202. The database marked it `destroyed` at 16:57:15. |
| 16:57:25 | Delete the key `ab-handslive` (`fc8feca8-…`). | HTTP 200. No `ssh_keys` row remains. |
| 16:57:27 | Delete the token `ab-handslive` (`a8ecf406-…`). | HTTP 200. The row has `revoked_at` 16:57:27. |
| 16:57:27 | Check the brain key `brain #364 proud-zephyr-ip3x9f` (`0192bd48-…`). | No `ssh_keys` row for the key or for the brain node. |
| 16:57:29 | Pool override n4 min 0, max 1. | HTTP 200. The pool created the refill `ample-river-r90x4l` at 16:57:57. |
| 16:58:14 | Check the brain tokens of #364. | The console revoked both rows (`53283e24-…`, `938a0112-…`). |
| 16:58:14 | Pool override n4 min 0, max 0 (drain). | HTTP 200. The pool destroyed `ample-river-r90x4l` at 17:00:14. |
| 17:00:17 | Pool override n4 min 0, max 1. | HTTP 200. The pool created the refill `snowy-willow-7m6mqo` at 17:00:27. |
| 17:00:55 | Pool override n4 min 0, max 0 (drain). | HTTP 200. The pool destroyed `snowy-willow-7m6mqo` at 17:02:53. |
| 17:10:13 | Pool override n4 min 0, max 1 (final). | HTTP 200. No refill in the next 180 s. No live database node. |

### Why the pool refilled

`nodePoolTarget` (agro-console `packages/shared/src/models/console-config.ts`) returns `max` while the last servable create is younger than `idleMinutes`, and `min` after the window. The console sets `idleMinutes` to 15. The fork create at 16:53:55 kept the target at `max` until about 17:09. The pool therefore started a refill after each reset to max 1 before 17:09. The worker held max 0 until 17:10. At 17:10, the worker set max 1, and no refill followed.

The worker deleted the throwaway private key, its public key, and the token file from the scratch folder.

### Provider lists

Before the round (16:46:48, `raw/provider-before.txt`):

```
instance 6fbdfabd-db7d-4ec3-9cd3-8719b5d7a440 ACTIVE 40.160.69.59   created 2026-11-11T11:35:53Z
instance 96e111f7-b7f8-43c3-8c8c-086dbe350f8d ACTIVE 135.148.235.21 created 2026-11-06T16:46:54Z
instance fecb66c6-9365-481e-9eb9-117654b0a258 ACTIVE 135.148.204.74 created 2026-11-11T05:32:52Z
volume af55fb9f-… agro-node-ba14e8125bbde5c2-golden available 50GB
volume df54a785-… agro-node-05ac271347d3d20a-golden available 50GB
instances=3 volumes=2 snapshots=2
```

After the round (17:13:21, `raw/provider-final.txt`):

```
instance 6fbdfabd-db7d-4ec3-9cd3-8719b5d7a440 ACTIVE 40.160.69.59   created 2026-11-11T11:35:53Z
instance fecb66c6-9365-481e-9eb9-117654b0a258 ACTIVE 135.148.204.74 created 2026-11-11T05:32:52Z
instance 96e111f7-b7f8-43c3-8c8c-086dbe350f8d ACTIVE 135.148.235.21 created 2026-11-06T16:46:54Z
volume af55fb9f-… agro-node-ba14e8125bbde5c2-golden available 50GB
volume df54a785-… agro-node-05ac271347d3d20a-golden available 50GB
instances=3 volumes=2 snapshots=2
```

The two lists hold the same instances, volumes, and snapshots. Only the order differs. None of the three instances is a node of this round. `6fbdfabd` has no database node. The worker did not touch it, `fecb66c6`, or the operator VM `96e111f7`.
