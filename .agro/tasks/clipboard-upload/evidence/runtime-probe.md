# US-001 runtime probe

Recorded: 2026-11-12T06:28:12Z. Reader: the clipboard implementation advisor.
Scope: runtime evidence only. No clipboard service implementation or upload occurred.

## Execution boundary

Host execution directory: `/home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload`.
Branch: `feat/1612-clipboard-upload`.
The advisor supplied the healthy sandbox `clipboard-review-1612`.
The sandbox mounts this worktree at `/home/sandbox/harness`.

The following abbreviation names the task-built CLI, not the global CLI:

```bash
R=(node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 --)
```

All sandbox commands below used that prefix. Each command exited 0 unless stated otherwise.

| Check | Executed command | Result |
|---|---|---|
| Host marker | `test -f /etc/agro/sandbox` | Exit 1: absent. An earlier check of `/.agro-sandbox` was not authoritative. |
| Sandbox identity | `"${R[@]}" sh -lc 'id; pwd'` | UID/GID 1000, user `sandbox`; directory `/home/sandbox/harness`. |
| Sandbox marker | `"${R[@]}" node -e 'console.log(JSON.stringify(require("fs").readFileSync("/etc/agro/sandbox","utf8")))'` | Empty marker file exists. |
| Node | `"${R[@]}" node -v` | `v24.22.1`. |
| tmux | `"${R[@]}" tmux -V` | `tmux 3.5a`. |
| Installed entry point | `"${R[@]}" sh -lc 'command -v agro; readlink -f "$(command -v agro)"'` | `/usr/local/bin/agro` resolves to `/opt/agro/dist/agro.js`. |
| Task entry point | `"${R[@]}" node /home/sandbox/harness/.agro/cli/dist/agro.js --version` | `0.33.0`; realpath equals the supplied absolute path. |
| Storage environment | `"${R[@]}" sh -lc 'printf "HOME=%s AGRO_HOME=%s\n" "$HOME" "${AGRO_HOME:-unset}"'` | `HOME=/home/sandbox`; `AGRO_HOME=unset`. |

Source inspection: `.agro/cli/src/lib/execution/detect.ts` uses `/etc/agro/sandbox`.
The host has no marker. Do not start the upload listener on the host.
The global CLI lacks this task's `run --sandbox` support, despite the matching version string.
Use the task bundle for subsequent verification.

## Ports before startup

Executed on the host:

```bash
ss -ltnp '( sport = :3500 or sport = :3501 or sport = :3560 )'
```

Exit 0. Port 3500 belonged to `python3`, PID 504650, on `0.0.0.0`.
Port 3560 belonged to `python3`, PID 678534, on `0.0.0.0`.
Port 3501 had no listener. Neither Python process received a stop command.

Executed inside the sandbox before listener startup:

```bash
"${R[@]}" ss -ltnp
```

Exit 0. Only Docker DNS listened, at `127.0.0.11:40993`.
Sandbox port 3500 had no listener. Host occupancy does not occupy sandbox loopback.

## Temporary listener and browser route

The listener ran in sandbox tmux session `clipboard-us001-1612-listener`.
A Python `shlex.join` call quoted the Node command passed to `tmux new-session -d -s`.
The Node payload was:

```js
const http=require("node:http");
const server=http.createServer((q,r)=>{
  console.log(q.method+" "+q.url);
  r.writeHead(q.method==="GET"?200:405,{
    "Content-Type":"text/html",
    "Connection":"close",
    "Cache-Control":"no-store"
  });
  r.end("<!doctype html><title>US-001 sandbox probe</title><h1>Sandbox loopback verified</h1><p>clipboard-review-1612 / 127.0.0.1:3500</p>");
});
server.listen(3500,"127.0.0.1",()=>console.log("probe ready pid="+process.pid));
```

Startup exited 0. Sandbox `ss -ltnp '( sport = :3500 )'` showed `127.0.0.1:3500`, PID 611.
No wildcard listener or container port publication was necessary.

The first host TCP relay attempt returned `net::ERR_EMPTY_RESPONSE`; browser navigation exited 1.
Its connector processes exited 0. The worker closed the failed browser session and relay session before retry.
Source inspection found that `DockerComposeTarget.execArgv` omits Docker's interactive stdin flag for `exec`.
Therefore, this CLI route cannot carry raw request bytes through inherited stdin.
The worker made no production change for that limitation.

The successful replacement was a temporary GET-only HTTP relay.
It ran as `node /tmp/clipboard-us001-1612-relay.cjs` in host tmux session `clipboard-us001-1612-relay`.
The relay bound only `127.0.0.1:3501`, PID 972845.
For each GET, it spawned the task CLI with this sandbox connector:

```js
require("node:http").get({
  host:"127.0.0.1",port:3500,path:process.argv[1],
  headers:{Connection:"close"}
},r=>{
  r.pipe(process.stdout);
  r.on("end",()=>process.exit(0));
}).on("error",()=>process.exit(1));
```

The relay passed the request path as a separate argument after `node -e`.
The relay piped connector stdout to the browser response and rejected non-GET methods with HTTP 405.
The probe relay supplies HTML response headers itself. The probe relay is not a production upload proxy.

Browser preflight and verification used only the unique session `clipboard-us001-1612-probe`:

```bash
command -v agent-browser && agent-browser --version
agent-browser --session clipboard-us001-1612-probe open about:blank
agent-browser --session clipboard-us001-1612-probe snapshot -c
agent-browser --session clipboard-us001-1612-probe set viewport 1280 720
agent-browser --session clipboard-us001-1612-probe open http://127.0.0.1:3501
agent-browser --session clipboard-us001-1612-probe snapshot -c
agent-browser --session clipboard-us001-1612-probe get title
agent-browser --session clipboard-us001-1612-probe get url
```

