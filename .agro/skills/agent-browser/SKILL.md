---
name: agent-browser
description: |
  Open a URL in the headless agent-browser in a named session, with a
  preflight health check. Take screenshots and record desktop or mobile
  videos as task evidence or demo source footage.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  test a site with agent-browser, record a browser flow, capture a
  walkthrough or demo video, or record a bug reproduction.
argument-hint: "<url> [--viewport desktop|mobile] [--task <slug>] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser in a named session. A preflight health check
runs first. If the browser is broken, stop and report the full diagnostic trace.

`.agro/cli/src/lib/tools/catalog.ts` owns the supported agent-browser version.
This skill states no version. Check commands against `agent-browser --help` of
the installed version.

## Arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0`. If the URL is missing, ask the user for it.
- **VIEWPORT**: the value after `--viewport`. Default: `desktop`.
- **TASK**: the value after `--task`. Default: the slug of the current task
  under `.agro/tasks/`. If no task exists, use `adhoc`.
- **SESSION**: the value after `--session`. Default: the task slug and the
  worktree name:

  ```bash
  SESSION="${SESSION:-$TASK-$(basename "$(git rev-parse --show-toplevel)")}"
  ```

Every `agent-browser` command in this skill passes `--session "$SESSION"`. A
command without it uses the shared `default` session of another agent.

## Dimensions

| Profile | Evidence and screenshots | Demo | Mode |
|---|---|---|---|
| `desktop` | 1280x720 CSS | 1920x1080 CSS | Viewport only |
| `mobile` | 414x896 CSS | 414x896 CSS | Viewport only, or device emulation with `--device` |

Set the viewport before `open`. `record.sh start` fixes the viewport of a
recording. A later `set viewport` does not resize the video.

## Preflight

Run each check in sequence. If a check fails, stop and report the full output.

### 1. Install agent-browser and FFmpeg

```bash
command -v agent-browser && agent-browser --version || echo "FAIL: agent-browser not found in PATH"
```

If agent-browser is missing, install agent-browser through the catalog:

```bash
agro tool install agent-browser --yes
```

The catalog entry declares a `~1 GB` download. When stdin is not a TTY, the
confirmation gate refuses without `--yes`. In the sandbox, the command installs
the pinned package and Chromium. On the host, the command installs a pinned
release binary into `~/.local/bin` and downloads no browser. The host then
needs a Chromium-family browser, or `AGENT_BROWSER_EXECUTABLE_PATH` that points
at one. Firefox is not a supported target.

Do not use `sudo npm install -g`. That install goes under `/usr/lib/node_modules`,
and a running sandbox cannot upgrade it in place.

Recording also needs `ffmpeg`, `ffprobe`, the `libx264` encoder, and `jq`. If
`ffmpeg` or `ffprobe` is missing, install both tools:

```bash
agro tool install ffmpeg
```

### 2. Check that Chromium launches

```bash
agent-browser --session "$SESSION" open about:blank 2>&1
```

If the command fails, report the full error and these common causes:

```
Chromium failed to launch. Common causes:

1. Missing system dependencies or browser binaries:
   agent-browser install --with-deps

2. Sandbox permission issue (containers):
   Ensure --no-sandbox is set or container has SYS_ADMIN capability.

3. A stale install:
   agent-browser doctor --fix
```

Close the failed session, then stop:

```bash
agent-browser --session "$SESSION" close 2>/dev/null
```

### 3. Check that a page renders

```bash
agent-browser --session "$SESSION" snapshot -c 2>&1
```

Content, even minimal content, shows a healthy browser. Keep the session open
for the next step.

### 4. Resolve tunnel hostnames

If a Cloudflared tunnel or a custom DNS route serves the URL host, the container
DNS may not resolve the host yet:

```bash
HOSTNAME=$(echo "$URL" | sed 's|https\?://||; s|/.*||; s|:.*||')
if ! getent hosts "$HOSTNAME" &>/dev/null; then
  IP=$(curl -sf "https://cloudflare-dns.com/dns-query?name=${HOSTNAME}&type=A" \
    -H "accept: application/dns-json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Answer'][0]['data'])" 2>/dev/null)
  if [ -n "$IP" ]; then
    echo "$IP $HOSTNAME" | sudo tee -a /etc/hosts >/dev/null
  else
    echo "FAIL: $HOSTNAME does not resolve. Check tunnel/DNS routing."
  fi
fi
```

## Open and screenshot

Set the viewport from the dimension table, then open the URL:

```bash
agent-browser --session "$SESSION" set viewport "$WIDTH" "$HEIGHT"
agent-browser --session "$SESSION" open "$URL"
agent-browser --session "$SESSION" snapshot -c
```

