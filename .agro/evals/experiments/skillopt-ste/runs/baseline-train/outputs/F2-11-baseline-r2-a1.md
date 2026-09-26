---
name: agent-browser
description: |
  Open a URL in the headless agent-browser, with a preflight health check.
  Verifies agent-browser is installed and Chromium launches before navigating.
  Errors out with a diagnostic trace if anything fails.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  or test a site with agent-browser.
argument-hint: "<url> [--viewport desktop|mobile] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser. The skill runs a health check first. If
the health check fails, the skill stops and reports the full diagnostic trace
to the user.

## Instructions

### Step 1 — Parse arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0` (required)
- **VIEWPORT**: the value after the `--viewport` flag, if the user gives one.
  Default: `desktop`
- **SESSION**: the value after the `--session` flag, if the user gives one
  (optional; the value isolates one test session from another)

If the user omits the URL, ask the user for the URL.

### Viewport defaults

| Name | Width | Height |
|------|-------|--------|
| `desktop` | 1280 | 720 |
| `mobile` | 414 | 896 |

If the user omits `--viewport`, use `desktop`.

### Step 2 — Preflight health check

Run each of the following checks in order. If a check fails, stop and report
the full diagnostic trace to the user.

#### 2a. Check agent-browser is installed

```bash
command -v agent-browser && agent-browser --version 2>&1 || echo "FAIL: agent-browser not found in PATH"
```

If the check does not find `agent-browser`, install `agent-browser` through
the CLI. The catalog entry pins the version, fixes the binary's mode, and runs
`agent-browser install --with-deps`:

```bash
agro tool install agent-browser --yes
```

If stdin is not a TTY, pass `--yes`. The catalog entry declares a `~1 GB`
download. Without `--yes`, the confirmation gate refuses the install instead
of prompting.

Inside the sandbox, this command follows the path above. Outside the sandbox,
this command installs a pinned release binary into `~/.local/bin` on the host.
The host install downloads no browser and needs no `--yes`. The host install
requires a Chromium-family browser already on the host, or the
`AGENT_BROWSER_EXECUTABLE_PATH` environment variable pointing at one. Firefox
is not a supported target.

Verify the install:

```bash
agent-browser --version     # → agent-browser 0.8.5
agent-browser open about:blank && agent-browser close
```

Notes:
- This skill targets `agent-browser` **0.8.5**. Later major versions change
  the CLI flags. The catalog owns the version pin.
- Do not run `sudo npm install -g` to install `agent-browser`. That command
  installs under `/usr/lib/node_modules`, and no running sandbox can upgrade
  that path in place. Run `agro tool install agent-browser` instead. The
  catalog installs into `$PNPM_HOME` under the sandbox user's own home.
- If `agent-browser install --with-deps` ends with
  `sh: 1: playwright: not found`, the playwright CLI is missing. Run
  `pnpm add -g playwright@latest`, then run `npx playwright install chromium`.

After the install finishes, resume the health check at step 2b. Do not stop
after the install.

#### 2b. Check Chromium launches

```bash
agent-browser open "about:blank" 2>&1
```

If this command exits with a non-zero code, or the error output names
"chrome", "chromium", "ENOENT", "launch", or "sandbox", report the full error
and this message:

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

Stop the health check here. Close the failed session first:

```bash
agent-browser close 2>/dev/null
```

#### 2c. Verify page loaded

```bash
agent-browser snapshot -c 2>&1
```

If the snapshot returns any content, the browser is healthy. Close the
health-check session:

```bash
agent-browser close
```

### Step 2d — DNS resolution check (tunnel hostnames)

If the URL names a hostname served by a Cloudflared tunnel or a custom DNS
route, check whether the container resolves that hostname. If the container's
DNS resolver has not yet propagated the CNAME record, add the hostname to
`/etc/hosts` so `agent-browser` can reach the tunnel-served site:

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

If the hostname still does not resolve after this check, stop and report
`FAIL: <hostname> does not resolve. Check tunnel/DNS routing.` to the user.

### Step 3 — Open the target URL with viewport

Open the URL with the viewport width and height from the Viewport defaults
table:

```bash
# Desktop: 1280x720, Mobile: 375x812
agent-browser open "$URL" --viewport-width $WIDTH --viewport-height $HEIGHT $( [ -n "$SESSION" ] && echo "--session $SESSION" )
```

If this version of `agent-browser open` does not support the
`--viewport-width` and `--viewport-height` flags, open the URL first, then
resize the page in two steps:

```bash
agent-browser open "$URL" $( [ -n "$SESSION" ] && echo "--session $SESSION" )
agent-browser eval "await page.setViewportSize({ width: $WIDTH, height: $HEIGHT })"
```

If either command fails, report the error with the full output.

### Step 4 — Confirm page loaded and screenshot

```bash
agent-browser snapshot -c
```

Report the page title and the key visible elements from the snapshot.

Take a screenshot to `.claude/screenshots/` using a filename derived from the
URL path. Use an absolute output path. `agent-browser` 0.8.5 writes a relative
path from the daemon's working directory, not from the repository directory,
so a relative path can write the screenshot outside the repository.

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

- Close every browser session when the task ends: run `agent-browser close`.
- Pass `--session <name>` to isolate one concurrent test run from another.
- If a step fails, close the session before you report the failure to the user.
