# AGRO naming: the cutover is complete

This project migrated from the former Open Harness name to AGRO
(Agent Governance Runtime Orchestrator). Epic
[#939](https://github.com/mifunedev/agro/issues/939) tracked the migration.
Phase 5 ([#1061](https://github.com/mifunedev/agro/issues/1061)) retired the
compatibility layer. AGRO now has exactly one spelling for every surface.

This page records what the retirement removed. This page also shows how to move
a project that still uses the old names.

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

The TypeScript module
[`.agro/cli/src/lib/layout.ts`](../.agro/cli/src/lib/layout.ts) holds these
names. The boot-safe shell adapter is
[`.agro/scripts/paths.sh`](../.agro/scripts/paths.sh). The adapter needs only
bash and coreutils. The entrypoint can therefore use the adapter before Node or
the control plane exists.

## What the retirement removed

- The `oh` executable and the `@mifune/openharness` npm shim. The project no
  longer publishes either one.
- The dual-spelling resolver. The CLI no longer reads `.oh/`, `oh.json`,
  `OH_*`, `~/.oh`, or `/opt/oh-seed`.
- The `agro migrate` command. The command moved a project or a registry from the
  old names to the new names. The old names are gone, so the command has nothing
  to resolve.
- The `openharness-bootstrap.service` and `openharness-cron.service` units.
- The `get-oh.sh` installer and the `dist/oh.js` release artifact.

`agro update` still works as an alias of `agro self-upgrade`. The former
`oh update` command vendored the project payload. `agro vendor` now does that
work.

## Moving a project that still uses the old names

Do the renames in this section once, on the host. Stop the sandbox before you
start. The renames do not need the CLI.

1. Rename the project control plane and the project config:

   ```bash
   git mv .oh .agro
   git mv oh.json agro.json
   ```

2. Rename the host registry home:

   ```bash
   mv ~/.oh ~/.agro
   ```

3. Rename each `OH_*` variable to `AGRO_*`. Check your shell profile, your CI
   configuration, and your `.env` files. The CLI no longer reads the `OH_`
   prefix. When the CLI finds an `OH_*` variable, the CLI gives no warning.

### Re-vendor before you upgrade the image

An existing sandbox workspace volume still holds the control plane that the
project vendored into the volume before the cutover. That old copy reads the
retired `OH_*` variables. The new image no longer sets those variables, so the
old copy cannot run provider linking. The sandbox still boots. The entrypoint
reports the problem and continues, and the unit does not fail. Agents have no
linked skills until you re-vendor the control plane.

Run these steps in <execution context: host or sandbox>. Run the steps before you
upgrade the image with <image upgrade command>.

1. Re-vendor the control plane and re-link the providers:

   ```bash
   agro vendor
   bash .agro/scripts/link-providers.sh --init
   ```

2. If you pinned `@mifune/openharness`, uninstall `@mifune/openharness` and install the
   canonical package:

   ```bash
   npm uninstall -g @mifune/openharness
   npm install -g @mifune/agro
   ```

3. A sandbox that existed before the cutover keeps its named volumes. Recreate
   the container against the renamed registry entry:

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
