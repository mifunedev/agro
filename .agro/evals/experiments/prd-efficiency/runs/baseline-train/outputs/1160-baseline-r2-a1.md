# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] `defaultSandboxImage("0.13.0")` returns `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `defaultSandboxImage("0.0.0-dev")` returns `ghcr.io/mifunedev/agro:latest`.
- [ ] `defaultSandboxImage("1.2")` and `defaultSandboxImage("1.2.3-rc.1")` return `ghcr.io/mifunedev/agro:latest`.
- [ ] A test calls `runSandboxInstall` with no `--checkout`, `--yes`, and `--print-argv`. The test asserts that stdout contains `image: ghcr.io/mifunedev/agro:<version>` for the injected version.
- [ ] A test calls `runSandboxInstall` with no `--checkout` and `--yes`. The test asserts that the entry `agro.json` holds no `image.ref`.
- [ ] A test binds a `--checkout` directory with no `.devcontainer/Dockerfile`. The test asserts that the entry `agro.json` holds `image.ref` equal to `defaultSandboxImage(<version>)`.
- [ ] `grep -rn 'DEFAULT_SANDBOX_IMAGE' .agro/cli/src` prints no line.
- [ ] `bash .agro/evals/probes/agro-sandbox-image-mode.sh` exits 0.

### US-002: `--version` flag pins an official release

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I can pin an official release without typing the full image ref.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0"])` returns `ok: true` with `version: "0.13.0"`.
- [ ] `parseSandboxArgs(["install", "docker", "--version", "0.13.0"])` returns `ok: true` with `version: "0.13.0"`.
- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0", "--image=my/img:1"])` returns `ok: false`. The error names both `--version` and `--image=<ref>`.
- [ ] `parseSandboxArgs(["install", "docker", "--version=latest"])` returns `ok: false`. The error states the `X.Y.Z` form.
- [ ] `parseSandboxArgs(["install", "docker", "--version"])` returns `ok: false` with `--version requires a value`.
- [ ] From a built bundle, `AGRO_HOME=$(mktemp -d) node .agro/cli/dist/agro.js sandbox install docker --name probe --version=0.13.0 --yes --print-argv` exits 0. Stdout contains `image: ghcr.io/mifunedev/agro:0.13.0`.
- [ ] From a built bundle, `AGRO_HOME=$(mktemp -d) node .agro/cli/dist/agro.js sandbox install docker --name probe --yes --print-argv` exits 0. Stdout contains `image: ghcr.io/mifunedev/agro:<version in .agro/cli/package.json>`.
- [ ] With `AGRO_HOME=<dir>`, `node .agro/cli/dist/agro.js sandbox install docker --version=0.13.0 --image=my/img:1` exits 1. `<dir>/sandboxes/` holds no entry after the command.
- [ ] A test calls `runSandboxInstall` with `version: "0.13.0"` and `--yes`. The test asserts that the entry `agro.json` holds `image: { mode: "image", ref: "ghcr.io/mifunedev/agro:0.13.0" }`.
- [ ] A test calls `runSandboxInstall` with `version: "0.13.0"` and a `--checkout` directory that holds `.devcontainer/Dockerfile`. The test asserts `image.mode` equals `image` and the compose argv holds `--no-build`.

### US-003: Install-time pin persists across lifecycle verbs

**Description:** As an operator, I want an install-time pin to persist so that `agro restart` keeps the same release.

**Acceptance Criteria:**

- [ ] A test installs an entry with `version: "0.13.0"`, then calls `runComposeVerb("restart", …)`. The rendered `--extra-env-file` holds `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`.
- [ ] A test installs an entry with `version: "0.13.0"`, then installs the same `--name` again without `--version`. The entry `agro.json` still holds `image.ref` equal to `ghcr.io/mifunedev/agro:0.13.0`.

