# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] `defaultSandboxImage("0.13.0")` returns `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `defaultSandboxImage("0.0.0-dev")`, `defaultSandboxImage("0.14.0-rc.1")`, and `defaultSandboxImage("")` each return `ghcr.io/mifunedev/agro:latest`.
- [ ] `renderComposeVars` emits `AGRO_SANDBOX_IMAGE=<default ref>` for a config with `image.mode` `"image"` and no `image.ref`.
- [ ] `renderComposeVars` emits no `AGRO_SANDBOX_IMAGE` for a config with `image.mode` `"build"` and no `image.ref`.
- [ ] `agro sandbox install docker --checkout <dir>` with no `.devcontainer/Dockerfile` in `<dir>` and no seeded `image.ref` writes no `image.ref` to the entry `agro.json`.
- [ ] `runSandbox` with a bare `--image` and no configured ref sets `AGRO_SANDBOX_IMAGE` to the default ref in the child env.
- [ ] The source tree holds no `DEFAULT_SANDBOX_IMAGE` symbol: `git grep -n DEFAULT_SANDBOX_IMAGE -- .agro/cli/src .agro/evals` prints nothing.
- [ ] `bash .agro/evals/probes/agro-sandbox-image-mode.sh` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Pin an official release with `--version`

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I pin an official release without the full image ref and keep it across restarts.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0"])` returns `imageRef` `ghcr.io/mifunedev/agro:0.13.0` and `image` `true`.
- [ ] `parseSandboxArgs(["install", "docker", "--version", "0.13.0"])` returns the same result as the `--version=0.13.0` form.
- [ ] `parseSandboxArgs` returns `ok: false` for `--version=`, `--version=latest`, `--version=v0.13.0`, and `--version=0.13`. The error names `--version <X.Y.Z>`.
- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0", "--image=my/img:1"])` returns `ok: false`. The error names both flags.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and creates no directory under `${AGRO_HOME:-~/.agro}/sandboxes/`.
- [ ] `runSandboxInstall` with `imageRef` `ghcr.io/mifunedev/agro:0.13.0` writes `image.ref` `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` `"image"` to the entry `agro.json`.
- [ ] After that install, the rendered compose env file for the entry holds `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`. `agro start` and `agro restart` read that same env file.
- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` writes the line `image mode: ghcr.io/mifunedev/agro:0.13.0` to stdout and exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-003: Document `--version` as the release pin

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `agro sandbox --help` lists `--version <X.Y.Z>` and states that `--version` conflicts with `--image=<ref>`.
- [ ] `agro sandbox --help` states the default ref as `ghcr.io/mifunedev/agro:<CLI version>`, with `latest` for a CLI version that is not `X.Y.Z`.
- [ ] `docs/deployment-prebuilt-image.md` pins a release with `agro sandbox install docker --version=<X.Y.Z>` and keeps `--image=<ref>` for a custom image.
- [ ] `git grep -n 'image=ghcr.io/mifunedev/agro:' -- docs .agro/cli/README.md` prints nothing.
- [ ] `docs/configuration.md`, `docs/installation.md`, `docs/lifecycle-commands.md`, and `.agro/cli/README.md` state the version-derived default and list `--version`.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one entry for `--version` and the version-derived default.
- [ ] `npm test` exits 0.

## Summary

Verified current state:

- `DEFAULT_SANDBOX_IMAGE` in `.agro/cli/src/commands/lifecycle.ts:105` is the constant `ghcr.io/mifunedev/agro:latest`.
- `runSandbox` resolves an image ref in this order: `--image=<ref>`, `AGRO_SANDBOX_IMAGE` or `image.ref`, then `DEFAULT_SANDBOX_IMAGE`. `runSandbox` resolves a ref only when `--image` or `--image=<ref>` is present.
- A no-checkout install writes `image.mode` `"image"` and no `image.ref`. Compose then falls back to `${AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}` in `.devcontainer/docker-compose.image-only.yml`.
- A `--checkout` install for a directory without `.devcontainer/Dockerfile` writes `DEFAULT_SANDBOX_IMAGE` into `image.ref` (`sandbox.ts:270-276`).
- `runSandboxInstall` persists `--image=<ref>` into `image.ref` (`sandbox.ts:266-268`). `renderComposeVars` renders `image.ref` as `AGRO_SANDBOX_IMAGE` into the env file that every compose verb reads. A persisted pin therefore reaches `agro start` and `agro restart` today.
- The CLI version is `VERSION` in `.agro/cli/src/cli.ts:78`. `build.mjs` defines `__AGRO_VERSION__` from `.agro/cli/package.json`. Without the define, as under vitest, `VERSION` is `0.0.0-dev`.
- The global `--version` flag matches only the first argv token (`cli.ts:1341`). A `--version` after `sandbox install docker` does not collide with the global flag.
- The release workflow publishes `ghcr.io/mifunedev/agro:<version>` for each release (`.github/workflows/release.yml:190`).
- `--print-argv` returns before the `image mode: <ref>` line, so the install prints no selected ref today.

Selected approach:

1. Move `VERSION` to the new module `.agro/cli/src/lib/sandbox-image.ts` as `CLI_VERSION`. Add `officialImageRef(version)` and `defaultSandboxImage(version = CLI_VERSION)`. `defaultSandboxImage` returns the versioned ref when the version matches `^\d+\.\d+\.\d+$`, else the `latest` ref. Delete `DEFAULT_SANDBOX_IMAGE`.
2. In `renderComposeVars`, render `AGRO_SANDBOX_IMAGE` as `image.ref`. When `image.ref` is empty and `image.mode` is `"image"`, render `defaultSandboxImage()`. The build-mode compose file uses `AGRO_SANDBOX_IMAGE` as the local build tag, so build mode gets no default.
3. Delete the `--checkout` install branch that writes the default into `image.ref`. The render step supplies the default at each run.
4. Parse `--version <X.Y.Z>` and `--version=<X.Y.Z>` in `parseSandboxArgs`. Map the value to `imageRef = officialImageRef(value)` and `image = true`. The existing install path persists the value. Reject `--version` together with `--image=<ref>`. Accept `--version` together with a bare `--image`.
5. In `runSandbox`, print `image mode: <ref>` in `--print-argv` mode. The ref is the child-env ref. When the child env holds no ref, the ref is the `AGRO_SANDBOX_IMAGE` value that `renderComposeVars` renders for the entry. When neither holds a ref, print no line.
6. Update help, docs, the probe, and the changelog.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/cli.ts` | `VERSION`, `parseSandboxArgs`, `SandboxArgs`, `printSandboxHelp` | Import `CLI_VERSION`. Parse and validate `--version`. Reject `--version` with `--image=<ref>`. Update help text. |
| `.agro/cli/src/lib/sandbox-image.ts` (new) | `CLI_VERSION`, `officialImageRef`, `defaultSandboxImage` | Own the version and the official image repository `ghcr.io/mifunedev/agro`. |
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox` | Delete the constant. Use `defaultSandboxImage()`. Print the ref in `--print-argv` mode. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall` | Delete the branch that writes the default into `image.ref`. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars` | Render the default ref for image mode when `image.ref` is empty. |
| `.agro/evals/probes/agro-sandbox-image-mode.sh` | `DEFAULT_SANDBOX_IMAGE` grep checks | Replace the constant checks with checks for `defaultSandboxImage`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --version <X.Y.Z>` | New | Pin `ghcr.io/mifunedev/agro:<X.Y.Z>`. Persist the ref in `image.ref`. |
| `agro sandbox install docker --image[=<ref>]` | Modify | The bare `--image` default becomes `ghcr.io/mifunedev/agro:<CLI version>`. `--image=<ref>` conflicts with `--version`. |
| `agro sandbox install docker --print-argv` | Modify | Print `image mode: <ref>` for the child-env ref or the rendered ref. |
| `agro sandbox --help` | Modify | List `--version` and the version-derived default. |
| `docs/deployment-prebuilt-image.md`, `docs/configuration.md`, `docs/installation.md`, `docs/lifecycle-commands.md`, `.agro/cli/README.md` | Modify | Show `--version` as the release pin. State the default. |
| `CHANGELOG.md` | Modify | Add one `## [Unreleased]` entry. |
| `mifunedev/agro-web` | Follow-up | Public docs mirror the flag and the default. See Open Questions. |

