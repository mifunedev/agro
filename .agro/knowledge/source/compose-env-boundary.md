---
title: "Compose Environment Boundary"
slug: compose-env-boundary
kind: repo
tags: [compose, devcontainer, oh-json, cli, entrypoint, boundary, installs, sandbox, registry]
created: 2026-08-31
updated: 2026-09-07
sources:
  - .devcontainer/docker-compose.yml
  - .devcontainer/docker-compose.image-only.yml
  - .devcontainer/Dockerfile
  - .devcontainer/entrypoint.sh
  - .agro/scripts/link-providers.sh
  - .agro/cli/src/lib/config-render.ts
  - .agro/cli/src/lib/registry.ts
  - .agro/cli/src/commands/harness.ts
  - .agro/cli/src/commands/tool.ts
  - .agro/evals/probes/compose-env-boundary.sh
  - .agro/evals/probes/harness-one-door.sh
  - .agro/evals/probes/sandbox-registry.sh
verified_at: 4db24429bbf08c521b62ad6386fd1370445ac203
related: [sandbox-dependency-installs, oh-cli-portable-lifecycle]
confidence: confirmed
---

# Compose Environment Boundary

## Relevant Source Files
- `.devcontainer/docker-compose.yml` — the checkout-binding compose file; its `environment:` block is the surface this page constrains, and its bind and build context read `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}`.
- `.devcontainer/docker-compose.image-only.yml` — the default base for a registry sandbox (no checkout); its `environment:` block is byte-identical to the other file's.
- `.devcontainer/entrypoint.sh` — the `oh_config` / `oh_config_truthy` helpers that read the config file at boot; installs nothing. It sources `/opt/agro-assets/.agro/scripts/compat.sh` on its first line (`.devcontainer/entrypoint.sh:5`), so the seed path recognizes `.oh/` or `.agro/`, either `.image-seeded` marker, and either seed directory before the control plane exists, and it resolves the control dir once into `CONTROL_DIR` (`.devcontainer/entrypoint.sh:211`) — see [[sandbox-dependency-installs]].
- `.agro/cli/src/lib/config-render.ts` — renders the host-side subset into a temporary `compose.env`; refuses `RETIRED_KEYS`.
- `.agro/cli/src/lib/registry.ts` — materialises the base compose file, the overlays, the wrapper, `compat.sh`, and `check-host-port.sh` into a registry entry, which is the root the wrapper runs from; the two script destinations sit under the entry's *resolved* control dir (`resolveProjectLayout(entry).controlDir`).
- `.agro/cli/src/commands/harness.ts`, `.agro/cli/src/commands/tool.ts` — the only install door.
- `.devcontainer/Dockerfile`, `.agro/scripts/link-providers.sh` — the Hermes image default and additive integration validation.
- `.agro/evals/probes/compose-env-boundary.sh`, `.agro/evals/probes/harness-one-door.sh`, `.agro/evals/probes/sandbox-registry.sh` — the tier-A probes that enforce the rules, and pin the bundled compose texts to the tracked files.

## Summary
A value reaches the sandbox through Compose only if a process **outside** the sandbox — or the entrypoint **before** the control plane is readable — must act on it. Everything else lives in `agro.json` — the registry entry's for a sandbox created by `agro sandbox install docker` (#950), the tracked project file for in-repo settings — and is read inside the container through the CLI. Installs are not configuration at all: a harness or tool enters the sandbox only when the operator runs `oh harness install <id>` or `oh tool install <id>` (#948), so neither Compose nor `agro.json` carries an install key. Since #942 the rendered path keys carry the `AGRO_` prefix and every compose interpolation falls back through the legacy `OH_` spelling, so an entry rendered by an older CLI still resolves.

