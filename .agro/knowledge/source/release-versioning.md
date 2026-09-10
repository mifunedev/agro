---
title: "Release Versioning"
slug: release-versioning
kind: repo
tags: [release, versioning, semver, calver, github-actions, ghcr, tags, workflow, package-json, agro, npm, repository-dispatch, docs-site]
created: 2026-08-23
updated: 2026-09-09
sources:
  - raw/2026-08-23-release-versioning.md
  - package.json
  - .github/workflows/release.yml
  - .github/workflows/publish-cli.yml
  - .agro/scripts/release-reservation.mjs
  - .agro/scripts/reserve-github-release.mjs
  - .agro/scripts/promote-release-latest.sh
  - .agro/scripts/verify-release-aliases.sh
  - .agro/cli/package.json
  - .agro/cli/legacy/package.json
  - .agro/evals/probes/version-parity.sh
  - .agro/skills/release/SKILL.md
verified_at: c078c91e80647bc0c60cebb7ad1f11d929159d33
related: [oh-cli-portable-lifecycle, agro-web-pipeline]
confidence: confirmed
---

# Release Versioning

## Relevant Source Files
- `package.json:3` — `version`, the source of truth.
- `.github/workflows/release.yml` — `reserve` → `publish-image` → `publish-cli` → `finalize` → `notify-docs`; the smoke sandbox is `agro-release-smoke-<run_id>` (`release.yml:194`).
- `.github/workflows/publish-cli.yml` — npm: `@mifune/agro` only; shim source stays at `.agro/cli/legacy`.
- `.agro/scripts/release-reservation.mjs` — `parseSemVer`, `reserveReleaseVersion`; pure, no I/O, no clock.
- `.agro/scripts/reserve-github-release.mjs` — `releaseTagName` (the only `v` site), `attemptCreate`; user agent `agro-release-reservation` (`:57`).
- `.agro/scripts/verify-release-aliases.sh` — `check`: two tags share one manifest digest.
- `.agro/scripts/promote-release-latest.sh` — canonical-branch check; digest-equal `latest` promotion; `IMAGE_REPOSITORIES` lists `ghcr.io/mifunedev/agro` first (`:89`).
- `.agro/cli/package.json`, `.agro/cli/legacy/package.json` — the CLI and shim versions.
- `.agro/evals/probes/version-parity.sh` — root equals CLI plus CHANGELOG; shim pin equals shim version.
- `.agro/skills/release/SKILL.md` — operator procedure and unverifiable prerequisites.

## Summary
Releases use **SemVer** (`MAJOR.MINOR.PATCH`). Root `package.json` holds the version, a release is a deliberate bump, and an unchanged version gives a green no-op. Creating `refs/tags/v<version>` is the **atomic reservation**; the `v` reaches the git tag and Release name only, while step outputs, GHCR tags, and concurrency groups stay bare. Since #941 one build feeds two image names: the image ships as `openharness` and `agro`. `publish-cli.yml` publishes only `@mifune/agro`. Shim source remains at `.agro/cli/legacy`; already-published shim versions stay on the registry. GHCR alias promotion remains. The Release carries four assets. Since #943 the source repository is `mifunedev/agro` in every manifest and doc — the GitHub rename itself is an operator step in `docs/agro-cutover-runbook.md`, pending at this pin, so `mifunedev/openharness` still resolves directly — and a real release ends with a `repository_dispatch` to the docs site.

Before `v0.1.0` the scheme was UTC CalVer (`YYYY.M.D`, `-N` on collisions). Those tags stay as history; `v0.0.0` is a hand-cut annotated tag closing that era, outside every workflow path.

## Detail

**Trigger.** Only a push to `main` or `master` releases (`release.yml:5-9`); the workflow *creates* the tag, so no tag trigger exists. `validate`, `boot-lint`, and `eval-probes` gate `reserve` (`release.yml:122`), which reads `require('./package.json').version` from the checked-out commit, so every retry resolves the same version.

**Reservation.** `reserveReleaseVersion` calls `attemptCreate` once (`release-reservation.mjs:31`); it POSTs `refs/tags/v<version>` to `/git/refs` with the user agent `agro-release-reservation` (`reserve-github-release.mjs:57`). `201` reserves; on `422` the bridge compares the peeled tag commit to the release SHA:

| Situation | `reservationKind` | `publishedNoop` | Downstream |
| --- | --- | --- | --- |
| version bumped, tag absent | `created` | `false` | full pipeline |
| same SHA, draft exists | `reused-draft` | `false` | resumes |
| same SHA, already published | `published-no-op` | `true` | all skipped |
| tag on a **different** SHA | `already-released` | `true` | all skipped, run stays green |

Under SemVer the version is an input, so `foreign-collision` maps to `already-released` (`release-reservation.mjs:47-48`) and the `publishedNoop` guards on `publish-image`, `publish-cli`, and `finalize` skip: **an unbumped push to `main` is a clean no-op**. `releaseTagName` (`reserve-github-release.mjs:10`) is the one function that adds the `v`.

