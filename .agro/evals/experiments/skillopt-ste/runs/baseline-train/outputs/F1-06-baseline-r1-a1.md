# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has performed these
requirements yet. The work that produced this document published no image. That
work moved no tag, cut no release, and changed no CI pin.

Population A is a **new** cold boot that seeds a fresh workspace volume from a
published image. Only a newly published image fixes population A. Population B
is a volume that the `0.9.0` image already seeded. The operator repairs
population B with
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md). That
procedure has passed verification and needs no release.

## Ground truth for these requirements

Each observation below carries a date. Tags move. Digests do not move. Treat
each claim about `latest` as a snapshot. Before you act on a claim about
`latest`, check `latest` again.

- As of 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions. The
  registry received both versions on 2026-09-06, `<interval>` apart. One
  version carried the tag `latest`. The other version carried the tags `0.9.0`
  and `sha-823aabbd…`. Both versions resolved to image id `bbfdaf6bb8ca`.
  `ghcr.io/mifunedev/agro:0.9.0` also resolved to image id `bbfdaf6bb8ca`.
- In that build, `/opt/agro-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"` and pins vitest `^3.2.6`.
  `GHSA-82fw-gwwq-j7x9` covers `>=2.1.0 <4.1.11`. While that advisory stands,
  the boot install of that build fails. Nobody can edit that build.
- The `0.9.0` and `sha-823aabbd…` tags therefore name a build that cannot cold
  boot. As of 2026-09-08, `latest` named the same build. R1 and R3 exist to
  change that state. After the release that this document describes, `latest`
  must name a working build. From that point, these sentences no longer
  describe `latest`.
- A local build from `development` at `b10ecac3` produced an image. That image
  cold-boots. With no `node_modules` present, `agro-bootstrap.service`
  reached `active (exited)` with `status=0/SUCCESS`. The seeded manifest of that
  image carries no lifecycle hook and pins vitest `^4.1.11`. This result
  describes the source revision only. This result says nothing about the
  published build. Nobody can edit the layers of the published build.

## R1 — Publish a patched image

**Requirement.** Build an image from a source revision that meets two
conditions. The seeded manifest carries no install lifecycle hook. The seeded
manifest pins vitest `>=4.1.11`. Then publish that image.

**Rationale.** The image layers of the `0.9.0` build contain the failing
manifest. Nobody can edit those layers. No source change and no volume-layout
trick rewrites those layers. Only a new build carries a fixed manifest.

**Acceptance.** The `/opt/<seed>/package.json` file in the published image has
no `preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script. The vitest pin in that file resolves to `>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** Complete R1 first. Then do these steps:

1. Pull the tag that R1 published.
2. Cold-boot the pulled image against an empty workspace volume.
3. Run `systemctl is-active agro-bootstrap.service`. The command returns
   `active`.
4. Run `systemctl is-active agro-cron.service`. The command returns `active`.

Accept only on these observed service states.

**Rationale.** A container in the `running` state proves nothing. systemd is
PID 1, and the bootstrap unit is a `Type=oneshot` unit. If the boot fails, the
container stays `running` and `docker exec` still reaches the container. This
property makes the population-B recovery possible. This property also makes
"the container is up" a worthless acceptance signal.

**Acceptance.** The two `is-active` results above, captured from the pulled
published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** The operator makes a deliberate decision and records the
decision in `<decision record>`. This document does not make the decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- As of 2026-09-08, `:latest` resolved to the same failing build. That state
  blocked every new user who does not pin a version. A move of `:latest` to a
  fixed build unblocks those users. Before you act, check what `:latest`
  resolves to.
- Three files reference `ghcr.io/mifunedev/agro:0.9.0`:
  `.agro/scripts/sandbox-upgrade-smoke.sh` (the `LEGACY_IMAGE` default),
  `.github/workflows/sandbox-boot-guard.yml`, and
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three files take
  the real published payload from that version. If the version stays
  published, those three files stay verifiable.
- A user who already runs `0.9.0` recovers with the runbook. That user does not
  need the version withdrawn.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot. No republish under that version can
  change the digest of that build. If the version stays published, a user who
  pins `0.9.0` gets a failure every time.
- A yank removes the source payload that the upgrade smoke and the recovery
  probe extract. The upgrade smoke and the recovery probe then each need a
  replacement fixture. The recovery procedure then loses the only artifact that
  its verification uses.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** When a patched image exists, the operator reviews the pin. The
operator records the reason for the result in `<decision record>`. This
document does not change the pin. This document does not choose a result.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. The seed directory of `0.9.0` is `/opt/agro-seed`.
- An image built from `development` seeds `/opt/agro-seed` and lays down
  `.agro`. If the pin moves to such an image, the upgrade smoke changes from a
  `.oh`-to-`.agro` upgrade test into a same-layout test. That change silently
  drops the layout-migration coverage that the job exists for.
- The smoke already neutralises the advisory in the copied manifest. The broken
  pin therefore does not block the job.

**Evidence for moving the pin to the patched image:**

- The header of the smoke records a coverage reduction. The smoke no longer
  boots the legacy image. The smoke only extracts files from the legacy image.
  A pin to a bootable image lets the operator reverse that reduction.
- After that move, the operator can remove the workaround that deletes
  `pnpm:devPreinstall` from the copied manifest. The fixture then needs no
  edit.

## R5 — Tell users on the affected image what to do

**Requirement.** Publish guidance in `<guidance channel>` for each user whose
volume the `bbfdaf6bb8ca` build seeded. That build arrived through one of these
tags:

- the `0.9.0` tag;
- the `sha-823aabbd…` tag;
- the `latest` tag, on or before 2026-09-08.

The guidance links
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state these four verified points:

1. A failed boot does **not** destroy the workspace. The container stays
   running, and `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. A pull of the patched image does not repair an
   existing volume. An upgrade never rewrites the `package.json` file of the
   workspace. The user runs the procedure once on each affected volume.
4. A fresh sandbox created from the patched image needs no action.

**Public documentation surface.** The operator checks `mifunedev/agro-web` for
installation or troubleshooting copy. Any such copy must match this guidance.

## R6 — Optional: wire the live half of the recovery probe into CI

**Requirement, if the operator wants this change.**
`.agro/evals/probes/sandbox-boot-advisory-recovery.sh` always runs a
structural half. The boot-and-recover half runs only under
`SANDBOX_BOOT_RECOVERY_LIVE=1`. `.agro/skills/eval/run.sh` caps every probe at
30 seconds, and a real sandbox boot takes about two minutes. A step in
`sandbox-boot-guard.yml` that sets `SANDBOX_BOOT_RECOVERY_LIVE=1` exercises the
whole path. The step costs one image pull and one sandbox boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for the
boot-and-recover half. The eval suite therefore guards the recovery path only
through the structural assertions of the probe. No CI job currently runs the live half.
