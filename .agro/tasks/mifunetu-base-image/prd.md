# PRD: mifunetu base image

Status: DRAFT

## User Stories

### US-001: Probe the build host and record the baseline

**Description:** As the advisor, I want a measured build host and build cost before any change. Each later story then compares against real numbers.

**Acceptance Criteria:**

- [ ] `.agro/tasks/mifunetu-base-image/evidence/perf-baseline.md` records `docker version`, `docker buildx version`, `nproc`, free memory, and free disk on the brain `agro-supervisor`.
- [ ] The file records the wall time of two cold runs of `docker buildx build --target base --load -t mifunetu-baseline:base -f .devcontainer/Dockerfile .` at commit `0171d542`. Before each cold run, the story runs `docker builder prune -af`.
- [ ] The file records the number of `apt-get update` commands in stage `base` and the size of image `mifunetu-baseline:base`.
- [ ] The file records the wall time of two warm runs of the same command. Before each warm run, the story appends one empty line to a scratch copy of `.agro/cli/src/cli.ts` in a temporary build context. The story changes no tracked file.
- [ ] The file records the build context size that `docker buildx build` reports for the default target.
- [ ] After the story, `docker images` lists no `mifunetu-baseline` image. The story deletes only images and build cache that it created.

### US-002: Split the agro-free mifunetu stage

