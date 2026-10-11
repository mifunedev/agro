# PRD: Retire AGRO crons

Status: DRAFT

## User Stories

### US-001: Remove cron references from public docs and add the changelog entry

**Description:** As an operator, I want docs that describe native harness loops instead of AGRO crons so that the docs match the sandbox.

**Acceptance Criteria:**

- [ ] `docs/intro.md` has no "Markdown crons" bullet and no `cron-runtime.ts` paragraph. One sentence points recurring work to the native loop of the coding harness, for example Claude Code `/loop`.
- [ ] `docs/configuration.md` has no "Cron runtime" section and no `cron.agentBin` row. The `timezone` row does not name cron schedules. The retired-key row for `CRONS_DIR` stays.
- [ ] `docs/lifecycle-commands.md`, `docs/installation.md`, and `docs/agro-directory-layout.md` do not name `crons/` or `agro-cron.service`.
- [ ] `docs/deployment-prebuilt-image.md`, `docs/integrations/langfuse.md`, `docs/integrations/sshd.md`, `docs/integrations/herdr.md`, `docs/harnesses/overview.md`, `docs/harnesses/claude-code.md`, `docs/harnesses/codex.md`, and `docs/harnesses/antigravity-cli.md` do not name `agro-cron.service`, `cron-runtime.ts`, the cron runtime, or detached cron fires.
- [ ] `.github/ISSUE_TEMPLATE/bug.md` does not list cron as a runtime or workflow hint.
- [ ] `CHANGELOG.md` has one `**BREAKING:**` bullet under `### Removed` in `## [Unreleased]`. The bullet names `agro-cron.service`, `cron-runtime.ts`, `crons/`, `cron.agentBin`, the `croner` dependency, the boot-time root `pnpm install`, and `build.skipPnpmInstall`. The bullet names native harness loops as the replacement.
- [ ] `pnpm test:scripts -- .agro/cli/src/__tests__/docs-reference.test.ts` exits 0.

### US-002: Remove cron guidance from skills and context files

**Description:** As an agent, I want skills and `AGENTS.md` files without cron runtime references so that agents do not look for a missing scheduler.

**Acceptance Criteria:**

- [ ] Root `AGENTS.md` states that systemd supervises only the bootstrap oneshot, and that named tmux sessions hold gateways and tunnels. The file does not name the cron runtime or detached cron fires.
- [ ] `.agro/tasks/AGENTS.md` does not name the `cleanup-tasks` cron. The file states that the operator or a harness loop archives completed tasks to `.agro/tasks/archive/`.
- [ ] `.agro/logs/AGENTS.md` does not give the `/tmp/cron-*.log` example.
- [ ] `.agro/skills/audit/` has no cron-staleness trigger, no "(C) Host/state drift" section, no `crons/.cron.log` inputs, and no cron health or cron reliability check. `drift.md` describes two drift classes.
- [ ] `.agro/skills/escalate/SKILL.md`, `herdr/SKILL.md`, `git/SKILL.md`, `worktrees/SKILL.md`, and `t3/references/sandbox-processes.md` do not name `agro-cron.service`, `cron-runtime.ts`, or agent-driven crons.
- [ ] `.agro/skills/prompt-miner/SKILL.md` does not name `crons/prompt-miner.md`. The `cron` session-type classifier in `mine-traces.mjs` stays unchanged.
- [ ] `.agro/skills/ste/references/rules.md` does not cite `crons/heartbeat.md`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-003: Delete the cron runtime and its sandbox wiring

**Description:** As a maintainer, I want the cron runtime, its systemd unit, and its dependency deleted so that the sandbox runs one less supervised process.

**Acceptance Criteria:**

