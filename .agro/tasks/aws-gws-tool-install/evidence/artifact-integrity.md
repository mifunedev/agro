# Artifact integrity: US-001

## Scope and surfaces

All development and tests ran inside the existing sandbox, in the isolated `task/1610-tool-code` worktree based on `572b978d`.

- Host and sandbox: applied. Both tools use the existing Linux host gate and sandbox-user installation.
- Lifecycle door: applied. Catalog additions reuse help, list, status, install, repeat-install, and uninstall.
- Canonical and provider surfaces: applied to `.agro/cli`; provider changes are not applicable.
- Root and scaffold: applied to the bundled catalog. Scaffold changes are not applicable.
- Interactive and headless processes: not applicable. No persistent process starts.
- Local and remote operation: applied through the existing persistent user prefix. No attached terminal or login is required.
- Parallel operation: applied through the assigned isolated worktree and four owned write paths.
- Public documentation: assigned to US-002; no documentation or changelog outside this evidence file changed here.
- Verification: applied through tests below. Real built-CLI installation evidence remains assigned to US-003.

## AWS CLI 2.40.1

Downloaded each official HTTPS ZIP with `curl -fsSL <URL> -o <temporary ZIP>`. Both commands exited 0. Ran `sha256sum` on the downloaded ZIPs; exit 0.

| Architecture | Exact URL | Observed SHA-256 |
|---|---|---|
| amd64 / x86_64 | https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.40.1.zip | `fddb097a8ea197dc9beed9e4426ef99aded612a52df64581e079b6e8817e1d24` |
| arm64 / aarch64 | https://awscli.amazonaws.com/awscli-exe-linux-aarch64-2.40.1.zip | `ce999da382eac247be6bd000af1ee16f23a2d25e5906e7fd9a83e54c1ecf37c1` |

No signing key, signature, private key, credential, cloud login, or cloud API was requested or accessed. These pins derive from official HTTPS downloads. This procedure does not provide independent signature authentication. The runtime SHA-256 checks reject bytes that differ from these recorded downloads.

Inspected `aws/install` with `unzip -p <x86_64 ZIP> aws/install`; exit 0. The vendor script accepts `--install-dir`, `--bin-dir`, and `--update`. It rejects an existing `v2/current` symlink without `--update`. It exits successfully for an existing same-version payload before creating launcher symlinks. Therefore, the catalog removes only `lib/aws-cli/v2/2.40.1` after successful download, checksum, and extraction, then invokes the vendor installer with `--update`. This supports fresh installation and repairs incomplete payloads or missing launchers without a new installer abstraction. The absolute installed executable must then report `aws-cli/2.40.1 ` followed by runtime details, with exit 0.

## Google Workspace CLI 0.22.5

Read both official companion files with `curl -fsSL`; both exited 0 and returned:

- https://github.com/googleworkspace/cli/releases/download/v0.22.5/google-workspace-cli-x86_64-unknown-linux-gnu.tar.gz.sha256
  - `de78ecdbd2f1a84cca0063a7ecbc440240fc14b6ebccbb17f4646b792a8c5c1f  google-workspace-cli-x86_64-unknown-linux-gnu.tar.gz`
- https://github.com/googleworkspace/cli/releases/download/v0.22.5/google-workspace-cli-aarch64-unknown-linux-gnu.tar.gz.sha256
  - `94490295d9580e1e88574e715a0a162991747d12d62f8c7b8dcc8268b6c1cea0  google-workspace-cli-aarch64-unknown-linux-gnu.tar.gz`

The exact artifact URLs are those companion URLs without the final `.sha256`. Only the archive-root `gws` executable is installed. Verification captures the absolute executable's stdout with exit propagation, then compares its first line to `gws 0.22.5`. The second disclaimer line is permitted.

## TDD evidence

Before editing `catalog.ts`, added catalog inventories, shell fixture tests, and command integration tests. Ran:

`pnpm exec vitest run .agro/cli/src/__tests__/tool-catalog.test.ts .agro/cli/src/__tests__/tool.test.ts`

Red result: exit 1; 46 tests failed (28 catalog tests and 18 command tests). New tool discovery and installer fixtures failed because `aws` and `gws` did not exist. The red output was captured in a temporary `red.log`, not a tracked test artifact.

After catalog implementation, the targeted suite passed. Additional tests strengthened checksum enforcement, missing-unzip failure, vendor failure, and incomplete AWS payload repair.

The shell tests are explicitly offline fixtures, not real cloud-tool installations. They execute the catalog shell bodies with mocked download/extraction commands and real filesystem installation, launcher execution, and removal. They cover both architecture mappings and exact selected digest values; unsupported architecture before network/prefix writes; default and custom prefixes; bad checksums including a real `sha256sum` rejection; download/extraction/vendor failures; wrong version and nonzero executable exit despite correct version output; two-line GWS output; retry and update behavior; temporary-directory cleanup; whitespace and missing-unzip refusal; and preservation of synthetic AWS/Google configuration and unrelated prefix files on removal.

Command tests cover catalog-derived help/list/status, host installation routing, successful receipts, no receipt on failure, sandbox marker/no-marker repeat installation, failed sandbox installation without a success marker, host no-op repeat installation, receipt-owned uninstall, and refusal to uninstall without a receipt.

## Acceptance mapping

1. Catalog entries, host capability, and sandbox-user metadata: executed catalog and command tests.
2. Pinned versions and architecture checksums: executed checksum selection tests; official artifact evidence above.
3. AWS official HTTPS digest recording without key material or authentication: executed downloads and `sha256sum`; no key handling.
4. amd64/arm64 mapping and early unsupported-architecture rejection: executed shell fixtures.
5. User-prefix installation without sudo and absolute-path verification: executed shell fixtures; reasoned from catalog-only scripts and existing host routing.
6. AWS bundle/launcher layout, unzip prerequisite, whitespace refusal: executed shell fixtures; vendor behavior inspected above.
7. Pinned AWS output, multiline GWS output, and nonzero-exit propagation: executed shell fixtures.
8. Bounded uninstall preserving AWS/Google config: executed real filesystem removal of fixture installations and synthetic credential/config preservation.
9. Tests before production edits: executed red suite above.
10. Command integration coverage: executed targeted command suite.
11. Required targeted Vitest command and typecheck: executed; both exit 0.

Final verification:

- `pnpm exec vitest run .agro/cli/src/__tests__/tool-catalog.test.ts .agro/cli/src/__tests__/tool.test.ts`: exit 0; 2 files passed, 258 tests passed.
- `pnpm run typecheck`: exit 0; `tsc --noEmit` reported no error. npm printed existing configuration warnings only.
- `git diff --check`: exit 0.

No dependency, command, image, boot path, authentication behavior, or shared abstraction changed. Temporary download/test resources created by this worker are removed before handoff. No pre-existing installation or credential was changed.
