# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag equals the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] A new module `.agro/cli/src/lib/version.ts` exports the CLI version. `cli.ts` imports the version from that module, and `cli.ts` no longer declares `__AGRO_VERSION__`.
- [ ] `defaultSandboxImage("0.13.0")` returns `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `defaultSandboxImage("0.0.0-dev")` and `defaultSandboxImage("0.14.0-rc.1")` return `ghcr.io/mifunedev/agro:latest`.
- [ ] `runSandbox` with `image: true`, no `image.ref`, and no `AGRO_SANDBOX_IMAGE` passes `AGRO_SANDBOX_IMAGE=<defaultSandboxImage()>` to the compose wrapper.
- [ ] For an entry with `image.mode` set to `"image"` and no `image.ref`, the rendered compose env file holds `AGRO_SANDBOX_IMAGE=<defaultSandboxImage()>`.
- [ ] `runSandboxInstall` with `checkout` set to a directory without `.devcontainer/Dockerfile` writes no `image.ref` to `agro.json`.
- [ ] `npx vitest run .agro/cli/src/__tests__/lifecycle.test.ts .agro/cli/src/__tests__/sandbox.test.ts .agro/cli/src/lib/__tests__/config-render.test.ts` exits 0.

### US-002: Add the `--version` install flag

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I can pin an official release without the full image ref.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0"])` and `parseSandboxArgs(["install", "docker", "--version", "0.13.0"])` both return `image: true` and `imageRef: "ghcr.io/mifunedev/agro:0.13.0"`.
- [ ] `parseSandboxArgs` returns `ok: false` for `--version=`, for `--version` with no value, and for `--version=latest`.
- [ ] `parseSandboxArgs(["install", "docker", "--version=0.13.0", "--image=my/img:1"])` returns `ok: false`, and the error names both flags.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry under `${AGRO_HOME:-~/.agro}/sandboxes/`.
- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` passes `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0` to the compose wrapper.
- [ ] After `runSandboxInstall` with `--version=0.13.0`, `agro.json` holds `image.ref` equal to `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` equal to `"image"`.
- [ ] `agro sandbox --help` lists `--version <X.Y.Z>` and states the conflict with `--image=<ref>`.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-003: Document `--version` as the release pin

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `docs/deployment-prebuilt-image.md` shows `agro sandbox install docker --version=<X.Y.Z>` as the release pin, and states that the default tag equals the CLI version.
- [ ] `docs/lifecycle-commands.md` and `.agro/cli/README.md` list `--version <X.Y.Z>` in the `agro sandbox install` flag list.
- [ ] `git grep -n "install docker --image=ghcr.io/mifunedev/agro:" -- docs .agro/cli/README.md` prints no line.

## Summary

The operator pins a release today with `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`.
`DEFAULT_SANDBOX_IMAGE` in `.agro/cli/src/commands/lifecycle.ts:105` holds `ghcr.io/mifunedev/agro:latest`.
`.devcontainer/docker-compose.image-only.yml:5` falls back to the same `latest` ref when `AGRO_SANDBOX_IMAGE` is empty.
The CLI version comes from the `__AGRO_VERSION__` define in `.agro/cli/build.mjs:39`.
`cli.ts:78` reads that define, and `0.0.0-dev` is the unbundled fallback.

`runSandboxInstall` in `.agro/cli/src/commands/sandbox.ts:270-276` writes `DEFAULT_SANDBOX_IMAGE` into `image.ref` for a checkout in image mode.
That write stores a default as a pin. The no-checkout path stores no `image.ref`, so `agro start` resolves the compose fallback `latest`.

The selected approach:

2. Replace the constant `DEFAULT_SANDBOX_IMAGE` with `defaultSandboxImage(version = VERSION)`. A plain `X.Y.Z` version gives the version tag. Any other version gives `latest`.
2. Replace the constant `DEFAULT_SANDBOX_IMAGE` with `defaultSandboxImage(version = VERSION)`. A plain `X.Y.Z` version gives the version tag. Each other version gives `latest`.
3. Resolve the default at run time in `runSandbox` and in `config-render.ts`. Store only an explicit pin in `image.ref`.
4. Parse `--version <X.Y.Z>` into the same `imageRef` path as `--image=<ref>`. The install then stores the pin, and `agro start` and `agro restart` keep the pin.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/version.ts` (new) | `VERSION` | Single source of the CLI version for `cli.ts` and `lifecycle.ts` |
| `.agro/cli/src/cli.ts:77-78` | `__AGRO_VERSION__`, `VERSION` | Move to `lib/version.ts`; import from there |
| `.agro/cli/src/cli.ts:285-330` | `printSandboxHelp` | Add `--version <X.Y.Z>` and the conflict rule |
| `.agro/cli/src/cli.ts:875-960` | `SandboxArgs`, `parseSandboxArgs` | Parse `--version`, validate `X.Y.Z`, reject the `--image=<ref>` combination |
| `.agro/cli/src/cli.ts:1495-1510` | `runSandboxInstall` call | No change: `--version` arrives as `imageRef` |
| `.agro/cli/src/commands/lifecycle.ts:105,154-170` | `DEFAULT_SANDBOX_IMAGE`, `configuredImage`, `runSandbox` | Replace the constant with `defaultSandboxImage()` |
| `.agro/cli/src/commands/sandbox.ts:26,266-276` | `runSandboxInstall` | Remove the default write to `image.ref` |
| `.agro/cli/src/lib/config-render.ts:49` | `put("AGRO_SANDBOX_IMAGE", ...)` | Render `defaultSandboxImage()` when `image.mode` is `"image"` and `image.ref` is empty |
| `.agro/cli/build.mjs:39` | `__AGRO_VERSION__` define | No change: the define stays the version source |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install --version <X.Y.Z>` | New flag | Selects `ghcr.io/mifunedev/agro:<X.Y.Z>`, implies `--image`, and stores the pin in `image.ref` |
| `agro sandbox install --version` with `--image=<ref>` | New error | Exits 1 before the install writes an entry |
| Default image ref | Behavior change | `ghcr.io/mifunedev/agro:<CLI version>` replaces `latest` for a plain `X.Y.Z` CLI version |
| `agro sandbox --help` | Text change | Lists `--version` and the new default |
| `docs/deployment-prebuilt-image.md`, `docs/lifecycle-commands.md`, `.agro/cli/README.md` | Docs change | Show `--version` as the release pin |

## Storage

The registry entry `${AGRO_HOME:-~/.agro}/sandboxes/<name>/agro.json` keeps the `image.ref` key.
The schema does not change. `image.ref` holds only an explicit pin from `--image=<ref>`, `--version`, or a seeded `agro.json`.
The rendered compose env file follows the pattern in `config-render.ts:49`.

## Architectural Decisions

- `lib/version.ts` owns the CLI version. `build.mjs` stays the build-time source.
- `defaultSandboxImage()` owns the default ref. No other file writes the `ghcr.io/mifunedev/agro` repository name as a default.
- `--version` is sugar for `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`. The install and run paths see one `imageRef` value.
- An unpinned image-mode sandbox follows the CLI version at each `agro start`. A pinned sandbox keeps its `image.ref`.
- The compose fallback in `.devcontainer/docker-compose.image-only.yml:5` stays `latest`. The CLI always sets `AGRO_SANDBOX_IMAGE` in image mode, so the fallback applies only to a direct compose call.
- Precedence stays `AGRO_SANDBOX_IMAGE` env, then `image.ref`, then the default.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `defaultSandboxImage` for `0.13.0`, `0.0.0-dev`, `0.14.0-rc.1`; bare `--image` default env; replace the `DEFAULT_SANDBOX_IMAGE` constant test at line 496 | US-001 |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Image mode without `image.ref` renders the version default; a stored `image.ref` renders unchanged | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Update the case near line 612 to expect no stored `image.ref`; `--version` stores the pin; `--print-argv` env | US-001, US-002 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` (parser block near line 827) | `--version=`, `--version` without value, `--version=latest`, both spellings, conflict with `--image=<ref>` | US-002 |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | Existing `agro --version` case stays green after the move to `lib/version.ts` | US-001 |