- [ ] `.agro/scripts/cron-runtime.ts`, `.agro/scripts/__tests__/cron-runtime.test.ts`, and `.devcontainer/agro-cron.service` do not exist.
- [ ] `.devcontainer/Dockerfile` does not install the `cron` apt package, does not copy or enable `agro-cron.service`, and does not mask `cron.service`. The ssh masks stay.
- [ ] `.devcontainer/agro-bootstrap.service` has no `Before=agro-cron.service` line.
- [ ] `.devcontainer/entrypoint.sh` does not define `CRONS_PATH` and does not create `crons/`.
- [ ] `package.json` has no `croner` dependency, and `pnpm install --frozen-lockfile` exits 0 with the regenerated `pnpm-lock.yaml`.
- [ ] `.agro/scripts/agro-path` has no `crons)` case. `.agro/scripts/README.md` does not list `cron-runtime.ts`.
- [ ] `.agro/scripts/__tests__/entrypoint.test.ts` has no test that reads `agro-cron.service`. The bootstrap-oneshot test stays.
- [ ] `.claude/protected-paths.txt` does not list `.agro/scripts/cron-runtime.ts`.
- [ ] hadolint with `.hadolint.yaml` exits 0 on `.devcontainer/Dockerfile`.

### US-004: Remove cron checks from health, smoke, and matrix scripts

