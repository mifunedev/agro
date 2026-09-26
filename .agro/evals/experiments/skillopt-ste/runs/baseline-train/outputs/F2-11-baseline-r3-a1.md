---
name: agent-browser
description: |
  Open a URL in the headless agent-browser after a preflight health check.
  The check confirms that agent-browser is installed and that Chromium launches.
  If a check fails, the skill stops and reports a full diagnostic trace.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  or test a site with agent-browser.
argument-hint: "<url> [--viewport desktop|mobile] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser. The agent runs a health check first. If the browser fails the check, the agent stops and reports the full diagnostic trace. The user reads the trace to fix the browser.

## Instructions

### Step 1 — Parse arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0`. This argument is required.
- **VIEWPORT**: the value after the `--viewport` flag. Default: `desktop`.
- **SESSION**: the value after the `--session` flag. This argument is optional. Use it to isolate one session from another.

If the URL is missing, ask the user for the URL.

### Viewport defaults

| Name | Width | Height |
|------|-------|--------|
| `desktop` | 1280 | 720 |
| `mobile` | 414 | 896 |

If the arguments omit `--viewport`, use `desktop`.

### Step 2 — Preflight health check

Run the checks in order. If a check fails, **stop immediately**. Report the full diagnostic trace to the user.

#### 2a. Check agent-browser is installed

```bash
command -v agent-browser && agent-browser --version 2>&1 || echo "FAIL: agent-browser not found in PATH"
```

If the check does not find agent-browser, install agent-browser through the CLI. The catalog entry pins the
version and sets the mode of the binary. The catalog entry also runs `agent-browser install --with-deps`:

```bash
agro tool install agent-browser --yes
```

If stdin is not a TTY, you must pass `--yes`. The entry declares a
`~1 GB` download. Without `--yes`, the confirmation gate refuses the install and does not prompt.

The command above installs agent-browser in the sandbox. If no sandbox is reachable, the same
command installs a pinned release binary into `~/.local/bin` on the host.
The host install downloads no browser and needs no `--yes`. The host install
requires one of these:

- a Chromium-family browser on the host;
- `AGENT_BROWSER_EXECUTABLE_PATH` set to the path of a Chromium-family browser.

agent-browser does not support Firefox.

Verify the install:

```bash
agent-browser --version     # → agent-browser 0.8.5
agent-browser open about:blank && agent-browser close
```

Notes:
- **0.8.5**: later major versions change the CLI in ways that break this skill.
  This skill uses the flags of 0.8.5. The catalog owns the version pin.
- **Do not use `sudo npm install -g`.** That command installs into
  `/usr/lib/node_modules`. A running sandbox cannot upgrade that directory in place.
  Use `agro tool install agent-browser`. The catalog installs into `$PNPM_HOME`,
  in the home directory of the sandbox user.
- If `agent-browser install --with-deps` ends with
  `sh: 1: playwright: not found`, the playwright CLI is missing. Do these steps:
  1. Run `pnpm add -g playwright@latest`.
  2. Run `npx playwright install chromium`.

After the install, continue the health check at step 2b. **Do not stop.**

#### 2b. Check Chromium launches

```bash
agent-browser open "about:blank" 2>&1
```

The command fails if it exits non-zero or if its output mentions "chrome", "chromium", "ENOENT", "launch", or "sandbox". If the command fails, report the full error and the text below:
```
Chromium failed to launch. Common causes:

1. Missing system dependencies:
   apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
     libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
     libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
     fonts-liberation xdg-utils

2. Chromium not downloaded:
   agent-browser install --with-deps

3. Sandbox permission issue (containers):
   Ensure --no-sandbox is set or container has SYS_ADMIN capability.
```

**Stop here.** Do not continue. Close the failed session first:

```bash
agent-browser close 2>/dev/null
```

#### 2c. Verify page loaded

```bash
agent-browser snapshot -c 2>&1
```