### US-004: Docs and help show `--version`

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `agro sandbox --help` lists `--version <X.Y.Z>` and states that `--version` conflicts with `--image=<ref>`.
- [ ] `agro sandbox --help` states the resolution order: `--image=<ref>` or `--version` > `agro.json` `image.ref` > the CLI-version default.
- [ ] `docs/deployment-prebuilt-image.md` pins a release with `agro sandbox install docker --version=<X.Y.Z>`. The file keeps `--image=<ref>` for custom images only.
- [ ] `docs/deployment-prebuilt-image.md`, `docs/configuration.md`, `docs/installation.md`, and `docs/quickstart.md` name the CLI-version default and the `latest` fallback for a non-release CLI version.
- [ ] `docs/lifecycle-commands.md` and `.agro/cli/README.md` list `--version <X.Y.Z>` in the `agro sandbox install` flag set.
- [ ] `npm test` exits 0, including `.agro/cli/src/__tests__/docs.test.ts`.

## Summary

Verified current state:

- `.agro/cli/src/commands/lifecycle.ts` defines `DEFAULT_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest"`. `runSandbox` resolves the image as `--image=<ref>` > `AGRO_SANDBOX_IMAGE` > `agro.json` `image.ref` > `DEFAULT_SANDBOX_IMAGE`. `runSandbox` resolves an image only when `--image` or `--image=<ref>` is present.
- `.agro/cli/src/commands/sandbox.ts` `runSandboxInstall` writes `image.ref` for two cases: an explicit `--image=<ref>`, and a `--checkout` directory with no `.devcontainer/Dockerfile`. The second case writes `DEFAULT_SANDBOX_IMAGE`.
- Without `--checkout`, the install writes no `image.ref` and passes no image to `runSandbox`. The compose base `.devcontainer/docker-compose.image-only.yml` then falls back to `${AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}`.
- `.agro/cli/src/cli.ts` defines `VERSION` from the esbuild define `__AGRO_VERSION__`. `.agro/cli/build.mjs` sets that define from `.agro/cli/package.json` `version`, today `0.13.0`. An unbundled run, such as vitest, gets `0.0.0-dev`.
- `cli.ts` checks `isVersionFlag` only on the first argument. `agro sandbox install docker --version=0.13.0` reaches `parseSandboxArgs`, which rejects the flag today as unknown.
- `--print-argv` prints the `docker compose` argv only. The argv carries no image ref, so stdout does not show the selected image today.
- `.agro/cli/src/lib/config-render.ts` renders `image.ref` as `AGRO_SANDBOX_IMAGE` into the `--extra-env-file` for every compose verb. A stored `image.ref` therefore reaches `agro restart` today.
- The CLI has no `agro start` verb. The lifecycle verbs are `stop`, `restart`, `logs`, `ps`, and `destroy`.
- `.agro/evals/probes/agro-sandbox-image-mode.sh` requires the literal `DEFAULT_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest"` in `lifecycle.ts`.

Selected approach:

1. Move the CLI version into one shared module that `cli.ts` and `lifecycle.ts` both import.
2. Replace the constant `DEFAULT_SANDBOX_IMAGE` with `defaultSandboxImage(version)`. The function returns `ghcr.io/mifunedev/agro:<version>` for a plain `X.Y.Z` version and `ghcr.io/mifunedev/agro:latest` for any other version.
3. Add `--version <X.Y.Z>` and `--version=<X.Y.Z>` to `parseSandboxArgs`. The parser maps the value to `ghcr.io/mifunedev/agro:<X.Y.Z>` and rejects the flag together with `--image=<ref>`.
4. The install treats a `--version` pin as an explicit pin. The install stores the pin in `image.ref` with `image.mode` set to `image`.
5. For image mode, the install passes image selection to `runSandbox`. `runSandbox` resolves the default from `defaultSandboxImage(<CLI version>)` at run time. The install does not store that default for the no-checkout case.
6. In `--print-argv` mode, `runSandbox` writes `image: <ref>` to stdout ahead of the argv when an image ref resolves.

Affected surfaces:

| Surface | Mark | Reason |
|---|---|---|
| Host and sandbox | applied | `agro sandbox install` runs on the host only. The code change lives in `.agro/cli/src/`. The application agent builds and tests inside the sandbox. |
| Lifecycle door | applied | `agro sandbox install` gains `--version`. `agro restart` reads the stored `image.ref` through the existing render path. |
| Canonical and provider surfaces | not applicable | The change touches no skill, hook, or provider mirror. |
| Root and scaffold | applied | The CLI ships to initialized projects through `@mifune/agro`. |
| Interactive and headless processes | not applicable | The change starts no persistent process. |
| Local and remote operation | not applicable | The install behavior is identical on a laptop and on a VM. |
| Parallel operation | not applicable | Each registry entry owns its own `agro.json`. |
| Public documentation | applied | `mifunedev/agro-web` documents `--image=<ref>`. See Open Questions. |
| Verification | applied | Vitest cases, the bundle checks, the image-mode probe, and CI. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/product.ts` | new `AGRO_VERSION` export (name to confirm in implementation) | Single source of the CLI version, read from `__AGRO_VERSION__` with the `0.0.0-dev` fallback. |
| `.agro/cli/src/cli.ts` | `VERSION`, `SandboxArgs`, `parseSandboxArgs`, `printSandboxHelp`, `sandbox` dispatch | Import the shared version. Parse `--version`. Reject `--version` with `--image=<ref>`. Pass the pin to `runSandboxInstall`. Update help text. |
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `defaultSandboxImage`, `runSandbox` | Replace the constant with the function. Print `image: <ref>` in `--print-argv` mode. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, `runSandboxInstall` | Store a `--version` pin in `image.ref`. Use `defaultSandboxImage` for the non-harness `--checkout` case. Select image mode in `runSandbox` for every image-mode install. |
| `.agro/evals/probes/agro-sandbox-image-mode.sh` | `DEFAULT_SANDBOX_IMAGE` grep | Replace the literal check with a check for `defaultSandboxImage` and the `latest` fallback. |
| `.devcontainer/docker-compose.image-only.yml` | `image:` fallback | No change. The `latest` fallback stays as the last resort when no env value reaches compose. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --version <X.Y.Z>` | New | Pin `ghcr.io/mifunedev/agro:<X.Y.Z>`. Accept `--version=<X.Y.Z>` and `--version <X.Y.Z>`. |
| `agro sandbox install docker --image=<ref>` | Modify | Conflict with `--version`. Exit 1 before any write. |
| `agro sandbox install docker` (no pin) | Modify | Default image becomes `ghcr.io/mifunedev/agro:<CLI version>`, or `latest` for a non-release CLI version. |
| `agro sandbox install docker --print-argv` | Modify | Print `image: <ref>` ahead of the argv when an image ref resolves. |
| `agro sandbox --help` | Modify | Document `--version`, the conflict, and the resolution order. |
| `docs/deployment-prebuilt-image.md`, `docs/configuration.md`, `docs/installation.md`, `docs/quickstart.md`, `docs/lifecycle-commands.md`, `.agro/cli/README.md` | Modify | Show `--version` as the release pin and the CLI-version default. |

## Storage

- **Persistence layer**: the registry entry file `${AGRO_HOME:-~/.agro}/sandboxes/<name>/agro.json`.
- **Location / schema**: the existing `image.ref` string and `image.mode` field. The schema does not change. No `image.version` field is added.
- **Pattern**: follow the existing `--image=<ref>` write in `runSandboxInstall`. `config-render.ts` already renders `image.ref` as `AGRO_SANDBOX_IMAGE` for every compose verb.

## Architectural Decisions

