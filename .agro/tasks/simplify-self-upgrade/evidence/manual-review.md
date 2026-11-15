# Manual review: agro self-upgrade

Tested commit: `a17e8030d9ca532799e611a5c59220874fa26259` on branch `task/1651-simplify-self-upgrade`.

Location: host, local. The commands run from the worktree root with host `node` v24.22.1. The steps create no live or remote resource.

`$TMP` is the temp directory from step 1. Its real path is `/tmp/claude-1000/su-review.R6t6`. The output keeps the real path.

## 0. Build the branch CLI

```bash
agro run -- pnpm --dir .agro/cli run build; echo exit=$?
node .agro/cli/dist/agro.js --version; echo exit=$?
git rev-parse HEAD
head -1 .agro/cli/dist/agro.js
```

```text
  dist/agro.js  433.8kb
⚡ Done in 184ms
exit=0
0.39.0
exit=0
a17e8030d9ca532799e611a5c59220874fa26259
#!/usr/bin/env node
```

## 1. Create a new temp directory

The `ls` command shows that no `su-review` directory exists before `mktemp`.

```bash
ls -d /tmp/claude-1000/su-review.*
TMP=$(mktemp -d /tmp/claude-1000/su-review.XXXX); echo "TMP=$TMP"
```

```text
ls: cannot access '/tmp/claude-1000/su-review.*': No such file or directory
TMP=/tmp/claude-1000/su-review.R6t6
```

## 2. Dry run for an npm-shaped path

The command copies the built file into an npm global layout. The step uses `--dry-run` only, so no global npm install occurs.

```bash
mkdir -p $TMP/npm/lib/node_modules/@mifune/agro/dist
cp .agro/cli/dist/agro.js $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js
node $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js self-upgrade --dry-run; echo exit=$?
```

```text
agro update: [dry-run] would run npm i -g --prefix /tmp/claude-1000/su-review.R6t6/npm @mifune/agro@latest
exit=0
```

## 3. Standalone upgrade with a pinned shebang

Prerequisites: a target `$TMP/bin/agro` with an absolute node shebang, and an artifact `$TMP/srv/agro.js` with the `#!/usr/bin/env node` shebang.

```bash
mkdir -p $TMP/bin $TMP/srv
{ echo "#!$(readlink -f "$(command -v node)")"; tail -n +2 .agro/cli/dist/agro.js; } > $TMP/bin/agro && chmod 0755 $TMP/bin/agro
cp .agro/cli/dist/agro.js $TMP/srv/agro.js
head -1 $TMP/bin/agro; head -1 $TMP/srv/agro.js; stat -c %a $TMP/bin/agro
```

```text
#!/home/exedev/.local/share/fnm/node-versions/v24.22.1/installation/bin/node
#!/usr/bin/env node
755
```

Examine port 18765 before the server starts. The empty output and `grep_exit=1` show that no process listens on port 18765.

```bash
ss -ltn | grep :18765; echo grep_exit=$?
```

```text
grep_exit=1
```

Start the local HTTP server in the background.

```bash
nohup python3 -m http.server 18765 --bind 127.0.0.1 --directory $TMP/srv > $TMP/server.log 2>&1 &
echo PID=$!; echo $! > $TMP/server.pid
ss -ltn | grep :18765
```

```text
PID=1168103
LISTEN 0      0          127.0.0.1:18765      0.0.0.0:*
```

Run the dry run, then the upgrade. Each run sets `AGRO_JS_URL` inline.

```bash
AGRO_JS_URL=http://127.0.0.1:18765/agro.js node $TMP/bin/agro self-upgrade --dry-run; echo exit=$?
AGRO_JS_URL=http://127.0.0.1:18765/agro.js node $TMP/bin/agro self-upgrade; echo exit=$?
```

```text
agro update: [dry-run] would download http://127.0.0.1:18765/agro.js over /tmp/claude-1000/su-review.R6t6/bin/agro
exit=0
agro update: upgraded /tmp/claude-1000/su-review.R6t6/bin/agro to 0.39.0
exit=0
```

Inspect the target. The pinned shebang stays, the mode is `755`, and no temp file stays in `$TMP/bin`. The server log shows one artifact download.

```bash
head -1 $TMP/bin/agro
stat -c %a $TMP/bin/agro
ls -A $TMP/bin
$TMP/bin/agro --version; echo exit=$?
cat $TMP/server.log
```

```text
#!/home/exedev/.local/share/fnm/node-versions/v24.22.1/installation/bin/node
755
agro
0.39.0
exit=0
127.0.0.1 - - [15/Nov/2026 21:06:52] "GET /agro.js HTTP/1.1" 200 -
```

Stop the server and confirm that it stopped.

```bash
kill $(cat $TMP/server.pid); echo kill_exit=$?
kill -0 1168103; echo kill0_exit=$?
ss -ltn | grep :18765; echo grep_exit=$?
```

```text
kill_exit=0
/bin/bash: line 1: kill: (1168103) - No such process
kill0_exit=1
grep_exit=1
```

## 4. Refusal of a checkout dist/agro.js

Failure path: the command refuses a file that no supported installer created.

```bash
node .agro/cli/dist/agro.js self-upgrade; echo exit=$?
```

```text
agro update: cannot upgrade /home/exedev/.agro/workspaces/harness/.worktrees/task/1651-simplify-self-upgrade/.agro/cli/dist/agro.js; upgrade it with the mechanism that installed it
exit=1
```

## 5. The update alias

This run occurred directly after step 2, in the same temp directory. The output is the same as the output of step 2.

```bash
node $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js update --dry-run; echo exit=$?
```

```text
agro update: [dry-run] would run npm i -g --prefix /tmp/claude-1000/su-review.R6t6/npm @mifune/agro@latest
exit=0
```

## 6. No star prompt

The empty output and `exit=1` show that no star prompt code or documentation stays.

```bash
git grep -n -i "star-prompt\|StarPrompt\|STAR_PROMPT" -- .agro/cli/src docs; echo exit=$?
```

```text
exit=1
```

## 7. Cleanup

Delete the temp directory and confirm that the temp directory is gone. The commands write no env file.

```bash
rm -rf $TMP
ls -d $TMP; echo exit=$?
```

```text
ls: cannot access '/tmp/claude-1000/su-review.R6t6': No such file or directory
exit=2
```
