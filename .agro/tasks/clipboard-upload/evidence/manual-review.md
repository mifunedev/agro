# US-005 manual review

Tested implementation: `a7fa68421753f1b5771ca6ce605d8b7f1f7fd8b8`.
The journey used the task-built bundle, not the installed global CLI.
All results below came from the real service and host Chromium, not unit-test mocks.
The worker redacted tokens. No upload, credential, or request-body file accompanies this evidence.

## Setup and command transcript

Location: host worktree `/home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload`.
Existing sandbox: `clipboard-review-1612`; bind mount: `/home/sandbox/harness`.
The worker did not provision, restart, destroy, or change the sandbox.

The following abbreviations identify exact command prefixes used below:

```bash
R=(node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 --)
B=(agent-browser --session clipboard-us005-1612)
```

1. Check listeners before boot on the host:

   ```bash
   ss -ltnp '( sport = :3500 or sport = :3560 or sport = :14612 )'
   ```

   Exit 0. Host 3500 belonged to Python PID 504650; 3560 belonged to Python PID 678534.
   Host 14612 was free. Neither Python listener received a stop command.

2. Check sandbox ports and fresh paths before creating resources:

   ```bash
   "${R[@]}" sh -lc 'ss -ltnp "( sport = :3500 or sport = :14613 )"; test ! -e /home/sandbox/.clipboard-us005-1612; test ! -e /home/sandbox/harness/.clipboard-us005-input; mkdir -m 700 /home/sandbox/.clipboard-us005-1612 /home/sandbox/harness/.clipboard-us005-input'
   ```

   Exit 0. Both ports were free. Both paths were absent before creation.
   The new AGRO home had mode `0700`.
   The new input directory later held generated `light-panel.png` and `dark-panel.png`.

3. Run the browser preflight on the host:

   ```bash
   command -v agent-browser && agent-browser --version
   "${B[@]}" open about:blank
   "${B[@]}" snapshot -c
   "${B[@]}" set viewport 1280 720
   ```

   All exited 0. Version: `0.38.1`. The blank page rendered `(empty page)`.
   No sandbox browser installation or privilege operation occurred.

4. Start the private test relay in host tmux:

   ```bash
   tmux new-session -d -s clipboard-us005-1612-relay 'node /tmp/clipboard-us005-relay.cjs'
   ```

   Exit 0. The relay bound only `127.0.0.1:14612`.
   It forwarded GET and POST through the existing-sandbox CLI to sandbox `127.0.0.1:3500`.
   It preserved response status, headers, and body and translated Host and Origin to sandbox loopback.
   Request JSON files used mode `0600` in the new bind-mounted input directory.
   The connector deleted each file before sending the request.
   This avoided the existing exec route's missing interactive stdin support.
   The relay rejected methods other than GET and POST and bounded bodies to 1000000 bytes.
   The fixtures were tiny. This relay is test-only, not shipped forwarding infrastructure.

5. Start the public service twice with inline environment values:

   ```bash
   "${R[@]}" env AGRO_HOME=/home/sandbox/.clipboard-us005-1612 node .agro/cli/dist/agro.js clipboard start
   "${R[@]}" env AGRO_HOME=/home/sandbox/.clipboard-us005-1612 node .agro/cli/dist/agro.js clipboard start
   ```

   Each exited 0. Each returned `http://127.0.0.1:3500/#token=[REDACTED]`.
   A temporary host helper captured both outputs in memory and asserted exact equality.
   The helper opened the corresponding port-14612 fragment URL in the named browser session.
   It redacted the fragment before printing browser output.
   No token entered a connector argument, screenshot, DOM snapshot, or evidence file.
   The browser-open credential URL was the sole intentional token argument.
   After load, `get url` returned `http://127.0.0.1:14612/`; the fragment was absent.

## Browser scenarios

### A. Light landing

