# US-003 manual review: agro langfuse apply|status|disable on the host

- What: the worktree build of `agro langfuse apply`, `status`, and `disable`, each run with `HOME` set inline to a new temp directory.
- Where: the exe.dev VM host, not a container. Host `node` v24.22.1 ran the CLI directly, not through `agro run`.
- CLI build: `agro run -- pnpm run build:harness` in the task checkout (exit 0, `dist/agro.js 358.3kb`). Entry: `E=<task checkout>/.agro/cli/dist/agro.js` (package.json `bin.agro`).
- Commit: `2bdac268` on `feat/1602-langfuse-apply-current-env`.
- Inputs: cwd = main checkout `/home/exedev/.agro/workspaces/harness`. Its agro.json has `langfuse.enabled=true`, and its gitignored dotenv file holds the Langfuse keys. The reviewer did not read or print that file; only the CLI read it.

## Prior state

```
$ jq .langfuse agro.json
{
  "enabled": true,
  "baseUrl": "https://langfuse-dev.mifune.dev",
  "environment": "exedev",
  "userId": "exedev"
}
```

## Transcript (cwd = main checkout)

```
$ H=$(mktemp -d -u /tmp/agro-lf-home.XXXX); echo $H; test -e $H; echo exists=$?
/tmp/agro-lf-home.tIm1
exists=1

$ HOME=$H node $E langfuse apply; echo exit=$?
wrote     ~/.config/agro/langfuse.env
wrote     ~/.claude/settings.json
wrote     ~/.codex/langfuse.json
wrote     ~/.pi/agent/langfuse.json
exit=0

$ find $H -type f | sort
/tmp/agro-lf-home.tIm1/.claude/settings.json
/tmp/agro-lf-home.tIm1/.codex/langfuse.json
/tmp/agro-lf-home.tIm1/.config/agro/langfuse.env
/tmp/agro-lf-home.tIm1/.pi/agent/langfuse.json

$ HOME=$H node $E langfuse status; echo exit=$?
langfuse: enabled
  baseUrl:      https://langfuse-dev.mifune.dev
  environment:  exedev
  userId:       exedev
  LANGFUSE_PUBLIC_KEY: pk-lf*************************************
  LANGFUSE_SECRET_KEY: sk-lf*************************************
files:
  current  ~/.config/agro/langfuse.env
  current  ~/.claude/settings.json
  current  ~/.codex/langfuse.json
  current  ~/.pi/agent/langfuse.json
plugins:
  missing   Claude Code (langfuse-observability@langfuse-observability)
             claude plugin marketplace add langfuse/Claude-Observability-Plugin
             claude plugin install langfuse-observability@langfuse-observability
  missing   Codex (tracing@codex-observability-plugin)
             codex plugin marketplace add langfuse/codex-observability-plugin
             codex plugin add tracing@codex-observability-plugin
  missing   Pi (@langfuse/pi-observability-plugin)
             pi install npm:@langfuse/pi-observability-plugin
exit=0

$ HOME=$H node $E langfuse disable; echo exit=$?
agro.json: set langfuse.enabled=false (other langfuse settings and .env keys retained)
removed   ~/.config/agro/langfuse.env
unchanged ~/.claude/settings.json
wrote     ~/.codex/langfuse.json
unchanged ~/.pi/agent/langfuse.json
agro langfuse disable: warning: harnesses already running keep the LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL, LANGFUSE_TRACING_ENVIRONMENT, PI_LANGFUSE_MAX_CHARS values they loaded — restart every running harness session to stop tracing
exit=0

$ HOME=$H node $E langfuse status; echo exit=$?
langfuse: disabled
  baseUrl:      https://langfuse-dev.mifune.dev
  environment:  exedev
  userId:       exedev
  LANGFUSE_PUBLIC_KEY: pk-lf*************************************
  LANGFUSE_SECRET_KEY: sk-lf*************************************
files:
  absent   ~/.config/agro/langfuse.env
exit=0

$ jq .langfuse agro.json
{
  "enabled": false,
  "baseUrl": "https://langfuse-dev.mifune.dev",
  "environment": "exedev",
  "userId": "exedev"
}
```

The operator-only path guard refused the planned literal check `test -e $H/<fragment path>; echo fragment_exists=$?` because the command names the config directory. The check did not run, and the reviewer did not route around the guard. The CLI's own output shows the fragment removal instead: `disable` prints `removed` for the fragment, and the next `status` reports it `absent`.

## Restore and cleanup

```
$ node $E config set langfuse.enabled true; echo exit=$?
agro.json: set langfuse.enabled=true (updated)
exit=0

$ jq .langfuse agro.json
{
  "enabled": true,
  "baseUrl": "https://langfuse-dev.mifune.dev",
  "environment": "exedev",
  "userId": "exedev"
}

$ git -C /home/exedev/.agro/workspaces/harness diff agro.json
diff --git a/agro.json b/agro.json
index 067e494d..a77689ee 100644
--- a/agro.json
+++ b/agro.json
@@ -25,8 +25,10 @@
     "pullPolicy": "missing"
   },
   "langfuse": {
-    "enabled": false,
-    "baseUrl": "https://langfuse-dev.mifune.dev"
+    "enabled": true,
+    "baseUrl": "https://langfuse-dev.mifune.dev",
+    "environment": "exedev",
+    "userId": "exedev"
   },
   "composeOverrides": []
 }

$ rm -rf "$H"; test -e "$H"; echo temp_home_exists=$?
temp_home_exists=1
```

After the restore, the agro.json diff is identical to the diff before the run (same blob `a77689ee`): enabled true, environment exedev, userId exedev, baseUrl unchanged. The temp HOME is deleted. The reviewer wrote no env file and read no env file directly.
