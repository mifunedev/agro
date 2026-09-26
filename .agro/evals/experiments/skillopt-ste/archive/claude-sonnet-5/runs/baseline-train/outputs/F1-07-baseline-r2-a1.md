# AGRO naming: the cutover is complete

AGRO (Agent Governance Runtime Orchestrator) completed the migration from the
former Open Harness name under epic
[#939](https://github.com/mifunedev/agro/issues/939). Phase 5
([#1061](https://github.com/mifunedev/agro/issues/1061)) retired the
compatibility layer. AGRO now uses exactly one spelling for every surface.

This page describes what the retirement removed. This page also describes how
to move a project that still uses the old names.

## The one spelling

| Surface | Name |
|---|---|
| CLI executable | `agro` |
| npm package | `@mifune/agro` |
| Project control directory | `.agro/` |
| Project config file | `agro.json` |
| Environment variables | `AGRO_*` |
| Host registry home | `~/.agro` |
| Image seed | `/opt/agro-seed` |
| First-boot marker | `.agro/.image-seeded` |
| systemd units | `agro-bootstrap.service`, `agro-cron.service` |
| Repository, docs host | `mifunedev/agro`, `agro.mifune.dev` |

The TypeScript module that holds these names is
[`.agro/cli/src/lib/layout.ts`](../.agro/cli/src/lib/layout.ts). The boot-safe
shell adapter is [`.agro/scripts/paths.sh`](../.agro/scripts/paths.sh). This
adapter needs only bash and coreutils. The entrypoint can therefore use this
adapter before Node or the control plane exists.

## What the retirement removed

- The retirement removed the `oh` executable and the `@mifune/openharness` npm
  shim. The registry no longer publishes either package.
- The retirement removed the dual-spelling resolver. The CLI no longer reads
  `.oh/`, `oh.json`, `OH_*`, `~/.oh`, or `/opt/oh-seed`.
- The retirement removed the `agro migrate` command. This command used to move
  a project or registry from the old names to the new names. The command has
  no remaining purpose, because the old names no longer exist.
- The retirement removed the `openharness-bootstrap.service` and
  `openharness-cron.service` units.
- The retirement removed the `get-oh.sh` installer and the `dist/oh.js`
  release artifact.

`agro update` still works. `agro update` is an alias of `agro self-upgrade`.
Project payload vendoring used to run as `oh update`. Project payload
vendoring now runs as `agro vendor`.

## Moving a project that still uses the old names

Before you begin, stop the sandbox. Do the following steps once, on the host.
None of these steps need the CLI.

Rename the project control plane and config:

```bash
git mv .oh .agro
git mv oh.json agro.json
```

Rename the host registry home:

```bash
mv ~/.oh ~/.agro
```

Rename each `OH_*` variable in your shell profile, CI configuration, and
`.env` files to `AGRO_*`. The CLI no longer reads the `OH_` prefix. The CLI
does not warn you when it finds an `OH_*` variable.

### Re-vendor before you upgrade the image

An existing sandbox workspace volume still holds the control plane that you
vendored into it before the cutover. This old control plane reads the retired
`OH_*` variables. The new image no longer sets these variables. As a result,
provider linking cannot run. The sandbox still boots. The entrypoint reports
the problem. The entrypoint continues instead of failing the unit. Agents have
no linked skills until you re-vendor the control plane.

Re-vendor the control plane. Re-link the providers:

```bash
agro vendor
bash .agro/scripts/link-providers.sh --init
```

If you pinned `@mifune/openharness`, install the canonical package instead:

```bash
npm uninstall -g @mifune/openharness
npm install -g @mifune/agro
```

A sandbox that you created before the cutover keeps its named volumes.
Recreate the container against the renamed registry entry:

```bash
agro stop <name>
agro sandbox install docker --name <name>
```

## Verifying the cutover

Two probes guard the retirement:

- If `.agro/cli/legacy/` returns, `.agro/evals/probes/version-parity.sh`
  fails.
- If a built image still ships an `oh` entry point,
  `.agro/scripts/verify-sandbox-image.sh` fails.

Run the suite with `bash .agro/skills/eval/run.sh`.