1. Inspect the page with `snapshot -c` and DOM assertions.
   Expected: title "AGRO Clipboard", heading "Upload from clipboard", and status "Ready for images.".
   Observed theme: `light`; the next-theme button read "Dark mode".
   The auth alert was empty. The upload button prevented submission with no selected images.

   <details><summary>Screenshot</summary>

   ![Light landing](01-light-landing.png)
   </details>
   Callouts: 1 is the upload heading. 2 is the paste drop and file controls. 3 is the light theme toggle. 4 is the ready status.

### B. Real clipboard paste, file selection, and drop

1. Generate two original PNG references with browser canvas, each `360x200` pixels.
   The light panel used warm paper, near-black text, and a green action rectangle.
   The dark panel used a near-black background, pale text, and a green action rectangle.
   Each panel contained its theme label and "Reference design / 1612".
   Write the resulting PNG bytes to the new input paths with mode `0600`.
   The references contained generated designs, not private screenshots.

2. Hold a browser CDP WebSocket open during clipboard permission grant and paste.
   Grant `clipboardReadWrite` and `clipboardSanitizedWrite` for `http://127.0.0.1:14612` in each browser context.
   Write the light PNG through `navigator.clipboard.write` with a real `ClipboardItem`.
   Click `#paste` while the permission connection remains open.
   Expected: a `clipboard-1.png` preview appears.
   The immediate helper count was 0 before the asynchronous read completed.
   The subsequent caption fill succeeded after the preview appeared.
   This exercised the real clipboard-read button, not a synthetic paste event.

3. Fill the first caption and select the dark PNG through the actual file input:

   ```bash
   "${B[@]}" fill '.card textarea' 'Light panel: keep the warm paper and green action.'
   "${B[@]}" upload '#files' /home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload/.clipboard-us005-input/dark-panel.png
   "${B[@]}" fill '.card:nth-child(2) textarea' 'Dark panel: keep the high contrast green accent.'
   ```

   All exited 0. Two previews and their distinct captions appeared.
   Record both caption element IDs and values before the next addition.

4. Dispatch a browser `DragEvent('drop')` with a `DataTransfer` containing the generated light PNG as `drop-review.png`.
   Expected: the card count becomes 3. Observed count: 3.
   The event exercised the real drop handler with file bytes, not a physical pointer drag.
   Fill its caption, then remove only the dropped preview:

   ```bash
   "${B[@]}" fill '.card:nth-child(3) textarea' 'Temporary drop preview: remove this image.'
   "${B[@]}" click '.card:nth-child(3) .remove'
   ```

   Both exited 0. Expected: "Image removed." and "2 / 10 images".
   A DOM comparison of both retained caption IDs and values returned `stable: true`.

5. Toggle the theme and scroll to the cards without shrinking desktop text:

   ```bash
   "${B[@]}" click '#theme'
   "${B[@]}" scrollintoview '#cards'
   ```

   Both exited 0. Expected theme: `dark`; the toggle text became "Light mode".
   Both captions still matched the values entered above.

   <details><summary>Screenshot</summary>

   ![Dark mode with distinct captions](02-dark-captions.png)
   </details>
   Callouts: 1 is the light panel caption. 2 is the dark panel caption. 3 is the retained image count.

6. Check mobile layout with both captions still present:

   ```bash
   "${B[@]}" set viewport 414 896
   "${B[@]}" eval 'JSON.stringify({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,noHorizontalOverflow:document.documentElement.scrollWidth===innerWidth,captions:document.querySelectorAll(".card textarea").length})'
   "${B[@]}" set viewport 1280 720
   ```

   All exited 0. Observed: viewport 414, document width 414, no horizontal overflow, 2 captions.
   The check used viewport-only emulation, not a physical device.

### C. Upload and explicit image-tool handoff

1. Upload through the browser:

   ```bash
   "${B[@]}" click '#upload'
   "${B[@]}" wait '#result:not([hidden])'
   "${B[@]}" scrollintoview '#result'
   ```

   All exited 0. Expected: "Upload complete. Copy the prompt to your image-capable agent." and "Ready for your agent".
   The service returned HTTP 201 through the relay.
   The result listed one manifest and two image paths.
   The prompt instructed the agent to open every image with an image-capable tool.
   The prompt also warned that paths alone do not provide visual input.

   <details><summary>Screenshot</summary>

   ![Successful handoff](03-handoff.png)
   </details>
   Callouts: 1 is the ready handoff. 2 is the saved manifest and image paths. 3 is the explicit image reading prompt. 4 is the prompt copy control.

