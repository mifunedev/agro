# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has carried out these
requirements yet. The work that produced this document published no image, moved
no tag, cut no release, and changed no CI pin.

Population A is a **new** cold boot that seeds a fresh workspace volume from a
published image. Only a newly published image fixes population A. Population B
is a volume that `0.9.0` already seeded. The runbook
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md) repairs
population B. The runbook passed verification and needs no release.

## Ground truth this rests on

Every observation below carries a date. Tags move; digests do not. Treat each
claim about `latest` as a snapshot. Before you act on a claim about `latest`,
check the `latest` tag again.

- On 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions. The
  registry received both pushes on 2026-09-06, `<interval>` apart. One version
  carried the tag `latest`. The other version carried the tags `0.9.0` and
  `sha-823aabbd…`. Both versions resolved to image id `bbfdaf6bb8ca`.
  `ghcr.io/mifunedev/agro:0.9.0` also resolved to image id `bbfdaf6bb8ca`.
- In the `bbfdaf6bb8ca` build, `/opt/agro-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"` and pins vitest `^3.2.6`.
  `GHSA-82fw-gwwq-j7x9` covers vitest `>=2.1.0 <4.1.11`. The boot install of the
  `bbfdaf6bb8ca` build therefore fails for as long as the advisory stands.
  Nobody can edit the `bbfdaf6bb8ca` build.
- The `0.9.0` and `sha-823aabbd…` tags therefore name a build that cannot cold
  boot. On 2026-09-08, `latest` named the same build. R1 and R3 exist to move
  `latest` off the `bbfdaf6bb8ca` build. After the release in this document,
  `latest` must name a working build. The claims in this list then no longer
  describe `latest`.
- A local image from `development` at `b10ecac3` cold-boots. With no
  `node_modules` present, `agro-bootstrap.service` reached `active (exited)`
  with `status=0/SUCCESS`. The seeded manifest of the local image carries no
  lifecycle hook and pins vitest `^4.1.11`. The local result describes the
  source revision only. The local result says nothing about the published
  build. Nobody can edit the layers of the published build.

## R1 — Publish a patched image

**Requirement.** Build an image from a source revision whose seeded manifest
carries no install lifecycle hook and pins vitest `>=4.1.11`. Publish the image.

**Rationale.** The image layers of the `0.9.0` build contain the failing
manifest. Nobody can edit those layers. No source change and no volume-layout
trick rewrites the layers. Only a new build carries a fixed manifest.

**Acceptance.** In the published image, `/opt/<seed>/package.json` has no
`preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script. The vitest pin in the same file resolves to
`>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** The operator does these steps after R1:

1. Pull the published tag `<published-tag>`.
2. Cold-boot the pulled image against an empty workspace volume.
3. Run `systemctl is-active agro-bootstrap.service`. Accept only the result
   `active`.
4. Run `systemctl is-active agro-cron.service`. Accept only the result
   `active`.

**Rationale.** A container in state `running` proves nothing. systemd is PID 1,
and the bootstrap unit is a `Type=oneshot` unit. A container with a failed boot
therefore stays `running`, and `docker exec` still reaches the container. The
population-B recovery depends on this property. The same property makes "the
container is up" a worthless acceptance signal.

**Acceptance.** The two `is-active` results from steps 3 and 4, captured from
the pulled published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** The operator records a deliberate decision. This document does
not make the decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- On 2026-09-08, `:latest` resolved to the same failing build. The failing
  build therefore blocked every new user who does not pin a version. A move of
  `:latest` to a fixed build unblocks those users. Before you act, check what
  `:latest` resolves to.
- Three files reference `ghcr.io/mifunedev/agro:0.9.0`:
  `.agro/scripts/sandbox-upgrade-smoke.sh` (the `LEGACY_IMAGE` default),
  `.github/workflows/sandbox-boot-guard.yml`, and
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three files take
  the real published payload from `ghcr.io/mifunedev/agro:0.9.0`. If the
  operator keeps the version, the three files stay verifiable.
- A user who already runs `0.9.0` recovers with the runbook. That user does not
  need a withdrawal of the version.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot. No republish under the `0.9.0` version can
  change the digest of the build. If the operator leaves the build in the
  registry, a user who pins `0.9.0` gets a failure on every boot.
- A yank removes the source payload that the upgrade smoke and the recovery
  probe extract. Both scripts then need a replacement fixture. The recovery
  procedure also loses the only artifact that its verification uses.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** When a patched image exists, the operator reviews the pin. The
operator records the reason for the decision either way. This document does not
change the pin and does not choose.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. The seed directory of `0.9.0` is `/opt/agro-seed`.
- An image from `development` seeds `/opt/agro-seed` and lays down `.agro`. If
  the pin moves to such an image, the upgrade smoke changes from a
  `.oh`-to-`.agro` upgrade test into a same-layout test. The job then silently
  loses the layout-migration coverage that the job exists for.
- The smoke already neutralises the advisory in its copied manifest. The broken
  pin therefore does not block the job.

**Evidence for moving the pin to the patched image:**

- The header of `.agro/scripts/sandbox-upgrade-smoke.sh` records a coverage
  reduction. The smoke no longer boots the legacy image. The smoke only
  extracts from the legacy image. A pin to a bootable image lets the operator
  reverse the reduction.
- The operator can then remove the workaround that deletes `pnpm:devPreinstall`
  from the copied manifest. The fixture `<fixture>` then needs no edit.

## R5 — Tell users on the affected image what to do

**Requirement.** Publish guidance at `<location>` for each user whose volume
came from the `bbfdaf6bb8ca` build. Users got that build through the `0.9.0`
tag, the `sha-823aabbd…` tag, or `latest` on or before 2026-09-08. The guidance
links [`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state four points. Each point passed verification:

1. A failed boot does **not** destroy the workspace. The container stays
   running, and `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. A pull of the patched image does not repair an
   existing volume, because an upgrade never rewrites the `package.json` of the
   workspace. Run the procedure once on each affected volume.
4. A fresh sandbox from the patched image needs no action.

**Public documentation surface.** Check whether the installation or troubleshooting
copy in `mifunedev/agro-web` must match the guidance.

## R6 — Optional: wire the recovery probe's live half into CI

**Requirement, if the operator wants the step.**
`.agro/evals/probes/sandbox-boot-advisory-recovery.sh` always runs a structural
half. The boot-and-recover half runs only when `SANDBOX_BOOT_RECOVERY_LIVE=1`.
The reason: `.agro/skills/eval/run.sh` caps every probe at 30 seconds, and a
real sandbox boot takes about two minutes. A step in `sandbox-boot-guard.yml`
that sets `SANDBOX_BOOT_RECOVERY_LIVE=1` exercises the whole path. The step
costs one image pull and one sandbox boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for the
boot-and-recover half. In the eval suite, only the structural assertions guard
the recovery path. No CI job currently runs the live half.
