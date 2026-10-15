# Browser recording

Read this reference before you record a browser scenario as task evidence or
demo footage. `scripts/record.sh` wraps `agent-browser record`, owns one
session for each recording, stops at a time limit, checks the video with
`ffprobe`, and writes `manifest.json`.

The operator guide is
[Browser recording](https://agro.mifune.dev/docs/agro/integrations/agent-browser)
(`docs/integrations/agent-browser.md`). It holds the worked examples, the
manifest field table, and the Git tracking rules.

## Contents

- [Evidence status](#evidence-status)
- [Select the evidence](#select-the-evidence)
- [Purpose and profile](#purpose-and-profile)
- [Dimensions](#dimensions)
- [Record a scenario](#record-a-scenario)
- [Recovery](#recovery)
- [Report](#report)

## Evidence status

A recording is supporting evidence. A recording never satisfies an acceptance
gate or an audit gate alone. Assertions and tests stay authoritative.
`captureStatus` tells whether the video is complete. `assertionStatus` tells
whether the scenario passed. Report the two values separately.

## Select the evidence

The advisor maps each acceptance criterion to an evidence type during planning.
The worker follows that map and gives the reason with `--reason`.

| Criterion or request | Required evidence |
|---|---|
| Static appearance, text, spacing, or responsive layout | Annotated screenshots at relevant desktop/mobile sizes |
| Multistep navigation, loading transitions, drag-and-drop, animation, or timing-dependent behavior | Video plus outcome assertions |
| A reproducible bug involving an action sequence or timing | Before/after recordings and a regression assertion |
| Backend or CLI behavior without visible UI changes | Tests and logs; browser capture is not required |
| Explicit recording, walkthrough, or marketing demo request | Video using the requested purpose |
| Responsive interaction that affects desktop and mobile | Separate videos of the same scenario in both profiles |

Record when a still image cannot show the claimed behavior, or when the operator
asks for a recording. An explicit request takes precedence over this table. A
change to the planned evidence needs a recorded reason.

Rerun rule: if a failure occurred without a capture, record a safe rerun when
possible. Start the rerun with `--rerun <original-run>`. A rerun never claims to
show the original failure. If a reproduction is not available, report that.
Never fabricate before footage.

## Purpose and profile

Purpose and profile are independent. All four combinations are valid.

| Setting | `evidence` | `demo` |
|---|---|---|
| Desktop CSS viewport | 1280x720 | 1920x1080 |
| Mobile CSS viewport | 414x896 | 414x896 |
| Frame rate | 30 FPS | 30 FPS; `--fps 60` for motion-heavy scenarios |
| Pacing | Actual execution, including relevant failures | Deliberate actions and readable pauses |
| Pointer | None | Visible cursor on desktop; none on mobile |
| Data | Authorized test data | Clean demo data without unrelated private content |
| Outputs | `video.mp4`, `video.contact-sheet.png`, `manifest.json` | The evidence outputs, `thumbnail.png`, `scenario.md` |

`video.contact-sheet.png` is one image of each distinct visual change, with
timestamps. Review it before you watch the video, and link it next to the video
so that a reviewer sees the flow without playing it. `manifest.json` names it
in `contactSheet`, or gives `null` when no frame was saved.

## Dimensions

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
- `record.sh start` fixes the viewport. Do not resize the browser during a
  recording.

## Record a scenario

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
                   [--state <file>]
   record.sh stop --dir <dir> --assertions pass|fail|none
   ```

   The run directory is
   `.agro/tasks/<task>/evidence/browser/<run>/<profile>/` under
   `$AGRO_EVIDENCE_ROOT` or the git top level. An existing directory is an
   error; use a new `--run`. The defaults are 30 FPS and 120 seconds. At
   `--max-seconds`, a watchdog stops the recording.

   For a signed-in scenario, give `--state <file>`. The session loads the
   saved state before it opens the URL. Make the file with
   `references/auth.md`. A missing file exits 1 before capture.

2. Drive the scenario in the session that `record.sh` owns:

   ```bash
   REC_SESSION="$TASK-$RUN-desktop"
   agent-browser --session "$REC_SESSION" click '#menu-toggle'
   agent-browser --session "$REC_SESSION" fill '#name' 'Ada'
   agent-browser --session "$REC_SESSION" click '#save'
   ```

3. Check the outcome with assertions, for example
   `agent-browser --session "$REC_SESSION" get text '#status'`. To pair the
   video with a still, take an annotated screenshot in `$REC_SESSION` before
   the stop. Follow `references/annotation.md`.

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

## Recovery

- `captureStatus: timeout`: the watchdog stopped at `--max-seconds`. Run
  `record.sh stop` on the directory. For a full video, record again with a new
  `--run`, `--rerun <old run>`, and a higher `--max-seconds`.
- `captureStatus: incomplete`: `ffprobe` cannot read the video, or no
  `record.sh stop` ran. Do not use the video. If no stop ran, run
  `record.sh stop --dir <dir> --assertions none` to close the owned session.
  Record again with a new `--run` and `--rerun <old run>`.

## Report

Give the `record.sh stop` summary line for each profile, the scenario, the
tested commit from `manifest.json`, and the assertion results.

Git ignores the run directory. Report the real local path. Never invent a
shareable URL. Never overwrite an original video with an edited demo. To link a
recording in a pull request, follow the `### Recordings` part of
`.agro/skills/git/references/manual-review.md`.
