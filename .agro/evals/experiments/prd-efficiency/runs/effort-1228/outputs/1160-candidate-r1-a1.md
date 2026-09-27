# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] A unit test proves that a CLI version `0.13.0` gives the default ref `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] A unit test proves that a CLI version `0.0.0-dev` or `0.14.0-rc.1` gives the default ref `ghcr.io/mifunedev/agro:latest`.
- [ ] `agro sandbox install docker --yes --print-argv` without `--checkout` prints `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:<CLI version>` or an argv that selects that ref.
- [ ] The existing test "unselected --image fallback" in `.agro/cli/src/__tests__/lifecycle.test.ts` asserts the version-derived ref.

### US-002: Add the --version flag to sandbox install

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I can pin an official release without the full image ref.

**Acceptance Criteria:**

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --version 0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1, prints an error that names both flags, and writes no entry.
- [ ] `agro sandbox install docker --version=latest` exits 1 with an error that asks for an `X.Y.Z` value.
- [ ] `agro sandbox --help` lists `--version <X.Y.Z>`.

### US-003: Persist an explicit pin

**Description:** As an operator, I want an install-time pin to persist so that `agro start` and `agro restart` keep the same release.

**Acceptance Criteria:**

- [ ] A test proves that `--version=0.13.0` writes `image.ref` = `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` = `image` to the entry `agro.json`.
- [ ] A test proves that an install without `--version` and without `--image=<ref>` writes no `image.ref` for the no-checkout path.
- [ ] A test proves that the entry keeps the pinned `image.ref` after a recycle of the same entry.

### US-004: Document the --version flag

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `docs/deployment-prebuilt-image.md` shows `agro sandbox install docker --version=<X.Y.Z>` as the release pin recipe.
- [ ] `docs/deployment-prebuilt-image.md`, `docs/configuration.md`, and `docs/installation.md` state that the default tag equals the CLI version.
- [ ] `.agro/cli/README.md` lists `--version <X.Y.Z>` in the `agro sandbox install <runtime>` row.

## Summary

Verified current state:

- `.agro/cli/src/commands/lifecycle.ts:105` sets `DEFAULT_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest"`.
- `.agro/cli/src/commands/lifecycle.ts:167` resolves the image ref as `opts.imageRef ?? configuredImage(root) ?? DEFAULT_SANDBOX_IMAGE`.
- `.agro/cli/src/commands/sandbox.ts:266` writes `image.ref` for `--image=<ref>`. `.agro/cli/src/commands/sandbox.ts:275` writes `DEFAULT_SANDBOX_IMAGE` for a checkout without a Dockerfile.
- `.agro/cli/src/cli.ts:937` parses `--image` and `--image=<ref>`. `.agro/cli/src/cli.ts:78` holds `VERSION` from the build define `__AGRO_VERSION__` in `.agro/cli/build.mjs:39`. The fallback is `0.0.0-dev`.
- `.devcontainer/docker-compose.image-only.yml:5` falls back to `ghcr.io/mifunedev/agro:latest` when `AGRO_SANDBOX_IMAGE` is empty.

Selected approach: add one pure function that maps the CLI version to the default ref. The function returns `ghcr.io/mifunedev/agro:<X.Y.Z>` for a plain `X.Y.Z` version and `ghcr.io/mifunedev/agro:latest` otherwise. The parser maps `--version <X.Y.Z>` to `imageRef` = `ghcr.io/mifunedev/agro:<X.Y.Z>`, so the existing `--image=<ref>` persistence path stores the pin. The install stores only an explicit pin in `image.ref`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox` | Replace the constant with a version-derived default ref. |
| `.agro/cli/src/cli.ts` | `VERSION`, sandbox argument parser, `printSandboxHelp` | Parse `--version`, reject the conflict with `--image=<ref>`, and update help. |
| `.agro/cli/src/commands/sandbox.ts` | install flow near lines 220-290 | Persist the pin through `imageRef`. Keep the checkout fallback at line 275 on the derived default. |
| `.devcontainer/docker-compose.image-only.yml` | `AGRO_SANDBOX_IMAGE` fallback | The CLI must export the derived ref, so that the compose fallback to `latest` does not apply. |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | default image tests near line 496 | Update the default ref assertions. |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--print-argv` and `image.ref` tests | Add the `--version` and conflict cases. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --version <X.Y.Z>` | New flag | Selects `ghcr.io/mifunedev/agro:<X.Y.Z>` and persists the pin. |
| `agro sandbox install` default image | Behavior change | The default tag equals the CLI version for a plain `X.Y.Z` release. |
| `agro sandbox --help` | Text change | Lists `--version <X.Y.Z>` and the new default. |
| `mifunedev/agro-web` | Docs | Mirror the `--version` recipe. |

## Storage

The entry file `${AGRO_HOME:-~/.agro}/sandboxes/<name>/agro.json` stores the pin in the existing `image.ref` field. The schema does not change.

## Architectural Decisions

- One pure function owns the version-to-ref mapping. `cli.ts`, `lifecycle.ts`, and `sandbox.ts` call that function.
- `--version` is sugar for `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`. One persistence path serves both flags.
- The resolution order stays `--image=<ref>` or `--version` > `AGRO_SANDBOX_IMAGE` > `image.ref` > the derived default.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | release version, prerelease version, `0.0.0-dev` | US-001 mapping |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--print-argv` default ref without checkout | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version=0.13.0`, `--version 0.13.0`, conflict with `--image=<ref>`, invalid value | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | pin writes `image.ref`, no pin writes no `image.ref`, recycle keeps the pin | US-003 |
| `npm test`, `npm --prefix .agro/cli run typecheck` | full suite | Regression floor |

## Design Principles

- Keep one source of truth for the default ref.
- Reuse the `--image=<ref>` persistence path. Add no new config field.
- Add no explanatory comments to tracked code.

## Out of Scope

- A change to the release workflow or to the published tags.
- A `--version` flag on `agro start` or `agro restart`.
- Migration of an existing entry that stores `ghcr.io/mifunedev/agro:latest`.

## Open Questions

1. `isVersionFlag` in `.agro/cli/src/cli.ts:105` handles the global `--version`. The implementation owner must confirm that `agro sandbox install docker --version=0.13.0` reaches the sandbox parser and does not print the CLI version.
2. The issue does not state whether `--version` with a bare `--image` is a conflict. This plan accepts that pair and treats `--version` as the ref.
3. The issue does not state whether `.agro/scripts/sandbox-upgrade-smoke.sh:34` keeps `SEED_IMAGE` on `latest`. This plan keeps that value.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
