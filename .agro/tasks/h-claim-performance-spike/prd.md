# PRD: H claim performance spike

Status: DRAFT

## User Stories

### US-001: Instrumented H hook and per-step verdict

**Description:** As the advisor, I want an H hook with one switch for each lever. I want a verdict that prints the median of each step, so that each lever has a measured saving.

**Acceptance Criteria:**

- [ ] `.agro/tasks/h-claim-performance-spike/evidence/` holds copies of `driver.sh`, `lib/`, `verdict.py`, `fixtures/`, and `arms/h/after-claim.sh` from `.agro/tasks/warm-pool-pause-protocol/evidence/`, with the source commit recorded in `evidence/README.md`.
- [ ] The hook reads `H_STREAM`, `H_PARALLEL_APT`, and `H_ARCHIVE` from the environment. With the three switches unset, the hook runs the same steps as the baseline hook.
- [ ] With `H_STREAM=1`, the hook pipes the download into `sha256sum` and `tar` in one pass. The hook fails the run when the sha256 differs from the pin.
- [ ] With `H_PARALLEL_APT=1`, the hook starts the apt install of `gh` and `libatomic1` before the download. The hook waits for the apt install before the apps start.
- [ ] When `dpkg -s gh libatomic1` exits 0 on the node, the hook skips the apt install and records the step as 0 s.
- [ ] `python3 -I evidence/verdict.py --steps` prints, for each lever set, n, the median of each step, and the median and p90 of `usable_s`.
- [ ] `bash evidence/fixtures/test.sh` passes, with a new fixture for `--steps`.

### US-002: Archive variants

**Description:** As the advisor, I want a same-content archive and a slim archive in R2 so that the archive size is a measured lever.

**Acceptance Criteria:**

- [ ] The advisor cuts both variants from one pooled `agro` n4 node with the cut script from the earlier task, then deletes the node.
- [ ] Variant `A0` holds the same paths as the earlier archive (`l2a/manifest.txt` of the earlier task).
- [ ] Variant `A1` removes caches, documentation, source maps, and locale files that code-server, T3, Node, and the agro CLI do not load. `evidence/archives.md` lists each removed path pattern and its size.
- [ ] `evidence/archives.json` records, for each variant: bytes, sha256, zstd level, entry count, and the local extract time on the cut node.
- [ ] Both variants sit in the R2 bucket `agro-console-beta`, under a prefix for this task. A presigned URL for each variant sits in a 0600 file in the session scratchpad. No log prints a URL.

### US-003: Lever attribution

**Description:** As the operator, I want each hook lever measured in isolation so that I know which lever saves time and how much.

**Acceptance Criteria:**

- [ ] The driver runs 5 lever sets with 3 H agro claims each, in interleaved order. The sets are baseline (`A0`, no switch), `H_STREAM=1`, `H_PARALLEL_APT=1`, `H_ARCHIVE=A1`, and all three levers.
- [ ] Each run claims a warm `sandbox` pool node. A run with `pooled_at` null is invalid, and the driver runs it again.
- [ ] `verdict.py --steps` prints the step medians for each lever set. `evidence/attribution.md` states the saving of each lever against the baseline of the same day, in seconds.
- [ ] Every run passes the usable probe: `agro workspace list` lists `harness`, code-server returns HTTP 200 with redirects followed, and T3 returns HTTP 200.
- [ ] `agro node list --json` shows 0 live nodes after the last run.

### US-004: Generic packages in the sandbox pool build

**Description:** As the operator, I want `gh` and `libatomic1` in the sandbox pool build behind a local flag so that the H claim skips the apt install.

**Acceptance Criteria:**

- [ ] An application agent makes the change on the agro-console branch `task/<N>-h-sandbox-pool-packages`, cut from `development`.
- [ ] With `features.sandboxPoolPackages: true` in the file that `AGRO_CONSOLE_CONFIG` names, the `sandbox` pool build installs `gh` and `libatomic1`. With the flag off, the `sandbox` pool cloud-init is byte-identical to `development`.
- [ ] A red test fails before the change and passes after the change: the `sandbox` pool cloud-init installs `gh` and `libatomic1` only with the flag on.
- [ ] `pnpm type-check` exits 0, and the shared tests, including the golden cloud-init fixtures, pass.
- [ ] The branch has no push and no merge. The operator decides the merge.

### US-005: Final E1 run for the optimized H

**Description:** As the operator, I want 10 H agro claims with the best lever set so that the E1 bar decides the outcome.

**Acceptance Criteria:**

