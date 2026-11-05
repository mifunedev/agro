# Verdict: H claim performance spike

H fails E1, N′ stands.

The optimized H has a median of 33.4 s and a p90 of 39.4 s over 10 runs with 0 failures. The bar is a median of 32 s or less, a p90 of 48 s or less, and 0 failures. The median misses the bar by 1.4 s. The final lever set is `H_STREAM=1` and `H_ARCHIVE=A1` on the US-004 pool build (`features.sandboxPoolPackages: true`, agro-console 4fcd6073).

All runs used the local dev console at `http://127.0.0.1:3006` on 2026-11-04 and 2026-11-05, with n4 free-tier nodes, one claimed node at a time. `python3 -I verdict.py` recomputes the E lines from `runs/`. `python3 -I verdict.py --steps` prints the step tables of `runs-apt-at-claim/`, `runs-attribution/`, and `runs/`.

## Result

| Check | Result | Detail |
|---|---|---|
| E1 latency | FAIL for H | H agro, final set: median 33.4 s, p90 39.4 s, n=10, 0 failures. Docker was on in 5 runs and off in 5 runs. |
| E1 reference | N′ agro median 15.0 s | N′ agro: median 15.0 s, p90 19.1 s, n=5. The reference has fewer than 10 runs, so `verdict.py` prints FAIL for the reference series. |
| E2 residue | PASS | A warm `sandbox` node of the US-004 pool build adds only `gh` and `libatomic1` beyond the noise floor of 14. No agro file appears beyond the noise floor. |
| E3 parity | PASS | All 10 H runs pass the usable probe, the Docker flag on and off, and the claim and ack contract. |

The plan rule: the warm pool decision reopens for H only when E1, E2, and E3 pass. E1 fails, so N′ stands.

## Where the time went

| Lever set | Median `usable_s` | Source |
|---|---|---|
| Baseline of `warm-pool-pause-protocol` (A0, apt at claim) | 48.8 s | PR #1558 |
| P: A0 on the US-004 pool build | 51.4 s | `runs-attribution/`, n=3 |
| P + `H_STREAM=1` | 35.7 s | `runs-attribution/`, n=3 |
| P + `H_ARCHIVE=A1` | 35.9 s | `runs-attribution/`, n=3 |
| P + `H_STREAM=1` + `H_ARCHIVE=A1` (final) | 33.4 s | `runs/`, n=10 |

Step medians for P (`runs-attribution`, n=3, median 51.4 s):

```text
  step          median_s   n
  bind               0.4   3
  ssh                6.4   3
  pre_hook           0.4   3
  handoff            0.5   3
  fetch             13.0   3
  verify             1.4   3
  extract           12.9   3
  install            0.6   3
  docker             5.8   3
  apps-started       0.0   3
  apps-up            6.9   3
  session            0.5   3
  probe              0.8   3
```

Step medians for the final set (`runs`, n=10, median 33.4 s):

```text
  step          median_s   n
  bind               0.4  10
  ssh                6.4  10
  pre_hook           0.3  10
  handoff            0.5  10
  fetch             10.5  10
  verify             0.0  10
  extract            0.8  10
  stream            11.2  10
  install            0.5  10
  docker             5.1  10
  apps-started       0.2  10
  apps-up            6.3  10
  session            0.5  10
  probe              0.8  10
```

In the final set, the archive steps take 11.2 s and the time to SSH takes 6.8 s. The Docker step takes 5.1 s, and the app start takes 6.3 s. `attribution.md` gives the saving of each lever.

## Findings

- Apt at claim is not reliable on a fresh pool node. The pool build unmasks the apt timers at the end of the build. `unattended-upgrade` then holds the dpkg lock for many minutes. In the first series, 4 of 6 runs waited for the lock, and 3 of 6 runs failed. The US-004 pool build removes the apt install from the claim.
- `H_PARALLEL_APT=1` failed in 2 of 2 runs. The advisor dropped the lever.
- The first 3 runs of the final series took 50.2 s, 39.4 s, and 35.7 s. The last 7 runs took 28.9 s to 34.7 s. The verdict counts all 10 runs.

## Deviations

- The advisor stopped the attribution series on the `development` pool build after 6 runs, because of the apt lock. The plan had 5 lever sets for that series. The attribution ran again on the US-004 pool build with 3 lever sets: P, P + stream, and P + A1. `runs-apt-at-claim/` keeps the 6 runs of the first series.
- The final set combines `H_STREAM=1` and `H_ARCHIVE=A1`. The plan named the single set with the lowest median. The two best single sets differ by 0.2 s, and the two levers act on different steps.
- E2 reused the cold dump and the noise floor of `warm-pool-pause-protocol`. The cold node, the noise-floor node, and the new warm node use the same image `40c82cd6`.
- On the operator's instruction, the advisor pushed the US-004 branch and opened the draft PR mifunedev/agro-console#680. The plan said no push.

## Spend

The spike used 32 of the 35 free-tier claims. The claims were 1 archive cut, 6 runs in the first series, 9 attribution runs, 15 final runs, and 1 residue audit. The pool refills built more nodes, which no run claimed. The spike created no OVH volume. R2 holds no object of the spike.

## verdict.py output

```text
E1: FAIL H (h agro FAIL median=33.4 p90=39.4 n=10; h sandbox PENDING) | reference nprime agro FAIL median=15.0 p90=19.1 n=5
E2: PASS (H extra entries=2 allowed=gh,libatomic1, H agro files beyond floor=0, noise floor=14)
E3: PASS (H agro parity holds in every run)
```
