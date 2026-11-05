# Verdict: warm pool and pause default

Warm pools: N′. E1 decides the outcome. H fails the agro latency bar.

Pause default: A. E6 decides the outcome. V fails the restore-time rule.

All runs used the local dev console at `http://127.0.0.1:3006` on 2026-11-04, with n4 free-tier nodes, one live node at a time. `python3 -I verdict.py` recomputes each line below from `runs/` and the input files.

## Decision 1: warm pools

| Experiment | Result | Detail |
|---|---|---|
| E1 latency | FAIL for H | H agro: median 48.8 s, p90 57.5 s, n=10. The bar is 32 s. H sandbox: median 7.4 s, p90 9.2 s, PASS. |
| E1 reference | PASS for N′ | N′ agro: median 17.9 s, p90 22.6 s. N′ sandbox: median 8.3 s, p90 9.5 s. |
| E2 residue | PASS | A warm `sandbox` node adds 0 entries beyond the noise floor of 14. |
| E3 parity | PASS | All 10 H agro runs pass the usable probe, the Docker flag on and off, and the claim and ack contract. |
| E4 maintenance | Favors H | The ongoing total is 21 for H and 46 for N′. |

The plan rule: H wins only when E1, E2, and E3 pass. E1 fails, so N′ is final.

The H agro hook takes about 42 s after the claim. The fetch of the 364 MB agro-layer archive from R2 takes about 14 s. The extract takes about 8 s. The apt install of `gh` and `libatomic1` takes about 7 s. The app start and probe take about 9 s.

## Decision 2: pause default

| Experiment | Result | Detail |
|---|---|---|
| E5 scope | PASS for V | V keeps the home directory, the git workspace, the filler, the Docker images, the containers, and the named volume. V loses the added apt package. A keeps the home directory, the git workspace, and the filler. A loses the Docker images, the containers, the named volume, and the apt package. |
| E6 restore time | FAIL for V | V small: median 28.0 s, p90 30.4 s, 1 failed run, n=10. V 1g: median 28.2 s, p90 34.6 s, 1 failed run, n=10. V 4g: median 30.0 s, p90 34.6 s, n=8. The bar is a median of 29 s at every size and no failed run. |
| E6 record for A | No bar | A small: median 46.8 s. A 1g: median 120.0 s. A 4g: median 335.9 s, n=7. A grows with the workspace size. |
| E7 paused cost | PASS for V | One paused V node costs $0.95 for each month. The cap is $2.00. One paused A node costs $0.03 at 1g and $0.075 at 4g. |

The plan rule: V becomes the default only when E5 and E6 pass and E7 is under the threshold. E6 fails, so A stays the default.

The two failed V runs have the same cause. The OVH API returned `500 Internal server error` on the restore attach in 2 V runs. Provider errors are not on the list of invalid runs, so the advisor counts both runs as failures.

V restores in about 28 s at each size, and A restores in 47 s to 336 s. V is faster than A at each size. V does not meet the fixed bar at 4g, and the V attach step does not recover from a provider error. V keeps Docker state, and A does not.

## Deviations

- A 4g has 7 valid runs and V 4g has 8 valid runs, not 10. The local web console exited 5 times during the E6 runs. The last 3 A 4g attempts each ended in a console outage. The outcome does not depend on these runs: A has no bar, and V already fails on small and 1g.
- The H hook changed once, at the start of the E1 runs, to honor the Docker flag. `runs/` keeps the 2 H agro runs with the earlier hook, and `verdict.py` drops them as `hook revision`.
- The V hook added a retry for OVH 5xx errors after the first failed V run. The retry did not prevent the second failure.
- The scope files are `scope-A.json` and `scope-V.json`, with `.md` tables beside them.

## Spend

The V runs created 31 block volumes and spent $0.04 of the $10 cap. The OVH volume list shows 0 run volumes.

## verdict.py output

```text
E1: FAIL H (h agro FAIL median=48.8 p90=57.5 n=10; h sandbox PASS median=7.4 p90=9.2 n=10) | reference nprime agro PASS median=17.9 p90=22.6 n=10; nprime sandbox PASS median=8.3 p90=9.5 n=10
E2: PASS (H extra entries=0, H agro files beyond floor=0, noise floor=14)
E3: PASS (H agro parity holds in every run)
E4: FAVORS H (h_total=21, nprime_total=46)
E5: PASS V | A kept=filler,git_workspace,home lost=apt_package,containers,docker_images,volumes
E6: FAIL V (v small FAIL median=28.0 p90=30.4 n=10; v 1g FAIL median=28.2 p90=34.6 n=10; v 4g FAIL median=30.0 p90=34.6 n=8) | A a small RECORDED median=46.8 p90=53.8 n=10; a 1g RECORDED median=120.0 p90=131.1 n=10; a 4g RECORDED median=335.9 p90=372.2 n=7
E7: PASS (V 1g=$0.95, 4g=$0.95, cap=$2.00)
```
