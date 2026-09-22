# Control-plane scripts

These scripts support host lifecycle operations, sandbox runtime work, and CI.
Use `agro` for lifecycle operations; each script's callers determine its execution location.

| Scripts | Purpose |
| --- | --- |
| `get-agro.sh`, `get-agro.sh`, `install.sh` | CLI bootstrap and checkout installation. |
| `docker-compose.sh`, `paths.sh`, `check-host-port.sh`, `agro-path` | Lifecycle execution, compatibility, and path resolution. |
| `link-providers.sh` | Create or check canonical provider links. |
| `cron-runtime.ts`, `gateway.sh` | Scheduled jobs and named messaging sessions. |
| `provision-python.sh` | Sandbox Python defaults and kernel environment. |
| `sandbox-healthcheck.sh`, `sandbox-boot-smoke.sh`, `sandbox-upgrade-smoke.sh` | Runtime health, boot, and upgrade checks. |
| `verify-sandbox-image.sh`, `node-pnpm-parity.sh`, `check-pnpm-pin.sh` | Image and dependency parity checks. |
| `release-reservation.mjs`, `reserve-github-release.mjs`, `promote-release-latest.sh` | Release reservation and image promotion. |
| `verify-release-aliases.sh`, `npm-wait-version.sh` | Release artifact checks. |
| `git-maintenance.sh`, `locked-append.sh`, `closing-keywords.mjs` | Git maintenance, serialized appends, and issue-closing parsing. |
| `registry-portability.sh`, `registry-portability.md` | Portable-skill lint and its exception list. |
| `cli-first-install-smoke.sh`, `hermes-install-smoke.sh` | Installer smoke checks. |
| `migrate-harness-yaml.sh` | Legacy configuration migration. |
| `__tests__/` | Script tests. |

Source references:
[Python provisioning](https://github.com/mifunedev/agro/blob/main/docs/sandbox-python.md),
[release operations](https://github.com/mifunedev/agro/blob/main/docs/contributing.md#releases),
and [lifecycle commands](https://github.com/mifunedev/agro/blob/main/docs/lifecycle-commands.md).
Root `docs/` does not ship in the control-plane payload.
