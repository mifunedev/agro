# Pi extension issues

Last checked: **2026-10-18** (Tasks only).

## Current status

**All four repository pins contain TypeBox fixes. The root installed Tasks package remains `0.7.0`.**

The issue #1474 worktree pins Tasks to `0.9.1`; the root installed manifest still reports `0.7.0`.
Only disposable state received the new package.
No live package installation, session restart, or reload ran for this change.
The installed Pi `1.3.0` loader loaded disposable Tasks `0.9.1` without diagnostics.
All seven registered schemas compiled and accepted valid arguments; each rejected invalid arguments.
The check emitted no `session_start`, executed no tools, and made no model calls.
See [Tasks verification](#tasks-verification) for evidence and limits.

### Historical maintenance and upgrade evidence

The following maintenance and upgrade observations predate the Tasks pin change.
Version and manifest-match claims in this historical section describe those earlier checks, not the current installation.

PR [#1431](https://github.com/mifunedev/agro/pull/1431) merged at `adca3a416562c5a352125a1e207d2fbb510f2360`.
The advisor confirmed all six CI checks passed, including the image build and legacy-volume boot check.
The maintenance worker did not recreate the local container.
The worker copied four root files from accepted commit `969695b1a891b12d3d2f7d78ea766dd9e62b9279`.
All four copies match that commit byte for byte.
The advisor owns the root pull and git cleanup.

The project guard now reports `2.6.8`.
All eight installed project manifests match `.pi/settings.json`.
The project audit reports zero vulnerabilities.
The project npm tree and lock contain no `shell-quote` resolution.

Passwordless sudo refused the global update: **BLOCKED**.
`sudo -n npm install --global --ignore-scripts cc-safety-net@2.6.8` exited `1` with `sudo: a password is required`.
The worker did not retry through another route.
`command -v cc-safety-net` resolves to `/usr/local/bin/cc-safety-net`.
That global binary still reports `1.0.6`.
Its runtime dependency tree still contains `shell-quote 1.10.0`.
The global advisory remains unresolved.

The active process still uses its loaded guard code until a new session starts.
No session restart or reload ran.
The guard blocked the JSON-only hook test before execution.
The worker did not retry that test through another route.
Hook behavior and live workers remain untested.
The worker skipped the full root suite because root hook tests still expect the old pin before the advisor pulls.

Maintenance evidence and the original four root files remain under `/tmp/pr1431-postmerge-maintenance`.

The operator authorized Pi `1.1.0` and Subagents `0.20.0` installation after a disposable preflight.
`agro harness install pi` upgraded the sandbox Pi installation.
`pi install --local npm:@tintinweb/pi-subagents@0.20.0` installed the new project pin.
No other repository package pin changed.
The active session was not restarted or reloaded.

The installed Pi manifest and fresh-process `pi --version` both report `1.1.0`.
Node reports `v22.23.3`.
All eight installed project package manifests match the repository pins in `.pi/settings.json`.

### Repository pins and review status

Tasks metadata reflects the 2026-10-18 check; other rows retain their earlier verification claims.

| Package | Repository pin | Latest release checked | Status | Next action |
|---|---|---|---|---|
| `@narumitw/pi-goal` | `0.54.8` | `0.54.11` | Both manifests contain the TypeBox fix. | No upgrade needed solely for this manifest fix. |
| `@trevonistrevon/pi-loop` | `0.7.15` | `0.7.17` | Both manifests contain the TypeBox fix. | No upgrade needed solely for this manifest fix. |
| `@tintinweb/pi-subagents` | `0.20.0` | `0.20.0` | Installed version fixes TypeBox; Pi `1.1.0` meets its minimum. | Review non-wildcard host peers and session behavior separately. |
| `@tintinweb/pi-tasks` | `0.9.1` | `0.9.1` | Wildcard TypeBox peer; no runtime dependencies. Root installation remains `0.7.0`. | Review session behavior separately; do not treat the pin change as a live upgrade. |

## What the warnings mean

[The screenshot](image.png) records four dependency-manifest warnings, not confirmed extension crashes.
The following versions describe the screenshot-era manifests, not current installations.

Pi supplies TypeBox to extensions.
The screenshot-era manifests instead declare TypeBox as a runtime dependency:

- Subagents `0.12.0` declares `@sinclair/typebox`.
- Tasks `0.7.0`, Goal `0.4.2`, and Loop `0.5.5` declare `typebox`.

An installed copy can bypass Pi's extension loader and create duplicate runtime modules.
The upstream fix moves host-provided packages from `dependencies` to `peerDependencies` with a `"*"` range.
Development dependencies can retain versions for builds and tests.

Do not suppress the warnings or patch installed manifests.
A manifest fix does not prove runtime compatibility.

## Upstream evidence

### Goal: fixed and released

[PR #560](https://github.com/narumiruna/pi-extensions/pull/560) merged on 2026-08-05.
The fix moves Goal's TypeBox dependency to a wildcard peer and a development dependency.
The npm manifests for the repository pin `0.54.8` and latest release `0.54.11` contain the fix.
Latest declares `typebox: "*"` and wildcard ranges for all Pi host peers.
Goal needs no upgrade solely to fix this manifest.

### Loop: fixed and released

[Commit `930af96`](https://github.com/trvon/pi-loop/commit/930af96bfc8541b492dde3689ef70b2e0477cc89) declares wildcard host peers.
The npm manifests for the repository pin `0.7.15` and latest release `0.7.17` contain the fix.
Latest declares `typebox: "*"` and wildcard ranges for all Pi host peers.
Release `0.7.17` requires Node `>=22.19.0`.
The local Node version meets that requirement.
Loop needs no upgrade solely to fix this manifest.

### Subagents: TypeBox fix released, host peer issue remains

[PR #359](https://github.com/tintinweb/pi-subagents/pull/359) closed unmerged on 2026-10-09.
The maintainer states that merged [PR #384](https://github.com/tintinweb/pi-subagents/pull/384) supersedes #359.
The source imports `typebox` directly and removes `@sinclair/typebox`.
The latest GitHub release, `v0.20.0`, appeared on 2026-10-09.

The npm `0.20.0` manifest lists only `croner ^10.0.1` and `nanoid ^5.1.16` as runtime dependencies.
It declares TypeBox as a `typebox: "*"` peer.
All Pi host peer ranges remain `>=1.1.0`, not wildcard ranges.
That separate host peer issue remains unresolved.

Installed Pi `1.1.0` meets the declared minimum for Subagents `0.20.0`.
The repository pin and local installed Subagents manifest both report `0.20.0`.
Pi `1.1.0` checks runtime dependencies, not non-wildcard peer ranges, when collecting this manifest warning.
No Subagents warning appeared in the no-model checks.
That result does not resolve the non-wildcard host peer issue.

### Tasks: fixed and released

[PR #67](https://github.com/tintinweb/pi-tasks/pull/67) merged on 2026-10-13 at `db02ad1e5d665dcfb1aafc672e4d9affb3bfdc7d`.
The current GitHub response reports successful build, floor-Pi, and latest-Pi checks.
The published npm `0.9.1` manifest declares `typebox: "*"` as a peer and has no runtime dependencies.
TypeBox remains a development dependency.
The repository pin now selects `0.9.1`.
Its Pi host peer ranges remain `>=0.80.5`, not wildcard ranges; that separate contract issue remains unresolved.
Installed Pi `1.3.0` meets the declared minimum.

Historical check on 2026-10-12: PR #67 remained open, and npm `0.9.0` still declared the TypeBox runtime dependency.
That inspected head had no GitHub checks or commit statuses.
The PR author reported passing lint, typecheck, build, and 404 tests; this investigation did not independently verify those results.

### Tasks verification

Evidence remains under `/tmp/pi-tasks-1474.L4XZ2g`.
The directory contains both published tarballs, `published-source.diff`, npm metadata, PR metadata, and `install.log`.
The disposable install used `--ignore-scripts --legacy-peer-deps` to exclude lifecycle scripts and automatic host peer installation.
The check script is `no-model-loader.mjs`; its output is `loader.log`.
The script imports the installed Pi `1.3.0` loader and host TypeBox compiler directly.
It isolates `HOME`, `PI_CODING_AGENT_DIR`, and the working directory; `PI_TASKS=off` prevents persistent extension task state.
It blocks `fetch` and allows only the factory's subagent protocol ping event.
No subagent extension loads or replies to that ping.
The loader returns no errors or warnings; captured console diagnostics are empty.
Pi `1.3.0`'s direct loader does not generate manifest dependency warnings, so the check also asserts an empty runtime dependency map.
All seven tool schemas accept valid arguments and reject invalid arguments without tool execution.
The separate `data-compat.mjs` check records results in `data-compat.log`.
A disposable `0.7.0` store fixture loads unchanged through the new store implementation.
A separate legacy fixture receives missing dependency, metadata, and timestamp defaults.
Node reports a module-type warning for the published JavaScript store files in this separate data check.
The data check does not suppress that warning or modify package manifests.
No live tasks, sessions, credentials, or user configuration enter the check.

The focused published-source review covers imports, registration, store serialization, configuration, and activation changes from `0.7.0` to `0.9.1`.
The entry point remains `src/index.ts`; TypeBox still imports from `typebox`, and Pi imports retain the `@earendil-works` scope.
All seven tool names and argument schemas remain unchanged.
The serialized envelope remains `nextId` plus `tasks`; task field types remain unchanged.
The default scope remains `session`; `session-global` is optional and preserves existing workspace session files.
Task paths now follow context workspace paths rather than the launch directory.
Operators who open sessions outside the launch workspace must review which existing files those sessions use.
Global configuration, legacy normalization, lock tokens, fork state, auto-clear, widget sorting, and subagent completion behavior also changed.
Spawn timeouts now leave tasks `in_progress`; operators must reset tasks before a retry when no late reply arrives.
These lifecycle, UI, locking, and subagent behaviors received source review, not live execution.
No claim covers every upstream release change or a current-session upgrade.

## Upgrade verification (historical)

The following evidence predates the Tasks `0.9.1` pin and describes the earlier Subagents upgrade.

Evidence remains under `/tmp/pi-upgrade-preflight.tZH9cu`.
The directory contains installation logs, published-source diffs, manifests, loader results, and disposable scripts.
The focused source review covers manifests, imports, registration, and activation paths.
The focused source review does not cover every release change.

The advisor reran the original disposable baseline, new-version, and full-project checks; each exited `0`.
The worker repeated all three checks against the actual upgraded host and copied actual project resources.
Each actual-install check exited `0`:

- Baseline Subagents `0.12.0`: one extension and three compiled tool schemas; the expected `@sinclair/typebox` warning appeared.
- Installed Subagents `0.20.0`: one extension and four compiled tool schemas; no warnings or errors appeared.
- Copied project: 12 extensions and 30 compiled tool schemas; only the Tasks `0.7.0` dependency warning appeared.

The actual-install script imports the installed Pi loader and its TypeBox `Compile` implementation.
It tests valid arguments and missing required arguments for `Agent`, `get_subagent_result`, and `steer_subagent`.
No prompt or theme diagnostics appeared.
It copies only project resource settings, extensions, prompts, themes, and the npm tree into temporary state.
It isolates `HOME`, `PI_CODING_AGENT_DIR`, and the working directory before importing Pi.
It disables Tasks and Loops, blocks `fetch`, and disables package installation.
It copies no credentials, sessions, live tasks, or loops.

Run the actual-install checks separately:

```bash
env -i PATH="$PATH" HOME=/tmp/pi-upgrade-preflight.tZH9cu/actual/home-old node /tmp/pi-upgrade-preflight.tZH9cu/actual/no-model-preflight.mjs old
env -i PATH="$PATH" HOME=/tmp/pi-upgrade-preflight.tZH9cu/actual/home-new node /tmp/pi-upgrade-preflight.tZH9cu/actual/no-model-preflight.mjs new
env -i PATH="$PATH" HOME=/tmp/pi-upgrade-preflight.tZH9cu/actual/home-project node /tmp/pi-upgrade-preflight.tZH9cu/actual/no-model-preflight.mjs project
```

The existing settings and extension suite passed: six files, 47 tests.
The exact-pin test now requires Subagents `0.20.0`.
The disposable loader script remains separate because repository tests do not require an installed global Pi runtime.

These checks made no paid model calls, emitted no `session_start`, and executed no live workers or tools.
Session handlers, scheduling, resume, steering, workflow collisions, UI, authentication, Slack, and deployment remain untested.

The earlier project installer reported one critical `shell-quote` advisory: [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).
The earlier read-only `npm audit --json` exited `1` and confirmed the advisory.
Both historical baseline and actual-install project trees contained `shell-quote 1.10.0`.
No audit fix or unrelated dependency update ran during those earlier checks.

Post-merge maintenance installed the reviewed project guard pin `2.6.8` with `pi install --local npm:cc-safety-net@2.6.8`.
The new project audit exited `0` and reports zero vulnerabilities.
The new project tree contains no `shell-quote` resolution.
The project upgrade resolves the critical advisory.
The blocked global installation still contains the vulnerable dependency.

## Next review

Run read-only checks from the sandbox repository root before selecting further versions.

1. Check current npm release metadata:

   ```bash
   npm view @narumitw/pi-goal@latest version dependencies peerDependencies engines --json
   npm view @trevonistrevon/pi-loop@latest version dependencies peerDependencies engines --json
   npm view @tintinweb/pi-subagents@latest version dependencies peerDependencies engines --json
   npm view @tintinweb/pi-tasks@latest version dependencies peerDependencies engines --json
   ```

2. Check the upstream PR states:

   ```bash
   gh pr view 359 --repo tintinweb/pi-subagents --json state,mergedAt,url,statusCheckRollup
   gh pr view 384 --repo tintinweb/pi-subagents --json state,mergedAt,url,statusCheckRollup
   gh pr view 67 --repo tintinweb/pi-tasks --json state,mergedAt,url,statusCheckRollup
   ```

3. Recheck installed extension versions separately from repository pins.
4. Treat Tasks #67 as merged and npm `0.9.1` as the verified TypeBox manifest fix.
   Compare repository pins with installed manifests; the root installed Tasks `0.7.0` is not the new pin.
   Do not install into live project state or restart a session without operator authorization.
5. Keep Subagents' Pi minimum and non-wildcard host peer issue separate from the verified TypeBox fix.
6. Keep the Goal and Loop pins unless another reviewed change requires an upgrade; their manifests already contain the TypeBox fix.
7. For compatible candidate versions, test installation and extension loading in disposable sandbox state.
8. Test bounded Goal transitions and a harmless Loop monitor command without paid model calls.
9. If runtime checks pass and the source review justifies another upgrade, update selected pins and their exact-pin test in an isolated worktree.
10. Record observed results in this README.
11. Set the review date to the date of the new checks.

Do not restart or reload the active session for verification.
Change the global installation only with operator authorization.
Latest releases contain unrelated changes; select versions only after source and runtime review.

## Related plan

[The earlier partial-fix plan](../../../.agro/tasks/pi-extension-issues/prd.md) remains a draft with unchecked acceptance criteria.
That plan names Goal `0.54.8` and Loop `0.7.15`, which match the current repository pins.
Those versions differ from the latest releases checked here.
The draft provides no proof of completed runtime checks.
