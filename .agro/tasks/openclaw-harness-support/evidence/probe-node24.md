# OpenClaw probe transcript (node:24-trixie-slim, container openclaw-probe-1362)

Setup: git installed via apt; user probe (HOME=/home/probe); /home/probe/harness git repo with AGENTS.md, .agro/skills/prd/SKILL.md, .agents/skills -> ../.agro/skills, committed clean. Unless stated, env OPENCLAW_STATE_DIR=/home/probe/harness/.openclaw and PATH=/home/probe/.local/bin:...

```console
$ node --version; npm --version; npm help install 2>/dev/null | grep -i -A3 allow-scripts | head; npm config ls -l 2>/dev/null | grep -i script
v24.21.0
11.19.0
allow-scripts = [""]
allow-scripts-pending = false
allow-scripts-pin = true
dangerously-allow-all-scripts = false
description = true
foreground-scripts = false
ignore-scripts = false
script-shell = null
strict-allow-scripts = false
token-description = null
[exit 0]
```

```console
$ npm view openclaw@2026.9.9 version engines bin scripts dependencies --json 2>&1 | head -80; npm view openclaw dist-tags
{
  "version": "2026.9.9",
  "engines": {
    "node": ">=24.16.0 <25 || >=26.1.0"
  },
  "bin": {
    "openclaw": "openclaw.mjs"
  },
  "scripts": {
    "dev": "node scripts/run-node.mjs",
    "frv": "node scripts/frv.mjs",
    "tui": "node scripts/run-node.mjs tui",
    "lint": "node --import ./scripts/tsx.mjs scripts/run-lint.mts",
    "test": "node --import ./scripts/tsx.mjs scripts/test-projects.mts",
    "tsgo": "pnpm tsgo:core",
    "build": "node --import ./scripts/tsx.mjs scripts/build-all.mts",
    "check": "node --import ./scripts/tsx.mjs scripts/check.mts",
    "start": "node openclaw.mjs",
    "format": "oxfmt --write --threads=1",
    "qa:e2e": "node --import ./scripts/tsx.mjs scripts/qa-e2e.ts",
    "ui:dev": "node scripts/ui.js dev",
    "verify": "node --import ./scripts/tsx.mjs scripts/verify.mts",
    "ios:gen": "/bin/bash -c 'export PATH=\"$PATH:/opt/homebrew/bin:/usr/local/bin\"; ./scripts/ios-configure-signing.sh && ./scripts/ios-write-version-xcconfig.sh && node scripts/ios-write-swift-filelist.mjs && cd apps/ios && xcodegen generate'",
    "ios:run": "/bin/bash scripts/ios-run.sh",
    "test:ui": "pnpm lint:ui:no-raw-window-open && node --import ./scripts/tsx.mjs scripts/ensure-playwright-chromium.mts && pnpm --dir ui test",
    "tsgo:ui": "node scripts/run-tsgo.mjs -p tsconfig.ui.json --incremental --tsBuildInfoFile .artifacts/tsgo-cache/ui.tsbuildinfo",
    "tui:dev": "node --import ./scripts/tsx.mjs scripts/run-with-env.mts OPENCLAW_PROFILE=dev -- node scripts/run-node.mjs --dev tui",
    "docs:dev": "node scripts/docs-dev.mjs",
    "ios:open": "/bin/bash -c 'export PATH=\"$PATH:/opt/homebrew/bin:/usr/local/bin\"; ./scripts/ios-configure-signing.sh && ./scripts/ios-write-version-xcconfig.sh && node scripts/ios-write-swift-filelist.mjs && cd apps/ios && xcodegen generate && open OpenClaw.xcodeproj'",
    "lint:all": "node scripts/run-oxlint.mjs",
    "lint:fix": "node scripts/run-oxlint.mjs --fix && pnpm format",
    "mac:open": "open dist/OpenClaw.app",
    "openclaw": "node scripts/run-node.mjs",
    "test:all": "pnpm lint && pnpm build && pnpm test && pnpm test:e2e && pnpm test:live && pnpm test:docker:all",
    "test:e2e": "pnpm test:e2e:gateway && pnpm test:e2e:agent-plugin-gateway && pnpm test:ui:e2e",
    "test:max": "node --import ./scripts/tsx.mjs scripts/test-projects-max.mts",
    "tsgo:all": "pnpm tsgo:core:all && pnpm tsgo:extensions:all && pnpm tsgo:scripts && pnpm tsgo:test:root",
    "ui:build": "node scripts/ui.js build",
    "codex:mcp": "node --import ./scripts/tsx.mjs src/mcp/codex-supervision-tools-serve.ts",
    "docs:list": "node scripts/docs-list.js",
    "dup:check": "node scripts/check-duplicates.mjs",
    "ios:build": "/bin/bash -c 'export PATH=\"$PATH:/opt/homebrew/bin:/usr/local/bin\"; ./scripts/ios-configure-signing.sh && ./scripts/ios-write-version-xcconfig.sh && node scripts/ios-write-swift-filelist.mjs && cd apps/ios && xcodegen generate && xcodebuild -project OpenClaw.xcodeproj -scheme OpenClaw -destination \"${IOS_DEST:-generic/platform=iOS Simulator}\" -configuration Debug build'",
    "lint:apps": "pnpm lint:swift",
    "lint:core": "node --import ./scripts/tsx.mjs scripts/run-oxlint-shards.mts --only=core",
    "lint:docs": "pnpm dlx --config.resolution-mode=highest markdownlint-cli2 --config config/markdownlint-cli2.jsonc",
    "proxy:run": "node scripts/run-node.mjs proxy run",
    "qa:lab:ui": "pnpm openclaw qa ui",
    "qa:lab:up": "node --import ./scripts/tsx.mjs scripts/qa-lab-up.ts",
    "test:fast": "node scripts/run-vitest.mjs run --config test/vitest/vitest.unit.config.ts",
    "test:live": "node --import ./scripts/tsx.mjs scripts/test-live.mts",
    "test:unit": "pnpm test:unit:fast && node scripts/run-vitest.mjs run --config test/vitest/vitest.unit.config.ts",
    "tsgo:core": "node scripts/run-tsgo.mjs -p tsconfig.core.json --incremental --tsBuildInfoFile .artifacts/tsgo-cache/core.tsbuildinfo",
    "tsgo:prod": "pnpm tsgo:core && pnpm tsgo:ui && pnpm tsgo:extensions",
    "tsgo:test": "pnpm tsgo:core:test && pnpm tsgo:extensions:test && pnpm tsgo:test:root",
    "check:docs": "pnpm format:docs:check && pnpm lint:docs && pnpm lint:templates && pnpm docs:check-mdx && pnpm docs:check-i18n-glossary && pnpm docs:check-links && pnpm docs:check-config-examples && pnpm changelog:check",
    "ci:timings": "node scripts/ci-run-timings.mjs --latest-main",
    "clean:dist": "node -e \"require('fs').rmSync('dist', {recursive: true, force: true})\"",
    "format:all": "pnpm format && pnpm format:swift",
    "format:fix": "oxfmt --write --threads=1",
    "ghsa:patch": "node --import ./scripts/tsx.mjs scripts/ghsa-patch.mts",
    "lint:swift": "./scripts/lint-swift.sh",
    "preinstall": "node scripts/preinstall-package-manager-warning.mjs",
    "prepush:ci": "bash scripts/prepush-ci.sh",
    "test:force": "node --import ./scripts/tsx.mjs scripts/test-force.ts",
    "test:watch": "node --import ./scripts/tsx.mjs scripts/test-projects.mts --watch",
    "ui:install": "node scripts/ui.js install",
    "android:run": "node --import ./scripts/tsx.mjs scripts/run-android-gradle.mts :app:runPlayDebug",
    "audit:seams": "node --import ./scripts/tsx.mjs scripts/audit-seams.mts",
    "check:timed": "node --import ./scripts/tsx.mjs scripts/check-timed.mts",
    "crabbox:run": "node dist/crabbox-wrapper.js run",
    "dev:ui:mock": "node --import ./scripts/tsx.mjs scripts/control-ui-mock-dev.ts",
    "format:diff": "oxfmt --write --threads=1 && git --no-pager diff",
    "format:docs": "node --import ./scripts/tsx.mjs scripts/format-docs.mts",
    "gateway:dev": "node --import ./scripts/tsx.mjs scripts/run-with-env.mts OPENCLAW_SKIP_CHANNELS=1 -- node scripts/run-node.mjs --dev gateway",
    "ios:version": "node --import ./scripts/tsx.mjs scripts/ios-version.ts --json",
    "lint:kysely": "node --import ./scripts/tsx.mjs scripts/check-kysely-guardrails.mts",
    "lint:ui:lit": "lit-analyzer \"ui/src/**/*.ts\" --quiet",
    "mac:package": "/bin/bash scripts/package-mac-app.sh",
    "mac:restart": "/bin/bash scripts/restart-mac.sh",
    "postinstall": "node scripts/postinstall-bundled-plugins.mjs",
{
  'extended-stable': '2026.8.35',
  latest: '2026.9.9',
  beta: '2026.10.1-beta.2'
}
[exit 0]
```

```console
$ time npm --prefix /home/probe/.local install -g --allow-scripts=openclaw openclaw@2026.9.9 2>&1 | tail -40
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 343 packages in 37s

112 packages are looking for funding
  run `npm fund` for details
npm warn install-scripts 4 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @google/genai@2.23.0 (preinstall: echo 'preinstall: no-op')
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts   koffi@3.3.1 (install: node ./cnoke.cjs -P . -D src/koffi --prebuild --release)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts
npm warn install-scripts Run `npm install -g --allow-scripts=@google/genai,esbuild,koffi,protobufjs` to allow these scripts once, or `npm config set allow-scripts=@google/genai,esbuild,koffi,protobufjs --location=user` to allow them for all global installs.

real	0m37.199s
user	0m21.180s
sys	0m32.463s
[exit 0]
```

