# PRD: Sandbox install version pin

Status: DRAFT

## User Stories

### US-001: Default image tag follows the CLI version

**Description:** As an operator, I want the default image tag to equal my `agro` CLI version so that each sandbox runs a known release, not `latest`.

**Acceptance Criteria:**

- [ ] A new exported function `defaultSandboxImage(version)` in `.agro/cli/src/commands/lifecycle.ts` returns `ghcr.io/mifunedev/agro:<version>` when `version` matches `^[0-9]+\.[0-9]+\.[0-9]+$`.
- [ ] `defaultSandboxImage("0.0.0-dev")` and `defaultSandboxImage("0.14.0-rc.1")` return `ghcr.io/mifunedev/agro:latest`.
- [ ] The constant `DEFAULT_SANDBOX_IMAGE` is absent from `.agro/cli/src` after the change.
- [ ] The CLI version comes from one module. New file `.agro/cli/src/lib/cli-version.ts` exports the value that `.agro/cli/src/cli.ts:78` computes today, and `cli.ts` imports it.
- [ ] `runSandbox` falls back to `defaultSandboxImage(<CLI version>)` in place of `DEFAULT_SANDBOX_IMAGE`.
- [ ] `renderComposeVars` in `.agro/cli/src/lib/config-render.ts` emits `AGRO_SANDBOX_IMAGE=<default ref>` when `image.mode` is `image` and `image.ref` is empty.
- [ ] `runSandboxInstall` writes no `image.ref` for a `--checkout` directory without `.devcontainer/Dockerfile`. The write at `.agro/cli/src/commands/sandbox.ts:270-276` is deleted.
- [ ] A new test renders the env file for an unpinned image-mode entry with the version `0.13.0`. The env file contains `AGRO_SANDBOX_IMAGE=ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `npm test` exits 0.

### US-002: `--version` flag pins an official release

**Description:** As an operator, I want to type `agro sandbox install docker --version=0.13.0` so that I can pin an official release without typing the full image ref.

**Acceptance Criteria:**

- [ ] `parseSandboxArgs` accepts `--version=<X.Y.Z>` and `--version <X.Y.Z>`. Both forms set `imageRef` to `ghcr.io/mifunedev/agro:<X.Y.Z>` and set `image` to `true`.
- [ ] `parseSandboxArgs` rejects a `--version` value that does not match `^[0-9]+\.[0-9]+\.[0-9]+$`. The error names the flag and the expected `X.Y.Z` shape.
- [ ] `parseSandboxArgs` rejects `--version` together with `--image=<ref>` in either order. The error names both flags.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1, and the registry directory holds no new entry.
- [ ] The global version check at `.agro/cli/src/cli.ts:106` does not intercept `--version` after `sandbox install`. `agro --version` still prints the bare version.
- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] After `runSandboxInstall` with `imageRef` from `--version=0.13.0`, the entry `agro.json` holds `image.ref` = `ghcr.io/mifunedev/agro:0.13.0` and `image.mode` = `image`.
- [ ] `npm test` exits 0.

### US-003: Documentation shows `--version` as the release pin

**Description:** As an operator, I want the docs to show `--version` as the way to pin a release so that I skip the full image ref.

**Acceptance Criteria:**

- [ ] `printSandboxHelp` in `.agro/cli/src/cli.ts` lists `--version <X.Y.Z>`, states the conflict with `--image=<ref>`, and names the CLI-version default.
- [ ] The "Pinning an image ref" section of `docs/deployment-prebuilt-image.md` shows `agro sandbox install docker --version=0.13.0` as the release pin.
- [ ] The precedence diagram in `docs/deployment-prebuilt-image.md` shows the CLI-version default as the base layer.
- [ ] `docs/lifecycle-commands.md:41` and `.agro/cli/README.md:89` list `--version <X.Y.Z>`.
- [ ] `docs/installation.md:160` names `ghcr.io/mifunedev/agro:<CLI version>` as the no-checkout default.
- [ ] `CHANGELOG.md` holds one entry for the `--version` flag and for the new default tag.

## Summary

Verified current state:

- `DEFAULT_SANDBOX_IMAGE` is `ghcr.io/mifunedev/agro:latest` at `.agro/cli/src/commands/lifecycle.ts:105`.
- `runSandbox` resolves the ref as `--image=<ref>`, then `configuredImage(root)`, then `DEFAULT_SANDBOX_IMAGE` (`lifecycle.ts:164-167`).
- `parseSandboxArgs` handles `--image` and `--image=<ref>` at `.agro/cli/src/cli.ts:937-944`. No `--version` branch exists there.
- `build.mjs` injects `__AGRO_VERSION__` from `.agro/cli/package.json` (`.agro/cli/build.mjs:39`). `cli.ts:78` falls back to `0.0.0-dev` when the define is absent. Vitest runs the source without the define, so tests see `0.0.0-dev`.
- `renderComposeVars` emits `AGRO_SANDBOX_IMAGE` only from `config.image.ref` (`.agro/cli/src/lib/config-render.ts:49`). `renderComposeEnv` writes those values to the env file.
- An unpinned no-checkout entry has no `image.ref`. The compose fallback `${AGRO_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}` in `.devcontainer/docker-compose.image-only.yml:5` selects `latest` today.
- For a `--checkout` directory without a Dockerfile, `runSandboxInstall` stores `DEFAULT_SANDBOX_IMAGE` in `image.ref` (`sandbox.ts:270-276`). That write is an implicit pin.

Selected approach:

1. Compute the default ref from the CLI version in one function.
2. Render the default ref into the compose env file for each unpinned image-mode entry. `agro start` and `agro restart` select the same default as `install`.
3. Map `--version <X.Y.Z>` to `imageRef`. The existing `imageRef` path persists the ref in `image.ref`, and each later verb reads that pin.
4. Delete the implicit `image.ref` write for a `--checkout` directory. The rendered default replaces it.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/lifecycle.ts` | `DEFAULT_SANDBOX_IMAGE`, `runSandbox`, `configuredImage` | Replace the constant with `defaultSandboxImage(version)`. Use the function as the last fallback. |
| `.agro/cli/src/cli.ts` | `VERSION`, `parseSandboxArgs`, `SandboxArgs`, `printSandboxHelp` | Import the CLI version. Parse `--version`. Reject the conflict. Update help text. |
| new file `.agro/cli/src/lib/cli-version.ts` | `CLI_VERSION` | Own the `__AGRO_VERSION__` read for `cli.ts`, `lifecycle.ts`, and `config-render.ts`. |
| `.agro/cli/src/lib/config-render.ts` | `renderComposeVars`, `renderComposeEnv` | Emit the default ref for an unpinned image-mode entry. |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall` | Delete the implicit `image.ref` write at lines 270-276. Keep the `imageRef` persistence at lines 266-268. |
| `.agro/cli/build.mjs` | `__AGRO_VERSION__` define | No change. The define already applies to every bundled module. |
| `.devcontainer/docker-compose.image-only.yml` | `image:` fallback | No change. The rendered env value takes precedence over the fallback. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install docker --version <X.Y.Z>` | New flag | Selects `ghcr.io/mifunedev/agro:<X.Y.Z>` and persists the ref in `image.ref`. |
| `agro sandbox install docker --version=<X.Y.Z> --image=<ref>` | New error | Exits 1 before any entry write. |
| Default image ref | Behavior change | `ghcr.io/mifunedev/agro:<CLI version>` for a plain `X.Y.Z` CLI version. Otherwise `ghcr.io/mifunedev/agro:latest`. |
| Entry `agro.json` `image.ref` | Behavior change | Holds only an explicit pin from `--image=<ref>`, `--version`, a seed, or `agro config set`. |
| `agro sandbox --help` | Text change | Lists `--version` and the new default. |

