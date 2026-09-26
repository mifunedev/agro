# PRD: Separate the two sandbox install mounts

Status: BLOCKED

Source: `work/issue-1042.md` (issue 1042).

## User Stories

### US-001: Select build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only when `<dir>` holds `.devcontainer/Dockerfile`, so that an empty host directory boots the published image.

**Acceptance Criteria:**

- [ ] `runSandboxInstall` with `repo: <empty dir>` and `yes: true` writes `agro.json` with `repo: <empty dir>` and `image: { mode: "image" }`.
- [ ] For that install, the rendered compose env contains `AGRO_REPO_DIR=<empty dir>`.
- [ ] For that install with `printArgv: true`, the wrapper argv contains `--no-build` and does not contain `--build`.
- [ ] For that install, the wrapper call receives `AGRO_SANDBOX_IMAGE` set to the resolved image ref. The ref resolves as `--image=<ref>`, then `image.ref`, then `ghcr.io/mifunedev/agro:latest`.
- [ ] `runSandboxInstall` with `repo: <dir with .devcontainer/Dockerfile>` and no seed writes `image: { mode: "build" }` and passes `--build`.
- [ ] If a seed sets `image.mode` to `build` and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall` returns 1 before the first wizard question.
- [ ] The stderr message of that refusal contains `--repo`, the resolved path, and `.devcontainer/Dockerfile`.
- [ ] After that refusal, `<registry>/<name>/` does not exist.
- [ ] If `--image` or `--image=<ref>` is present, the install does not run the build preflight and does not refuse.
- [ ] The existing case "--repo renders AGRO_REPO_DIR into the compose env and selects the build base" passes after its fixture gains `.devcontainer/Dockerfile`.

### US-002: Add the `--home-mount <dir>` install flag and wizard prompt

**Description:** As an operator, I want `agro sandbox install docker --home-mount <dir>` so that I choose the `/home/sandbox` host path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--home-mount", "/x"])` returns `homeMount: "/x"`.
- [ ] `parseSandboxArgs(["install", "docker", "--home-mount"])` returns an error that names `--home-mount`.
- [ ] `runSandboxInstall` with `homeMount: <dir>` writes `storage.homePath` as the absolute resolved path of `<dir>`.
- [ ] If `<dir>` does not exist, `runSandboxInstall` returns 1, names `--home-mount` and the path, and writes no registry entry.
- [ ] With `homeMount: <dir>` and no `repo`, the rendered env contains `AGRO_HOME_MOUNT=<dir>`, `agro.json` holds `image: { mode: "image" }`, and the entry `docker-compose.yml` has no `/home/sandbox/harness` line.
- [ ] With `homeMount: <dir>` and `repo: <checkout>`, the rendered env contains `AGRO_HOME_MOUNT=<dir>` and `AGRO_REPO_DIR=<checkout>`, and the entry `docker-compose.yml` has the `/home/sandbox/harness` bind line.
- [ ] The interactive wizard asks seven questions without sshd. The seventh question contains `/home/sandbox`.
- [ ] A blank answer to the seventh question leaves `storage.homePath` unset.
- [ ] A non-blank answer to the seventh question sets `storage.homePath` to the absolute resolved path.
- [ ] `agro sandbox --help` lists `--home-mount <dir>` in the usage line and in the flag table.

### US-003: Guard `config set storage.homePath` against an existing volume

**Description:** As an operator, I want `agro config set storage.homePath` to refuse when the named volume `<name>_workspace` exists, so that a mount swap does not silently orphan sandbox state.

**Acceptance Criteria:**

- [ ] If `docker volume inspect <name>_workspace` exits 0, `runConfigSet("storage.homePath", <dir>, ...)` returns 1 and leaves `agro.json` unchanged.
- [ ] The stderr message of that refusal names `<name>_workspace`, states that the volume state will be orphaned, and names `<override-flag>`.
- [ ] If `<override-flag>` is present, the same call returns 0 and writes `storage.homePath`.
- [ ] If `docker volume inspect <name>_workspace` exits non-zero, `runConfigSet` writes `storage.homePath` and returns 0.
- [ ] `runConfigSet` for any other field runs no `docker` command.
- [ ] `parseConfigArgs(["set", "storage.homePath", "/x", "<override-flag>"])` returns the override as set.

### US-004: Document the two mounts

**Description:** As an operator, I want the docs to separate `--repo` and `--home-mount`, so that I pick the flag that persists the sandbox.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` is a host path, and that build mode applies only when that path holds `.devcontainer/Dockerfile`.
- [ ] `docs/configuration.md` names `--home-mount` as the create-time door to `storage.homePath`.
- [ ] `docs/configuration.md` states that a later `config set storage.homePath` orphans the `<name>_workspace` volume, and names `<override-flag>`.
- [ ] `docs/configuration.md` no longer states that `repo` alone selects build mode.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed paragraph, or reports no new finding against the base commit.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/docs.test.ts` exits 0.