2. Verify actual clipboard copy:

   ```bash
   "${B[@]}" click '#copy'
   node .agro/skills/agent-browser/scripts/clipboard-read.mjs --session clipboard-us005-1612
   ```

   Both exited 0. Expected: "Agent prompt copied.".
   The clipboard text matched `#prompt.value` exactly.
   The permission-aware script read the real clipboard; no writeText replacement was necessary.

3. Inspect the saved manifest and image files through the public existing-sandbox route.
   The inspection used Node filesystem reads, not a private service entry point.
   Observed manifest:

   ```text
   /home/sandbox/.clipboard-us005-1612/clipboard/dcca83577b5e3a770c837664a09210deadd6db6a6f8e6707236d9c6f568eba03/batches/0d0cae83-7150-4118-985d-cc5d616d5eff/manifest.json
   schemaVersion=1
   projectRoot=/home/sandbox/harness
   homeMode=700 batchMode=700 manifestMode=600
   ```

   | Order | Name | Bytes declared / read | File mode | Caption |
   |---|---|---|---|---|
   | 1 | `clipboard-1.png` | 7743 / 7743 | `600` | Light panel: keep the warm paper and green action. |
   | 2 | `dark-panel.png` | 8513 / 8513 | `600` | Dark panel: keep the high contrast green accent. |

   Both MIME types were `image/png`. Both files had generated UUID names and absolute paths.
   The manifest order and captions matched the retained browser cards.
   The removed image was absent. The batches directory held exactly one completed batch.
   The worker dispatched no image-reading agent. The evidence proves ingestion and handoff, not downstream visual understanding.

## Screenshot capture commands

Each capture ran after its DOM assertions, in the same named browser session.
All screenshots used absolute host evidence paths and a `1280x720` viewport.
The following exact command prefix applied to all three captures:

```bash
AGENT_BROWSER_SESSION=clipboard-us005-1612 bash .agro/skills/agent-browser/scripts/annotate-screenshot.sh
```

Arguments, in order:

```text
/home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload/.agro/tasks/clipboard-upload/evidence/01-light-landing.png
h1=the upload heading
#drop=the paste drop and file controls
#theme=the light theme toggle
#status=the ready status

/home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload/.agro/tasks/clipboard-upload/evidence/02-dark-captions.png
.card:nth-child(1) textarea=the light panel caption
.card:nth-child(2) textarea=the dark panel caption
#count=the retained image count

/home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload/.agro/tasks/clipboard-upload/evidence/03-handoff.png
#result-title=the ready handoff
#paths=the saved manifest and image paths
#prompt=the explicit image reading prompt
#copy=the prompt copy control
```

Each capture exited 0. The callout lines above are exact annotation-script output.
The worker opened and inspected all three screenshot files before committing them.
The advisor owns full-head-SHA screenshot links and callouts in the PR body after the final head exists.

## Stop, preservation, and occupied-port failure

1. Stop twice through the public bundle:

   ```bash
   "${R[@]}" env AGRO_HOME=/home/sandbox/.clipboard-us005-1612 node .agro/cli/dist/agro.js clipboard stop
   "${R[@]}" env AGRO_HOME=/home/sandbox/.clipboard-us005-1612 node .agro/cli/dist/agro.js clipboard stop
   ```

   Each exited 0 and printed "Clipboard stopped; uploaded batches preserved.".
   A subsequent filesystem check found the manifest and both images after both stops.
   Sandbox `ss` showed no listener on 3500 or 14613.