Run `npm test` and `npm --prefix .agro/cli run typecheck` from the repository root inside the sandbox.

## Design Principles

- Keep one source of truth for the version and one for the default ref.
- Store an explicit operator decision. Do not store a computed default.
- Reuse the `imageRef` path. Add no second install path.
- Add no comments to tracked code.
- Surfaces: host and sandbox applied, because the CLI runs on the host and tests run in the sandbox. Lifecycle door applied, because `agro sandbox install`, `agro start`, and `agro restart` read the default. Canonical and provider surfaces not applicable, because no skill or hook changes. Root and scaffold applied, because initialized sandboxes read the new default. Interactive and headless processes not applicable. Local and remote operation not applicable. Parallel operation not applicable. Public documentation applied, see Open Questions. Verification applied, see Test Plan.

## Out of Scope

- A `--version` flag on `agro start` or `agro restart`.
- A change to the release workflow or to the published GHCR tags.
- A migration that rewrites an existing `image.ref` equal to `ghcr.io/mifunedev/agro:latest`.
- Digest pins through `--version`.

## Open Questions

1. Does `--version` accept a leading `v`, such as `v0.13.0`? This plan rejects that input with exit 1.
2. Does `agro-web` document `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`? If so, the operator opens a matching change in `mifunedev/agro-web`.
3. An existing entry with a stored `image.ref` of `ghcr.io/mifunedev/agro:latest` keeps `latest`. Confirm that the plan needs no migration.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