## Summary

Verified current state at commit `f94c1ad`:

- `seedConfig()` sets `image.mode` to `build` whenever `repo` is set (`.agro/cli/src/commands/sandbox.ts:118-121`).
- The only `--repo` preflight is an existence check (`.agro/cli/src/commands/sandbox.ts:196-200`).
- `runSandboxInstall` writes the registry entry only after the wizard (`.agro/cli/src/commands/sandbox.ts:244-247`). A preflight that runs before the wizard leaves no entry.
- `materialize()` selects `composeRepo` when `repo` is set and `composeImageOnly` otherwise (`.agro/cli/src/lib/registry.ts:95-101`).
- `renderComposeVars` already renders `AGRO_HOME_MOUNT` from `storage.homePath` (`.agro/cli/src/lib/config-render.ts:40`).
- `oh-config.ts` already rejects a relative `storage.homePath` (`.agro/cli/src/lib/oh-config.ts:194-203`).
- `runConfigSet` writes any known field with no side check (`.agro/cli/src/commands/config.ts:43-78`).
- `.devcontainer/entrypoint.sh:159-196` seeds the control plane into an empty `/home/sandbox/harness` bind.

The issue omits one verified gap.
In `.devcontainer/docker-compose.yml`, the build-base image defaults to `sandbox-${SANDBOX_NAME}`.
If `image` or `imageRef` is present, `runSandbox` sets `AGRO_SANDBOX_IMAGE`.
Otherwise `runSandbox` sets no image (`.agro/cli/src/commands/lifecycle.ts:163-169`).
In image mode, `runSandboxInstall` passes `noBuild` and passes no `image`.
The fix for part 1 alone therefore starts `up -d --no-build` against an absent local image.
US-001 closes the gap. If `repo` has a value and `image.mode` is `image`, `runSandboxInstall` passes `image: true`.

Selected approach:

1. Resolve `image.mode` in this order: seed `image.mode`, then `existsSync(<repo>/.devcontainer/Dockerfile)`, then `image`.
2. Run all path preflights before the wizard: `--repo` existence, `--home-mount` existence, and the build-mode Dockerfile check.
3. Carry `--home-mount` into `storage.homePath`. Leave `materialize()` unchanged, because the base choice already keys off `repo`.
4. Guard `runConfigSet` for the field `storage.homePath` with `docker volume inspect <name>_workspace`.

Affected surfaces:

| Surface | Mark |
|---|---|
| Host and sandbox | applied: every change runs in the host CLI `.agro/cli/`. |
| Lifecycle door | applied: `agro sandbox install` and `agro config set` change. `oh` shares the same bundle. |
| Canonical and provider surfaces | not applicable: no skill, hook, or mirror changes. |
| Root and scaffold | applied: the CLI bundle ships to initialized projects through `oh update`. |
| Interactive and headless processes | not applicable: no persistent process changes. |
| Local and remote operation | applied: the flags work the same for a local host and a remote VM host. |
| Parallel operation | not applicable: one install writes one registry entry. |
| Public documentation | applied: `mifunedev/agro-web` needs a matching flag reference. See open question 4. |
| Verification | applied: see the Test Plan. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, `seedConfig`, `runWizard`, `runSandboxInstall` | Mode inference, preflight order, `homeMount`, image pass-through. |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs`, `printSandboxHelp`, install dispatch near line 1165 | Parse `--home-mount` and update help text. |
| `.agro/cli/src/cli.ts` | `ConfigArgs`, `parseConfigArgs`, config dispatch near line 1063, `printConfigHelp` | Parse `<override-flag>` for `config set`. |
| `.agro/cli/src/commands/config.ts` | `ConfigOptions`, `runConfigSet` | Volume guard for `storage.homePath`. |
| `.agro/cli/src/commands/lifecycle.ts` | `runSandbox` | Read only. Resolves the image ref when `image` is true. |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Read only. The base choice stays keyed off `repo`. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Read only. Already renders `AGRO_HOME_MOUNT`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install <runtime> --home-mount <dir>` | new flag | Sets `storage.homePath` to the resolved absolute path. |
| `agro sandbox install` wizard | new prompt | Seventh prompt for the `/home/sandbox` host path. Blank keeps the named volume. |
| `agro sandbox install --repo <dir>` | behavior change | Build mode applies only when `<dir>/.devcontainer/Dockerfile` exists. |
| `agro sandbox install` stderr | new error | Build mode without `.devcontainer/Dockerfile` exits 1 before the wizard. |
| `agro config set storage.homePath <dir> <override-flag>` | new flag and refusal | Refuses when `<name>_workspace` exists and the override is absent. |
| `agro sandbox --help`, `agro config --help` | help text | Document `--home-mount` and `<override-flag>`. |

## Storage