**Description:** As a maintainer, I want the healthcheck and smoke scripts to stop requiring `agro-cron.service` so that a healthy sandbox without cron passes every check.

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-healthcheck.sh` requires only `agro-bootstrap.service` among AGRO units.
- [ ] `.agro/scripts/sandbox-boot-smoke.sh` `verify_systemd_supervision()` keeps the PID 1 and bootstrap checks and has no cron unit, PID file, reload, or kill-recovery check.
- [ ] `.agro/scripts/sandbox-upgrade-smoke.sh` and `.agro/scripts/cli-first-install-smoke.sh` do not wait for or assert `agro-cron.service`.
- [ ] `.agro/install/banner.sh` recovery lines do not name `agro-cron.service`.
- [ ] `.agro/skills/remote-sandbox/checks/agro-rows.sh` R06 and R07, `scripts/restart-test.sh`, and the R06 and R07 rows in `references/rationale.md` use `agro-bootstrap` instead of `agro-cron`.
- [ ] The tests `sandbox-healthcheck.test.ts`, `sandbox-boot-smoke.test.ts`, `sandbox-upgrade-smoke.test.ts`, and `boot-banner.test.ts` have no cron fixture or cron assertion, and they pass.
- [ ] The CI shellcheck command exits 0.

### US-005: Remove the boot-time root pnpm install

**Description:** As an operator, I want the sandbox to boot without a root `pnpm install` so that a network or registry failure cannot stop the boot.

**Acceptance Criteria:**

- [ ] `.devcontainer/entrypoint.sh` has no `pnpm_manifest_fingerprint` function, no `PNPM_INSTALL_*` variables, and no `pnpm install` command.
- [ ] `.agro/scripts/__tests__/entrypoint-pnpm-install.test.ts` does not exist. `.agro/scripts/__tests__/entrypoint.test.ts` asserts that `entrypoint.sh` does not contain `pnpm install`.
- [ ] `.agro/cli/src/lib/agro-config.ts` has no `BuildSettings`, no `build` default, no `build` validation, and no `build.skipPnpmInstall` entry in `AGRO_CONFIG_FIELDS`. `agro.json` has no `build` key.
- [ ] An `agro.json` that still contains `build.skipPnpmInstall` loads without an error.
- [ ] `.agro/cli/src/lib/config-render.ts` keeps `SKIP_PNPM_INSTALL` in `RETIRED_KEYS`.
- [ ] `docs/configuration.md` has no `build.skipPnpmInstall` row.
- [ ] `.github/workflows/sandbox-boot-guard.yml` has no step that pre-seeds `node_modules`, no step that checks `node_modules/croner`, and no step that sets `build.skipPnpmInstall`.
- [ ] `.agro/scripts/sandbox-upgrade-smoke.sh` does not delete the `pnpm:devPreinstall` script and does not name `build.skipPnpmInstall` or `croner`.
- [ ] `pnpm run build:harness` exits 0 in a checkout without root `node_modules`.
- [ ] `pnpm test:scripts` exits 0.

### US-006: Remove cron configuration and the crons scaffold

**Description:** As an operator, I want the `cron` config key and the `crons/` folder removed so that `agro vendor` and `agro.json` carry no dead cron state.

**Acceptance Criteria:**

- [ ] The folder `crons/` does not exist in the repository.
- [ ] `.agro/manifest.json` has no `crons/**` entry in `rootInclude`.
- [ ] `.agro/cli/src/lib/agro-config.ts` has no `CronSettings`, no `cron` default, no `cron.agentBin` validation, and no `cron` entry in `AGRO_CONFIG_FIELDS`. `agro.json` has no `cron` key.
- [ ] An `agro.json` that still contains a `cron` key loads without an error.
- [ ] `.agro/cli/src/lib/config-render.ts` keeps `CRONS_DIR` and `CRON_AGENT_BIN` in `RETIRED_KEYS`.
- [ ] `.agro/scripts/migrate-harness-yaml.sh` maps `crons.agent_bin` and `crons.dir` as retired keys, not to `cron.agentBin`.
- [ ] `.agro/cli/src/cli.ts` help text and `.agro/cli/README.md` do not name cron or `crons/`.
- [ ] `.github/workflows/ci-harness.yml` has no `crons/**` path filter. `.claude/protected-paths.txt` has no Crons section. `.gitignore` has no `crons/` entries.
- [ ] `manifest.test.ts`, `vendor.test.ts`, and `docs-reference.test.ts` use neutral fixture paths instead of `crons/`. `agro-config.test.ts` has no `cron.agentBin` case.
- [ ] `pnpm run typecheck` exits 0.

### US-007: Record manual review evidence

**Description:** As the advisor, I want a command transcript that proves the cron removal so that the PR `## Manual review` section has evidence.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-agro-crons/evidence/manual-review.md` holds the output of each command in this list, with exit codes:
  - `git grep -n -i -E 'agro-cron|cron-runtime|croner|crons/|cron\.agentBin' -- ':!CHANGELOG.md' ':!.agro/tasks/**'`
  - `pnpm test:scripts`
  - `pnpm run typecheck`
  - the CI shellcheck command
  - `bash .agro/scripts/link-providers.sh --check`
  - `git grep -n -E 'skipPnpmInstall|PNPM_INSTALL' -- ':!CHANGELOG.md' ':!.agro/tasks/**'`
- [ ] Each `git grep` output holds no line outside the retired-key lists in `config-render.ts`, `config-render.test.ts`, and `docs/configuration.md`, and outside the negative assertions in tests.
- [ ] If the operator approves a sandbox rebuild, the transcript holds `agro ps <name>` and `bash .agro/scripts/sandbox-healthcheck.sh` from the rebuilt sandbox, and `systemctl list-units 'agro-*'` shows only `agro-bootstrap.service`. `journalctl -u agro-bootstrap.service` shows no `pnpm install` line.
- [ ] This story depends on US-001, US-002, US-003, US-004, US-005, and US-006.

## Summary

AGRO runs a Markdown cron scheduler. `.agro/scripts/cron-runtime.ts` reads `crons/*.md`, holds a lock at `crons/.pid`, and starts each fire in a detached tmux session. systemd starts the scheduler as `agro-cron.service`. The `croner` package serves only this script. No `agro cron` verb exists.

The operator retires this feature. Recurring agent work moves to the native loop of each coding harness, for example Claude Code `/loop`. Three explorers mapped the scope across runtime, control-plane primitives, docs, tests, and CI. No other code imports the cron runtime. The healthcheck and smoke scripts mix cron checks with PID 1 and bootstrap checks, so the change removes only the cron lines.

The `croner` package is the only entry in the root `dependencies`. The other root packages are test tooling, and `pnpm-workspace.yaml` lists no packages. The entrypoint runs a root `pnpm install` on each boot and stops the boot when the install fails. The CI boot guard pre-seeds `node_modules` and sets `build.skipPnpmInstall` to keep that install out of the healthcheck window. The comments in `sandbox-boot-guard.yml` and `sandbox-upgrade-smoke.sh` give `agro-cron.service` as the reason for this machinery. After `croner` goes, no boot step needs root `node_modules`, so US-005 deletes the boot-time install. `build:harness` and `typecheck` install `.agro/cli` dependencies with `npm` and do not use root `node_modules`.

The stories remove references first and delete files second. The test `docs-reference.test.ts` fails on each missing doc path. The docs story US-001 therefore lands before the deletion stories US-003 and US-005.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/cron-runtime.ts` | `loadCrons`, `scheduleAll`, `fire`, `acquireLock` | The scheduler. Delete. |
| `.devcontainer/agro-cron.service` | systemd unit | Supervises the scheduler. Delete. |
| `.devcontainer/Dockerfile` | lines 13, 145, 148, 149 | Installs `cron`, copies and enables the unit. Edit. |
| `.devcontainer/agro-bootstrap.service` | `Before=agro-cron.service` | Orders bootstrap before cron. Edit. |
| `.devcontainer/entrypoint.sh` | `CRONS_PATH` | Creates `crons/`. Edit. |
| `package.json`, `pnpm-lock.yaml` | `croner` | Scheduler dependency. Remove. |
| `.devcontainer/entrypoint.sh` | `pnpm_manifest_fingerprint`, `PNPM_INSTALL_MARKER` | Boot-time root install. Delete. |
| `.agro/cli/src/lib/agro-config.ts` | `BuildSettings`, `build.skipPnpmInstall` | Skips the boot-time install. Remove. |
| `.github/workflows/sandbox-boot-guard.yml` | pre-seed, visibility, and skip steps | CI workaround for the boot-time install. Delete. |
| `.agro/scripts/sandbox-healthcheck.sh` | `require_unit agro-cron.service` | Health gate. Edit. |
| `.agro/scripts/sandbox-boot-smoke.sh` | `verify_systemd_supervision` | Boot smoke in CI. Edit. |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | readiness wait, final assertion | Upgrade smoke in CI. Edit. |
| `.agro/scripts/cli-first-install-smoke.sh` | `verify_systemd` | First-install smoke. Edit. |
| `.agro/install/banner.sh` | recovery lines | Boot banner. Edit. |
| `.agro/cli/src/lib/agro-config.ts` | `CronSettings`, `AGRO_CONFIG_FIELDS` | Config schema. Edit. |
| `.agro/cli/src/lib/config-render.ts` | `RETIRED_KEYS` | Strips old env keys. Keep. |
| `.agro/manifest.json` | `rootInclude` | Vendors `crons/**`. Edit. |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | R06, R07 | VM matrix rows. Edit. |
| `.github/workflows/sandbox-boot-guard.yml` | pre-seeded `node_modules` step | Probes `croner`. Edit. |
| `crons/` | `heartbeat.md`, `cleanup-tasks.md`, `prompt-miner.md`, `AGENTS.md` | Cron definitions. Delete. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| systemd units in the sandbox | Removed | `agro-cron.service` no longer exists. |
| `agro.json` key `cron.agentBin` | Removed | The schema drops the key. A stale key loads without an error. |
| `agro vendor` output | Changed | The command copies `.agro/` only, not `crons/`. |
| `agro path crons` | Removed | `.agro/scripts/agro-path` drops the case. |
| `agro.json` key `build.skipPnpmInstall` | Removed | The schema drops the key. A stale key loads without an error. |
| Sandbox boot | Changed | The boot does not install root `node_modules`. An agent runs `pnpm install` before `pnpm test:scripts` in a fresh checkout. |
| Boot banner | Changed | Recovery lines drop `agro-cron.service`. |

## Storage

The runtime state files `crons/.pid` and `crons/.cron.log` disappear with the `crons/` folder. Git does not track either file. No migration runs. An existing sandbox keeps the untracked files until the operator deletes the folder.

## Architectural Decisions

- The native loop of the coding harness owns recurring agent work. AGRO adds no replacement scheduler.
- systemd supervises only `agro-bootstrap.service`. Named tmux holds gateways and tunnels.
- `RETIRED_KEYS` keeps `CRONS_DIR` and `CRON_AGENT_BIN`, so an old env file loses the keys on the next render.
- `AgroConfig` accepts unknown keys, so an old `agro.json` with a `cron` key still loads.
- The `rootInclude` mechanism in the manifest stays with an empty list. Open question 1 covers its deletion.
- Root `node_modules` holds test tooling only. The agent installs the tree on demand. The boot does not install the tree.
- `locked-append.sh` stays. The script is a general helper.
- The `cron` session-type classifier in `prompt-miner` stays, because historical transcripts carry that type.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/cron-runtime.test.ts` | all | Deleted with the runtime. |
| `.agro/scripts/__tests__/entrypoint.test.ts` | cron supervision describe block | Cron cases deleted. Bootstrap oneshot case kept. |
| `.agro/scripts/__tests__/sandbox-healthcheck.test.ts` | `ALL_UNITS`, cron-inactive case | Healthcheck passes with bootstrap only. |
| `.agro/scripts/__tests__/sandbox-boot-smoke.test.ts` | `cronUnitInactive` fixture, cron cases | Boot smoke passes with no cron unit. |
| `.agro/scripts/__tests__/sandbox-upgrade-smoke.test.ts` | `agro-cron.service` assertion | Upgrade smoke has no cron wait. |
| `.agro/scripts/__tests__/boot-banner.test.ts` | recovery line | Banner text matches `banner.sh`. |
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | `cron.agentBin` and `build.skipPnpmInstall` cases; stale `cron` and `build` keys load | Schema removal and tolerance of stale keys. |
| `.agro/scripts/__tests__/entrypoint-pnpm-install.test.ts` | all | Deleted with the boot-time install. |
| `.agro/scripts/__tests__/entrypoint.test.ts` | no `pnpm install` in `entrypoint.sh` | The boot does not install root dependencies. |
| `.agro/cli/src/__tests__/manifest.test.ts`, `vendor.test.ts` | `rootInclude` fixtures | Fixtures use neutral paths. |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | `REPO_PATH` regex, doc links | Docs name no deleted path or key. |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` | provider links | Skill edits keep links valid. |

Run `pnpm test:scripts` and `pnpm run typecheck` on the host checkout or in the sandbox. CI also runs the shellcheck command in the `boot-lint` job and hadolint on `.devcontainer/Dockerfile`.

## Design Principles

- Delete obsolete paths. Do not leave a dormant scheduler.
- Change the canonical `.agro/` source. Do not patch a provider mirror.
- Remove only cron lines from mixed scripts. Keep each PID 1 and bootstrap check.
- Add no explanatory comments to tracked code.
- Keep history. Do not rewrite cron entries in `CHANGELOG.md` or in `.agro/tasks/**` evidence.

## Out of Scope

- A replacement scheduler or a loop wrapper in AGRO.
- Re-creation of the `heartbeat`, `cleanup-tasks`, and `prompt-miner` crons as harness loops. The operator starts a loop in Herdr when the operator wants that work.
- Deletion of the generic `rootInclude` mechanism in `agro vendor`.
- Edits to historical task evidence under `.agro/tasks/**` and to past `CHANGELOG.md` entries.
- Gateway heartbeat files for the Slack gateway. That heartbeat is not cron.
- Replacement of systemd as PID 1. After this task, systemd supervises only `agro-bootstrap.service`, but the `docker-engine` and `desktop` tools in `.agro/cli/src/lib/tools/catalog.ts` use systemd. A separate `/architect` decision owns this question.

## Open Questions

1. The manifest `rootInclude` list becomes empty. Keep the `rootInclude` mechanism (default), or delete the mechanism and its tests in this PR?
2. `cleanup-tasks` archived completed tasks automatically. Accept manual or loop-driven archiving (default), or add a documented `/loop` recipe to `.agro/tasks/AGENTS.md`?
3. A fresh checkout has no root `node_modules` after boot. Accept that the agent runs `pnpm install` before tests (default), or install root dependencies in the image?

## Acceptance Criteria
- [ ] `pnpm test:scripts` exits 0.
- [ ] `.devcontainer/entrypoint.sh` contains no `pnpm install` command.
- [ ] `pnpm run typecheck` exits 0.
- [ ] The CI shellcheck command and hadolint exit 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `git grep -n -i -E 'agro-cron|cron-runtime|croner|crons/|cron\.agentBin' -- ':!CHANGELOG.md' ':!.agro/tasks/**'` prints only retired-key lines.
- [ ] CI on the draft PR is green, including `sandbox-boot-guard.yml`.

## Lessons

Filled by the advisor before undraft.
