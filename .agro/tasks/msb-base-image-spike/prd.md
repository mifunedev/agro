# PRD: Spike: current HEAD against a microsandbox layer

Status: DRAFT

## User Stories

### US-001: KVM gate probe

**Description:** As the operator, I want proof that one candidate host exposes `/dev/kvm` and runs a pinned `msb`. The spike then stops early when KVM is absent.

**Acceptance Criteria:**

- [ ] The probe runs on one agro-console free-tier node, created with `agro node create --spec n4 --free-tier`. The probe creates no paid resource.
- [ ] `.agro/tasks/msb-base-image-spike/evidence/kvm-probe.log` records `ls -l /dev/kvm`, `msb --version`, and the output of `msb self doctor` on the A1 console node.
- [ ] The log records the newest upstream `msb` release on the day of the probe as `<msb-version>`, and the sha256 of the installed binary.
- [ ] If `/dev/kvm` is absent or `msb self doctor` exits non-zero, the advisor writes `blocked` in `prd.json` with the reason, and stories US-002 to US-006 do not start.
- [ ] After the probe, `agro node list` shows no node that the probe created.

### US-002: `agro-msb` build target

**Description:** As the advisor, I want one `agro-msb` target in `.devcontainer/Dockerfile` so that the microVM arm uses the AGRO image plus the Docker engine recipe of `ryaneggz/microsandbox-ubuntu-dind`.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` defines a stage `agro-msb` that starts `FROM final`.
- [ ] The `agro-msb` stage installs `docker-ce`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from the Docker Debian repository.
- [ ] The `agro-msb` stage writes `/etc/docker/daemon.json` with `"live-restore": true` and adds the `sandbox` user to the `docker` group.
- [ ] The `agro-msb` stage enables `docker.service` under systemd and keeps `CMD ["/sbin/init"]`.
- [ ] The `agro-msb` stage creates no user other than `sandbox` and sets no password.
- [ ] `docker build --target agro-msb -f .devcontainer/Dockerfile .` exits 0.
- [ ] The advisor pushes the `agro-msb` image as `ghcr.io/mifunedev/agro:spike-msb-<sha>`. The release workflow does not change.
- [ ] `docker build --target final -f .devcontainer/Dockerfile .` exits 0, and the existing image smoke test of `.github/workflows/release.yml` passes on the `final` image.
- [ ] The stage holds no explanatory comment.

### US-003: `msb` adapter for `/remote-sandbox`

**Description:** As the advisor, I want an `msb` adapter so that `run.sh msb <check>` boots the `agro-msb` image as a microVM on the A1 console node through the existing driver.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/adapters/msb.sh` defines the five functions that `SKILL.md` § Adapter contract names, with the prefix `msb_`.
- [ ] `msb_create NAME` runs `msb run --init auto --root-disk flat:40G "$IMAGE"` on the A1 console node over SSH and stores the sandbox ID in `$STATE_DIR/msb-NAME`.
- [ ] `msb_exec NAME CMD…` runs `CMD…` in the guest under `timeout 120`.
- [ ] `msb_restart NAME` runs `msb stop` on the stored sandbox ID. Next, `msb_restart NAME` runs `msb start` on the same ID.
- [ ] `msb_destroy NAME` removes the guest, and `msb_list` prints the number of guests whose name starts with `agro-mx-`.
- [ ] `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` covers each `msb_` function with a stub `ssh` and a stub `msb` on `PATH`.
- [ ] `bash -n` and `shellcheck` pass on `adapters/msb.sh`.
- [ ] Typecheck passes.

### US-004: microVM guest check

**Description:** As the advisor, I want one check script with the microVM rows. Both arms then report Docker, persistence, and footprint results in the `RESULT` format.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/checks/msb-guest.sh` emits one `RESULT <row-id> <PASS|FAIL|SKIPPED> <detail>` line for each row `M01` to `M06` in `## Summary`.
- [ ] Each row runs when an earlier row fails. The script exits with the count of `FAIL` rows.
- [ ] On a host-mode node, rows `M03` and `M05` print `SKIPPED` with the reason `no microVM`.
- [ ] `bash -n` and `shellcheck` pass on `checks/msb-guest.sh`.
- [ ] `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` asserts that the script prints one `RESULT` line for each row ID with stubbed commands.

### US-005: Run both arms

