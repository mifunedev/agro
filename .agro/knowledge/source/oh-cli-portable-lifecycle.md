---
title: "oh CLI Portable Lifecycle"
slug: oh-cli-portable-lifecycle
kind: repo
tags: [cli, oh, agro, lifecycle, standalone, registry, sandbox, remote-fetch, execution-target, update, self-upgrade, npm]
created: 2026-07-03
updated: 2026-09-10
sources:
  - .agro/cli/src/cli.ts
  - .agro/cli/src/commands/sandbox.ts
  - .agro/cli/src/commands/lifecycle.ts
  - .agro/cli/src/commands/update.ts
  - .agro/cli/src/lib/registry.ts
  - .agro/cli/src/lib/compat.ts
  - .agro/cli/src/commands/migrate.ts
  - .agro/cli/src/lib/migrate.ts
  - .agro/cli/build.mjs
  - .agro/cli/src/lib/product.ts
  - .agro/cli/src/commands/self-upgrade.ts
  - .agro/cli/package.json
  - .agro/cli/legacy/package.json
  - .devcontainer/Dockerfile
  - .agro/cli/src/lib/manifest.ts
  - .agro/cli/src/lib/vendor.ts
  - .agro/manifest.json
  - .agro/cli/src/lib/execution/target.ts
  - .agro/cli/src/lib/execution/docker-compose-target.ts
  - .agro/cli/src/lib/remote.ts
  - .agro/cli/src/lib/project.ts
  - .agro/scripts/docker-compose.sh
  - .agro/scripts/gateway.sh
  - .agro/evals/probes/sandbox-registry.sh
  - .agro/README.md
  - docs/lifecycle-commands.md
  - docs/oh-directory-layout.md
  - docs/rfcs/rfc-brain-hands-boundary.md
verified_at: c078c91e80647bc0c60cebb7ad1f11d929159d33
related: [fresh-machine-setup, compose-env-boundary]
confidence: provisional
---

# oh CLI Portable Lifecycle

