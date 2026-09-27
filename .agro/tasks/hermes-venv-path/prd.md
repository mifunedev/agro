# PRD: Hermes install and smoke check use the upstream pm environment

Status: DRAFT

## User Stories

### US-001: Install Hermes extras through pm

**Description:** As an operator, I want `agro harness install hermes` to succeed on a fresh sandbox. Then the Hermes harness works again.

**Acceptance Criteria:**

- [ ] A test in `.agro/cli/src/__tests__/harness-catalog.test.ts` expects the Hermes install argv to end with `"<prefix>/bin/hermes" pm install --extra slack --extra teams` and to contain no `venv/bin/python`. The test fails on `origin/development`.
- [ ] The Hermes `installArgv` in `.agro/cli/src/lib/harnesses/catalog.ts` runs the upstream installer, then `"<prefix>/bin/hermes" pm install --extra slack --extra teams`. The `uv pip install` step is gone.
- [ ] The test passes after the change.
- [ ] `pnpm run typecheck` exits 0.

### US-002: Run the smoke check in the upstream activated environment

**Description:** As a maintainer, I want the smoke check to use the upstream activation helper. Then an upstream change to the environment path does not break the check.

**Acceptance Criteria:**

- [ ] `.agro/scripts/hermes-install-smoke.sh` writes its Python program to a temporary file and runs the file with `"$HOME/.local/lib/hermes-agent/scripts/_hermes-python"`.
- [ ] `.agro/scripts/hermes-install-smoke.sh` contains no `venv/bin/python`.
- [ ] `.agro/scripts/hermes-install-smoke.sh` removes the temporary file on exit.
- [ ] `.agro/scripts/__tests__/hermes-links.test.ts` passes, and the guard cases still refuse a non-disposable sandbox.

### US-003: Remove the obsolete Teams dependency repair from the gateway

**Description:** As a maintainer, I want no code that repairs a Hermes environment at a path that no install creates. Then the gateway has one dependency source: pm.

**Acceptance Criteria:**

- [ ] `.agro/scripts/gateway.sh` contains no `ensure_hermes_teams_deps` function and no call to the function.
- [ ] `git grep -n "hermes-agent/venv" -- . ':!.agro/tasks' ':!CHANGELOG.md'` prints no line.
- [ ] Each test and probe that names `ensure_hermes_teams_deps` is updated, and the related tests pass.
- [ ] `docs/harnesses/hermes.md` states that pm owns the Hermes environment and that AGRO adds the `slack` and `teams` extras. `ste-check.sh` reports no new finding on the file.

### US-004: Capture the manual review evidence from CI

**Description:** As the advisor, I want the CI install log as evidence. Then the PR shows a fresh install on a disposable sandbox without a local Docker resource.

**Acceptance Criteria:**

- [ ] The CI job "Install every optional harness through the CLI" passes on the PR.
- [ ] `.agro/tasks/hermes-venv-path/evidence/manual-review.md` records the run URL, the `agro harness install hermes` log lines, and the smoke check line with `"result": "PASS"`.
- [ ] Depends on US-001, US-002, and US-003.

## Summary

Issue #1242 reports that the CI job "Install every optional harness through the CLI" fails. Evidence: https://github.com/mifunedev/agro/actions/runs/36348006881/job/108701040544.

Verified AGRO state on `origin/development`:

- `.agro/cli/src/lib/harnesses/catalog.ts:129` runs the upstream installer, then `uv pip install --python "<prefix>/lib/hermes-agent/venv/bin/python" 'hermes-agent[slack,teams,web,pty]'`.
- `.agro/scripts/hermes-install-smoke.sh:13` starts `"$HOME/.local/lib/hermes-agent/venv/bin/python"`.
- `.agro/scripts/gateway.sh:228` `ensure_hermes_teams_deps` uses `/usr/local/lib/hermes-agent/venv/bin/python`. No AGRO install writes that path, so the function returns 0 at the `[ -x "$py" ]` check.
- The CI retry does not repair a failed install. The second attempt reports `already installed`.