```console
$ ls -l /home/probe/.local/bin/openclaw; readlink -f /home/probe/.local/bin/openclaw; which openclaw; time openclaw --version; ls /home/probe/.local/lib/node_modules/openclaw | head -30; ls /home/probe/.local/lib/node_modules/openclaw/dist/extensions 2>/dev/null | wc -l; find /home/probe/.local/lib/node_modules -name "*.node" | head; ls /home/probe/.local/lib/node_modules/openclaw/node_modules/koffi/build 2>&1 | head
lrwxrwxrwx 1 probe probe 41 Oct  9 06:00 /home/probe/.local/bin/openclaw -> ../lib/node_modules/openclaw/openclaw.mjs
/home/probe/.local/lib/node_modules/openclaw/openclaw.mjs
/home/probe/.local/bin/openclaw
OpenClaw 2026.9.9 (bcfc888)

real	0m0.099s
user	0m0.068s
sys	0m0.036s
CHANGELOG.md
LICENSE
README.md
THIRD_PARTY_NOTICES.md
cli-root-options.mjs
custodian-skills
dist
docs
gateway-run-argv.mjs
gateway-shutdown-budget.mjs
node-compile-cache.mjs
node-host-launcher.mjs
node-runtime-recovery.mjs
node-runtime-update.mjs
node-sqlite.mjs
node-version.mjs
node_modules
openclaw.mjs
package.json
patches
pnpm-workspace.yaml
scripts
skills
65
/home/probe/.local/lib/node_modules/openclaw/node_modules/@openclaw/fs-safe-linux-x64-gnu/fs-safe-native.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/linux/prebuilds/linux-x64/linux-platform-x11.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/linux/prebuilds/linux-arm64/linux-platform-x11.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/win32/prebuilds/win32-arm64/win32-platform.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/win32/prebuilds/win32-x64/win32-platform.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/darwin/prebuilds/darwin-arm64/darwin-platform.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@earendil-works/pi-tui/native/darwin/prebuilds/darwin-x64/darwin-platform.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@lydell/node-pty-linux-x64/prebuilds/linux-x64/pty.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@ubjs/node-linux-x64-gnu/uniffi-runtime-napi.linux-x64-gnu.node
/home/probe/.local/lib/node_modules/openclaw/node_modules/@koromix/koffi-linux-x64/linux_x64/koffi.node
ls: cannot access '/home/probe/.local/lib/node_modules/openclaw/node_modules/koffi/build': No such file or directory
[exit 0]
```

```console
$ cat /home/probe/.local/lib/node_modules/openclaw/scripts/postinstall-bundled-plugins.mjs | head -60; wc -l /home/probe/.local/lib/node_modules/openclaw/scripts/postinstall-bundled-plugins.mjs
#!/usr/bin/env node
// Package lifecycle cleanup and completion touch only this installed package.
// Doctor owns operator-state migration and genuinely dangling runtime-link repair;
// shared caches outside this package can still serve other installs or profiles.
import {
  existsSync,
  lstatSync,
  opendirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { restoreFsSafePrebuild } from "./lib/fs-safe-prebuild.mjs";
import { PACKAGE_LIFECYCLE_PENDING_RELATIVE_PATH } from "./lib/package-lifecycle-marker.mjs";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = join(scriptDir, "..");
const DISABLE_POSTINSTALL_ENV = "OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL";
const DIST_INVENTORY_PATH = "dist/postinstall-inventory.json";
// One budget covers all three prune walks (legacy-deps prepass, file listing,
// empty-dir sweep). npm upgrades transiently hold old+new content-hashed dist
// files, so a real upgrade scan totals ~24k entries today (2026.6.x); keep ~4x
// headroom so dist growth cannot fail `npm install -g` while still refusing
// pathological/unbounded trees.
export const MAX_INSTALLED_DIST_SCAN_ENTRIES = 100_000;
class InstalledDistScanLimitError extends Error {}

function normalizeRelativePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function readInstalledDistInventory(params = {}) {
  const packageRoot = params.packageRoot ?? DEFAULT_PACKAGE_ROOT;
  const pathExists = params.existsSync ?? existsSync;
  const readFile = params.readFileSync ?? readFileSync;
  const inventoryPath = join(packageRoot, DIST_INVENTORY_PATH);
  if (!pathExists(inventoryPath)) {
    throw new Error(`missing dist inventory: ${DIST_INVENTORY_PATH}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFile(inventoryPath, "utf8"));
  } catch {
    throw new Error(`invalid dist inventory: ${DIST_INVENTORY_PATH}`);
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error(`invalid dist inventory: ${DIST_INVENTORY_PATH}`);
  }
  return new Set(parsed.map(normalizeRelativePath));
}

function isRecoverableInstalledDistInventoryError(error) {
  return error instanceof Error && /^(missing|invalid) dist inventory: /u.test(error.message);
}

function resolveInstalledDistRoot(params = {}) {
  const packageRoot = params.packageRoot ?? DEFAULT_PACKAGE_ROOT;
432 /home/probe/.local/lib/node_modules/openclaw/scripts/postinstall-bundled-plugins.mjs
[exit 0]
```

```console
$ P=/home/probe/.local/lib/node_modules/openclaw; grep -o "PACKAGE_LIFECYCLE_PENDING_RELATIVE_PATH *= *[^;]*" $P/scripts/lib/package-lifecycle-marker.mjs; ls -la $P/dist/.openclaw* $P/.openclaw* 2>&1 | head
PACKAGE_LIFECYCLE_PENDING_RELATIVE_PATH = ".openclaw-lifecycle-pending"
ls: cannot access '/home/probe/.local/lib/node_modules/openclaw/dist/.openclaw*': No such file or directory
ls: cannot access '/home/probe/.local/lib/node_modules/openclaw/.openclaw*': No such file or directory
[exit 0]
```

```console
$ mkdir -p /home/probe/noflag && time npm --prefix /home/probe/noflag install -g openclaw@2026.9.9 2>&1 | tail -15; ls -l /home/probe/noflag/bin/openclaw; /home/probe/noflag/bin/openclaw --version
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 343 packages in 21s

112 packages are looking for funding
  run `npm fund` for details
npm warn install-scripts 5 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @google/genai@2.23.0 (preinstall: echo 'preinstall: no-op')
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts   koffi@3.3.1 (install: node ./cnoke.cjs -P . -D src/koffi --prebuild --release)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts   openclaw@2026.9.9 (preinstall: node scripts/preinstall-package-manager-warning.mjs; postinstall: node scripts/postinstall-bundled-plugins.mjs)
npm warn install-scripts
npm warn install-scripts Run `npm install -g --allow-scripts=@google/genai,esbuild,koffi,protobufjs,openclaw` to allow these scripts once, or `npm config set allow-scripts=@google/genai,esbuild,koffi,protobufjs,openclaw --location=user` to allow them for all global installs.

real	0m20.978s
user	0m14.397s
sys	0m17.433s
lrwxrwxrwx 1 probe probe 41 Oct  9 06:01 /home/probe/noflag/bin/openclaw -> ../lib/node_modules/openclaw/openclaw.mjs
OpenClaw 2026.9.9 (bcfc888)
[exit 0]
```

```console
$ diff <(cd /home/probe/.local/lib/node_modules/openclaw && find . | sort) <(cd /home/probe/noflag/lib/node_modules/openclaw && find . | sort) | head -20; grep -rn "lifecycle-pending\|PENDING_RELATIVE" /home/probe/noflag/lib/node_modules/openclaw/openclaw.mjs | head -5
674:      (existsSync(new URL("./.openclaw-lifecycle-pending", import.meta.url)) ||
[exit 0]
```

```console
$ npx -y npm@10.9.2 --prefix /home/probe/npm10 install -g --allow-scripts=openclaw openclaw@2026.9.9 2>&1 | tail -8; echo; npx -y npm@10.9.2 --version
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 414 packages in 26s

131 packages are looking for funding
  run `npm fund` for details

10.9.2
[exit 0]
```

```console
$ rm -rf /home/probe/npm10; npx -y npm@10.9.2 --prefix /home/probe/npm10 install -g --allow-scripts=openclaw openclaw@2026.9.9 2>&1 | grep -iv deprecated | head -5; echo "exit=${PIPESTATUS[0]}"

added 414 packages in 16s

131 packages are looking for funding
  run `npm fund` for details
exit=0
[exit 0]
```

```console
$ sed -n 660,700p /home/probe/noflag/lib/node_modules/openclaw/openclaw.mjs
      packageRoot: fileURLToPath(new URL("./", import.meta.url)),
    }))
  ) {
    process.exit(process.exitCode ?? 0);
  }
  const currentNodeRuntimeFailure = process.versions.bun
    ? null
    : nodeRuntimeFailure(process.versions.node, await detectCurrentSqliteCapabilities());

  if (!waitingForNodeUpdateRespawn) {
    // Diagnostics must not replay package lifecycle scripts under an unsupported Node.
    if (
      !currentNodeRuntimeFailure &&
      !isSourceCheckoutLauncher() &&
      (existsSync(new URL("./.openclaw-lifecycle-pending", import.meta.url)) ||
        existsSync(new URL("./dist/openclaw-install-guard", import.meta.url)))
    ) {
      try {
        const { completePendingPackageLifecycle } =
          await import("./dist/infra/package-lifecycle.js");
        await completePendingPackageLifecycle({
          packageRoot: fileURLToPath(new URL("./", import.meta.url)),
        });
      } catch (error) {
        process.stderr.write(
          `openclaw: package lifecycle is incomplete. Reinstall with package scripts enabled, then retry. ${error instanceof Error ? error.message : String(error)}\n`,
        );
        process.exit(1);
      }
    }
    if (tryOutputLauncherVersion(process.argv)) {
      if (currentNodeRuntimeFailure) {
        process.stderr.write(`${formatUnsupportedNodeDiagnosticWarning(process.versions.node)}\n`);
      }
      process.exit(0);
    }
  }

  // Codex owns the relay timeout by PID. Keep the launcher as that exact process
  // so a timeout cannot strand a compile-cache respawn child.
  const waitingForCompileCacheRespawn =
[exit 0]
```

```console
$ rm -rf /home/probe/noflag2; npm --prefix /home/probe/noflag2 install -g openclaw@2026.9.9 >/dev/null 2>&1; P=/home/probe/noflag2/lib/node_modules/openclaw; ls -la $P/dist/openclaw-install-guard $P/.openclaw-lifecycle-pending 2>&1; /home/probe/noflag2/bin/openclaw --version; echo rc=$?; ls -la $P/dist/openclaw-install-guard $P/.openclaw-lifecycle-pending 2>&1; ls /home/probe/.local/lib/node_modules/openclaw/dist/openclaw-install-guard 2>&1
ls: cannot access '/home/probe/noflag2/lib/node_modules/openclaw/dist/openclaw-install-guard': No such file or directory
ls: cannot access '/home/probe/noflag2/lib/node_modules/openclaw/.openclaw-lifecycle-pending': No such file or directory
OpenClaw 2026.9.9 (bcfc888)
rc=0
ls: cannot access '/home/probe/noflag2/lib/node_modules/openclaw/dist/openclaw-install-guard': No such file or directory
ls: cannot access '/home/probe/noflag2/lib/node_modules/openclaw/.openclaw-lifecycle-pending': No such file or directory
ls: cannot access '/home/probe/.local/lib/node_modules/openclaw/dist/openclaw-install-guard': No such file or directory
[exit 2]
```

```console
$ openclaw --help 2>&1 | head -90

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw [options] [command]

Options:
  --container <name>   Run the CLI inside a running Podman/Docker container
                       named <name> (default: env OPENCLAW_CONTAINER)
  --dev                Dev profile: isolate state under ~/.openclaw-dev, default
                       gateway port 19001, and shift derived ports
                       (browser/canvas)
  -h, --help           Display help for command
  --log-level <level>  Global log level override for file + console
                       (silent|fatal|error|warn|info|debug|trace)
  --no-color           Disable ANSI colors
  --profile <name>     Use a named profile (isolates
                       OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH under
                       ~/.openclaw-<name>)
  -V, --version        output the version number

