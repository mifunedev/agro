# Evidence — AGRO namespace and persisted state become canonical (#942, Phase 2)

Branch `feat/942-agro-namespace-cutover`, PR #996, base `development`.
Planning base commit `9d2fb00957fdfb9bd918660a6c01474504ad6c7d`.

## What a reviewer should check first

1. The rename is mechanical and complete: `git diff --find-renames 9d2fb009..HEAD --stat`.
2. Fresh state resolves to AGRO in both implementations, and legacy state does not move:
   `.agro/cli/src/lib/__tests__/fixtures/compat-vectors.json` drives `compat.test.ts` and
   `compat-shell.test.ts` from one table.
3. A real legacy workspace volume survives the new image: `sandbox-upgrade-smoke.log` in this folder.
4. `agro migrate` plans before it mutates, is idempotent, and refuses divergence:
   `migrate-command.test.ts`, `migrate-rehearsal.test.ts`.

## Commits

| Commit | Story | What it does |
|---|---|---|
| `2a438810` | — | Scaffold the task folder (prd.md, prd.json, progress.txt) |
| `c2aae7c9` | US-001 | `.oh` → `.agro`, `oh.json` → `agro.json`, every current reference updated |
| `c0504546` | US-003 | `agro migrate` over the Phase 0 engine, plus the provider relink step |
| `2d22bb07` | US-002 | Fresh state resolves to AGRO; `AGRO_*` compose keys with `OH_*` fallback |
| `363ea005` | US-004 | Image seeds `/opt/agro-seed`; entrypoint, healthcheck, and cron unit resolve at run time |
| `a6ce74b3` | US-005 | Old-volume/new-image upgrade smoke and the migration rehearsal test |
| `6d2891f1` | US-001, US-002 | Repair a YAML block scalar the rename re-indented; give the default sandbox name an owner |

## Real Docker evidence (US-005)

`.agro/scripts/sandbox-upgrade-smoke.sh`, run locally from this worktree at `a6ce74b3`.
Full log: `sandbox-upgrade-smoke.log` (318 lines) beside this file.

| Assertion | Result |
|---|---|
| `~/.config/gh/hosts.yml` sha256 before and after | identical |
| `~/harness/UPGRADE-CANARY.txt` sha256 before and after | identical |
| `~/harness/.oh/` still owns the workspace | present |
| `~/harness/.agro/` created by the new image | absent |
| `~/harness/.oh/.image-seeded` | unchanged |
| `~/harness/.oh/scripts` content hash | unchanged |
| `openharness-bootstrap.service`, `openharness-cron.service` | both active |
| container health | healthy |
| entrypoint conflict or re-seed warning in the boot log | none |

Legacy image `ghcr.io/mifunedev/openharness:0.9.0`; new image built from this checkout's
`.devcontainer/Dockerfile`; one compose project and one named volume across both boots.

## Gates

Run from this worktree at `cfc1ab04`.

| Gate | Command | Result |
|---|---|---|
| Unit and script tests | `pnpm test` | 74 files, 1244 tests, exit 0 |
| Root typecheck | `pnpm run typecheck` | exit 0 |
| CLI typecheck and build | `npm --prefix .agro/cli run typecheck`, `run build` | exit 0 |
| Provider links | `bash .agro/scripts/link-providers.sh --check` | exit 0 |
| Probe suite | `bash .agro/skills/eval/run.sh` | 145 probes, 144 green |
| Whitespace | `git diff --check` | exit 0 |
| Shellcheck | the boot-path glob from `ci-harness.yml` | exit 0 |
| Compose | `docker compose -f .devcontainer/docker-compose.yml config` and the image-only base | exit 0 |
| Knowledge freshness | `knowledge-impact.sh --verified` | 0 needs-review, 9 fresh |
| Docker upgrade | `bash .agro/scripts/sandbox-upgrade-smoke.sh` | PASS |

### The one red probe