**Description:** As the operator, I want a `mifunetu` stage at the root of `.devcontainer/Dockerfile`. The stage holds the general tools and user `sandbox`, so that one base image exists without agro (ADR #1635 D1 to D3).

**Acceptance Criteria:**

- [ ] The first `FROM` line of `.devcontainer/Dockerfile` is `FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS mifunetu`.
- [ ] Stage `base` starts `FROM mifunetu` and holds only the agro additions: `ENV container=docker`, `AGRO_PROJECT_ROOT`, `HERMES_HOME`, `cc-safety-net`, `/opt/agro-assets`, and the agro CLI build.
- [ ] Stage `mifunetu` holds the apt tool set, `gh`, `docker-ce-cli`, `docker-compose-plugin`, hadolint 2.12.0, bun, uv, and pnpm 10.33.0. The stage also holds `TZ`, the pnpm, npm, and uv variables, and user `sandbox` with uid 1000.
- [ ] Stage `mifunetu` contains none of these strings: `/opt/agro`, `agro-assets`, `cc-safety-net`, `AGRO_`, `HERMES_HOME`, `container=docker`.
- [ ] Stage `mifunetu` ends with `USER sandbox` and `WORKDIR /home/sandbox`. Stage `base` starts with `USER root`.
- [ ] `cc-safety-net` installs under `/usr/local`, not under `/home/sandbox/.local`.
- [ ] Stage `mifunetu` sets `org.opencontainers.image.source` to `https://github.com/mifunedev/agro` and `org.opencontainers.image.title` to `mifunetu`.
- [ ] A new test `.agro/scripts/__tests__/mifunetu-image.test.ts` asserts each criterion above against `.devcontainer/Dockerfile`.
- [ ] `agro run -- pnpm exec vitest run .agro/scripts/__tests__/mifunetu-image.test.ts .agro/scripts/__tests__/sandbox-base-image.test.ts .agro/scripts/__tests__/sandbox-marker.test.ts .agro/scripts/__tests__/sandbox-privilege-boundary.test.ts .agro/scripts/__tests__/hooks.test.ts .agro/scripts/__tests__/node-pnpm-parity.test.ts` exits 0.
- [ ] `agro run -- hadolint --config .hadolint.yaml --failure-threshold warning .devcontainer/Dockerfile` exits 0. If DL3002 fires on `USER root` in stage `base`, the story adds DL3002 to `.hadolint.yaml` with a one-line reason.
- [ ] `docker buildx build --target mifunetu --load -t mifunetu:dev -f .devcontainer/Dockerfile .` exits 0 on the brain.

### US-003: Performance 1, cut mifunetu image bytes

**Description:** As the operator, I want stage `mifunetu` to drop unused bytes. A cold build then exports less data. The apt merge of `ad2cf369` made the cold build slower (`evidence/perf-apt.md`: mean 132.0 s before, 163.4 s after), so this story reverts that merge.

**Acceptance Criteria:**

- [ ] Stage `mifunetu` keeps the three apt layers of commit `dd2ab0bc`. The single apt `RUN` of commit `ad2cf369` is gone.
- [ ] The Dockerfile installs no bun. `git grep -n -i -w bun -- .devcontainer .agro/scripts docs` prints no match.
- [ ] `.agro/scripts/verify-sandbox-image.sh` and `.agro/scripts/__tests__/verify-sandbox-image.test.ts` check no bun. `docs/installation.md` does not list Bun.
- [ ] `docker run --rm mifunetu:dev bash -lc 'cd /tmp && pnpm --version'` prints `10.33.0` and downloads nothing.
- [ ] `docker run --rm mifunetu:dev bash -lc 'gh --version && docker --version && docker compose version && hadolint --version && uv --version'` exits 0.
- [ ] `.agro/tasks/mifunetu-base-image/evidence/perf-bytes.md` records two cold runs at `dd2ab0bc` and two cold runs at the story commit. The runs alternate, and `docker builder prune -af` runs before each. The file records the image size of each.
- [ ] The mean cold wall time and the image size at the story commit are lower than at `dd2ab0bc`.
- [ ] `agro run -- pnpm exec vitest run` on `mifunetu-image.test.ts`, `sandbox-base-image.test.ts`, `verify-sandbox-image.test.ts`, `check-pnpm-pin.test.ts`, and `node-pnpm-parity.test.ts` in `.agro/scripts/__tests__/` exits 0.
- [ ] `agro run -- hadolint --config .hadolint.yaml --failure-threshold warning .devcontainer/Dockerfile` exits 0.

### US-004: Performance 2, cache the agro CLI dependency layer

**Description:** As a developer, I want a change to agro CLI source to reuse the cached CLI dependency layer. A warm image rebuild after a source change then skips the full `npm install`.

**Acceptance Criteria:**

- [ ] Stage `base` copies `.agro/cli/package.json` and `.agro/cli/package-lock.json` first, runs `npm install --ignore-scripts --no-audit --no-fund` in `/opt/agro`, then copies the rest of `.agro/cli/` and runs `npm run build`.
- [ ] `.dockerignore` excludes `**/node_modules/`, so that the build context does not carry `.agro/cli/node_modules` from the host.
- [ ] `/usr/local/bin/agro` resolves to `/opt/agro/dist/agro.js`, and `docker run --rm <base image> agro --version` prints the version in root `package.json`.
- [ ] `.agro/tasks/mifunetu-base-image/evidence/perf-cli-layer.md` records the wall time of two warm runs at the US-003 commit and two warm runs at the US-004 commit. Each run is `docker buildx build --target base --load -t mifunetu-perf:base -f .devcontainer/Dockerfile .` after a one-line change to a scratch copy of `.agro/cli/src/cli.ts`. The story changes no tracked file for the measurement.
- [ ] The file records the build context size before and after the `.dockerignore` change.
- [ ] The mean warm wall time after the change is lower than the mean before the change. The log of the after run shows the `npm install` step as `CACHED`.
- [ ] `.agro/scripts/__tests__/mifunetu-image.test.ts` asserts the order of the manifest copy, the install, the source copy, and the build.
- [ ] After the story, `docker images` lists no `mifunetu-perf` image.

### US-005: Smoke test and publish mifunetu in the release workflow

**Description:** As the operator, I want each release to build, smoke-test, and push `ghcr.io/mifunedev/mifunetu` from the release commit. Consumers then get a tested base image with each agro version (ADR #1635 D4).

**Acceptance Criteria:**

- [ ] A new script `.agro/scripts/mifunetu-smoke.sh <image>` exits 0 only when each check passes in `<image>`. The checks: `id -un` prints `sandbox`; `id -u` prints `1000`; `pwd` prints `/home/sandbox`; `command -v agro` fails; `node --version` starts with `v24.`. The last check: `npm i -g @mifune/agro && agro --version` exits 0 as user `sandbox` without `sudo`.
- [ ] The script exits 2 and prints a usage line when `<image>` is missing.
- [ ] Job `publish-image` in `.github/workflows/release.yml` builds `--target mifunetu --load` after the agro image build in the same job. The build reuses the warm builder cache. The tags are `ghcr.io/mifunedev/mifunetu:${RELEASE_VERSION}` and `ghcr.io/mifunedev/mifunetu:sha-${RELEASE_SHA}`.
- [ ] Job `publish-image` runs `.agro/scripts/mifunetu-smoke.sh` on that image before any `docker push` step of the job.
- [ ] Job `publish-image` pushes the two mifunetu tags after the agro tags. No step moves a `latest` tag for mifunetu.
- [ ] The job list of `release.yml` does not change.
- [ ] `.agro/scripts/__tests__/release-reservation.test.ts` asserts the build, smoke, and push steps and their order.
- [ ] A new test `.agro/scripts/__tests__/mifunetu-smoke.test.ts` runs the script with a fake `docker` on `PATH` and covers the pass case, each failed check, and the missing argument.
- [ ] `bash .agro/scripts/mifunetu-smoke.sh mifunetu:dev` exits 0 on the brain against the US-004 image.
- [ ] `agro run -- shellcheck .agro/scripts/mifunetu-smoke.sh` exits 0.

### US-006: Document mifunetu

**Description:** As a user, I want documentation for the published mifunetu image. The documentation names its tags, user, start directory, and the command that installs agro.

**Acceptance Criteria:**

- [ ] `docs/deployment-prebuilt-image.md` has a section `## The mifunetu base image` that names the two tags, user `sandbox` with uid 1000, the start directory `/home/sandbox`, the absence of agro, and `npm i -g @mifune/agro`.
- [ ] `.agro/skills/release/SKILL.md` § Artifact set lists the two mifunetu tags. § Operator prerequisites states that the operator sets the GHCR package `mifunedev/mifunetu` to public after its first push.
- [ ] `CHANGELOG.md` `## [Unreleased]` has an `### Added` entry for mifunetu that links #1635.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/deployment-prebuilt-image.md` reports no finding on the new section.

### US-007: Manual review evidence

**Description:** As the advisor, I want a command transcript from fresh state. The transcript proves that the agro image keeps its user contract and that mifunetu meets its contract.

**Acceptance Criteria:**

- [ ] `.agro/tasks/mifunetu-base-image/evidence/manual-review.md` records each command and its output.
- [ ] The transcript builds the default target and `--target mifunetu` from the task branch head on the brain.
- [ ] The transcript shows that `docker run --rm --entrypoint id <new agro image> sandbox` and the same command on `ghcr.io/mifunedev/agro:0.37.0` print the same output.
- [ ] The transcript shows that `/etc/agro/image-environment` in the new agro image equals the file in `ghcr.io/mifunedev/agro:0.37.0`, except for lines that name a version.
- [ ] The transcript runs `bash .agro/scripts/mifunetu-smoke.sh` on the new mifunetu image with exit 0.
- [ ] The transcript runs `agro run --image <new agro image> -- agro --version` with exit 0.
- [ ] After the story, `docker images` lists only the images present before the story. The story deletes the build cache that it created.

## Summary

ADR #1635 (accepted) moves the general layers of stage `base` into a new root stage `mifunetu`. Stage `base` keeps only the agro additions. The release workflow publishes `ghcr.io/mifunedev/mifunetu:<version>` and `:sha-<sha>`.

The operator asked for two performance improvements in this change:

- A merge of the three apt layers made the cold build slower, so US-003 removes unused bytes instead. bun (103 MB) has no caller in the repository, and the operator asked for its removal.
- `COPY .agro/cli/ /opt/agro/` precedes `npm install` (`:69-70`), and `prepare` in `.agro/cli/package.json` runs the build. Each source change therefore reruns the full install. `.dockerignore` excludes only the root `node_modules/`, so a local build context carries the 37 MB `.agro/cli/node_modules`. US-004 copies the manifests first and excludes nested `node_modules`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | stages `mifunetu`, `base`, `home`, `final`, `agro-msb` | The image graph |
| `.dockerignore` | `**/node_modules/` | Build context |
| `.github/workflows/release.yml` | job `publish-image` | Release build, smoke, push |
| `.agro/scripts/mifunetu-smoke.sh` | new | mifunetu contract check |
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | stage derivation from the Node pin | Must stay green |
| `.agro/scripts/__tests__/sandbox-marker.test.ts` | `FROM base AS final` | Must stay green |
| `.agro/scripts/__tests__/release-reservation.test.ts` | job list, `publish-msb-image` assertions | Release contract |
| `.agro/scripts/node-pnpm-parity.sh` | first `FROM node:` match and `corepack prepare pnpm@` | Reads pins from the first stage |
| `.agro/scripts/check-pnpm-pin.sh` | `corepack prepare pnpm@` | Reads the pnpm pin |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `ghcr.io/mifunedev/mifunetu` | new | Two immutable tags for each release |
| `ghcr.io/mifunedev/agro` | unchanged | Same user, environment, and smoke gates |

## Storage

N/A. The change adds no persistent state. GHCR stores the image.

## Architectural Decisions

ADR #1635 holds the decisions: the stage location, user `sandbox` with uid 1000, and start directory `/home/sandbox`. The ADR also holds the stage as the package list and release coupling with immutable tags only.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/mifunetu-image.test.ts` | stage order, agro-free stage, `USER`, `WORKDIR`, one `apt-get update`, CLI layer order | US-002, US-003, US-004 |
| `.agro/scripts/__tests__/mifunetu-smoke.test.ts` | pass, each failed check, missing argument | US-005 |
| `.agro/scripts/__tests__/release-reservation.test.ts` | build, smoke, push order in `publish-image` | US-005 |
| existing Dockerfile tests | derivation, marker, VM mode, hooks pin, pnpm parity | No regression |

## Design Principles

- One Dockerfile and one package list.
- Measure before and after each performance change on the same host.
- No explanatory comments in tracked code.
- The brain runs only Docker lifecycle commands. Tests and linters run through `agro run`.

## Out of Scope

- The exe.dev `new --image` probe and adoption for hands, `agro run`, `agro sandbox`, and msb guests (ADR #1635 step 4).
- Release v0.38.0.
- A `latest` tag for mifunetu.
- A fix for the console uid 1001 mismatch (#1575).

## Open Questions

None.

## Acceptance Criteria

- [ ] Every story has `passes: true` in `prd.json`.
- [ ] CI on the pull request is green.
- [ ] `docker buildx build --target mifunetu` and the default target both build from the task branch head.
- [ ] US-003 and US-004 each record a lower mean wall time after the change.
- [ ] No image installs bun.

## Lessons