## Detail
Two routes carry configuration into the sandbox. The host-side route renders a fixed set — `SANDBOX_NAME`, `TZ`, `AGRO_HOME_MOUNT`, `AGRO_REPO_DIR`, `GIT_USER_NAME`, `GIT_USER_EMAIL`, `DOCKER_SOCKET`, `SANDBOX_SSH`, `SANDBOX_SSH_PORT`, `AGRO_SANDBOX_IMAGE`, `AGRO_PULL_POLICY` (`.agro/cli/src/lib/config-render.ts:38-51`) — because each selects an overlay, names the project, publishes a port, binds a path, or is needed before `agro.json` is reachable. Only the four prefixed keys were respelled in #942; `SANDBOX_NAME`, `TZ`, the two git identities and the three access keys carry no product prefix and never changed. The set is rendered into a temporary `compose.env` passed to the wrapper as `--extra-env-file`; nothing writes a `.devcontainer/.env`. Both compose files read every prefixed key through one two-step fallback, `${AGRO_<KEY>:-${OH_<KEY>:-<default>}}`, so a registry entry whose `compose.env` an older CLI rendered still resolves and either spelling works. `AGRO_REPO_DIR` is the one entry that is a path rather than a setting: it is the absolute checkout a registry sandbox binds at `/home/sandbox/harness`, rendered only when `repo` is set, and the compose file's `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}` default keeps an in-checkout or CI run identical to before #950. The unnamed fallback identity is now `agro`: the compose `name:`, `container_name:`, and the build flavour's default image read `${SANDBOX_NAME:-agro}` and `sandbox-${SANDBOX_NAME:-agro}`. This repository's own `agro.json` still declares `"name": "openharness"`, so its project name, container name and volumes are unchanged by the rename. A registry entry under `<registry home>/sandboxes/<name>/` is itself a root, and the home resolves through `resolveUserStateHome` — `AGRO_HOME`, then `OH_HOME`, then `~/.agro` unless a legacy `~/.oh/sandboxes` is the only registry present. The CLI materialises the compose base, the overlays and the scripts into the entry on every lifecycle call (`.agro/cli/src/lib/registry.ts`), so the wrapper's `--repo-dir` is the entry and the checkout, when there is one, arrives only through `AGRO_REPO_DIR`. The in-container route reads everything else at the moment it is needed: `oh_config` shells `<CLI_BIN> config show` once — `CLI_BIN` is `compat_env_value BIN` with the default `agro` (`.devcontainer/entrypoint.sh:133-134`) — and answers `jq` filters from the cached JSON, degrading to a caller-supplied default when the CLI is missing or old; `config show` rather than a narrower verb, because a baked CLI can predate a new one on the boot path.

Installs take neither route. Boot provisioning, the `install.*` keys, the persist flags, the boot-time environment off-ramp and the healthcheck failure marker were retired in #948. `oh harness install <id>` and `oh tool install <id>` probe the running sandbox, install as the sandbox user into `NPM_USER_PREFIX` (`/home/sandbox/.local`) inside the home volume, verify with the catalog's `verifyArgv`, and report; they touch no `agro.json` field. Kinds are `installable` / `on-demand` for harnesses and `baked-in` / `installable` for tools; the catalogs own every pin and checksum, and `entrypoint.sh` holds none. A fresh home volume boots with no harness and no `herdr`, and the healthcheck passes anyway.

