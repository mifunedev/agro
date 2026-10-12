# PRD: Desktop and mobile browser recording for agent-browser

Status: DRAFT

Source: mifunedev/agro#1428. Branch: `feat/1428-browser-recording`. Base: `development`.

## User Stories

### US-001: Install FFmpeg through the tool catalog

**Description:** As an agent, I want `agro tool install ffmpeg` to install a pinned FFmpeg and FFprobe so that recording prerequisites install on demand inside the sandbox.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` has a new `ffmpeg` case that fails before the catalog change and passes after the catalog change.
- [ ] `TOOL_CATALOG` has an `installable` entry with `id: "ffmpeg"`. The install script downloads a pinned static build for `amd64` and `arm64`, checks a SHA-256 sum, and installs `ffmpeg` and `ffprobe` into `${NPM_USER_PREFIX:-$HOME/.local}/bin`.
- [ ] The install script exits 1 when `ffmpeg -hide_banner -encoders` lists no `libx264` encoder.
- [ ] The test asserts that the `agent-browser` entry still installs `agent-browser@0.38.1`.
- [ ] In the sandbox, `agro tool install ffmpeg` exits 0, and `ffprobe -version` exits 0.
- [ ] `docs/installation.md` lists `ffmpeg` in the installable tools and in the host tools table.
- [ ] `pnpm test` and `pnpm --dir .agro/cli typecheck` exit 0.

### US-002: Add the recording helper and the recording test

**Description:** As an agent, I want one helper that starts, bounds, stops, and checks a recording so that each capture produces an honest artifact. The helper uses an owned session.

**Acceptance Criteria:**

- [ ] `.agro/skills/agent-browser/scripts/tests/recording.test.sh` exists and fails before `scripts/record.sh` exists.
- [ ] `record.sh start` accepts `--task`, `--run`, `--purpose evidence|demo`, `--profile desktop|mobile`, `--scenario`, `--url`, and the optional `--criteria`, `--reason`, `--width`, `--height`, `--scale`, `--device`, `--fps`, `--max-seconds`, `--export`, and `--rerun`.
- [ ] Before the browser opens, `record.sh start` exits 1 with an install hint that names `agro tool install ffmpeg` when `ffmpeg`, `ffprobe`, or the `libx264` encoder is missing.
- [ ] `record.sh start` derives the session name `<task>-<run>-<profile>` and writes to the absolute directory `.agro/tasks/<task>/evidence/browser/<run>/<profile>/`. Every `agent-browser` call in the helper passes `--session`.
- [ ] The defaults are H.264 MP4, 30 FPS, and 120 seconds. Evidence desktop is 1280x720. Demo desktop is 1920x1080. Mobile is a 414x896 CSS viewport for both purposes.
- [ ] A watchdog stops the recording after `--max-seconds`. The manifest records `captureStatus: "timeout"` for that case.
- [ ] `record.sh stop --dir <dir> --assertions pass|fail|none` stops and flushes the recording, then closes only the owned session.
- [ ] `record.sh stop` runs `ffprobe` on the video. If `ffprobe` fails, the manifest records `captureStatus: "incomplete"` and the helper exits 1.
- [ ] `manifest.json` records the fields in `## Storage`, with the encoded dimensions read from `ffprobe`, not from the request.
- [ ] For `--purpose demo`, `record.sh stop` writes `thumbnail.png` and `scenario.md`. The helper never overwrites an existing run directory.
- [ ] The test runs on a local fixture with a responsive navigation menu, a form, and a visible state transition. The test proves: desktop and mobile H.264 output at the documented dimensions and 30 FPS; a paired run with two separate artifacts; a failed assertion with a finalized video and `assertionStatus: "fail"`; a timeout; two concurrent sessions where a stop of one leaves the other recording; and an output path that contains a space.
- [ ] The test records the result of `--scale 2` and `--device`: the manifest states whether the encoded video has more pixels than the CSS viewport.
- [ ] When `agent-browser` or Chromium is not available, the test prints `SKIP:` and exits 0, as `clipboard-read.test.sh` does.

