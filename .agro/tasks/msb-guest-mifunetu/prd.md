# PRD: mifunetu is the msb guest; retire agro-msb and the msb validation adapter

Status: DRAFT

## User Stories

### US-001: Default `agro run --isolation microvm` image is mifunetu

**Description:** As an operator, I want `agro run --isolation microvm` to boot `ghcr.io/mifunedev/mifunetu:<version>` by default so that the guest carries no unused agro control plane and no unused dockerd.

**Acceptance Criteria:**

- [ ] `microvmImageRef("1.2.3")` returns `ghcr.io/mifunedev/mifunetu:1.2.3` (`.agro/cli/src/__tests__/microvm-target.test.ts`).
- [ ] The precedence test in `.agro/cli/src/__tests__/run.test.ts` asserts `--image`, then `run.microvm.image`, then `ghcr.io/mifunedev/mifunetu:<AGRO_VERSION>`.
- [ ] The `IMAGE` constant in `microvm-target.test.ts` names a mifunetu reference.
- [ ] `agro run --help` names the mifunetu image as the default (`.agro/cli/src/cli.ts`).
- [ ] `docs/lifecycle-commands.md` and `.agro/skills/sandbox/references/local-msb.md` name `ghcr.io/mifunedev/mifunetu:<version>` as the default and contain no `-msb` image reference.
- [ ] `docs/lifecycle-commands.md` states that an existing `run.microvm.image` pin to `agro:<old>-msb` keeps working at that version. The page also tells the reader to pass `--image` or to install `@mifune/agro` in the guest when a guest command needs `agro`.
- [ ] For a CLI version that `officialImageRef` maps to `latest`, `agro run --isolation microvm` with no `--image` and no `run.microvm.image` exits 1 before `msb run`. The message names `--image` as the remedy, because mifunetu has no `latest` tag.
- [ ] `CHANGELOG.md` `## [Unreleased]` has a `### Changed` entry for the new default, with a reference to ADR #1635. The section also has a `### Removed` entry for the `agro-msb` stage, the `-msb` tags, and the msb validation adapter.
- [ ] `agro run -- pnpm run typecheck` exits 0.
- [ ] `agro run -- pnpm exec vitest run .agro/cli/src/__tests__/microvm-target.test.ts .agro/cli/src/__tests__/run.test.ts` exits 0.

### US-002: Retire the agro-msb stage and the publish-msb-image job

**Description:** As a maintainer, I want the release to stop building and publishing `agro:<v>-msb` so that each release runs one fewer unsmoked image job.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` has no `agro-msb` stage, and the default build target is still stage `final`.
- [ ] `.github/workflows/release.yml` has no `publish-msb-image` job, and no other job lists that job in `needs`.
- [ ] `release-reservation.test.ts` has no test for the `publish-msb-image` job. The test "rejects an -msb tag as a release version for latest promotion" stays unchanged.
- [ ] `ci-workflow-contract.test.ts` has no `publish-msb-image` entry.
- [ ] `git grep -n 'agro-msb\|publish-msb-image' -- .devcontainer .github .agro/scripts` prints no line.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/release-reservation.test.ts .agro/scripts/__tests__/ci-workflow-contract.test.ts` exits 0.
- [ ] `hadolint .devcontainer/Dockerfile` reports no new finding.

### US-003: Delete the msb validation adapter and the msb guest scenario

**Description:** As a maintainer, I want the long-lived msb validation guest removed so that the sandbox skill keeps no adapter without a consumer.

**Acceptance Criteria:**

- [ ] `.agro/skills/sandbox/adapters/msb.sh` and `.agro/skills/sandbox/checks/msb-guest.sh` do not exist.
- [ ] `valid_providers` lists `exedev`, `vercel`, and `console`, and does not list `msb` (`remote-sandbox-adapters.test.ts`).
- [ ] `remote-sandbox-adapters.test.ts` has no `remote-sandbox msb adapter` block, and `remote-sandbox-suite.test.ts` has no `checks/msb-guest.sh` block.
- [ ] `sandbox-skill.test.ts` expects three adapters, seven checks, and six validation scenarios.
- [ ] `references/validation.md` has no msb guest scenario and no `MSB_*` or `IMAGE_SIZE_BYTES` variable row. The scenarios keep their order and use the headings Main through Sixth.
- [ ] `references/providers.md` has no `## msb` section and no `msb` adapter ID.
- [ ] `.agro/skills/sandbox/SKILL.md` lists no msb adapter and no msb guest check, and its description has no "msb guest" trigger.
- [ ] The `local/msb` route, `references/local-msb.md`, and `checks/agro-run-matrix.sh` keep their behavior.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/remote-sandbox-adapters.test.ts .agro/scripts/__tests__/remote-sandbox-suite.test.ts .agro/scripts/__tests__/sandbox-skill.test.ts .agro/scripts/__tests__/sandbox-routing.test.ts` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/sandbox/SKILL.md .agro/skills/sandbox/references/validation.md .agro/skills/sandbox/references/providers.md` exits 0.

