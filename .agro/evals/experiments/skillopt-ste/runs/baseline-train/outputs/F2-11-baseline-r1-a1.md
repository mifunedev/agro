---
name: agent-browser
description: |
  Open a URL in the headless agent-browser after a preflight health check.
  The check verifies that agent-browser is installed and that Chromium starts.
  If a check fails, the skill stops and reports a diagnostic trace.
  TRIGGER when: asked to open a page, browse a URL, take a screenshot,
  or test a site with agent-browser.
argument-hint: "<url> [--viewport desktop|mobile] [--session <name>]"
---

# Agent Browser

Open a URL in the headless browser. Run the health check first. If the health check fails, stop and report the full diagnostic trace to the user. The user needs the trace to fix the browser.

## Instructions

### Step 1 — Parse arguments

Arguments received: `$ARGUMENTS`

- **URL**: `$0`. This argument is required.
- **VIEWPORT**: the value after the `--viewport` flag. Default: `desktop`.
- **SESSION**: the value after the `--session` flag. This argument is optional. Use `SESSION` to isolate one browser session from another.

If the URL is missing, ask the user for the URL.

### Viewport defaults

| Name | Width | Height |
|------|-------|--------|
| `desktop` | 1280 | 720 |
| `mobile` | 414 | 896 |

If the arguments contain no `--viewport` flag, use `desktop`.

### Step 2 — Preflight health check

Run the checks in order, one at a time. If a check fails, **stop immediately**. Report the full diagnostic trace to the user.

#### 2a. Check agent-browser is installed

```bash
command -v agent-browser && agent-browser --version 2>&1 || echo "FAIL: agent-browser not found in PATH"
```

If the command does not find `agent-browser`, install `agent-browser` through the CLI:

```bash
agro tool install agent-browser --yes
```

The catalog entry performs three actions:

1. The entry pins the version.
2. The entry sets the mode of the binary.
3. The entry runs `agent-browser install --with-deps`.

If stdin is not a TTY, you must pass `--yes`. The catalog entry declares a `~1 GB` download. Without `--yes`, the confirmation gate refuses the install and shows no prompt.

The steps above apply in the sandbox. If no sandbox is reachable, the same command runs on the host and performs these actions:

1. The command installs a pinned release binary into `~/.local/bin`.
2. The command downloads no browser.
3. The command needs no `--yes`.

After a host install, `agent-browser` requires one of these two items:

- a Chromium-family browser that is already installed on the host
- `AGENT_BROWSER_EXECUTABLE_PATH` set to the path of a Chromium-family browser

Firefox is not a supported target.

Verify the install:

```bash
agent-browser --version     # → agent-browser 0.8.5
agent-browser open about:blank && agent-browser close
```

Notes:

- **0.8.5**: later major versions have breaking CLI changes. The rest of this skill uses the flags of 0.8.5. The catalog owns the version pin.
- **Do not use `sudo npm install -g`.** That command installs into `/usr/lib/node_modules`. No running sandbox can upgrade that directory in place. Use `agro tool install agent-browser`. The catalog installs into `$PNPM_HOME` under the home directory of the sandbox user.
- If `agent-browser install --with-deps` ends with `sh: 1: playwright: not found`, the playwright CLI is missing. Do these steps in order:
  1. Run `pnpm add -g playwright@latest`.
  2. Run `npx playwright install chromium`.

After the install, continue the health check at step 2b. **Do not stop.**

#### 2b. Check Chromium launches

```bash
agent-browser open "about:blank" 2>&1
```

The check fails if the command exits non-zero. The check also fails if the error output contains "chrome", "chromium", "ENOENT", "launch", or "sandbox". If the check fails, do these steps in order:

1. Report the full error and this message to the user:

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

2. Close the failed session:

```bash
agent-browser close 2>/dev/null
```

3. **Stop.** Do not continue to step 2c.

#### 2c. Verify page loaded

```bash
agent-browser snapshot -c 2>&1
```

If the snapshot returns content, the browser is healthy. Minimal content counts as content. Close the health-check session:

```bash
agent-browser close
```

### Step 2d — DNS resolution check (tunnel hostnames)

If a Cloudflared tunnel or a custom DNS route serves the hostname in the URL, the container DNS can fail to resolve the hostname. Run the script below. The script checks the hostname and adds a missing entry to `/etc/hosts`:

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

If the script prints `FAIL:`, stop. The script lets agent-browser reach a tunnel-served site before the container DNS resolver has the CNAME.

### Step 3 — Open the target URL with viewport

Set `WIDTH` and `HEIGHT` from the selected viewport. Then open the URL:

```bash
# Desktop: 1280x720, Mobile: 375x812
agent-browser open "$URL" --viewport-width $WIDTH --viewport-height $HEIGHT $( [ -n "$SESSION" ] && echo "--session $SESSION" )
```

If `agent-browser open` does not support the `--viewport-width` and `--viewport-height` flags, do these steps in order:

1. Open the URL.
2. Resize the viewport.

```bash
agent-browser open "$URL" $( [ -n "$SESSION" ] && echo "--session $SESSION" )
agent-browser eval "await page.setViewportSize({ width: $WIDTH, height: $HEIGHT })"
```

If a command in this step fails, report the error and the full output to the user.

### Step 4 — Confirm page loaded and screenshot

```bash
agent-browser snapshot -c
```

Report a summary of the loaded page to the user. Include the page title and the key visible elements.

Save a screenshot to `.claude/screenshots/`. Derive a descriptive filename from the URL path. **Use an absolute output path.** `agent-browser` 0.8.5 resolves a relative path from the working directory of the daemon. A relative path can therefore write the file outside the repository without an error.

```bash
# Generate filename from URL: strip protocol, replace / with --, remove trailing -
FILENAME=$(echo "$URL" | sed 's|https\?://||; s|/|--|g; s|--$||; s|[^a-zA-Z0-9._-]|-|g')
SCREENSHOT_PATH="$PWD/.claude/screenshots/${FILENAME}.png"
mkdir -p "$(dirname "$SCREENSHOT_PATH")"
agent-browser screenshot "$SCREENSHOT_PATH"
```

Example: `https://my-app.oh-local.localhost:8443/guide/configuration/` → `$PWD/.claude/screenshots/my-app.oh-local.localhost-8443--guide--configuration.png`

### Step 5 — Report

Report this block to the user:

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

- Close each browser session when you finish: `agent-browser close`.
- Use `--session <name>` to isolate concurrent test runs from each other.
- If a step fails, close the session before you report to the user.