### US-003: Correct and extend the agent-browser skill

**Description:** As an agent, I want current browser instructions and a recording procedure so that outdated version guidance does not block me. The skill also holds the evidence-selection policy.

**Acceptance Criteria:**

- [ ] `git grep -n "0\.8\.5" -- .agro/skills` prints no line.
- [ ] `SKILL.md` names `.agro/cli/src/lib/tools/catalog.ts` as the version authority and states no version number of its own.
- [ ] `SKILL.md` defines desktop and mobile dimensions in one table. The `375x812` example is gone.
- [ ] Each `agent-browser` command in the preflight, snapshot, screenshot, recording, and cleanup steps passes `--session "$SESSION"`.
- [ ] The trigger text includes recording, walkthrough, and reproduction requests.
- [ ] `SKILL.md` documents `record.sh` with its implemented syntax, the purpose and profile matrix, the evidence-selection table from mifunedev/agro#1428, the rerun rule, and the dimension rules for CSS viewport, pixel density, encoded size, and export canvas.
- [ ] `SKILL.md` states that a recording is supporting evidence and never satisfies an acceptance or audit gate alone.
- [ ] `.agro/skills/builder/SKILL.md` asks for a recording when interaction or motion matters and keeps assertions and tests.
- [ ] `.agro/skills/git/references/manual-review.md` describes how to link a recording with its scenario, profile, tested revision, assertions, and capture status.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed Markdown file.

### US-004: Document browser recording

**Description:** As an operator, I want public documentation for browser recording so that I can request evidence and demo captures for desktop and mobile.

**Acceptance Criteria:**

- [ ] `docs/integrations/agent-browser.md` exists and gives one example for each of evidence/desktop, evidence/mobile, demo/desktop, and demo/mobile, plus one paired desktop/mobile run.
- [ ] The page states the install steps, the output location, the manifest fields, the viewport-only limitation, the higher-density result from US-002, and the recovery steps for a timeout or an incomplete capture.
- [ ] The page states that videos stay untracked because `.gitignore` ignores `.agro/tasks/*/*` except `prd.md` and `prd.json`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/integrations/agent-browser.md` exits 0.

### US-005: Capture manual review evidence

**Description:** As a reviewer, I want desktop and mobile recordings of the fixture scenario so that I can assess the result. Each recording names the tested revision.

**Acceptance Criteria:**

- [ ] The advisor runs `record.sh` on the fixture for evidence/desktop, evidence/mobile, and demo/desktop, and for one paired run.
- [ ] `.agro/tasks/browser-recording/evidence/manual-review.md` holds the command transcript, each manifest, the `ffprobe` output, the tested commit SHA, and the assertion results.
- [ ] The PR `## Manual review` section links one desktop and one mobile example by `blob/<commit-sha>/<path>?raw=true`, in the shape of `.agro/skills/git/references/manual-review.md`.
- [ ] The advisor deletes each browser session that the capture created. `agent-browser session list` shows no session whose name starts with `browser-recording-`.

## Summary

Verified current state:

- `.agro/cli/src/lib/tools/catalog.ts` installs `agent-browser@0.38.1`. `CHANGELOG.md` records the move from 0.8.5.
- `.agro/skills/agent-browser/SKILL.md` still claims `0.8.5` on lines 68, 73, 74, and 175.
- The viewport table gives mobile `414x896`. The Step 3 comment gives mobile `375x812`.
- Steps 2b, 2c, and 4 call `agent-browser` with no `--session`.
- The sandbox has `agent-browser 0.38.1` and has no `ffmpeg` and no `ffprobe`.
- `agent-browser record start <path.webm|path.mp4> [url] [--fps <n>] [--cursor] [--contact-sheet]` and `record stop` exist in 0.38.1. The help text requires `ffmpeg` with `libx264` for MP4.
- `agent-browser set viewport <w> <h> [scale]` and `agent-browser set device <name>` exist in 0.38.1.
- `.gitignore` ignores `.agro/tasks/*/*` except `prd.md` and `prd.json`. Evidence videos are untracked with no new rule.
- The existing tests `scripts/tests/clipboard-read.test.sh` and `scripts/tests/annotate-screenshot.test.sh` print `SKIP:` and exit 0 without a browser. No CI workflow runs them.

