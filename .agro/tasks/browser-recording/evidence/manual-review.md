# Manual review evidence: browser-recording

Tested revision: `a2abb8d9f1724e1f92380720b7b323204bf93b71`. The worktree was clean (`dirty: false` in each manifest).

Fixture: `.agro/skills/agent-browser/scripts/tests/fixtures/responsive.html`, opened as a `file://` URL in the sandbox.

The files `capture-1.log` and `capture-2.log` hold the full command transcripts.

The full command transcripts are in `capture-1.log` and `capture-2.log`.

| Run | Purpose | Profile | Encoded size | Codec and FPS | captureStatus | assertionStatus | Rerun of |
|---|---|---|---|---|---|---|---|
| `ev1` | evidence | desktop | 1280x720 | h264, 30/1 | complete | pass | none |
| `ev1` | evidence | mobile | 414x896 | h264, 30/1 | complete | fail | none |
| `ev2` | evidence | mobile | 414x896 | h264, 30/1 | complete | pass | `ev1` |
| `demo1` | demo | desktop | 1920x1080 | h264, 30/1 | complete | pass | none |
| `pair1` | evidence | desktop | 1280x720 | h264, 30/1 | complete | pass | none |
| `pair1` | evidence | mobile | 414x896 | h264, 30/1 | complete | fail | none |
| `pair2` | evidence | desktop | 1280x720 | h264, 30/1 | complete | pass | `pair1` |
| `pair2` | evidence | mobile | 414x896 | h264, 30/1 | complete | pass | `pair1` |

Each mobile capture is `viewport-only`. No mobile capture claims device behavior.

## The failed mobile assertion

In `ev1` and `pair1`, the scenario script left the mobile menu open. The open menu covered the Save button, and `agent-browser click '#save'` exited with `Element '#save' is covered by <li inside ul#links>`. The status stayed `Not saved`. The helper finalized a playable video and recorded `captureStatus: complete` with `assertionStatus: fail`. This result shows that capture status and assertion status stay separate.

The runs `ev2` and `pair2` close the menu before the form step. Their manifests record `rerun` as `ev1` and `pair1`. The reruns do not claim to capture the original failure.

## Cleanup

`agent-browser session list` printed `No active sessions` after each capture script.