## Storage

The registry entry `agro.json` under the operator's AGRO home stores the pin in the existing `image.ref` key. The schema does not change. Follow the existing `--image=<ref>` persistence at `sandbox.ts:266-268`.

## Architectural Decisions

- `image.ref` is the only source of truth for a pin. An absent `image.ref` means "follow the CLI default".
- `defaultSandboxImage` is the only source of truth for the default ref. `runSandbox`, `renderComposeVars`, and the help text call that function.
- `--version` is sugar for `--image=ghcr.io/mifunedev/agro:<X.Y.Z>`. The parser converts the flag, so `runSandboxInstall` needs no new option.
- An unpinned entry follows the installed CLI version. After a CLI upgrade, the next `agro start` selects the new default tag.
- The compose fallback to `latest` stays as the last resort for a wrapper call without a rendered env file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `defaultSandboxImage` returns the versioned ref for `0.13.0`, and `latest` for `0.0.0-dev` and `0.14.0-rc.1`. This case replaces the test at line 496. | US-001 default rule |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | Parse `--version=0.13.0` and `--version 0.13.0`. Reject `--version=abc`, a valueless `--version`, and `--version` with `--image=<ref>` in both orders. Extend the cases near lines 758 and 822. | US-002 parser |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | Render an unpinned image-mode entry. Expect `AGRO_SANDBOX_IMAGE=<default ref>`. Render a build-mode entry. Expect no `AGRO_SANDBOX_IMAGE` line. | US-001 start and restart default |
| `.agro/cli/src/__tests__/sandbox.test.ts` | Update the case near line 612: the entry holds no `image.ref`, and the env file holds the default ref. Add a case: `imageRef` from `--version=0.13.0` persists in `image.ref`. | US-001 no implicit pin, US-002 persistence |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | Keep the `--version prints the bare version` case green. | US-002 global flag not broken |
| `.agro/evals/probes/agro-sandbox-image-mode.sh` | Run `bash .agro/evals/probes/agro-sandbox-image-mode.sh`. Expect PASS. | Existing image-mode guard |
| `.agro/evals/probes/agro-image-only-deploy.sh` | Run `bash .agro/evals/probes/agro-image-only-deploy.sh`. Expect PASS. | Existing image-only guard |

