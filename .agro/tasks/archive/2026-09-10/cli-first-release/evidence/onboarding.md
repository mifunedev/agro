# US-002 / US-003 evidence — help text and onboarding docs

Worktree: `/home/sandbox/harness/.worktrees/task/939-cli-first-release`
Branch: `task/939-cli-first-release`
Date: observed during T2 execution.

## Top-level help (built bundles)

Command:

```bash
node .agro/cli/dist/agro.js --help
node .agro/cli/dist/oh.js --help
```

`agro --help` (exit 0):

```
agro — AGRO CLI (v0.9.0)

Usage:
  agro sandbox <args...>      Create and list sandboxes (install|list)
  agro shell [name]           Open a zsh shell in the running sandbox container
  agro config <args...>       Read and write agro.json (show|set), or run a wizard
  agro secret <args...>       Read and write the gitignored root .env (set|list)
  agro update                 Upgrade the installed agro CLI
  agro migrate                Move a legacy .oh/ project or ~/.oh registry to AGRO names (--check|--home)
  agro stop [name]            Stop the sandbox, preserving volumes
  agro restart [name]         Restart the sandbox service
  agro logs [name]            Tail sandbox logs (follows)
  agro ps [name]              Show sandbox service status
  agro destroy [name]         Remove the sandbox and wipe its named volumes
  agro compose config         Print the resolved docker compose configuration
  agro harness <args...>      Install and inspect agent CLI harnesses
  agro tool <args...>         Install and inspect sandbox tooling
  agro gateway <args...>      Manage a messaging client session (pi|hermes)
  agro cloud <args...>        Manage OpenHarness Cloud nodes
  agro --version              Print version
  agro --help                 Show this help

Integrations:
  (none)
```

`oh --help` (exit 0):

```
oh — Open Harness CLI (v0.9.0)

Usage:
  oh sandbox <args...>      Create and list sandboxes (install|list)
  oh shell [name]           Open a zsh shell in the running sandbox container
  oh config <args...>       Read and write oh.json (show|set), or run a wizard
  oh secret <args...>       Read and write the gitignored root .env (set|list)
  oh update                 Vendor or upgrade the .oh/ control plane
  oh migrate                Move a legacy .oh/ project or ~/.oh registry to AGRO names (--check|--home)
  oh stop [name]            Stop the sandbox, preserving volumes
  oh restart [name]         Restart the sandbox service
  oh logs [name]            Tail sandbox logs (follows)
  oh ps [name]              Show sandbox service status
  oh destroy [name]         Remove the sandbox and wipe its named volumes
  oh compose config         Print the resolved docker compose configuration
  oh harness <args...>      Install and inspect agent CLI harnesses
  oh tool <args...>         Install and inspect sandbox tooling
  oh gateway <args...>      Manage a messaging client session (pi|hermes)
  oh cloud <args...>        Manage OpenHarness Cloud nodes
  oh --version              Print version
  oh --help                 Show this help

Integrations:
  (none)
oh is the compatibility entry point for agro (npm: @mifune/agro).
```

## Command-specific update help

`node .agro/cli/dist/agro.js update --help` (exit 0) starts:

```
agro update — Upgrade the installed agro CLI

Usage:
  agro update [--dry-run]
```

and ends with:

```
Project payload vendoring (.agro/ + crons/) is `oh update` during the
compatibility window; its --from, --from-remote, --ref and --force flags are
not accepted here.
```

`node .agro/cli/dist/oh.js update --help` (exit 0) starts:

```
oh update — Vendor or upgrade the .oh/ control plane

Usage:
  oh update [--from <dir> | --from-remote [--ref <ref>]] [--dry-run] [--force]
```

## Dispatch preserved

`node .agro/cli/dist/agro.js update --from` (exit 1):

```
agro update: --from belongs to the legacy project-payload command; run `oh update --from` during the compatibility window — agro update upgrades only the installed CLI
```

followed by agro self-upgrade help.

`node .agro/cli/dist/oh.js update --from` (exit 1):

```
oh update: --from requires a directory
```

oh still parses `--from` as a vendoring flag (missing directory), not as a rejected self-upgrade flag.

## Onboarding doc review (US-003)

Required path already present in README.md, `.agro/cli/README.md`, docs/installation.md, docs/quickstart.md, docs/lifecycle-commands.md:

- `npm install -g @mifune/agro`
- `get-agro.sh`
- `agro sandbox install docker`

Required path does not demand clone, fork, retired `install.sh`, or `config repo`.

`agro config repo` / `oh config repo` remain documented as a compatibility helper, not the canonical path (installation.md, quickstart.md, agro-compatibility.md).

`install.sh` remains in `.agro/scripts/README.md` as a scripts-table row (historical/orchestrator script), not as the required onboarding command.

`agro update` is CLI self-upgrade; `oh update` is optional project vendoring. Already distinguished in README.md, `.agro/cli/README.md`, docs/installation.md, docs/quickstart.md, docs/lifecycle-commands.md, docs/agro-compatibility.md.

Edits made:

- `docs/installation.md`: unselected image named `ghcr.io/mifunedev/agro:latest`
- `docs/quickstart.md`: same
- `docs/agro-compatibility.md`: Phase 3 present-tense default updated to the agro latest fallback; stored legacy `image.ref` stays

Not edited (review only): `README.md`, `.agro/cli/README.md`, `.agro/scripts/README.md`, `docs/lifecycle-commands.md`.

## STE

Command:

```bash
bash .agro/skills/ste/scripts/ste-check.sh docs/installation.md docs/quickstart.md docs/agro-compatibility.md
```

Exit status: `1`

The checker reported 83 findings in 3 files. None of the findings named the edited lines (`docs/installation.md:174`, `docs/quickstart.md:88-90`, `docs/agro-compatibility.md:313-319`). Pre-existing findings were not rewritten.