## Relevant Source Files
- `.agro/cli/src/lib/registry.ts` — the sandbox registry: `registryRoot()`, `entryRoot()`, `listEntries()`, `nextDefaultName()`, `materialize()`, `resolveSandboxRoot()`, and `DEFAULT_NAME_PREFIX` (`registry.ts:16`).
- `.agro/cli/src/lib/compat.ts` — the generation table, `DEFAULT_GENERATION`/`DEFAULT_SANDBOX_NAME`, `resolveControlDir`, `resolveConfigFile`, `resolveProjectLayout`, `resolveRegistryHome`, `resolveUserStateHome`, `resolveSeedSource`, `aliasedEnvValue`/`aliasedEnvPair`, and `remoteControlDirScript`.
- `.agro/cli/src/commands/migrate.ts`, `.agro/cli/src/lib/migrate.ts` — `agro migrate [--check] [--home] [--json]`: the plan/apply engine, `PROVIDER_LINKS`, `RETIRED_SUFFIX`, `LOCK_FILE`.
- `.agro/cli/build.mjs` — the `oh-asset:` esbuild plugin that inlines the four compose files and three scripts from `OH_ASSET_ROOT` (default: the repository root) into `dist/agro.js`, copied to `dist/oh.js`.  The specifier prefix is still `oh-asset:`; only the asset paths moved.
- `.agro/cli/src/lib/product.ts` — `resolveProduct(argv[1])`: basename `oh` → `LEGACY_PRODUCT`, else `AGRO_PRODUCT`.
- `.agro/cli/src/commands/self-upgrade.ts` — `classifyInstallation`, `runSelfUpgrade` (`agro update`).
- `.agro/cli/package.json` (`@mifune/agro`, bin `agro`); `.agro/cli/legacy/package.json` (`@mifune/openharness`, bin `oh`, exact pin). Since #943 `homepage`, `repository.url`, and `bugs.url` in both name `mifunedev/agro`.
- `.agro/cli/src/commands/sandbox.ts` — `oh sandbox install <runtime>` (wizard, entry write, materialise, provision) and `oh sandbox list`.
- `.agro/cli/src/commands/lifecycle.ts` — `oh shell|stop|restart|logs|ps|destroy [name]`; thin wrappers over the `ExecutionTarget` contract and the materialised wrapper script.
- `.agro/cli/src/lib/execution/target.ts`, `docker-compose-target.ts` — the provider-neutral contract and its one adapter, which owns the engine argv.
- `.agro/cli/src/cli.ts` — `main` threads the product `bin` into help and errors and dispatches `update` by product; `parseUpdateArgs`, `resolveUpdateSource`, `runWithRemoteSource`, `--sandbox` on `config` / `secret`.
- `.agro/cli/src/commands/update.ts` — the `.agro/` + `crons/` bootstrap and upgrade.
- `.agro/cli/src/lib/remote.ts` — `fetchRemoteSource`: shallow clone, `GIT_TERMINAL_PROMPT=0`, bounded timeout; `DEFAULT_REPO_URL` (`remote.ts:4`) is `https://github.com/mifunedev/agro`.
- `.agro/cli/src/lib/project.ts` — equipped-root walk-up resolver, still used by the in-repo verbs; since #940 it recognizes `.oh/` or `.agro/` through `resolveControlDir` (`.agro/cli/src/lib/compat.ts`) and fails closed when both exist and differ.
- `.agro/cli/src/lib/execution/runner.ts` — `requireLifecycleScript(root, rel)` joins `resolveProjectLayout(root).controlDir` with `scripts/`, so every verb reaches the wrapper through whichever generation the root actually carries (`runner.ts:69-78`).
- `.agro/scripts/docker-compose.sh`, `gateway.sh` — the scripts the verbs delegate to; the wrapper sources its sibling `compat.sh` to pick `agro.json` or `oh.json` and exits 2 when the sibling is missing or the two configs differ.
- `.agro/evals/probes/sandbox-registry.sh` — the tier-A probe that pins the bundled texts to the tracked files and forbids engine argv outside the wrapper.

## Summary
Issue #950 moved sandbox configuration out of the project checkout. `agro sandbox install docker` runs from any directory: a wizard writes a **registry entry** under `<registry home>/sandboxes/<name>/`, the CLI materialises the compose files and wrapper script it bundles into that entry, and the container starts. `agro shell <name>` and the other lifecycle verbs resolve a sandbox by name from anywhere; a project checkout is an optional `--repo` bind mount. Since #941 one bundle answers to two names, `agro` (canonical) and `oh` (compatibility alias), chosen by the invoked name. Since #942 every state name has two generations and the CLI resolves the pair rather than choosing one: absent state resolves to the AGRO generation (`.agro/`, `agro.json`, `~/.agro`, `/opt/agro-seed`), existing legacy state keeps resolving to `.oh/` and `oh.json`, and `agro migrate` is the one verb that moves a workspace or a registry across. `oh update` writes the control-plane + `crons/` payload and only that; `agro update` upgrades the installed executable. Top-level `agro` help (`cli.ts:103-114`) lists `agro update` as CLI self-upgrade; `oh` help lists `oh update` as vendoring. `oh init`, `oh runtime`, and `templates/` no longer exist; an installed `agro` file carries everything a sandbox needs.