Verified upstream state (`NousResearch/hermes-agent` at `04ea129`, 2026-09-28):

- `install.sh` `stage_venv` creates only a bootstrap Python. `pm.cli install` creates the dependency environment.
- `pm/environments.py` `_recorded_venv` puts the environment under `<hermes root>/installs/<key>/environments/<generation>`. The key is a hash of the install path, so the path is not fixed.
- `pm/cli.py` `install` accepts `--extra NAME`, and `sync_venv` adds extras to the recorded set. A default install syncs `[all]`.
- `pyproject.toml` `[all]` includes `pty` and `web`. `[all]` does not include `slack` or `teams`.
- `scripts/_hermes-python <script.py>` activates the install environment, then runs the script.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/harnesses/catalog.ts` | Hermes `installArgv` (line 129) | Install command |
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Hermes argv case (line 292) | Install command test |
| `.agro/scripts/hermes-install-smoke.sh` | interpreter call (line 13) | Smoke check |
| `.agro/scripts/__tests__/hermes-links.test.ts` | smoke script case (line 136) | Smoke guard test |
| `.agro/scripts/gateway.sh` | `ensure_hermes_teams_deps` (line 227) | Obsolete repair path |
| `docs/harnesses/hermes.md` | install layout (line 132) | Operator documentation |
| `.github/workflows/sandbox-compatibility.yml` | harness install loop | CI proof |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro harness install hermes` | behavior fix | The install uses `hermes pm install` for the `slack` and `teams` extras. |
| `hermes-install-smoke.sh` | internal | The smoke check runs through `_hermes-python`. |
| `agro gateway` with Hermes Teams | removal | The gateway no longer tries a repair at `/usr/local/lib/hermes-agent`. |

## Storage

N/A. The change adds no persistent state. Upstream pm owns the environment and its records.

## Architectural Decisions

- Upstream pm owns the Hermes environment. AGRO requests extras through `hermes pm install --extra` and does not install into the environment directly.
- AGRO finds the environment through upstream `_hermes-python`. AGRO does not compute the environment path.
- AGRO does not pin an older Hermes release.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/harness-catalog.test.ts` | Hermes argv uses `pm install --extra slack --extra teams` | install command |
| `.agro/scripts/__tests__/hermes-links.test.ts` | guard cases refuse a non-disposable sandbox | smoke safety |
| CI `sandbox-compatibility.yml` | install and smoke check pass on a fresh sandbox | end-to-end install |

## Design Principles

- Code is the source of truth. Write no explanatory comments.
- Delete obsolete paths instead of keeping dormant alternatives.
- Use CI as the disposable sandbox. Do not change the operator's live sandbox.

## Out of Scope

- Pinning an older Hermes release.
- Changes to the retry logic in `sandbox-compatibility.yml`.
- Other harnesses.

## Open Questions

None.

## Acceptance Criteria

- [ ] The CI job "Install every optional harness through the CLI" passes on the PR.
- [ ] No tracked file outside `.agro/tasks/**` and `CHANGELOG.md` names `hermes-agent/venv`.
- [ ] `pnpm run typecheck` exits 0, and the related tests pass.

## Lessons

1. Claim: the CI retry cannot repair a partial harness install. Evidence: in run 36348006881, attempt 2 printed `hermes: already installed` and skipped the failed extras step. Outcome: proposed issue, pending operator approval.
2. Claim: an upstream installer can move the Hermes environment without notice. Evidence: upstream `04ea129` moved the environment under `installs/<key>/environments/<generation>`. Outcome: fixed in this PR, because AGRO now uses `hermes pm install` and `_hermes-python`.
3. Claim: a worker scope that lists only files which name a symbol can miss a test that checks the content of the symbol. Evidence: `gateway.test.ts` checked the `microsoft-teams-apps` pin and did not name `ensure_hermes_teams_deps`. Outcome: dropped, because the advisor fixed the scope with one bounded repair.
