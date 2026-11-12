# PRD: AWS and Google Workspace tool installers

Status: DRAFT

## User Stories

### US-001: Install AWS CLI v2 and Google Workspace CLI

**Description:** As an operator, I want AWS CLI v2 and Google Workspace CLI installers so that I can add either tool without rebuilding.

**Acceptance Criteria:**

- [ ] Add `aws` and `gws` to `.agro/cli/src/lib/tools/catalog.ts` as installable, host-capable tools for the sandbox user.
- [ ] Pin AWS CLI to `2.40.1` and Google Workspace CLI to `0.22.5`; verify each architecture-specific download with a recorded SHA-256 value.
- [ ] Record SHA-256 values from both official HTTPS AWS release ZIPs; require no key material or cloud authentication.
- [ ] Support Debian `amd64` and `arm64`; reject other architectures before downloading or writing installation files.
- [ ] Install only below `${NPM_USER_PREFIX:-$HOME/.local}` without sudo; verify the installed executable by absolute path.
- [ ] Install the AWS bundle below the prefix with `aws` and `aws_completer` launchers; reject missing `unzip` or unsupported whitespace paths before extraction.
- [ ] Require the AWS executable to report the pinned v2 version; accept the documented two-line output of `gws --version`.
- [ ] Remove only managed launchers and payloads during uninstall; preserve AWS and Google credentials and configuration.
- [ ] Add failing tests before implementation for catalog discovery, architecture mapping, integrity failure, download failure, version failure, installation layout, and cleanup.
- [ ] Extend command tests for both tools: help, list, status, host installation, repeat installation, failure propagation, and uninstall.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/tool-catalog.test.ts .agro/cli/src/__tests__/tool.test.ts` exits 0.

### US-002: Document both optional tools

**Description:** As an operator, I want installation instructions so that I can discover the tools and understand their authentication boundary.

**Acceptance Criteria:**

- [ ] Update `docs/installation.md`, `.agro/cli/README.md`, and `README.md` to name `aws` and `gws` as optional tools.
- [ ] Document Linux architecture support, AWS extraction prerequisites, installation layout, removal scope, and separate upstream authentication.
- [ ] Add one issue-linked entry under `CHANGELOG.md` → `Unreleased` → `Added`.
- [ ] Run the STE checker on changed documentation; report no finding on a changed line.

### US-003: Record isolated command evidence

**Description:** As a reviewer, I want a command transcript so that I can verify the user-facing install path without cloud credentials.

**Acceptance Criteria:**

- [ ] Record commands, observed output, exit status, and cleanup in `.agro/tasks/aws-gws-tool-install/evidence/manual-review.md`.
- [ ] Start with a fresh temporary home and a workspace input path that does not exist; pass environment values inline and write no env file.
- [ ] Run the built `agro` entry point to show help, list, install, status, repeat install, and uninstall for both tools.
- [ ] Download and run both real amd64 executables through the isolated installation path; make no AWS or Google API request.
- [ ] Record unsupported-architecture or integrity-failure behavior with an explicitly labeled offline fixture; never present a fixture as a real installation.
- [ ] Preserve pre-existing installations and credentials; delete only temporary resources created by the evidence run.

## Summary

The current catalog has eleven tools. Help, list, status, installation, and removal derive their behavior from that catalog.
Two catalog entries provide the required behavior without a new command, runtime path, or abstraction.

AWS publishes versioned Linux ZIPs and detached signatures. The official installer supports user-owned installation and launcher directories.
Google Workspace CLI publishes native Linux archives with checksum files. Its executable is `gws`; its npm package is `@googleworkspace/cli`.
Native archives avoid npm launcher downloads and add no Node runtime requirement.

Verified upstream sources:

- AWS installation and signatures: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- AWS version selection: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-version.html
- AWS selected tag: https://github.com/aws/aws-cli/tree/2.40.1
- AWS ZIPs: `https://awscli.amazonaws.com/awscli-exe-linux-{x86_64,aarch64}-2.40.1.zip`; both return HTTP 200.
- GWS release: https://github.com/googleworkspace/cli/releases/tag/v0.22.5
- GWS archive layout: https://github.com/googleworkspace/cli/blob/v0.22.5/.github/workflows/release.yml
- GWS version behavior: https://github.com/googleworkspace/cli/blob/v0.22.5/crates/google-workspace-cli/src/main.rs

The GWS GNU archive SHA-256 values are `de78ecdbd2f1a84cca0063a7ecbc440240fc14b6ebccbb17f4646b792a8c5c1f` for x86_64 and `94490295d9580e1e88574e715a0a162991747d12d62f8c7b8dcc8268b6c1cea0` for aarch64.
Each value comes from the corresponding release `.sha256` file.

Affected surfaces:

- **Host and sandbox:** applied. Keep existing routing and Linux host restrictions. Execute development and tests inside this sandbox.
- **Lifecycle door:** applied. Use the existing `agro tool` verbs; add no verb or boot installation.
- **Canonical and provider surfaces:** applied to the canonical `.agro/cli` catalog. Provider changes are not applicable; no provider mirror owns installation.
- **Root and scaffold:** applied to root documentation and the bundled CLI catalog. Scaffold changes are not applicable; no scaffold contains a tool inventory.
- **Interactive and headless processes:** not applicable. Neither installer starts a persistent process.
- **Local and remote operation:** applied. Persist installations in the existing user prefix; require no attached terminal or cloud login.
- **Parallel operation:** applied. Code and documentation workers use separate worktrees; acceptance runs in the main task checkout.
- **Public documentation:** applied in US-002. Generic lifecycle documentation needs no change.
- **Verification:** applied through catalog tests, command tests, full repository checks, real local executable evidence, and CI.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `TOOL_CATALOG`, `findTool`, `resolveToolInstallArgv`, `resolveToolUninstallArgv` | Canonical entries and installation metadata |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `runToolStatus`, `runToolUninstall` | Existing routing, receipts, and repeat-install behavior; unchanged |
| `.agro/cli/src/cli.ts` | `printToolHelp` | Catalog-derived help; unchanged |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | Catalog lists and installer contracts | Exact inventories and executable shell tests |
| `.agro/cli/src/__tests__/tool.test.ts` | `HOST_INSTALLERS`, runner fixtures | User-facing command contracts |
| `docs/installation.md`, `.agro/cli/README.md`, `README.md` | Tool inventories | Discovery and installation documentation |
| `CHANGELOG.md` | `Unreleased` | User-visible release entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install aws` | Addition | Install pinned AWS CLI v2 |
| `agro tool install gws` | Addition | Install pinned Google Workspace CLI |
| `agro tool list`, `status`, `uninstall`, `--help` | Catalog extension | Discover, inspect, and remove either tool |
| Host fallback | Existing behavior | Reuse user-prefix installation and recorded receipts |

## Storage

Use the existing user prefix and AGRO installation markers or host receipts.
AWS owns its bundle directory and two launchers. GWS owns one executable.
Keep cloud credentials outside the managed removal scope. Add no configuration schema.

## Architectural Decisions

Extend the existing catalog only. Reuse Linux architecture mapping and checksum verification patterns.
Use official upstream artifacts; do not run an unconstrained bootstrap or install AWS CLI v1 through pip or apt.
Preserve the existing presence probe and separate version probe contract.
Keep installation separate from authentication. Preserve existing no-op behavior for complete managed installs.
The operator requires no keys for this PR. Derive AWS checksum pins from official HTTPS downloads without PGP key handling.
SHA-256 pins detect changed artifacts; this procedure does not claim independent signature verification.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | Inventories, both architectures, bad checksum, failed download, version mismatch, extraction, prefix scope, cleanup | Catalog and shell installers |
| `.agro/cli/src/__tests__/tool.test.ts` | Help, list, status, host receipt, repeat installation, failed installation, uninstall | Existing command integration |
| `.agro/tasks/aws-gws-tool-install/evidence/manual-review.md` | Real amd64 install, version, no-op, removal; labeled fixture failure | Built CLI and upstream artifacts |

Run `pnpm run typecheck`, `pnpm run build:harness`, `pnpm run lint`, and `pnpm test:scripts` before the final push.
Run the repository baseline before dispatch. Record baseline failures in `.agro/tasks/aws-gws-tool-install/evidence/baseline.md`.

## Design Principles

Keep one source of truth. Add no framework, dependency, or image-time installation.
Use bounded workers and isolated parallel write paths. Keep acceptance with the advisor.
Add no explanatory comments to tracked code. Prefer executed tests to string assertions alone.

## Out of Scope

Authentication, API calls, credential provisioning, Google Cloud CLI, AWS CLI v1, macOS host support, automatic upgrades, and image rebuilds are outside this change.
Browser evidence does not apply because the change has no user interface.

## Open Questions

None.

## Acceptance Criteria

- [ ] Both tool IDs appear in catalog-derived help and support install, status, repeat installation, and uninstall through existing routing.
- [ ] Both architectures have pinned, checksum-verified artifacts; AWS pins derive from the official HTTPS ZIP downloads.
- [ ] Real amd64 installation evidence covers both tools without cloud access or changes to existing installations.
- [ ] Documentation and changelog describe both optional tools and the authentication boundary.
- [ ] Repository checks pass; the PR leaves draft only after CI reports PASS.

## Lessons

- Claim: AWS's same-version installer exits before it repairs missing launchers. Evidence: vendor inspection and executable retry tests. Outcome: fixed in this PR.
- Claim: binary installation needs no cloud login or account keys. Evidence: both real CLIs install and report versions in a fresh home. Outcome: fixed in this PR.
- Claim: the documentation checker reports 16 findings outside the changed lines. Evidence: checker output and the zero-context diff. Outcome: dropped because those lines are outside this change.
