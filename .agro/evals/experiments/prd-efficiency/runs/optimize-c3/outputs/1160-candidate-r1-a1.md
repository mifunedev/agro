# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my CLI version so that each sandbox runs a known release.

**Acceptance Criteria:**

- [ ] A new function `defaultSandboxImage(version)` in `.agro/cli/src/commands/lifecycle.ts` returns `ghcr.io/mifunedev/agro:0.13.0` for the input `0.13.0`.
- [ ] `defaultSandboxImage` returns `ghcr.io/mifunedev/agro:latest` for the inputs `0.0.0-dev`, `1.2`, and `1.2.3-rc.1`.
- [ ] Each caller of `DEFAULT_SANDBOX_IMAGE` in `.agro/cli/src/commands/lifecycle.ts` and `.agro/cli/src/commands/sandbox.ts` uses the version-derived default.
- [ ] With a CLI version of `0.13.0`, `agro sandbox install docker --yes --print-argv` without a checkout prints `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`.
- [ ] A default install writes no `image.ref` field to the registry entry.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the --version flag to sandbox install

**Description:** As an operator, I want a `--version` flag so that I pin an official release without the full image ref.

**Acceptance Criteria:**

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --version 0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] The global version check at `.agro/cli/src/cli.ts:106` does not consume `--version` after the `sandbox` verb.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no registry entry.
- [ ] `agro sandbox install docker --version=latest` exits 1 with an error that names the `X.Y.Z` form.
- [ ] After `agro sandbox install docker --version=0.13.0`, the registry entry holds `image.ref` equal to `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] After that install, `agro restart <name> --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] The `agro sandbox` help text at `.agro/cli/src/cli.ts:292` lists `--version <X.Y.Z>`.

### US-003: Document the --version pin

**Description:** As an operator, I want the docs to show the `--version` pin so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `docs/deployment-prebuilt-image.md` shows `agro sandbox install docker --version=<X.Y.Z>` as the release pin.
- [ ] `docs/deployment-prebuilt-image.md` keeps `--image=<ref>` for custom images only.
- [ ] `docs/lifecycle-commands.md` lists `--version <X.Y.Z>` in the `agro sandbox install` row.
- [ ] The `image.ref` row in `docs/configuration.md` states the CLI-version default and states that only an explicit pin writes the field.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/deployment-prebuilt-image.md` reports no finding on a changed line.

## Summary

The default image ref is the constant `DEFAULT_SANDBOX_IMAGE` at `.agro/cli/src/commands/lifecycle.ts:105`, with the value `ghcr.io/mifunedev/agro:latest`. The CLI version is `VERSION` at `.agro/cli/src/cli.ts:78`. The build injects `__AGRO_VERSION__` from `.agro/cli/package.json` through `.agro/cli/build.mjs`. Unbuilt test runs see `0.0.0-dev`. The flag parser at `.agro/cli/src/cli.ts:937` handles `--image` and `--image=<ref>`. The install at `.agro/cli/src/commands/sandbox.ts:266` writes `opts.imageRef` to `image.ref`. The install at `.agro/cli/src/commands/sandbox.ts:271` also writes the default ref for a checkout in image mode.

The change derives the default tag from `VERSION` and falls back to `latest` for a non-release version. The parser maps `--version <X.Y.Z>` to the official `imageRef`. The existing `imageRef` path persists the pin. The install stops writing the default ref.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox`, `configuredImage` | Default ref and run-time image resolution |
| `.agro/cli/src/cli.ts` | `VERSION`, sandbox flag parser near line 937, help text near line 292 | Version source, `--version` flag, help |
| `.agro/cli/src/commands/sandbox.ts` | install flow near lines 225 and 266 | Persists an explicit pin, stops the default write |
| `.devcontainer/docker-compose.image-only.yml` | `AGRO_SANDBOX_IMAGE` fallback | Last-resort fallback, unchanged |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` | New flag | `--version <X.Y.Z>` and `--version=<X.Y.Z>` select `ghcr.io/mifunedev/agro:<X.Y.Z>` |
| `agro sandbox install` | New error | `--version` with `--image=<ref>` exits 1 |
| Default image ref | Behavior change | The tag equals the CLI version for a release build |

## Storage

The registry entry in the operator state file keeps the `image.ref` key that `.agro/cli/src/lib/agro-config.ts` declares. The schema does not change. An explicit `--version` or `--image=<ref>` writes the key. A default install writes no key.

## Architectural Decisions

- `VERSION` stays the one source of the CLI version. Move the declaration to a new file `.agro/cli/src/lib/version.ts` when `lifecycle.ts` cannot import `VERSION` from `cli.ts` without a cycle.
- `--version` is sugar for `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`. The downstream code sees only `imageRef`.
- The run-time default resolves on each `agro start` and `agro restart`. A CLI upgrade therefore moves an unpinned sandbox to the new release.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | Replace the `agro:latest` constant case near line 496 with `defaultSandboxImage` cases for release and non-release versions | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | The default install near line 612 writes no `image.ref`; the no-checkout print-argv output names the version tag | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version=0.13.0` and `--version 0.13.0` select the tag; the tag persists across a recycle | US-002 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version` with `--image=<ref>` exits 1 and writes no entry; `--version=latest` exits 1 | US-002 |

Run `npm test` and `npm --prefix .agro/cli run typecheck` from the repository root. Both commands must exit 0.

## Design Principles

- Keep one source of truth for the CLI version and for the image repository name.
- Store only operator intent. A default belongs to the code, not to the registry entry.
- Reuse the existing `imageRef` path. Add no second persistence path.
- Add no comments to tracked code.

## Out of Scope

- Changes to `.devcontainer/docker-compose.image-only.yml` or to the release workflow.
- Migration of registry entries that already hold `ghcr.io/mifunedev/agro:latest`.
- A `--version` flag on `agro start` or `agro restart`.

## Open Questions

1. Does the public site in mifunedev/agro-web document `--image=<ref>` as the release pin? If yes, the site needs a matching change.
2. An older install wrote `ghcr.io/mifunedev/agro:latest` to `image.ref` for a checkout in image mode. That entry stays on `latest`. Confirm that the operator accepts this result.
3. The global check at `.agro/cli/src/cli.ts:106` also matches `-v`. Confirm that `-v` after the `sandbox` verb keeps its current meaning.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
