# PRD: Node 24 runtime

Status: DRAFT

## User Stories

### US-001: Build the sandbox image on Node 24

**Description:** As an application agent, I want the sandbox to run Node 24. Tools that require Node 24, such as OpenClaw, then run without a private runtime.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` line 1 reads `FROM node:24-trixie-slim AS base`.
- [ ] `.agro/scripts/verify-sandbox-image.sh` sets `EXPECTED_NODE_MAJOR=24`.
- [ ] `.agro/scripts/__tests__/sandbox-base-image.test.ts` expects `node:24-trixie-slim`. The test fails against the old Dockerfile and passes against the new Dockerfile.
- [ ] `.agro/scripts/__tests__/node-pnpm-parity.test.ts` fixtures use `node:24-bookworm-slim` and `node:24-trixie-slim`.
- [ ] `.github/workflows/sandbox-compatibility.yml` passes `node:24-bookworm-slim` and `node:24-trixie-slim` to `node-pnpm-parity.sh`.
- [ ] `bash .agro/scripts/node-pnpm-parity.sh` exits 0 and reports pnpm `10.33.0` on both Node 24 bases.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh` exits 0 against the rebuilt image.

### US-002: Align CI and development pins with Node 24

**Description:** As a maintainer, I want CI and local development to use the same Node major as the sandbox. A test then passes in CI only when the test passes in the sandbox.

**Acceptance Criteria:**

- [ ] Each `actions/setup-node` step in `.github/workflows/ci-harness.yml`, `.github/workflows/publish-cli.yml`, `.github/workflows/release.yml`, and `.github/workflows/sandbox-boot-guard.yml` sets `node-version: "24"`.
- [ ] Each step name that reads `Setup Node 22.x` reads `Setup Node 24.x`.
- [ ] The `sandbox-boot-guard.yml` comment at line 109 names Node 24.x.
- [ ] `.nvmrc` holds `24`.
- [ ] `.agro/cli/package.json` declares `@types/node` `^24.0.0`, and the lockfile matches.
- [ ] `git grep -n -E 'node-version: "?22' -- .github` returns no line.
- [ ] `pnpm test` and `pnpm --dir .agro/cli typecheck` exit 0 on Node 24.

### US-003: Offer Node 24 in the host installer

**Description:** As an operator on a host, I want `install.sh` to offer Node 24 when Node is missing. A new host then matches the sandbox Node major.

**Acceptance Criteria:**

- [ ] `.agro/scripts/install.sh` help text and prompts name `Node 24` in place of `Node 22`.
- [ ] The nvm path in `install.sh` installs Node 24.
- [ ] The minimum host Node for `agro` stays 20. `node_major` checks keep `-ge 20`.
- [ ] Root `package.json` and `.agro/cli/package.json` keep `engines.node` at `>=20`. `.agro/cli/build.mjs` keeps `target: "node20"`.
- [ ] `.agro/scripts/__tests__/install.test.ts` covers the Node 24 prompt text and exits 0.

### US-004: Keep existing sandboxes working after the upgrade

**Description:** As an operator with an existing sandbox, I want my installed harnesses to keep working after the image changes to Node 24. The persistent home volume holds packages that npm built on Node 22.

**Acceptance Criteria:**

- [ ] `.agro/scripts/sandbox-upgrade-smoke.sh` runs an upgrade from a Node 22 image to the Node 24 image on one home volume.
- [ ] After the upgrade, `<binary> --version` exits 0 for each npm harness that the smoke installs before the upgrade: `claude`, `codex`, `pi`, and `opencode`.
- [ ] If a harness fails after the upgrade, `agro harness install <id>` repairs the harness. `docs/harnesses/overview.md` states this repair step.
- [ ] The smoke records each failed harness by id and exit code.

### US-005: Update documentation

**Description:** As an operator, I want the documentation to name the Node version that the sandbox ships. I then diagnose engine errors without reading the Dockerfile.

**Acceptance Criteria:**

- [ ] `docs/installation.md` states that the image ships Node.js 24. The prerequisites row names Node 24 as the recommended host version and keeps Node 20 as the minimum.
- [ ] `docs/harnesses/t3code.md` names `node:24-trixie-slim` as the base image.
- [ ] `docs/connecting.md` line 225 gives a remedy that matches Node 24.
- [ ] `AGENTS.md` line 164 keeps "Node 20 or newer" for the host.
- [ ] `CHANGELOG.md` holds a `Changed` entry under `## [Unreleased]` that links the task issue.
- [ ] `.agro/cli/src/__tests__/docs-reference.test.ts` exits 0.

### US-006: Record manual review evidence

**Description:** As a maintainer, I want a command transcript. A reviewer then verifies the image, the tests, and the upgrade path on Node 24 from the transcript.

**Acceptance Criteria:**

- [ ] The story depends on US-001, US-002, US-003, US-004, and US-005.
- [ ] `.agro/tasks/node-24-runtime/evidence/manual-review.md` records each command, its output, and its exit status.
- [ ] The transcript shows `node --version` inside the rebuilt sandbox with a `v24.` prefix.
- [ ] The transcript shows `verify-sandbox-image.sh`, `node-pnpm-parity.sh`, `pnpm test`, and the upgrade smoke.
- [ ] The run builds images and volumes only with operator approval, and the transcript ends with the removal of each created image, container, and volume.

## Summary

The sandbox image uses `FROM node:22-trixie-slim` (`.devcontainer/Dockerfile:1`). The operator reports recent tools that require Node 24. OpenClaw requires Node 24.16 or later (`https://docs.openclaw.ai/install`). The plan at `.agro/tasks/openclaw-harness-support/prd.md` depends on this task.

