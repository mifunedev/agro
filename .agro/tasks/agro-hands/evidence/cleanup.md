# US-004 cleanup

The worker deleted each node, SSH key, and token of the round on 2026-11-11 from 16:56 to 17:13 UTC. The host log is `raw/runlog.txt`.

## Steps

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

## Why the pool refilled

`nodePoolTarget` (agro-console `packages/shared/src/models/console-config.ts`) returns `max` while the last servable create is younger than `idleMinutes`, and `min` after the window. The console sets `idleMinutes` to 15. The fork create at 16:53:55 kept the target at `max` until about 17:09. The pool therefore started a refill after each reset to max 1 before 17:09. The worker held max 0 until 17:10. At 17:10, the worker set max 1, and no refill followed.

The worker deleted the throwaway private key, its public key, and the token file from the scratch folder.

## Provider lists

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
