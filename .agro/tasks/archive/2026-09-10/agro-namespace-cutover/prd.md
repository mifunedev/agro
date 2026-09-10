# PRD: AGRO namespace and persisted state become canonical (Phase 2, #942)

## Introduction

Phase 2 of epic #939 (RFC `docs/rfcs/rfc-agro-migration.md`). Fresh installations and
fresh workspaces use native AGRO state — `.agro/`, `agro.json`, `AGRO_*`, `~/.agro/sandboxes`,
`/opt/agro-seed`, `.agro/.image-seeded` — while every existing OpenHarness installation
keeps working unchanged and gains a supported, idempotent, fail-closed `agro migrate`. The
control-plane source tree of this repository is renamed `.oh/` → `.agro/` and `oh.json` →
`agro.json`, because a seeded `.agro/` whose skills, scripts, and docs still name `.oh/…`
would be a broken control plane. Compose project, volume, and network identities of
existing sandboxes stay mapped; only the fallback used when no name is configured changes.
Onboarding becomes sandbox-first with a GitHub-login prerequisite before two optional
agent prompts (Q4). `init` stays retired; no `agro project update` (Q1/Q3).

## Goals

- `agro sandbox install docker` on a fresh host writes `~/.agro/sandboxes/<name>/agro.json`
  and `.agro/scripts/*`; a legacy registry keeps resolving to `~/.oh` until migrated.
- A fresh image-only boot seeds `.agro/` exactly once from `/opt/agro-seed`; a legacy
  workspace on the new image is recognised, never re-seeded, never given a second control
  plane; divergent `.oh/` + `.agro/` refuses.
- `agro migrate [--check] [--home]` exposes the Phase 0 engine: plan without mutation,
  apply with lock and revalidation, retire byte-identical legacy copies to `<name>.migrated`,
  regenerate provider links, report explicit results; idempotent; no force; conflicts fail.
- `AGRO_*` is canonical for compose interpolation and examples; `OH_*` keeps working through
  the SLA via Phase 0 precedence; existing compose identities are preserved.
- Real Docker evidence: legacy volume + auth state survives a new-image boot and a migration.
- Docs, `AGENTS.md`, examples, inventory, and knowledge describe AGRO-native fresh state;
  history (changelog, RFCs, dated docs) is not rewritten.

## User Stories

### US-001: Control-plane tree rename in this repository

**Description:** As the canonical source, the repository's control plane lives at `.agro/`
so the image seed, vendored payloads, and skills are self-consistent.

**Acceptance Criteria:**

