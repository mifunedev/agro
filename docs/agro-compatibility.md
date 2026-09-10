# AGRO compatibility contract

Open Harness is migrating to AGRO (Agent Governance Runtime Orchestrator) under
epic [#939](https://github.com/mifunedev/agro/issues/939). This page is the
compatibility contract: the Phase 0 resolver
([#940](https://github.com/mifunedev/agro/issues/940)) that lets the
runtime understand both naming generations, the Phase 1 entry points and
artifacts ([#941](https://github.com/mifunedev/agro/issues/941)) that put
`agro` in the operator's hands without changing any persisted default, and the
Phase 2 cutover ([#942](https://github.com/mifunedev/agro/issues/942))
that makes AGRO the fresh-state default and ships `agro migrate`, and the Phase 3
identity cutover ([#943](https://github.com/mifunedev/agro/issues/943)) that makes
`mifunedev/agro` and `agro.mifune.dev` the canonical external names.

## What Phase 0 changes, and what it does not

Phase 0 changed no default. A project with `.oh/`, `oh.json`, and `OH_*`
variables behaves exactly as before, and still does. Phase 0 shipped no `agro`
executable, package, command, or image; Phase 1 did, below. Through Phase 1 a
fresh sandbox still created `~/.oh/sandboxes/`, `oh.json`, and `.oh/`; Phase 2
flipped that, and only that.

Phase 0 adds one resolver, in two boot-safe forms, that both generations pass
through:

| Surface | Legacy | AGRO | Resolver |
|---|---|---|---|
| Project control directory | `.oh/` | `.agro/` | `resolveControlDir`, `compat_control_dir` |
| Project config file | `oh.json` | `agro.json` | `resolveConfigFile`, `compat_config_file` |
| Environment variables | `OH_*` | `AGRO_*` | `resolveAliasedEnv`, `compat_env` |
| Host registry home | `~/.oh` | `~/.agro` | `resolveUserStateHome` |
| Image seed | `/opt/oh-seed` | `/opt/agro-seed` | `resolveSeedSource`, `compat_seed_src` |
| First-boot marker | `.oh/.image-seeded` | `.agro/.image-seeded` | `compat_marker_file` |

The TypeScript module is `.agro/cli/src/lib/compat.ts`. The shell adapter is
`.agro/scripts/compat.sh`; it needs only bash and coreutils, so the entrypoint can
use it before Node or the control plane exists. Both consume the same vectors in
`.agro/cli/src/lib/__tests__/fixtures/compat-vectors.json`, and a test runs every
vector through each implementation.

## Precedence and conflicts

Files and directories:

| State | Result |
|---|---|
| Neither generation present | `absent` |
| Legacy only | `legacy-only`; the legacy path is used |
| AGRO only | `agro-only`; the AGRO path is used |
| Both present and byte-identical | `both-equivalent`; the AGRO path is canonical |
| Both present and different | Fail closed with an error that names the differing entries |

Equivalence is byte identity: entry sets, entry types, permission bits, symlink
targets, and file contents. No normalization is applied. A formatting-only
difference between `oh.json` and `agro.json` is a conflict. A conflict never
merges; the operator keeps exactly one copy or makes them identical.

Environment variables:

1. An explicit command flag wins.
2. `AGRO_<NAME>` wins when it is set to a non-empty value.
3. `OH_<NAME>` applies when `AGRO_<NAME>` is unset or empty.
4. An empty value is treated as unset, matching every existing consumer.
5. When both are set and differ, the resolver warns with the two key names and
   the selected key. It never prints a value.

The registry home follows the same rule: `AGRO_HOME`, then `OH_HOME`, then
discovery. Discovery keeps `~/.oh` unless `~/.agro/sandboxes` is the only
registry, or both registries exist and are byte-identical. Two registries that
differ fail closed. `~/.openharness` is a legacy product checkout, never registry
content, and discovery ignores it.

The image seed selects `/opt/agro-seed` only when it is the sole seed directory.
The entrypoint seeds a workspace only when it holds neither `.oh/` nor `.agro/`,
stamps the marker inside whichever control directory the seed produced, and never
seeds a workspace whose two control directories diverge.

## Migration engine

`.agro/cli/src/lib/migrate.ts` implements the engine that Phase 2 exposes as
`agro migrate`. Phase 0 shipped no command; Phase 2 ships it.

- `planMigration(spec)` inspects the tree and returns a JSON-serializable plan
  with `status` (`ready`, `noop`, or `conflict`), ordered steps, and conflicts. It
  never mutates anything.
- Steps are `rename` (legacy → AGRO path, same-filesystem rename), `retire`
  (byte-identical pair: the legacy copy moves to `<name>.migrated` and stays
  recoverable), `rewrite` (caller-supplied literal replacements in one file),
  and `noop`.
- `applyMigration(plan)` refuses a `conflict` plan, returns `noop` for an
  already-migrated tree, takes an exclusive `.agro-migrate.lock`, revalidates
  every planned entry against the snapshot taken at plan time, and then applies
  the steps in order. If a step fails, it stops and reports which steps completed
  and which remain. Repeated apply is a no-op.
- Paths must be absolute and inside the migration root after symlink
  resolution. Renames preserve unknown files, permission bits, and symlink
  targets because the tree moves as one entry.
- There is no force option. Nothing merges.

`projectMigrationSpec(root)` covers `.oh/` → `.agro/` and `oh.json` →
`agro.json`. `userStateMigrationSpec(home)` covers only `~/.oh/sandboxes` →
`~/.agro/sandboxes`.

## Legacy contract inventory

`.agro/compat-inventory.json` classifies every `OH_*` identifier in tracked files
and every persisted legacy path as one of `migrate-later`, `alias-sla`,
`retained-generic`, or `obsolete`, with the owning phase. The test
`compat-inventory.test.ts` and the probe `agro-compat-inventory.sh` fail when an
identifier appears in the tree without a classification, when a non-obsolete
entry goes stale, or when an `alias-sla` entry lacks its `AGRO_*` spelling.

## Phase 1 — entry points and artifacts

Phase 1 ([#941](https://github.com/mifunedev/agro/issues/941)) introduces
the `agro` name at every entry point and publishes the AGRO artifacts beside the
legacy ones. It changes no persisted default.

### Product identity by executable name

There is one bundle. `.agro/cli/dist/agro.js` and `.agro/cli/dist/oh.js` are
byte-identical (`bundle-identity.test.ts`). The CLI derives its product identity
from the basename of the invoked executable (`process.argv[1]`, symlinks not
resolved, Windows extensions stripped): run as `agro`, it says `agro` in help,
errors, and version output; run as `oh`, it says `oh` and ends its help with a
line that names `agro` as the canonical CLI. There is no build-time fork.

### Packages

- `@mifune/agro` (`.agro/cli/`) is the canonical npm package and ships only the
  `agro` executable.
- `@mifune/openharness` (`.agro/cli/legacy/`) is a delegation shim. It ships only
  the `oh` executable, contains no CLI code, and pins the exact `@mifune/agro`
  version it delegates to, so `oh --version` and `agro --version` from one
  release agree. It is deprecated on npm immediately after each publication and
  stays installable through the SLA.
- The two packages may be installed together. Installing or removing either
  never removes the other's executable. `npx @mifune/agro <verb>` works.

### `agro update` and `oh update`

`agro update` upgrades the running `agro` executable through the mechanism that
installed it — npm (`npm view`, then `npm install -g --prefix <owning prefix>
@mifune/agro@<version>`) or a standalone file (download `AGRO_JS_URL`, falling
back to `OH_JS_URL` and defaulting to the latest `agro.js` release asset; verify
shebang and `--version`; rename over the executable; keep `<path>.prev` until the
new file verifies). It refuses image-shipped (`/opt/oh`), source-checkout,
legacy-package, unresolvable, read-only, PATH-shadowed, and downgrade targets
with the supported procedure, never uses `sudo`, and is a no-op when current. It
rejects `--from`, `--from-remote`, `--ref`, and `--force`.

`oh update` keeps its project-payload behavior for the compatibility window:
it vendors the `.agro/` control plane and `crons/` into the current directory and
nothing else. The
verb reference is [lifecycle commands](lifecycle-commands.md).

### `get-agro.sh`

`.agro/scripts/get-agro.sh` is the artifact-only installer. It downloads the
published `agro.js` release asset into `AGRO_BIN_DIR/agro` (default
`~/.local/bin`), offers nvm + Node 22 when Node ≥ 20 is missing, and never
clones, builds, or needs a source checkout. Controls: `AGRO_BIN_DIR`,
`AGRO_JS_URL`, `AGRO_NVM_VERSION`, `AGRO_ASSUME_YES`, each falling back to the
`OH_*` spelling with the Phase 0 precedence (AGRO wins a conflict; the warning
names keys only). `AGRO_GITHUB_REPO` (fallback `OH_GITHUB_REPO`) names the `<owner>/<repo>` whose latest GitHub release hosts the artifacts, so a fork can serve its own `agro.js`; there is no `AGRO_GITHUB_REF` because the installer downloads a release artifact and never checks out source. `get-oh.sh` keeps its `OH_GITHUB_REPO`/`OH_GITHUB_REF` build fallback through the SLA.

### Release artifacts

One release, one build, one commit produces:

- Two npm packages, `@mifune/agro` then `@mifune/openharness`.
- Four immutable GHCR tags from one image digest:
  `ghcr.io/mifunedev/openharness:<version>`, `:sha-<sha>`,
  `ghcr.io/mifunedev/agro:<version>`, and `:sha-<sha>`, verified by
  `verify-release-aliases.sh`, then `latest` promoted on both repositories.
- Four GitHub Release assets: `agro.js`, `oh.js`, `get-agro.sh`, and `get-oh.sh`,
  so `https://github.com/mifunedev/openharness/releases/latest/download/<asset>`
  resolves. GitHub Releases are the transitional artifact host until the Phase 3
  domain cutover; `oh.mifune.dev` keeps serving `get-oh.sh` and `oh.js`.

The sandbox image links `/opt/oh/dist/agro.js` to `/usr/local/bin/agro` beside
`/usr/local/bin/oh`, so both names work inside the sandbox.

### Unchanged in Phase 1

Phase 1 left the control directory `.oh/`, the config file `oh.json`, every
`OH_*` variable, the registry home `~/.oh`, the image seed `/opt/oh-seed`, the
CLI install root `/opt/oh`, and the default image reference
`ghcr.io/mifunedev/openharness:latest` in place. Phase 2 supersedes the first
five of those for fresh state; see below.

## Phase 2 — AGRO is the fresh-state default

Phase 2 ([#942](https://github.com/mifunedev/agro/issues/942)) flips what
a *fresh* installation creates and adds the migration command. Nothing an
existing installation already persisted changes on its own.

### Fresh state resolves to AGRO

An absent pair now resolves to the AGRO generation. The `legacy-only`,
`agro-only`, `both-equivalent`, and divergent cases keep their Phase 0 behavior.

| Surface | Fresh state | Legacy installation |
|---|---|---|
| Project control directory | `.agro/` | `.oh/` keeps resolving |
| Project config file | `agro.json` | `oh.json` keeps resolving |
| Host registry | `~/.agro/sandboxes/<name>/agro.json` | `~/.oh/sandboxes/<name>/oh.json` keeps resolving |
| Image seed | `/opt/agro-seed` | `/opt/oh-seed`, when a legacy image ships it |
| First-boot marker | `.agro/.image-seeded` | `.oh/.image-seeded` is recognised, never re-seeded |
| Default registry name | `agro-sbx-<n>` | an existing name is never rewritten |
| Unnamed compose identity | `agro` | a configured `name` is never rewritten |

The control-plane tree of this repository is now `.agro/`, and its config file is
`agro.json`, so a seeded workspace is self-consistent. This repository keeps
`"name": "openharness"` in `agro.json`, so its own sandbox identity, volumes, and
network are unchanged.

### Compose interpolation

`config-render.ts` renders `AGRO_HOME_MOUNT`, `AGRO_REPO_DIR`,
`AGRO_SANDBOX_IMAGE`, and `AGRO_PULL_POLICY`. The compose files read
`${AGRO_<NAME>:-${OH_<NAME>:-<default>}}`, so a registry entry rendered by an
older CLI still resolves. `OH_PROJECT_ROOT` and `AGRO_PROJECT_ROOT` are both in
`RETIRED_KEYS` and are never rendered.

### `agro migrate`

`agro migrate [--check] [--home] [--json]` exposes the migration engine above.
It renames `.oh/` to `.agro/` and `oh.json` to `agro.json`, retires a
byte-identical legacy copy to `<name>.migrated`, and re-points the five provider
links from `../.oh/...` to `../.agro/...`. `--home` migrates `~/.oh/sandboxes`
instead. It is idempotent, has no force option, fails closed on divergence, and
names `.agro-migrate.lock` when the lock is held. Exit codes: `0` applied or
noop, `2` refused, `1` failure. `oh migrate` dispatches to the same command.
Flags and recipes:
[lifecycle commands](lifecycle-commands.md#migrating-to-the-agro-names-agro-migrate).

### `oh config repo` is an SLA compatibility helper

`oh config repo` (and `agro config repo`) creates a GitHub repository and
re-points `origin` for the retired clone-and-own recipe. It is classified
`alias-sla`: it keeps working under both executable names for the whole
compatibility window, and it is **not** part of canonical onboarding.
Sandbox-first onboarding is the GitHub-login prerequisite plus the two optional
agent prompts in
[Quickstart](quickstart.md#authenticate-github-before-any-repository-work).

### Unchanged in Phase 2

The CLI install root `/opt/oh`, the default image reference
`ghcr.io/mifunedev/openharness:latest`, the `oh.mifune.dev` domain, the GitHub
repository name, the Cloud variables, and the Python kernel home
`~/.local/share/oh/` are unchanged. Every `OH_*` variable, `oh`, `oh.json`
reading, `~/.oh`, and the legacy images stay valid through the SLA.

## Phase 3 — AGRO is the canonical external identity

Phase 3 ([#943](https://github.com/mifunedev/agro/issues/943)) renames the two
GitHub repositories in place and moves the documentation host. It retires
nothing. GitHub redirects a renamed repository, so every old clone, API, and
release URL keeps resolving through the SLA. The operator actions, the
verification matrix, and the rollback are in the
[cutover runbook](agro-cutover-runbook.md).

| Surface | Canonical | Retained through the SLA |
|---|---|---|
| Core repository | `github.com/mifunedev/agro` | `github.com/mifunedev/openharness` (GitHub rename redirect) |
| Docs site source | `github.com/mifunedev/agro-web` | `github.com/mifunedev/openharness-web` (GitHub rename redirect) |
| Documentation host | `https://agro.mifune.dev` | `https://oh.mifune.dev`, see the endpoint table |
| Release assets | `https://github.com/mifunedev/agro/releases/latest/download/<asset>` | the old repository path (GitHub rename redirect) |
| Installer entry point | `https://agro.mifune.dev/get-agro.sh` | `https://oh.mifune.dev/get-oh.sh` |
| npm package metadata | `homepage`, `repository`, and `bugs` of `@mifune/agro` and `@mifune/openharness` name `mifunedev/agro` | the package names are unchanged |
| Image label `org.opencontainers.image.source` | `https://github.com/mifunedev/agro` | the image names are unchanged, see below |

Installer defaults:

- `get-agro.sh`: `AGRO_GITHUB_REPO` defaults to `mifunedev/agro`, so the default
  `AGRO_JS_URL` is `https://github.com/mifunedev/agro/releases/latest/download/agro.js`.
- `get-oh.sh`: `OH_GITHUB_REPO` (the build fallback) defaults to `mifunedev/agro`.
  Its documented entry point stays `https://oh.mifune.dev/get-oh.sh`, and
  `OH_JS_URL` defaults to `https://agro.mifune.dev/oh.js`.

### `oh.mifune.dev` endpoints

Every path on the legacy host keeps working. *Redirect* means a 301 to the same
route on `agro.mifune.dev`. *Compatibility alias* means the path keeps returning
a script body, directly or through a 302 that `curl -fsSL` follows, so an
existing piped install line never receives HTML. *Canonical* means the
location that current documentation names. The Cloudflare rules that implement
the table are operator actions at cutover.

| Endpoint | SLA classification | Resolves to |
|---|---|---|
| `https://oh.mifune.dev/` and every documentation route | redirect | the same route on `https://agro.mifune.dev` |
| `https://oh.mifune.dev/get-oh.sh` | compatibility alias | the `get-oh.sh` script body; the documented legacy installer entry point |
| `https://oh.mifune.dev/oh.js` | compatibility alias | the `oh.js` bundle; the `get-oh.sh` default `OH_JS_URL` |
| `https://oh.mifune.dev/install.sh` | compatibility alias | 302 to the raw `install.sh` on `main` of `mifunedev/agro`; the retired clone-and-own installer |
| `https://oh.mifune.dev/get-agro.sh` | compatibility alias | 302 to `https://agro.mifune.dev/get-agro.sh` (canonical) |
| `https://oh.mifune.dev/agro.js` | compatibility alias | 302 to `https://agro.mifune.dev/agro.js` (canonical) |
| `https://agro.mifune.dev/get-agro.sh` and `/agro.js` | canonical | the current `get-agro.sh` and `agro.js` release assets |
| `https://agro.mifune.dev/install.sh` | compatibility alias | 302 to the raw `install.sh` on `main` of `mifunedev/agro`; the retired clone-and-own installer, served directly from the canonical host |

The `/install.sh` redirect target has a sequencing hazard. The rule currently
points at `.oh/scripts/install.sh` on `main`. That path exists only because
`main` predates the `.oh/` to `.agro/` rename. The first release that carries
the rename to `main` deletes that path. Change the Cloudflare rule target to
`https://raw.githubusercontent.com/mifunedev/agro/main/.agro/scripts/install.sh`
in the same change window as that release. Do not change it earlier: that path
does not exist on `main` yet, and an early change breaks the endpoint.

### Unchanged in Phase 3

The unselected image fallback is `ghcr.io/mifunedev/agro:latest`. An explicit
`image.ref`, `AGRO_SANDBOX_IMAGE`, or `OH_SANDBOX_IMAGE` value stays as stored,
including `ghcr.io/mifunedev/openharness:latest`. Both image names publish from
one digest. The CLI install root `/opt/oh`, the Cloud variables, the
Python kernel home `~/.local/share/oh/`, `oh`, `@mifune/openharness`, `get-oh.sh`,
`oh.js`, every `OH_*` variable, `~/.oh`, and the legacy GHCR tags stay valid
through the SLA. This repository keeps `"name": "openharness"` in `agro.json`.

## Legacy references intentionally left for later phases

- Phase 4: the Cloud CLI variables (`OH_CLOUD_*`, `OH_API_URL`,
  `OH_PROVISION_KEY`).
- Phase 5: retirement of `oh`, `@mifune/openharness`, `get-oh.sh`, and the
  legacy GHCR tags after the SLA.

## Verification

```bash
pnpm test
npm --prefix .agro/cli run typecheck
pnpm vitest run .agro/cli/src/__tests__/bundle-identity.test.ts \
  .agro/cli/src/lib/__tests__/product.test.ts \
  .agro/cli/src/__tests__/self-upgrade.test.ts \
  .agro/scripts/__tests__/get-agro.test.ts \
  .agro/scripts/__tests__/verify-release-aliases.test.ts
bash .agro/evals/probes/agro-compat-inventory.sh
bash .agro/evals/probes/get-agro-bootstrap.sh
bash .agro/evals/probes/agro-legacy-shim.sh
bash .agro/evals/probes/oh-npm-package.sh
bash .agro/evals/probes/version-parity.sh
bash .agro/evals/probes/sandbox-registry.sh
bash .agro/evals/probes/oh-image-only-deploy.sh
bash .agro/evals/probes/oh-compose-env-wiring.sh
```
