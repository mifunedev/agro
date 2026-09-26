# PRD: Separate the repo bind from the home mount in sandbox install

Status: BLOCKED

Source: `work/issue-1042.md`.

## User Stories

### US-001: Infer build mode from the checkout contents

**Description:** As an operator, I want `--repo <dir>` to select build mode only when `<dir>` holds `.devcontainer/Dockerfile` so that an empty host directory runs the published image.

**Acceptance Criteria:**

- [ ] `seedConfig()` in `.agro/cli/src/commands/sandbox.ts` sets `image.mode` to `build` only when the seed has no `image.mode` and `existsSync(<repo>/.devcontainer/Dockerfile)` is true.
- [ ] `runSandboxInstall({ repo: <empty dir>, yes: true })` writes `repo: <empty dir>` and `image: { mode: "image" }` to `agro.json`.
- [ ] For `--repo <empty dir>`, the rendered compose env contains `AGRO_REPO_DIR=<empty dir>`.
- [ ] For `--repo <empty dir>` with `printArgv: true`, the printed argv contains `--no-build` and does not contain `--build`.
- [ ] For `--repo <empty dir>`, the entry's `.devcontainer/docker-compose.yml` is the build-capable base that binds `/home/sandbox/harness`.
- [ ] The test at `.agro/cli/src/__tests__/sandbox.test.ts:148` writes `.devcontainer/Dockerfile` into its fixture and still asserts `image: { mode: "build" }`.
- [ ] `npx vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-002: Refuse build mode without a Dockerfile before the wizard

**Description:** As an operator, I want install to refuse a build without `<repo>/.devcontainer/Dockerfile` before the wizard so that no registry entry remains.

**Acceptance Criteria:**

- [ ] If `<repo>/agro.json` sets `image.mode: "build"` and `<repo>/.devcontainer/Dockerfile` is absent, `runSandboxInstall` returns 1.
- [ ] In that case, stderr contains `--repo`, the resolved repo path, and `.devcontainer/Dockerfile`.
- [ ] In that case, `io.ask` receives no question.
- [ ] In that case, no directory exists at `entryRoot(<name>)` after the call.
- [ ] If an existing registry entry sets `image.mode: "build"` and the new `--repo` lacks `.devcontainer/Dockerfile`, `runSandboxInstall` returns 1 and leaves the existing `agro.json` byte-identical.
- [ ] With `image.mode: "build"` and no Dockerfile, `--image`, `--image=<ref>`, or `--no-build` each makes `runSandboxInstall` return 0.
- [ ] `npx vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-003: Add the `--home-mount <dir>` install flag

**Description:** As an operator, I want `agro sandbox install docker --home-mount <dir>` so that I choose the `/home/sandbox` host path at create time.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--home-mount", "/x"])` returns `homeMount: "/x"`.
- [ ] `parseSandboxArgs(["install", "docker", "--home-mount"])` returns `ok: false` with the text `--home-mount requires a value`.
- [ ] `runSandboxInstall({ homeMount: <abs dir>, yes: true })` writes `storage: { homePath: <abs dir> }` and `image: { mode: "image" }` to `agro.json`.
- [ ] For `--home-mount <abs dir>` alone, the rendered compose env contains `AGRO_HOME_MOUNT=<abs dir>` and no `AGRO_REPO_DIR` line.
- [ ] For `--home-mount <abs dir>` alone, the entry's `.devcontainer/docker-compose.yml` equals the image-only base.
- [ ] For `--home-mount <abs dir>` with `--repo <checkout with Dockerfile>`, the rendered env contains both `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`, and the entry uses the build-capable base.
- [ ] `runSandboxInstall({ homeMount: "relative/path", yes: true })` returns 1, and no directory exists at `entryRoot(<name>)`.
- [ ] `printSandboxHelp()` output contains `--home-mount <dir>`.
- [ ] `npx vitest run .agro/cli/src/__tests__/sandbox.test.ts .agro/cli/src/__tests__/lifecycle.test.ts` exits 0.

### US-004: Ask for the home mount in the wizard

**Description:** As an operator, I want the install wizard to ask for the `/home/sandbox` host path so that the create-time choice is visible.

**Acceptance Criteria:**

