---
name: agent-browser
description: |
  Open a URL in the headless agent-browser in a named session, with a
  preflight health check. Take screenshots and record desktop or mobile
  videos as task evidence or demo source footage.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  test a site with agent-browser, record a browser flow, capture a
  walkthrough or demo video, record a bug reproduction, watch browser
  sessions live in the agent-browser dashboard, or sign in to a page and
  reuse the saved sign-in state.
argument-hint: "<url> [--viewport desktop|mobile] [--task <slug>] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser in a named session. A preflight health check
runs first. If the browser is broken, stop and report the full diagnostic trace.

`.agro/cli/src/lib/tools/catalog.ts` owns the supported agent-browser version.
This skill states no version. Check commands against `agent-browser --help` of
the installed version.

## References

Load each reference when the task needs it:

| Need | Read |
|---|---|
| Any screenshot that is evidence for a task, a criterion, or a PR | [`references/annotation.md`](references/annotation.md) |
| A video: evidence selection, purpose and profile, dimensions, `record.sh`, recovery | [`references/recording.md`](references/recording.md) |
| A page that needs a sign-in: operator sign-in through the dashboard, saved state, vault | [`references/auth.md`](references/auth.md) |
| Watch sessions live, or show the operator the browser | [`references/dashboard.md`](references/dashboard.md) |
| A command or flag that this skill does not name | `agent-browser skills get core --full` (version-matched to the installed CLI) |
| Operator guide: install, worked recording examples, manifest fields, Git tracking | [Browser recording](https://agro.mifune.dev/docs/agro/integrations/agent-browser) (`docs/integrations/agent-browser.md`) |

## Arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0`. If the URL is missing, ask the user for it.
- **VIEWPORT**: the value after `--viewport`. Default: `desktop`.
- **TASK**: the value after `--task`. Default: the slug of the current task
  under `.agro/tasks/`. If no task exists, use `adhoc`.
- **SESSION**: the value after `--session`. Default: a stable id for the task
  and the worktree:

  ```bash
  SESSION="${SESSION:-$(agent-browser session id --scope worktree --prefix "$TASK")}"
  ```

  The id is the same from each directory of the worktree, and differs between
  worktrees. Parallel agents therefore never share a session.

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
agent-browser --session "$SESSION" snapshot -i
```

Report the page title and the key visible elements.

### Target elements by ref

`snapshot` gives each node a ref, for example `[ref=e2]`. Pass the ref as
`@e2` to `click`, `fill`, `get`, and the other element commands:

```bash
agent-browser --session "$SESSION" snapshot -i
agent-browser --session "$SESSION" fill @e2 'Ada'
agent-browser --session "$SESSION" click @e3
```

- Read each ref from the latest snapshot. Never guess a ref. Headings and text
  nodes also get refs, so `@e1` is not always the first control.
- Take a new snapshot after a navigation or a DOM change. An old ref can point
  at another element.
- Use a ref to explore and drive the page. Use a CSS selector in an assertion,
  a script, or a PR step, because a ref is not stable between runs.

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

Annotate each screenshot that is evidence. `scripts/annotate-screenshot.sh`
adds numbered callouts, takes the screenshot, and prints the `Callouts:` line
that goes under it. Read `references/annotation.md` first. It owns the callout
choice, the script usage, and the PR publication rules.

### Diagnostics

Collect browser logs when an assertion fails, or when a criterion claims "no
errors". Save each log next to the screenshots:

```bash
EVIDENCE="$(git rev-parse --show-toplevel)/.agro/tasks/$TASK/evidence"
agent-browser --session "$SESSION" console > "$EVIDENCE/console.log"
agent-browser --session "$SESSION" errors --json | jq '.data.errors' > "$EVIDENCE/errors.json"
agent-browser --session "$SESSION" network requests --filter /api/ > "$EVIDENCE/requests.log"
```

- `console` prints each message as `[<level>] <text>`.
- Use `errors --json`. The plain output can print an empty `✗` line without
  the message.
- `network requests` lists the requests since the page opened. `--clear`
  resets the list. For a full capture, run `network har start` before the
  scenario and `network har stop "$EVIDENCE/<name>.har"` after it.
- A HAR file and a log can contain tokens and cookies. Read the file before
  you commit it.
- For before and after comparisons, follow `references/annotation.md`.

### Quality checks

Run these checks when a criterion names accessibility or page performance.
Both commands exit 0 when they find a problem. Read the JSON result:

```bash
agent-browser --session "$SESSION" a11y --tags wcag2a,wcag2aa --json \
  | tee "$EVIDENCE/a11y.json" | jq '.data.counts'
agent-browser --session "$SESSION" vitals --json \
  | tee "$EVIDENCE/vitals.json" | jq '.data | {lcp, cls, inp, ttfb, fcp}'
```

- `a11y` runs axe-core on the page. `--selector '#main'` limits the audit to
  the changed part. Compare `violations` with the base commit. Report each new
  violation by rule id and node, not only the count.
- `vitals` measures the page that is open. Lab values on a sandbox page vary
  between runs. Use them to compare two builds on the same machine, not as an
  absolute budget.

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

Read `references/recording.md` before any recording. It owns the evidence
selection table, the purpose and profile settings, the dimension rules, and the
`record.sh start` and `record.sh stop` procedure. A recording is supporting
evidence. Assertions and tests stay authoritative.

## Report

```
Browser ready.

  URL:        $URL
  Viewport:   $VIEWPORT ($WIDTHx$HEIGHT)
  Session:    $SESSION
  Screenshot: $SCREENSHOT_PATH
```

For a recording, use the report in `references/recording.md`.

## Session options

A launch option such as `--idle-timeout` or `--color-scheme` applies when the
session daemon starts. If a later command in the same session leaves the
option out, the daemon can restart the browser on `about:blank`, and the page
state is lost. Set launch options with environment variables, which apply to
every command:

```bash
export AGENT_BROWSER_IDLE_TIMEOUT_MS=7200000
```

- The daemon closes a session after 1 hour without commands. For a session that
  waits on a long build or an operator, raise the limit before the first
  command. `0` disables the limit. Close the session when you are done.
- Use `set media dark`, `set media light`, or `set media light reduced-motion`
  for theme and motion evidence. The command changes a running session and
  keeps the page.

## Session hygiene

- Close each session when done: `agent-browser --session "$SESSION" close`.
- If a step fails, close the session before you report.
- Never run `agent-browser close --all`. It closes the sessions of other agents.