## Detail
**A registry entry is a root.** `registryRoot()` is `<home>/sandboxes` where the home comes from `resolveUserStateHome` in `compat.ts`: `AGRO_HOME`, then `OH_HOME`, then the resolved pair of `<homedir>/.oh/sandboxes` and `<homedir>/.agro/sandboxes` — legacy-only keeps `~/.oh`, agro-only or byte-identical or **neither present** resolves to `~/.agro` (`DEFAULT_GENERATION` is `agro` since #942), and both-present-and-different raises `CompatConflictError`. Names match `^[a-z0-9][a-z0-9-]*$` (`registry.ts:14`). Each entry holds the layout the wrapper expects of a repo: the config file, an optional `.env` (secrets), `.devcontainer/docker-compose.yml` plus the ssh and docker-sock overlays, and `<control dir>/scripts/docker-compose.sh` + `check-host-port.sh` + `compat.sh`. Both halves resolve per entry: `materialize()` writes the three scripts under `resolveProjectLayout(entry).controlDir`, so a fresh entry gets `.agro/scripts/…` and an entry created by an earlier release keeps `.oh/scripts/…`, and `writeOhConfig` writes `agro.json` for the fresh one and `oh.json` for the legacy one. A fresh entry never gains a second control plane, and `sandbox-registry.sh` asserts both directions. `materialize()` writes **six** files per call — one compose base, the two overlays, and the three scripts — from the bundled texts on every lifecycle call, so the entry always matches the CLI version and the operator edits only the config file. Without `repo` the base is the image-only compose file; with `repo` it is the checkout-binding file, whose bind and build context read `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}` — the `..` default keeps CI and an in-checkout run byte-identical, and the `OH_` middle term keeps an entry rendered by a pre-#942 CLI working.

**Bundled assets.** `registry.ts` imports the seven candidate texts through `oh-asset:<repo-relative path>` specifiers; `build.mjs` resolves them under `OH_ASSET_ROOT` (default: the repository root above `.agro/cli`) and inlines them as text, failing the build when one is missing. The sandbox image stages exactly those seven files under `/opt/agro-assets` and builds with `OH_ASSET_ROOT=/opt/agro-assets` (`.devcontainer/Dockerfile:51-57`), because it copies only `.agro/cli/` into `/opt/oh`; it symlinks `/usr/local/bin/agro` → `dist/agro.js` and `/usr/local/bin/oh` → `dist/oh.js`. The image stages one workspace seed, `/opt/agro-seed`; `compat_seed_src` still prefers `/opt/oh-seed` when an older image carries one. Every other build site runs inside a full checkout. `sandbox-registry.sh` compares what a materialised entry contains against the tracked files byte for byte, so a change to a compose file without a rebuild is a REGRESSION, and it fails if `lifecycle.ts` or `sandbox.ts` ever spawns `docker` directly.

**One bundle, two products.** `resolveProduct(process.argv[1])` (`product.ts`) returns `LEGACY_PRODUCT` only when the invoked basename, extension stripped, is `oh`; every other name is `AGRO_PRODUCT`. `main` (`cli.ts`) threads `bin` into help and error prefixes; `oh` adds a one-line compatibility note. `@mifune/agro` ships `dist/agro.js` as `agro`; `@mifune/openharness` is a code-free shim whose `bin/oh.js` imports `@mifune/agro/dist/agro.js` at an exact pin (`legacy/package.json`). Both packages, both image names, and the release assets come from one build — [[release-versioning]].

**`agro sandbox install <runtime>`** (`sandbox.ts:143`) accepts `docker`; `microsandbox` refuses with a pointer to `docs/rfcs/rfc-runtime-support.md` and to `oh tool install microsandbox` (the runtime catalog in `lib/runtimes/catalog.ts` now lists only those two). On a TTY without `--yes` the wizard asks name, timezone, git identity, SSH (with host port), and the Docker socket; `--yes` keeps every default (name `agro-sbx-<n>` for the lowest unused integer — `DEFAULT_NAME_PREFIX` at `registry.ts:16`, the scan at `registry.ts:76-83`; host `TZ`; global git identity; SSH and socket off). With `--repo <dir>` the defaults seed from that checkout's config file, resolved as `agro.json` or a legacy `oh.json`, and `repo` is written into the entry. `--image=<ref>` is persisted as `image.ref` so later verbs render the same image; `--print-argv` materialises into a temporary preview root and writes no entry (`sandbox.ts:196`). Success prints `next: oh shell <name>`. `agro sandbox list [--json]` shows name, runtime, status from `target.status()`, and repo. Bare `agro sandbox` prints help and exits 1; there is no implicit `up`.

**Name resolution.** Every lifecycle verb calls `resolveSandboxRoot({ name, cwd })` (`lifecycle.ts:94`): an explicit name → that entry; else the single registered entry; else the entry whose `repo` contains `cwd`; else an error listing the registered names (or, with an empty registry, `create one with oh sandbox install docker`). `agro destroy <name>` prompts for the name unless `--yes`, runs `down -v`, then removes the entry directory (`lifecycle.ts:323-371`). `agro config show|set --sandbox <name>` and `agro secret set|list --sandbox <name>` act on the entry; without the flag they use `resolveProjectRoot` on the equipped checkout as before (`cli.ts`, `main`).

**Rendering.** The verbs still render the entry's config into a temporary `compose.env` passed as `--extra-env-file` (`lifecycle.ts:50-78`); the path key is `AGRO_REPO_DIR` (`config-render.ts:41`) and the compose files read it as `${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}` — [[compose-env-boundary]] owns the full set and the fallback chain. Nothing seeds a `.devcontainer/.env`; the wrapper reads `<root>/.env` for secrets.

| Verb | Side | Route | Delegates to |
| --- | --- | --- | --- |
| `agro sandbox install docker` | hands | wizard → entry `agro.json` → `materialize()` → `provision()` | `bash <entry>/<control dir>/scripts/docker-compose.sh --repo-dir <entry> up -d --build\|--no-build` |
| `agro shell [name]` | hands | `attach({argv:["zsh"], user:"sandbox"})` | the adapter's engine argv (`docker-compose-target.ts`) |
| `agro stop\|restart\|logs\|ps\|destroy [name]` | hands | `resolveSandboxRoot()` → `materialize()` → wrapper | `bash <entry>/<control dir>/scripts/docker-compose.sh <compose verb>` |
| `agro migrate [--check\|--home\|--json]` | hands | `planMigration()` → `applyMigration()` under `.agro-migrate.lock` | nothing — it renames, retires and relinks in place |
| `agro gateway <args…>` | brain | none — deliberately not routed | `bash <control dir>/scripts/gateway.sh` with both `AGRO_PROJECT_ROOT` and `OH_PROJECT_ROOT` set to `<root>` (`aliasedEnvPair`, `lifecycle.ts:383`) |

**`oh update` is the payload bootstrap.** `resolveUpdateSource` (`cli.ts`, `resolveUpdateSource`) picks `--from <dir>` > `--from-remote [--ref]` > the CLI's own bundled payload (manifest marker) > a remote fetch with a one-line notice. Both ends resolve through compat: `resolveControlDir(fromDir)` picks the source control plane and refuses when it is absent in both spellings (`update.ts:60-70`), and `resolveControlDir(targetDir)` picks the target's — when the target has neither, the payload lands in a directory named after the **source's** basename (`update.ts:74-76`), so bootstrapping from an AGRO checkout creates `.agro/` and bootstrapping from a legacy one still creates `.oh/`. A target with no control plane reads as version `0.0.0` (`update.ts:44-53`) and receives the full payload; a second run prints `already up to date (v…)` (`update.ts:91`). It writes only what `.agro/manifest.json` ships — the control-plane include list plus `crons/**` — and never the config file, `.env`, `AGENTS.md`, `.gitignore`, `.devcontainer/`, or provider directories; the operator owns those. `templates/**` left the manifest with the scaffold. `copyOhPayload()` still walks only the resolved source control dir and writes only below the resolved target one (`vendor.ts`), so root `docs/` stays project-owned. It does not upgrade the CLI (`printUpdateHelp`).

**`agro update` upgrades the executable.** As `agro`, `update` dispatches to `runSelfUpgrade` (`cli.ts`, `main`); `parseUpdateArgs` rejects the payload flags `--from`, `--from-remote`, `--ref`, `--force` (`PAYLOAD_UPDATE_FLAGS`) with a pointer to `oh update`. `classifyInstallation` realpaths `argv[1]`: `node_modules/@mifune/openharness/` → `legacy-package`, `node_modules/@mifune/agro/` → `npm` (owning prefix), `/opt/oh/` → `image`, `dist/` beside `src/` + `package.json` → `source`, unresolvable → `unknown`, else `standalone`. Only `npm` and `standalone` proceed; the rest refuse with the supported procedure (`refuseUnsupported`). The `agro` on PATH must realpath to the target (`assertOnlyAgroOnPath`) and the target's `--version` must equal the running version (`assertTargetIsSelf`). npm: `npm view`, refuse a downgrade, `npm install -g --prefix <prefix> @mifune/agro@<v>`, re-read `--version`. Standalone: fetch `AGRO_JS_URL` (`OH_JS_URL` fallback; default `DEFAULT_ARTIFACT_URL` = the `releases/latest/download/agro.js` asset), require a writable directory (never escalate), check shebang and `--version`, refuse a downgrade, copy the target to `<target>.prev`, rename the temp file over it, re-verify, restore `.prev` on mismatch, delete it on success. `--dry-run` reports kind, target, and versions.

**`agro migrate` moves a workspace across generations.** It is the only verb that renames state, and it is opt-in: nothing on the boot path or the lifecycle path migrates anything. Project mode (the default) walks up from the cwd to the nearest ancestor holding `.oh`, `.agro`, `oh.json` or `agro.json` (`ROOT_MARKERS`, `findProjectRoot`), renames `.oh/` → `.agro/` and `oh.json` → `agro.json` wholesale, and re-points three active provider symlinks: `.claude/skills`, `.claude/hooks`, and `.agents/skills` (`PROVIDER_LINKS`). Their targets change from `../.oh/<target>` to `../.agro/<target>`. Retired `.pi/skills` and `.codex/skills` links move to `<path>.migrated` only with an independent `.agents/skills` replacement. Both the retired link and replacement must resolve to the Open Harness pack. Otherwise, migration preserves the retired path and re-points legacy `../.oh/skills` links to `../.agro/skills`. Custom directories and foreign links remain unchanged. A retirement marker collision blocks retirement. Active links that are absent, already AGRO, or point elsewhere report `noop`. When both spellings exist and are byte-identical the legacy copy is retired to `<name>.migrated` (`RETIRED_SUFFIX`) rather than deleted; when they diverge the run is **refused** with the differences printed and nothing is merged or removed. `--home` migrates `~/.oh/sandboxes` → `~/.agro/sandboxes` instead, and reports a `noop` when `AGRO_HOME`/`OH_HOME` names the registry home explicitly, because an explicit home holds no `.oh` or `.agro` directory to rename (`resolveRegistryHome`, `migrate.ts:188-193`). `--check` prints the plan and writes nothing; `--json` emits the plan or `{plan, result}`. One run holds `.agro-migrate.lock` (`LOCK_FILE`) under the root, a second run over migrated state is a `noop`, and the exit codes are 0 applied-or-nothing-to-do, 2 refused (conflict or lock), 1 failure. `~/.openharness`, `.env` and `.git` are never touched. `oh migrate` reaches the same code — the verb is on both products.

**Remote fetch** — `git clone --depth 1 [--branch <ref>] -- <url> <tmp>` of `DEFAULT_REPO_URL` = `https://github.com/mifunedev/agro` (`remote.ts:4`) with `GIT_TERMINAL_PROMPT=0` and a 120 s timeout; `runWithRemoteSource` prints `fetched payload vX (installed CLI vY)` (`cli.ts`) so version skew is visible. Public HTTPS only. US-006 of the cutover flipped that default, `DEFAULT_ARTIFACT_URL` (`self-upgrade.ts:66`, `https://github.com/mifunedev/agro/releases/latest/download/agro.js`), and `SOURCE_DOCS_BASE` (`lib/docs.ts:1`, `https://github.com/mifunedev/agro/blob/main/`) to the canonical repository after the GitHub rename; the old repository path still resolves through GitHub's redirect. `DEFAULT_SANDBOX_IMAGE` (`lifecycle.ts:104`) is `ghcr.io/mifunedev/agro:latest`. Explicit `image.ref` and `AGRO_SANDBOX_IMAGE` over `OH_SANDBOX_IMAGE` are unchanged. GHCR still dual-publishes the same digest to `openharness`. Metadata moved first: `homepage`, `repository.url`, and `bugs.url` in `.agro/cli/package.json` and `legacy/package.json` name `mifunedev/agro`, the image label `org.opencontainers.image.source` is `https://github.com/mifunedev/agro` (`.devcontainer/Dockerfile:127`), and `.agro/README.md` names the docs source `mifunedev/agro-web`.

**Troubleshooting / limits**
- Host prerequisites: Node.js ≥ 20, git, docker; `get-agro.sh` or `npm install -g @mifune/agro` installs the CLI ([[fresh-machine-setup]]). No checkout is needed.
- A sandbox created before #950 from a checkout (compose project = the checkout's `.devcontainer/`) is not in the registry; `agro sandbox install docker --name <its name> --repo <checkout>` adopts the compose project and its volumes.
- A registry entry or checkout created before #942 keeps its `.oh/` + `oh.json` spelling and every verb keeps resolving it. Nothing forces the rename; `agro migrate` performs it when the operator asks, and refuses rather than guessing when both spellings exist and differ.
- This repository's own `agro.json` still declares `"name": "openharness"`, so its compose project name, container name and volumes are unchanged by the rename. Only an **unnamed** sandbox falls back to the new `agro` identity.
- `SANDBOX_NAME` in the process environment overrides the rendered name, so evidence runs inside another sandbox must `env -u SANDBOX_NAME`.
- The brain/hands rationale, the state classes, and why `attach()` is synchronous live in `docs/rfcs/rfc-brain-hands-boundary.md`; cite it, do not restate it.

## System Relationships
```mermaid
flowchart LR
  OP[operator, any cwd] --> RP["agro | oh → resolveProduct(argv[1])"]
  RP --> SI["agro sandbox install docker"]
  SI --> WZ[wizard / --yes defaults] --> ENTRY["&lt;registry home&gt;/sandboxes/&lt;name&gt;/agro.json"]
  BUNDLE[bundled compose + wrapper texts in dist/agro.js ≡ dist/oh.js] --> MAT["materialize()"] --> ENTRY
  ENTRY --> PV["ExecutionTarget.provision()"] --> DC["docker-compose.sh --repo-dir &lt;entry&gt; up -d"]
  REPO["--repo &lt;checkout&gt;"] -. AGRO_REPO_DIR bind .-> DC
  RP --> SH["agro shell|ps|logs|stop|restart|destroy [name]"] --> RS["resolveSandboxRoot()"] --> ENTRY
  RP --> UP["oh update [--from|--from-remote]"] --> PAYLOAD["control dir + crons/ into a checkout"]
  RP --> MG["agro migrate [--check|--home]"] --> MOVED[".oh/→.agro/, oh.json→agro.json, provider links re-pointed"]
  CMP["compat.ts resolveProjectLayout / resolveUserStateHome"] -.resolves.-> ENTRY
  CMP -.resolves.-> PAYLOAD
  RP --> SU["agro update → runSelfUpgrade"] --> EXE["installed executable: npm prefix | standalone file"]
  PROBE[sandbox-registry.sh] -.pins.-> BUNDLE
```

## See Also
- [[fresh-machine-setup]]
- [[compose-env-boundary]] — the rendered set and why `OH_REPO_DIR` is in it.
- [[release-versioning]] — the release pipeline; `version-parity.sh` requires root == CLI plus CHANGELOG, and shim pin == shim version.
- `docs/rfcs/rfc-brain-hands-boundary.md` — authority for the brain/hands split this entry routes through.