Four compose `environment:` literals survive that no config read can supply: `SANDBOX_PASSWORD` (consumed by the entrypoint's own user setup), `CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS`, `CC_SAFETY_NET_STRICT` and `CC_SAFETY_NET_WORKTREE` (read by third-party binaries that know nothing of `agro.json`), plus the `GH_TOKEN` secret, which `config-render.ts` refuses to render.

Four guards keep the boundary closed. `RETIRED_KEYS` throws if a `put()` for a retired variable is ever re-added (`.agro/cli/src/lib/config-render.ts`); the compose probe fails on any `INSTALL_*` key, on `OH_IMAGE_ONLY`, or on any `environment:` key outside the rendered set — across every `docker-compose*.yml` including overlays; and `harness-one-door.sh` fails on a `default` kind, a `harnessKey` / `toolKey`, a provisioner script, an `install` key in `oh-config.ts`, a boot-time provisioning gate, or an installable binary in the Dockerfile. `sandbox-registry.sh` compares the seven texts a materialised entry can contain (the two bases, the two overlays, wrapper, port check, `compat.sh`) against the tracked files byte for byte, asserts that a legacy `oh.json` entry keeps materialising under `.oh/scripts/` while a fresh `agro.json` entry gets `.agro/scripts/` and never both, and fails if a lifecycle verb spawns `docker` outside the wrapper. One `materialize()` call writes **six** files: one compose base (image-only without `repo`, checkout-binding with it), the ssh and docker-sock overlays, and `docker-compose.sh`, `compat.sh`, `check-host-port.sh` under `resolveProjectLayout(entry).controlDir`. The config file is written separately by `runSandboxInstall` through `writeOhConfig`, which resolves the same pair and so writes `agro.json` for a fresh entry and `oh.json` for a legacy one. Overlay `ports:` and `volumes:` blocks are unrestricted; that payload is the part only Docker can act on.

Non-goals: the image-only base is the default for a registry sandbox, because the image stages one seed at `/opt/agro-seed` regardless (`compat_seed_src` still prefers a legacy `/opt/oh-seed` when an older image carries one); `INSTALL_PYTHON_KERNEL` and `provision-python.sh` remain, a Dockerfile↔entrypoint duplication rather than a compose one; `start_period: 600s` was sized for the retired provisioning window and is tracked for retuning on #948. The compose `healthcheck:` is the one compose field that carries a control-plane path: it is a `bash -c` line that runs `.agro/scripts/sandbox-healthcheck.sh` when `.agro/` exists and otherwise falls through to `.oh/`, resolving at run time rather than at render time, because the compose text is materialised before the workspace volume is seeded.

Hermes adds a sandbox-internal default, not a Compose setting. The image sets
`HERMES_HOME=/home/sandbox/harness/.hermes` (`.devcontainer/Dockerfile:4`). Managed
installation validates the launch home and reconciles additive shared skills before
installation, verifies the executable, and reconciles again afterward
(`.agro/cli/src/commands/harness.ts:175`, `.agro/cli/src/commands/harness.ts:226`).
The canonical linker refuses unset or relative managed launch homes and conflicting
occupied paths (`.agro/scripts/link-providers.sh:110`). Ordinary provider linking in another
worktree does not redirect the image-global Hermes runtime
(`.agro/scripts/link-providers.sh:189`). No Compose variable or install setting changed.

## System Relationships
```mermaid
flowchart LR
  OH[agro.json - registry entry or tracked project file]
  OH -->|host-side subset| CR[config-render.ts]
  CR --> ENV[temporary compose.env]
  ENV --> DC[docker-compose.sh --extra-env-file]
  REG[registry.ts materialize] --> DC
  REPO["repo / AGRO_REPO_DIR, OH_REPO_DIR fallback"] -. bind .-> COMPOSE
  DC --> COMPOSE[compose environment:]
  COMPOSE --> EP1[entrypoint.sh - compat.sh, pre-control-plane]
  OH -->|everything else| CLI[oh CLI in the container]
  CLI --> EP2[entrypoint.sh oh_config]
  OP[operator] -->|oh harness install / oh tool install| CLI
  CLI --> CAT[harness + tool catalogs]
  CAT --> HOME[/home/sandbox/.local in the home volume/]
  PROBE[compose-env-boundary.sh] -.enforces.-> COMPOSE
  DOOR[harness-one-door.sh] -.enforces.-> CAT
  SR[sandbox-registry.sh] -.pins.-> REG
  RK[RETIRED_KEYS] -.throws on.-> CR
```

## See Also
- [[sandbox-dependency-installs]]
- [[oh-cli-portable-lifecycle]]