All successful-attempt commands exited 0. Browser version: `0.38.1`.
The preflight rendered an empty `about:blank` page.
Navigation rendered title `US-001 sandbox probe` at `http://127.0.0.1:3501/`.
The accessibility snapshot contained heading `Sandbox loopback verified`, level 1.
The sandbox listener logged `GET /`; the host relay logged `GET / connector exit=0`.
These browser results, not curl, establish browser access through the forwarding route.
This read-only probe required no screenshot.

Forwarding implications, reasoned: the VM browser can use host loopback 3501.
An operator's browser on another machine needs an explicit private forwarding hop to that host port.
The worker did not execute a remote-laptop browser hop. The worker created no public route or cloud resource.
A future upload proxy must preserve methods, bodies, authentication, origins, and response status.
The GET-only relay proves reachability, not upload behavior or production proxy suitability.
Keep the eventual service bound to sandbox loopback.

## Absolute image-path visibility

Executed through `"${R[@]}" node -e`: create a temporary private-home directory with `fs.mkdtempSync`.
Write a 68-byte PNG with mode `0600`.
Read the same absolute path after `process.chdir` to `/home/sandbox/harness`.
Repeat the read after `process.chdir` to `/tmp`.
Remove the file with `fs.unlinkSync` and the directory with `fs.rmdirSync`.
The command exited 0 and reported:

```text
fixture=/home/sandbox/.clipboard-us001-1612-pVf600/image.png
cwd=/home/sandbox/harness bytes=68
cwd=/tmp bytes=68
sha256=fabb0b2403d1b256801a0e23cb8744df8295e4d0cfe813e023e8a3ddec7a4074
fixture removed=true
```

Both reads produced that SHA-256 digest.
Sandbox `test -e /home/exedev/.agro/workspaces/harness/.worktrees/feat/1612-clipboard-upload` exited 1.
Host `test ! -e /home/sandbox/harness/.agro/cli/dist/agro.js` exited 0.
The host and sandbox do not share absolute path names automatically.

Contract, reasoned: agents in another worktree can read an absolute image path only within the same accessible filesystem namespace.
Changing the working directory does not alter an absolute path.
Separate worktree project IDs can scope storage without preventing explicit absolute-path reads.
An isolated `agro run` target needs an explicit shared mount or image transfer, including the manifest.
A copied manifest alone does not transfer its image files or translate absolute paths.
The worker created no second sandbox or worktree to test that reasoning.
The image-capable agent must open every image with its image-reading tool.
This filesystem probe does not prove visual model input from a path alone.

## Cleanup and criterion disposition

Executed cleanup commands, each exit 0:

```bash
agent-browser --session clipboard-us001-1612-probe close
tmux kill-session -t clipboard-us001-1612-relay
"${R[@]}" tmux kill-session -t clipboard-us001-1612-listener
rm /tmp/clipboard-us001-1612-relay.cjs
```

The initial failed relay/session also received their own close and exact-session kill commands.
Final verification:

| Command | Exit and result |
|---|---|
| `"${R[@]}" ss -ltnp '( sport = :3500 )'` | 0; no listener. |
| `"${R[@]}" ps -u sandbox -o pid,ppid,args` | 0; only the inspection shell and `ps`; no probe or connector. |
| `"${R[@]}" tmux has-session -t clipboard-us001-1612-listener` | 1; absent. |
| `tmux has-session -t clipboard-us001-1612-relay` | 1; absent. |
| `ss -ltnp '( sport = :3500 or sport = :3501 or sport = :3560 )'` | 0; port 3501 absent; original Python listeners and PIDs unchanged. |
| `ps -p 972157,972845 -o pid,args` | 1; both relay processes absent. |
| `test ! -e /tmp/clipboard-us001-1612-relay.cjs` | 0; removed. |
| `agent-browser --session clipboard-us001-1612-probe session list` | 0; no active sessions. |

| US-001 criterion | Disposition |
|---|---|
| Marker, versions, bundle, browser route | Executed; recorded above. |
| Default port before startup | Executed in both namespaces; unrelated host listeners preserved. |
| Browser to temporary sandbox loopback listener | Executed with rendered browser title and heading through host loopback relay. |
| Image visibility across worktrees and targets | Executed same-namespace path reads; reasoned namespace and transfer contract above. |
| Cleanup and lifecycle restraint | Executed cleanup; no sandbox lifecycle commands or cloud provisioning. |

## Affected surfaces

- Host and sandbox: applied; git and private relay on host, listener and filesystem verification in sandbox.
- Lifecycle door: applied; existing task-built `agro run --sandbox` only; no lifecycle changes.
- Canonical and provider surfaces: not applicable; no source or provider mirror changes.
- Root and scaffold: not applicable; no generated project changes.
- Interactive and headless processes: applied; named tmux sessions for both temporary services.
- Local and remote operation: applied; private VM route verified; remote operator hop remains explicit setup.
- Parallel operation: applied; assigned worktree, unique sessions, unrelated listeners preserved.
- Public documentation: not applicable; US-005 owns documentation changes.
- Verification: applied; runtime and browser checks above. The advisor supplied the passing baseline; this worker did not rerun it.

Only this evidence file belongs to the worker commit.
The pre-existing `prd.json` change adds `pr: 1613`; the worker left that change unstaged and unchanged.
No push occurred. No production file changed.
