# PRD: Sandbox Install Mount Semantics

Tracks GitHub issue #1042. The rename follow-up is #1043 and is out of scope.

## Knowledge Context

- **Base commit**: `f94c1ad5`
- **Knowledge used**: `compose-env-boundary`, `oh-cli-portable-lifecycle`,
  `fresh-machine-setup`
- **Grounded against**:
  - `.agro/cli/src/commands/sandbox.ts`
  - `.agro/cli/src/commands/config.ts`
  - `.agro/cli/src/cli.ts`
  - `.agro/cli/src/lib/registry.ts`
  - `.agro/cli/src/lib/config-render.ts`
  - `.agro/cli/src/lib/oh-config.ts`
  - `.agro/cli/src/__tests__/sandbox.test.ts`
  - `.agro/cli/src/lib/__tests__/registry.test.ts`
  - `docs/installation.md`, `docs/quickstart.md`, `docs/configuration.md`

The advisor re-read every path above at the base commit. Each file and line
reference in this PRD resolves as written.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- `compose-env-boundary` — declares `.agro/cli/src/lib/config-render.ts` and
  `.agro/cli/src/lib/registry.ts` as sources. The env keys keep their spelling,
  so the expected state is REVERIFIED.
- `oh-cli-portable-lifecycle` — declares `.agro/cli/src/cli.ts`,
  `.agro/cli/src/commands/sandbox.ts`, and `.agro/cli/src/lib/registry.ts` as
  sources. The install flag set changes, so the expected state is UPDATED.
- `fresh-machine-setup` — declares `docs/installation.md` and
  `docs/quickstart.md` as sources. US-007 rewrites both, so the expected state
  is UPDATED.

The actual impact is derived from the real diff at execute step 6.

## Plan Reconciliation

- **Intent preserved**: YES

The operator approved this PRD. The advisor closed both open questions as D-1
and D-2 under `## Decisions`; neither decision changes the operator's intent.
Planning and execution share the base commit `f94c1ad5`, so no source moved
between the two. The advisor added this section, `## Knowledge Context`, and
`## Expected Knowledge Impact` to complete the three-file contract. No goal,
functional requirement, non-goal, or acceptance criterion changed.

## Introduction

`agro sandbox install docker` exposes two bind-capable mounts through one flag.
The flag drives the wrong one, and the other has no install-time door at all.

The compose files define both mounts:

| Mount | Compose | Env key | Config field | Purpose |
|---|---|---|---|---|
| `/home/sandbox` | `.devcontainer/docker-compose.yml:12`, `.devcontainer/docker-compose.image-only.yml:9` | `AGRO_HOME_MOUNT` | `storage.homePath` | Where the sandbox persists |
| `/home/sandbox/harness` | `.devcontainer/docker-compose.yml:13` | `AGRO_REPO_DIR` | `repo` | Binds an existing checkout |

`--repo` is the only install flag that reaches either mount. It drives the
second. An operator who wants the first has no flag, and `--repo` accepts their
path without complaint, then fails inside `docker buildx`.

## Goals

- Make `--repo` select build mode from the directory's contents, not from the
  flag's presence.
- Fail before the wizard, with a message that names the flag, when build mode is
  impossible.
- Add `--home-mount <dir>` so an operator can choose host-path persistence at
  create time.
- Guard the late `config set storage.homePath` path that silently orphans
  sandbox state.
- Leave no registry entry behind when install fails preflight.

## User Stories

### US-001: Select build mode from directory contents

**Description:** As an operator, I want `--repo <dir>` to work with any existing
directory, so that binding a path does not silently require a harness checkout.

**Acceptance Criteria:**

- [ ] `seedConfig()` (`.agro/cli/src/commands/sandbox.ts:118-121`) sets
      `image.mode` to `build` only when `<repo>/.devcontainer/Dockerfile` exists
- [ ] A `--repo` path without `.devcontainer/Dockerfile` resolves to
      `image.mode: "image"` and still renders `AGRO_REPO_DIR`
- [ ] An explicit `image.mode` in an `agro.json` seed still wins over the inference
- [ ] `--print-argv` for a non-checkout `--repo` shows no `--build`
- [ ] Existing build-mode coverage (`.agro/cli/src/__tests__/sandbox.test.ts:148`)
      stays green
