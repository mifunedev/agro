# Manual review: agro self-upgrade

Tested commit: `b0009b5b3c70e4c11f28cf6717311aee35ec27b0` on branch `task/1651-simplify-self-upgrade`. This commit includes the US-002 repair `6b830ec9`.

Location: host, local. The commands run from the worktree root with host `node` v24.22.1. The steps create no live or remote resource and write no env file.

`$TMP` is the temp directory from step 1. Its real path is `/tmp/claude-1000/su-review2.yxvr`. The output keeps the real path. Each command ran on its own. The `exit=` line under each output shows the exit code of that command.

## 0. Build the branch CLI

```bash
agro run -- pnpm --dir .agro/cli run build
git rev-parse HEAD
node .agro/cli/dist/agro.js --version
```

```text
  dist/agro.js  436.4kb
⚡ Done in 107ms
exit=0
b0009b5b3c70e4c11f28cf6717311aee35ec27b0
exit=0
0.39.0
exit=0
```

## 1. Create a new temp directory

The `ls` command shows that no `su-review2` directory exists before `mktemp`.

```bash
ls -d /tmp/claude-1000/su-review2.*
TMP=$(mktemp -d /tmp/claude-1000/su-review2.XXXX); echo "TMP=$TMP"
```

```text
ls: cannot access '/tmp/claude-1000/su-review2.*': No such file or directory
exit=2
TMP=/tmp/claude-1000/su-review2.yxvr
```

## 2. npm-shaped path

### 2a. Dry run under the global prefix

The command copies the built file into an npm global layout under `$TMP/npm`. The inline `npm_config_prefix=$TMP/npm` makes `npm prefix -g` report `$TMP/npm`, so the global-prefix check passes. The real global npm prefix stays unchanged. The step uses `--dry-run` only, so no global npm install occurs.

```bash
mkdir -p $TMP/npm/lib/node_modules/@mifune/agro/dist && cp .agro/cli/dist/agro.js $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js
npm_config_prefix=$TMP/npm npm prefix -g
npm_config_prefix=$TMP/npm node $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js self-upgrade --dry-run
npm_config_prefix=$TMP/npm node $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js update --dry-run
```

```text
exit=0
/tmp/claude-1000/su-review2.yxvr/npm
exit=0
agro update: [dry-run] would run npm i -g @mifune/agro@latest
exit=0
agro update: [dry-run] would run npm i -g @mifune/agro@latest
exit=0
```

The `update` alias prints the same line as `self-upgrade`.

### 2b. Refusal outside the global prefix

Failure path: without `npm_config_prefix`, the global npm prefix is not `$TMP/npm`. The command refuses the copy.

```bash
npm prefix -g
node $TMP/npm/lib/node_modules/@mifune/agro/dist/agro.js self-upgrade --dry-run
```

```text
/home/exedev/.local/share/fnm/node-versions/v24.22.1/installation
exit=0
agro update: cannot upgrade /tmp/claude-1000/su-review2.yxvr/npm/lib/node_modules/@mifune/agro/dist/agro.js; its prefix /tmp/claude-1000/su-review2.yxvr/npm is not the global npm prefix /home/exedev/.local/share/fnm/node-versions/v24.22.1/installation
exit=1
```

## 3. Standalone path with a local HTTP server

Prerequisites: a target `$TMP/bin/agro` with an absolute node shebang and mode `755`, and three artifacts in `$TMP/srv`:

- `newer.js` is a stub artifact that prints `0.40.0`. This stub is not a release.
- `same.js` is a copy of the build that prints `0.39.0`.
- `older.js` is a stub artifact that prints `0.38.0`.

```bash
mkdir -p $TMP/bin $TMP/srv && { echo "#!$(readlink -f "$(command -v node)")"; tail -n +2 .agro/cli/dist/agro.js; } > $TMP/bin/agro && chmod 0755 $TMP/bin/agro
printf "#!/usr/bin/env node\nconsole.log(\"0.40.0\")\n" > $TMP/srv/newer.js && cp .agro/cli/dist/agro.js $TMP/srv/same.js && printf "#!/usr/bin/env node\nconsole.log(\"0.38.0\")\n" > $TMP/srv/older.js
head -1 $TMP/bin/agro; stat -c %a $TMP/bin/agro; head -1 $TMP/srv/same.js; cat $TMP/srv/newer.js $TMP/srv/older.js
```

```text
exit=0
exit=0
#!/home/exedev/.local/share/fnm/node-versions/v24.22.1/installation/bin/node
755
#!/usr/bin/env node
#!/usr/bin/env node
console.log("0.40.0")
#!/usr/bin/env node
console.log("0.38.0")
exit=0
```

Examine port 18766 before the server starts. The empty output and `exit=1` show that no process listens on port 18766.

```bash
ss -ltn | grep :18766
```

```text
exit=1
```

Start the local HTTP server in the background.

```bash
nohup python3 -m http.server 18766 --bind 127.0.0.1 --directory $TMP/srv > $TMP/server.log 2>&1 &
echo PID=$!; echo $! > $TMP/server.pid
ss -ltn | grep :18766
```

```text
PID=1181546
LISTEN 0      0          127.0.0.1:18766      0.0.0.0:*
```

Each run in 3a, 3b, and 3c sets `AGRO_JS_URL` inline to an artifact on the local server.

