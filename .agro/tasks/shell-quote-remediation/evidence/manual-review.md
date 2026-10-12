# Issue #1430 manual review

## Scope

Run these checks inside the sandbox worktree:
`/home/sandbox/harness/.worktrees/bug/1430-shell-quote-remediation`.
The worker changed only the assigned tracked paths.
The advisor owns acceptance, publication, merge, and cleanup.
No worker wrote `prd.json` or changed an active installation.

Applied surfaces: sandbox execution, canonical/provider pin parity,
root/scaffold configuration, isolated worktree operation, documentation, and tests.
Lifecycle verbs and persistent interactive/headless services are not applicable.
Remote operation received no new validation.

## Baseline evidence

The prior disposable baseline remains at
`/tmp/pi-upgrade-preflight.tZH9cu/baseline/npm`.
Its cc-safety-net manifest reports version `1.0.6` and
`"shell-quote": "^1.8.4"`.
The prior audit at `/tmp/pi-upgrade-preflight.tZH9cu/npm-audit-project.json`
reports one critical vulnerability: `GHSA-pqg4-j6r4-53mv`.
The baseline CLI, main, and Pi bundles contain `shell-quote` identifiers.
The source scan preserves those findings in `/tmp/1430-source-scan.json`.

The earlier bounded comparison remains at
`/tmp/cc-safety-preflight.3Rf6xf/REPORT.md`.
Its `probe.mjs`, `results-full-event.json`, and `payload-contract-results.json`
preserve the 189 full-event comparisons and the missing-event behavior.
The worker preserved every baseline artifact.

## Changes

Pin cc-safety-net `2.6.8` in Pi, the Dockerfile, and provider-link validation.
Preserve the accepted Subagents `0.20.0` upgrade and its Pi `>=1.1.0` requirement.
Test all three guard pins and the supported `PreToolUse` JSON payload.
Test harmless echo, direct hard reset, and nested hard reset decisions.
The tests pass command strings as JSON data; they never execute those strings.
Keep existing hook matchers and opt-outs unchanged.
Update the security contract and preserve upstream changelog entries.

## Repository checks

```bash
pnpm install --frozen-lockfile
export PATH=/tmp/cc-safety-preflight.3Rf6xf/node_modules/.bin:$PATH
export CC_SAFETY_NET_HOME=/tmp/1430-ccsn-home
cc-safety-net --version
pnpm exec vitest run .agro/scripts/__tests__/hooks.test.ts .pi/extensions/__tests__
pnpm test
pnpm typecheck
pnpm build
pnpm security:audit
CC_SAFETY_NET_STRICT=1 bash .agro/scripts/link-providers.sh --check
bash .agro/skills/ste/scripts/ste-check.sh docs/security-considerations.md docs/harnesses/pi.md
git diff --check
```

Observed output:

```text
Locked dependency installation: exit 0
cc-safety-net --version: 2.6.8
Targeted: 7 files passed, 187 tests passed, exit 0
Full suite: 104 files passed, 2457 passed, 2 skipped, exit 0
Typecheck: exit 0
Build: dist/agro.js 301.8kb, exit 0
Root audit: No known vulnerabilities found, exit 0
Provider check: Providers OK, exit 0
STE documentation check: exit 0
Diff whitespace check: exit 0
```

Logs: `/tmp/1430-pnpm-install.log`, `/tmp/1430-targeted.log`,
`/tmp/1430-full.log`, `/tmp/1430-typecheck.log`, `/tmp/1430-build.log`,
`/tmp/1430-root-audit.log`, `/tmp/1430-links.log`, and `/tmp/1430-ste.log`.
The disposable `2.6.8` binary ran the assertions; the global `1.0.6` binary did not.

Before pin changes, `/tmp/1430-red.log` recorded two expected pin failures.
It also recorded a nested-clean fixture failure in this linked worktree.
The final fixture uses nested reset with an explicit `HEAD` target.
The guard denies that command without relying on linked-worktree clean policy.
The final suite has no failures.

## Disposable Pi installation

`/tmp/1430-prepare-pi.mjs` copies worktree settings and extension resources.
It uses the installed disposable Pi `1.1.0` CLI to install all eight exact pins.
It sets isolated `HOME` and `PI_CODING_AGENT_DIR` paths under `/tmp/1430-pi`.
Its `npmCommand` supplies `--ignore-scripts` and `--legacy-peer-deps`.
It copies no authentication, sessions, tasks, or loops.

```bash
node /tmp/1430-prepare-pi.mjs
env -i PATH="$PATH" HOME=/tmp/1430-pi/home node /tmp/1430-pi-loader.mjs
npm --prefix /tmp/1430-pi/project/.pi/npm audit --json
npm --prefix /tmp/1430-pi/project/.pi/npm ls shell-quote --all
node /tmp/1430-source-scan.mjs
```

Observed output:

```text
Pi CLI version: 1.1.0
Eight installed manifests match the worktree pins: exit 0
Resource loader: 12 extensions, 30 compiled schemas, zero errors, exit 0
Warnings: only pi-tasks 0.7.0's TypeBox runtime dependency
Prompt/theme diagnostics: empty
Disposable Pi npm audit: zero vulnerabilities, exit 0
npm ls shell-quote --all: (empty), exit 1
Candidate published JavaScript: 12 files scanned, zero shell-quote identifier hits
Baseline published JavaScript: 3 files scanned, 3 identifier hits
```

The empty dependency query returns exit 1 because no package matches.
The scan checks `shell-quote`, `shell_quote`, and `shellQuote` identifiers.
It includes the published CLI and Pi bundles.
Logs: `/tmp/1430-pi-install.log`, `/tmp/1430-pi-loader.log`,
`/tmp/1430-pi-audit.json`, and `/tmp/1430-pi-shell-quote.log`.
Results: `/tmp/1430-pi/manifests.json`, `/tmp/1430-pi/loader-results.json`,
and `/tmp/1430-source-scan.json`.

## Limits

The worker did not rebuild or deploy a Docker image.
The worker did not upgrade an active root or global installation.
No model calls, worker spawns, lifecycle events, or tool execution occurred in the Pi loader.
The loader blocked network fetches and disabled missing-package installation.
Subagents runtime execution, UI, authentication, and remote deployment remain untested.
The retained Tasks warning is outside this change.
Custom v1 guard rules require migration review.
Strict secret-path parsing can deny harmless interpreter literals.
The existing Bash-only Claude/Codex matcher does not activate new file-tool protection.
The worker performed no push, PR, merge, or cleanup.