- [ ] Typecheck and lint pass

### US-002: Fail early when build mode is impossible

**Description:** As an operator, I want a clear `agro` error instead of a buildx
`lstat` line, so that I can tell which flag caused the failure.

**Acceptance Criteria:**

- [ ] When `image.mode` is `build` and `<repo>/.devcontainer/Dockerfile` is
      absent, `runSandboxInstall` exits non-zero **before** the wizard runs
- [ ] The message names the flag, the resolved path, and the missing file
- [ ] The message does not originate from Docker
- [ ] Typecheck and lint pass

### US-003: Leave no registry entry on preflight failure

**Description:** As an operator, I want a failed install to leave no trace, so
that a retry starts clean.

**Acceptance Criteria:**

- [ ] No directory is created under the registry root when install fails preflight
- [ ] `agro sandbox list` shows no entry after a failed install
- [ ] An install that fails *after* the entry is written is unchanged by this story
- [ ] Typecheck and lint pass

### US-004: Add the `--home-mount` install flag

**Description:** As an operator, I want to bind `/home/sandbox` to a host path at
create time, so that host tools can read the sandbox's files.

**Acceptance Criteria:**

- [ ] `agro sandbox install docker --home-mount <dir>` sets `storage.homePath`
- [ ] The rendered compose env contains `AGRO_HOME_MOUNT=<dir>`
      (`.agro/cli/src/lib/config-render.ts:40`)
- [ ] `--home-mount` alone keeps `image.mode: "image"` and selects the image-only
      compose base (`.agro/cli/src/lib/registry.ts:95`)
- [ ] `--home-mount` combined with a checkout `--repo` renders both keys and
      selects the build base
- [ ] The path is resolved to an absolute path, and a relative path is accepted
- [ ] `agro sandbox install --help` documents the flag
      (`.agro/cli/src/cli.ts:255-271`)
- [ ] Typecheck and lint pass

### US-005: Prompt for the home mount in the wizard

**Description:** As an operator running the wizard, I want to be offered the
host-path choice, so that I do not have to know the config key exists.

**Acceptance Criteria:**

- [ ] `runWizard` asks for the home mount path
- [ ] The default is unset, which means the Docker-managed named volume
- [ ] Pressing Enter accepts the default and writes no `storage.homePath`
- [ ] An explicit `--home-mount` value is shown as the default
- [ ] `--yes` skips the prompt
- [ ] Typecheck and lint pass

### US-006: Guard late `storage.homePath` changes

**Description:** As an operator, I want `config set storage.homePath` to refuse
when it would orphan existing state, so that I do not lose a sandbox's data
silently.

**Acceptance Criteria:**

- [ ] `agro config set storage.homePath <dir>` exits non-zero when the sandbox's
      named volume already exists
- [ ] The message states that existing state in the volume would be orphaned, and
      names the volume
- [ ] An explicit `--force` flag proceeds with the change
- [ ] The guard does not fire when no named volume exists
- [ ] The guard respects `--sandbox <name>` (`.agro/cli/src/cli.ts:455-461`)
- [ ] Typecheck and lint pass

### US-007: Update the documentation

**Description:** As an operator reading the docs, I want the two mounts described
separately, so that I pick the right flag the first time.

**Acceptance Criteria:**

- [ ] `docs/installation.md:97-114` states that `--repo` is a host path, and that
      build mode applies only when that path is itself a harness checkout
- [ ] `docs/quickstart.md:88-111` matches
- [ ] `docs/configuration.md:88` documents `--home-mount` as the create-time door
      to `storage.homePath`, and the orphaned-volume hazard of setting it later
- [ ] `docs/configuration.md:86` no longer implies `repo` selects build mode
      unconditionally
- [ ] Prose passes the `/ste` checker
- [ ] A CHANGELOG entry exists per `.agro/skills/git/SKILL.md`

## Functional Requirements

- FR-1: `seedConfig()` must derive `image.mode` from
  `existsSync(<repo>/.devcontainer/Dockerfile)`, not from `config.repo !== undefined`.
- FR-2: An explicit `image.mode` from an `agro.json` seed or a CLI flag must
  outrank FR-1.