Verified Node 22 pins:

- Image: `.devcontainer/Dockerfile:1`, `.agro/scripts/verify-sandbox-image.sh:9`.
- Tests: `.agro/scripts/__tests__/sandbox-base-image.test.ts:11` and `:26`, `.agro/scripts/__tests__/node-pnpm-parity.test.ts:46-61`.
- CI: `ci-harness.yml:64-67`, `publish-cli.yml:44-47`, `release.yml:33-36` and `:263-266`, `sandbox-boot-guard.yml:109-111`, `sandbox-compatibility.yml:58-59`.
- Development: `.nvmrc` holds `22`. `.agro/cli/package.json` declares `@types/node` `^22.0.0`.
- Host installer: `.agro/scripts/install.sh:69-146` offers nvm and Node 22.
- Docs: `docs/installation.md:22`, `:40`, `:190`; `docs/harnesses/t3code.md:15`; `docs/connecting.md:225`.

The tag `node:24-trixie-slim` exists on Docker Hub. Node 24 still bundles corepack, so the pnpm activation at `.devcontainer/Dockerfile:47` stays unchanged.

Selected approach: raise the sandbox, CI, and development Node major to 24. Keep the host minimum for the `agro` CLI at Node 20. The CLI runs on the host, and a higher floor breaks existing hosts for no CLI need.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/Dockerfile` | `FROM node:22-trixie-slim AS base` | Base image Node major. |
| `.agro/scripts/verify-sandbox-image.sh` | `EXPECTED_NODE_MAJOR` | Image check. |
| `.agro/scripts/node-pnpm-parity.sh` | `node_major`, `BASE_A`, `BASE_B` | Derives the major from the Dockerfile. No change needed. |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | upgrade flow | Upgrade path for an existing home volume. |
| `.agro/scripts/install.sh` | `node_major`, nvm install path, `print_help` | Host Node offer. |
| `.github/workflows/*.yml` | `actions/setup-node` steps | CI Node major. |
| `.nvmrc` | file content | Development Node major. |
| `.agro/cli/package.json` | `@types/node`, `engines.node` | Types follow Node 24. The engine floor stays `>=20`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Sandbox image | Runtime change | `node --version` prints `v24.*`. |
| `install.sh` | Prompt text | Offers Node 24 in place of Node 22. |
| `docs/installation.md` | Doc change | Names Node 24 for the image. |

## Storage

The persistent home volume at `/home/sandbox` holds npm harness installs under `/home/sandbox/.local`. npm built those packages on Node 22. A package with a native addon can fail on Node 24 because the Node ABI changes. US-004 covers this upgrade path. The task adds no new storage.

## Architectural Decisions

- Source of truth for the sandbox Node major: `.devcontainer/Dockerfile` line 1. `node-pnpm-parity.sh` already derives the major from that line.
- CI and `.nvmrc` follow the sandbox major.
- The host CLI floor and the sandbox runtime major stay separate decisions. This task changes only the sandbox runtime major.
- Operator decision N1A: the host floor stays Node 20. `install.sh` and the docs recommend Node 24.
- Operator decision N2A: the image uses the floating `node:24-trixie-slim` tag. The tag follows the current `node:22-trixie-slim` policy.
- Operator decision N3A: this task gets its own GitHub issue. OpenClaw support gets a separate issue. The advisor opens both issues before `prd.json` conversion.
- The open task `.agro/tasks/host-node-provisioning/` sets the private host runtime default to `latest-v22.x`. That task changes the default to `latest-v24.x` when it resumes.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-base-image.test.ts` | expects `node:24-trixie-slim` | US-001 |
| `.agro/scripts/__tests__/node-pnpm-parity.test.ts` | Node 24 fixtures | US-001 |
| `.agro/scripts/__tests__/install.test.ts` | Node 24 prompt; floor 20 | US-003 |
| `.agro/scripts/sandbox-upgrade-smoke.sh` | Node 22 to Node 24 on one volume | US-004 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | doc paths resolve | US-005 |
| `.agro/tasks/node-24-runtime/evidence/manual-review.md` | live transcript | US-006 |

Run `pnpm test`, `pnpm test:scripts`, and `pnpm --dir .agro/cli typecheck`.

## Design Principles

- Keep one source of truth for the sandbox Node major: the Dockerfile.
- Keep the host floor and the sandbox runtime separate. The change avoids a host breakage that no host feature needs.
- Treat the persistent home volume as existing state. The upgrade proves or repairs each installed harness.
- The change adds no explanatory comment to tracked code.

## Out of Scope

- A host Node floor above 20.
- A change to `.agro/cli/build.mjs` target `node20`.
- Node 26 or a multi-version image.
- OpenClaw support. `.agro/tasks/openclaw-harness-support/` owns that work.
- The private host runtime in `.agro/tasks/host-node-provisioning/`.

## Open Questions

None. The operator resolved each question on 2026-10-08. The Architectural Decisions section records the answers.

## Acceptance Criteria

- [ ] `git grep -n -E 'node:22|node-version: "?22' -- .devcontainer .github .agro/scripts` returns no line.
- [ ] `node --version` in the rebuilt sandbox prints a `v24.` prefix.
- [ ] `bash .agro/scripts/verify-sandbox-image.sh` exits 0 against the rebuilt image.
- [ ] `pnpm test`, `pnpm test:scripts`, and `pnpm --dir .agro/cli typecheck` exit 0.
- [ ] The upgrade smoke from US-004 exits 0.
- [ ] `.agro/tasks/node-24-runtime/evidence/manual-review.md` holds the US-006 transcript.

## Lessons

Filled by the advisor before undraft.
