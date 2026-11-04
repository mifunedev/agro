# PRD: Empirical protocol for the warm pool and pause decisions

Status: DRAFT

## User Stories

### US-001: Measurement driver and verdict script

**Description:** As the advisor, I want one driver and one verdict script. Every run then follows the same rules, and the verdict comes from the logs alone.

**Acceptance Criteria:**

- [ ] `.agro/tasks/warm-pool-pause-protocol/evidence/driver.sh` runs one sample per call and writes one log per sample under `evidence/runs/`.
- [ ] Before each node create, the driver checks for 0 live nodes in `agro node list --json` and a 200 or 307 from `http://127.0.0.1:3006/signin`. On a failed check, the driver waits up to 10 minutes. Next, the driver exits 3.
- [ ] The driver takes claim start and ack times from the `node_events` table, and it probes SSH every 0.5 s from claim start.
- [ ] The driver marks a run `INVALID` in three cases. The claimed row has `pooled_at` null, the console is unreachable during the run, or the AGRO commit differs from the pin.
- [ ] `evidence/verdict.py` reads `evidence/runs/` and prints, for each arm and profile: n, median, p90, failure count, and `PASS` or `FAIL` under the rules in `## Summary`.
- [ ] `python3 -I evidence/verdict.py --fixture evidence/fixtures/` prints the expected verdict for a pass fixture and for a fail fixture.

### US-002: Agro-layer archive

**Description:** As the advisor, I want one archive of the agro layer so that the H arm installs the agro layer by fetch and extract.

**Acceptance Criteria:**

- [ ] The advisor cuts the archive from one pooled `agro` n4 node. The archive holds `/home/sandbox/.nvm`, `/home/sandbox/.local`, `/home/sandbox/.agro`, and the agro-layer root files and units in a manifest.
- [ ] `evidence/l2a-archive.json` records the archive size in bytes, the sha256, the AGRO version, the code-server version, and the T3 version.
- [ ] The archive sits in the R2 bucket `agro-console-beta`. A presigned URL serves the archive to a pool node.
- [ ] The advisor deletes the source node after the cut. `agro node list --json` shows 0 live nodes.

### US-003: E1 latency and E3 parity

**Description:** As the operator, I want interleaved warm claims for N′ and H so that the latency verdict compares the arms under the same conditions.

**Acceptance Criteria:**

- [ ] The driver runs four series in this interleaved order: N′ agro, H agro, N′ sandbox, H sandbox. The driver repeats the order until each series has 10 valid runs.
- [ ] An N′ run claims a warm pool node of the requested profile.
- [ ] An H agro run claims a warm `sandbox` pool node. Over SSH, the run fetches, verifies, and extracts the US-002 archive. The run installs the root files and units and starts the apps. The run clock starts at the claim request.
- [ ] Usable means: `agro workspace list` lists `harness`, code-server returns HTTP 200, and T3 returns HTTP 200 for agro; `docker info` exits 0 for sandbox.
- [ ] E3 parity passes for H when all 10 H agro runs pass the usable probe. The runs also pass the Docker flag on and off, and the claim and ack contract.
- [ ] `verdict.py` prints the E1 result. H passes when the H agro median is at most 32 s and the H sandbox median is at most 20 s. Each p90 must be at most 1.5 times its bar, and no run may fail.

### US-004: E2 residue audit

**Description:** As the operator, I want a residue diff so that the "not installed" rule for `sandbox` has proof for each arm.

**Acceptance Criteria:**

- [ ] The audit runs on three nodes: a cold `sandbox` node, an N′ warm `sandbox` node, and an H warm `sandbox` node. The audit collects `dpkg-query -W`, `getent passwd`, `getent group`, `systemctl list-unit-files`, and `find` with `sha256sum` over `/home/sandbox`, `/etc/agro`, `/usr/local/libexec`, `/var/lib/cloud`, and `/opt`.
- [ ] The audit removes per-instance fields before the diff: host keys, `machine-id`, `instance-id`, logs, and tokens.
- [ ] The N′ diff against the cold node sets the noise floor.
- [ ] E2 passes for H when the H diff adds no entry beyond the noise floor. E2 also needs `grep -rl agro` to find no agro file on the H node beyond the noise floor.

### US-005: E4 maintenance count

**Description:** As the operator, I want a counted maintenance comparison so that the ongoing cost of two pools has a number.

**Acceptance Criteria:**