Report the page title and the key visible elements.

Save screenshots under the task evidence directory. Use an absolute path. The
browser daemon resolves a relative path from its own working directory.

```bash
FILENAME=$(echo "$URL" | sed 's|https\?://||; s|/|--|g; s|--$||; s|[^a-zA-Z0-9._-]|-|g')
SCREENSHOT_PATH="$(git rev-parse --show-toplevel)/.agro/tasks/$TASK/evidence/${FILENAME}-${VIEWPORT}.png"
mkdir -p "$(dirname "$SCREENSHOT_PATH")"
agent-browser --session "$SESSION" screenshot "$SCREENSHOT_PATH"
```

Git ignores `.agro/tasks/*/*`. To link a screenshot in a PR, follow
`.agro/skills/git/references/manual-review.md`.

### Annotated screenshots

`scripts/annotate-screenshot.sh` annotates the current page of the session.
Give the session through `AGENT_BROWSER_SESSION`:

```bash
AGENT_BROWSER_SESSION="$SESSION" bash .agro/skills/agent-browser/scripts/annotate-screenshot.sh \
  "$SCREENSHOT_PATH" '#title=the card title' '#status=the Baseline time'
```

The script adds one numbered red callout for each `<selector>=<label>` pair,
takes the screenshot, and removes the callouts. It prints the `Callouts:` line,
for example `Callouts: 1 is the card title. 2 is the Baseline time.`. Put that
line under the screenshot. If a selector matches no element, the script names
the selector, exits 1, and writes no file. On bad usage, the script exits 2.

### Copy-button checks

A plain `agent-browser clipboard read` fails with `Read permission denied`.
`scripts/clipboard-read.mjs` grants the clipboard permission for the page origin
through CDP and reads the clipboard while it stays connected.

1. Open the page:

   ```bash
   agent-browser --session "$SESSION" open "$URL"
   ```

2. Click the copy button:

   ```bash
   agent-browser --session "$SESSION" click '#copy'
   ```

3. Read the clipboard:

   ```bash
   node .agro/skills/agent-browser/scripts/clipboard-read.mjs --session "$SESSION"
   ```

4. Compare the output with the expected text. The script prints only the
   clipboard text. On a failure, it prints one reason line on stderr and exits 1.
   On bad usage, it exits 2.

The script works for `http://`, `https://`, and `file://` pages. The test
`scripts/tests/clipboard-read.test.sh` runs these steps on
`scripts/tests/fixtures/copy-button.html` and expects `agro-copy-check`.

If CDP is not available, wrap `navigator.clipboard.writeText` with
`agent-browser --session "$SESSION" eval` before the click, and read the
captured text after the click. This fallback proves only the text that the page
gave to `writeText`, not that the write succeeded.

## Recording

A recording is supporting evidence. A recording never satisfies an acceptance
gate or an audit gate alone. Assertions and tests stay authoritative.
`captureStatus` tells whether the video is complete. `assertionStatus` tells
whether the scenario passed. Report the two values separately.

### Select the evidence

The advisor maps each acceptance criterion to an evidence type during planning.
The worker follows that map and gives the reason with `--reason`.

| Criterion or request | Required evidence |
|---|---|
| Static appearance, text, spacing, or responsive layout | Screenshots at relevant desktop/mobile sizes |
| Multistep navigation, loading transitions, drag-and-drop, animation, or timing-dependent behavior | Video plus outcome assertions |
| A reproducible bug involving an action sequence or timing | Before/after recordings and a regression assertion |
| Backend or CLI behavior without visible UI changes | Tests and logs; browser capture is not required |
| Explicit recording, walkthrough, or marketing demo request | Video using the requested purpose |
| Responsive interaction that affects desktop and mobile | Separate videos of the same scenario in both profiles |

Record when a still image cannot show the claimed behavior, or when the operator
asks for a recording. An explicit request takes precedence over this table. A
change to the planned evidence needs a recorded reason.

Rerun rule: if a failure occurred without a capture, record a safe rerun when
possible. Start the rerun with `--rerun <original-run>`. A rerun never claims to show
the original failure. If a reproduction is not available, report that. Never
fabricate before footage.

### Purpose and profile

Purpose and profile are independent. All four combinations are valid.

| Setting | `evidence` | `demo` |
|---|---|---|
| Desktop CSS viewport | 1280x720 | 1920x1080 |
| Mobile CSS viewport | 414x896 | 414x896 |
| Frame rate | 30 FPS | 30 FPS; `--fps 60` for motion-heavy scenarios |
| Pacing | Actual execution, including relevant failures | Deliberate actions and readable pauses |
| Pointer | None | Visible cursor on desktop; none on mobile |
| Data | Authorized test data | Clean demo data without unrelated private content |
| Outputs | `video.mp4`, `manifest.json` | `video.mp4`, `manifest.json`, `thumbnail.png`, `scenario.md` |

