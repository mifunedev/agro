# Manual review: Pi extension dependency warnings

## Scope and environment

The worker recovered the existing four-file patch in `bug/1323-pi-extension-issues`.
Only goal and loop pins change. Subagents, tasks, and unrelated settings remain unchanged.
The surface decisions in the PRD still apply. All checks ran inside the sandbox worktree.
The publication target is `origin` (`mifunedev/agro`). This assignment does not push or edit tracker state.

Installed Pi: `1.0.2`. Node: `v22.23.3`. pnpm: `10.33.0`.
The runtime check imports the installed Pi implementation from:

```text
/home/sandbox/.local/lib/node_modules/@earendil-works/pi-coding-agent
```

## Reproduce the runtime check

From the task worktree, run:

```bash
timeout 180 node .agro/tasks/pi-extension-issues/evidence/runtime-check.mjs
```

Result: exit `0`. See [runtime.log](runtime.log) and [runtime-check.mjs](runtime-check.mjs).
The script uses Pi's real `DefaultPackageManager`, `DefaultResourceLoader`, event bus, and in-memory session manager.
It isolates `HOME`, `PI_CODING_AGENT_DIR`, npm cache, package installations, and loop state under a disposable evidence directory.
It removes that directory in `finally`. Session shutdown stops extension resources before cleanup.
No current-session reload, global package change, or model request occurs.

The script executes these checks in order:

1. Install goal `0.4.2` and loop `0.5.5` through Pi.
2. Load the original packages. Pi reports two host-dependency warnings for runtime `typebox` dependencies, with no load errors.
3. Install goal `0.54.8` and loop `0.7.15` into a separate clean package directory.
4. Load the candidates. Pi reports no warnings and no load errors.
5. Change declarations in the original disposable installation to the candidate pins.
6. Execute the installed CLI with `update --extensions --no-approve`. The command prints `Updated packages` and exits `0`.
7. Resolve and reload packages through Pi. Both installed versions now match the candidate pins, with no warnings or load errors.
8. Invoke registered goal commands and monitor tools through the loaded extension objects.
9. Emit session shutdown and remove disposable state.

The update command skips pinned packages. Package resolution during reload replaces mismatched installed versions.
The documentation now distinguishes these operations.
The isolated CLI uses user-scoped declarations and ignores project files. The CLI does not modify this trusted project's package state.

## Observed capabilities

Both clean installation and reconciliation register `/goal`, `/loop`, goal tools, loop tools, and monitor tools.
The candidate goal registers `goal_complete`, `goal_blocked`, and `goal_wait`.
The candidate loop retains `LoopCreate`, `LoopList`, `LoopDelete`, `MonitorCreate`, `MonitorList`, and `MonitorStop`.
The candidate loop also registers additional workflow, orchestration, and update tools, shown in the runtime log.

The command check asserts persisted goal states: `active`, then `paused`, then `null` after clear.
The harness captures outgoing messages instead of starting an agent turn.
UI operations use inert test bindings. These checks verify command behavior, not terminal rendering or paid-model continuation.

The monitor executes `printf 'pi-compat-ok\n'` with a 2-second inactivity timeout.
The event reports `exitCode: 0` and `outputLines: 1`.
`MonitorList` reports `completed`, `exit=0`, and `pi-compat-ok`.
The check awaits the completion event with a 10-second deadline. The check does not poll or leave a monitor running.

## Published source and manifest review

The recovered registry tarballs contain the selected versions and their published entry points.
The runtime check independently installs those versions from npm without manifest patches.

| Package | Manifest and source findings |
| --- | --- |
| Goal `0.54.8` | Host peers `pi-ai`, `pi-coding-agent`, `pi-tui`, and `typebox` all use `*`. The only runtime dependency is `@narumitw/pi-tui-kit@^0.59.0`. Pi loads `dist/index.ts`. |
| Loop `0.7.15` | Host peers `pi-coding-agent`, `pi-tui`, and `typebox` all use `*`. No runtime dependencies. Pi loads `dist/index.js`. Node requirement `>=22.19.0` accepts the installed Node. |
| TUI kit `0.59.0` | Clean installation resolves this version. Host peers `pi-coding-agent` and `pi-tui` use `*`. Runtime dependencies are `grok-mermaid@0.2.3` and `highlight.js@11.12.0`. |

Goal command registration dispatches start, pause, resume, edit, and clear operations.
The goal lifecycle registers session startup and shutdown cleanup.
Goal tools import Pi's `defineTool` and `typebox`; the real loader resolves these imports successfully.
TUI-kit source imports host TUI components through package imports. The package does not declare a runtime host copy.
Loop source registers the retained tools and session cleanup for schedulers and monitors.
The bounded monitor check exercises its published process manager rather than a substitute implementation.

The upgrades include upstream behavior changes beyond manifest metadata.
Goal completion now requires `goal_id`; loop monitor timeout now measures inactivity rather than total duration.
The registered schemas communicate those changes to the model.
The check does not certify every new workflow feature or the interactive goal menus.

## Repository checks

The interrupted worker recorded the red exact-pin test before changing settings.
[settings-focused-red.log](settings-focused-red.log) shows the candidate expectations against original pins: one failed test, exit `1`.
[settings-green.log](settings-green.log) records four passing tests after the settings change, exit `0`.

| Command | Output | Exit |
| --- | --- | --- |
| `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` | 4 passed | 0 |
| `pnpm run lint` | No root lint configured | 0 |
| `pnpm run typecheck` | `tsc --noEmit` completed | 0 |
| `pnpm run build:harness` | `dist/agro.js` built | 0 |
| `pnpm test` | 88 files passed; 1851 tests passed; 2 skipped | 0 |

The recovery worker reran the full test suite because the interrupted worker's final test log had no exit status.
The retained build, typecheck, lint, and focused-test logs already contained successful exit statuses.
See [checks-summary.log](checks-summary.log) for compact output and the retained focused red/green logs for the regression case.

## Remaining verification

CI and PR publication remain the advisor's responsibility after the authorized push.
The tracker and PR manual-review section remain unchanged under the worker's write boundary.
This check does not cover live-model execution, interactive rendering, every new upstream capability, or coexistence with the complete extension set.
Subagents and tasks retain their known manifest warnings and exact pins.