### US-004: Manual review transcript on the brain

**Description:** As the advisor, I want a transcript of the new default on a real KVM host. The transcript proves that the guest runs harness checks.

**Acceptance Criteria:**

- [ ] `external`: the operator approves the local msb run on the brain before the story starts.
- [ ] Before any run, the transcript shows `msb --version` reporting `0.7.13` and `test -r /dev/kvm -a -w /dev/kvm` exiting 0. If either check fails, the story sets `blocked` and runs nothing.
- [ ] From the branch build, `agro run --isolation microvm --json -- sh -c 'id -un; node -v; exit 7'` prints `sandbox` and a `v24` version, exits 7, and reports a mifunetu image reference.
- [ ] `agro run --isolation microvm -- pnpm run typecheck` on the harness worktree exits 0.
- [ ] `agro run --isolation microvm -- pnpm exec vitest run .agro/cli/src/__tests__/microvm-target.test.ts` exits 0.
- [ ] After the runs, `msb ls` shows no sandbox that the story created, and the story removes the image that msb pulled with `msb image rm`.
- [ ] The transcript is in `.agro/tasks/msb-guest-mifunetu/evidence/manual-review.md`.

## Summary

The operator amended ADR #1635 on 2026-11-15 (comments 6890439690 and 6890467252). The default microVM guest becomes mifunetu. The plan retires stage `agro-msb`, its tags, and the msb validation adapter.

Verified current state:

- `agro run --isolation microvm` runs `msb run` without `--init` (`.agro/cli/src/lib/execution/microvm-target.ts:113-126`). systemd and dockerd do not start in the guest.
- `microvmImageRef` returns `` `${officialImageRef(version)}-msb` `` (`microvm-target.ts:20-22`).
- Stage `agro-msb` starts `FROM final` and adds the Docker engine (`.devcontainer/Dockerfile:212-225`). A trailing `FROM final` makes `final` the default target.
- `publish-msb-image` pushes `agro:<v>-msb` without a smoke gate (`.github/workflows/release.yml:199-239`).
- `publish-image` builds, smokes, and pushes `mifunetu:<version>` and `mifunetu:sha-<sha>` for every non-noop release, including pre-releases (`release.yml:108-176`).
- A falsifier on 2026-11-15 booted `mifunetu:0.38.0` with the `agro run` argument shape. All checks passed: user `sandbox`, `node v24.22.1`, exit 7, `pnpm` on the image PATH, and a host-visible file with uid 1000.
- The msb validation adapter boots an explicit `IMAGE` with `--init auto` on an agro-console node (`.agro/skills/sandbox/adapters/msb.sh`). The operator decided to delete the adapter. Its only consumer, spike #1554, closed "stay on HEAD".

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/microvm-target.ts` | `microvmImageRef` | Default microVM image |
| `.agro/cli/src/lib/version.ts` | `officialImageRef` | Registry prefix for image references |
| `.agro/cli/src/cli.ts` | run help text (`:389-390`) | Names the default image |
| `.agro/cli/src/__tests__/microvm-target.test.ts` | `IMAGE`, `microvmImageRef` test | Pins the default |
| `.agro/cli/src/__tests__/run.test.ts` | precedence test (`:941-944`) | Pins the precedence |
| `.devcontainer/Dockerfile` | stage `agro-msb`, trailing `FROM final` | Retired stage |
| `.github/workflows/release.yml` | job `publish-msb-image` | Retired job |
| `.agro/scripts/__tests__/release-reservation.test.ts` | `:523-546` | Retired job test |
| `.agro/scripts/__tests__/ci-workflow-contract.test.ts` | `:49` | Job timeout table |
| `.agro/skills/sandbox/adapters/msb.sh` | `msb_*` | Deleted adapter |
| `.agro/skills/sandbox/checks/msb-guest.sh` | rows M01-M06 | Deleted check |
| `.agro/skills/sandbox/scripts/lib.sh` | `valid_providers` | Discovers adapters by `_preflight` |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | `:76-84`, `:361-718` | Adapter tests |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | `:95-204` | Check tests |
| `.agro/scripts/__tests__/sandbox-skill.test.ts` | `:229-246` | Skill layout counts |
| `.agro/skills/sandbox/SKILL.md` | description, `:80-98` | Skill index |
| `.agro/skills/sandbox/references/validation.md` | `:13`, `:51`, `:165-199`, `:259-279` | Scenario and variables |
| `.agro/skills/sandbox/references/providers.md` | `:4`, `:17`, `:105-153` | msb provider section |
| `.agro/skills/sandbox/references/local-msb.md` | `:17-18` | Image order |
| `docs/lifecycle-commands.md` | `:312-322` | Image order and pin example |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro run --isolation microvm` default image | Changed | `ghcr.io/mifunedev/mifunetu:<version>` replaces `ghcr.io/mifunedev/agro:<version>-msb` |
| `run.microvm.image` in `agro.json` | Unchanged | The key and its precedence stay. Old `-msb` pins keep working at their version. |
| GHCR `agro:<v>-msb` and `agro:sha-<sha>-msb` | Removed from new releases | Published tags stay on GHCR |
| `.agro/skills/sandbox/scripts/run.sh msb` | Removed | The validation provider `msb` no longer exists |

