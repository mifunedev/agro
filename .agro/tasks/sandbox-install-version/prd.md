# PRD: Pin the official sandbox image by version

Status: DRAFT

## User Stories

### US-001: Default the official image tag to the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] If `version` matches `^[0-9]+\.[0-9]+\.[0-9]+$`, the function `officialImageRef(version)` returns `ghcr.io/mifunedev/agro:<version>`.
- [ ] `officialImageRef(version)` returns `ghcr.io/mifunedev/agro:latest` for `0.0.0-dev` and for each prerelease version, such as `0.14.0-rc.1`.
- [ ] Library code reads the CLI version from one shared module. `cli.ts` imports the version from that module, and `agro --version` still prints the bare version.
- [ ] Each use site in `lifecycle.ts` and `sandbox.ts` calls `officialImageRef(<CLI version>)` in place of `DEFAULT_SANDBOX_IMAGE`.
- [ ] A bare `agro sandbox install docker --image` with no configured `image.ref` runs `ghcr.io/mifunedev/agro:<CLI version>`. A `lifecycle.test.ts` case proves the `AGRO_SANDBOX_IMAGE` value.
- [ ] For a sandbox that runs the prebuilt image and has no `image.ref`, the rendered compose env file sets `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:<CLI version>`. A `config-render.test.ts` case proves the value.
- [ ] For a build-mode sandbox with no `image.ref`, the rendered compose env file does not set `AGRO_SANDBOX_IMAGE`.
- [ ] `npm test` exits 0 and `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add `--version` to `agro sandbox install`

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I can pin an official release without typing the full image ref.

**Acceptance Criteria:**

- [ ] The parser accepts `--version=<X.Y.Z>` and `--version <X.Y.Z>` after `sandbox install`.
- [ ] The parser removes one leading `v`, so `--version=v0.13.0` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] If the value does not match `^v?[0-9]+\.[0-9]+\.[0-9]+$`, the command exits 1 with an error that names the value and the expected form `X.Y.Z`.
- [ ] If `--version` has no value, the command exits 1 with `agro sandbox install: --version requires a value`.
- [ ] If the operator passes `--version` together with `--image=<ref>`, the command exits 1 with an error that names both flags. The command writes no sandbox entry.
- [ ] The parser accepts `--version` together with a bare `--image`. The install then selects `ghcr.io/mifunedev/agro:<X.Y.Z>`.
- [ ] `--version` selects image mode and implies `--no-build`, the same as `--image=<ref>`.
- [ ] `--version` overrides `image.ref` in the entry `agro.json`, `image.ref` in the checkout `agro.json`, and `AGRO_SANDBOX_IMAGE`.
- [ ] `agro --version` and `agro -v` as the first argument still print the CLI version.
- [ ] `agro sandbox --help` lists `--version <X.Y.Z>` and describes `--image=<ref>` as the flag for a custom image.
- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` prints a compose argv whose env selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `npm test` exits 0 and `npm --prefix .agro/cli run typecheck` exits 0.

### US-003: Persist explicit version pins

**Description:** As an operator, I want an install-time pin to persist so that `agro start` and `agro restart` keep the same release.

**Acceptance Criteria:**

- [ ] After `agro sandbox install docker --version=0.13.0 --yes`, the entry `agro.json` holds `image.ref` = `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` = `image`.
- [ ] After an install with no `--version` and no `--image=<ref>`, the entry `agro.json` holds no `image.ref` that the install added. The default tag follows the CLI version at each later start.
- [ ] A re-install of an existing entry with a new `--version` value replaces the stored `image.ref`.
- [ ] `sandbox.test.ts` holds one case for each of the three criteria above.
- [ ] `npm test` exits 0.

