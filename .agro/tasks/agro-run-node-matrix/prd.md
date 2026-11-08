# PRD: agro run node matrix

Status: DRAFT

## User Stories

### US-001: The microsandbox tool installs msb 0.7.13

**Description:** As an operator, I want `agro tool install microsandbox` to install msb 0.7.13 so that the microVM mode of `agro run` works after one command.

**Acceptance Criteria:**

- [ ] The `microsandbox` entry in `.agro/cli/src/lib/tools/catalog.ts` downloads the msb installer at tag `v0.7.13`, checks the script against its `sha256`, and installs version `v0.7.13`.
- [ ] The install command fails when `msb --version` does not report `0.7.13`.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` pins the URL, the `sha256`, and the version check.
- [ ] `docs/runtimes/microsandbox.md` states that AGRO pins msb `0.7.13`.
- [ ] `agro run -- pnpm typecheck` exits 0, and `agro run -- pnpm test` shows no new failure against `evidence/baseline.md`.

### US-002: The agro run matrix check

**Description:** As an operator, I want one remote-sandbox check for the `agro run` modes so that a new node proves the modes with one command.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/checks/agro-run-matrix.sh` installs AGRO from `INSTALL_URL`, adds the user to the `kvm` group, installs the microsandbox tool, and creates a scratch git repository.
- [ ] The check prints one `RESULT` line for each of 8 rows. `X01` checks the container exit code, `X02` service reachability, `X03` egress allow, and `X04` egress deny. `X05` checks the microVM user and exit code, `X06` the microVM boot time from `microvm.jsonl`, `X07` the refusals, and `X08` leftovers.
- [ ] The check runs each microVM row through `sg kvm`, because the new group applies only to a new login.
- [ ] The check ends with a `SUMMARY` line and deletes the scratch repository.
- [ ] `.agro/skills/remote-sandbox/SKILL.md` holds one section that names the check, the rows, and the run command.
- [ ] `bash -n` and `shellcheck` pass on the check.

### US-004: Changelog

**Description:** As a reviewer, I want a changelog entry so that the pinned msb version and the new check are visible.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` that links the task issue.

## Summary

`agro run --isolation microvm` requires msb `0.7.13` exactly (mifunedev/agro#1591), but the `microsandbox` catalog entry installs the msb release of the day from a fixed installer commit. The remote-sandbox msb adapter already pins the version with a `sed` rewrite of the installer. The remote-sandbox skill runs checks that print `RESULT` lines on a new VM. On this host, `agro auth status` returns HTTP 401, so a live console run needs the operator.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `microsandbox` entry | Pinned install |
| `.agro/skills/remote-sandbox/checks/agro-run-matrix.sh` | new check | Node matrix |
| `.agro/skills/remote-sandbox/SKILL.md` | checks section | Reference |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro tool install microsandbox` | Changed | Installs msb `0.7.13` |
| remote-sandbox | Added | `checks/agro-run-matrix.sh` |

## Storage
N/A. The check deletes its scratch repository.

## Architectural Decisions
The `microsandbox` catalog entry and the msb adapter pin the same msb version. The check reuses the console adapter and the driver.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | URL, sha256, version check | US-001 |
| `shellcheck` | `agro-run-matrix.sh` | US-002 |

## Design Principles
Keep one msb version. Reuse the driver. Add no explanatory comments.

## Out of Scope
Services and the egress allowlist in the microVM mode. The live run on a new node: the local console refused a free node with `HTTP 403 FREE_TIER_INELIGIBLE`, so the operator deferred the run. Issue #1594 tracks the run and its command.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`.
- [ ] CI is green on the pull request.

## Lessons

1. Claim: the upstream msb installer always writes its symlink to `$HOME/.local/bin`, whatever the install prefix. Evidence: US-001 report. Outcome: dropped, because the default prefix is `$HOME/.local`, and the behavior predates this PR.
2. Claim: `X08` can fail on a shared host when another `agro run` runs at the same time. Evidence: US-002 report; the check cannot tell its own resources apart. Outcome: dropped, because the check targets a new node.
3. Claim: the live node run did not happen. Evidence: the first attempt found no `~/.ssh/id_ed25519.pub`; the second attempt, with a disposable console key, got `HTTP 403 FREE_TIER_INELIGIBLE`. Each attempt created no node. Outcome: dropped from this PR; issue #1594 tracks the re-run.
4. Claim: `next.sh` requires `passes: true` on every story, so the `external` label of `/prd` cannot keep a story open without a block. Evidence: `.agro/skills/delegate/scripts/next.sh` line 83. Outcome: dropped from this PR; the advisor moved the live run to Out of Scope.
