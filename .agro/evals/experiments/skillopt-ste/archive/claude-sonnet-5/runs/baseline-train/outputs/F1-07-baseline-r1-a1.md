# AGRO naming: the cutover is complete

This project finished migrating from the former Open Harness name to AGRO
(Agent Governance Runtime Orchestrator) under epic
[#939](https://github.com/mifunedev/agro/issues/939). Phase 5
([#1061](https://github.com/mifunedev/agro/issues/1061)) retired the
compatibility layer. AGRO now has exactly one spelling for every surface.

This page records what the retirement removed and how to move a project that
still uses the old names.

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
adapter needs only bash and coreutils. The entrypoint runs this adapter before
Node starts and before the control plane exists.

## What the retirement removed

- The `oh` executable and the `@mifune/openharness` npm shim. Neither package
  exists now.
- The dual-spelling resolver. The CLI no longer reads `.oh/`, `oh.json`,
  `OH_*`, `~/.oh`, or `/opt/oh-seed`.
- The `agro migrate` command. This command moved a project or registry from
  the old names to the new names. The old names no longer exist. The command
  has nothing to resolve.
- The `openharness-bootstrap.service` and `openharness-cron.service` units.
- The `get-oh.sh` installer and the `dist/oh.js` release artifact.

`agro update` still works. `agro update` is an alias of `agro self-upgrade`.
Project payload vendoring was `oh update`. Project payload vendoring is now
`agro vendor`.

## Moving a project that still uses the old names

Stop the sandbox. Rename the project once, on the host. None of the steps
need the CLI.

Rename the project control directory and configuration file:

```bash
git mv .oh .agro
git mv oh.json agro.json
```

Rename the host registry home:

```bash
mv ~/.oh ~/.agro
```

Rename each `OH_*` variable to `AGRO_*` in your shell profile, CI
configuration, and `.env` files. The CLI no longer reads the `OH_` prefix. The
CLI does not warn when it finds an `OH_*` variable.

### Re-vendor before you upgrade the image

An existing sandbox workspace volume still holds the control plane from
before the cutover. That old control plane reads the retired `OH_*`
variables. The new image no longer sets `OH_*` variables. Provider linking
cannot run without those variables. The sandbox still boots. The entrypoint
reports the problem. The entrypoint continues without failing the systemd
unit. Agents have no linked skills until you re-vendor the control plane.

Re-vendor the control plane and re-link the providers:

```bash
agro vendor
bash .agro/scripts/link-providers.sh --init
```

If you pinned `@mifune/openharness`, install the canonical package instead:

```bash
npm uninstall -g @mifune/openharness
npm install -g @mifune/agro
```

A sandbox created before the cutover keeps its named volumes. Recreate the
container against the renamed registry entry:

```bash
agro stop <name>
agro sandbox install docker --name <name>
```

## Verifying the cutover

Two probes guard the retirement:

- `.agro/evals/probes/version-parity.sh` fails if `.agro/cli/legacy/` returns.
- `.agro/scripts/verify-sandbox-image.sh` fails if a built image still ships an
  `oh` entry point.

Run the suite with `bash .agro/skills/eval/run.sh`.