The change adds no new store. `--home-mount` writes the existing field `storage.homePath` in `~/.agro/sandboxes/<name>/agro.json` or `~/.oh/sandboxes/<name>/oh.json`. The guard reads Docker volume state through `docker volume inspect` and writes nothing.

## Architectural Decisions

- **Source of truth for build mode:** the checkout contents decide. A seed `image.mode` still wins, but a seed `build` without `.devcontainer/Dockerfile` is an error.
- **Image resolution in image mode with a repo bind:** `runSandboxInstall` passes `image: true` to `runSandbox`. `runSandbox` keeps its existing ref order. No new resolution path.
- **Preflight order:** each path check runs before the wizard and before `mkdirSync(root)`. A refused install leaves no registry entry.
- **Compose base:** `materialize()` stays unchanged. `--home-mount` alone keeps the image-only base.
- **Volume name:** the guard computes `<name>_workspace` from the resolved `name` field of the target config. The Compose project name is `SANDBOX_NAME`, and both compose files declare the volume `workspace`.
- **Guard scope:** the guard runs only for the field `storage.homePath`, and only when the new value differs from the current value.
- **Deferred:** the rename of `--repo` to `--checkout` and UID/GID reconciliation for an empty bind.

## Test Plan (TDD)

Run each test command from the repository root on the host.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` selects image mode, renders `AGRO_REPO_DIR`, passes `--no-build`, sets `AGRO_SANDBOX_IMAGE` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <checkout>` with `.devcontainer/Dockerfile` selects build mode; existing case at line 148 with an updated fixture | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | seed `image.mode: build` without Dockerfile returns 1, asks nothing, writes no entry | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--image` skips the build preflight | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone; `--home-mount` with `--repo <checkout>`; missing `--home-mount` dir | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | wizard asks seven questions; blank and non-blank seventh answers | US-002 |
| `.agro/cli/src/__tests__/cli.property.test.ts` or `<parser test file>` | `parseSandboxArgs` for `--home-mount`; `parseConfigArgs` for `<override-flag>` | US-002, US-003 |
| `<config set test file>` | volume exists and refuses; override proceeds; volume absent proceeds; other field runs no `docker` | US-003 |
| `.agro/cli/src/__tests__/docs.test.ts` | existing docs checks | US-004 |

Commands:

1. `pnpm exec vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.
2. `pnpm test` exits 0.
3. `pnpm run typecheck` exits 0.
4. `bash .agro/evals/probes/oh-devcontainer-restructure.sh` reports PASS.
5. `bash .agro/evals/probes/oh-home-mount.sh` reports PASS.
6. `bash .agro/evals/probes/oh-image-only-deploy.sh` reports PASS.

## Design Principles

- Keep one source of truth: the checkout contents select build mode. The flag does not.
- Fail before a side effect: the CLI refuses before the wizard and before the registry write.
- Name the cause: each refusal names the flag, the path, and the missing file or the volume.
- Add no machinery: reuse `runSandbox` image resolution, `materialize()`, and `renderComposeVars`.
- Add no comments to tracked code (`AGENTS.md`, non-negotiable 5).
- Keep the fix narrow: no flag rename and no entrypoint change.

## Out of Scope

- UID and GID reconciliation for the empty-bind path in `.devcontainer/entrypoint.sh:167-191`.
- The rename of `--repo` to `--checkout`.
- A migration of state from `<name>_workspace` to a host path.
- A change to `.devcontainer/docker-compose.yml` or `.devcontainer/docker-compose.image-only.yml`.

## Open Questions

1. What is the name of `<override-flag>` for `config set storage.homePath`? The issue requires the flag and does not name it. This question blocks US-003 and US-004.
   A. `--force`
   B. `--orphan-volume`
   C. Other: `<specify>`
2. What does the guard do when `docker` cannot start, or when the Docker daemon is unreachable?
   A. Refuse, and require `<override-flag>`.
   B. Warn, and write the field.
   C. Other: `<specify>`
3. Does a re-install of an existing name with a changed `--home-mount` carry the same orphan hazard? Must `runSandboxInstall` run the same volume guard?
   A. Yes: apply the guard in install when an entry and `<name>_workspace` exist.
   B. No: keep the guard in `config set` only, as the issue states.
4. Does `mifunedev/agro-web` need a matching change in this task, or in a follow-up issue?
   A. A follow-up issue.
   B. This task.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `oh-devcontainer-restructure.sh`, `oh-home-mount.sh`, and `oh-image-only-deploy.sh` report PASS.
- [ ] `git diff --name-only` against the base commit lists no file under `.devcontainer/`.
- [ ] The diff adds no explanatory comment to tracked code.
- [ ] `agro sandbox install docker --repo <empty dir> --name <name> --yes --print-argv` prints an argv with `--no-build`, run on the host.

## Lessons

Filled by the advisor before undraft.