- [ ] `evidence/maintenance.md` lists each count for N′ and for the H design, with its source `file:line`. The counts cover pool builds for each spec, drains, and pool cells.
- [ ] The counts also cover profile-branch sites, cloud-init fixtures, and external installer paths. The counts include the files that one agro release bump touches.
- [ ] The H counts list each code site that H adds or removes, from `packages/shared/src/index.ts`, `packages/shared/src/cloud-init-base.ts`, and `apps/provisioner/src/services/node-pool.service.ts`.
- [ ] E4 favors H when the H ongoing total is lower than the N′ ongoing total.

### US-006: E5 scope and E6 restore time for the home archive

**Description:** As the operator, I want arm A measured on a fixed workload. The pause decision then knows what the home archive keeps and how long a restore takes.

**Acceptance Criteria:**

- [ ] The seeded workload holds a git workspace, 2 Docker images, 1 running container with a named volume, and 1 added `apt` package.
- [ ] The driver pauses the node through the console, then restores the node onto a different warm pool VM.
- [ ] `evidence/scope-A.md` records, for each seeded item, `kept` or `lost` after the restore.
- [ ] The driver runs 10 pause and restore runs at each workspace size: small, 1 GB, and 4 GB. `verdict.py` prints the median and p90 from pause request to usable for each size.

### US-007: E5 scope and E6 restore time for the block volume

**Description:** As the operator, I want arm V measured on the same workload so that the pause decision compares A and V on equal terms.

**Acceptance Criteria:**

- [ ] The V runs spend at most $10 on OVH block volumes, as the operator approved on 2026-11-04. At the cap, the driver stops and reports.
- [ ] A V run puts `/home/sandbox` and the Docker data root on one OVH block volume in the same region as the pool.
- [ ] A V pause deletes the node and keeps the volume. A V restore claims a warm pool node, attaches the volume, mounts the volume, and starts Docker.
- [ ] `evidence/scope-V.md` records, for each seeded item, `kept` or `lost` after the restore.
- [ ] The driver runs 10 V runs at each size: small, 1 GB, and 4 GB. `verdict.py` prints the median and p90 from restore request to usable, and the median of attach to mount.
- [ ] After the last run, the OVH volume list shows no volume that the runs created.

### US-008: E7 paused cost

**Description:** As the operator, I want the storage cost of a paused node for each arm so that the pause decision includes cost.

**Acceptance Criteria:**

- [ ] `evidence/cost.md` gives the provider price for each GB and month of an OVH block volume and of an R2 object. Each price has a source URL.
- [ ] `evidence/cost.md` gives the 30-day cost of one paused node for A and for V at 1 GB and at 4 GB.
- [ ] E7 passes for V when the V cost of one paused node for each month is at most $2.

### US-009: Verdict brief

**Description:** As the operator, I want one brief with both verdicts so that I make each decision from the evidence.

**Acceptance Criteria:**

- [ ] `evidence/verdict.md` holds the `verdict.py` output for E1 to E7. The file states one outcome for each decision: `H` or `N′` for warm pools, and `V` or `A` for the pause default.
- [ ] Each outcome names the experiment that decides the outcome.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/warm-pool-pause-protocol/evidence/verdict.md` exits 0.

### US-010: Prototype of the winner behind a local flag

**Description:** As the operator, I want the winning design in the console behind a local config flag. I can then use the result in the console UI.

**Acceptance Criteria:**

- [ ] An application agent builds the prototype on an agro-console branch. The prototype stays behind `features.singleWarmPool` for H and `features.volumePause` for V, in the file that `AGRO_CONSOLE_CONFIG` names.
- [ ] When US-009 picks H, an `agro` create binds a warm `sandbox` pool node, and the claim payload carries the US-002 archive as `restore`.
- [ ] When US-009 picks V, a pause keeps an OVH block volume for `/home/sandbox` and the Docker data root. A resume attaches the volume to a warm pool node.
- [ ] When US-009 picks N′ and A, the prototype enables the `sandbox` pool and shows the pause scope notice: "Pause keeps the home directory. Pause does not keep Docker data or system packages."
- [ ] With the flag off, the console behaves as on `development`. The agro-console tests, `pnpm type-check`, and the golden cloud-init fixtures pass.
- [ ] The branch has no merge. The operator decides the merge after US-011.

### US-011: User journey on port 3006

**Description:** As the operator, I want a recorded walkthrough on `http://localhost:3006` so that I see the expected result in the console UI.

