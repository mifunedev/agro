# AGRO naming: the cutover is complete

This project moved from the former Open Harness name to AGRO
(Agent Governance Runtime Orchestrator). Epic
[#939](https://github.com/mifunedev/agro/issues/939) tracked the move. Phase 5
([#1061](https://github.com/mifunedev/agro/issues/1061)) removed the
compatibility layer. AGRO now has exactly one spelling for each surface.

This page lists the items that the retirement removed. This page also tells you
how to move a project that still uses the old names.

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
[`.agro/scripts/paths.sh`](../.agro/scripts/paths.sh). The shell adapter needs
only bash and coreutils. Thus the entrypoint can use the shell adapter before
Node or the control plane exists.

## What the retirement removed

- The `oh` executable and the `@mifune/openharness` npm shim. The project no
  longer publishes either item.
- The dual-spelling resolver. AGRO no longer reads `.oh/`, `oh.json`, `OH_*`,
  `~/.oh`, or `/opt/oh-seed`.
- The `agro migrate` command. The command moved a project or a registry from
  the old names to the new names. The old names are gone, so the command has
  nothing to resolve.
- The `openharness-bootstrap.service` and `openharness-cron.service` units.
- The `get-oh.sh` installer and the `dist/oh.js` release artifact.

Two commands remain:

- `agro update` still works. `agro update` is an alias of `agro self-upgrade`.
- `agro vendor` vendors the project payload. The old command for this task was
  `oh update`.

## Moving a project that still uses the old names

Do these steps once, on the host. The steps in this section do not need the
CLI.

1. Stop the sandbox.
2. Rename the project control plane and the project config:

   ```bash
   git mv .oh .agro
   git mv oh.json agro.json
   ```

3. Rename the host registry home:

   ```bash
   mv ~/.oh ~/.agro
   ```

4. Find each `OH_*` variable in your shell profile, your CI configuration, and
   your `.env` files. Rename each variable to the `AGRO_*` form.

The CLI no longer reads the `OH_` prefix. The CLI does not warn when the CLI
finds a variable with the `OH_` prefix.

### Re-vendor before you upgrade the image

An existing sandbox workspace volume holds an old copy of the control plane.
That copy came into the volume before the cutover. The old copy reads the
retired `OH_*` variables. The new image does not set these variables, so
provider linking in the old copy cannot run.

The sandbox still boots. The entrypoint reports the problem and continues. The
entrypoint does not fail the unit. But agents have no linked skills until you
re-vendor the control plane.

Run these steps in `<host or sandbox>`:

1. Re-vendor the control plane:

   ```bash
   agro vendor
   ```

2. Re-link the providers:

   ```bash
   bash .agro/scripts/link-providers.sh --init
   ```

If you pinned `@mifune/openharness`, uninstall `@mifune/openharness` and
install the canonical package:

```bash
npm uninstall -g @mifune/openharness
npm install -g @mifune/agro
```

A sandbox from before the cutover keeps its named volumes. Recreate the
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

To run the suite, run `bash .agro/skills/eval/run.sh`.
