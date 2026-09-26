# PRD: Separate the repo bind from the home mount in sandbox install

Status: DRAFT

## User Stories

### US-001: Infer build mode from the checkout contents

**Description:** As an operator, I want `--repo` to build only from a checkout so that an empty directory works.

**Acceptance Criteria:**

- [ ] With `--repo <empty dir>`, `seedConfig` sets `image.mode` to `image`, and the rendered env holds `AGRO_REPO_DIR`.
- [ ] With `--repo <empty dir> --print-argv`, the printed argv holds no `--build`.
- [ ] With `--repo <dir>` and a file at `<dir>/.devcontainer/Dockerfile`, `seedConfig` sets `image.mode` to `build`.
- [ ] If `image.mode` is `build` and `<repo>/.devcontainer/Dockerfile` does not exist, install exits 1 before the wizard runs.
- [ ] That error message names `--repo`, the resolved path, and `.devcontainer/Dockerfile`.
- [ ] After that preflight failure, no directory exists at the entry root for the sandbox name.
- [ ] The existing test at `.agro/cli/src/__tests__/sandbox.test.ts:148` passes.
- [ ] Each new case fails before the change and passes after the change.

### US-002: Add the home-mount install flag

**Description:** As an operator, I want `--home-mount <dir>` on install so that the sandbox persists at a host path.

**Acceptance Criteria:**

- [ ] `agro sandbox install docker --home-mount <dir>` writes `storage.homePath` as the resolved `<dir>`.
- [ ] With `--home-mount <dir>` alone, the rendered env holds `AGRO_HOME_MOUNT=<dir>`, and `image.mode` stays `image`.
- [ ] With `--home-mount <dir>` alone, `materialize` writes the image-only compose base.
- [ ] With `--home-mount <dir>` and `--repo <checkout>`, the rendered env holds both keys, and `materialize` writes the build base.
- [ ] The wizard asks for the home mount, and a blank answer leaves `storage.homePath` unset.
- [ ] `printSandboxHelp` lists `--home-mount <dir>` and states that build mode needs a harness checkout.

### US-003: Guard a late change to the home path

**Description:** As an operator, I want `config set storage.homePath` to refuse after first boot so that I keep volume state.

**Acceptance Criteria:**

- [ ] If the volume `<name>_workspace` exists, `runConfigSet` for `storage.homePath` exits 1 and changes no config file.
- [ ] The refusal message states that the volume state becomes orphaned and names the override flag.
- [ ] With the override flag, `runConfigSet` writes `storage.homePath` and exits 0.
- [ ] If the volume does not exist, `runConfigSet` writes `storage.homePath` without the override flag.
- [ ] The tests inject the volume check through a runner stub and start no Docker process.

## Summary

`seedConfig` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` whenever `--repo` is present. The only preflight checks that the directory exists. An empty directory therefore passes the wizard and fails later inside `docker buildx`. The entrypoint already seeds an empty bind at the container path /home/sandbox/harness, so only the mode inference blocks the operator.

`storage.homePath` binds the container path /home/sandbox to a host path. No install flag reaches `storage.homePath`. The only door is `agro config set`, and a change after first boot orphans the named volume.

The selected approach has three parts. First, key build mode on the Dockerfile in the checkout. Second, add `--home-mount` to install and to the wizard. Third, guard `config set storage.homePath` against an existing volume.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Mode inference, preflight, new flag, wizard prompt |
| `.agro/cli/src/cli.ts` | flag map near line 737, `printSandboxHelp` | Parse `--home-mount`, update help text |
| `.agro/cli/src/commands/config.ts` | `runConfigSet` | Volume guard for `storage.homePath` |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection from `repo`; no change expected |
| `.agro/cli/src/lib/config-render.ts` | `storage.homePath` render at line 40 | Emits `AGRO_HOME_MOUNT`; no change expected |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | New flag | `--home-mount <dir>` sets `storage.homePath` |
| `agro sandbox install` | Behavior change | `--repo` selects build mode only for a harness checkout |
| `agro sandbox install` | New error | Exit 1 before the wizard when build mode has no Dockerfile |
| `agro config set storage.homePath` | New guard | Refuse when the named volume exists, unless the override flag is present |
| Install wizard | New prompt | Home mount path, blank by default |

## Storage

The change writes one existing field, `storage.homePath`, in the sandbox entry config. The change adds no schema field. The guard reads the Docker volume `<name>_workspace` and does not change the volume.

## Architectural Decisions

- The presence of `<repo>/.devcontainer/Dockerfile` is the one source of truth for build mode inference.
- A seed or flag that sets `image.mode` to `build` keeps priority, and the preflight validates that value.
- `materialize` keeps `repo` as the only compose base selector.
- The preflight runs before `mkdirSync(root)`, so a failure leaves no registry entry.
- The volume guard lives in `runConfigSet` and applies only to the `storage.homePath` key.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | empty `--repo` gives image mode and no `--build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | build mode without Dockerfile exits 1 and leaves no entry | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone and with `--repo <checkout>` | US-002 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | homePath guard with and without the volume and override flag | US-003 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh` | existing compose-string checks | No regression |
| `.agro/evals/probes/oh-home-mount.sh` | existing home-mount checks | No regression |
| `.agro/evals/probes/oh-image-only-deploy.sh` | existing image-only checks | No regression |

Run `npm --prefix .agro/cli run typecheck` and `<cli test command>` after each story.

## Design Principles

- Apply the repository rule: no explanatory comments in tracked code.
- Fail before the wizard, and name the flag, the path, and the missing file.
- Keep one door for each create-time decision.
- Keep the change inside `runSandboxInstall` and `runConfigSet`.

## Out of Scope

- The rename of `--repo` to `--checkout`. A separate issue tracks the rename.
- UID and GID reconciliation for the empty-bind path in `.devcontainer/entrypoint.sh`.
- Changes to the compose files under `.devcontainer/`.

## Open Questions

1. What name does the override flag for `config set` take? The recommended default is `--force`.
2. Which command runs the CLI unit tests? The package script for the tests needs confirmation.
3. Docs: this task updates `docs/installation.md`, `docs/quickstart.md`, and `docs/configuration.md`. Does mifunedev/agro-web need a matching change?

## Acceptance Criteria

- [ ] All story acceptance criteria pass.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] The three compose-string probes report PASS.
- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` builds only from a harness checkout.
- [ ] `docs/configuration.md` documents `--home-mount` and the orphaned-volume hazard.

## Lessons

Filled by the advisor before undraft.