- FR-3: `runSandboxInstall` must validate build feasibility before the wizard and
  exit non-zero with a message naming the flag, the resolved path, and the
  missing `.devcontainer/Dockerfile`.
- FR-4: A preflight failure must create no registry entry.
- FR-5: `agro sandbox install <runtime>` must accept `--home-mount <dir>` and
  write it to `storage.homePath`.
- FR-6: `--home-mount` must resolve its argument to an absolute path.
- FR-7: `--home-mount` alone must not select the build-capable compose base.
- FR-8: The install wizard must prompt for the home mount, defaulting to unset.
- FR-9: `agro config set storage.homePath` must refuse when the target sandbox's
  named volume exists, unless the operator passes `--force`.
- FR-10: The compose files, `AGRO_HOME_MOUNT`, and `AGRO_REPO_DIR` must keep
  their current spelling.

## Non-Goals

- Renaming `--repo` to `--checkout`. Tracked in #1043.
- Renaming the `repo` config field or the `AGRO_REPO_DIR` env key.
- Editing `.devcontainer/docker-compose.yml` or
  `.devcontainer/docker-compose.image-only.yml`.
- Fixing UID and GID reconciliation on the empty-bind path
  (`.devcontainer/entrypoint.sh:167-191`). Track separately.
- Seeding a harness skeleton into an empty `--repo` directory.
- Migrating an existing named volume to a host path.
- Any change to `.devcontainer/entrypoint.sh`.

## Technical Considerations

- The runtime already supports the target behavior. `.devcontainer/entrypoint.sh:159-166`
  branches on whether `/home/sandbox/harness` is a mountpoint **holding a control
  directory**, not on whether it is a bind. An empty bind falls through to
  `.devcontainer/entrypoint.sh:193-196`, which seeds the control plane into the
  bound host directory. Only the CLI's `mode` inference blocks the operator's
  command. No entrypoint change is required.
- `materialize()` selects the compose base from `repo`
  (`.agro/cli/src/lib/registry.ts:95`). The image-only base already carries the
  home-mount line (`.devcontainer/docker-compose.image-only.yml:9`), so
  `--home-mount` needs no new base.
- `repo` carries a third meaning that this work must preserve: `entryRepo()`
  resolves which sandbox a lifecycle verb addresses when the operator runs it
  from inside that directory (`.agro/cli/src/lib/registry.ts:56,136-137`).
- The existing compose-string probes must stay green **and unedited**:
  `.agro/evals/probes/oh-devcontainer-restructure.sh:46`,
  `.agro/evals/probes/oh-home-mount.sh:48`,
  `.agro/evals/probes/oh-image-only-deploy.sh:147`,
  `.agro/cli/src/lib/__tests__/registry.test.ts:192`.

## Success Metrics

- `agro sandbox install docker --home-mount <empty dir> --name <name>` succeeds
  on a cold host and persists `/home/sandbox` at that path.
- `agro sandbox install docker --repo <empty dir>` succeeds using the published
  image, instead of failing in buildx.
- No operator-facing error for this command originates from Docker.
- `/eval` reports no regression.

## Decisions

The advisor closed both open questions before implementation. This PRD is the
durable record.

### D-1: The FR-9 override flag is `--force`

`agro update --force` already overrides a safety gate (`.agro/cli/src/cli.ts:240`,
parsed at `.agro/cli/src/cli.ts:699`). The CLI keeps one term for one concept. A
new spelling adds a second word for "override a gate" and adds no clarity.
`ConfigArgs` (`.agro/cli/src/cli.ts:478`) gains a `force` field. The parser reads
`--force` beside the existing `--sandbox` extraction.

### D-2: `--home-mount` accepts a non-empty directory

The flag does not refuse a directory that holds files. Three reasons apply.

1. Issue #1042 does not require the refusal.
2. Re-installing an entry against an already-seeded home path is the expected
   recovery path. A refusal breaks the case the flag exists to serve.
3. Emptiness is not the hazard. Ownership is the hazard. The documentation
   warning in US-007 states it. The UID and GID gap at
   `.devcontainer/entrypoint.sh:167-191` is tracked separately.

The flag resolves its argument to an absolute path. It creates the directory when
the directory is absent. It fails only when the path exists and is not a
directory. `.agro/cli/src/lib/oh-config.ts:194-203` validates absoluteness
downstream.