Selected approach: add one `ffmpeg` catalog entry, one bash helper `record.sh` around upstream `agent-browser record`, and one shell test with one fixture. Then edit the existing skill and documentation files.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `TOOL_CATALOG` | Add the `ffmpeg` entry. Keep the `agent-browser@0.38.1` pin. |
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | `tool catalog shape`, new `ffmpeg` case | Prove the install contract and the browser version authority. |
| `.agro/skills/agent-browser/scripts/record.sh` | `start`, `stop` | New helper. Own the capture lifecycle and the manifest. |
| `.agro/skills/agent-browser/scripts/tests/recording.test.sh` | Test cases in US-002 | Real headless recording tests. |
| `.agro/skills/agent-browser/scripts/tests/fixtures/responsive.html` | Fixture page | Responsive menu, form, and state transition. |
| `.agro/skills/agent-browser/SKILL.md` | Trigger, preflight, viewport, session, recording, report | Remove version drift. Add the recording procedure. |
| `.agro/skills/builder/SKILL.md` | Validation evidence guidance | Ask for a recording when interaction or motion matters. |
| `.agro/skills/git/references/manual-review.md` | User-journey shape | Describe recording links. |
| `docs/installation.md` | Tools section | List `ffmpeg`. |
| `docs/integrations/agent-browser.md` | New page | Public recording guide. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| agent-browser skill | Modify | Trigger on recording, walkthrough, and reproduction requests. Accept desktop, mobile, or both. |
| `record.sh start` / `record.sh stop` | New | The flags in US-002. A paired request runs the helper one time for each profile. |
| `agro tool install ffmpeg` | Extend | New catalog entry through the existing tool mechanism. |
| PR `## Manual review` | Modify | Recording link, scenario, profile, revision, assertions, and capture status. |
| Public documentation | Modify | `docs/integrations/agent-browser.md` and `docs/installation.md`. |
| Console UI and public API | N/A | The task changes neither surface. |

## Storage

- Persistence layer: local files in the sandbox workspace.
- Location: `.agro/tasks/<task>/evidence/browser/<run>/<profile>/`, resolved to an absolute path.
- Files: `video.mp4`, `manifest.json`, and for demo also `thumbnail.png` and `scenario.md`.
- `manifest.json` fields: `task`, `run`, `profile`, `purpose`, `session`, `commit`, `dirty`, `scenario`, `criteria`, `selectionReason`, `rerun`, `cssViewport`, `requestedScale`, `effectiveScale`, `encodedSize`, `exportCanvas`, `emulation` (`viewport-only` or `device:<name>`), `fps`, `codec`, `agentBrowserVersion`, `ffmpegVersion`, `startedAt`, `stoppedAt`, `captureStatus` (`complete`, `timeout`, `incomplete`), and `assertionStatus` (`pass`, `fail`, `none`).
- A demo retake uses a new `<run>`. A downstream edit writes a new file that names its source run. The helper never overwrites an existing run directory.
- Git ignores the directory through the existing `.agro/tasks/*/*` rule. Commit a selected file with `git add -f <path>` only for the PR `## Manual review` section.

## Architectural Decisions