**One build, four image tags.** `publish-image` runs one `docker buildx build --load` tagged `ghcr.io/mifunedev/openharness:<version>`, `:sha-<sha>`, `ghcr.io/mifunedev/agro:<version>`, `:sha-<sha>`, plus a local smoke tag (`release.yml`, "Build immutable Docker image tags"). Two gates sit between build and push: the boot smoke in a sandbox named `agro-release-smoke-<run_id>` (`release.yml:194`), and a step that fails unless `agro --version` and `oh --version` inside the image both equal `RELEASE_VERSION`. After the four pushes, `verify-release-aliases.sh check` exits 1 unless the two `:<version>` manifest digests match. `promote-release-latest.sh promote` re-reads the canonical branch (`main` else `master`), exits 0 without promoting when the release SHA is not its head, otherwise reads the `:<version>` digest of each `IMAGE_REPOSITORIES` entry (default `ghcr.io/mifunedev/agro ghcr.io/mifunedev/openharness`, agro first, `promote-release-latest.sh:89`), refuses if any differs from the first, and creates `latest` from the pinned digest on every repository.

**One npm package.** `publish-cli.yml` receives the reserved SHA; an existing `@mifune/agro@<v>` is a successful no-op, otherwise it builds `.agro/cli` and publishes `@mifune/agro` with provenance. It does not publish, wait for, or deprecate the `@mifune/openharness` shim. Shim source remains at `.agro/cli/legacy`.

**Finalize.** The job rebuilds the bundles at the released commit, then uploads `agro.js`, `oh.js`, `get-agro.sh`, and `get-oh.sh` (`gh release upload --clobber`) **before** the undraft, so `releases/latest/download/<asset>` resolves once the release is public — `get-agro.sh` and `agro update` fetch there ([[oh-cli-portable-lifecycle]]). Notes come from the `## [<version>] - <date>` CHANGELOG block; `promote-release-latest.sh check` decides `make_latest` from a fresh remote read.

**Notify docs.** Before #943 a release did *not* refresh the docs mirror: the core sent no dispatch, and the site's `pages.yml` relied on its daily schedule to pick up new installers. Now `notify-docs` (`release.yml:377-402`) runs after `finalize` succeeds on a non-no-op release and POSTs `repository_dispatch` with `event_type=agro-release` and `client_payload[ref]=<releaseSha>` to `/repos/${AGRO_WEB_REPO}/dispatches`, authenticated with the secret `AGRO_WEB_DISPATCH_TOKEN`. `AGRO_WEB_REPO` is a repository variable, default `mifunedev/openharness-web`, re-pointed with `gh variable set` after the web rename (`release/SKILL.md:71-76`). An empty secret prints `::notice::Secret AGRO_WEB_DISPATCH_TOKEN is not set; skipping…` and exits 0, so the run stays green and the daily schedule remains the backstop. The site's side is [[agro-web-pipeline]].

**Version sites.** A cut bumps root `package.json` and `.agro/cli/package.json` (with its lockfile) to the same number and adds a dated CHANGELOG heading. `version-parity.sh` is REGRESSION when root ≠ CLI or the heading is missing. The retained shim keeps its own version; the exact `@mifune/agro` pin must equal the shim version, not necessarily the canonical CLI version (`0.9.0` at this pin for all three). #942 moved every site from `.oh/cli/` to `.agro/cli/` and left the reservation model untouched; the only in-file change beyond the paths is the `repository.directory` field in each package.

**Operator prerequisites** (`release/SKILL.md`): the npm token can publish `@mifune/agro`; the GHCR package `mifunedev/agro` is made public after its first push, because a new package is private by default and `agro sandbox install docker` cannot pull it until then.

**Caveat.** `parseSemVer` accepts a bare `2026.8.7`; the source of truth, not the pattern, prevents a CalVer release.

## System Relationships

```mermaid
flowchart TD
    PUSH["push to main|master"] --> GATE["validate + boot-lint + eval-probes"]
    GATE --> READ["read version from package.json"]
    READ --> RESERVE{"POST refs/tags/v&lt;version&gt;"}
    RESERVE -->|201| DRAFT["create draft Release"]
    RESERVE -->|422, same SHA| RECOVER["reuse draft / no-op"]
    RESERVE -->|422, foreign SHA| SKIP["already-released<br/>publishedNoop=true"]
    DRAFT --> IMAGE["one build → openharness + agro<br/>:&lt;version&gt; :sha-&lt;SHA&gt;"]
    RECOVER --> IMAGE
    IMAGE --> SMOKE["boot smoke + agro/oh --version == version"]
    SMOKE --> PUSHIMG["push 4 tags → verify-release-aliases"]
    PUSHIMG --> LATEST["promote latest by digest on both repos"]
    LATEST --> NPM["@mifune/agro"]
    NPM --> ASSETS["upload agro.js oh.js get-agro.sh get-oh.sh"]
    ASSETS --> FINAL["publish Release v&lt;version&gt;"]
    FINAL --> NOTIFY["notify-docs: repository_dispatch agro-release {ref}<br/>skipped with ::notice:: when the secret is absent"]
    SKIP -.->|all jobs skip, run green| DONE["no publication"]
```

Ownership: `package.json` owns the number; `version-parity.sh` pins root to CLI and CHANGELOG, and the shim pin to the shim version. `release.yml` owns the pipeline, `publish-cli.yml` the `@mifune/agro` publish, `release-reservation.mjs` the decision (no I/O), `reserve-github-release.mjs` every GitHub call and the prefix, `verify-release-aliases.sh` alias equality, `promote-release-latest.sh` the canonical-branch check and `latest`, `notify-docs` the dispatch.

## See Also
- [[oh-cli-portable-lifecycle]] — the `agro`/`oh` product split; `agro update` consumes the release assets.
- [[agro-web-pipeline]] — the docs-site mirror the dispatch rebuilds.
- [[audit-architecture]]
