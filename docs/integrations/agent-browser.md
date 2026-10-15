---
title: Browser recording
---

# Browser recording

AGRO records a browser scenario as an H.264 MP4 video. The helper
`.agro/skills/agent-browser/scripts/record.sh` wraps `agent-browser record`.
The helper owns one browser session for each recording, stops the recording
after a time limit, checks the video with `ffprobe`, and writes a manifest and
a contact sheet.

Agents load the canonical procedure from the `agent-browser` skill:
`.agro/skills/agent-browser/SKILL.md`, with the references for recording,
annotated screenshots, and the dashboard in
`.agro/skills/agent-browser/references/`.

A recording is supporting evidence. A recording never replaces an assertion or
a test. Run the assertions and the tests for each acceptance criterion, and
attach the recording to show the behavior.

## Install

Run these commands inside the sandbox:

```bash
agro tool install agent-browser --yes
agro tool install ffmpeg
```

`agro tool install ffmpeg` installs a pinned static FFmpeg 7.0.2 build. The
install puts `ffmpeg` and `ffprobe` into `~/.local/bin`. If `ffmpeg`, `ffprobe`,
or the `libx264` encoder is missing, `record.sh start` exits 1 and names
`agro tool install ffmpeg`. See [Installation](../installation.md#tools).

## Usage

```text
record.sh start --task <slug> --run <id> --purpose evidence|demo --profile desktop|mobile
                --scenario <text> --url <url> [--criteria <text>] [--reason <text>]
                [--width <px> --height <px>] [--scale <n>] [--device <name>]
                [--fps <n>] [--max-seconds <n>] [--export <w>x<h>] [--rerun <run>]
                [--state <file>]
record.sh stop --dir <dir> --assertions pass|fail|none
```

Each recording has three steps:

1. Run `record.sh start`. The command prints the absolute run directory.
2. Drive the scenario with `agent-browser --session <task>-<run>-<profile> ...`.
3. Run `record.sh stop` with the assertion result. The command prints
   `captureStatus=… assertionStatus=… encodedSize=… video=…`.

Always stop a recording with `record.sh stop`. `agent-browser close` does not
flush the video.

`--state` loads a saved sign-in state into the recording session before it
opens the URL. The agent-browser skill reference
`.agro/skills/agent-browser/references/auth.md` describes how an operator signs
in one time through the dashboard and how agents save and reuse that state.

`record.sh` exits 2 on bad usage and exits 1 on an error.

### Defaults

| Purpose | Profile | CSS viewport | Cursor |
|---|---|---|---|
| `evidence` | `desktop` | 1280x720 | no |
| `evidence` | `mobile` | 414x896 | no |
| `demo` | `desktop` | 1920x1080 | yes |
| `demo` | `mobile` | 414x896 | no |

Each recording uses H.264 MP4 at 30 FPS. A watchdog stops the recording after
120 seconds. Change the limit with `--max-seconds`.

## Examples

Set these variables first. Replace the URL with the page under test.

```bash
REC=.agro/skills/agent-browser/scripts/record.sh
TASK=my-task
URL=http://localhost:3000/
```

### Evidence on desktop

```bash
DIR=$(bash "$REC" start --task "$TASK" --run r1 --purpose evidence --profile desktop \
  --scenario "Save the profile name" --url "$URL" \
  --criteria "The status shows the saved name" --reason "The save shows a state transition")
SESSION="$TASK-r1-desktop"
agent-browser --session "$SESSION" fill '#name' 'Ada'
agent-browser --session "$SESSION" click '#save'
agent-browser --session "$SESSION" wait 1000
if [[ "$(agent-browser --session "$SESSION" get text '#status')" == "Saved: Ada" ]]; then
  RESULT=pass
else
  RESULT=fail
fi
bash "$REC" stop --dir "$DIR" --assertions "$RESULT"
```

### Evidence on mobile

```bash
DIR=$(bash "$REC" start --task "$TASK" --run r2 --purpose evidence --profile mobile \
  --scenario "Open the navigation menu" --url "$URL")
SESSION="$TASK-r2-mobile"
agent-browser --session "$SESSION" click '#menu-toggle'
agent-browser --session "$SESSION" wait 1000
if [[ "$(agent-browser --session "$SESSION" get attr '#menu-toggle' aria-expanded)" == "true" ]]; then
  RESULT=pass
else
  RESULT=fail
fi
bash "$REC" stop --dir "$DIR" --assertions "$RESULT"
```

### Demo on desktop

```bash
DIR=$(bash "$REC" start --task "$TASK" --run demo1 --purpose demo --profile desktop \
  --scenario "Save the profile name" --url "$URL")
SESSION="$TASK-demo1-desktop"
agent-browser --session "$SESSION" fill '#name' 'Ada'
agent-browser --session "$SESSION" click '#save'
agent-browser --session "$SESSION" wait 1500
bash "$REC" stop --dir "$DIR" --assertions none
```

### Demo on mobile

```bash
DIR=$(bash "$REC" start --task "$TASK" --run demo2 --purpose demo --profile mobile \
  --scenario "Open the navigation menu" --url "$URL" --export 1080x1920)
SESSION="$TASK-demo2-mobile"
agent-browser --session "$SESSION" click '#menu-toggle'
agent-browser --session "$SESSION" wait 1500
bash "$REC" stop --dir "$DIR" --assertions none
```

`--export` records the target canvas for a later edit in the manifest. The
helper does not resize the video.

### Paired desktop and mobile run

A paired run records one scenario one time for each profile. Use the same
`--run` and a different `--profile` for each recording. Each profile gets its
own session and its own directory.

```bash
for PROFILE in desktop mobile; do
  DIR=$(bash "$REC" start --task "$TASK" --run pair1 --purpose evidence --profile "$PROFILE" \
    --scenario "Save the profile name" --url "$URL")
  SESSION="$TASK-pair1-$PROFILE"
  agent-browser --session "$SESSION" fill '#name' 'Ada'
  agent-browser --session "$SESSION" click '#save'
  agent-browser --session "$SESSION" wait 1000
  if [[ "$(agent-browser --session "$SESSION" get text '#status')" == "Saved: Ada" ]]; then
    RESULT=pass
  else
    RESULT=fail
  fi
  bash "$REC" stop --dir "$DIR" --assertions "$RESULT"
done
```

## Output

The helper writes each recording to this directory:

```text
.agro/tasks/<task>/evidence/browser/<run>/<profile>/
```

The root is `$AGRO_EVIDENCE_ROOT`. If `AGRO_EVIDENCE_ROOT` is not set, the root
is the git top-level directory. `record.sh start` refuses a run and profile
directory that already exists. Use a new `--run` for each retake.

| File | Purpose | Content |
|---|---|---|
| `video.mp4` | all | The H.264 recording. |
| `video.contact-sheet.png` | all | One timestamped frame for each distinct visual change. |
| `manifest.json` | all | The recording facts. |
| `thumbnail.png` | `demo` | One frame from the middle of the video. |
| `scenario.md` | `demo` | The scenario notes from the manifest. |

### Manifest fields

| Field | Content |
|---|---|
| `task`, `run`, `profile`, `purpose`, `session` | The recording identity. |
| `commit`, `dirty` | The tested revision and whether the work tree had changes. |
| `scenario`, `url`, `criteria`, `selectionReason`, `rerun` | The scenario, the start URL, the acceptance criteria, the `--reason` text, and the replaced run. |
| `cssViewport` | The CSS viewport that the page reports. |
| `requestedScale`, `effectiveScale` | The `--scale` value and the encoded width divided by the CSS width. |
| `encodedSize` | The video width and height from `ffprobe`. |
| `exportCanvas` | The `--export` canvas, or `null`. |
| `emulation` | `viewport-only` or `device:<name>`. |
| `fps`, `codec` | The frame rate and the codec from `ffprobe`. |
| `contactSheet` | `video.contact-sheet.png`, or `null` when no frame was saved. |
| `agentBrowserVersion`, `ffmpegVersion` | The `agent-browser` version and the `ffmpeg` version. |
| `startedAt`, `stoppedAt` | The UTC start and stop times. |
| `captureStatus` | `complete`, `timeout`, or `incomplete`. |
| `assertionStatus` | `pass`, `fail`, or `none`. |

`captureStatus` and `assertionStatus` are separate. A `complete` capture of a
failed assertion is a valid recording of a failure.

## Mobile emulation and pixel density

The `mobile` profile sets only the CSS viewport. The manifest records
`emulation: "viewport-only"`. A `viewport-only` recording shows the responsive
layout. The recording does not show touch input, the mobile user agent, or device pixel
density. Do not use a `viewport-only` recording as proof of mobile-device
behavior.

`--device <name>` applies a device profile from `agent-browser set device`.
`--device` does not combine with `--width`, `--height`, or `--scale`.

The encoded video follows the pixel density of the page:

| Request | CSS viewport | Encoded size | `effectiveScale` |
|---|---|---|---|
| `--profile desktop` | 1280x720 | 1280x720 | 1 |
| `--profile desktop --scale 2` | 1280x720 | 2560x1440 | 2 |
| `--profile mobile --device "iPhone 12"` | 390x844 | 1170x2532 | 3 |

`--device "iPhone 12"` also sets the iPhone user agent. `record.sh start` fixes
the viewport when the recording starts. Do not resize the browser during a
recording.

## Recovery

`captureStatus: "timeout"` means that the watchdog stopped the recording at the
`--max-seconds` limit. The video ends at the limit. Run `record.sh stop` on the
directory to finalize the manifest. To get a full recording, run the scenario
again with a new `--run`, `--rerun <old run>`, and a higher `--max-seconds`.

`captureStatus: "incomplete"` means that `ffprobe` cannot read the video, or
that no `record.sh stop` ran. If `ffprobe` fails, `record.sh stop` exits 1.
Do not use the video. Do these steps:

1. If no `record.sh stop` ran, run `record.sh stop --dir <dir> --assertions none`.
   This closes the owned session.
2. Run the scenario again with a new `--run` and `--rerun <old run>`.

## Git tracking

Recordings stay untracked. `.gitignore` ignores `.agro/tasks/*/*` and keeps
only `prd.md` and `prd.json` in each task directory:

```text
.agro/tasks/*/*
!.agro/tasks/*/prd.md
!.agro/tasks/*/prd.json
```

The `evidence/` directory matches `.agro/tasks/*/*`, so git ignores each video,
manifest, and thumbnail. Large binary files stay out of the history. To link
a recording in the `## Manual review` section of a pull request, commit the
selected file with `git add -f <path>`.
