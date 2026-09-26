# AGRO naming: the cutover is complete

This project finished migrating from the former Open Harness name to AGRO
(Agent Governance Runtime Orchestrator) under epic
[#939](https://github.com/mifunedev/agro/issues/939). Phase 5
([#1061](https://github.com/mifunedev/agro/issues/1061)) retired the
compatibility layer. AGRO now has exactly one spelling for every surface.

This page records what the retirement removed. This page also records how to
move a project that still uses the old names.

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
shell adapter is [`.agro/scripts/paths.sh`](../.agro/scripts/paths.sh). The
shell adapter needs only bash and coreutils. The entrypoint can run the shell
adapter before Node or the control plane exists.

## What the retirement removed

- The `oh` executable and the `@mifune/openharness` npm shim. Neither is
  published any more.
- The dual-spelling resolver. `.oh/`, `oh.json`, `OH_*`, `~/.oh` and
  `/opt/oh-seed` are no longer read.
- The `agro migrate` command. This command moved a project or registry from
  the old names to the new ones. The old names no longer exist, so the
  command has nothing left to resolve.
- The `openharness-bootstrap.service` and `openharness-cron.service` units.
- The `get-oh.sh` installer and the `dist/oh.js` release artifact.

`agro update` still works. `agro update` is an alias of `agro self-upgrade`. Project
payload vendoring, which used to be `oh update`, is now `agro vendor`.

## Moving a project that still uses the old names

Do the following steps on the host, with the sandbox stopped. Do these steps
one time per project. None of these steps need the CLI.

Rename the project control plane and config:

```bash
git mv .oh .agro
git mv oh.json agro.json
```

Rename the host registry home:

```bash
mv ~/.oh ~/.agro
```

Rename any `OH_*` variables in your shell profile, CI configuration, and
`.env` files to `AGRO_*`. The CLI no longer reads the `OH_` prefix. The CLI
does not warn you when it finds an `OH_` variable.

### Re-vendor before you upgrade the image

If you created a sandbox workspace volume before the cutover, that volume
still holds the old control plane. The old control plane reads the retired
`OH_*` variables. The new image does not set the `OH_*` variables, so
provider linking cannot run in that volume. The sandbox still starts: the
entrypoint reports the problem and continues instead of failing the
`agro-bootstrap.service` unit. Agents in that sandbox have no linked skills
until you re-vendor the control plane.

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
- `.agro/scripts/verify-sandbox-image.sh` fails if a built image still ships
  an `oh` entry point.

Run the suite with `bash .agro/skills/eval/run.sh`.
