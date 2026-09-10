# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has performed them.
No image was published, no tag was moved, no release was cut, and no CI pin was
changed as part of the work that produced this document.

Population A is a **new** cold boot that seeds a fresh workspace volume from a
published image. Only a newly published image fixes it. Population B — a volume
already seeded from `0.9.0` — is repaired by
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md), which is
verified and needs no release.

## Ground truth this rests on

Every observation below is dated. Tags move; digests do not. Read a claim about
`latest` as a snapshot, and re-check it before acting on it.

- As of 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions, pushed
  11 seconds apart on 2026-09-06: one tagged `latest`, one tagged `0.9.0` and
  `sha-823aabbd…`. Both resolved to image id `bbfdaf6bb8ca`, and
  `ghcr.io/mifunedev/openharness:0.9.0` resolved to it too.
- That build's `/opt/oh-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"` and pins vitest `^3.2.6`.
  `GHSA-82fw-gwwq-j7x9` covers `>=2.1.0 <4.1.11`, so its boot install fails for
  as long as that advisory stands. The build itself cannot be edited.
- The `0.9.0` and `sha-823aabbd…` tags therefore name a build that cannot cold
  boot. As of 2026-09-08 `latest` named that same build, which is what R1 and
  R3 exist to change — after the release described here, `latest` is expected to
  name a working build and these sentences no longer describe it.
- An image built locally from `development` at `b10ecac3` cold-boots: with no
  `node_modules` present, `openharness-bootstrap.service` reached
  `active (exited)` with `status=0/SUCCESS`, and its seeded manifest carries no
  lifecycle hook and pins vitest `^4.1.11`. That result describes the source
  revision. It says nothing about the published build, whose layers cannot be
  edited.

## R1 — Publish a patched image

**Requirement.** Build and publish an image from a source revision whose seeded
manifest carries no install lifecycle hook and pins vitest `>=4.1.11`.

**Rationale.** The failing manifest is baked into the `0.9.0` build's image
layers, which cannot be edited. Nothing in source, and no volume-layout trick,
rewrites them. Only a new build carries a fixed manifest.

**Acceptance.** The published image's `/opt/<seed>/package.json` has no
`preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script, and its vitest pin resolves to `>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** After publishing, pull the published tag and cold-boot it
against an empty workspace volume. Accept only on the observed service state:
`systemctl is-active openharness-bootstrap.service` returns `active`, and
`openharness-cron.service` returns `active`.

**Rationale.** A container that is `running` proves nothing. systemd is PID 1
and the bootstrap unit is a `Type=oneshot`, so a container whose boot failed
stays `running` and stays `docker exec`-reachable. That property is what makes
the population-B recovery possible, and it is also what makes "the container is
up" a worthless acceptance signal.

**Acceptance.** The two `is-active` results above, captured from the pulled
published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** Record a deliberate decision. This document does not make it.

**Evidence for superseding** (publish a new version and move `:latest`):

- As of 2026-09-08, `:latest` resolved to the same failing build, so every new
  user who does not pin was blocked. Moving `:latest` to a fixed build is what
  unblocks them; re-check what `:latest` resolves to before acting.
- `ghcr.io/mifunedev/openharness:0.9.0` is referenced by
  `.agro/scripts/sandbox-upgrade-smoke.sh` (`LEGACY_IMAGE` default), by
  `.github/workflows/sandbox-boot-guard.yml`, and by
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three source the
  real published payload from it. Keeping the version keeps those verifiable.
- A user already running `0.9.0` recovers with the runbook and does not need
  the version withdrawn.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot, and no republish under that version can
  change its digest. Leaving it published means a user who pins `0.9.0` gets a
  failure every time.
- Yanking removes the source payload that the upgrade smoke and the recovery
  probe extract. Both would need a replacement fixture, and the recovery
  procedure would lose the only artifact it is verified against.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** Review the pin once a patched image exists and record the
reason either way. This document does not change the pin and does not choose.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. Its seed directory is `/opt/oh-seed`.
- An image built from `development` seeds `/opt/agro-seed` and lays down
  `.agro`. Moving the pin to such an image changes the upgrade smoke from a
  `.oh`-to-`.agro` upgrade test into a same-layout test, and silently drops the
  layout-migration coverage the job exists for.
- The smoke already neutralises the advisory in its copied manifest, so the
  broken pin does not block the job.

**Evidence for moving the pin to the patched image:**

- The smoke's header records a coverage reduction: it no longer boots the
  legacy image, only extracts from it. Pinning a bootable image would let that
  reduction be reversed.
- The workaround that deletes `pnpm:devPreinstall` from the copied manifest
  could then be removed, and the fixture would need no edit at all.

## R5 — Tell users on the affected image what to do

**Requirement.** Publish guidance to users whose volume was seeded from the
`bbfdaf6bb8ca` build — by the `0.9.0` tag, the `sha-823aabbd…` tag, or by
`latest` on or before 2026-09-08 — linking
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state four points, all verified:

1. A failed boot does **not** destroy the workspace. The container stays
   running and `docker exec` still reaches a shell.
2. Do not run `agro destroy` and do not delete the volume.
3. Recovery is not automatic. Pulling the patched image does not repair an
   existing volume, because an upgrade never rewrites the workspace's own
   `package.json`. Each affected volume needs the procedure run once.
4. A fresh sandbox created from the patched image needs nothing.

**Public documentation surface.** Check whether `mifunedev/agro-web` carries
installation or troubleshooting copy that must match.

## R6 — Optional: wire the recovery probe's live half into CI

**Requirement, if wanted.** `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`
always runs a structural half. Its boot-and-recover half runs only under
`SANDBOX_BOOT_RECOVERY_LIVE=1`, because `.agro/skills/eval/run.sh` caps every
probe at 30 seconds and a real sandbox boot takes about two minutes. A step in
`sandbox-boot-guard.yml` that sets `SANDBOX_BOOT_RECOVERY_LIVE=1` would exercise
the whole path. It costs one image pull and one sandbox boot.

**Rationale.** Under the eval suite the probe reports `SKIPPED` for its
boot-and-recover half, so the recovery path is guarded there only by its
structural assertions. Nothing in CI currently runs the live half.