**Description:** As the operator, I want three runs of each arm with the same checks so that the decision uses medians, not one sample.

**Acceptance Criteria:**

- [ ] Every run uses the console free tier. The runs create no paid resource.
- [ ] Arm A0 runs `bash run.sh console agro-rows.sh` and `bash run.sh console msb-guest.sh` three times on `CONSOLE_SPEC=n4`.
- [ ] Arm A1 runs `IMAGE=ghcr.io/mifunedev/agro:spike-msb-<sha> bash run.sh msb agro-rows.sh` and `IMAGE=ghcr.io/mifunedev/agro:spike-msb-<sha> bash run.sh msb msb-guest.sh` three times on the A1 console node.
- [ ] Arm A1 runs `scripts/restart-test.sh msb` three times.
- [ ] The free tier allows one live node, so the runs execute one at a time. Each run deletes its node before the next run starts.
- [ ] Each run writes its log under `.agro/tasks/msb-base-image-spike/evidence/`.
- [ ] Both arms use the same `msb` release `<msb-version>` and the same AGRO commit.
- [ ] After the last run, `agro node list` and `msb_list` show no node and no guest that the runs created.

### US-006: Decision brief

**Description:** As the operator, I want one brief that applies the decision rule to the medians. I then choose between HEAD and the microsandbox layer from evidence.

**Acceptance Criteria:**