2. Create an owned, unrelated HTTP listener for the failure case:

   ```bash
   "${R[@]}" tmux new-session -d -s clipboard-us005-1612-occupied 'node -e '\''require("node:http").createServer((q,r)=>r.end("US005 owned listener")).listen(14613,"127.0.0.1")'\'''
   "${R[@]}" ss -ltnp '( sport = :14613 )'
   "${R[@]}" env AGRO_HOME=/home/sandbox/.clipboard-us005-1612 node .agro/cli/dist/agro.js clipboard start --port 14613
   ```

   Listener creation and inspection exited 0. Listener PID: 10078.
   Clipboard start exited 1 with:

   ```text
   agro clipboard: port 14613 is unavailable; leave its listener running and choose --port <port>
   ```

3. Verify listener preservation after the refused start:

   ```bash
   "${R[@]}" node -e 'fetch("http://127.0.0.1:14613").then(async r=>console.log("Listener after refused start: "+r.status+" "+await r.text()))'
   "${R[@]}" ss -ltnp '( sport = :14613 )'
   ```

   Both exited 0. Expected: "Listener after refused start: 200 US005 owned listener".
   PID 10078 still held the port. Only the following cleanup stopped that owned fixture.

## Cleanup

The following commands exited 0:

```bash
"${R[@]}" tmux kill-session -t '=clipboard-us005-1612-occupied'
"${B[@]}" close
tmux kill-session -t '=clipboard-us005-1612-relay'
"${R[@]}" node -e 'const fs=require("fs");for(const p of ["/home/sandbox/.clipboard-us005-1612","/home/sandbox/harness/.clipboard-us005-input"]){fs.rmSync(p,{recursive:true});console.log(p+" removed="+!fs.existsSync(p))}'
```

Both temporary directories reported `removed=true`, after service stop and preservation checks.
The worker removed only journey-owned batches, fixtures, and temporary helpers.
No upload service remains running.
Final checks:

| Check | Result |
|---|---|
| Sandbox ports 3500 and 14613 | No listeners; `ss` exit 0 |
| Host port 14612 | No listener; `ss` exit 0 |
| Host 3500 and 3560 | Original Python PIDs 504650 and 678534 unchanged |
| Relay tmux `has-session` | Exit 1; exact session absent |
| Browser session list | No active sessions; exit 0 |

## Verification and remaining acceptance

- Browser WCAG2A/AA audit: exit 0; 21 passes, 39 inapplicable, 0 incomplete, 0 violations.
  With zero current violations, there are zero new violations against any baseline.
- Browser `errors --json`: exit 0; `errors: []`.
- Browser `console`: exit 0; no messages.
- Documentation-reference tests, changed-prose STE, full-document baseline findings, and diff checks appear in the verification artifact.
- Executed: documentation updates, fresh state, real paste/file/drop handling, caption stability, theme toggle, and mobile width.
  Additional executed checks covered manifest persistence, prompt copy, lifecycle idempotence, occupied-port preservation, annotated screenshots, and cleanup.
- Reasoned: isolated workers require explicit file transfer or a shared mount with valid absolute paths.
  This journey did not launch a second worker or prove downstream model image input.
- Pending, advisor-owned: PR screenshot links using the final full head SHA, final shipping confirmation from the operator, push, exact-head CI, and PR undraft.
  This worker neither accepted its own result nor edited the tracker or PR.

## Affected surfaces

| Surface | Disposition |
|---|---|
| Host and sandbox | Applied: host docs/browser/git, sandbox service/storage via public CLI |
| Lifecycle door | Applied: public start/stop and existing-sandbox wrapper only |
| Canonical and provider surfaces | Applied: canonical CLI README; no provider mirror edits |
| Root and scaffold | Applied: root public docs; scaffold changes not applicable |
| Interactive and headless processes | Applied: named tmux service, relay, and test fixture |
| Local and remote operation | Applied: loopback route tested; remote SSH setup documented conditionally |
| Parallel operation | Applied: assigned worktree, unique session names, unrelated listeners preserved |
| Public documentation | Applied: all five assigned documents |
| Verification | Applied: browser assertions, annotated media, docs-reference and STE checks |