- [ ] The wizard asks seven questions. The seventh question contains `/home/sandbox`.
- [ ] The default answer for the seventh question is blank when `storage.homePath` is unset.
- [ ] A blank answer leaves `storage.homePath` unset in `agro.json`.
- [ ] An absolute path answer writes `storage.homePath` to `agro.json`.
- [ ] With `--home-mount <dir>`, the seventh question shows `<dir>` as the default.
- [ ] The test at `.agro/cli/src/__tests__/sandbox.test.ts:509` asserts seven questions.
- [ ] `--yes` asks no question.
- [ ] `npx vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0.

### US-005: Guard `config set storage.homePath` against an existing volume

**Description:** As an operator, I want `config set storage.homePath` to refuse when `<name>_workspace` exists so that a late change cannot silently orphan state.

**Acceptance Criteria:**

- [ ] If `docker volume inspect <name>_workspace` exits 0 and the new value is non-empty and differs from the current value, `runConfigSet("storage.homePath", <dir>, ...)` returns 1 and leaves `agro.json` byte-identical.
- [ ] The refusal message names `<name>_workspace`, states that existing state in the volume is orphaned, and names `<override-flag>`.
- [ ] With `<override-flag>`, the same call returns 0 and writes `storage.homePath`.
- [ ] If `docker volume inspect <name>_workspace` exits non-zero, the call returns 0 and writes `storage.homePath`.
- [ ] The guard applies with `--sandbox <name>` and without it. `<name>` comes from the target `agro.json` `name` field.
- [ ] `runConfigSet` for every other field runs no `docker` command.
- [ ] `parseConfigArgs(["set", "storage.homePath", "/x", "<override-flag>"])` returns `ok: true` with the override set.
- [ ] `npx vitest run .agro/cli/src/__tests__/config-secret.test.ts` exits 0.

### US-006: Document the two mounts

**Description:** As an operator, I want the docs and help text to separate `--repo` from `--home-mount` so that I pick the right flag.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/quickstart.md` state that `--repo` takes a host path, and that build mode applies only when that path holds `.devcontainer/Dockerfile`.
- [ ] `docs/configuration.md` lists `--home-mount <dir>` as the create-time door to `storage.homePath`.
- [ ] `docs/configuration.md` states that a later `config set storage.homePath` orphans the `<name>_workspace` volume, and names `<override-flag>`.
- [ ] The `printSandboxHelp()` text in `.agro/cli/src/cli.ts` describes `--repo` build selection and `--home-mount`.
- [ ] `npx vitest run .agro/cli/src/__tests__/docs.test.ts .agro/cli/src/__tests__/cli-first-help.test.ts` exits 0.

## Summary

Verified current state:

- `seedConfig()` sets `image.mode` to `build` whenever `config.repo` is defined (`.agro/cli/src/commands/sandbox.ts:123-126`).
- The only `--repo` preflight is an existence check (`.agro/cli/src/commands/sandbox.ts:197-201`).
- `runSandboxInstall` creates the entry directory at line 245. `writeOhConfig` validates at line 246. A validation error therefore leaves an empty entry directory behind.
- `--image` and `--no-build` both make the lifecycle pass `--no-build` (`.agro/cli/src/commands/lifecycle.ts:164`).
- `renderComposeVars` already renders `AGRO_HOME_MOUNT` from `storage.homePath` (`.agro/cli/src/lib/config-render.ts:40`).
- `materialize()` picks the compose base from `repo` only (`.agro/cli/src/lib/registry.ts:95`). The image-only base binds `AGRO_HOME_MOUNT` at `.devcontainer/docker-compose.image-only.yml:9`.
- `validateOhConfig` rejects a relative `storage.homePath` (`.agro/cli/src/lib/oh-config.ts:192-207`).
- `runConfigSet` takes no runner and runs no `docker` command today (`.agro/cli/src/commands/config.ts:43-77`).
- Both compose bases declare the named volume `workspace` (`.devcontainer/docker-compose.yml:45-46`). Compose names that volume `<SANDBOX_NAME>_workspace`.
- `agro sandbox install` has no flag that forces build mode. The `build` value reaches install only from `<repo>/agro.json` or from the existing registry entry.
- The entrypoint seeds an empty `/home/sandbox/harness` bind from the image (`.devcontainer/entrypoint.sh:193-196`).

Selected approach:

1. Compute the effective config, including `--image=<ref>`, before the wizard.
2. Run all preflight checks before the wizard and before `mkdirSync(root)`.
3. Add `homeMount` to `SandboxArgs` and `SandboxInstallOptions`, and map it to `storage.homePath`.
4. Add a `run` runner and an override option to the `config set` path. Call `docker volume inspect` only for `storage.homePath`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/sandbox.ts` | `seedConfig`, `runSandboxInstall`, `runWizard`, `SandboxInstallOptions` | Build-mode inference, preflight, `homeMount`, wizard prompt |
| `.agro/cli/src/cli.ts` | `SandboxArgs`, `SANDBOX_VALUE_FLAGS`, `parseSandboxArgs`, `printSandboxHelp`, `parseConfigArgs`, `ConfigArgs` | Flag parsing and help text |
| `.agro/cli/src/commands/config.ts` | `runConfigSet`, `ConfigOptions` | Volume guard for `storage.homePath` |
| `.agro/cli/src/lib/oh-config.ts` | `validateOhConfig`, `writeOhConfig` | Existing `storage.homePath` validation, reused by preflight |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Compose base selection. No change. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Renders `AGRO_HOME_MOUNT` and `AGRO_REPO_DIR`. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install --repo <dir>` | Behavior change | Build mode only when `<dir>/.devcontainer/Dockerfile` exists. |
| `agro sandbox install --home-mount <dir>` | New flag | Sets `storage.homePath`. |
| Install wizard | New prompt | Seventh question for the `/home/sandbox` host path. |
| `agro config set storage.homePath <dir>` | New guard | Refuses when `<name>_workspace` exists, unless `<override-flag>` is present. |
| `agro config set` | New flag | `<override-flag>`. |
| `agro sandbox install --help` | Text change | Documents `--home-mount` and `--repo` build selection. |

