# `.agro/` directory layout

AGRO keeps the portable control plane in `.agro/`, the sandbox definition in
`.devcontainer/`, and the repository content at the root. The root `AGENTS.md`
defines the operating boundaries. Each scoped `AGENTS.md` defines local
obligations. Canonical skills own reusable procedures.

## Repository map

| Path | Responsibility |
| --- | --- |
| `.agro/cli/` | The `agro` CLI package. |
| `.agro/scripts/`, `.agro/install/` | Lifecycle scripts, runtime helpers, and image installation inputs. |
| `.agro/skills/`, `.agro/hooks/`, `.agro/skills.lock` | Shared procedures, hooks, and pack metadata. |
| `.agro/knowledge/` | Tracked source pages, patterns, external captures, and a generated index; ignored `local/` scratch. |
| `.agro/tasks/` | Task plans (`prd.md`) and story state (`prd.json`). |
| `.agro/logs/`, `.agro/memories/` | Local logs and operator context, each with a scoped contract. |
| `.agro/manifest.json` | The declared control-plane and root payload. |
| `.devcontainer/` | Dockerfile, Compose configuration, entrypoint, and sandbox bootstrap assets. |
| `docs/` | Human-facing source documentation. The rendered site lives in `mifunedev/agro-web`. |
| `crons/` | Operator schedule definitions that the cron runtime reads. |
| `.worktrees/` | Isolated branch checkouts for this repository. |
| `projects/` | Independent repository clones; each clone keeps its own `.worktrees/`. |
| `agro.json`, `.example.env` | Tracked non-secret settings and the secret-variable template. |

Git ignores the root `.env`. In an equipped checkout, `.devcontainer/.env` links
to `../.env`, so VS Code finds the secrets. A fresh clone has no such link. See
[Configuration](configuration.md) for settings and secrets.

## Provider exposure

Git tracks the shared skills and hooks in `.agro/`. The
[provider linker](../.agro/scripts/link-providers.sh) creates these links:

| Surface | Target |
| --- | --- |
| `.agents/skills` | `../.agro/skills` |
| `.claude/skills` | `../.agro/skills` |
| `.claude/hooks` | `../.agro/hooks` |
| `.hermes/skills/agro` | `../../.agro/skills`, when Hermes integration applies. |

Codex and Pi read the standard `.agents/skills` surface. Pi settings and
extensions stay in `.pi/`. Run `bash .agro/scripts/link-providers.sh --check` to
verify the pack and the links. See [Hermes](harnesses/hermes.md) for its link.

## Sandbox registry

The CLI bundles the Compose files and the lifecycle helpers, so a lifecycle
command needs no source checkout. The CLI writes generated copies into the
registry entry `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`:

| Registry entry | Purpose |
| --- | --- |
| `agro.json` | Operator-owned sandbox settings. |
| `.env` | Sandbox secrets, mode `0600`. |
| `.devcontainer/` | Generated Compose files. |
| `.agro/scripts/` | Generated lifecycle wrapper and its helpers. |

The registry is user-level state on the host. In the image, `AGRO_PROJECT_ROOT`
is `/home/sandbox/harness`, inside the persistent sandbox home.

## Control-plane distribution

`agro vendor` writes the control plane into a checkout. See
[Lifecycle commands → `agro vendor`](lifecycle-commands.md#equipping-a-checkout-agro-vendor).
[`.agro/manifest.json`](../.agro/manifest.json) declares the payload:

- `include` lists globs relative to `.agro/`.
- `rootInclude` lists repository-relative globs. The current list is `crons/**`.
- `exclude` applies to both lists and wins over an include match.

The payload omits `tasks`, `logs`, `memories`, and the root `docs/`. A
distributed contract therefore links to the documentation on GitHub.

## Related references

- [Lifecycle commands](lifecycle-commands.md)
- [Configuration](configuration.md)
- [Sandbox Python](sandbox-python.md)
