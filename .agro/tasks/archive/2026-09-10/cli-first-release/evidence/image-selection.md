# US-004 evidence — unselected image fallback

Worktree: `/home/sandbox/harness/.worktrees/task/939-cli-first-release`
Branch: `task/939-cli-first-release`

## CLI fallback

Command:

```bash
grep -n 'DEFAULT_SANDBOX_IMAGE' .agro/cli/src/commands/lifecycle.ts
```

Observed:

```
104:export const DEFAULT_SANDBOX_IMAGE = "ghcr.io/mifunedev/agro:latest";
166:    ? (opts.imageRef ?? configuredImage(root) ?? DEFAULT_SANDBOX_IMAGE)
```

Resolution order is unchanged: `--image=<ref>` > env/`image.ref` (`configuredImage`) > `DEFAULT_SANDBOX_IMAGE`.

## Image-only Compose fallback

Command:

```bash
grep -n 'image:' .devcontainer/docker-compose.image-only.yml
```

Observed:

```
5:    image: ${AGRO_SANDBOX_IMAGE:-${OH_SANDBOX_IMAGE:-ghcr.io/mifunedev/agro:latest}}
```

`AGRO_SANDBOX_IMAGE` still precedes `OH_SANDBOX_IMAGE`. Only the unselected third fallback changed.

## Help documents the new fallback

`node .agro/cli/dist/agro.js sandbox --help` (exit 0) includes:

```
  --image[=<ref>]  Run the prebuilt image instead of building (implies
                   --no-build). Ref resolves last-wins: --image=<ref> >
                   agro.json image.ref > ghcr.io/mifunedev/agro:latest.
```

`node .agro/cli/dist/oh.js sandbox --help` (exit 0) includes:

```
  --image[=<ref>]  Run the prebuilt image instead of building (implies
                   --no-build). Ref resolves last-wins: --image=<ref> >
                   oh.json image.ref > ghcr.io/mifunedev/agro:latest.
```

## Tests

Command (from worktree; vitest binary from the host checkout because this worktree has no root `node_modules`):

```bash
npm --prefix .agro/cli ci --ignore-scripts
# NPM_CI_EXIT=0
npm --prefix .agro/cli run typecheck
# TYPECHECK_EXIT=0
npm --prefix .agro/cli run build
# BUILD_EXIT=0
/home/sandbox/harness/node_modules/.bin/vitest run \
  .agro/cli/src/__tests__/cli-first-help.test.ts \
  .agro/cli/src/__tests__/lifecycle.test.ts \
  .agro/cli/src/lib/__tests__/config-render.test.ts \
  .agro/cli/src/lib/__tests__/registry.test.ts
```

Observed:

```
 Test Files  4 passed (4)
      Tests  110 passed (110)
   Duration  602ms
VITEST_EXIT=0
```

During the run:

```
compat: AGRO_SANDBOX_IMAGE and OH_SANDBOX_IMAGE are both set and differ — using AGRO_SANDBOX_IMAGE
```

Lifecycle cases added/kept:

- unselected `--image` fallback is `ghcr.io/mifunedev/agro:latest`
- `AGRO_SANDBOX_IMAGE` wins over `OH_SANDBOX_IMAGE`
- explicit `image.ref` values are preserved: canonical `ghcr.io/mifunedev/agro:latest`, legacy `ghcr.io/mifunedev/openharness:latest`, custom `ghcr.io/example/custom:tag`, and a digest reference
- config-render still emits a stored legacy `image.ref` of `ghcr.io/mifunedev/openharness:latest` without rewriting it
- image-only compose file fallback is the agro latest tag

## What was NOT changed

- Registry paths and discovery (`~/.agro/sandboxes`, `~/.oh/sandboxes`)
- Volume names and compose volume `workspace`
- `/opt/oh` CLI install root and `/opt/oh` ownership detection
- Seed markers (`.agro/.image-seeded`, `.oh/.image-seeded`) and `/opt/oh-seed` / `/opt/agro-seed`
- Conflict refusal for divergent dual-generation state
- `AGRO_*` over `OH_*` precedence
- Stored `image.ref` values, including a legacy `ghcr.io/mifunedev/openharness:latest`
- `aliasedEnvPair("SANDBOX_IMAGE", …)` still writes both `AGRO_SANDBOX_IMAGE` and `OH_SANDBOX_IMAGE`

## Provider link check

```bash
bash .agro/scripts/link-providers.sh --check
```

Exit status: `0`

```
note: Hermes uses another runtime home; checking only this checkout's other providers
Providers OK: .agents/.claude/.codex skills -> .agro/skills (vendored pack present)
```
