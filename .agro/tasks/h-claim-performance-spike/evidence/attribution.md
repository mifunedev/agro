# Lever attribution

All runs used the local dev console on 2026-11-04 and 2026-11-05. Each run claimed a warm `sandbox` n4 pool node, ran the H hook with Docker on, and passed or failed the usable probe. `python3 -I verdict.py --steps` prints the step tables of `runs-apt-at-claim/`, `runs-attribution/`, and `runs/`. The tables of this file come from `runs-attribution/`. The tables of the first series come from `runs-apt-at-claim/`.

## Result

| Lever set | Pool build | n | Median `usable_s` | p90 `usable_s` | Saving against P |
|---|---|---|---|---|---|
| P: A0, no switch | US-004 (`gh` and `libatomic1` in the pool build) | 3 | 51.4 s | 55.5 s | 0 s |
| P + `H_STREAM=1` | US-004 | 3 | 35.7 s | 43.2 s | 15.7 s |
| P + `H_ARCHIVE=A1` | US-004 | 3 | 35.9 s | 36.0 s | 15.5 s |

- `H_STREAM=1` removes the separate verify and extract passes. The median `verify` plus `extract` time falls from 14.3 s to 0.8 s. The one-pass `fetch` takes 14.6 s instead of 13.0 s.
- `H_ARCHIVE=A1` shrinks the archive by 26%. The median `fetch` falls from 13.0 s to 11.1 s, and the median `extract` falls from 12.9 s to 5.5 s.
- The US-004 pool build removes the apt install from the claim. The median `install` step is 0.6 s, with `apt=skipped` in every run.
- The two levers act on different steps. US-005 measures them together.

## First series: apt at claim (stopped)

The first series used the `development` pool build, which does not install `gh` and `libatomic1`. The hook installed the two packages at claim. The advisor stopped the series after 6 runs:

| Lever set | `usable_s` | apt in the `install` step |
|---|---|---|
| A0, no switch | 59.1 s | inline, 6.1 s |
| `H_STREAM=1` | 44.9 s | inline, 8.0 s |
| `H_PARALLEL_APT=1` | failed | parallel, 999 s wait |
| A1 | 148.2 s | inline, 110.3 s |
| `H_STREAM=1`, `H_PARALLEL_APT=1`, A1 | failed | parallel, 1,039 s wait |
| A0, no switch | failed | inline, apt failed |

The pool build masks the apt timers during the build. The pool build unmasks the timers at the end (`packages/shared/src/index.ts:1049` of agro-console). The timers then start `unattended-upgrade`. The `unattended-upgrade` process holds the dpkg lock for many minutes. During that time, each apt install at claim waits for the lock. On the node of run 3, `ps` showed `unattended-upgrade` as the lock holder and the hook's `apt-get install -y gh libatomic1` as the waiter.

- 4 of 6 runs waited for the lock. 3 of the 6 runs failed.
- `H_PARALLEL_APT=1` starts apt earlier, and it failed in 2 of 2 runs. With the US-004 pool build, the lever has nothing to save. The advisor dropped the lever.

## Run timing

In this protocol, each claim lands on a pool node within about 1 minute of `pooled_at`, because the pool refills after each claim. A production pool node can wait longer before a claim. With the US-004 pool build, the claim does not need apt, so the age of the pool node does not change the `install` step.