- **Source of truth**: `.agro/cli/package.json` `version` sets the CLI version through the esbuild define. One module exports the version. `defaultSandboxImage` is the only place that builds the default ref.
- **State management**: `image.ref` holds an explicit pin only: `--version`, `--image=<ref>`, a seeded value, or a value set with `agro config set`. The no-checkout install resolves the default at run time and stores nothing. The non-harness `--checkout` case keeps its existing write, because the checkout compose base falls back to the local build tag `sandbox-<name>`, not to the published image.
- **Release version form**: a plain release matches `^[0-9]+\.[0-9]+\.[0-9]+$`. `--version` accepts that form only. `defaultSandboxImage` uses `latest` for any other form.
- **Flag conflicts**: `--version` with `--image=<ref>` exits 1 in `parseSandboxArgs`, before the registry write. `--version` with a bare `--image` is accepted, because both select image mode. `--version` implies image mode and `--no-build`, the same as `--image=<ref>`.
- **Image name**: `--version` always uses the repository `ghcr.io/mifunedev/agro`. Custom registries use `--image=<ref>`.
- **Auth / scoping**: N/A. The change adds no credential and no permission.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `defaultSandboxImage` for `0.13.0`, `0.0.0-dev`, `1.2`, `1.2.3-rc.1`; bare `--image` falls back to `defaultSandboxImage(<version>)`; `--print-argv` prints `image: <ref>` | US-001, US-002 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `parseSandboxArgs` accepts `--version=X.Y.Z` and `--version X.Y.Z`; rejects a missing value, a non-release value, and `--image=<ref>` together with `--version` | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version` stores `image.ref` and `image.mode`; `--version` overrides build mode for a harness checkout; no-checkout install stores no `image.ref` and prints the default image; non-harness checkout stores `defaultSandboxImage(<version>)` | US-001, US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | reinstall without `--version` keeps the stored pin | US-003 |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | `restart` after a `--version` install renders `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0` | US-003 |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | built bundle `sandbox install docker --name probe --yes --print-argv` prints `image: ghcr.io/mifunedev/agro:<package.json version>`; `--version=0.13.0 --image=my/img:1` exits 1 and writes no entry | US-001, US-002 |
| `.agro/cli/src/__tests__/docs.test.ts` | help and docs mention `--version` | US-004 |
| `.agro/evals/probes/agro-sandbox-image-mode.sh` | probe greps `defaultSandboxImage` and the `latest` fallback | US-001 |

Update the existing cases that assert `ghcr.io/mifunedev/agro:latest` as the install default in `sandbox.test.ts` and `lifecycle.test.ts`. Keep the `config-render.test.ts` cases, because the compose fallback stays `latest`.

## Design Principles

- Keep one source of truth for the CLI version and one function for the default ref.
- Store only what the operator chose. Resolve defaults at run time.
- Reject a conflicting flag pair before any write.
- Add no tracked-code comments. Express intent through names and tests.
- Keep the change inside `.agro/cli/`, the probe, and the docs. Do not change the compose files.

## Out of Scope

- A new `agro start` verb.
- A change to the `latest` fallback in `.devcontainer/docker-compose.image-only.yml` or `.devcontainer/docker-compose.yml`.
- A check that the requested tag exists in GHCR before the pull.
- A new `agro.json` field, such as `image.version`.
- `--version` on any verb other than `agro sandbox install`.
- Edits to `mifunedev/agro-web` inside this task's pull request.

## Open Questions

1. The issue names `agro start`. The CLI has no `start` verb. Confirm that `agro restart` and a reinstall of the same `--name` are the only persistence targets.
2. The non-harness `--checkout` case writes the default ref into `image.ref` today. The plan keeps that write with the CLI-version tag, because the checkout compose base has no published-image fallback. Confirm that this write does not break the rule "store only an explicit pin".
3. A no-checkout sandbox with no pin gets its image through the `up` environment at install time. A later `docker compose up` outside `agro sandbox install` falls back to `latest`. Confirm that the operator accepts this gap. The alternative requires the install to store the default.
4. `--print-argv` shows no image today. The plan adds the stdout line `image: <ref>`. Confirm the line format.
5. The plan accepts a `--version` value in the `X.Y.Z` form only. The parser rejects `latest` and `0.13.0-rc.1`. Confirm the strict form.
6. `mifunedev/agro-web` documents `--image=<ref>`. Confirm whether the operator opens a follow-up issue in `mifunedev/agro-web`.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`. Stdout contains `image: ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`. Stdout contains `image: ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/agro-sandbox-image-mode.sh` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
