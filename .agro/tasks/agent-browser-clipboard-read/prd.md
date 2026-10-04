# PRD: Agent-browser clipboard read

Status: DRAFT

## User Stories

### US-001: Find a supported clipboard read after a copy-button click

**Description:** As the advisor, I want one tested way to read the clipboard in the sandbox browser. Then copy-button evidence does not change the page under test.

**Acceptance Criteria:**

- [ ] A local fixture page `.agro/skills/agent-browser/scripts/tests/fixtures/copy-button.html` has one button that calls `navigator.clipboard.writeText("agro-copy-check")`.
- [ ] The worker tries each candidate on that fixture in the sandbox and records the command and the result in `.agro/tasks/agent-browser-clipboard-read/evidence/spike.md`:
  - `agent-browser clipboard read` after a click, with no launch flag;
  - the same command with `--args "--enable-features=ClipboardReadWrite"` or another documented Chromium flag;
  - `agent-browser clipboard read` in headed mode, if a display is available;
  - a page-side capture that wraps `navigator.clipboard.writeText` before the click and reads the captured text with `agent-browser eval`.
- [ ] `spike.md` names one method that returns `agro-copy-check`, or states that no method returns the text.
- [ ] Each candidate command in `spike.md` shows its exit status and its output.

### US-002: Document the clipboard check in the agent-browser skill

**Description:** As an agent that captures evidence, I want the agent-browser skill to give the clipboard check. Then I prove a copy button the same way each time.

**Acceptance Criteria:**

- [ ] The story depends on US-001.
- [ ] `.agro/skills/agent-browser/SKILL.md` has a section "Copy-button checks" that gives the method from `spike.md` as numbered steps with exact commands.
- [ ] If no method reads the clipboard, the section gives the paste procedure from mifunedev/agro-console#275 and states that the paste adds a temporary field to the page.
- [ ] `.agro/skills/agent-browser/scripts/tests/` holds a test that runs the documented method against the fixture and expects `agro-copy-check`. The test skips with a message when agent-browser or Chromium is absent.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/agent-browser/SKILL.md` exits 0.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one entry that links issue #1332.

## Summary

Issue #1332 reports that agent-browser cannot read the clipboard in headless Chromium. In mifunedev/agro-console#275, `agent-browser clipboard read` and `navigator.clipboard.readText()` returned "Read permission denied". A permission grant through the DevTools protocol did not help. The worker then pasted into a temporary text field, which changes the page under test.

Verified current state:

- `agent-browser` `0.38.1` lists `clipboard <op> [text]` with the operations `read`, `write`, `copy`, and `paste`.
- `agent-browser --args <args>` passes Chromium launch flags. `AGENT_BROWSER_ARGS` sets the same flags.
- `.agro/skills/agent-browser/SKILL.md` (218 lines) covers launch, preflight, screenshots, annotated screenshots, and session hygiene. It has no clipboard section.
- `.agro/skills/agent-browser/scripts/tests/` holds `annotate-screenshot.test.sh` and `fixtures/`.

Selected approach: run a bounded spike on a local fixture, then document the method that works. If no direct read works, document the page-side capture or the paste procedure with its limit.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/agent-browser/SKILL.md` | new "Copy-button checks" section | Canonical procedure. |
| `.agro/skills/agent-browser/scripts/tests/` | new test and `fixtures/copy-button.html` | Proves the method. |
| `.agro/tasks/agent-browser-clipboard-read/evidence/spike.md` | spike record | Evidence for the chosen method. |
| `CHANGELOG.md` | `## [Unreleased]` | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| agent-browser skill | Documentation | A supported copy-button check. |
| skill tests | New test | Runs the check against a fixture. |

## Storage

N/A. The change adds no persistent state.

## Architectural Decisions

- The skill documents an agent-browser command or a page-side capture. The skill adds no wrapper script unless the method needs more than 3 commands.
- The fixture is a static local file. The test needs no network and no dev server.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/agent-browser/scripts/tests/<copy-check test>` | click the fixture button, read `agro-copy-check` | US-002 |
| `spike.md` | each candidate with exit status and output | US-001 |

## Design Principles

- Prefer a direct clipboard read. Fall back to a capture that does not change the visible page.
- Do not add explanatory comments to tracked code.

## Out of Scope

- Changes to agent-browser itself. An upstream bug report is a Lessons item.
- Clipboard checks in a remote browser or a browser outside the sandbox.

## Open Questions

1. Does the sandbox have a display for headed mode? US-001 records the answer. A missing display removes one candidate and blocks nothing.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `bash .agro/skills/agent-browser/scripts/tests/<copy-check test>` exits 0 in the sandbox.
- [ ] The skill section returns `agro-copy-check` from the fixture with no change to the visible page, or the section states the limit of the paste procedure.

## Lessons

1. Claim: a Chromium clipboard grant through CDP lasts only while the granting client stays connected. Evidence: `spike.md` candidates e1 and e2; the permission state returns to `"prompt"` when the client disconnects. Outcome: fixed in this PR, because `clipboard-read.mjs` holds the connection open during the read.
2. Claim: `annotate-screenshot.test.sh` leaves its named agent-browser session open. Evidence: the cleanup trap runs `agent-browser close` without `--session`, and `agent-browser session list` showed `annotate-test-<pid>` after a run. Outcome: proposed issue, pending operator approval: "annotate-screenshot test leaks its browser session".