Commands:
  Hint: commands suffixed with * have subcommands. Run <command> --help for details.
  acp *                Run an ACP bridge backed by the Gateway
  agent *              Run an agent turn via the Gateway (use --local for
                       embedded)
  agents *             Manage isolated agents (workspaces + auth + routing)
  approvals *          Manage approval policy and pending requests
  attach               Attach Claude Code to a gateway session with scoped MCP
                       tools
  audit                Inspect activity records and exact-run identity context
  automations *        Manage automations (alias for cron)
  backup *             Create, verify, and restore backup archives and SQLite
                       snapshots
  browser *            Manage OpenClaw's dedicated browser (Chrome/Chromium)
  capability *         Run provider capability commands (fallback alias: infer)
  channels *           Manage connected chat channels and accounts
  chat                 Open a local terminal UI (alias for tui --local)
  clawbot *            Legacy clawbot command aliases
  completion           Generate shell completion script
  config *             Non-interactive config helpers
                       (get/set/patch/unset/file/schema/validate). Run without
                       subcommand for guided setup.
  configure            Interactive configuration for credentials, channels,
                       gateway, and agent defaults
  connect              Connect this machine to an OpenClaw Gateway as a node
  cron *               Manage automations (via Gateway)
  daemon *             Manage the Gateway service (launchd/systemd/schtasks)
  dashboard            Open the Control UI with your current token
  database *           Inspect database schema compatibility and shared-state
                       write ownership
  devices *            Device pairing and auth tokens (for mobile app setup
                       codes, use `openclaw qr` instead)
  directory *          Lookup contact and group IDs (self, peers, groups) for
                       supported chat channels
  dns *                DNS helpers for wide-area discovery (Tailscale + CoreDNS)
  docs                 Search the live OpenClaw docs
  doctor               Health checks + quick fixes for the gateway and channels
  exec-approvals *     Manage exec approvals (alias for approvals)
  exec-policy *        Show or synchronize requested exec policy with host
                       approvals
  file-transfer *      Review file-transfer standing approvals
  fleet *              Provision and manage isolated tenant cells (experimental)
  gateway *            Run, inspect, and query the WebSocket Gateway
  googlemeet *         Join and manage Google Meet calls
  health               Fetch health from the running gateway
  help                 Display help for command
  hooks *              Manage internal agent hooks
  infer *              Run provider-backed inference commands through a stable
                       CLI surface
  logs                 Tail gateway file logs via RPC
  mcp *                Manage OpenClaw mcp.servers config and channel bridge
  memory *             Search, inspect, and reindex memory files
  message *            Send, read, and manage messages and channel actions
  migrate *            Import state from another agent system
  models *             Model discovery, scanning, and configuration
  node *               Run and manage the headless node host service
  nodes *              Manage gateway-owned nodes (pairing, status, invoke, and
                       media)
  onboard *            Guided setup for auth, models, Gateway, workspace,
                       channels, and skills
  pairing *            Secure DM pairing (approve inbound requests)
  plugins *            Manage OpenClaw plugins and extensions
  promos *             Discover and claim promotional model offers from ClawHub
  proxy *              Run the OpenClaw debug proxy and inspect captured traffic
  qr                   Generate a mobile pairing QR code and setup code
  reset                Reset local config/state (keeps the CLI installed)
  resume               Resume a recent Gateway session in the TUI
  sandbox *            Manage sandbox containers (Docker-based agent isolation)
  secrets *            Secrets runtime controls
  security *           Audit local config and state for common security
[exit 0]
```

```console
$ openclaw --help 2>&1 | sed -n 90,140p
  security *           Audit local config and state for common security
                       foot-guns
  sessions *           List stored conversation sessions
  setup                Chat with OpenClaw; onboard when setup is incomplete
  skills *             List and inspect available skills
  status               Show channel health and recent session recipients
  system *             System tools (events, heartbeat, presence)
  teamsmeetings *      Join and manage Microsoft Teams meeting guests
  telemetry *          Inspect and manage anonymous usage telemetry
  terminal             Open a local terminal UI (alias for tui --local)
  transcripts *        Inspect stored transcripts
  triage               Collect sanitized diagnostics and open a local coding
                       agent for repair
  tui                  Open a terminal UI connected to the Gateway
  uninstall            Uninstall the gateway service + local data
  update *             Update OpenClaw and inspect update channel status
  users *              Manage durable user profiles and email aliases
  webhooks *           Webhook helpers and integrations
  worker               Run the restricted cloud worker runtime
  worktrees *          Create, inspect, restore, and clean up managed worktrees
  zoommeetings *       Join and manage Zoom meeting guests

Examples:
  openclaw onboard
    Run guided setup for a local Gateway, workspace, auth, and channels.
  openclaw setup --baseline
    Create the baseline config, workspace, and session folders.
  openclaw configure
    Change models, Gateway, channels, plugins, skills, and health checks.
  openclaw status
    Check Gateway, channel, model, and recent-session status.
  openclaw doctor --fix
    Repair common config, service, plugin, and channel problems.
  openclaw channels add
    Add or update a chat channel account with guided prompts.
  openclaw channels status
    See connected messaging accounts and login state.
  openclaw --dev gateway
    Run a dev Gateway (isolated state/config) on ws://127.0.0.1:19001.
  openclaw gateway run --force
    Start the Gateway and replace anything bound to its port.
  openclaw models status
    Show model/provider auth health before running agents.
  openclaw plugins list
    Inspect enabled, disabled, and installed plugins.
  openclaw agent --to +15555550123 --message "Run summary" --deliver
    Run one agent turn through the Gateway and optionally deliver the reply.
  openclaw message send --channel telegram --target @mychat --message "Hi"
    Send via your Telegram bot.

Docs: https://docs.openclaw.ai/cli
[exit 0]
```

```console
$ openclaw config --help; echo ----; openclaw config set --help

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw config [options] [command]

Non-interactive config helpers (get/set/patch/unset/file/schema/validate). Run
without subcommand for guided setup.

Options:
  -h, --help           Display help for command
  --section <section>  Configuration sections for guided setup (repeatable). Use
                       with no subcommand. (default: [])

Commands:
  file                 Print the active config file path
  get                  Get a config value by dot path
  patch                Patch config from a JSON5 object in one validated write.
                       Objects merge recursively, arrays/scalars replace, and
                       null deletes a path.
                       Examples:
                       openclaw config patch --file ./openclaw.patch.json5
                       --dry-run
                       openclaw config patch --stdin
  schema               Print the JSON schema for openclaw.json
  set                  Set config values by path (value mode, ref/provider
                       builder mode, or batch JSON mode).
                       Examples:
                       openclaw config set gateway.port 19001 --strict-json
                       openclaw config set channels.discord.token --ref-provider
                       default --ref-source env --ref-id DISCORD_BOT_TOKEN
                       openclaw config set secrets.providers.vault
                       --provider-source file --provider-path
                       /etc/openclaw/secrets.json --provider-mode json
                       openclaw config set --batch-file ./config-set.batch.json
                       --dry-run
  unset                Remove a config value by dot path
  validate             Validate the current config against the schema without
                       starting the gateway

Docs: https://docs.openclaw.ai/cli/config

----

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw config set [options] [path] [value]

Set config values by path (value mode, ref/provider builder mode, or batch JSON
mode).
Examples:
openclaw config set gateway.port 19001 --strict-json
openclaw config set channels.discord.token --ref-provider default --ref-source
env --ref-id DISCORD_BOT_TOKEN
openclaw config set secrets.providers.vault --provider-source file
--provider-path /etc/openclaw/secrets.json --provider-mode json
openclaw config set --batch-file ./config-set.batch.json --dry-run

Arguments:
  path                                  Config path (dot or bracket notation)
  value                                 Value (JSON/JSON5 or raw string)

Options:
  --allow-exec                          Dry-run only: allow exec SecretRef
                                        resolvability checks (may execute
                                        provider commands) (default: false)
  --batch-file <path>                   Batch mode: read JSON array of set
                                        operations from file
  --batch-json <json>                   Batch mode: JSON array of set operations
  --dry-run                             Validate changes without writing
                                        openclaw.json (checks run in
                                        builder/json/batch modes; exec
                                        SecretRefs are skipped unless
                                        --allow-exec is set) (default: false)
  --expect-current-absent               Write only when the authored path is
                                        absent (default: false)
  --expect-current-json <json>          Write only when the authored path
                                        exactly matches this strict JSON value
  -h, --help                            Display help for command
  --json                                Legacy alias for --strict-json (default:
                                        false)
  --merge                               Merge object/map values instead of
                                        replacing the target path (default:
                                        false)
  --provider-allowlist <envVar>         Provider builder (env): allowlist entry
                                        (repeatable) (default: [])
  --provider-arg <arg>                  Provider builder (exec): command arg
                                        (repeatable) (default: [])
  --provider-command <path>             Provider builder (exec): absolute
                                        command path
  --provider-env <key=value>            Provider builder (exec): env assignment
                                        (repeatable) (default: [])
  --provider-json-only                  Provider builder (exec): require JSON
                                        output (default: false)
  --provider-max-bytes <bytes>          Provider builder (file): max bytes
  --provider-max-output-bytes <bytes>   Provider builder (exec): max output
                                        bytes
  --provider-mode <mode>                Provider builder (file): mode
                                        (singleValue|json)
  --provider-no-output-timeout-ms <ms>  Provider builder (exec): no-output
                                        timeout ms
  --provider-pass-env <envVar>          Provider builder (exec): pass host env
                                        var (repeatable) (default: [])
  --provider-path <path>                Provider builder (file): path
  --provider-source <source>            Provider builder: source
                                        (env|file|exec|store)
  --provider-timeout-ms <ms>            Provider builder (file|exec): timeout ms
  --provider-trusted-dir <path>         Provider builder (exec): trusted
                                        directory (repeatable) (default: [])
  --ref-id <id>                         SecretRef builder: ref id
  --ref-provider <alias>                SecretRef builder: provider alias
  --ref-source <source>                 SecretRef builder: source
                                        (env|file|exec|store)
  --replace                             Allow full replacement of protected
                                        map/list paths such as
                                        agents.defaults.models (default: false)
  --strict-json                         Strict JSON parsing (error instead of
                                        raw string fallback) (default: false)
[exit 0]
```

```console
$ openclaw config file; echo rc=$?; openclaw config set agents.defaults.workspace /home/probe/harness; echo rc=$?; openclaw config get agents.defaults.workspace; echo rc=$?; openclaw config file; find /home/probe/harness/.openclaw -maxdepth 2 | head -30; cat /home/probe/harness/.openclaw/openclaw.json; ls -la /home/probe/.openclaw 2>&1; git -C /home/probe/harness status --porcelain
/home/probe/harness/.openclaw/openclaw.json
rc=0
Updated agents.defaults.workspace. Change will apply without restarting the gateway.
rc=0
/home/probe/harness
rc=0
/home/probe/harness/.openclaw/openclaw.json
/home/probe/harness/.openclaw
/home/probe/harness/.openclaw/state
/home/probe/harness/.openclaw/state/openclaw.sqlite
/home/probe/harness/.openclaw/state/openclaw.sqlite-wal
/home/probe/harness/.openclaw/state/openclaw.sqlite-shm
/home/probe/harness/.openclaw/config-journal-fingerprint.key
/home/probe/harness/.openclaw/openclaw.json
{
  "agents": {
    "defaults": {
      "workspace": "/home/probe/harness"
    }
  },
  "plugins": {
    "entries": {
      "anthropic": {
        "config": {
          "sessionCatalog": {
            "enabled": false
          }
        }
      },
      "codex": {
        "config": {
          "sessionCatalog": {
            "enabled": false
          }
        }
      }
    }
  },
  "meta": {
    "migrations": {
      "modelPolicyAllowlist": true,
      "utilityModelSeparation": true
    },
    "lastTouchedVersion": "2026.9.9"
  }
}
ls: cannot access '/home/probe/.openclaw': No such file or directory
?? .openclaw/
[exit 0]
```

```console
$ openclaw setup --help; echo -----; openclaw onboard --help

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw setup [options]

