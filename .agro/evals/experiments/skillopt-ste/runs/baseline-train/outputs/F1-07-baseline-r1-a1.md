# AGRO naming: the cutover is complete

This project finished the migration from the former Open Harness name to AGRO
(Agent Governance Runtime Orchestrator). Epic
[#939](https://github.com/mifunedev/agro/issues/939) tracked the migration.
Phase 5 ([#1061](https://github.com/mifunedev/agro/issues/1061)) retired the
compatibility layer. AGRO now has exactly one spelling for every surface.

This page records what the retirement removed. This page also tells you how to
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

The TypeScript module
[`.agro/cli/src/lib/layout.ts`](../.agro/cli/src/lib/layout.ts) holds these
names. The shell script [`.agro/scripts/paths.sh`](../.agro/scripts/paths.sh)
is the boot-safe adapter for these names. The adapter needs only bash and
coreutils. The entrypoint can therefore use the adapter before Node or the
control plane exists.

## What the retirement removed

- The `oh` executable and the `@mifune/openharness` npm shim. The project no
  longer publishes either one.
- The dual-spelling resolver. The CLI no longer reads `.oh/`, `oh.json`,
  `OH_*`, `~/.oh`, or `/opt/oh-seed`.
- The `agro migrate` command. The command moved a project or a registry from
  the old names to the new names. The old names are gone, so the command has
  nothing to resolve.
- The `openharness-bootstrap.service` and `openharness-cron.service` units.
- The `get-oh.sh` installer and the `dist/oh.js` release artifact.

The `agro update` command still works as an alias of `agro self-upgrade`. The
`agro vendor` command now vendors the project payload. The `oh update` command
did this job before the cutover.

## Moving a project that still uses the old names

Do the rename steps once. Do the rename steps on the host. Stop the sandbox
before you start. The rename steps do not need the CLI.

1. On the host, rename the project control plane and the project config:

   ```bash
   git mv .oh .agro
   git mv oh.json agro.json
   ```

2. On the host, rename the host registry home:

   ```bash
   mv ~/.oh ~/.agro
   ```

3. Rename each `OH_*` variable to `AGRO_*`. Check your shell profile, your CI
   configuration, and your `.env` files. The CLI no longer reads the `OH_`
   prefix. The CLI does not warn you when the CLI finds an `OH_*` variable.

### Re-vendor before you upgrade the image

An existing sandbox workspace volume still holds an old copy of the control
plane. The old copy came from a vendor operation before the cutover. The old
copy reads the retired `OH_*` variables. The new image does not set these
variables, so provider linking in the old copy cannot run. The sandbox still
boots. The entrypoint reports the problem and continues. The entrypoint does
not fail the unit. Agents have no linked skills until you re-vendor the control
plane.

Do these steps before you upgrade the image:

1. In <host or sandbox>, re-vendor the control plane:

   ```bash
   agro vendor
   ```

2. In the same location, re-link the providers:

   ```bash
   bash .agro/scripts/link-providers.sh --init
   ```

3. If you pinned `@mifune/openharness`, replace the pinned package with the
   canonical package:

   ```bash
   npm uninstall -g @mifune/openharness
   npm install -g @mifune/agro
   ```

A sandbox from before the cutover keeps its named volumes. On the host,
recreate the container against the renamed registry entry:

```bash
agro stop <name>
agro sandbox install docker --name <name>
```

## Verifying the cutover

Two probes guard the retirement:

- `.agro/evals/probes/version-parity.sh` fails if `.agro/cli/legacy/` returns.
- `.agro/scripts/verify-sandbox-image.sh` fails if a built image still ships an
  `oh` entry point.

To run the suite, run `bash .agro/skills/eval/run.sh`.