## Storage

- **Persistence layer:** the sandbox entry file `${AGRO_HOME:-~/.agro}/sandboxes/<name>/agro.json`.
- **Location / schema:** the existing `image.ref` string and `image.mode` fields. The schema does not change.
- **Pattern:** follow the existing `--image=<ref>` persistence in `runSandboxInstall`. Store only an explicit pin (`--version` or `--image=<ref>`) or a seeded `image.ref`. Never store the default.

## Architectural Decisions

- **Source of truth:** `defaultSandboxImage()` is the only definition of the default ref. `CLI_VERSION` is the only runtime copy of the CLI version. A stored `image.ref` wins over the default.
- **State management:** the default resolves at each render, not at install. A CLI upgrade therefore moves an unpinned image-mode sandbox to the new CLI version at the next `agro start` or `agro restart`. A pinned sandbox keeps its `image.ref`.
- **Precedence:** `--image=<ref>` or `--version` > `AGRO_SANDBOX_IMAGE` > `image.ref` > `defaultSandboxImage()`. The compose fallback `ghcr.io/mifunedev/agro:latest` in `docker-compose.image-only.yml` stays as a last resort for a direct `docker compose` call.
- **Validation:** `--version` accepts only `X.Y.Z` with decimal digits. `--version` does not accept a `v` prefix, `latest`, or a pre-release suffix. `--image=<ref>` stays the path for any other tag.
- **Auth / scoping:** N/A. The change adds no credential and no network call.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/sandbox-image.test.ts` (new) | `returns the versioned ref for X.Y.Z`; `returns latest for 0.0.0-dev, a pre-release, and an empty version` | `defaultSandboxImage` and `officialImageRef` |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | `renders the default ref for image mode without image.ref`; `renders no AGRO_SANDBOX_IMAGE for build mode without image.ref`; replace `image-only compose falls back to ...:latest` only if the compose file changes | Render-time default |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | replace `unselected --image fallback is ghcr.io/mifunedev/agro:latest` with a `defaultSandboxImage()` case; update the bare `--image` case at line 437; add `parses --version=0.13.0 and --version 0.13.0`; add `rejects an empty, v-prefixed, latest, and two-part --version`; add `rejects --version with --image=<ref>`; add `--print-argv prints the image mode line for an explicit ref and for the rendered default` | Parser and `runSandbox` |
| `.agro/cli/src/__tests__/sandbox.test.ts` | replace the case at line 600 with `writes no image.ref for a non-build checkout and renders the default`; add `persists --version into image.ref and the rendered env file`; update `leaves the no-checkout image-only path without an image.ref` to assert the rendered default | Install persistence |
| `.agro/evals/probes/agro-sandbox-image-mode.sh` | replace the `DEFAULT_SANDBOX_IMAGE` greps | Probe stays green |

Write each case before its implementation. Run `npm test` and `npm --prefix .agro/cli run typecheck` from the repository root.

## Design Principles

- Follow the root `AGENTS.md`. Add no explanatory comments to tracked code.
- Keep one definition of the official image repository and one definition of the default ref.
- Reuse the existing `imageRef` path for `--version`. Add no new config field.
- Store only an explicit pin. Resolve the default at render time.
- Write the failing test before the implementation.

## Out of Scope

- A change to the release workflow, the image tags, or the `latest` promotion.
- `--version` on `agro start`, `agro restart`, or `agro config set`.
- Pre-release, `sha-<sha>`, or `v`-prefixed tags through `--version`.
- A migration that rewrites an existing `image.ref` of `ghcr.io/mifunedev/agro:latest` in existing entries.
- The `mifunedev/agro-web` edit itself.
- Edits to `.agro/knowledge/source/*.md` snapshots.

## Open Questions

1. Does `mifunedev/agro-web` need a matching doc change in this pull request cycle, or in a follow-up issue?
2. Existing `--checkout` entries hold `image.ref` `ghcr.io/mifunedev/agro:latest` from the deleted install branch. Those entries stay on `latest`. Does the operator accept this, or does the operator want a follow-up migration?
3. Does the operator accept that an unpinned image-mode sandbox moves to the new CLI version after `agro update` at the next `agro start`?

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`. The stdout holds `image mode: ghcr.io/mifunedev/agro:0.13.0`.
- [ ] After `npm --prefix .agro/cli run build`, `node .agro/cli/dist/agro.js sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`, where `<CLI version>` is the output of `node .agro/cli/dist/agro.js --version`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/agro-sandbox-image-mode.sh` exits 0.
- [ ] CI is green on the pull request `FROM feat/<issue#>-sandbox-install-version TO development`.

## Lessons

Filled by the advisor before undraft.