## Storage

The change reuses the existing `agro.json` fields `repo`, `image.mode`, and `storage.homePath`. The change adds no field and no schema version. The registry entry stays at `~/.agro/sandboxes/<name>/agro.json`.

## Architectural Decisions

- **Source of truth for build mode:** An explicit `image.mode` from the seed wins. Without an explicit value, the presence of `<repo>/.devcontainer/Dockerfile` decides.
- **Preflight trigger:** Refuse only when a build would run: `repo` is set, the effective `image.mode` is `build`, and neither `--image` nor `--no-build` is present. This condition matches the one that emits `--build`.
- **Preflight order:** Resolve `name`, the effective config, `--repo` contents, and `storage.homePath` validity before the wizard and before `mkdirSync(root)`.
- **Compose base:** `materialize()` keeps keying the base on `repo`. `--home-mount` alone selects the image-only base.
- **Volume guard scope:** The guard runs in `runConfigSet` for the key `storage.homePath` only. The guard reads the sandbox name from the target `agro.json`, falling back to `DEFAULT_CONTAINER_NAME`.
- **Volume guard trigger:** The guard refuses when `docker volume inspect <name>_workspace` exits 0, the new value is non-empty, and the new value differs from the current value.
- **Test seam:** `runConfigSet` takes a `run?: LifecycleRunner` option, as `runSandboxInstall` does.

## Test Plan (TDD)

Write each test before the matching change. Run `npx vitest run <file>` from the repository root.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--repo <empty dir>` gives `image.mode: "image"`, `AGRO_REPO_DIR`, `--no-build` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Existing `:148` case with a Dockerfile fixture keeps `image.mode: "build"` | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seeded `build` without a Dockerfile returns 1, asks nothing, writes no entry | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Seeded `build` without a Dockerfile plus `--image`, `--image=<ref>`, or `--no-build` returns 0 | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` alone renders `AGRO_HOME_MOUNT` and selects the image-only base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--home-mount` with a checkout renders both keys and selects the build base | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Relative `--home-mount` returns 1 and writes no entry | US-003 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `parseSandboxArgs` accepts `--home-mount <dir>` and rejects a missing value | US-003 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Wizard asks seven questions; blank and absolute answers | US-004 |
| `.agro/cli/src/__tests__/config-secret.test.ts` | Volume present refuses; override proceeds; volume absent proceeds; other keys run no `docker` | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts`, `.agro/cli/src/__tests__/cli-first-help.test.ts` | Existing doc and help checks | US-006 |
| `.agro/evals/probes/oh-devcontainer-restructure.sh`, `.agro/evals/probes/oh-home-mount.sh`, `.agro/evals/probes/oh-image-only-deploy.sh` | Compose-string probes | No compose file change |

Run the full suite with `npm test` and the typecheck with `npm --prefix .agro/cli run typecheck`. Both commands exit 0.

## Design Principles

- Keep one source of truth: `agro.json` holds the decision, and `materialize()` and `renderComposeVars` stay unchanged.
- Fail before side effects: every install refusal happens before the wizard and before any registry write.
- Name the cause: each error names the flag, the path, and the missing file or volume.
- Add no tracked-code comments (AGENTS.md property 5).
- Change the smallest surface: no compose, entrypoint, or schema change.

## Out of Scope

- UID and GID reconciliation for the empty-bind path (`.devcontainer/entrypoint.sh:167-191`). The issue tracks this edge separately.
- The rename of `--repo` to `--checkout`. The issue tracks this rename separately.
- Any change to the compose files, the entrypoint, or the `agro.json` schema.
- Migration of data from an orphaned `<name>_workspace` volume to a host path.

## Open Questions

1. What is the name of `<override-flag>` for `agro config set storage.homePath`? This decision blocks US-005 and US-006.
   - A. `--orphan-volume` (names the consequence; recommended)
   - B. `--force`
   - C. Other: <specify>
2. When `docker volume inspect` cannot start, does the guard proceed or refuse?
   - A. Proceed and print a warning that names the unverified volume (recommended)
   - B. Refuse unless `<override-flag>` is present
3. Must the `--home-mount <dir>` directory exist before install?
   - A. No. Validate only the absolute-path and reserved-path rules that `validateOhConfig` applies (recommended)
   - B. Yes. Refuse a missing directory, as `--repo` does
4. Does the new flag require a matching change in `mifunedev/agro-web`? The plan assumes a separate follow-up.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `npm test` exits 0 from the repository root.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/oh-devcontainer-restructure.sh`, `bash .agro/evals/probes/oh-home-mount.sh`, and `bash .agro/evals/probes/oh-image-only-deploy.sh` each exit 0.
- [ ] `git diff --stat` shows no change under `.devcontainer/`.
- [ ] The diff adds no explanatory comment to tracked code.

## Lessons

Filled by the advisor before undraft.
