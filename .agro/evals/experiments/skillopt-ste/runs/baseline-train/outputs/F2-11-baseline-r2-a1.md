---
name: agent-browser
description: |
  Open a URL in the headless agent-browser after a preflight health check.
  The check confirms that agent-browser is installed and that Chromium starts.
  If a check fails, the skill stops and reports a diagnostic trace.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  or test a site with agent-browser.
argument-hint: "<url> [--viewport desktop|mobile] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser. Run the health check first. If the browser fails a check, stop and give the full diagnostic trace to the user. The user then repairs the browser.

## Instructions

### Step 1 — Parse arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0`. This argument is mandatory.
- **VIEWPORT**: the value that follows the `--viewport` flag. Default: `desktop`.
- **SESSION**: the value that follows the `--session` flag. This argument is optional. Use it to isolate one session from other sessions.

If the arguments contain no URL, ask the user for the URL.

### Viewport defaults

| Name | Width | Height |
|------|-------|--------|
| `desktop` | 1280 | 720 |
| `mobile` | 414 | 896 |

If the arguments contain no `--viewport` flag, use `desktop`.

### Step 2 — Preflight health check

Run the checks in order, one at a time. If a check fails, stop at once. Then give the full diagnostic trace to the user.

#### 2a. Check agent-browser is installed

```bash
command -v agent-browser && agent-browser --version 2>&1 || echo "FAIL: agent-browser not found in PATH"
```

If the command prints `FAIL: agent-browser not found in PATH`, install agent-browser through the CLI:

```bash
agro tool install agent-browser --yes
```

The catalog entry performs three actions:

1. It pins the version.
2. It sets the mode of the binary.
3. It runs `agent-browser install --with-deps`.

If stdin is not a TTY, you must supply `--yes`. The entry declares a `~1 GB` download. Without `--yes`, the confirmation gate refuses the install and does not prompt.

The steps above apply in the sandbox. If no sandbox is reachable, the same command runs on the host with a different result:

- It installs a pinned release binary into `~/.local/bin`.
- It downloads no browser.
- It does not need `--yes`.

After a host install, agent-browser needs a Chromium-family browser on the host. As an alternative, set `AGENT_BROWSER_EXECUTABLE_PATH` to the path of a Chromium-family browser. Agent-browser does not support Firefox.

Verify the install:

```bash
agent-browser --version     # → agent-browser 0.8.5
agent-browser open about:blank && agent-browser close
```

Notes:
- **0.8.5** — later major versions change the CLI in ways that break this skill. This skill uses the flags of 0.8.5. The catalog owns the pinned version.
- **Do not use `sudo npm install -g`.** That command installs into `/usr/lib/node_modules`. A running sandbox cannot upgrade that directory in place. Use `agro tool install agent-browser`. The catalog installs into `$PNPM_HOME`, under the home directory of the sandbox user.
- If `agent-browser install --with-deps` ends with `sh: 1: playwright: not found`, the playwright CLI is missing. Do these two steps:
  1. Run `pnpm add -g playwright@latest`.
  2. Run `npx playwright install chromium`.

After the install, continue the health check at step 2b. **Do not stop.**

#### 2b. Check Chromium launches

```bash
agent-browser open "about:blank" 2>&1
```

If the command exits with a non-zero code, the check fails. If the output contains an error that mentions "chrome", "chromium", "ENOENT", "launch", or "sandbox", the check also fails. If the check fails, report the full error and this message:

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

Then close the failed session:

```bash
agent-browser close 2>/dev/null
```

**Stop here.** Do not continue to step 2c.

#### 2c. Verify page loaded

```bash
agent-browser snapshot -c 2>&1
```

If the snapshot returns any content, the browser is healthy. A minimal snapshot is also valid content. Close the health-check session:

```bash
agent-browser close
```

### Step 2d — DNS resolution check (tunnel hostnames)

A Cloudflared tunnel or a custom DNS route can serve the hostname in the URL. In that case, the DNS resolver of the container can fail to resolve the hostname. The resolver fails until the CNAME record propagates. Run the DNS check below:

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

If the container resolver cannot resolve the hostname, the script asks the Cloudflare DNS API for the IP address. The script then adds the IP address to `/etc/hosts`. After this step, agent-browser can reach the tunnel-served site. If the Cloudflare DNS API returns no IP address, the script prints `FAIL: $HOSTNAME does not resolve. Check tunnel/DNS routing.` In that case, stop and report the failure to the user.

### Step 3 — Open the target URL with viewport

1. Find the width and height of the selected viewport in the viewport table. Set `$WIDTH` and `$HEIGHT` to those values.
2. Open the URL with the viewport flags:

```bash
# Desktop: 1280x720, Mobile: 375x812
agent-browser open "$URL" --viewport-width $WIDTH --viewport-height $HEIGHT $( [ -n "$SESSION" ] && echo "--session $SESSION" )
```

The comment in the block above gives `375x812` for mobile. The viewport table gives `414x896`. The mobile size is `<mobile viewport size>`.

If `agent-browser open` rejects the `--viewport-width` and `--viewport-height` flags, do these two steps:

1. Open the URL without the viewport flags.
2. Resize the viewport.

```bash
agent-browser open "$URL" $( [ -n "$SESSION" ] && echo "--session $SESSION" )
agent-browser eval "await page.setViewportSize({ width: $WIDTH, height: $HEIGHT })"
```

If a command in this step fails, report the error with the full output.

### Step 4 — Confirm page loaded and screenshot

```bash
agent-browser snapshot -c
```

Report a summary of the loaded page. Include the page title and the key visible elements.

Take a screenshot into `.claude/screenshots/`. Derive a descriptive filename from the URL path. **Use an absolute output path.** `agent-browser` 0.8.5 resolves a relative path from the working directory of the daemon. A relative path can put the screenshot outside the repository without an error.

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

- When you finish, close each browser session with `agent-browser close`.
- To isolate concurrent test runs, give each run its own `--session <name>`.
- If a step fails, close the session. Then report to the user.