Chat with OpenClaw; onboard when setup is incomplete

Options:
  --accept-risk                            Acknowledge that agents are powerful and full system access is risky (required for --non-interactive) (default: false)
  --agent-name <name>                      Name for the first agent (or team coordinator)
  --ai-gateway-api-key <key>               Vercel AI Gateway API key
  --alibaba-model-studio-api-key <key>     Alibaba Model Studio API key
  --anthropic-api-key <key>                Anthropic API key
  --arceeai-api-key <key>                  Arcee AI API key
  --auth-choice <choice>                   Auth: custom-api-key|setup-token|token|apiKey|skip|alibaba-model-studio-api-key|anthropic-cli|arceeai-api-key|baseten-api-key|byteplus-api-key|cerebras-api-key|chutes|chutes-api-key|clawrouter-api-key|cloudflare-ai-gateway-api-key|zai-cn|openai|openai-device-code|qwen-api-key-cn|qwen-api-key|zai-coding-cn|zai-coding-global|cohere-api-key|comfy-cloud-api-key|copilot-proxy|deepinfra-api-key|deepseek-api-key|fal-api-key|featherless-api-key|fireworks-api-key|github-copilot|github-copilot-enterprise|zai-global|gmi-api-key|gemini-api-key|google-vertex-api-key|groq-api-key|huggingface-api-key|kie-api-key|kilocode-api-key|kimi-code-api-key|litellm-api-key|lmstudio|longcat-api-key|meta-api-key|microsoft-foundry-apikey|microsoft-foundry-entra|minimax-cn-api|minimax-global-api|minimax-cn-oauth|minimax-global-oauth|mistral-api-key|moonshot-api-key|moonshot-api-key-cn|novita-api-key|nvidia-api-key|ollama|ollama-cloud|openai-api-key|opencode-go|opencode-zen|arceeai-openrouter|openrouter-api-key|openrouter-oauth|pixverse-api-key|qianfan-api-key|qwen-token-plan-cn|qwen-token-plan|radius|radius-api-key|runway-api-key|sglang|openai-token-sharing|qwen-standard-api-key-cn|qwen-standard-api-key|stepfun-standard-api-key-cn|stepfun-standard-api-key-intl|stepfun-plan-api-key-cn|stepfun-plan-api-key-intl|synthetic-api-key|telnyx-api-key|tokenhub-api-key|tokenplan-api-key|together-api-key|venice-api-key|ai-gateway-api-key|vllm|volcengine-api-key|vydra-api-key|xai-api-key|xai-device-code|xai-oauth|xiaomi-api-key|xiaomi-token-plan-cn|xiaomi-token-plan-ams|xiaomi-token-plan-sgp|zai-api-key
  --baseline                               Create baseline config/workspace/session folders without onboarding (default: false)
  --baseten-api-key <key>                  Baseten API key
  --byteplus-api-key <key>                 BytePlus API key
  --cerebras-api-key <key>                 Cerebras API key
  --chutes-api-key <key>                   Chutes API key
  --classic                                Use the classic multi-step setup wizard (default: false)
  --clawrouter-api-key <key>               ClawRouter proxy key
  --cloudflare-ai-gateway-account-id <id>  Cloudflare Account ID
  --cloudflare-ai-gateway-api-key <key>    Cloudflare AI Gateway API key
  --cloudflare-ai-gateway-gateway-id <id>  Cloudflare AI Gateway ID
  --cohere-api-key <key>                   Cohere API key
  --comfy-api-key <key>                    Comfy Cloud API key
  --custom-api-key <key>                   Custom provider API key (optional)
  --custom-base-url <url>                  Custom provider base URL
  --custom-compatibility <mode>            Custom provider API compatibility: openai|openai-responses|anthropic (default: openai)
  --custom-image-input                     Mark the custom provider model as image-capable
  --custom-model-id <id>                   Custom provider model ID
  --custom-provider-id <id>                Custom provider ID (optional; auto-derived by default)
  --custom-text-input                      Mark the custom provider model as text-only
  --daemon-runtime <runtime>               Daemon runtime: node|bun (default: node)
  --deepinfra-api-key <key>                DeepInfra API key
  --deepseek-api-key <key>                 DeepSeek API key
  --fal-api-key <key>                      fal API key
  --featherless-api-key <key>              Featherless AI API key
  --fireworks-api-key <key>                Fireworks API key
  --flow <flow>                            Onboard flow: quickstart|advanced|manual|import
  --gateway-auth <mode>                    Gateway auth: token|password
  --gateway-bind <mode>                    Gateway bind: loopback|tailnet|lan|auto|custom
  --gateway-password <password>            Gateway password (password auth)
  --gateway-port <port>                    Gateway port
  --gateway-token <token>                  Gateway token (token auth)
  --gateway-token-ref-env <name>           Gateway token SecretRef env var name (token auth; e.g. OPENCLAW_GATEWAY_TOKEN)
  --gemini-api-key <key>                   Gemini API key
  --github-copilot-token <token>           GitHub Copilot OAuth token
  --gmi-api-key <key>                      GMI Cloud API key
  --groq-api-key <key>                     Groq API key
  -h, --help                               Display help for command
  --huggingface-api-key <key>              Hugging Face API key (HF token)
  --import-from <provider>                 Migration provider to run during onboarding
  --import-secrets                         Import supported secrets during onboarding migration (default: false)
  --import-source <path>                   Source agent home for --import-from
  --install-daemon                         Install gateway service
  --json                                   Output system overview or onboarding summary as JSON (default: false)
  --kie-api-key <key>                      Kie AI API key
  --kilocode-api-key <key>                 Kilo Gateway API key
  --kimi-code-api-key <key>                Kimi Code API key (subscription)
  --litellm-api-key <key>                  LiteLLM API key
  --lmstudio-api-key <key>                 LM Studio API key
  --longcat-api-key <key>                  LongCat API key
  -m, --message <text>                     Run one OpenClaw request
  --meta-api-key <key>                     Meta API key
  --minimax-api-key <key>                  MiniMax API key
  --mistral-api-key <key>                  Mistral API key
  --mode <mode>                            Onboard mode: local|remote
  --modelstudio-api-key <key>              Qwen Cloud Coding Plan API key (Global/Intl)
  --modelstudio-api-key-cn <key>           Qwen Cloud Coding Plan API key (China)
  --modelstudio-standard-api-key <key>     Qwen Cloud standard API key (Global/Intl)
  --modelstudio-standard-api-key-cn <key>  Qwen Cloud standard API key (China)
  --moonshot-api-key <key>                 Moonshot API key
  --no-install-daemon                      Skip gateway service install
  --node-manager <name>                    Node manager for skills: npm|pnpm|bun
  --non-interactive                        Run onboarding without prompts (default: false)
  --novita-api-key <key>                   NovitaAI API key
  --nvidia-api-key <key>                   NVIDIA API key
  --ollama-cloud-api-key <key>             Ollama Cloud API key
  --openai-api-key <key>                   OpenAI API Key
  --opencode-go-api-key <key>              OpenCode API key (Go catalog)
  --opencode-zen-api-key <key>             OpenCode API key (Zen catalog)
  --openrouter-api-key <key>               OpenRouter API key
  --pixverse-api-key <key>                 PixVerse API key
  --qianfan-api-key <key>                  QIANFAN API key
  --qwen-token-plan-api-key <key>          Qwen Token Plan API key (Global/Intl)
  --qwen-token-plan-api-key-cn <key>       Qwen Token Plan API key (China)
  --radius-api-key <key>                   Radius organization API key
  --remote-password <password>             Remote Gateway password (optional)
  --remote-token <token>                   Remote Gateway token (optional)
  --remote-url <url>                       Remote Gateway WebSocket URL
  --reset                                  Reset config + credentials + sessions before running onboarding (workspace only with --reset-scope full)
  --reset-scope <scope>                    Reset scope: config|config+creds+sessions|full
  --runway-api-key <key>                   Runway API key
  --secret-input-mode <mode>               Credential persistence mode: plaintext|ref (default: plaintext)
  --skip-bootstrap                         Skip creating default agent workspace files
  --skip-channels                          Skip channel setup
  --skip-daemon                            Skip gateway service install
  --skip-health                            Skip health check
  --skip-hooks                             Accepted for onboard compatibility; hooks setup is skipped
  --skip-search                            Skip search provider setup
  --skip-skills                            Skip skills setup
  --skip-ui                                Skip Control UI/TUI launch
  --stepfun-api-key <key>                  StepFun API key
  --suppress-gateway-token-output          Disable the guided Control UI handoff
  --synthetic-api-key <key>                Synthetic API key
  --tailscale <mode>                       Tailscale: off|serve|funnel
  --team                                   Create a coordinator with researcher, writer, and reviewer specialists
  --telnyx-api-key <key>                   Telnyx API key
  --together-api-key <key>                 Together AI API key
  --token <token>                          Token value (non-interactive; used with --auth-choice token)
  --token-expires-in <duration>            Optional token expiry duration (e.g. 365d, 12h)
  --token-profile-id <id>                  Auth profile id (non-interactive; default: <provider>:manual)
  --token-provider <id>                    Token provider id (non-interactive; used with --auth-choice token)
  --tokenhub-api-key <key>                 Tencent TokenHub API key
  --tokenplan-api-key <key>                Tencent TokenPlan API key
  --tui                                    Use the terminal hatch instead of the browser handoff (default: false)
  --venice-api-key <key>                   Venice API key
  --volcengine-api-key <key>               Volcano Engine API key
  --vydra-api-key <key>                    Vydra API key
  --wizard                                 Run interactive onboarding (default: false)
  --workspace <dir>                        Workspace proposal for guided setup; persisted by baseline/classic/non-interactive setup
  --xai-api-key <key>                      xAI API key
  --xiaomi-api-key <key>                   Xiaomi MiMo pay-as-you-go API key
  --xiaomi-token-plan-api-key <key>        Xiaomi MiMo Token Plan API key
  --yes                                    Approve persistent config writes for one --message request (default: false)
  --zai-api-key <key>                      Z.AI API key

Examples:
  openclaw setup
    Chat with OpenClaw, or onboard when setup is incomplete.
  openclaw setup -m "status"
    Run one system-agent request.
  openclaw setup --wizard
    Run full onboarding.

