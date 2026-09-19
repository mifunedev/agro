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
| `verify-sandbox-image.sh` | Checks image distribution, user IDs, tool versions, catalog installation policy, and seeded Python defaults: `verify-sandbox-image.sh <image-ref>`. |
| `provision-python.sh` | Provisions Python 3.13 defaults and the isolated kernel environment inside the sandbox. |
| `sandbox-boot-smoke.sh` | Boots the compose sandbox, polls the healthcheck, and verifies the Herdr runtime plus the bind-mount ownership contract |
| `node-pnpm-parity.sh` | CI base-parity check: installs Node and pnpm in fixed Bookworm and Trixie images with the exact Dockerfile commands and requires identical versions |
| `cron-runtime.ts` | Croner runtime — scans `crons/*.md`, schedules, fires each job     |
| `prompt-miner-caps.sh` | REMOVED in 0.3.0 with the autopilot cap gate it wrapped — see `crons/prompt-miner.md` § Caps | <!-- legacy: `autopilot-caps.sh` with `CRON_REPO=mifunedev/openharness` + `AUTOPILOT_LABEL=prompt-miner` |
| `__tests__/`      | Vitest unit tests (`vitest.config.ts` at repo root targets this)   |

## Sandbox Python

`provision-python.sh` runs inside the sandbox during image creation and boot.
It installs Python 3.13 with `uv python install --default`.
The default `UV_PYTHON_BIN_DIR` is `$HOME/.local/bin`.
The image PATH includes this directory, so `python` and `python3` need no shell activation.
Project virtual environments retain their own interpreters and packages.

The kernel environment lives at `$HOME/.local/share/oh/kernel`.
The provisioner compares its base interpreter with the requested uv-managed interpreter.
It reuses a matching environment and recreates a stale environment at the same path.
If creation or package installation fails during migration, it restores the old kernel.
The provisioner retains older managed Python installations.
A file lock serializes provisioning within one HOME.
Boot reports provisioning failures as warnings and continues.

Use `OH_PYTHON_VERSION`, `OH_PYTHON_KERNEL_HOME`, and `OH_PYTHON_KERNEL_PACKAGES` to override the defaults.
The provisioner refuses root, HOME, ancestor, symlink, and non-venv kernel replacement paths.
It accepts legacy uv environments at the default or explicitly configured kernel path.
Set `OH_PYTHON_KERNEL_HOME` only to the environment that the provisioner must manage.

Run `bash .agro/scripts/provision-python.sh --verify` to check the current installation without repair.
Verification checks both default commands, the kernel base interpreter, and the `ipykernel` import.
Base-command checks use an explicit PATH independent of the caller's active project environment.
`verify-sandbox-image.sh` restores `/opt/home-seed` in an ephemeral container with networking disabled.
It checks Python 3.13 defaults and the kernel as `sandbox`, without a login shell.

Run the real-uv regression matrix as a non-root sandbox user:

```bash
bash .agro/scripts/__tests__/provision-python.integration.sh
```

The matrix downloads interpreters and packages into a disposable HOME.
It checks fresh provisioning, migration, rollback, command resolution, verification failures, and project isolation.
It deletes the test HOME on exit.

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
  agent needs lives under `.agro/install/`. Per `AGENTS.md`, application code does
  not belong in `scripts/`.

## Adding a script

1. Drop it in `scripts/` with a one-line purpose comment in its header.
2. Add a row to the table above.
3. If it's TypeScript, add a unit test under `scripts/__tests__/`.
4. If it's a long-running entry point, wire a `pnpm` script in the root
   `package.json` rather than expecting users to invoke it directly.