- [ ] `.agro/tasks/msb-base-image-spike/brief.md` holds one table with one column for each arm and one row for each row ID in `R01` to `R14` and `M01` to `M06`.
- [ ] The table shows the median of the three runs for each timed row and the pass count for each other row.
- [ ] The brief computes the cost per tenant for each arm with the formula in `## Summary` and cites a source for each price.
- [ ] The brief states exactly one outcome: `proceed` or `stay on HEAD`, and names the rule clause that decides the outcome.
- [ ] If the outcome is `stay on HEAD`, the task PR removes the `agro-msb` stage and `adapters/msb.sh`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/msb-base-image-spike/brief.md` exits 0.

### US-007: Manual review evidence

**Description:** As the operator, I want a command transcript of one A1 run so that I review the microVM path without a rerun.

**Acceptance Criteria:**

- [ ] `.agro/tasks/msb-base-image-spike/evidence/manual-review.md` holds the commands and outputs of one A1 run of `msb-guest.sh` and of `scripts/restart-test.sh msb`.
- [ ] The transcript shows `systemd` as PID 1 in the guest, a `docker run hello-world` result, and the `tmux` session list before and after `msb stop` and `msb start`.
- [ ] The run uses a live resource only with operator approval. The transcript shows the deletion of each resource that the run created.

## Summary

The council compared three base-image options for agro-console. All three members recommended one AGRO image that more than one runtime runs. The council rejected a separate third-party base image. The operator reports that `ryaneggz/microsandbox-ubuntu-dind` works well as an `msb` base. This spike measures current HEAD against a microsandbox layer built by the council approach.

Verified current state:

- `.devcontainer/Dockerfile` has the stages `base`, `home`, and `final`. The `final` stage sets `CMD ["/sbin/init"]`.
- The image installs only `docker-ce-cli` and `docker-compose-plugin`, not the Docker daemon.
- `.agro/cli/src/lib/runtimes/catalog.ts` marks `microsandbox` as `planned` with `provisionable: false`.
- `.agro/cli/src/lib/tools/catalog.ts` pins the `msb` installer script by sha256, not the `msb` release.
- `docs/runtimes/microsandbox.md` states that a microVM needs `/dev/kvm` and that the sandbox has no `/dev/kvm`.
- The `/remote-sandbox` driver loads `adapters/<provider>.sh` and needs five functions per provider.
- `checks/agro-rows.sh` emits rows `R01` to `R15` and `R02b`, and has an `image` mode for a booted image.
- An agro-console node is one VM in host mode with no image choice.
- On exe.dev, the AGRO image booted as a VM with systemd as PID 1 and reported healthy after about 25 seconds.

Arms:

| Arm | Runtime | Image |
|---|---|---|
| A0 | agro-console `n4` node in host mode | current HEAD install |
| A1 | `msb run --init auto` on an agro-console `n4` node with nested KVM | `agro-msb` target of the HEAD Dockerfile |

New rows in `checks/msb-guest.sh`:

| Row | Check | PASS condition |
|---|---|---|
| M01-dockerd | `systemctl is-active docker` and `docker run --rm hello-world` | both exit 0 |
| M02-pid1 | `ps -p 1 -o comm=` | prints `systemd` |
| M03-restart-persist | `docker info` and `tmux ls` after `msb stop` and `msb start` | dockerd is active and the `tmux` session `agro-mx-probe` exists |
| M04-idle-memory | `MemTotal` minus `MemAvailable` in `/proc/meminfo`, 60 seconds after healthy | reports a value in MiB |
| M05-snapshot-restore | `ps -p 1 -o comm=` after a snapshot restore | prints `systemd` |
| M06-image-size | `docker image inspect` size of the tested image | reports a value in MiB |

Cost per tenant:

- A0: the hourly price of one `n4` node, because one node holds one tenant.
- A1: the hourly price of one `n4` node divided by the floor of usable node memory over the median `M04` value.

Decision rule:

1. If US-001 finds no `/dev/kvm`, the outcome is `stay on HEAD`.
2. If A1 fails `R05`, `R06`, `M01`, `M02`, or `M03` in any run, the outcome is `stay on HEAD`.
3. If the A1 cost per tenant is not lower than the A0 cost per tenant, the outcome is `stay on HEAD`.
4. Otherwise, the outcome is `proceed`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | stage `final`, new stage `agro-msb` | Builds the A1 image from the one AGRO image definition |
| `.agro/skills/remote-sandbox/scripts/run.sh` | provider dispatch | Runs each check on each arm |
| `.agro/skills/remote-sandbox/scripts/lib.sh` | adapter loading | Loads `adapters/msb.sh` |
| `.agro/skills/remote-sandbox/scripts/restart-test.sh` | `<p>_restart` hook | Drives `msb stop` and `msb start` |
| `.agro/skills/remote-sandbox/adapters/console.sh` | `console_create`, `console_exec` | Runs arm A0 |
| `.agro/skills/remote-sandbox/adapters/msb.sh` | new `msb_` functions | Runs arm A1 |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | rows `R01` to `R15`, `MODE` | Shared matrix for both arms |
| `.agro/skills/remote-sandbox/checks/msb-guest.sh` | new rows `M01` to `M06` | MicroVM rows for both arms |
| `.agro/cli/src/lib/tools/catalog.ts` | `microsandbox` entry | Current installer pin |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `run.sh msb <check>` | New provider | Adds the `msb` provider to the `/remote-sandbox` driver |
| `docker build --target agro-msb` | New build target | Adds an image target. The release workflow does not publish the target. |
| `agro` verbs | None | The spike changes no lifecycle verb |

## Storage

The spike writes logs and the brief under `.agro/tasks/msb-base-image-spike/evidence/` and `.agro/tasks/msb-base-image-spike/brief.md`. The `.gitignore` rule `.agro/tasks/*/*` keeps both files local. The advisor copies the result lines and the brief into the PR body at Close. The spike adds no database and no schema.

## Architectural Decisions

- One image definition stays the source of truth. The `agro-msb` stage extends `final` in the same Dockerfile. The spike adds no second Dockerfile and no third-party base image.
- The spike keeps the Debian `trixie` base of `final`. The spike ports the Docker engine recipe of `ryaneggz/microsandbox-ubuntu-dind`, not its Ubuntu base.
- systemd manages `dockerd` in the guest. This replaces the `CMD dockerd` of the dind image and targets the restart gap that its README reports.
- `msb` runs on the agro-console node host, not inside the sandbox container. The sandbox compose file keeps its device guard.
- The spike pins the newest upstream `msb` release on the day of US-001, and uses that release for every run.
- The release workflow does not publish `agro-msb`. A publish decision follows only a `proceed` outcome.
- If the outcome is `stay on HEAD`, the task PR deletes the `agro-msb` stage and `adapters/msb.sh`. Only the evidence and the brief stay.
- An application agent in the sandbox implements the stories. The root orchestrator writes no application code.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | `msb_create`, `msb_exec`, `msb_restart`, `msb_destroy`, `msb_list` with stub `ssh` and stub `msb` | The adapter contract for the `msb` provider |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | `msb-guest.sh` prints one `RESULT` line for each row `M01` to `M06` | The row format and the exit count |
| `.github/workflows/release.yml` smoke step | `final` image boot | The `final` target stays unchanged |
| `.agro/tasks/msb-base-image-spike/evidence/` | three runs for each arm | The decision inputs |

## Design Principles

- Measure, then decide. The brief states one outcome from a fixed rule.
- Keep one source of truth for the image.
- Delete the spike code when the outcome is `stay on HEAD`.
- Use only the console free tier. Delete each live node after each run.
- Write no explanatory comment in tracked code.

## Out of Scope

- Publishing `agro-msb` to GHCR.
- Changes to `agro sandbox install microsandbox` or to the runtime catalog state.
- Changes to the `agro` and `sandbox` profiles of `agro node create`.
- A switch of the base distro to Ubuntu.
- Changes to `docs/`. A `proceed` outcome starts a separate plan for the docs.

## Open Questions

None. `<sha>` is the AGRO commit under test, and `<msb-version>` is the release that US-001 records.

## Acceptance Criteria

- [ ] Each story US-001 to US-007 has `passes: true` in `prd.json`, or the advisor recorded a US-001 stop in `blocked`.
- [ ] `brief.md` states exactly one outcome and names the deciding rule clause.
- [ ] No live node or guest that the spike created remains after the last run.
- [ ] After the advisor writes the brief, the advisor deletes the GHCR tag `spike-msb-<sha>`, and the tag no longer exists.
- [ ] The `final` image smoke test passes on the task branch.

## Lessons

1. Claim: under `msb run --init auto`, msb v0.7.13 also runs the image `CMD` as the startup command, and msb stops the sandbox when that command exits. Evidence: `startup command exited with non-zero status code=1` in `evidence/a1-smoke2-diag.txt`. Outcome: fixed in this PR. The `agro-msb` stage sets `CMD ["sleep", "infinity"]`.
2. Claim: the msb graceful shutdown reaches systemd as ctrl-alt-del, and the image routes ctrl-alt-del to `reboot.target`. Evidence: `ctrl-alt-del.target` resolves to `reboot.target` with `CtrlAltDelBurstAction=reboot-force` in `evidence/a1-smoke2-live-probe.txt`. Outcome: fixed in this PR. The `agro-msb` stage links `ctrl-alt-del.target` to `poweroff.target`.
3. Claim: the upstream `install.sh` resolves the latest msb release at run time, so a tag in the URL does not pin the version. Evidence: `get_latest_version` in `install.sh` at `v0.7.13`. Outcome: fixed in this PR. `msb_create` rewrites the version line and checks `msb --version`.
4. Claim: an msb snapshot restore in v0.7.13 boots without the PID 1 handoff to systemd. Evidence: `M05` FAIL 3 of 3 with `pid1=init.krun`. Outcome: dropped. The limit is upstream, and `references/providers.md` records the limit.
5. Claim: the plan stated that git tracks task evidence, but the `.gitignore` rule `.agro/tasks/*/*` keeps task evidence local. Evidence: `git add` refused `evidence/kvm-probe.log`. Outcome: fixed in this PR. The `## Storage` section names the rule, and the linked evidence files use `git add -f`.
6. Claim: the agro-console dev sign-in did not create a personal context, so the free tier refused the `dev` user. Evidence: `403 FREE_TIER_INELIGIBLE`. Outcome: fixed in mifunedev/agro-console#665.
7. Claim: the local console tunnel pointed at port 3005 while the web server ran on port 3006, so each node stayed in `waiting_for_boot`. Evidence: create to SSH dropped from 918 s to about 190 s after the tunnel change. Outcome: dropped. The cause is an uncommitted local edit in the operator environment, outside this repository.
8. Claim: `M03` compares a full microVM reboot on A1 against no reboot on A0. Evidence: A0 reports `M03` as SKIPPED. Outcome: dropped. The brief records the caveat, and the operator chose the outcome.
9. Claim: the Hermes smoke refuses a host with a Docker socket, so `R14` fails on A1. Evidence: `smoke=64 ERROR: Hermes smoke requires sandbox user and no Docker sock`. Outcome: dropped. The finding matters only when the msb path proceeds.
10. Claim: `herdr-default.test.ts` and `install.test.ts` fail in this sandbox. Evidence: the same 11 failures on unmodified `origin/development`. Outcome: dropped. The failures predate this PR and come from the environment.