Docs: https://docs.openclaw.ai/cli/setup

-----

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw onboard [options] [command]

Guided setup for auth, models, Gateway, workspace, channels, and skills

Options:
  --accept-risk                            Acknowledge that agents are powerful and full system access is risky (required for --non-interactive) (default: false)
  --agent-name <name>                      Name for the first agent (or team coordinator)
  --ai-gateway-api-key <key>               Vercel AI Gateway API key
  --alibaba-model-studio-api-key <key>     Alibaba Model Studio API key
  --anthropic-api-key <key>                Anthropic API key
  --arceeai-api-key <key>                  Arcee AI API key
  --auth-choice <choice>                   Auth: custom-api-key|setup-token|token|apiKey|skip|alibaba-model-studio-api-key|anthropic-cli|arceeai-api-key|baseten-api-key|byteplus-api-key|cerebras-api-key|chutes|chutes-api-key|clawrouter-api-key|cloudflare-ai-gateway-api-key|zai-cn|openai|openai-device-code|qwen-api-key-cn|qwen-api-key|zai-coding-cn|zai-coding-global|cohere-api-key|comfy-cloud-api-key|copilot-proxy|deepinfra-api-key|deepseek-api-key|fal-api-key|featherless-api-key|fireworks-api-key|github-copilot|github-copilot-enterprise|zai-global|gmi-api-key|gemini-api-key|google-vertex-api-key|groq-api-key|huggingface-api-key|kie-api-key|kilocode-api-key|kimi-code-api-key|litellm-api-key|lmstudio|longcat-api-key|meta-api-key|microsoft-foundry-apikey|microsoft-foundry-entra|minimax-cn-api|minimax-global-api|minimax-cn-oauth|minimax-global-oauth|mistral-api-key|moonshot-api-key|moonshot-api-key-cn|novita-api-key|nvidia-api-key|ollama|ollama-cloud|openai-api-key|opencode-go|opencode-zen|arceeai-openrouter|openrouter-api-key|openrouter-oauth|pixverse-api-key|qianfan-api-key|qwen-token-plan-cn|qwen-token-plan|radius|radius-api-key|runway-api-key|sglang|openai-token-sharing|qwen-standard-api-key-cn|qwen-standard-api-key|stepfun-standard-api-key-cn|stepfun-standard-api-key-intl|stepfun-plan-api-key-cn|stepfun-plan-api-key-intl|synthetic-api-key|telnyx-api-key|tokenhub-api-key|tokenplan-api-key|together-api-key|venice-api-key|ai-gateway-api-key|vllm|volcengine-api-key|vydra-api-key|xai-api-key|xai-device-code|xai-oauth|xiaomi-api-key|xiaomi-token-plan-cn|xiaomi-token-plan-ams|xiaomi-token-plan-sgp|zai-api-key
  --baseten-api-key <key>                  Baseten API key
  --byteplus-api-key <key>                 BytePlus API key
  --cerebras-api-key <key>                 Cerebras API key
  --chutes-api-key <key>                   Chutes API key
  --classic                                Use the classic multi-step setup wizard (default: false)
  --clawrouter-api-key <key>               ClawRouter proxy key
  --cloudflare-ai-gateway-account-id <id>  Cloudflare Account ID
  --cloudflare-ai-gateway-api-key <key>    Cloudflare AI Gateway API key
  --cloudflare-ai-gateway-gateway-id <id>  Cloudflare AI Gateway ID
  --cohere-api-key <key>                   Cohere API key
  --comfy-api-key <key>                    Comfy Cloud API key
  --custom-api-key <key>                   Custom provider API key (optional)
  --custom-base-url <url>                  Custom provider base URL
  --custom-compatibility <mode>            Custom provider API compatibility: openai|openai-responses|anthropic (default: openai)
  --custom-image-input                     Mark the custom provider model as image-capable
  --custom-model-id <id>                   Custom provider model ID
  --custom-provider-id <id>                Custom provider ID (optional; auto-derived by default)
  --custom-text-input                      Mark the custom provider model as text-only
  --daemon-runtime <runtime>               Daemon runtime: node|bun (default: node)
  --deepinfra-api-key <key>                DeepInfra API key
  --deepseek-api-key <key>                 DeepSeek API key
  --fal-api-key <key>                      fal API key
  --featherless-api-key <key>              Featherless AI API key
  --fireworks-api-key <key>                Fireworks API key
  --flow <flow>                            Onboard flow: quickstart|advanced|manual|import
  --gateway-auth <mode>                    Gateway auth: token|password
  --gateway-bind <mode>                    Gateway bind: loopback|tailnet|lan|auto|custom
  --gateway-password <password>            Gateway password (password auth)
  --gateway-port <port>                    Gateway port
  --gateway-token <token>                  Gateway token (token auth)
  --gateway-token-ref-env <name>           Gateway token SecretRef env var name (token auth; e.g. OPENCLAW_GATEWAY_TOKEN)
  --gemini-api-key <key>                   Gemini API key
  --github-copilot-token <token>           GitHub Copilot OAuth token
  --gmi-api-key <key>                      GMI Cloud API key
  --groq-api-key <key>                     Groq API key
  -h, --help                               Display help for command
  --huggingface-api-key <key>              Hugging Face API key (HF token)
  --import-from <provider>                 Migration provider to run during onboarding
  --import-secrets                         Import supported secrets during onboarding migration (default: false)
  --import-source <path>                   Source agent home for --import-from
  --install-daemon                         Install gateway service
  --json                                   Output JSON summary (default: false)
  --kie-api-key <key>                      Kie AI API key
  --kilocode-api-key <key>                 Kilo Gateway API key
  --kimi-code-api-key <key>                Kimi Code API key (subscription)
  --litellm-api-key <key>                  LiteLLM API key
  --lmstudio-api-key <key>                 LM Studio API key
  --longcat-api-key <key>                  LongCat API key
  --meta-api-key <key>                     Meta API key
  --minimax-api-key <key>                  MiniMax API key
  --mistral-api-key <key>                  Mistral API key
  --mode <mode>                            Onboard mode: local|remote
  --modelstudio-api-key <key>              Qwen Cloud Coding Plan API key (Global/Intl)
  --modelstudio-api-key-cn <key>           Qwen Cloud Coding Plan API key (China)
  --modelstudio-standard-api-key <key>     Qwen Cloud standard API key (Global/Intl)
  --modelstudio-standard-api-key-cn <key>  Qwen Cloud standard API key (China)
  --modern                                 Open inference-gated OpenClaw (kept for compatibility) (default: false)
  --moonshot-api-key <key>                 Moonshot API key
  --no-install-daemon                      Skip gateway service install
  --node-manager <name>                    Node manager for skills: npm|pnpm|bun
  --non-interactive                        Run without prompts (default: false)
  --novita-api-key <key>                   NovitaAI API key
  --nvidia-api-key <key>                   NVIDIA API key
  --ollama-cloud-api-key <key>             Ollama Cloud API key
  --openai-api-key <key>                   OpenAI API Key
  --opencode-go-api-key <key>              OpenCode API key (Go catalog)
  --opencode-zen-api-key <key>             OpenCode API key (Zen catalog)
  --openrouter-api-key <key>               OpenRouter API key
  --pixverse-api-key <key>                 PixVerse API key
  --qianfan-api-key <key>                  QIANFAN API key
  --qwen-token-plan-api-key <key>          Qwen Token Plan API key (Global/Intl)
  --qwen-token-plan-api-key-cn <key>       Qwen Token Plan API key (China)
  --radius-api-key <key>                   Radius organization API key
  --remote-password <password>             Remote Gateway password (optional)
  --remote-token <token>                   Remote Gateway token (optional)
  --remote-url <url>                       Remote Gateway WebSocket URL
  --reset                                  Reset config + credentials + sessions before running onboard (workspace only with --reset-scope full)
  --reset-scope <scope>                    Reset scope: config|config+creds+sessions|full
  --runway-api-key <key>                   Runway API key
  --secret-input-mode <mode>               Credential persistence mode: plaintext|ref (default: plaintext)
  --skip-bootstrap                         Skip creating default agent workspace files
  --skip-channels                          Skip channel setup
  --skip-daemon                            Skip gateway service install
  --skip-health                            Skip health check
  --skip-hooks                             Skip hook setup
  --skip-search                            Skip search provider setup
  --skip-skills                            Skip skills setup
  --skip-ui                                Skip Control UI/TUI prompts
  --stepfun-api-key <key>                  StepFun API key
  --suppress-gateway-token-output          Disable the guided Control UI handoff
  --synthetic-api-key <key>                Synthetic API key
  --tailscale <mode>                       Tailscale: off|serve|funnel
  --team                                   Create a coordinator with researcher, writer, and reviewer specialists
  --telnyx-api-key <key>                   Telnyx API key
  --together-api-key <key>                 Together AI API key
  --token <token>                          Token value (non-interactive; used with --auth-choice token)
  --token-expires-in <duration>            Optional token expiry duration (e.g. 365d, 12h)
  --token-profile-id <id>                  Auth profile id (non-interactive; default: <provider>:manual)
  --token-provider <id>                    Token provider id (non-interactive; used with --auth-choice token)
  --tokenhub-api-key <key>                 Tencent TokenHub API key
  --tokenplan-api-key <key>                Tencent TokenPlan API key
  --tui                                    Use the terminal hatch instead of the browser handoff (default: false)
  --venice-api-key <key>                   Venice API key
  --volcengine-api-key <key>               Volcano Engine API key
  --vydra-api-key <key>                    Vydra API key
  --workspace <dir>                        Workspace proposal for guided setup; persisted by classic/non-interactive setup
  --xai-api-key <key>                      xAI API key
  --xiaomi-api-key <key>                   Xiaomi MiMo pay-as-you-go API key
  --xiaomi-token-plan-api-key <key>        Xiaomi MiMo Token Plan API key
  --zai-api-key <key>                      Z.AI API key

Commands:
  recommendations                          Read the app recommendations stored during onboarding

Docs: https://docs.openclaw.ai/cli/onboard
[exit 0]
```

```console
$ cd /home/probe/harness; echo ".openclaw/" >> .git/info/exclude; git status --porcelain; echo "(porcelain before setup, .openclaw excluded via .git/info/exclude)"; timeout 120 openclaw setup --baseline; echo rc=$?; git status --porcelain; ls -la; find .openclaw -maxdepth 2 -not -path "*/state/*"
(porcelain before setup, .openclaw excluded via .git/info/exclude)
Updated config: ~/harness/.openclaw/openclaw.json (set gateway.mode)
  Backup: ~/harness/.openclaw/openclaw.json.bak
Workspace OK: ~/harness
Sessions OK: ~/harness/.openclaw/agents/main/sessions