**Acceptance Criteria:**

- [ ] The journey runs on the local console at `http://localhost:3006` with the US-010 flag on.
- [ ] Step 1: the user creates an `agro` node. The node page shows `running`, and the editor opens. The journey records the time from Create to the open editor.
- [ ] Step 2: the user creates a `sandbox` node. The node page shows `running`. An SSH command shows `docker info` succeeds and `command -v agro` finds nothing.
- [ ] Step 3: on the `agro` node, the user starts a container with a named volume. The user pauses the node. Next, the user resumes the node. The journey records whether the container and the volume come back, and the time from Resume to `running`.
- [ ] Step 4: when US-009 picks H, the journey shows one pool for each spec. The warm pool view or the database is the source.
- [ ] `evidence/journey/` holds one annotated screenshot for each step, and each screenshot block has a `Callouts:` line.
- [ ] Verify in browser using agent-browser skill.
- [ ] The journey deletes each node that the journey created. `agro node list --json` shows 0 live nodes at the end.

### US-012: Proof in the PR and the page

**Description:** As the operator, I want the proof in the PR description and on the status page. A reviewer then reads the result without the logs.

**Acceptance Criteria:**

- [ ] The PR body `## What was built` states each decision outcome in one sentence, with the deciding experiment and its median and p90.
- [ ] The PR body `## Manual review` follows `.agro/skills/git/references/manual-review.md` and links each US-011 screenshot by a full commit SHA.
- [ ] `bash .agro/skills/git/scripts/manual-review-check.sh <body-file>` exits 0.
- [ ] The status page `.agro/tasks/msb-base-image-spike/index.html` shows the final outcome for each decision, the E1 to E7 verdict table, and a link to the PR.
- [ ] The page prose passes `bash .agro/skills/ste/scripts/ste-check.sh` after the advisor strips tags, code, and diagrams.

## Summary

The operator has two decisions. Decision 1 picks between two warm pools (N′) and one warm pool where the agro layer arrives as an archive at claim (H). Decision 2 picks the pause default between the home archive (A) and an OVH block volume for `/home/sandbox` and the Docker data root (V).

Rules for every experiment:

1. The thresholds stay fixed: 32 s for agro and 20 s for sandbox. The residue diff stays empty. Parity covers the claim flow, the Docker flag, and both profiles.
2. The arms run in the local dev environment on the same day, interleaved.
3. Each arm and profile gets at least 10 valid samples.
4. Claim start and ack come from `node_events`. The SSH probe runs every 0.5 s. Every arm uses the same usable probe.
5. A series passes when the median meets the bar, the p90 is at most 1.5 times the bar, and no run fails.
6. The driver discards an invalid run, and the driver repeats that run. Nobody edits a run.
7. Each log records the AGRO commit, the image digest, and the archive sha256. `verdict.py` recomputes every verdict from the logs.

Verified current state:

- Local measurements use the console at `http://127.0.0.1:3006` with a pool override in the file that `AGRO_CONSOLE_CONFIG` names (`packages/shared/src/console-config.ts:11`).
- The warm baseline is 16 s for agro and 10 s for sandbox, measured with a CLI poll. These values are upper bounds.
- The claim script already fetches, verifies, and extracts a restore archive before keys and ack (`packages/shared/src/cloud-init-base.ts:203`).
- A warm restore of a full home archive took 16.7 s to extract and about 29 s to code-server (agro-console `.agro/tasks/warm-snapshot-restore/evidence/spike.md:124`).
- The pause archive holds `/home/sandbox` without `.ssh` (`packages/shared/src/host-management-assets.ts:663`).
- The OVH client has no block volume method (`packages/shared/src/index.ts:316` to `:463`).

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| agro-console `packages/shared/src/console-config.ts` | `CONSOLE_CONFIG_PATH_VARIABLE` | Local pool size override |
| agro-console `packages/shared/src/cloud-init-base.ts` | claim script, restore step | Claim timing and the H restore mechanism |
| agro-console `packages/shared/src/host-management-assets.ts` | pause archive `tar` | Arm A scope |
| agro-console `packages/shared/src/index.ts` | OVH client | Shows no volume support for arm V |
| agro-console `apps/provisioner/src/services/node-pool.service.ts` | fill, drain, stale reason | E4 counts |
| agro-console database | `nodes`, `node_events` | Timing source |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `evidence/driver.sh` | New local script | Runs one sample and writes one log |
| `evidence/verdict.py` | New local script | Prints each verdict from the logs |
| `features.singleWarmPool`, `features.volumePause` in the pool override file | New local config keys | Turn the US-010 prototype on |
| Console UI at `http://localhost:3006` | Journey | Shows the winner end to end |

