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

This skill opens a URL in the headless browser. Before it opens the URL, the skill runs a health check. If the health check fails, the skill stops and reports a full diagnostic trace to the user.

## Instructions

### Step 1 — Parse arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0` (required)
- **VIEWPORT**: value after `--viewport` flag if present. Default: `desktop`
- **SESSION**: value after `--session` flag if present (optional, for session isolation)

If URL is missing, ask the user to provide it.

### Viewport defaults

| Name | Width | Height |
|------|-------|--------|
| `desktop` | 1280 | 720 |
| `mobile` | 414 | 896 |

If the user does not specify `--viewport`, the skill uses `desktop`.

### Step 2 — Preflight health check

Run each check sequentially. If any check fails, **stop immediately** and report the full diagnostic trace to the user.

#### 2a. Check agent-browser is installed

```bash
command -v agent-browser && agent-browser --version 2>&1 || echo "FAIL: agent-browser not found in PATH"
```

If `agent-browser` is not found, install `agent-browser` through the CLI catalog. The catalog entry pins the version, fixes the binary's mode, and runs `agent-browser install --with-deps` for the user:

```bash
agro tool install agent-browser --yes
```

Pass `--yes` whenever stdin is not a TTY. The catalog entry declares a `~1 GB` download, so the confirmation gate refuses the install instead of prompting the user.

That path applies in the sandbox. When no sandbox is reachable, the same
command installs a pinned release binary into `~/.local/bin` on the host,
downloads no browser, and needs no `--yes`. The host install then requires a
Chromium-family browser already on the host, or
`AGENT_BROWSER_EXECUTABLE_PATH` pointing at one. Firefox is not a supported
target.

Verify:

```bash
agent-browser --version     # → agent-browser 0.8.5
agent-browser open about:blank && agent-browser close
```

Notes:
- **0.8.5** — later majors have breaking CLI changes; the rest of this
  skill targets 0.8.5's flags. The catalog owns the pin.
- **Do not use `sudo npm install -g` to install agent-browser.**
  `sudo npm install -g` places the package under `/usr/lib/node_modules`, and
  no running sandbox can upgrade files there in place.
  Use `agro tool install agent-browser`: the catalog installs into `$PNPM_HOME`
  under the sandbox user's own home.
- If `agent-browser install --with-deps` ends with
  `sh: 1: playwright: not found`, the playwright CLI is missing. Run
  `pnpm add -g playwright@latest`, then run `npx playwright install chromium`.

After installing, resume the health check from step 2b — **do not stop**.

#### 2b. Check Chromium launches

```bash
agent-browser open "about:blank" 2>&1
```

If this fails (non-zero exit, error output mentioning "chrome", "chromium", "ENOENT", "launch", or "sandbox"), report the full error and:

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

**Stop here** — do not continue. Close the failed session first:

```bash
agent-browser close 2>/dev/null
```

#### 2c. Verify page loaded

```bash
agent-browser snapshot -c 2>&1
```

If snapshot returns content (even minimal), the browser is healthy. Close the health-check session:

```bash
agent-browser close
```

### Step 2d — DNS resolution check (tunnel hostnames)

If the URL contains a hostname served by a Cloudflared tunnel or custom DNS route, check whether the container's DNS resolver has that hostname. Fix a missing entry:

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

The `/etc/hosts` entry lets `agent-browser` reach tunnel-served sites before the container's DNS resolver receives the CNAME record.

### Step 3 — Open the target URL with viewport

Set the viewport size based on the selected viewport, then open the URL:

```bash
# Desktop: 1280x720, Mobile: 375x812
agent-browser open "$URL" --viewport-width $WIDTH --viewport-height $HEIGHT $( [ -n "$SESSION" ] && echo "--session $SESSION" )
```

If `agent-browser open` does not support `--viewport-width`/`--viewport-height` flags, open the URL first, then resize:

```bash
agent-browser open "$URL" $( [ -n "$SESSION" ] && echo "--session $SESSION" )
agent-browser eval "await page.setViewportSize({ width: $WIDTH, height: $HEIGHT })"
```

If this fails, report the error with the full output.

### Step 4 — Confirm page loaded and screenshot

```bash
agent-browser snapshot -c
```

Report a summary of what loaded (page title, key elements visible).

Take a screenshot to `.claude/screenshots/`. Derive a descriptive filename from the URL path, as shown below. **Use an absolute output path.** `agent-browser` 0.8.5 writes a relative path from the daemon's working directory. A relative path can therefore write the screenshot outside the repository without an error.

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

- ALWAYS close browser sessions when done: `agent-browser close`
- Use `--session <name>` for isolation between concurrent test runs
- If any step errors, close the session before reporting to the user
