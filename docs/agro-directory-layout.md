# `.agro/` directory layout

AGRO separates portable control-plane machinery from the sandbox definition and repository content.
The root `AGENTS.md` defines the operating boundaries.
Scoped `AGENTS.md` files define local production obligations; READMEs provide orientation, package information, or indexes.
Canonical skills own reusable procedures. Documentation under `docs/` explains AGRO for readers.

## Repository map

| Path | Responsibility |
| --- | --- |
| `.agro/cli/` | The `agro` CLI package. |
| `.agro/scripts/`, `.agro/install/` | Lifecycle scripts, runtime helpers, and image installation inputs. |
| `.agro/hooks/` | Vendored security hooks, mirrored onto each provider surface. |
| `.agro/logs/` | Local logs with a scoped contract. |
| `.agro/manifest.json` | The declared control-plane and root payload. |
| `.devcontainer/` | Dockerfile, Compose configuration, entrypoint, and sandbox bootstrap assets. |
| `docs/` | Human-facing source documentation. The rendered site lives in `mifunedev/agro-web`. |
| `crons/` | Operator schedule definitions read by the cron runtime. |
| `.worktrees/` | Isolated branch checkouts for this repository. |
| `projects/` | Independent repository clones; each keeps its own `.worktrees/`. |
| `agro.json`, `.example.env` | Tracked non-secret settings and the secret-variable template. |

Git ignores root `.env`.
The checkout installer creates `.devcontainer/.env -> ../.env` for VS Code.
Fresh clones do not contain that link.
See [configuration](configuration.md) for configuration precedence and secrets.
User-local `.agro/config.json` does not exist in a fresh clone.
The compatibility resolver also supports older configuration paths.
Do not infer current files from historical directory names.

## Provider exposure

Git tracks shared hooks directly in `.agro/`. The pack needs no submodule fetch.
The [provider linker](../.agro/scripts/link-providers.sh) creates these links:

| Surface | Target |
| --- | --- |
| `.claude/hooks` | `../.agro/hooks` |

Pi-specific settings and extensions stay in `.pi/`.
The linker removes retired `.agents/skills`, `.claude/skills`, `.pi/skills`, and
`.codex/skills` aliases without replacing foreign paths.
Run `bash .agro/scripts/link-providers.sh --check` to verify the pack and links.
See [Hermes](harnesses/hermes.md) for its additive link and runtime-home safety checks.

## Sandbox definition and registry

The sandbox definition stays in the conventional `.devcontainer/` location.
The CLI bundles Compose files and lifecycle helpers so installed lifecycle commands need no source checkout.
Registry materialization writes generated copies under `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`.

| Registry entry | Purpose |
| --- | --- |
| `agro.json` | Operator-owned sandbox settings. |
| `.env` | Sandbox secrets, mode `0600`. |
| `.devcontainer/` | Generated Compose files. |
| `.agro/scripts/` | Generated lifecycle wrapper and its helpers. |

The registry is user-level state, not the repository's `.agro/` directory.
Legacy `${AGRO_HOME:-~/.oh}` state follows the [compatibility contract](agro-compatibility.md).
The image uses `/home/sandbox/harness` as `AGRO_PROJECT_ROOT`, inside the persistent sandbox home.
Repository scripts still read the environment variable; do not confuse the image default with a universal host path.

## Control-plane distribution

`agro update` upgrades the installed executable.
During the compatibility window, `agro vendor` vendors the project payload instead:

```bash
agro vendor [--from <dir> | --from-remote [--ref <ref>]] [--dry-run] [--force]
```

The payload source order is explicit `--from`, explicit remote, bundled payload, then an announced remote fallback.
The source CLI package version controls upgrades. A missing target version reads as `0.0.0`.
An equal version is a no-op without `--force`; a downgrade requires `--force`.
`--dry-run` reports changes without writing.

[manifest.json](../.agro/manifest.json) narrows the copy operation:

- `include` uses POSIX globs relative to `.agro/`.
- `rootInclude` uses repository-relative globs; the current list is `crons/**`.
- `exclude` applies to both lists and wins over an include match.
- Symlinks, `node_modules`, and `dist` directories do not enter the file walk.

The current payload includes `cli`, `scripts`, `install`, and `hooks`.
It also includes `README.md` and the manifest itself.
The payload omits `logs`, dependency patches, and root `docs/`.
The omissions describe the current manifest, not every file present in the repository.

The updater overwrites shipped files in place without backups and creates no root scaffold.
It writes no root `AGENTS.md`, provider configuration, `.gitignore`, `agro.json`, or `.devcontainer/`.
Current manifest rules omit `.agro/config.json`; the updater does not overwrite every file under `.agro/`.
The two payload copy functions apply separate destination containment checks for control-plane and root-relative paths.
The root payload means the write boundary is not limited to `.agro/` alone.

If the source manifest is absent or invalid, legacy mode overlays the control-plane tree and prints a warning.
The legacy fallback has no `rootInclude` payload.
Check the source manifest before updating local control-plane customizations.

Because root `docs/` does not ship, distributed contracts link to source documentation on GitHub.

## Related references

- [Lifecycle commands](lifecycle-commands.md)
- [Configuration](configuration.md)
- [Sandbox Python](sandbox-python.md)
- [Descriptive harness manifest](harness-manifest.md)