## Storage

The task folder keeps every log, archive manifest, and verdict under `.agro/tasks/warm-pool-pause-protocol/evidence/`. The `.gitignore` rule `.agro/tasks/*/*` keeps the evidence local. The advisor copies the verdict into the PR body at Close.

## Architectural Decisions

- The measurement stories change no tracked code in agro-console. The H arm runs the agro-layer step over SSH after a real `sandbox` claim.
- US-010 builds only the winning design, behind a local config flag, on an agro-console branch. An application agent owns that code.
- The V arm uses the OVH API outside the console, because the console has no volume support.
- One free-tier node stays live at a time. A V volume needs operator approval for spend.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `evidence/fixtures/pass/` | A series that meets every rule | `verdict.py` prints `PASS` |
| `evidence/fixtures/fail/` | A p90 above 1.5 times the bar | `verdict.py` prints `FAIL` |
| `evidence/fixtures/invalid/` | A run with `pooled_at` null | `verdict.py` drops the run |

## Design Principles

- Fix the thresholds before the first run.
- Measure in the local dev environment only. Never read production.
- Keep one live free-tier node at a time. Delete each resource after each run.
- Derive each verdict from logs, never from notes.

## Out of Scope

- A merge of the US-010 prototype branch. The operator decides the merge.
- Production data.
- A production rollout of the winner.
- Arms G, D, F, M, and E. Earlier evidence rules out each arm.

## Open Questions

None. The operator answered on 2026-11-04. The E7 threshold is $2 for each paused node and month. The volume spend cap is $10. The archive host is R2 `agro-console-beta` with a presigned URL. The flags are `features.singleWarmPool` and `features.volumePause`.

## Acceptance Criteria

- [ ] `verdict.py` prints one verdict for each of E1 to E7 from the logs alone.
- [ ] `evidence/verdict.md` states one outcome for each decision.
- [ ] `agro node list --json` shows 0 live nodes and the OVH volume list shows 0 run volumes after the last run.
- [ ] Every agro-console change stays on the US-010 branch behind the flag.
- [ ] The US-011 journey on `http://localhost:3006` shows the outcome of each decision.
- [ ] The PR body and the status page state the final result.

## Lessons

- The H agro claim misses the 32 s bar by a wide margin. Evidence: E1 H agro median 48.8 s, p90 57.5 s. The hook spends about 14 s on the R2 fetch of the 364 MB archive. The apt install takes about 7 s. Outcome: dropped, because the plan rule makes N′ final and the operator owns any new H design.
- The local dev web process exits about every 2 hours, often during a pause. Evidence: the web process exited 9 times without an error. It exited 2 times before the exit log started, 5 times during E6, and 2 times during the journey. `evidence/web-exits.txt` lists the logged exits, and its 16:34 entry is the planned switch to the prototype. A 4 GB pause held `pausing` until the web restart. Postgres reset its backends once at 15:49Z. Outcome: proposed issue in mifunedev/agro-console for the operator to approve. A pause that hangs the web process is a correctness risk outside this PR.
- The OVH volume attach returned HTTP 500 in 2 V runs. Evidence: runs `e6-v-small-20261104T080527Z` and `e6-v-1g-20261104T130547Z`. Outcome: dropped from this PR; a production V design needs a retry and an idempotent attach, and the operator decides whether V comes back.
- The gateway key pin uses a fixed `PROVISIONER_EGRESS_IP`, so a host egress change breaks the editor with a 502. Evidence: `evidence/journey/step-1-editor-502.png` and the node sshd log. Outcome: proposed issue in mifunedev/agro-console for the operator to approve, because a stale pin silently breaks browser access.
- The sandbox pool drains on every agro release because the version check applies to both profiles. Evidence: `node-pool.service.ts:140`, `evidence/maintenance.md`. Outcome: proposed issue in mifunedev/agro-console for the operator to approve; a profile guard lowers the N′ ongoing count from 46 to 36.
- A worker replaced a denied `scp` with `ssh ... cat`, which reached the same effect as a guarded command. Evidence: US-002 notes. Outcome: dropped; the advisor reports it to the operator, and the guard owner decides whether the pattern is a false positive.
