# PRD: Sandbox install --version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my CLI version so that each sandbox runs a known release.

**Acceptance Criteria:**

- [ ] `defaultSandboxImage("0.13.0")` returns `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `defaultSandboxImage("0.0.0-dev")` returns `ghcr.io/mifunedev/agro:latest`.
- [ ] `defaultSandboxImage("1.2")` returns `ghcr.io/mifunedev/agro:latest`.
- [ ] A bare `--image` without `image.ref` and without `AGRO_SANDBOX_IMAGE` selects `defaultSandboxImage(<CLI version>)` in `runSandbox`.
- [ ] `agro sandbox install docker --yes --print-argv` without `--checkout` prints an argv whose environment carries `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] A no-checkout entry without `image.ref` renders `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:<CLI version>` for `agro start` and `agro restart`.
- [ ] `agro sandbox install` with `--checkout` and `image.mode` set to `image` writes no default `image.ref` into the entry `agro.json`.

### US-002: Parse and persist the --version flag

**Description:** As an operator, I want to pass `--version=0.13.0` so that I pin an official release quickly.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0"])` returns `imageRef` equal to `ghcr.io/mifunedev/agro:0.13.0` and `image` equal to `true`.
- [ ] `parseSandboxArgs(["install", "docker", "--version", "0.13.0"])` returns the same result as the `--version=0.13.0` form.
- [ ] `parseSandboxArgs` returns `ok: false` with an error that names `--version` for the values `latest`, `v0.13.0`, `0.13`, and the empty string.
- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0", "--image=my/img:1"])` returns `ok: false` with an error that names both flags.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry under the sandboxes directory.
- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` prints an argv whose environment carries `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --version=0.13.0 --yes` writes `image.ref` equal to `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` equal to `image`.
- [ ] After that install, the rendered env file for `agro start` and `agro restart` carries `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --version=0.13.0` does not print the top-level CLI version.

### US-003: Document --version as the release pin

**Description:** As an operator, I want the docs to show `--version` so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `agro sandbox --help` lists `--version <X.Y.Z>` and states the conflict with `--image=<ref>`.
- [ ] `agro sandbox --help` names the CLI version as the default tag and `latest` as the fallback tag.
- [ ] The "Pinning an image ref" section of `docs/deployment-prebuilt-image.md` shows `agro sandbox install docker --version=<X.Y.Z>` as the release pin.
- [ ] The "Which image ref wins" tree in `docs/deployment-prebuilt-image.md` shows the CLI-version default in place of `latest`.
- [ ] The `agro sandbox install` rows in `.agro/cli/README.md` and `docs/lifecycle-commands.md` list `--version <X.Y.Z>`.
- [ ] `CHANGELOG.md` has an entry for the `--version` flag and the new default tag.

## Summary

Verified current state:

- `DEFAULT_SANDBOX_IMAGE` in `.agro/cli/src/commands/lifecycle.ts` holds the constant `ghcr.io/mifunedev/agro:latest`.
- `runSandbox` resolves the image ref in this order: `--image=<ref>`, then `configuredImage(root)`, then `DEFAULT_SANDBOX_IMAGE`.
- `parseSandboxArgs` in `.agro/cli/src/cli.ts` parses `--image` and `--image=<ref>` into `image` and `imageRef`.
- `runSandboxInstall` in `.agro/cli/src/commands/sandbox.ts` writes `image.ref` from `opts.imageRef`.
- `runSandboxInstall` also writes `DEFAULT_SANDBOX_IMAGE` into `image.ref` when the entry has a checkout, `image.mode` is `image`, and no ref exists.
- `.agro/cli/src/lib/config-render.ts` writes `AGRO_SANDBOX_IMAGE` from `config.image?.ref` only.
- `.devcontainer/docker-compose.image-only.yml` falls back to `ghcr.io/mifunedev/agro:latest` when `AGRO_SANDBOX_IMAGE` is empty.
- `cli.ts` reads the CLI version from the build define `__AGRO_VERSION__`. The fallback value is `0.0.0-dev`. `build.mjs` sets the define from `.agro/cli/package.json`.

Selected approach:

1. Add `defaultSandboxImage(version)`. The function returns `ghcr.io/mifunedev/agro:<version>` when `version` matches `^\d+\.\d+\.\d+$`. Otherwise the function returns `ghcr.io/mifunedev/agro:latest`.
2. Replace each run-time use of `DEFAULT_SANDBOX_IMAGE` with `defaultSandboxImage(<CLI version>)`.
3. Add `--version <X.Y.Z>` and `--version=<X.Y.Z>` to `parseSandboxArgs`. The parser maps the value to `imageRef` equal to `ghcr.io/mifunedev/agro:<X.Y.Z>`. The existing `imageRef` path then persists the pin and implies `--no-build`.
4. The parser rejects `--version` together with `--image=<ref>`. The parser rejects each value outside the plain `X.Y.Z` release form.
5. Remove the install-time write of the default ref. The entry stores `image.ref` only for an explicit pin.
6. Render the CLI-version default into the env file when the entry has no `image.ref` and runs the prebuilt image.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox`, `configuredImage` | Holds the default ref and resolves the ref for `--image`. |
| `.agro/cli/src/cli.ts` | `VERSION`, `parseSandboxArgs`, `SANDBOX_VALUE_FLAGS`, `printSandboxHelp`, `isVersionFlag` call site | Parses the new flag, owns the CLI version, prints help. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall`, `DEFAULT_SANDBOX_IMAGE` import | Persists the explicit pin and drops the default-ref write. |
| `.agro/cli/src/lib/config-render.ts` | `AGRO_SANDBOX_IMAGE` put | Renders the image ref that `agro start` and `agro restart` use. |
| `.devcontainer/docker-compose.image-only.yml` | `image:` fallback | Keeps `latest` as the last fallback when no env value exists. |
| `.agro/cli/build.mjs` | `__AGRO_VERSION__` define | Supplies the CLI version at build time. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install` flags | Added | `--version <X.Y.Z>` and `--version=<X.Y.Z>` select the official image at that tag. |
| `agro sandbox install` flags | Validation | `--version` with `--image=<ref>` exits 1. A non-`X.Y.Z` value exits 1. |
| Default image ref | Changed | The default tag becomes the CLI version. A non-release CLI version falls back to `latest`. |
| Entry `agro.json` `image.ref` | Changed | The install writes `image.ref` only for an explicit pin. |
| `agro sandbox --help` | Changed | The help text documents `--version` and the new default. |