- [ ] `git mv .oh .agro` and `git mv oh.json agro.json`; every tracked reference to `.oh/…`, `oh.json`, `/opt/oh-seed`, `/opt/oh-assets`, `~/.local/share/oh/`, `.oh/.image-seeded` in code, scripts, workflows, compose files, systemd units, provider link map, manifest, `.gitignore`, `.dockerignore`, probes, tests, skills, hooks, crons, `AGENTS.md`, and current docs is updated to the AGRO name, except: compat fallbacks (`compat.ts`, `compat.sh`, `migrate.ts` sources, `compat-inventory.json` legacy keys), legacy test fixtures, `oh-my-zsh`, historical CHANGELOG/RFC/dated entries, and prose that deliberately documents the legacy name.
- [ ] `.gitignore` carries the `.agro/` analogues of every `.oh/` rule plus `.agro-migrate.lock` and `*.migrated`; `.oh/…` rules stay for migrated checkouts.
- [ ] Provider links `.claude/skills`, `.claude/hooks`, `.codex/skills`, `.agents/skills`, `.pi/skills` target `../.agro/…`; `link-providers.sh --check` passes; `CLAUDE.md` symlink unchanged.
- [ ] CI path filters in the three workflows include `agro.json` and `.agro/**` (and keep `oh.json`/`.oh/**` for the SLA); shellcheck globs cover `.agro/scripts/*.sh`.
- [ ] `pnpm test`, both typechecks, `link-providers.sh --check`, `/eval` runner, and `git diff --check` pass from the renamed tree; `compat-inventory.test.ts` and `agro-compat-inventory.sh` stay green (Phase 2 entries' notes updated; nothing reclassified without reason).

### US-002: Fresh-state resolution defaults and compose interpolation

**Description:** As a new operator, fresh state is AGRO without any migration step.

**Acceptance Criteria:**

- [ ] `compat.ts`/`compat.sh`: an absent pair resolves to the AGRO generation (`generation: "agro"`, AGRO path) for control dir, config file, user-state home (`~/.agro`), and seed source (`/opt/agro-seed`); legacy-only, agro-only, equivalent, divergent cases are unchanged; shared vectors extended and both implementations agree.
- [ ] `ohConfigPath` writes `agro.json` when no config exists; `registry.ts` default name prefix `agro-sbx-`, `materialize()` writes `.agro/scripts/{docker-compose.sh,compat.sh,check-host-port.sh}`; `runner.ts`, `harness.ts`, `update.ts`, `cli.ts` payload-version path resolve the control dir through compat instead of literals.
- [ ] `config-render.ts` emits `AGRO_HOME_MOUNT`, `AGRO_REPO_DIR`, `AGRO_SANDBOX_IMAGE`, `AGRO_PULL_POLICY`; the compose files interpolate `${AGRO_X:-${OH_X:-<default>}}` so a legacy registry entry rendered by an older CLI still works; `OH_PROJECT_ROOT`/`AGRO_PROJECT_ROOT` both in `RETIRED_KEYS`.
- [ ] Compose fallback identity `${SANDBOX_NAME:-agro}` and image tag `sandbox-${SANDBOX_NAME:-agro}`; the tracked `agro.json` keeps `"name": "openharness"` so this repository's own sandbox identity and volumes are unchanged; registry entries always set the name.
- [ ] Help/error copy names AGRO state (`~/.agro/sandboxes`, `agro.json`) while `oh` invocations keep byte-identical legacy text apart from state names that follow the resolved generation. Tests: compat vectors, `oh-config`, `registry`, `sandbox`, `config-render`, `compose-args`, `lifecycle` updated with explicit fresh-vs-legacy cases.

### US-003: `agro migrate`

**Description:** As an existing operator, I want one command that moves my project or registry to AGRO names safely.

**Acceptance Criteria:**

- [ ] `agro migrate [--check] [--home] [--json]` in `.agro/cli/src/commands/migrate.ts` over `planMigration`/`applyMigration`: project mode uses `projectMigrationSpec(cwd root)` plus a relink step (`link-providers.sh --init` equivalent for the five provider links, only when they point at `../.oh/…`); `--home` uses `userStateMigrationSpec(home)`; `--check` prints the plan and mutates nothing; exit 0 applied/noop, 2 conflict, 1 failure.
- [ ] Summary lists each step (rename/retire/rewrite/relink/noop) with paths, conflicts with reasons and differences, and after apply the per-step outcome; `--json` emits the plan/result objects.
- [ ] Preserves unknown files, modes, symlinks; refuses divergent `.oh`/`.agro` and `oh.json`/`agro.json`; repeated run is a noop; lock refusal message names `.agro-migrate.lock`; never touches `~/.openharness`, `.env`, git history, or unrelated config.
- [ ] `oh migrate` (legacy product) is dispatched to the same command (there is no legacy migrate to preserve). Tests: `migrate-command.test.ts` covering check/apply/idempotent/conflict/lock/relink/`--home`/unknown-file preservation/mode preservation with byte manifests before and after.

### US-004: Image seed, boot, and legacy-workspace recognition

**Acceptance Criteria:**

- [ ] Dockerfile seeds `/opt/agro-seed` (and no `/opt/oh-seed`), stages assets at `/opt/agro-assets`, keeps `/opt/oh` and `/usr/local/bin/{oh,agro}`; `entrypoint.sh` sources the adapter from `/opt/agro-assets`, uses `compat_control_dir`/`compat_seed_src` for flavor detection, link init, python provisioning, banner, gateway, and healthcheck paths; the compose healthcheck resolves the control dir at run time; the cron systemd unit path follows the resolved control dir.
- [ ] `seed_workspace_volume`: fresh → `.agro/` + `.agro/.image-seeded` once; legacy workspace (`.oh/` present, with or without marker) → nothing copied, marker classified, no `.agro/` created; divergent → refuse; `entrypoint-seed.test.ts` and `oh-image-only-deploy.sh` updated; `verify-sandbox-image.sh` uses `/opt/agro-seed`.
- [ ] `OH_BIN`/`AGRO_BIN` resolved through `compat_env` with default `agro`.

### US-005: Real Docker upgrade and migration evidence

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-upgrade-smoke.sh`: creates a named volume by booting the last legacy image (`ghcr.io/mifunedev/openharness:0.9.0`), writes recognisable auth/state files (`~/.config/gh/hosts.yml` synthetic, a workspace file), stops without `-v`, boots the freshly built image against the same volume and compose identity, asserts the files are byte-identical, `.oh/` still owns the workspace, no `.agro/` was seeded, both systemd services active, then tears down. Runs in `sandbox-boot-guard.yml` and locally; its log is cited in evidence.
- [ ] A migration rehearsal (test or script) on a checkout-backed fixture: `agro migrate --check`, `agro migrate`, provider links resolve, `agro ps` and `oh ps` succeed against the migrated checkout, second run noop.

### US-006: Docs, onboarding, inventory, changelog

**Acceptance Criteria:**

- [ ] README, `docs/quickstart.md`, `docs/installation.md`: sandbox-first onboarding; the remote-configuration, fork, clone-and-own, and `~/.openharness` clone recipes are replaced by the GitHub-login prerequisite (`gh auth login`, `gh auth setup-git`, `gh auth status` inside a Herdr pane; provider auth does not count) followed by the two optional agent prompts from the plan (private versioning; upstream contribution with merge-base verification); `agro config repo` documented as an SLA compatibility helper, not canonical onboarding; command-level recovery detail moved to `docs/integrations/github.md` and `docs/contributing.md`.
- [ ] `AGENTS.md` lifecycle list and control-plane paths use `agro`/`.agro/`; `docs/configuration.md`, `docs/oh-directory-layout.md`, `docs/deployment-prebuilt-image.md`, `docs/lifecycle-commands.md` (add `agro migrate`), `docs/agro-compatibility.md` (Phase 2 section; `oh config repo` classification; trimmed later-phase list) describe fresh AGRO state and the legacy fallback.
- [ ] `.agro/compat-inventory.json`: Phase 2 entries' notes record delivery; new AGRO paths documented; `CHANGELOG.md` Unreleased entry ≤250 chars linking #942; `.example.env` prose updated. No doc renames the GitHub repo, domain, or image name (Phase 3).

### US-007: Knowledge impact and evidence

**Acceptance Criteria:**

- [ ] `knowledge-impact.sh` on the final diff; affected pages updated or reverified; index regenerated; `wiki-readme-index.sh` PASS; `evidence.md` with commands, exit codes, Docker rehearsal logs, and unverified items.

## Functional Requirements

- FR-1: Every default flip is expressed in `compat.ts`/`compat.sh` and consumed by callers; no caller hard-codes a generation name except the compat tables and migration sources.
- FR-2: Existing compose project, container, volume, and network names never change for a sandbox that has a configured name; only the unnamed fallback changes.
- FR-3: `agro migrate` never merges, never deletes user content, never runs without a plan, and never touches `~/.openharness`.
- FR-4: The image seeds one control plane per workspace; a legacy marker or a legacy control dir blocks AGRO seeding.
- FR-5: History is not rewritten: CHANGELOG sections, RFCs, dated retro/evidence records, and knowledge `raw/` keep their legacy names.

## Non-Goals

- Repository, docs-site, domain, default image-name, or release-infrastructure renames (Phase 3); Cloud (Phase 4); retiring `oh`, `oh.json` reading, `OH_*`, `~/.oh`, legacy images (Phase 5).
- Config schema version bump. `init`. `agro project update`. Renaming `/home/sandbox/harness` or the systemd unit names.

## Technical Considerations

- The rename touches roughly 380 tracked files; it lands first, alone, as one commit so later stories diff cleanly. It conflicts with every in-flight branch; the operator coordinates quiescing (see Plan Reconciliation).
- The running sandbox that hosts this session binds the root checkout; after merge, the operator runs `agro migrate` there (or re-creates the sandbox) — not part of this PR.
- Inventory rules: deleting an `OH_*` token from the tree fails the stale-entry test unless reclassified; new `AGRO_*` tokens need no inventory entry.

## Success Metrics

- Full suite, typecheck, shellcheck, `/eval`, CI (harness, boot guard including the new upgrade smoke, compatibility) green from the clean worktree; classifier promotable.

## Open Questions

None on intent. One coordination prerequisite (below).

## Knowledge Context

- **Base commit**: `9d2fb00957fdfb9bd918660a6c01474504ad6c7d`
- **Queries**: `sandbox registry seed compose migration onboarding docs` (entity), same `--patterns`
- **Knowledge used**: `[[compose-env-boundary]]`, `[[fresh-machine-setup]]`, `[[oh-cli-portable-lifecycle]]`, `[[sandbox-dependency-installs]]`, `[[pattern-evals-product-name-literal-pinning]]`, `[[pattern-scripts-sibling-dependency-standalone-copies]]`, `[[pattern-cli-bundled-asset-relative-import]]`
- **Grounded against**: `.oh/compat-inventory.json`, `.oh/cli/src/lib/{compat,migrate,registry,oh-config,config-render,project,env}.ts`, `.oh/cli/src/lib/execution/runner.ts`, `.oh/cli/src/commands/{sandbox,update,config,harness}.ts`, `.oh/scripts/{docker-compose,compat,link-providers,sandbox-boot-smoke,verify-sandbox-image}.sh`, `.devcontainer/{Dockerfile,entrypoint.sh,docker-compose.yml,docker-compose.image-only.yml,openharness-cron.service}`, `.dockerignore`, `.gitignore`, `oh.json`, `.example.env`, `.oh/manifest.json`, `.github/workflows/{sandbox-boot-guard,sandbox-compatibility,ci-harness}.yml`, `.oh/scripts/__tests__/{entrypoint-seed,entrypoint,compat-shell}.test.ts`, `.oh/cli/src/lib/__tests__/{migrate,compat,compat-inventory}.test.ts`, `.oh/evals/probes/{oh-image-only-deploy,sandbox-registry,oh-compose-env-wiring,oh-lifecycle-surface,agro-compat-inventory}.sh`, `README.md`, `docs/{quickstart,installation,configuration,contributing,lifecycle-commands,agro-compatibility,oh-directory-layout,deployment-prebuilt-image}.md`, `docs/integrations/github.md`, `AGENTS.md`
- **Conflicts discovered**: `oh-cli-portable-lifecycle` says `materialize()` writes seven files; source writes six (`compat.sh` counted twice in prose) — repair in US-007. `docs/installation.md:57` states no `.agro` is created; true for Phase 1, flips here.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `compose-env-boundary`, `fresh-machine-setup`, `oh-cli-portable-lifecycle`, `sandbox-dependency-installs`, `release-versioning` (path filters), plus every page whose `sources:` name `.oh/…` paths (the rename invalidates their source lists)
- **Affected source paths**: the whole `.oh/` → `.agro/` tree, `.devcontainer/*`, `docs/*`, `README.md`, `AGENTS.md`
- **Reason**: the namespace cutover changes the paths every repo page cites and the fresh-state mechanism they describe.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.oh/plans/agro-compatibility-migration/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**:
  - The physical rename of this repository's `.oh/` tree is required for fresh `.agro/` workspaces to be self-consistent; the plan anticipates it ("quiesce state writers before physical namespace changes"; S3 depends on "the operator coordinates active work"). Twelve worktrees and one stash are live (`bug/967`, `feat/952`, `feat/988-*` ×4, `task/956`, `task/972`, plus the merged 940/941/994); each will conflict with the rename on rebase. **Operator coordination is the gate to start US-001.**
  - No existing test boots an old volume against a new image; `sandbox-boot-smoke.sh` tears down with `down -v`. US-005 adds that machinery.
  - `projectMigrationSpec` has no relink step; the five provider symlinks would dangle after a bare rename, so `agro migrate` gains a relink step.
  - The root checkout of this repository (`/home/sandbox/harness`) has unrelated dirty and untracked state and is the bind mount of the sandbox running this session; it is migrated by the operator after merge, not by this PR.