`skills-vendored` is REGRESSION here and on `development`: its row reads REGRESSION in
the tracked results file at the branch point `9d2fb009` and at `origin/development`.
Earlier phases recorded the cause as a missing binary. That is wrong. `cc-safety-net@1.0.6`
is installed at `/usr/local/bin/cc-safety-net`. The probe's clean-clone simulation runs
`link-providers.sh` with `PATH` set to `<fixture>:/usr/bin:/bin`
(`.agro/evals/probes/skills-vendored.sh:53`), which omits `/usr/local/bin`, so the pin
check inside `link-providers.sh` cannot find the binary it requires. The simulation's
purpose is to prove the Hermes link keys off the `hermes` binary, and dropping
`/usr/local/bin` is incidental to that. Nothing in this branch touches either file. The
fix is one line and belongs to a change that owns that probe.

### Defects this build's verification found and fixed

| Defect | How it surfaced | Fix |
|---|---|---|
| The rename re-indented one line inside a YAML block scalar, making the close-issues workflow invalid and failing every push at startup | red branch runs with no job and no log | restored the indentation; a scan of every changed line pair in the whole diff found this one site |
| `agro migrate --home` read the home directory directly, ignoring `AGRO_HOME` and `OH_HOME`, and would have renamed inside an explicitly configured registry home | `oh-config-surfaces` named `migrate.ts` as a source resolving config out of `$HOME` | `compat.ts` owns the resolution through `resolveRegistryHome`; a configured home is a reported noop |
| A compat constant was unused inside its own file | `Boot Path Lint` shellcheck SC2034 in CI | the default sandbox name got an owner function that the compose wrapper calls |
| Knowledge claims that predate this work: `materialize()` documented as seven files, the CLI pin as 0.8.0, a retired pnpm opt-out described as live, and line ranges past the end of their file | re-grounding each page the diff invalidated | corrected in place |

### Probe changes, with fault injection

`sandbox-boot-guard-ci.sh` banned every registry image reference in that workflow, which
the upgrade job's pinned public legacy image trips. The rule now bans pushes, logins,
`packages: write`, and secrets as before, permits a registry reference only on the
upgrade job's `LEGACY_IMAGE` line, rejects a moving tag there, and additionally requires
the upgrade job to exist. Five injections were each rejected: a `docker push`, a
`:latest` pin, a stray registry reference elsewhere, an injected secret, and deleting the
upgrade smoke invocation. The restored file passes.

## Unverified or deferred

- The seed destination rename and the entrypoint run-time resolution are proven by the local
  upgrade smoke and by `entrypoint-seed.test.ts`; the CI job `sandbox-upgrade-guard` runs the
  same script on every pull request that touches the boot path.
- `/opt/oh-seed` remains a supported seed source for images that still ship it; nothing in this
  repository stages it any more.
- The root checkout at `/home/sandbox/harness` still uses `.oh/`. It is the bind mount of the
  sandbox running this session, so it is migrated by the operator with `agro migrate` after the
  merge, not by this pull request.

## Benchmark

**Floor: held.** `eval-result.json` records 145 probes at `a0d0437e` with one
regression, `skills-vendored`, whose row already read REGRESSION at the branch
point `9d2fb009` and on `origin/development`. No probe went green to red because
of this branch, and two went red to green (`oh-config-surfaces`,
`oh-update-bootstrap`).

**Ceiling: not re-scored, and not moved by construction.** The three live
capability tasks score how the harness ships a change, walks the workflow, and
compiles a lesson. This phase renames a namespace, flips fresh-state defaults,
and adds one migration command; the task files changed only in their paths, and
no workflow they score behaves differently. Re-scoring them means three full
agent runs that would measure the same behaviour, so no run was made and no row
was overwritten. This phase's benefit is contractual — issue #942 and the epic's
RFC — and the capability benchmark is not the instrument that decides it.

## Promotable audit

Read-only classification immediately before the undraft, at `73df2dc0`:

| Field | Value |
|---|---|
| CI | PASS, all seven checks |
| mergeable | MERGEABLE |
| merge state | CLEAN |
| evidence complete | true |
| promotable | true |
| flags | size-convention |

`size-convention` is the only flag: the tree rename moves about 620 files in one
commit, which the pull-request body explains and which later stories depend on
for a clean diff. Verdict: PR-AUDIT-PROMOTABLE. The pull request is marked ready
for review; the merge is the operator's.
