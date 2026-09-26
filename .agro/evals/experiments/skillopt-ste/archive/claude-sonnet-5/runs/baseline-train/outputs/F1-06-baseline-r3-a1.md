# Release requirements — issue #1019, population A

This document lists requirements for the operator. Nobody has performed the
requirements yet.

The work that produced this document did not publish an image. The work did
not move a tag. The work did not cut a release. The work did not change a CI
pin.

Population A is a new cold boot. A new cold boot seeds a fresh workspace
volume from a published image. Only a newly published image fixes population
A's cold-boot failure. Population B is a volume already seeded from `0.9.0`.
The verified runbook
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md) repairs
population B. Population B needs no release.

## Ground truth this rests on

Every observation below carries a date. Tags move. Digests do not move. Read
a claim about `latest` as a snapshot. Before you act on any claim about
`latest`, re-check what `latest` currently resolves to.

- On 2026-09-08, `ghcr.io/mifunedev/agro` held exactly two versions. The
  registry pushed both versions on 2026-09-06, `<time-gap>` apart. The first
  version carries the tag `latest`. The second version carries the tags
  `0.9.0` and `sha-823aabbd…`. All three tags — `latest`, `0.9.0`, and
  `sha-823aabbd…` — resolved to image id `bbfdaf6bb8ca`.
- That image's `/opt/agro-seed/package.json` carries
  `"pnpm:devPreinstall": "pnpm run security:audit"`. That image pins vitest
  `^3.2.6`. `GHSA-82fw-gwwq-j7x9` covers `>=2.1.0 <4.1.11`. The image's boot
  install fails until the advisory closes. The image's layers are immutable;
  no process can edit them.
- The `0.9.0` and `sha-823aabbd…` tags therefore name an image that cannot
  cold-boot. On 2026-09-08, `latest` named that same image. R1 and R3 exist
  to change what `latest` names. After the release described in this
  document, `latest` must name a working image. These sentences will no
  longer describe `latest` after that release.
- An image built locally from `development` at revision `b10ecac3`
  cold-boots. In this local image, no `node_modules` directory exists yet.
  `agro-bootstrap.service` reached `active (exited)` with `status=0/SUCCESS`.
  That local image's seeded manifest carries no lifecycle hook. That local
  image pins vitest `^4.1.11`. This result describes only the source
  revision `b10ecac3`. This result says nothing about the published image,
  because no process can edit the published image's layers.

## R1 — Publish a patched image

**Requirement.** The operator builds an image from a source revision. The
operator publishes that image. That source revision's seeded manifest
carries no install lifecycle hook. That source revision pins vitest
`>=4.1.11`.

**Rationale.** The `0.9.0` image's layers contain the failing manifest
permanently. No process can edit those layers. No source change rewrites the
failing manifest. No volume-layout trick rewrites the failing manifest. Only
a new image carries a fixed manifest.

**Acceptance.** The published image's `/opt/<seed>/package.json` has no
`preinstall`, `install`, `postinstall`, `prepare`, `pnpm:devPreinstall`, or
`pnpm:devPrepare` script. The published image's vitest pin resolves to
`>=4.1.11`.

## R2 — Verify the published artifact, not the source

**Requirement.** After the operator publishes the image, the operator pulls
the published tag. The operator cold-boots the pulled image against an empty
workspace volume. The operator accepts the boot only when both service
checks return `active`:

- `systemctl is-active agro-bootstrap.service` returns `active`.
- `systemctl is-active agro-cron.service` returns `active`.

**Rationale.** A `running` container proves nothing. systemd is PID 1. The
bootstrap unit has `Type=oneshot`. A container whose boot failed still shows
`running`. A container whose boot failed still answers `docker exec`. This
property is what makes the population-B recovery possible. This same
property makes "the container is up" a worthless acceptance signal.

**Acceptance.** The operator captures the two `is-active` results above from
the pulled published tag.

## R3 — Decide whether to supersede or yank `0.9.0`

**Requirement.** The operator records a deliberate decision. This document
does not make that decision.

**Evidence for superseding** (publish a new version and move `:latest`):

- On 2026-09-08, `:latest` resolved to the same failing image. That failing
  image blocked every new user who does not pin a version. Moving `:latest`
  to a fixed image unblocks those users. Before you act on this evidence,
  re-check what `:latest` currently resolves to.