- [ ] The final lever set is the hook set with the lowest median `usable_s` in US-003, on the US-004 pool build.
- [ ] The driver runs 10 H agro claims with the final set, interleaved with 5 N′ agro claims as a same-day reference. Each H run alternates the Docker flag on and off.
- [ ] `verdict.py` prints the E1 result. H passes when the median is at most 32 s, the p90 is at most 48 s, and no run fails.
- [ ] E3 parity passes when all 10 H runs pass the usable probe. The runs also pass the Docker flag on and off, and the claim and ack contract.
- [ ] `agro node list --json` shows 0 live nodes after the last run.

### US-006: E2 residue on the changed pool build

**Description:** As the operator, I want the residue audit repeated on the changed sandbox pool build so that the "not installed" rule still has proof.

**Acceptance Criteria:**

- [ ] The advisor runs this story only when the US-005 final set uses the US-004 pool build. Otherwise the advisor records "not applicable" with the reason.
- [ ] The audit compares a cold `sandbox` node with a warm `sandbox` node from the changed pool build. The audit uses the audit script and the normalization of the earlier task.
- [ ] `evidence/residue/summary.json` lists each entry beyond the noise floor of 14. `grep -rl agro` finds no agro file beyond the noise floor.
- [ ] E2 passes when the only extra entries are the packages that the operator allowed.

### US-007: Brief and manual review

**Description:** As the operator, I want one brief and a command transcript so that I can decide whether the warm pool decision reopens.

**Acceptance Criteria:**

- [ ] `evidence/verdict.md` states one outcome: "H passes E1, the warm pool decision reopens" or "H fails E1, N′ stands". The file names the median, the p90, and the lever set.
- [ ] `evidence/verdict.md` holds the `verdict.py --steps` table for the baseline and the final set.
- [ ] `evidence/manual-review.md` holds a command transcript in the server, CLI, or API shape of `.agro/skills/git/references/manual-review.md`. The transcript shows one H claim with the final set, its step timings, the usable probe, and the node delete.
- [ ] The advisor deletes the R2 objects of this task and the presigned URL files. `agro node list --json` shows 0 live nodes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/h-claim-performance-spike/evidence/verdict.md` exits 0.

## Summary

The task `warm-pool-pause-protocol` (PR #1558) measured H at a median of 48.8 s and a p90 of 57.5 s against the 32 s bar. H passed E2, E3, and E4. This spike measures whether cheap levers bring H under the bar.

Baseline step medians from 10 runs of the earlier task:

| Step | Median |
|---|---|
| Request to claim bind | 1.4 s |
| Bind to SSH up | 4.9 s |
| Fetch of the 364 MB archive from R2 | 12.5 s |
| Verify | 1.5 s |
| Extract | 7.7 s |
| Install, with the apt install of `gh` and `libatomic1` | 7.2 s |
| Docker state | 4.6 s |
| Apps up | 6.4 s |
| Usable probe | 1.7 s |

Levers in scope, with unmeasured estimates:

1. `H_STREAM`: one pass for fetch, verify, and extract. The estimate is up to 8 s.
2. `H_PARALLEL_APT`: the apt install runs during the fetch. The estimate is up to 6 s.
3. `H_ARCHIVE=A1`: a slim archive. The estimate is 3 s to 5 s.
4. `features.sandboxPoolPackages`: the pool build installs `gh` and `libatomic1`. The estimate is up to 7 s, and the lever overlaps lever 2.

Verified facts:

- The hook downloads to a file, checks the sha256, lists the archive, and extracts the archive in sequence (`evidence/arms/h/after-claim.sh:43` to `:54` of the earlier task).
- The hook installs `gh` and `libatomic1` with apt on the claimed node, because the `sandbox` pool build does not install the two packages. The agro build installs the two packages (`packages/shared/src/__tests__/workspace-bootstrap.test.ts:199`).
- The console claim restore step extracts only `./` members into `/home/sandbox` as the `sandbox` user (`packages/shared/src/cloud-init-base.ts:263` to `:273`). The step cannot install the agro root files and units.
- `verdict.py` drops a run whose `hook_sha256` differs from the current hook (`verdict.py:70`).

Outcome rule: if H passes E1 in US-005, and E2 and E3 pass, the warm pool decision reopens for H. If H fails any of these checks, N′ stands.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/tasks/warm-pool-pause-protocol/evidence/arms/h/after-claim.sh` | remote fetch, verify, extract, install steps | Source of the instrumented hook |
| `.agro/tasks/warm-pool-pause-protocol/evidence/driver.sh` | `e1` experiment, hook call, preflight | Runs one sample per call |
| `.agro/tasks/warm-pool-pause-protocol/evidence/verdict.py` | `E1_BARS`, hook revision drop | Verdict and the new `--steps` table |
| `.agro/tasks/warm-pool-pause-protocol/evidence/l2a/cut.sh` | archive cut | Cuts the `A0` and `A1` variants |
| agro-console `packages/shared/src/workspace-bootstrap-assets.ts` | apt install of `gh` and `libatomic1` | Pattern for the US-004 pool build change |
| agro-console `packages/shared/src/models/console-config.ts` | `CONSOLE_FEATURES`, `consoleConfigSchema` | Declares `features.sandboxPoolPackages` |
| agro-console `packages/shared/src/cloud-init-base.ts` | `claimRestoreScript` | Limits of the console restore path |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `H_STREAM`, `H_PARALLEL_APT`, `H_ARCHIVE` | New hook environment switches | Select the levers for one run |
| `verdict.py --steps` | New flag | Prints the step medians for each lever set |
| `features.sandboxPoolPackages` | New local config key on the agro-console spike branch | Turns on the pool build lever |

