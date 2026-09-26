# Release requirements — issue #1019, population A

This document states requirements for the operator. Nobody has performed these
requirements yet. The work that produced this document published no image. That
work moved no tag, cut no release, and changed no CI pin.

Population A is a **new** cold boot that seeds a fresh workspace volume from a
published image. Only a newly published image fixes population A. Population B
is a volume that a `0.9.0` image already seeded. The runbook
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md) repairs
population B. That runbook has passed verification and needs no release.

## Ground truth for these requirements

Each observation below carries a date. A tag can move to a different build. A
digest always names the same build. Treat each claim about `latest` as a
snapshot. Before you act on such a claim, check `latest` again.

- On 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions. Both
  versions arrived on 2026-09-06, `<interval>` apart. One version carried the
  tag `latest`. The other version carried the tags `0.9.0` and
  `sha-823aabbd…`. Both versions resolved to image id `bbfdaf6bb8ca`.
  `ghcr.io/mifunedev/agro:0.9.0` also resolved to image id `bbfdaf6bb8ca`.
- The `/opt/agro-seed/package.json` file in that build carries
  `"pnpm:devPreinstall": "pnpm run security:audit"`. The same file pins vitest
  `^3.2.6`. `GHSA-82fw-gwwq-j7x9` covers `>=2.1.0 <4.1.11`. While that advisory
  stands, the boot install of that build fails. Nobody can edit the build.
- The `0.9.0` tag and the `sha-823aabbd…` tag name a build that cannot cold
  boot. On 2026-09-08, `latest` named that same build. R1 and R3 exist to change
  that `latest` pointer. After the release in this document, `latest` must name
  a working build. At that point, this paragraph no longer describes `latest`.
- An image that the operator built locally from `development` at `b10ecac3`
  cold-boots. With no `node_modules` present, `agro-bootstrap.service` reached
  `active (exited)` with `status=0/SUCCESS`. The seeded manifest of that image
  carries no lifecycle hook and pins vitest `^4.1.11`. This result describes the
  source revision only. This result says nothing about the published build.
  Nobody can edit the layers of the published build.

## R1 — Publish a patched image

**Requirement.** The operator builds an image from a source revision. The seeded
manifest of that revision must carry no install lifecycle hook. The same
manifest must pin vitest `>=4.1.11`. The operator then publishes the image.

**Rationale.** The image layers of the `0.9.0` build contain the failing
manifest. Nobody can edit those layers. No source change and no volume-layout
trick rewrites the layers. Only a new build carries a fixed manifest.

**Acceptance.** The file `/opt/<seed>/package.json` in the published image has
none of these scripts: `preinstall`, `install`, `postinstall`, `prepare`,
`pnpm:devPreinstall`, `pnpm:devPrepare`. The vitest pin in the same file
resolves to `>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** After the operator publishes the image, the operator does these
steps:

1. Pull the published tag.
2. Cold-boot the pulled image against an empty workspace volume.
3. Inside the container, run `systemctl is-active agro-bootstrap.service`. The
   command returns `active`.
4. Inside the container, run `systemctl is-active agro-cron.service`. The
   command returns `active`.

The operator accepts the image only on the service states from steps 3 and 4.

**Rationale.** A container in the `running` state proves nothing. systemd is
PID 1, and the bootstrap unit is `Type=oneshot`. For that reason, a container
with a failed boot stays `running`. The same container also stays reachable
through `docker exec`. This property makes the population-B recovery possible.
This property also makes "the container is up" a worthless acceptance signal.

**Acceptance.** The operator captures the two `is-active` results from the
pulled published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** The operator records a deliberate decision in
`<decision record>`. This document does not make the decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- On 2026-09-08, `:latest` resolved to the same failing build. That state
  blocked each new user who does not pin a version. To unblock those users, the
  operator moves `:latest` to a fixed build. Before the operator moves the tag,
  the operator checks the current target of `:latest`.
- Three files reference `ghcr.io/mifunedev/agro:0.9.0`:
  `.agro/scripts/sandbox-upgrade-smoke.sh` (the `LEGACY_IMAGE` default),
  `.github/workflows/sandbox-boot-guard.yml`, and
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three files take
  the real published payload from that image. If the version stays published,
  those three files stay verifiable.
- A user who already runs `0.9.0` recovers through the runbook. That user does
  not need the operator to withdraw the version.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` build cannot cold-boot. A republish under the same version cannot
  change the digest of that build. While the version stays published, each user
  who pins `0.9.0` gets a failure on every boot.
- A yank removes the source payload that the upgrade smoke and the recovery
  probe extract. Both scripts then need a replacement fixture. The recovery
  procedure also loses the only artifact that its verification uses.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** After a patched image exists, the operator reviews the pin. The
operator records the reason for the decision, whichever option the operator
picks. This document does not change the pin and does not pick an option.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image with a seed that lays down the legacy
  `.oh` control plane. The seed directory of that image is `/opt/agro-seed`.
- An image built from `development` seeds `/opt/agro-seed` and lays down
  `.agro`. If the operator moves the pin to such an image, the upgrade smoke
  changes from a `.oh`-to-`.agro` upgrade test into a same-layout test. That
  change silently drops the layout-migration coverage that the job exists for.
- The upgrade smoke already neutralises the advisory in its copied manifest. The
  broken pin therefore does not block the job.

**Evidence for moving the pin to the patched image:**

- The header of `.agro/scripts/sandbox-upgrade-smoke.sh` records a coverage
  reduction. The upgrade smoke no longer boots the legacy image. The upgrade
  smoke only extracts files from the legacy image. A pin to a bootable image
  lets the operator reverse that reduction.
- After such a pin change, the operator can remove the workaround that deletes
  `pnpm:devPreinstall` from the copied manifest. The fixture then needs no edit.

## R5 — Tell users on the affected image what to do

**Requirement.** The operator publishes guidance on `<channel>`. The guidance
targets each user whose volume came from the `bbfdaf6bb8ca` build. A volume came
from that build through one of these references:

- the `0.9.0` tag;
- the `sha-823aabbd…` tag;
- the `latest` tag, on or before 2026-09-08.

The guidance links to
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state these four verified points:

1. A failed boot does **not** destroy the workspace. The container stays
   running. `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. A pull of the patched image does not repair an
   existing volume. An upgrade never rewrites the `package.json` file of the
   workspace itself. Run the procedure once on each affected volume.
4. A fresh sandbox from the patched image needs no action.

**Public documentation surface.** The operator checks whether
`mifunedev/agro-web` carries installation text or troubleshooting text. If
`mifunedev/agro-web` carries such text, the text must match the guidance.

## R6 — Optional: wire the live half of the recovery probe into CI

**Requirement, if the operator wants this change.**
`.agro/evals/probes/sandbox-boot-advisory-recovery.sh` always runs a structural
half. The boot-and-recover half runs only under `SANDBOX_BOOT_RECOVERY_LIVE=1`.
The reason: `.agro/skills/eval/run.sh` caps each probe at 30 seconds, and a real
sandbox boot takes about two minutes. A step in `sandbox-boot-guard.yml` that
sets `SANDBOX_BOOT_RECOVERY_LIVE=1` exercises the whole path. The CI step costs
one image pull and one sandbox boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for the
boot-and-recover half. In the eval suite, only the structural assertions guard
the recovery path. No CI job runs the live half today.
