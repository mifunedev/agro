# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has performed
these requirements. The work that produced this document did not publish an
image, did not move a tag, did not cut a release, and did not change a CI
pin.

Population A is a **new** cold boot. A new cold boot seeds a fresh workspace
volume from a published image. Only a newly published image fixes a failing
cold boot in population A. Population B is a volume already seeded from
`0.9.0`. [`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md)
repairs population B. That runbook passes verification. That runbook needs
no release.

## Ground truth this rests on

This document dates every observation below. Tags move; digests do not. Read a claim
about `latest` as a snapshot. Re-check the claim before you act on it.

- As of 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions,
  pushed on 2026-09-06: one tagged `latest`, and one tagged `0.9.0` and
  `sha-823aabbd…`. Both tags resolved to image id `bbfdaf6bb8ca`.
  `ghcr.io/mifunedev/agro:0.9.0` also resolved to `bbfdaf6bb8ca`.
- That build's `/opt/agro-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"` and pins vitest
  `^3.2.6`. `GHSA-82fw-gwwq-j7x9` covers `>=2.1.0 <4.1.11`. That build's
  boot install fails for as long as the advisory stands. Nobody can edit the
  build's layers.
- The `0.9.0` and `sha-823aabbd…` tags name a build that cannot cold boot.
  As of 2026-09-08, `latest` named that same build. R1 and R3 exist to
  change what `latest` names. After the release described in this document,
  the operator expects `latest` to name a working build. At that point,
  this paragraph no longer describes the build that `latest` names.
- An image built locally from `development` at `b10ecac3` cold-boots. With
  no `node_modules` present, `agro-bootstrap.service` reached
  `active (exited)` with `status=0/SUCCESS`. That image's seeded manifest
  carries no lifecycle hook and pins vitest `^4.1.11`. This result describes
  the source revision at `b10ecac3`. This result says nothing about the
  published build, because nobody can edit the published build's layers.

## R1 — Publish a patched image

**Requirement.** Build and publish an image from a source revision whose
seeded manifest carries no install lifecycle hook and pins vitest
`>=4.1.11`.

**Rationale.** The `0.9.0` build bakes the failing manifest into its image
layers. Nobody can edit those layers. No change to source, and no
volume-layout change, rewrites them. Only a new build carries a fixed
manifest.

**Acceptance.** The published image's `/opt/<seed>/package.json` has no
`preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script. The published image's vitest pin resolves to
`>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** After you publish the image, pull the published tag and
cold-boot it against an empty workspace volume. Accept the release only on
the observed service state: `systemctl is-active agro-bootstrap.service`
returns `active`, and `agro-cron.service` returns `active`.

**Rationale.** A container in the `running` state proves nothing. systemd is
PID 1 in the sandbox. The bootstrap unit is `Type=oneshot`. A container
whose boot failed still shows `running`, and `docker exec` still reaches a
shell in it. That same property makes the population-B recovery in
`repair-sandbox-boot-advisory.md` possible. That same property also makes
"the container is up" a worthless acceptance signal.

**Acceptance.** The two `is-active` results above, captured from the pulled
published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** Record a deliberate decision. This document does not make
that decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- As of 2026-09-08, `:latest` resolved to the same failing build. The
  failing build blocked every new user who did not pin a version. Moving
  `:latest` to a fixed build unblocks those users. Re-check what `:latest`
  resolves to before you act on this evidence.
- `ghcr.io/mifunedev/agro:0.9.0` is referenced by
  `.agro/scripts/sandbox-upgrade-smoke.sh` (the `LEGACY_IMAGE` default), by
  `.github/workflows/sandbox-boot-guard.yml`, and by
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three source
  the real published payload from `0.9.0`. Keeping the `0.9.0` version keeps
  those three sources verifiable.
- A user already running `0.9.0` recovers with the runbook. That user does
  not need the `0.9.0` version withdrawn.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot. No republish under the `0.9.0` version
  can change its digest. Leaving `0.9.0` published means a user who pins
  `0.9.0` gets a failure every time.
- Yanking `0.9.0` removes the source payload that the upgrade smoke and the
  recovery probe extract. The upgrade smoke and the recovery probe would
  each need a replacement fixture. The recovery procedure would then have no
  artifact to verify against.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** Review the pin once a patched image exists. Record the
reason for the decision either way. This document does not change the pin
and does not choose a value.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. `0.9.0`'s seed directory is `/opt/agro-seed`.
- An image built from `development` seeds `/opt/agro-seed` and lays down
  `.agro`. Moving the pin to such an image changes the upgrade smoke from a
  `.oh`-to-`.agro` upgrade test into a same-layout test. That change would
  silently drop the layout-migration coverage the job exists for.
- The smoke already neutralizes the advisory in its copied manifest. The
  broken pin does not block the job.

**Evidence for moving the pin to the patched image:**

- The smoke's header records a coverage reduction: the smoke no longer boots
  the legacy image, and only extracts from it. Pinning a bootable image
  would let the operator reverse that reduction.
- If the pin moves to the patched image, the operator could then remove the
  workaround that deletes `pnpm:devPreinstall` from the copied manifest. The
  fixture would then need no edit at all.

## R5 — Tell users on the affected image what to do

**Requirement.** Publish guidance to users who seeded their volume from the
`bbfdaf6bb8ca` build — by pulling the `0.9.0` tag, the `sha-823aabbd…` tag,
or `latest` on or before 2026-09-08. Link that guidance to
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state four points, all verified:

1. A failed boot does **not** destroy the workspace. The container stays
   running, and `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. Pulling the patched image does not repair an
   existing volume, because an upgrade never rewrites the workspace's own
   `package.json`. Each affected volume needs the procedure run once.
4. A fresh sandbox created from the patched image needs no repair procedure.

**Public documentation surface.** Check `mifunedev/agro-web` for installation
or troubleshooting copy about this failure. Update any matching copy in
`mifunedev/agro-web` to align with this guidance.

## R6 — Optional: wire the recovery probe's live half into CI

**Requirement, if wanted.** `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`
always runs a structural half. Its boot-and-recover half runs only when the
operator sets `SANDBOX_BOOT_RECOVERY_LIVE=1`, because `.agro/skills/eval/run.sh`
caps every probe at 30 seconds, and a real sandbox boot takes about two
minutes. A step in `sandbox-boot-guard.yml` that sets
`SANDBOX_BOOT_RECOVERY_LIVE=1` would exercise the whole path. That step costs
one image pull and one sandbox boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for its
boot-and-recover half. There, only the probe's structural assertions guard
the recovery path. Nothing in CI currently runs the live half.