Setup complete: config, workspace, and session directories are ready.
Next guided path: openclaw onboard.
Next targeted changes: openclaw configure for models, channels, Gateway, plugins, skills, and health checks.
Add a chat channel later: openclaw channels add.
rc=0
?? IDENTITY.md
?? SOUL.md
?? USER.md
total 40
drwxr-xr-x 6 probe probe 4096 Oct  9 06:03 .
drwx------ 9 probe probe 4096 Oct  9 06:02 ..
drwxr-xr-x 2 probe probe 4096 Oct  9 05:59 .agents
drwxr-xr-x 3 probe probe 4096 Oct  9 05:59 .agro
drwxr-xr-x 8 probe probe 4096 Oct  9 06:03 .git
drwx------ 4 probe probe 4096 Oct  9 06:03 .openclaw
-rw-r--r-- 1 probe probe    8 Oct  9 05:59 AGENTS.md
-rw------- 1 probe probe 1401 Oct  9 06:03 IDENTITY.md
-rw------- 1 probe probe 1533 Oct  9 06:03 SOUL.md
-rw------- 1 probe probe 1137 Oct  9 06:03 USER.md
.openclaw
.openclaw/agents
.openclaw/agents/main
.openclaw/state
.openclaw/config-journal-fingerprint.key
.openclaw/openclaw.json.bak
.openclaw/openclaw.json
[exit 0]
```

```console
$ cd /home/probe/harness; git diff --stat; head -5 IDENTITY.md; cat .openclaw/openclaw.json | head -30; openclaw config schema > /tmp/schema.json; wc -c /tmp/schema.json; grep -o "\"[a-zA-Z]*[Bb]ootstrap[a-zA-Z]*\"" /tmp/schema.json | sort | uniq -c
# IDENTITY.md - Who Am I?

_Fill this in during your first conversation. Make it yours._