Write each new case first. Confirm that each new case fails before the change.

## Design Principles

- Keep one function for the default ref and one key for the pin.
- Reuse the `imageRef` path. Add no new install option.
- Add no comments to tracked code, per the root `AGENTS.md`.
- Surfaces: host CLI code applied; lifecycle verbs `install`, `start`, `restart` applied through `renderComposeVars`; `.agro/` provider mirrors not applicable; scaffold not applicable; Herdr and tmux not applicable; parallel operation not applicable.

## Out of Scope

- A `--version` flag on `agro start` or `agro restart`.
- A change to the compose fallback in `.devcontainer/docker-compose.image-only.yml`.
- A migration of existing entries that already store `ghcr.io/mifunedev/agro:latest` in `image.ref`.
- Pre-release tags, such as `0.14.0-rc.1`, as `--version` values.
- A change to the release workflow or to the published tags.

## Open Questions

1. The `mifunedev/agro-web` public docs show `--image=<ref>` as the pin. Does this task open a matching change there, or does a follow-up issue own it?
2. An unpinned entry follows the CLI version after a CLI upgrade. Confirm that behavior, or choose to store the default ref at install time.
3. Existing entries from the old D-3 write hold `image.ref` = `ghcr.io/mifunedev/agro:latest`. Those entries keep `latest`. Confirm that this task needs no migration.

## Acceptance Criteria

- [ ] `agro sandbox install docker --version=0.13.0 --yes --print-argv` selects `ghcr.io/mifunedev/agro:0.13.0`.
- [ ] `agro sandbox install docker --yes --print-argv` without a checkout selects `ghcr.io/mifunedev/agro:<CLI version>`.
- [ ] `agro sandbox install docker --version=0.13.0 --image=my/img:1` exits 1 and writes no entry.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