### US-004: Document version pinning

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` lists `[--version <X.Y.Z>]` in the `agro sandbox install` row.
- [ ] `docs/deployment-prebuilt-image.md` states that the default tag is the CLI version, shows `agro sandbox install docker --version=0.13.0`, and keeps `--image=<ref>` for custom images.
- [ ] `docs/deployment-prebuilt-image.md` states the resolution order: `--version` or `--image=<ref>`, then `image.ref` or `AGRO_SANDBOX_IMAGE`, then `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `docs/configuration.md` gives the `image.ref` default as `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `docs/installation.md` and `docs/quickstart.md` no longer state that a sandbox without `--checkout` runs `ghcr.io/mifunedev/agro:latest`.
- [ ] `CHANGELOG.md` holds an entry for the new flag and the new default.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 for each changed file under `docs/`.

## Summary

Verified current state:

- `agro sandbox install docker --image=ghcr.io/mifunedev/agro:0.13.0` pins a release today. The operator must type the full image ref.
- `DEFAULT_SANDBOX_IMAGE` is `ghcr.io/mifunedev/agro:latest` in `.agro/cli/src/commands/lifecycle.ts:105`.
- If `AGRO_SANDBOX_IMAGE` is empty, `.devcontainer/docker-compose.image-only.yml` falls back to `ghcr.io/mifunedev/agro:latest`.
- If `image.ref` has no value, `config-render.ts` does not write `AGRO_SANDBOX_IMAGE`. A sandbox without `--checkout` and without `image.ref` therefore runs `latest` at each start.
- The release workflow pushes the immutable tags `ghcr.io/mifunedev/agro:<X.Y.Z>` and `sha-<full SHA>`. The tag has no `v` prefix. If the image `agro --version` differs from the release version, the workflow fails. Each released CLI therefore has an image tag with the same version.
- The CLI reads the global `--version` flag only as the first argument (`cli.ts:1341`). A `--version` flag after `sandbox install` does not collide with the global flag.
- The CLI version comes from `__AGRO_VERSION__`, which `build.mjs` injects from `.agro/cli/package.json`. If the CLI runs from source without `build.mjs`, the CLI version is `0.0.0-dev`.

Selected approach: add `--version <X.Y.Z>` for the official image, keep `--image=<ref>` for custom images, and change the default tag from `latest` to the CLI version. Persist only explicit pins.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/cli.ts` | `VERSION`, `SANDBOX_VALUE_FLAGS`, sandbox argument parser, `printSandboxHelp` | Parse `--version`, reject the conflict, print help. |
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox`, `configuredImage` | Resolve the image ref. |
| `.agro/cli/src/commands/sandbox.ts` | `SandboxInstallOptions`, install flow near `config.image` | Store an explicit pin in the entry `agro.json`. |
| `.agro/cli/src/lib/config-render.ts` | env render, `AGRO_SANDBOX_IMAGE` | Emit the default ref for a sandbox that runs the prebuilt image. |
| `.agro/cli/src/lib/<version module>` | `AGRO_VERSION`, `officialImageRef` | One shared source for the CLI version and the official ref. |
| `.devcontainer/docker-compose.image-only.yml` | `image:` fallback | Unchanged. The CLI always sets the value for the prebuilt-image path. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | New flag | `--version <X.Y.Z>` selects `ghcr.io/mifunedev/agro:<X.Y.Z>`. |
| `agro sandbox install` | Changed default | The default image tag is the CLI version instead of `latest`. |
| `agro sandbox --help` | Text | Documents `--version` and the new default. |
| `agro.json` `image.ref` | Changed default | The effective default is `ghcr.io/mifunedev/agro:<CLI version>`. |
| `mifunedev/agro-web` | Docs | The public install docs need the same change. This task does not change `mifunedev/agro-web`. |

## Storage

The entry `agro.json` under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/` stores an explicit pin in the existing `image.ref` key. The schema does not change. The install does not store the default ref, so a CLI upgrade moves an unpinned sandbox to the matching image at the next start.

## Architectural Decisions

- `image.ref` stays the only stored image setting. `--version` is a short form of `--image=<ref>` for the official image. The install converts the `--version` value to a full ref before the install stores the ref. No `image.version` key exists.
- The CLI version is the source of truth for the default tag. The release workflow guarantees a matching image tag for each released CLI.
- If the CLI version is not a plain `X.Y.Z` release, the default ref uses `latest`. No image tag exists for that CLI version.
- `--version` and `--image=<ref>` both choose the image. The CLI rejects the pair and selects neither flag.
- The new default applies only to the prebuilt-image path. A build-mode sandbox keeps its behavior.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/<version module>.test.ts` | release version, `0.0.0-dev`, prerelease | `officialImageRef` output. |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | bare `--image` with no config; explicit `--image=<ref>` | The default ref uses the CLI version. An explicit ref overrides the default ref. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | prebuilt-image mode without `image.ref`; build mode without `image.ref` | The env file default ref. Build mode writes no `AGRO_SANDBOX_IMAGE`. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version=0.13.0`, `--version v0.13.0`, bad value, missing value, `--version` with `--image=<ref>`, `--version` with bare `--image`, persisted pin, re-install replaces pin, no pin without flag | Parser, conflict, and storage. |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | `agro --version` first argument | The global version flag keeps its behavior. |

Run `npm test` and `npm --prefix .agro/cli run typecheck` from the repository root.

## Design Principles

- Keep one stored image setting: `image.ref`.
- Keep `--image=<ref>` as the only path for a custom image.
- Make the default reproducible without an operator action.
- Add no comments to tracked code. Express intent through names and tests.

## Out of Scope

- A change to `agro update` or to the self-upgrade flow.
- A change to the release workflow or to the `latest` promotion.
- Removal of the `latest` fallback in `docker-compose.image-only.yml`.
- A `--version` flag on other lifecycle verbs.
- The change to `mifunedev/agro-web`. The advisor tracks that change in a separate pull request in `mifunedev/agro-web`.

## Open Questions

None.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