- **Name:**
{
  "agents": {
    "defaults": {
      "workspace": "/home/probe/harness"
    },
    "entries": {
      "main": {}
    }
  },
  "plugins": {
    "entries": {
      "anthropic": {
        "config": {
          "sessionCatalog": {
            "enabled": false
          }
        }
      },
      "codex": {
        "config": {
          "sessionCatalog": {
            "enabled": false
          }
        }
      }
    }
  },
  "meta": {
    "migrations": {
      "modelPolicyAllowlist": true,
2440959 /tmp/schema.json
      2 "bootstrapContextFiles"
      2 "bootstrapMaxChars"
      2 "bootstrapTotalMaxChars"
      1 "skipBootstrap"
      1 "skipOptionalBootstrapFiles"
[exit 0]
```

```console
$ node -e "
const s=require(\"/tmp/schema.json\");
function walk(o,p){ if(!o||typeof o!==\"object\")return; for(const [k,v] of Object.entries(o)){ if(/skipBootstrap|skipOptionalBootstrapFiles|bootstrapContextFiles/.test(k)) console.log(p+\".\"+k, JSON.stringify(v).slice(0,600)); walk(v,p+\".\"+k);} }
walk(s,\"\")"
.properties.agents.properties.defaults.properties.skipBootstrap {"type":"boolean","title":"Skip Workspace Bootstrap Creation","description":"Skips automatic creation of workspace bootstrap files, not injection of existing files. For the embedded runtime, set agents.defaults.contextInjection to \"never\" to disable injection unless overridden per agent."}
.properties.agents.properties.defaults.properties.skipOptionalBootstrapFiles {"type":"array","items":{"type":"string","enum":["SOUL.md","USER.md","HEARTBEAT.md","IDENTITY.md"]},"title":"Skipped Optional Bootstrap Files","description":"Optional bootstrap files that should not be created in agent workspaces. Valid values: SOUL.md, USER.md, IDENTITY.md (HEARTBEAT.md is accepted but a no-op)."}
.properties.channels.properties.discord.properties.voice.properties.realtime.properties.bootstrapContextFiles {"type":"array","items":{"type":"string","enum":["IDENTITY.md","USER.md","SOUL.md"]}}
.properties.channels.properties.discord.properties.accounts.additionalProperties.properties.voice.properties.realtime.properties.bootstrapContextFiles {"type":"array","items":{"type":"string","enum":["IDENTITY.md","USER.md","SOUL.md"]}}
[exit 0]
```

```console
$ openclaw config get agents.defaults.contextInjection 2>&1; node -e "const s=require(\"/tmp/schema.json\");console.log(JSON.stringify(s.properties.agents.properties.defaults.properties.contextInjection))"
Config path is valid but unset: agents.defaults.contextInjection. The runtime default applies until you set an authored value with openclaw config set agents.defaults.contextInjection <value>.
{"anyOf":[{"type":"string","const":"always"},{"type":"string","const":"continuation-skip"},{"type":"string","const":"never"}],"title":"Context Injection","description":"Controls workspace bootstrap-file injection in the embedded runtime: \"always\" uses normal injection (default), \"continuation-skip\" skips eligible continuation turns after a recorded full-bootstrap turn, and \"never\" disables injection. Does not control CLI-backed prompt preparation."}
[exit 0]
```

```console
$ cd /home/probe/harness; git clean -f; echo ".openclaw-*/" >> .git/info/exclude; git status --porcelain; echo "(clean)"; openclaw config set agents.defaults.workspace /home/probe/harness && openclaw config set agents.defaults.skipBootstrap true --strict-json && openclaw config get agents.defaults.skipBootstrap; openclaw setup --baseline; echo rc=$?; git status --porcelain; echo "(porcelain after setup --baseline with skipBootstrap=true)"
Removing IDENTITY.md
Removing SOUL.md
Removing USER.md
(clean)
Updated agents.defaults.workspace. Change will apply without restarting the gateway.
Updated agents.defaults.skipBootstrap. Change will apply without restarting the gateway.
true
Updated config: ~/harness/.openclaw-a/openclaw.json (set gateway.mode)
  Backup: ~/harness/.openclaw-a/openclaw.json.bak
Workspace OK: ~/harness
Sessions OK: ~/harness/.openclaw-a/agents/main/sessions

Setup complete: config, workspace, and session directories are ready.
Next guided path: openclaw onboard.
Next targeted changes: openclaw configure for models, channels, Gateway, plugins, skills, and health checks.
Add a chat channel later: openclaw channels add.
rc=0
(porcelain after setup --baseline with skipBootstrap=true)
[exit 0]
```

```console
$ cd /home/probe/harness; git status --porcelain; timeout 120 openclaw onboard --non-interactive --accept-risk --mode local --auth-choice skip --workspace /home/probe/harness --no-install-daemon --skip-channels --skip-health --skip-ui --skip-search --skip-skills --skip-hooks --gateway-bind loopback 2>&1 | tail -40; echo rc=${PIPESTATUS[0]}; git status --porcelain; echo "(porcelain after onboard --non-interactive, no skip-bootstrap)"; openclaw config get agents.defaults.workspace
Workspace OK: ~/harness
Sessions OK: ~/harness/.openclaw-b/agents/main/sessions
Updated config: ~/harness/.openclaw-b/openclaw.json
  Backup: ~/harness/.openclaw-b/openclaw.json.bak
Tip: run `openclaw configure --section web` to store your Brave API key for web_search. Docs: https://docs.openclaw.ai/tools/web
rc=0
?? IDENTITY.md
?? SOUL.md
?? USER.md
(porcelain after onboard --non-interactive, no skip-bootstrap)
/home/probe/harness
[exit 0]
```

```console
$ cd /home/probe/harness; git clean -f; git status --porcelain; echo "(clean)"; timeout 120 openclaw onboard --non-interactive --accept-risk --mode local --auth-choice skip --workspace /home/probe/harness --skip-bootstrap --no-install-daemon --skip-channels --skip-health --skip-ui --skip-search --skip-skills --skip-hooks --gateway-bind loopback 2>&1 | tail -8; echo rc=${PIPESTATUS[0]}; git status --porcelain; echo "(porcelain after onboard --non-interactive --skip-bootstrap)"; openclaw config get agents.defaults.skipBootstrap; openclaw config get agents.defaults.workspace
Removing IDENTITY.md
Removing SOUL.md
Removing USER.md
(clean)
Workspace OK: ~/harness
Sessions OK: ~/harness/.openclaw-c/agents/main/sessions
Updated config: ~/harness/.openclaw-c/openclaw.json
  Backup: ~/harness/.openclaw-c/openclaw.json.bak
Tip: run `openclaw configure --section web` to store your Brave API key for web_search. Docs: https://docs.openclaw.ai/tools/web
rc=0
(porcelain after onboard --non-interactive --skip-bootstrap)
true
/home/probe/harness
[exit 0]
```

```console
$ mkdir -p /home/probe/empty/ws; openclaw config set agents.defaults.workspace /home/probe/empty/ws >/dev/null; openclaw setup --baseline >/dev/null; echo rc=$?; ls -la /home/probe/empty/ws
rc=0
total 40
drwxr-xr-x 3 probe probe 4096 Oct  9 06:04 .
drwxr-xr-x 4 probe probe 4096 Oct  9 06:04 ..
drwxr-xr-x 7 probe probe 4096 Oct  9 06:04 .git
-rw------- 1 probe probe 6450 Oct  9 06:04 AGENTS.md
-rw------- 1 probe probe 7479 Oct  9 06:04 BOOTSTRAP.md
-rw------- 1 probe probe 1401 Oct  9 06:04 IDENTITY.md
-rw------- 1 probe probe 1533 Oct  9 06:04 SOUL.md
-rw------- 1 probe probe 1137 Oct  9 06:04 USER.md
[exit 0]
```

```console
$ cd /home/probe/harness; git status --porcelain; openclaw config set agents.defaults.workspace /home/probe/harness >/dev/null; openclaw config set agents.defaults.skipOptionalBootstrapFiles "[\"SOUL.md\",\"USER.md\",\"IDENTITY.md\"]" --strict-json; openclaw setup --baseline >/dev/null; echo rc=$?; git status --porcelain; echo "(porcelain with skipOptionalBootstrapFiles=[SOUL,USER,IDENTITY])"
Updated agents.defaults.skipOptionalBootstrapFiles. Change will apply without restarting the gateway.
rc=0
(porcelain with skipOptionalBootstrapFiles=[SOUL,USER,IDENTITY])
[exit 0]
```

```console
$ cd /home/probe/harness; openclaw skills --help | sed -n 1,40p; echo ----; openclaw skills list 2>&1 | head -80

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw skills [options] [command]

List and inspect available skills

Options:
  --agent <id>  Target agent workspace (defaults to cwd-inferred, then default
                agent)
  -h, --help    Display help for command
  --json        Output as JSON (default: false)

Commands:
  check         Check which skills are ready, visible, or missing requirements
  curator       Inspect skill usage and collection review outcomes
  info          Show detailed information about a skill
  install       Install a skill from ClawHub, git, or a local directory
  library       Manage authenticated personal and team skill libraries
  list          List all available skills
  search        Search ClawHub skills
  update        Update ClawHub-installed skills in the active or shared managed
                directory
  verify        Verify a ClawHub skill with ClawHub
  workshop      Manage pending skill proposals

Docs: https://docs.openclaw.ai/cli/skills

----
Skills (18/56 ready)
┌───────────────┬──────────────────────────┬───────────────────────────────────────────────────┬───────────────────────┐
│ Status        │ Skill                    │ Description                                       │ Source                │
├───────────────┼──────────────────────────┼───────────────────────────────────────────────────┼───────────────────────┤
│ △ needs setup │ 🔐 1password             │ Set up and use 1Password CLI for sign-in,         │ openclaw-bundled      │
│               │                          │ desktop integration, and reading or injecting     │                       │
│               │                          │ secrets.                                          │                       │
│ ✓ ready       │ add-model-provider       │ Add and live-prove a model provider with non-     │ openclaw-custodian    │
│               │                          │ interactive config one-liners, without exposing   │                       │
│               │                          │ credentials.                                      │                       │
│ △ needs setup │ 📝 apple-notes           │ Create, view, edit, delete, search, move, or      │ openclaw-bundled      │
│               │                          │ export Apple Notes via the memo CLI on macOS.     │                       │
│ △ needs setup │ ⏰ apple-reminders       │ List, add, edit, complete, or delete Apple        │ openclaw-bundled      │
│               │                          │ Reminders and reminder lists via remindctl.       │                       │
│ △ needs setup │ 🐻 bear-notes            │ Create, search, and manage Bear notes via         │ openclaw-bundled      │
│               │                          │ grizzly CLI.                                      │                       │
│ △ needs setup │ 📰 blogwatcher           │ Monitor blogs and RSS/Atom feeds for updates      │ openclaw-bundled      │
│               │                          │ using the blogwatcher CLI.                        │                       │
│ △ needs setup │ 🫐 blucli                │ BluOS CLI (blu) for discovery, playback,          │ openclaw-bundled      │
│               │                          │ grouping, and volume.                             │                       │
│ ✓ ready       │ browser-automation       │ Use when controlling web pages with the OpenClaw  │ openclaw-extra        │
│               │                          │ browser tool, especially multi-step flows, login  │                       │
│               │                          │ checks, tab management, or recovery from stale    │                       │
│               │                          │ refs/timeouts.                                    │                       │
│ △ needs setup │ 📸 camsnap               │ Capture frames or clips from RTSP/ONVIF cameras   │ openclaw-bundled      │
│               │                          │ and local webcams, including USB pan/tilt/zoom    │                       │
│               │                          │ control.                                          │                       │
│ ✓ ready       │ 🖼️ canvas                │ Present hosted widget documents on a connected    │ openclaw-extra        │
│               │                          │ macOS panel and control panel visibility or       │                       │
│               │                          │ navigation.                                       │                       │
│ ✓ ready       │ clawhub                  │ Search ClawHub for skills when a requested        │ openclaw-bundled      │
│               │                          │ capability is not already available; install,     │                       │
│               │                          │ verify, update, uninstall, publish, or sync       │                       │
│               │                          │ skills.                                           │                       │
│ ✓ ready       │ cloud-image-bake         │ Bake, select, prove, and safely retire a Cloud    │ openclaw-custodian    │
│               │                          │ Worker image with crabbox and config one-liners.  │                       │
│ △ needs setup │ 🧩 coding-agent          │ Delegate coding work to Codex, Claude Code, or    │ openclaw-bundled      │
│               │                          │ OpenCode as background workers; not simple edits  │                       │
│               │                          │ or read-only code lookup.                         │                       │
│ ✓ ready       │ configure-channel        │ Configure and prove a chat channel with non-      │ openclaw-custodian    │
│               │                          │ interactive one-liners; secrets only as           │                       │
│               │                          │ SecretRefs.                                       │                       │
│ ✓ ready       │ control-ui               │ Operate and troubleshoot the OpenClaw Control     │ openclaw-bundled      │
│               │                          │ UI: navigate connected clients, organize          │                       │
│               │                          │ sessions, build session dashboards, and handle    │                       │
│               │                          │ direct or Tailscale-hosted Gateways.              │                       │
│ ✓ ready       │ diagnose-gateway         │ Diagnose Gateway, config, secrets, channels, and  │ openclaw-custodian    │
│               │                          │ port failures with read-only one-liners.          │                       │
│ ✓ ready       │ 🧭 diagram-maker         │ Create SVG/HTML or Excalidraw diagrams for        │ openclaw-bundled      │
│               │                          │ concepts, architecture, flows, and whiteboards.   │                       │
│ △ needs setup │ 🛌 eightctl              │ Control Eight Sleep pods (status, temperature,    │ openclaw-bundled      │
│               │                          │ alarms, schedules).                               │                       │
│ △ needs setup │ ✨ gemini                │ Gemini CLI one-shot prompts, summaries,           │ openclaw-bundled      │
│               │                          │ generation, skills, hooks, MCP, or Gemma routing. │                       │
│ △ needs setup │ gh-issues                │ Fetch GitHub issues, select candidates, spawn     │ openclaw-bundled      │
│               │                          │ background fix agents, open PRs, and optionally   │                       │
│               │                          │ process PR review comments.                       │                       │
│ △ needs setup │ 🧲 gifgrep               │ Search GIF providers with CLI/TUI, download       │ openclaw-bundled      │
│               │                          │ results, and extract stills/sheets.               │                       │
│ △ needs setup │ 🐙 github                │ GitHub CLI for issues, PRs, CI/check logs,        │ openclaw-bundled      │
│               │                          │ comments, reviews, releases, repos, and gh api    │                       │
│               │                          │ queries.                                          │                       │
│ △ needs setup │ 🎮 gog                   │ Google Workspace CLI for Gmail, Calendar, Drive,  │ openclaw-bundled      │
│               │                          │ Contacts, Sheets, and Docs.                       │                       │
│ △ needs setup │ 📍 goplaces              │ Query Google Places for text search, place        │ openclaw-bundled      │
│               │                          │ details, resolve, reviews, or scriptable JSON     │                       │
│               │                          │ via goplaces.                                     │                       │
│ ✓ ready       │ healthcheck              │ Audit/harden OpenClaw hosts: SSH, firewall,       │ openclaw-bundled      │
│               │                          │ updates, exposure, backups, disk encryption,      │                       │
│               │                          │ gateway security.                                 │                       │
│ △ needs setup │ 📧 himalaya              │ Himalaya CLI for IMAP/SMTP mail: list, read,      │ openclaw-bundled      │
│               │                          │ search, compose, reply, forward, copy, move,      │                       │
│               │                          │ delete.                                           │                       │
│ △ needs setup │ 📦 mcporter              │ List, configure, authenticate, call, and inspect  │ openclaw-bundled      │
│               │                          │ MCP servers/tools with mcporter over HTTP or      │                       │
│               │                          │ stdio.                                            │                       │
│ ✓ ready       │ 🖼️ meme-maker            │ Search meme templates, suggest formats, and       │ openclaw-bundled      │
│               │                          │ generate local or hosted image memes.             │                       │
│ △ needs setup │ 📊 model-usage           │ Summarize CodexBar local cost logs by model for   │ openclaw-bundled      │
│               │                          │ Codex or Claude, including current or full        │                       │
[exit 0]
```

```console
$ cd /home/probe/harness; openclaw skills list --json 2>/dev/null | node -e "let d=\"\";process.stdin.on(\"data\",c=>d+=c).on(\"end\",()=>{const j=JSON.parse(d);const a=j.skills||j;console.log(\"total\",a.length);for(const s of a){if(/prd/.test(s.name)||!/^openclaw/.test(s.source||\"\"))console.log(JSON.stringify(s).slice(0,400))}})"; echo ---; openclaw skills info prd 2>&1 | head -20; echo ---; cd /tmp && openclaw skills list 2>&1 | grep -i "prd\|agents-skills\|workspace" | head
total 56
{"name":"prd","description":"test","eligible":true,"disabled":false,"blockedByAllowlist":false,"blockedByAgentFilter":false,"modelVisible":true,"userInvocable":true,"commandVisible":true,"source":"agents-skills-project","bundled":false,"missing":{"bins":[],"anyBins":[],"env":[],"config":[],"os":[]}}
---
prd ✓ Ready

test

Details:
  Source: agents-skills-project
  Path: ~/harness/.agents/skills/prd/SKILL.md
  Visible to model: yes
  Available as command: yes

Tip: use `openclaw skills search`, `openclaw skills install`, and `openclaw skills update` for ClawHub-backed skills.
---
│ △ needs setup │ 🎮 gog                   │ Google Workspace CLI for Gmail, Calendar, Drive,  │ openclaw-bundled      │
│ ✓ ready       │ prd                      │ test                                              │ agents-skills-project │
[exit 0]
```

```console
$ openclaw gateway run --help; openclaw config get gateway 2>&1; node -e "const s=require(\"/tmp/schema.json\");const g=s.properties.gateway.properties;console.log(\"bind:\",JSON.stringify(g.bind).slice(0,700));console.log(\"port:\",JSON.stringify(g.port).slice(0,300));console.log(\"mode:\",JSON.stringify(g.mode).slice(0,400))"

OpenClaw 2026.9.9 (bcfc888) — All your chats, one OpenClaw.

Usage: openclaw gateway run [options]

Run the WebSocket Gateway (foreground)

Options:
  --allow-unconfigured      Allow gateway start without enforcing
                            gateway.mode=local in config (does not repair
                            config) (default: false)
  --ambient-channels        Allow the gateway to auto-configure channels from
                            ambient environment variables (default: false)
  --auth <mode>             Gateway auth mode
                            ("none"|"token"|"password"|"trusted-proxy")
  --bind <mode>             Bind mode
                            ("loopback"|"lan"|"tailnet"|"auto"|"custom").
                            Defaults to config gateway.bind (or loopback).
  --claude-cli-logs         Deprecated alias for --cli-backend-logs (default:
                            false)
  --cli-backend-logs        Only show CLI backend logs in the console (includes
                            stdout/stderr) (default: false)
  --compact                 Alias for "--ws-log compact" (default: false)
  --dev                     Create a dev config + workspace if missing (no
                            BOOTSTRAP.md) (default: false)
  --dev-ambient-channels    Deprecated alias for --ambient-channels (default:
                            false)
  --force                   Kill any existing listener on the target port before
                            starting (default: false)
  -h, --help                Display help for command
  --password <password>     Password for auth mode=password
  --password-file <path>    Read gateway password from file
  --port <port>             Port for the gateway WebSocket
  --raw-stream              Log raw model stream events to jsonl (default:
                            false)
  --raw-stream-path <path>  Raw stream jsonl path
  --reset                   Reset dev config + credentials + sessions +
                            workspace (requires --dev) (default: false)
  --tailscale <mode>        Tailscale exposure mode ("off"|"serve"|"funnel")
  --token <token>           Shared token required in connect.params.auth.token
                            (default: OPENCLAW_GATEWAY_TOKEN env if set)
  --verbose                 Verbose logging to stdout/stderr (default: false)
  --ws-log <style>          WebSocket log style ("auto"|"full"|"compact")
                            (default: "auto")
{
  "mode": "local"
}
bind: {"anyOf":[{"type":"string","const":"auto"},{"type":"string","const":"lan"},{"type":"string","const":"loopback"},{"type":"string","const":"custom"},{"type":"string","const":"tailnet"}],"title":"Gateway Bind Mode","description":"Network bind profile: \"auto\", \"lan\", \"loopback\", \"custom\", or \"tailnet\" to control interface exposure. Keep \"loopback\" for local-only operation; \"auto\" can expose all interfaces."}
port: {"type":"integer","minimum":1,"maximum":65535,"title":"Gateway Port","description":"TCP port used by the gateway listener for API, control UI, and channel-facing ingress paths. Use a dedicated port and avoid collisions with reverse proxies or local developer services."}
mode: {"anyOf":[{"type":"string","const":"local"},{"type":"string","const":"remote"}],"title":"Gateway Mode","description":"Gateway operation mode: \"local\" runs channels and agent runtime on this host, while \"remote\" connects through remote transport. Keep \"local\" unless you intentionally run a split remote gateway topology."}
[exit 0]
```

```console
$ cd /home/probe/harness; ps -o pid,cmd -u probe | head; ls /run/systemd/system 2>&1; (timeout 20 openclaw gateway run > /tmp/gw.log 2>&1; echo "gateway exit=$?" >> /tmp/gw.log) & sleep 15; echo "--- listeners (/proc/net/tcp LISTEN, hex local addr) ---"; awk "NR>1 && \$4==\"0A\"{print \$2}" /proc/net/tcp /proc/net/tcp6; wait; echo "--- gateway log ---"; head -60 /tmp/gw.log; echo "--- porcelain after gateway ---"; git status --porcelain
bash: line 1: ps: command not found
ls: cannot access '/run/systemd/system': No such file or directory
--- listeners (/proc/net/tcp LISTEN, hex local addr) ---
--- gateway log ---
2026-10-09T06:05:04.234+00:00 [gateway] loading configuration…
2026-10-09T06:05:04.252+00:00 [gateway] resolving authentication…
2026-10-09T06:05:04.259+00:00 Refusing to bind gateway to auto without auth.
Container environment detected — the gateway defaults to bind=auto (0.0.0.0) for port-forwarding compatibility.
Set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD, or pass --token/--password *** start with auth.
gateway exit=78
--- porcelain after gateway ---
[exit 0]
```

```console
$ cd /home/probe/harness; (timeout 20 openclaw gateway run --bind loopback > /tmp/gw2.log 2>&1; echo "gateway exit=$?" >> /tmp/gw2.log) & sleep 17; echo "--- listeners ---"; awk "NR>1 && \$4==\"0A\"{print FILENAME, \$2}" /proc/net/tcp /proc/net/tcp6; wait; echo "--- gateway log ---"; head -60 /tmp/gw2.log; echo "--- porcelain after gateway ---"; git status --porcelain; openclaw config get gateway
--- listeners ---
/proc/net/tcp 0100007F:4965
/proc/net/tcp6 00000000000000000000000001000000:4965
--- gateway log ---
2026-10-09T06:05:23.726+00:00 [gateway] loading configuration…
2026-10-09T06:05:23.974+00:00 [gateway] resolving authentication…
2026-10-09T06:05:23.977+00:00 [gateway] starting...
2026-10-09T06:05:24.239+00:00 [gateway] shutdown budget at startup: drain=315000ms shutdown=325000ms reserve=10000ms exitMargin=5000ms; source=Gateway stop policy=330000ms
2026-10-09T06:05:24.332+00:00 [gateway] spawn broker ready pid=5401
2026-10-09T06:05:25.282+00:00 [gateway] auth token was missing. Generated a runtime token for this startup without changing config; restart will generate a different token. Persist one with `openclaw config set gateway.auth.mode token` and `openclaw config set gateway.auth.token <token>`.
2026-10-09T06:05:26.160+00:00 [gateway] runtime-only gateway auth paired the local CLI device before readiness
2026-10-09T06:05:26.189+00:00 [gateway] starting HTTP server...
2026-10-09T06:05:26.344+00:00 [health-monitor] started (interval: 300s, startup-grace: 60s, channel-connect-grace: 120s)
2026-10-09T06:05:27.030+00:00 [gateway] agent model: openai/gpt-6-astra (thinking=medium, fast=off)
2026-10-09T06:05:27.030+00:00 [gateway] http server listening (14 plugins: anthropic, browser, canvas, cua-computer, device-pair, file-transfer, geolocation, github, linux-node, memory-core, ollama, openai, talk-voice, xai; 2.8s)
2026-10-09T06:05:27.031+00:00 [gateway] log file: /tmp/openclaw/openclaw-2026-10-09.log
2026-10-09T06:05:27.031+00:00 [gateway] native runtime: {"pid":5322,"platform":"linux","arch":"x64","node":"24.21.0","v8":"13.6.233.17-node.53","uv":"1.52.1","openssl":"3.5.8","sqlite":"3.53.4"}
2026-10-09T06:05:27.031+00:00 [gateway] worker startup state: {"workerCount":3,"workerLifecycle":[{"script":"other","started":1,"retired":[{"reason":"exit","count":1}]},{"script":"sqlite-store.worker.js","started":1,"retired":[]},{"script":"openclaw-state-lease-heartbeat.worker.js","started":1,"retired":[]},{"script":"openclaw-state-read.worker.js","started":1,"retired":[]}],"compute":{"limit":31,"active":0,"waitingPools":0,"pendingTasks":0,"pendingBytes":0}}
2026-10-09T06:05:27.049+00:00 [gateway] starting channels and sidecars...
2026-10-09T06:05:27.587+00:00 [plugins] memory-core: created managed dreaming cron job.
2026-10-09T06:05:27.590+00:00 [gateway] startup outcomes: internal-hooks=skipped (not-configured); internal-startup-hook=skipped (no-handlers-loaded); gateway-start-hooks=scheduled; gmail-watcher=skipped (hooks-disabled); gmail-model=skipped (not-configured)
2026-10-09T06:05:27.595+00:00 [gateway] ready
2026-10-09T06:05:27.625+00:00 [heartbeat] started
2026-10-09T06:05:28.550+00:00 [gateway] remote model catalog downloaded; restart the Gateway to apply it
2026-10-09T06:05:39.395+00:00 [admission] closed: stop (SIGTERM)
2026-10-09T06:05:39.395+00:00 [gateway] received SIGTERM; shutting down
2026-10-09T06:05:39.400+00:00 [gateway] received SIGTERM during shutdown; ignoring
2026-10-09T06:05:39.402+00:00 [gateway] shutdown budget at shutdown: drain=315000ms shutdown=325000ms reserve=10000ms exitMargin=5000ms; source=Gateway stop policy=330000ms
2026-10-09T06:05:39.403+00:00 [gateway] active-work drain settled; beginning server close
2026-10-09T06:05:39.418+00:00 [gmail-watcher] gmail watcher stopped
2026-10-09T06:05:39.456+00:00 [shutdown] completed cleanly in 51ms
gateway exit=124
--- porcelain after gateway ---
{
  "mode": "local"
}
[exit 0]
```

```console
$ cd /home/probe/harness; git status --porcelain; openclaw config get agents.defaults.skipBootstrap; openclaw config set gateway.bind loopback >/dev/null && (timeout 20 openclaw gateway run > /tmp/gw3.log 2>&1; echo "gateway exit=$?" >> /tmp/gw3.log); grep -E "Refusing|listening|ready|exit=" /tmp/gw3.log; echo "--- porcelain after gateway (no skipBootstrap, gateway.bind=loopback via config) ---"; git status --porcelain; echo "--- HOME contents ---"; ls -A /home/probe
Config path is valid but unset: agents.defaults.skipBootstrap. The runtime default applies until you set an authored value with openclaw config set agents.defaults.skipBootstrap <value>.
2026-10-09T06:05:59.004+00:00 [gateway] spawn broker ready pid=5689
2026-10-09T06:06:01.568+00:00 [gateway] http server listening (14 plugins: anthropic, browser, canvas, cua-computer, device-pair, file-transfer, geolocation, github, linux-node, memory-core, ollama, openai, talk-voice, xai; 2.7s)
2026-10-09T06:06:02.094+00:00 [gateway] ready
gateway exit=124
--- porcelain after gateway (no skipBootstrap, gateway.bind=loopback via config) ---
--- HOME contents ---
.bash_logout
.bashrc
.cache
.local
.npm
.profile
empty
harness
noflag
noflag2
npm10
[exit 0]
```

```console
$ node -e "fetch(\"https://docs.openclaw.ai/concepts/agent-workspace\").then(r=>r.text()).then(t=>{t=t.replace(/<[^>]+>/g,\" \").replace(/\s+/g,\" \");for(const k of [\"skipBootstrap\",\"BOOTSTRAP.md\",\"TOOLS.md\",\"HEARTBEAT.md\"]){const i=t.indexOf(k);console.log(k,\"=>\",i<0?\"(not found)\":t.slice(Math.max(0,i-200),i+250))}})"
skipBootstrap =>  that resolve outside the source workspace are ignored.\n\u003c/Note\u003e\n\nIf you already manage the workspace files yourself, disable bootstrap file creation:\n\n```json5\n{ agents: { defaults: { skipBootstrap: true } } }\n```\n\n## Extra workspace folders\n\nOlder installs may have created `~/openclaw`. Each agent uses one resolved workspace; keeping extra directories does not merge their persona or memory files into the active workspace.\n\
BOOTSTRAP.md => imeline Plugin compatibility Plugin install overrides Channel outbound API Channel inbound API Channel ingress API Message presentation Templates Default AGENTS.md AGENTS.md template BOOT.md template BOOTSTRAP.md template IDENTITY template SOUL.md template USER template Dev agent templates AGENTS.dev template IDENTITY.dev template SOUL.dev template USER.dev template Retired workspace files Retired HEARTBEAT.md workspace file TOOLS.md retired Tech
TOOLS.md => Y template SOUL.md template USER template Dev agent templates AGENTS.dev template IDENTITY.dev template SOUL.dev template USER.dev template Retired workspace files Retired HEARTBEAT.md workspace file TOOLS.md retired Technical reference Agent runtime architecture OpenClaw agent runtime workflow @openclaw/ai package Token use and costs API usage and costs Usage tracking Prompt caching Session management deep dive Session management deep dive Sessi
HEARTBEAT.md => OOTSTRAP.md template IDENTITY template SOUL.md template USER template Dev agent templates AGENTS.dev template IDENTITY.dev template SOUL.dev template USER.dev template Retired workspace files Retired HEARTBEAT.md workspace file TOOLS.md retired Technical reference Agent runtime architecture OpenClaw agent runtime workflow @openclaw/ai package Token use and costs API usage and costs Usage tracking Prompt caching Session management deep dive Sessio
[exit 0]
```

## Teardown

```console
$ docker stop openclaw-probe-1362   # started with --rm
$ docker ps -a --filter name=openclaw-probe-1362
CONTAINER ID   IMAGE                 COMMAND                  CREATED         STATUS    PORTS     NAMES
72f8f79f714a   node:24-trixie-slim   "docker-entrypoint.s…"   7 minutes ago   Dead                openclaw-probe-1362
```
(header only: container removed)

Re-check after the brief "Dead" (removal in progress) state:
```console
$ docker ps -a --filter name=openclaw-probe-1362
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```
(state query by --format also returned: no such object)