## Storage

The entry `agro.json` under the sandboxes directory keeps the existing `image.ref` and `image.mode` keys. No schema change occurs. A `--version` pin writes the full ref `ghcr.io/mifunedev/agro:<X.Y.Z>` into `image.ref`, the same as `--image=<ref>`. Existing entries keep their stored `image.ref` values unchanged.

## Architectural Decisions

- `defaultSandboxImage` is the single source of truth for the default ref. No other file hard-codes the CLI-version tag.
- The CLI version comes from `__AGRO_VERSION__`. The function takes the version as an argument, so tests pass fixed versions.
- `--version` reuses the `imageRef` path. No new option travels past `parseSandboxArgs`.
- The stored pin wins over the default. The resolution order becomes: `--image=<ref>` or `--version`, then `AGRO_SANDBOX_IMAGE`, then `image.ref`, then `defaultSandboxImage(<CLI version>)`.
- The compose `latest` fallback stays as the last guard for a wrapper call without the CLI.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `defaultSandboxImage` for `0.13.0`, `0.0.0-dev`, `1.2`; bare `--image` default replaces the `latest` assertion | US-001 default ref |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `parseSandboxArgs` for both `--version` forms, invalid values, and the `--image=<ref>` conflict | US-002 parsing |
| `.agro/cli/src/__tests__/sandbox.test.ts` | `--version=0.13.0 --print-argv`; `--version=0.13.0` writes `image.ref`; conflict writes no entry; checkout install writes no default ref | US-001 and US-002 install path |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Entry without `image.ref` renders the CLI-version default; stored ref renders unchanged | US-001 and US-002 start and restart |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | Help text contains `--version <X.Y.Z>` | US-003 help |

Write each case red first. Run `npm test` and `npm run typecheck` from the repository root. Both commands must exit 0.

## Design Principles

- Keep one source of truth for the default ref.
- Reuse the existing `imageRef` path instead of a parallel option.
- Store only operator decisions. A default stays a default.
- Add no comments to tracked code.
- Run all build and test work inside the sandbox.

## Out of Scope

- Changes to the release workflow or to the GHCR tag scheme.
- Migration of existing entries that store `ghcr.io/mifunedev/agro:latest`.
- Removal of `--image=<ref>` for custom images.
- A `--version` flag on `agro start` or `agro restart`.
- Public documentation changes in the mifunedev agro-web repository.

## Open Questions

1. Does `agro start` render the env file through `config-render.ts` for a no-checkout entry? The implementer confirms the call path before US-001 adds the render default.
2. Does the top-level `isVersionFlag` check read only the first argument? If the check reads any argument, `agro sandbox install docker --version=0.13.0` prints the CLI version today.
3. Does vitest define `__AGRO_VERSION__`? If not, the CLI version in tests is `0.0.0-dev`, and tests must inject the version.
4. Does the mifunedev agro-web repository need a matching docs change? The operator decides.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