- Three files reference `ghcr.io/mifunedev/agro:0.9.0`:
  `.agro/scripts/sandbox-upgrade-smoke.sh` (as the `LEGACY_IMAGE` default),
  `.github/workflows/sandbox-boot-guard.yml`, and
  `.agro/evals/probes/sandbox-boot-advisory-recovery.sh`. All three files
  source the real published payload from that tag. Keeping the `0.9.0`
  version published keeps those three files verifiable.
- A user already running `0.9.0` recovers with the runbook. That user does
  not need the version withdrawn.

**Evidence for yanking** (delete the `0.9.0` package version):

- The `0.9.0` image cannot cold-boot. No republish under the `0.9.0` tag
  changes its digest. Leaving `0.9.0` published means a user who pins
  `0.9.0` gets a failure on every boot.
- Yanking `0.9.0` removes the source payload that the upgrade smoke and the
  recovery probe extract. The upgrade smoke and the recovery probe would
  then need a replacement fixture. The `0.9.0` payload is the only artifact
  that validates the recovery procedure. Yanking `0.9.0` removes the
  validating payload.

## R4 — Decide the `LEGACY_IMAGE` pin in `sandbox-boot-guard.yml`

**Requirement.** After a patched image exists, the operator reviews the
`LEGACY_IMAGE` pin. The operator records the reason for the decision either
way. This document does not change the pin. This document does not choose
the outcome.

**Evidence for keeping the pin at `0.9.0`:**

- `0.9.0` is the only published image whose seed lays down the legacy `.oh`
  control plane. Its seed directory is `/opt/agro-seed`.
- An image built from `development` seeds the same directory,
  `/opt/agro-seed`, but lays down `.agro` instead of `.oh`. Moving the pin to
  such an image changes the upgrade smoke from a `.oh`-to-`.agro` upgrade
  test into a same-layout test. That change silently drops the
  layout-migration coverage the job exists for.
- The upgrade smoke already neutralizes the advisory in its copied manifest.
  The broken pin therefore does not block the job.

**Evidence for moving the pin to the patched image:**

- The upgrade smoke's header records a coverage reduction: the upgrade smoke
  no longer boots the legacy image; the upgrade smoke only extracts files
  from the legacy image. Pinning a bootable image would let the operator
  reverse that reduction.
- The operator could then remove the workaround that deletes
  `pnpm:devPreinstall` from the copied manifest. The fixture would then need
  no edit at all.

## R5 — Tell users on the affected image what to do

**Requirement.** The operator publishes guidance for every user whose
sandbox pulled the `bbfdaf6bb8ca` image. A user's sandbox pulled that image
through one of three tags: the `0.9.0` tag, the `sha-823aabbd…` tag, or the
`latest` tag on or before 2026-09-08. The guidance links to
[`repair-sandbox-boot-advisory.md`](repair-sandbox-boot-advisory.md).

The guidance must state four points, all verified:

1. A failed boot does **not** destroy the workspace. The container stays
   running. `docker exec` still reaches a shell.
2. Do not run `agro destroy`. Do not delete the volume.
3. Recovery is not automatic. Pulling the patched image does not repair an
   existing volume. An upgrade never rewrites the workspace's own
   `package.json`. Each affected volume needs the procedure run one time.
4. A fresh sandbox created from the patched image needs nothing.

**Public documentation surface.** The operator inspects whether
`mifunedev/agro-web` carries installation or troubleshooting copy. Any such
copy must match this guidance.

## R6 — Optional: wire the recovery probe's live half into CI

**Requirement.** This requirement applies only if the team chooses to run
the probe's live half in CI.
`.agro/evals/probes/sandbox-boot-advisory-recovery.sh` always runs a
structural half. The probe's boot-and-recover half runs only when the
operator sets `SANDBOX_BOOT_RECOVERY_LIVE=1`. `.agro/skills/eval/run.sh` caps every
probe at 30 seconds. A real sandbox boot takes about two minutes. A step in
`sandbox-boot-guard.yml` that sets `SANDBOX_BOOT_RECOVERY_LIVE=1` would
exercise the whole path. That step costs one image pull and one sandbox
boot.

**Rationale.** Under the eval suite, the probe reports `SKIPPED` for its
boot-and-recover half. The probe's structural assertions alone guard the
recovery path there. Nothing in CI currently runs the live half.