## Storage

N/A. The change stores no state. `run.microvm.image` keeps its schema (`.agro/cli/src/lib/agro-config.ts:293-294`).

## Architectural Decisions

- ADR #1635 as amended on 2026-11-15 is the source of truth.
- The default image follows the CLI version, as before. `mifunetu:<version>` exists for each release, because `publish-image` pushes it.
- The amendment deletes no published tag.
- `officialImageRef` maps a non-release version to `latest` (`.agro/cli/src/lib/version.ts:13-15`). mifunetu publishes no `latest` tag, so the microVM default refuses that case with a remedy.
- The release test that rejects an `-msb` release version for latest promotion stays as a guard.
- The CLI default and the end of the `-msb` tags ship in the same release.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/microvm-target.test.ts` | `microvmImageRef("1.2.3")` | Default is mifunetu |
| `.agro/cli/src/__tests__/run.test.ts` | image precedence | `--image`, then config, then mifunetu |
| `.agro/scripts/__tests__/release-reservation.test.ts` | no `publish-msb-image` | Retired job |
| `.agro/scripts/__tests__/ci-workflow-contract.test.ts` | timeout table | Retired job |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | provider list | No `msb` provider |
| `.agro/scripts/__tests__/sandbox-skill.test.ts` | layout counts | Three adapters, seven checks, six scenarios |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | routing fixtures | `local/msb` route unchanged |

## Design Principles

- Delete obsolete paths. Do not keep a dormant stage or adapter.
- Keep one Dockerfile and one package list (ADR #1635).
- Add no explanatory comments to tracked code.
- Write prose to `/ste`.

## Out of Scope

- Deletion of published `-msb` tags from GHCR.
- A version bump or a release.
- The exe.dev `.npmrc` proposal.
- Changes to `msb exec` (`--sandbox`), the msb version pin, or `checks/agro-run-matrix.sh`.
- `.agro/tasks/msb-base-image-spike/`, a closed task record.

## Open Questions

None.

## Acceptance Criteria

- [ ] `agro run -- pnpm run typecheck` exits 0.
- [ ] `agro run -- pnpm test` exits 0.
- [ ] `git grep -n -- '-msb' -- .agro/cli/src docs .agro/skills/sandbox .github .devcontainer` prints only lines about the `local/msb` route, `local-msb.md`, or the latest-promotion guard test.
- [ ] CI for the PR is green.

## Lessons

- The plan cited `agro run --isolation microvm --json`, but `agro run` has no `--json` flag. The run exited 1 with `unknown flag "--json"`. The run record in `~/.agro/runs/microvm.jsonl` gave the image reference instead. Outcome: dropped. `/prd` § 3 already requires that each cited command resolves.
- The plan did not list `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json`. The fixture pins a hash of the sandbox instruction files, so each edit to those files makes the replay stale. Seventeen fresh decision-only agents recorded new decisions, and each decision matches its oracle. Outcome: fixed in this PR (US-003, round 1).
- For a CLI version without a release tag, the microVM default named a tag that does not exist: first `agro:latest-msb`, then `mifunetu:latest`. Outcome: fixed in this PR. `microvmImageRef` refuses that case and names `--image`.
- The deleted release test was the only check on the order of the `publish-msb-image` job. Outcome: dropped. The job no longer exists, and the regex test still checks the `needs` of `finalize`.