If the snapshot returns content, the browser is healthy. Minimal content also counts. Close the health-check session:

```bash
agent-browser close
```

### Step 2d — DNS resolution check (tunnel hostnames)

A Cloudflared tunnel or a custom DNS route can serve the hostname in the URL. If the tunnel or the route serves the hostname, the DNS resolver of the container can fail to resolve the hostname. Run the script below. The script adds a missing hostname to `/etc/hosts`:

```bash
HOSTNAME=$(echo "$URL" | sed 's|https\?://||; s|/.*||; s|:.*||')
if ! getent hosts "$HOSTNAME" &>/dev/null; then
  # Resolve via Cloudflare DNS API
  IP=$(curl -sf "https://cloudflare-dns.com/dns-query?name=${HOSTNAME}&type=A" \
    -H "accept: application/dns-json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Answer'][0]['data'])" 2>/dev/null)
  if [ -n "$IP" ]; then
    echo "$IP $HOSTNAME" | sudo tee -a /etc/hosts >/dev/null
    echo "Added $HOSTNAME -> $IP to /etc/hosts (container DNS didn't resolve it)"
  else
    echo "FAIL: $HOSTNAME does not resolve. Check tunnel/DNS routing."
    # Stop here
  fi
fi
```

The script lets agent-browser reach a tunnel-served site before the DNS resolver of the container receives the CNAME record.

### Step 3 — Open the target URL with viewport

Set the width and height from the selected viewport. Then open the URL:

```bash
# Desktop: 1280x720, Mobile: 375x812
agent-browser open "$URL" --viewport-width $WIDTH --viewport-height $HEIGHT $( [ -n "$SESSION" ] && echo "--session $SESSION" )
```


If `agent-browser open` does not support the `--viewport-width` and `--viewport-height` flags, open the URL first. Then set the viewport size:

```bash
agent-browser open "$URL" $( [ -n "$SESSION" ] && echo "--session $SESSION" )
agent-browser eval "await page.setViewportSize({ width: $WIDTH, height: $HEIGHT })"
```


If a command fails, report the error with the full output.

### Step 4 — Confirm page loaded and screenshot

```bash
agent-browser snapshot -c
```

Report a summary of the loaded page: the page title and the key visible elements.

Take a screenshot into `.claude/screenshots/`. Derive a descriptive filename from the URL path. **Use an absolute output path.** `agent-browser` 0.8.5 resolves a relative path against the working directory of the daemon. That directory can differ from the repository, so the screenshot can land outside the repository without an error.

```bash
# Generate filename from URL: strip protocol, replace / with --, remove trailing -
FILENAME=$(echo "$URL" | sed 's|https\?://||; s|/|--|g; s|--$||; s|[^a-zA-Z0-9._-]|-|g')
SCREENSHOT_PATH="$PWD/.claude/screenshots/${FILENAME}.png"
mkdir -p "$(dirname "$SCREENSHOT_PATH")"
agent-browser screenshot "$SCREENSHOT_PATH"
```


Example: `https://my-app.oh-local.localhost:8443/guide/configuration/` → `$PWD/.claude/screenshots/my-app.oh-local.localhost-8443--guide--configuration.png`

### Step 5 — Report

```
Browser ready.

  URL:        $URL
  Viewport:   $VIEWPORT ($WIDTHx$HEIGHT)
  Session:    $SESSION (or "default")
  Screenshot: $SCREENSHOT_PATH

  Next steps:
    agent-browser screenshot <absolute-path>  # capture to custom path
    agent-browser snapshot -i                 # interactive elements
    agent-browser is visible "<selector>" # wait for element
    agent-browser close                   # end session (always do this)
```


## Session Hygiene

- ALWAYS close the browser session at the end of the task: `agent-browser close`.
- To isolate concurrent test runs, give each run its own `--session <name>`.
- If a step fails, close the session. Then report to the user.
