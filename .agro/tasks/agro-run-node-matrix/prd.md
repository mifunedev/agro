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

### US-003: Live run on a new node

**Description:** As the operator, I want the matrix run on a new agro-console node so that the modes have proof outside this host.

**Acceptance Criteria:**

- [ ] `external`: the operator runs `agro auth login` on this host, because `agro auth status` returns HTTP 401.
- [ ] Before the run, the console preflight (`console_preflight`) passes, and the run creates no node when the preflight fails.
- [ ] `bash .agro/skills/remote-sandbox/scripts/run.sh console checks/agro-run-matrix.sh` on a free-tier `n4` node prints a `RESULT` line for `X01` to `X08`.
- [ ] `.agro/tasks/agro-run-node-matrix/evidence/manual-review.md` records the rows, and `agro node list` shows no node that the run created.

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
Services and the egress allowlist in the microVM mode.

## Open Questions
None

## Acceptance Criteria
- [ ] Each story has `passes: true` in `prd.json`, except the `external` criterion of US-003.
- [ ] CI is green on the pull request.

## Lessons