### Dimensions

Keep four values distinct:

- **CSS viewport** selects the responsive layout. Set it with `--width` and
  `--height`, or with `--device`.
- **Pixel density** is `--scale`. `--scale 2` doubles the encoded pixels, for
  example 1280x720 CSS to 2560x1440 video.
- **Encoded size** is the size of the video file. `record.sh stop` reads it
  with `ffprobe` and writes `encodedSize` and `effectiveScale`.
- **Export canvas** is the intended downstream canvas, for example `1920x1080`,
  `1080x1920`, or `1080x1080`. `--export` only records it. Composition belongs
  to downstream editing.

Rules:

- Never set a `1080x1920` CSS viewport to make a vertical marketing asset. That
  selects the wrong layout. Capture at 414x896, add `--scale` for detail, and
  give `--export 1080x1920`.
- Report the encoded size from the manifest. Never describe upscaled footage as
  higher-detail capture.
- A viewport-only capture (`emulation: viewport-only`) never claims device
  behavior. Only `--device "<name>"` emulates a device, for example
  `--device "iPhone 12"` gives a 390x844 CSS viewport, 1170x2532 video, and an
  iPhone user agent. `--device` excludes `--width`, `--height`, and `--scale`.
- Odd sizes round up to even numbers.

### Record a scenario

1. Start the recording. `record.sh start` opens the URL in a new session, starts
   the recording, and prints the absolute run directory:

   ```bash
   DIR="$(bash .agro/skills/agent-browser/scripts/record.sh start \
     --task "$TASK" --run "$RUN" --purpose evidence --profile desktop \
     --scenario "Open the menu and save the form" --url "$URL" \
     --criteria "AC-2" --reason "timing-dependent transition")"
   ```

   Full syntax:

   ```
   record.sh start --task <slug> --run <id> --purpose evidence|demo --profile desktop|mobile
                   --scenario <text> --url <url> [--criteria <text>] [--reason <text>]
                   [--width <px> --height <px>] [--scale <n>] [--device <name>]
                   [--fps <n>] [--max-seconds <n>] [--export <w>x<h>] [--rerun <run>]
   record.sh stop --dir <dir> --assertions pass|fail|none
   ```

   The run directory is
   `.agro/tasks/<task>/evidence/browser/<run>/<profile>/` under
   `$AGRO_EVIDENCE_ROOT` or the git top level. An existing directory is an
   error; use a new `--run`. The defaults are 30 FPS and 120 seconds. At
   `--max-seconds`, a watchdog stops the recording.

2. Drive the scenario in the session that `record.sh` owns:

   ```bash
   REC_SESSION="$TASK-$RUN-desktop"
   agent-browser --session "$REC_SESSION" click '#menu-toggle'
   agent-browser --session "$REC_SESSION" fill '#name' 'Ada'
   agent-browser --session "$REC_SESSION" click '#save'
   ```

3. Check the outcome with assertions, for example
   `agent-browser --session "$REC_SESSION" get text '#status'`.

4. Stop the recording, even when an assertion failed:

   ```bash
   bash .agro/skills/agent-browser/scripts/record.sh stop --dir "$DIR" --assertions pass
   ```

   The command stops and flushes the recording, closes the session, and prints
   one summary line. `agent-browser close` alone does not flush a recording.
   `captureStatus` is `complete`, `timeout`, or `incomplete`. An `incomplete`
   capture is not a usable video.

Exit status: 0 on success, 1 on an error, 2 on bad usage. Missing `ffmpeg`,
`ffprobe`, or `libx264` fails before capture with the install command.

For a paired desktop and mobile request, run the same scenario twice with the
same `--run`: once with `--profile desktop` and once with `--profile mobile`.
Give each run a suitable starting state. Report each profile as its own result.

Git ignores the run directory. Report the real local path. Never invent a
shareable URL. Never overwrite an original video with an edited demo.

## Report

```
Browser ready.

  URL:        $URL
  Viewport:   $VIEWPORT ($WIDTHx$HEIGHT)
  Session:    $SESSION
  Screenshot: $SCREENSHOT_PATH
```

For a recording, give the `record.sh stop` summary line for each profile, the
scenario, the tested commit from `manifest.json`, and the assertion results.

## Session hygiene

- Close each session when done: `agent-browser --session "$SESSION" close`.
- If a step fails, close the session before you report.
- Never run `agent-browser close --all`. It closes the sessions of other agents.
