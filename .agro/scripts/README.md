# `scripts/`

Orchestrator scripts that run on the **host**, not inside the sandbox.
Provisioning and the cron runtime live here.

| File              | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `install.sh`      | Curl-piped installer — bootstraps a fresh harness checkout         |
| `link-providers.sh` | Creates/repairs the provider skill/agent/hook symlinks into `.agro/` and validates the vendored pack is present. |
| `release-reservation.mjs` | Validates the SemVer release version and drives the reservation state machine |
| `reserve-github-release.mjs` | Atomically reserves the `v<version>` tag and recovers its same-SHA GitHub draft |
| `promote-release-latest.sh` | Fresh-checks canonical `main`-else-`master` and promotes its image to `latest` by digest |
| `verify-sandbox-image.sh` | Verifies a built sandbox image: `verify-sandbox-image.sh <image-ref>` checks the Debian Trixie base, the `trixie` Docker apt suite, the built-in `sandbox` UID/GID `1000:1000`, Node 22, the pinned pnpm 10.33.0 and numeric dotted version output from `gh`, Docker, Bun and uv, that no harness and no `kind:"installable"` tool is baked into the image, and that every `kind:"baked-in"` tool is present |
| `sandbox-boot-smoke.sh` | Boots the compose sandbox, polls the healthcheck, and verifies the Herdr runtime plus the bind-mount ownership contract |
| `node-pnpm-parity.sh` | CI base-parity check: installs Node and pnpm in fixed Bookworm and Trixie images with the exact Dockerfile commands and requires identical versions |
| `cron-runtime.ts` | Croner runtime — scans `crons/*.md`, schedules, fires each job     |
| `prompt-miner-caps.sh` | REMOVED in 0.3.0 with the autopilot cap gate it wrapped — see `crons/prompt-miner.md` § Caps | <!-- legacy: `autopilot-caps.sh` with `CRON_REPO=mifunedev/openharness` + `AUTOPILOT_LABEL=prompt-miner` |
| `__tests__/`      | Vitest unit tests (`vitest.config.ts` at repo root targets this)   |

## Release

`.github/workflows/release.yml` drives the release scripts in this directory.
`reserve-github-release.mjs` identifies itself to the GitHub API with the user
agent `agro-release-reservation`. The smoke sandbox is
`agro-release-smoke-<run id>`. `promote-release-latest.sh` defaults
`IMAGE_REPOSITORIES` to `ghcr.io/mifunedev/agro ghcr.io/mifunedev/openharness`,
so the `agro` digest is the reference the legacy alias must match.

After `finalize` succeeds on a real release, the `notify-docs` job sends
`repository_dispatch` to the docs site:

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Target repository | `${{ vars.AGRO_WEB_REPO \|\| 'mifunedev/openharness-web' }}`           |
| `event_type`      | `agro-release`                                                        |
| `client_payload`  | `{ "ref": "<released sha>" }` (`needs.reserve.outputs.releaseSha`)    |
| Credential        | secret `AGRO_WEB_DISPATCH_TOKEN`, passed to `gh api` through `GH_TOKEN` |

`repository_dispatch` needs a token with `contents: write` on the docs
repository: a fine-grained personal access token with **Contents: Read and
write**, or a classic token with the `repo` scope. When the secret is absent the
job prints `::notice::Secret AGRO_WEB_DISPATCH_TOKEN is not set` and exits 0.
Store the token from a file so it never appears in a shell history or a log:

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
```

The GHCR package `mifunedev/agro` must be public before consumers can pull the
`agro` image tags; see `.agro/skills/release/SKILL.md`.

## Conventions

- Bash scripts use `set -euo pipefail` and an `ERR` trap where practical so silent exits
  surface as `ERROR:` lines (see `install.sh` header for the pattern).
- TypeScript scripts are run via `tsx` from the root `package.json`
  scripts; tests run via `pnpm test`.
- Scripts here are **orchestrator-scope only**. Anything an in-sandbox
  agent needs lives under `.agro/install/`. Per `CLAUDE.md`, application code does
  not belong in `scripts/`.

## Adding a script

1. Drop it in `scripts/` with a one-line purpose comment in its header.
2. Add a row to the table above.
3. If it's TypeScript, add a unit test under `scripts/__tests__/`.
4. If it's a long-running entry point, wire a `pnpm` script in the root
   `package.json` rather than expecting users to invoke it directly.