### 3a. Same version

The command reports the current version and keeps the target. The checksum before and after is the same.

```bash
sha256sum $TMP/bin/agro
AGRO_JS_URL=http://127.0.0.1:18766/same.js node $TMP/bin/agro self-upgrade
sha256sum $TMP/bin/agro
```

```text
e95e4bd3b58f195397412d324d9560f7dc266b92067ddd6f5c474e5a194aedc4  /tmp/claude-1000/su-review2.yxvr/bin/agro
exit=0
agro update: already current (0.39.0)
exit=0
e95e4bd3b58f195397412d324d9560f7dc266b92067ddd6f5c474e5a194aedc4  /tmp/claude-1000/su-review2.yxvr/bin/agro
exit=0
```

### 3b. Lower version

Failure path: the command refuses to downgrade. The checksum stays the same, and no temp file stays in `$TMP/bin`.

```bash
AGRO_JS_URL=http://127.0.0.1:18766/older.js node $TMP/bin/agro self-upgrade
sha256sum $TMP/bin/agro
ls -A $TMP/bin
```

```text
agro update: http://127.0.0.1:18766/older.js offers 0.38.0, lower than the running 0.39.0; refusing to downgrade
exit=1
e95e4bd3b58f195397412d324d9560f7dc266b92067ddd6f5c474e5a194aedc4  /tmp/claude-1000/su-review2.yxvr/bin/agro
exit=0
agro
exit=0
```

### 3c. Higher version

The command replaces the target with the `newer.js` stub artifact. The pinned absolute node shebang stays, the mode is `755`, and no temp file stays in `$TMP/bin`. The new target prints `0.40.0`. The server log shows one download for each run.

```bash
AGRO_JS_URL=http://127.0.0.1:18766/newer.js node $TMP/bin/agro self-upgrade
head -1 $TMP/bin/agro
stat -c %a $TMP/bin/agro
ls -A $TMP/bin
$TMP/bin/agro
cat $TMP/server.log
```

```text
agro update: upgraded /tmp/claude-1000/su-review2.yxvr/bin/agro to 0.40.0
exit=0
#!/home/exedev/.local/share/fnm/node-versions/v24.22.1/installation/bin/node
exit=0
755
exit=0
agro
exit=0
0.40.0
exit=0
127.0.0.1 - - [16/Nov/2026 01:56:08] "GET /same.js HTTP/1.1" 200 -
127.0.0.1 - - [16/Nov/2026 01:56:08] "GET /older.js HTTP/1.1" 200 -
127.0.0.1 - - [16/Nov/2026 01:56:08] "GET /newer.js HTTP/1.1" 200 -
exit=0
```

Stop the server and confirm that it stopped.

```bash
kill $(cat $TMP/server.pid)
kill -0 1181546
ss -ltn | grep :18766
```

```text
exit=0
bash: line 1: kill: (1181546) - No such process
exit=1
exit=1
```

## 4. Refusals

### 4a. Symlink

After step 3c, `$TMP/bin/agro` holds the stub artifact, so a link to that stub does not run the CLI. The link points to a new copy of the build at `$TMP/real/agro`. The target name is `agro`, so the command refuses because `argv[1]` is a symlink.

```bash
mkdir -p $TMP/real $TMP/link && cp .agro/cli/dist/agro.js $TMP/real/agro && ln -s $TMP/real/agro $TMP/link/agro && ls -l $TMP/link
node $TMP/link/agro self-upgrade
```

```text
total 0
lrwxrwxrwx 1 exedev exedev 42 Nov 16 01:56 agro -> /tmp/claude-1000/su-review2.yxvr/real/agro
exit=0
agro update: cannot upgrade /tmp/claude-1000/su-review2.yxvr/real/agro; upgrade it with the mechanism that installed it
exit=1
```

### 4b. Checkout dist/agro.js

The command refuses a file that no supported installer created.

```bash
node .agro/cli/dist/agro.js self-upgrade
```

```text
agro update: cannot upgrade /home/exedev/.agro/workspaces/harness/.worktrees/task/1651-simplify-self-upgrade/.agro/cli/dist/agro.js; upgrade it with the mechanism that installed it
exit=1
```

### 4c. Missing path

Node cannot load a missing file, so the CLI does not start and does not print its refusal line. Node exits with `MODULE_NOT_FOUND`. The output below removes the eight stack-frame lines. The unit tests in `.agro/cli/src/__tests__/self-upgrade.test.ts` cover the refusal line with the `realpath` cause.

```bash
node $TMP/missing/agro self-upgrade
```

```text
node:internal/modules/cjs/loader:1568
  throw err;
  ^

Error: Cannot find module '/tmp/claude-1000/su-review2.yxvr/missing/agro'
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}

Node.js v24.22.1
exit=1
```

## 5. No star prompt

The empty output and `exit=1` show that no star prompt code or documentation stays.

```bash
git grep -n -i "star-prompt\|StarPrompt\|STAR_PROMPT" -- .agro/cli/src docs
```

```text
exit=1
```

## 6. Cleanup

Delete the temp directory and confirm that the temp directory is gone. The server stopped in step 3.

```bash
rm -rf $TMP
ls -d $TMP
```

```text
exit=0
ls: cannot access '/tmp/claude-1000/su-review2.yxvr': No such file or directory
exit=2
```