## Storage

The task folder keeps every log, archive manifest, and verdict under `.agro/tasks/h-claim-performance-spike/evidence/`. The `.gitignore` rule `.agro/tasks/*/*` keeps the evidence local. The advisor commits linked evidence with `git add -f`. The archives sit in R2 `agro-console-beta` until US-007 deletes them.

## Architectural Decisions

- The spike measures levers in the hook over SSH, the same path as the earlier H measurement. The spike does not build a console-native H.
- Only US-004 changes agro-console code, behind a local flag, on a spike branch that an application agent owns.
- The bar, the probe, and the invalid-run rules stay the same as in `warm-pool-pause-protocol`.
- One live free-tier node at a time. The spike creates no OVH volume.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `evidence/fixtures/steps/` | Runs with step timings for 2 lever sets | `verdict.py --steps` prints the medians |
| `evidence/fixtures/test.sh` | All earlier fixtures and the new `--steps` fixture | No regression in `verdict.py` |
| agro-console `packages/shared/src/__tests__/cloud-init.test.ts` | Sandbox pool cloud-init with the flag on and off | US-004 installs the packages only with the flag on |
| agro-console `packages/shared/src/__tests__/console-config.test.ts` | `features.sandboxPoolPackages` defaults to false | US-004 flag off keeps today's behavior |

## Design Principles

- Measure each lever before the levers combine.
- Keep the bar fixed at 32 s for the median and 48 s for the p90.
- Run the baseline on the same day as the levers.
- Measure in the local dev environment only. Never read production.
- Keep one live free-tier node at a time. Delete each resource after each run.

## Out of Scope

- A console-native H claim path. The console restore step cannot install root files, so that path needs a separate design.
- Other archive storage than R2, such as OVH object storage.
- A merge of the US-004 branch.
- Changes to the pause default. Decision 2 stays at A.
- A production rollout.

## Open Questions

None. The operator answered question 1 with A on 2026-11-04: a `sandbox` node may carry `gh` and `libatomic1`. US-004 runs, and US-006 allows the two packages.

## Acceptance Criteria

- [ ] `verdict.py --steps` prints a step table for each lever set from the logs alone.
- [ ] `evidence/verdict.md` states one outcome for the warm pool decision.
- [ ] `agro node list --json` shows 0 live nodes, and R2 holds no object of this task.
- [ ] Every agro-console change stays on the US-004 branch behind the flag.
- [ ] The spike uses at most 35 free-tier claims.

## Lessons

1. A claim that runs apt on a fresh pool node can stall for many minutes. The pool build unmasks the apt timers at the end of the build (`packages/shared/src/index.ts:1049` of agro-console). `unattended-upgrade` then holds the dpkg lock. Evidence: 4 of 6 apt-at-claim runs waited for the lock, and 3 of 6 runs failed (`evidence/attribution.md`). Outcome: proposed issue for agro-console, for the operator to decide. The same lock also blocks a user who runs apt on a new node.
2. `verdict.py` did not apply the US-006 package allowance, so it printed `E2: FAIL` for an E2 that passes by the plan rule. Evidence: review round 1. Outcome: fixed in this PR (`evidence/residue/allowed.json`).
3. `verdict.py --steps` read only `runs/`, so the attribution tables were not reproducible from one command. Outcome: fixed in this PR.
4. A pool node that boots while the web process is down never registers, and the console fails the node after 15 minutes (`READY_TIMEOUT`). Evidence: node `8908908e`, which booted while web listened on port 3005. Outcome: dropped. The existing open item on the tunnel port and the proposed issue on web exits cover the same surface.
5. The first 3 runs of the final series took 50.2 s to 35.7 s. The last 7 runs took 28.9 s to 34.7 s. Outcome: dropped. The verdict counts all runs, and the cause is not measured.
6. A median of 5 live claims varies by about 4 s between readings, so `/rsi` on live claims cannot resolve a gain below about 4 s. Evidence: `.agro/tasks/h-hook/rsi.tsv`, loop 1 keep margin 4.017. Outcome: dropped. The next tuning uses a local metric (archive bytes and extract time), as the advisor recommended.