- Source of truth: `TOOL_CATALOG` owns the agent-browser and FFmpeg versions. The skill states no version.
- Session identity: one session per task, run, and profile. The helper passes `--session` to each call, which includes preflight and cleanup.
- Execution location: the browser, FFmpeg, and the helper run in the sandbox. The host install path for `agent-browser` stays unchanged.
- FFmpeg source: a pinned static build with a SHA-256 check, in the same pattern as `herdr` and `cloudflared`. The worker records the build URL and the sum in the catalog entry.
- Mobile emulation: the default is `viewport-only`. `--device <name>` uses `agent-browser set device`. The manifest records the mode. A `viewport-only` capture never claims mobile-device behavior.
- Pixel density: US-002 measures the encoded size with `--scale 2`. If the encoded size equals the CSS viewport, the documentation states that higher-density capture is not available and the manifest records `effectiveScale: 1`.
- Time limit: a detached watchdog process stops the recording at `--max-seconds`. The watchdog targets only its own session.
- A video is supporting evidence. Assertions and audit acceptance stay authoritative. `captureStatus` and `assertionStatus` stay separate fields.
- Evidence selection: the advisor maps each acceptance criterion to an evidence type during planning with the table in mifunedev/agro#1428. The worker records the reason with `--reason`. No classifier service.
- Base branch: the issue metadata names `main`. `.agro/skills/git/SKILL.md` names `development` as the default target. The PR targets `development`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | `ffmpeg` entry shape, pinned sums for `amd64` and `arm64`, `libx264` check, `agent-browser@0.38.1` pin | Reproducible optional tooling and version authority |
| `.agro/skills/agent-browser/scripts/tests/recording.test.sh` | Desktop and mobile captures for each purpose; dimensions, codec, and FPS from `ffprobe`; paired run | Real headless recording |
| Same | Failed assertion, missing encoder, timeout, incomplete capture | Honest outcomes and bounded cleanup |
| Same | Two concurrent sessions; a path with a space; no overwrite of a run directory | Isolation and artifact ownership |
| Same | `--scale 2` and `--device` results in the manifest | Truthful density and emulation reports |
| Same | Demo thumbnail, scenario notes, and manifest share one run | Marketing source handoff |
| `bash .agro/skills/ste/scripts/ste-check.sh` on changed Markdown | Prose rules | Documentation quality |
| `git grep -n "0\.8\.5" -- .agro/skills` | No match | Removal of version drift |

## Design Principles

- Simplicity is beauty, complexity is pain.
- Inspect the codebase first. Make the smallest change that meets the stories.
- Write the failing test first: red, green, refactor.
- Follow the existing catalog, skill, and shell-test patterns.
- Keep capture status separate from assertion status.
- Support all harnesses through the canonical skill under `.agro/`.
- Use fixture and test data. Capture no credentials and no private content.
- Add no explanatory comments to tracked code.

## Out of Scope

- Native iOS and Android recording, physical-device tests, and full desktop recording.
- Continuous recording, streaming, and a new recording service.
- Video editing, narration, music, branding, and publishing.
- A Console media gallery or a storage backend.
- CI execution of `recording.test.sh`. CI has no Chromium and no FFmpeg, and the existing agent-browser shell tests also run outside CI.
- Changes to historical release notes.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each story in `prd.json` has `passes: true`.
- [ ] `pnpm test`, `pnpm --dir .agro/cli typecheck`, and `pnpm --dir .agro/cli build` exit 0.
- [ ] `bash .agro/skills/agent-browser/scripts/tests/recording.test.sh` exits 0 in the sandbox with no `SKIP:` line.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `git status --porcelain .agro/tasks/browser-recording/evidence` lists no video file before the PR evidence commit.
- [ ] The PR body justifies the FFmpeg dependency.
- [ ] A draft PR titled `FROM feat/1428-browser-recording TO development` exists.

## Lessons

- Claim: `agent-browser close` does not flush a recording in 0.38.1. Evidence: the US-002 worker observed a 48-byte MP4 after a plain `close`. Outcome: fixed in this PR. `record.sh stop` runs `record stop` before `close`, and the skill and the guide state the rule.
- Claim: one paired desktop stop reported `No recording in progress` and left a stub video. Evidence: one US-002 test run. Ten later runs and the advisor rerun did not reproduce the failure. `record.sh` reported `incomplete` and exited 1. Outcome: proposed follow-up issue, which waits for operator approval.
- Claim: the plan omitted the `docs/README.md` index link for the new guide. Evidence: the US-004 worker found the gap. Outcome: fixed in this PR.
- Claim: the first US-005 mobile scenario left the menu open over the Save button. Evidence: `capture-1.log`. Outcome: dropped. The cause was the scenario script, and the run shows that a failed assertion keeps a complete capture.
