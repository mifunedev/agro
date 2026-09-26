# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has performed them.
The work that produced this document published no image, moved no tag, cut no
release, and changed no CI pin.

Population A is a **new** cold boot that seeds a fresh workspace volume from a
published image. Only a newly published image fixes population A's cold-boot
failure. The runbook
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md) repairs
population B — a volume already seeded from `0.9.0` — and needs no release.

## Ground truth this rests on

Each observation below carries a date. Tags move; digests do not. Before you act on
a claim about `latest`, read the claim as a snapshot and re-check `latest`
against current state.

- As of 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions: one
  tagged `latest`, and one tagged both `0.9.0` and `sha-823aabbd…`. The
  registry pushed the two versions <duration> apart on 2026-09-06. All tags
  resolved to the same image id, `bbfdaf6bb8ca`.
- That build's `/opt/agro-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"` and pins vitest `^3.2.6`.
  Advisory `GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The boot
  install fails while that advisory covers this pin.
- The `0.9.0` and `sha-823aabbd…` tags therefore name a build that cannot cold
  boot. As of 2026-09-08, `latest` named that same build. R1 and R3 exist to
  change that. After the release described here, `latest` names a working
  build, and these sentences no longer describe `latest`.
- An image built locally from `development` at revision `b10ecac3`
  cold-boots. With no `node_modules` present, `agro-bootstrap.service` reached
  `active (exited)` with `status=0/SUCCESS`. That image's seeded manifest
  carries no lifecycle hook and pins vitest `^4.1.11`. This result describes
  the source revision only. It says nothing about the published build, because
  nobody can edit the published build's layers.

## R1 — Publish a patched image

**Requirement.** The operator builds and publishes an image from a source
revision whose seeded manifest carries no install lifecycle hook and pins
vitest `>=4.1.11`.

**Rationale.** The `0.9.0` build bakes the failing manifest into its image
layers. Nobody can edit these layers. No change to source, and no
volume-layout trick, rewrites them. Only a new build carries a fixed manifest.

**Acceptance.** The published image's `/opt/<seed>/package.json` has no
`preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script. Its vitest pin resolves to `>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** After the operator publishes the image, the operator pulls
the published tag and cold-boots it against an empty workspace volume. Accept
the result only on the observed service state: `systemctl is-active
agro-bootstrap.service` returns `active`, and `agro-cron.service` returns
`active`.

**Rationale.** A `running` container proves nothing. systemd is PID 1, and the
bootstrap unit is a `Type=oneshot` unit. A container whose boot failed
therefore stays `running` and stays reachable through `docker exec`. This
property makes the population-B recovery possible. This same property makes
"the container is up" a worthless acceptance signal.

**Acceptance.** The two `is-active` results above, captured from the pulled
published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** The operator records a deliberate decision. This document
does not make that decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- As of 2026-09-08, `:latest` resolved to the same failing build, so
  `:latest` blocked every new user who did not pin a version. Moving
  `:latest` to a fixed build unblocks these users. Before you act, re-check
  what `:latest` resolves to.
- Three files reference `ghcr.io/mifunedev/agro:0.9.0`:
  `.agro/scripts/sandbox-upgrade-smoke.sh` (as its `LEGACY_IMAGE` default),
  `.github/workflows/sandbox-boot-guard.yml`, and
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three source the
  real published payload from that version. Keeping the version keeps these
  three files verifiable.
- A user already running `0.9.0` recovers with the runbook. This user does not
  need the version withdrawn.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot, and no republish under that version can
  change its digest. Leaving `0.9.0` published means a user who pins `0.9.0`
  gets a failure every time.
- Yanking removes the source payload that the upgrade smoke and the recovery
  probe extract. Both would need a replacement fixture. The recovery procedure
  would also lose the only artifact that verifies it.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** Once a patched image exists, the operator reviews the pin and
records the reason either way. This document does not change the pin and does
not choose.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. Its seed directory is `/opt/agro-seed`.
- An image built from `development` seeds `/opt/agro-seed` and lays down
  `.agro` instead of `.oh`. Moving the pin to such an image changes the
  upgrade smoke from a `.oh`-to-`.agro` upgrade test into a same-layout test.
  This change silently drops the layout-migration coverage the job exists for.
- The smoke already neutralizes the advisory in its copied manifest, so the
  broken pin does not block the job.

**Evidence for moving the pin to the patched image:**

- The smoke's header records a coverage reduction: the smoke no longer boots
  the legacy image, and only extracts files from it. Pinning a bootable image
  would let the operator reverse that reduction.
- The operator could then remove the workaround that deletes
  `pnpm:devPreinstall` from the copied manifest, and the fixture would need no
  edit at all.

## R5 — Tell users on the affected image what to do

**Requirement.** The operator publishes guidance, linking
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md), to users
on a volume that the `bbfdaf6bb8ca` build seeded. The `0.9.0` tag, the
`sha-823aabbd…` tag, and `latest` on or before 2026-09-08 all published this
build.

The guidance must state four points, all verified:

1. A failed boot does **not** destroy the workspace. The container stays
   running, and `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. Pulling the patched image does not repair an
   existing volume, because an upgrade never rewrites the workspace's own
   `package.json`. Each affected user must run the recovery procedure once per
   affected volume.
4. A fresh sandbox created from the patched image needs no recovery procedure.

**Public documentation surface.** The operator checks whether
`mifunedev/agro-web` carries installation or troubleshooting copy that this
guidance must match.

## R6 — Optional: wire the recovery probe's live half into CI

**Requirement, if wanted.**
`.agro/evals/probes/sandbox-boot-advisory-recovery.sh` always runs a
structural half. Its boot-and-recover half runs only when the environment
sets `SANDBOX_BOOT_RECOVERY_LIVE=1`, because `.agro/skills/eval/run.sh` caps
every probe at 30 seconds and a real sandbox boot takes about two minutes. A
step in `sandbox-boot-guard.yml` that sets `SANDBOX_BOOT_RECOVERY_LIVE=1`
would exercise the whole path, at the cost of one image pull and one sandbox
boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for its
boot-and-recover half. The recovery path is therefore guarded in the eval
suite only by its structural assertions. No CI job currently runs the live
half.
