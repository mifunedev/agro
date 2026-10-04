# US-001 spike: clipboard read after a copy-button click

Date: 2026-10-04. Branch: `feat/1332-us-001`.

## Environment

- `agent-browser 0.38.1`, bundled Chrome `154.0.8037.92`.
- Node `v22.23.3` (global `WebSocket`).
- `DISPLAY=:0`. `/tmp/.X11-unix/X0` exists. Headed mode launched a real window: `navigator.userAgent` had `Chrome/154.0.0.0`, not `HeadlessChrome`.
- `agent-browser` has no permission-grant command. `agent-browser set --help` lists no permission setting. `agent-browser get cdp-url` gives the browser CDP endpoint.

## Fixture and origin

- Fixture: `.agro/skills/agent-browser/scripts/tests/fixtures/copy-button.html`. One button `#copy` calls `navigator.clipboard.writeText("agro-copy-check")`. No network.
- Origin for candidates a to d: `http://127.0.0.1:18732/copy-button.html`, served by `python3 -m http.server 18732 --bind 127.0.0.1` in tmux session `ab1332-http`. The session was killed after the spike.
- `window.isSecureContext` returned `true` on `http://127.0.0.1`.
- `file://` also returned `isSecureContext` `true`. On `file://`, a plain `clipboard read` failed the same way (exit 1, `Read permission denied`), and the capture (d) returned `"agro-copy-check"`. A test can use `file://` and needs no server.
- Every run used `--session ab1332` and ended with `agent-browser --session ab1332 close`.

## Results

| # | Candidate | Exit of read | Output of read | Returns text |
|---|---|---|---|---|
| a | `clipboard read` after click, no flag | 1 | `✗ Evaluation error: NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied.` | no |
| b1 | `--args "--enable-features=ClipboardReadWrite"` | 1 | same `Read permission denied` | no |
| b2 | `--args "--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:18732"` | 1 | same `Read permission denied` | no |
| b3 | `--args "--enable-experimental-web-platform-features"` | 1 | same `Read permission denied` | no |
| c | `--headed` | 1 | `✗ CDP command timed out: Runtime.evaluate` | no |
| e1 | CDP grant, client disconnects before the read | 1 | same `Read permission denied` | no |
| e2 | CDP grant, client stays connected during the read | 0 | `agro-copy-check` | **yes** |
| d | page-side `writeText` capture | 0 | `"agro-copy-check"` | **yes** |

### a. No launch flag

```
$ agent-browser --session ab1332 open http://127.0.0.1:18732/copy-button.html
[agent-browser] launched browser
✓ Copy fixture
exit=0
$ agent-browser --session ab1332 eval 'window.isSecureContext'
true
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 clipboard read
✗ Evaluation error: NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied.
exit=1
$ agent-browser --session ab1332 eval 'navigator.clipboard.readText().then(t=>t,e=>"ERR "+e)'
"ERR NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied."
exit=0
$ agent-browser --session ab1332 eval 'navigator.clipboard.writeText("probe").then(()=>"ok",e=>"ERR "+e)'
"ok"
exit=0
```

Writes succeed. Reads fail. `navigator.permissions.query({name:"clipboard-read"})` returned `"prompt"`.

### b. Launch flags

Flag sources:

- `--args` is documented in `agent-browser --help`: "Browser launch args, comma or newline separated".
- `--enable-features=<Feature>` is a documented Chromium switch. `ClipboardReadWrite` is not a documented Chromium feature name. Mark it experimental. `chrome://version` showed that agent-browser merged it into its own list: `--enable-features=NetworkService,NetworkServiceInProcess,WebMCPTesting,DevToolsWebMCPSupport,ClipboardReadWrite`.
- `--unsafely-treat-insecure-origin-as-secure` is a documented Chromium switch (Chromium command-line switch list). It does not apply here: the origin is already secure.
- `--enable-experimental-web-platform-features` is a documented Chromium switch (`chrome://flags` "Experimental Web Platform features").

```
$ agent-browser --session ab1332 --args --enable-features=ClipboardReadWrite open http://127.0.0.1:18732/copy-button.html
✓ Copy fixture
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 clipboard read
✗ Evaluation error: NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied.
exit=1
```

`--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:18732` and `--enable-experimental-web-platform-features` gave the same three results: open exit 0, click exit 0, read exit 1 with `Read permission denied`.

### c. Headed mode

```
$ agent-browser --session ab1332 --headed open http://127.0.0.1:18732/copy-button.html
✓ Copy fixture
exit=0
$ agent-browser --session ab1332 eval 'navigator.userAgent'
"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 clipboard read
✗ CDP command timed out: Runtime.evaluate
exit=1
```

The display works. The read blocks. The likely cause is the clipboard-read permission prompt in the visible window. No agent can answer that prompt.

### e. Explicit permission grant through CDP

agent-browser exposes no grant command. The grant used `Browser.grantPermissions` with `["clipboardReadWrite","clipboardSanitizedWrite"]` for the origin, on the default context and on each page browser context, through the URL from `agent-browser get cdp-url`. `Browser.setPermission` with `clipboard-read` and `clipboard-write` set to `granted` behaved the same.

e1. The grant client exits before the read:

```
$ node grant.mjs ws://127.0.0.1:39867/devtools/browser/<id> http://127.0.0.1:18732
grant default {}
grant EA1BB5F808C429C50D76D74DBD3CF17B {}
exit=0
$ agent-browser --session ab1332 eval 'navigator.permissions.query({name:"clipboard-read"}).then(p=>p.state)'
"prompt"
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 clipboard read
✗ Evaluation error: NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied.
exit=1
```

e2. The grant client stays connected (the script closes its WebSocket after 15 s):

```
$ node grant-hold.mjs "$(agent-browser --session ab1332 get cdp-url)" http://127.0.0.1:18732 &
grant default {}
grant 7502F4E334D4996C5520EFC6BA8B1101 {}
holding
$ agent-browser --session ab1332 eval 'navigator.permissions.query({name:"clipboard-read"}).then(p=>p.state)'
"granted"
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 clipboard read
agro-copy-check
exit=0
# after the grant client closed its WebSocket:
$ agent-browser --session ab1332 eval 'navigator.permissions.query({name:"clipboard-read"}).then(p=>p.state)'
"prompt"
exit=0
$ agent-browser --session ab1332 clipboard read
✗ Evaluation error: NotAllowedError: Failed to execute 'readText' on 'Clipboard': Read permission denied.
exit=1
```

Chromium resets a CDP permission override when the DevTools client that set it disconnects. This explains the failed grant in mifunedev/agro-console#275: the grant client exited before the read.

`grant-hold.mjs` (scratch, not committed):

```js
const [url, origin] = process.argv.slice(2);
const ws = new WebSocket(url);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
ws.onopen = async () => {
  const ctx = await send('Target.getBrowserContexts');
  const targets = await send('Target.getTargets');
  const ids = new Set([undefined, ...(ctx.result?.browserContextIds || []), ...targets.result.targetInfos.map(t => t.browserContextId)]);
  for (const b of ids) {
    const r = await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], ...(b ? { browserContextId: b } : {}) });
    console.log('grant', b ?? 'default', JSON.stringify(r.error ?? r.result));
  }
  console.log("holding"); setTimeout(() => ws.close(), 15000);
};
```

### d. Page-side capture

```
$ agent-browser --session ab1332 open http://127.0.0.1:18732/copy-button.html
✓ Copy fixture
exit=0
$ agent-browser --session ab1332 eval 'const w = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = (t) => { window.__agroCopied = t; return w(t); }; "wrapped"'
"wrapped"
exit=0
$ agent-browser --session ab1332 click '#copy'
✓ Done
exit=0
$ agent-browser --session ab1332 eval 'window.__agroCopied'
"agro-copy-check"
exit=0
dom-hash before=954a178978c39cf3 after=954a178978c39cf3
png-hash before=d48f0893689be3cf after=d48f0893689be3cf
```

The capture does not change the visible page. The `document.documentElement.outerHTML` hash and the screenshot hash are the same before the wrap and after the click. The wrapper still calls the real `writeText`.

## Decision

Method that returns `agro-copy-check`: **direct read with a held CDP grant (e2)**. It uses no launch flag. It reads the real clipboard, so it also proves that `writeText` resolved.

1. `agent-browser --session <s> open <fixture-url>`
2. Start a CDP client on `agent-browser --session <s> get cdp-url` that calls `Browser.grantPermissions` with `clipboardReadWrite` and `clipboardSanitizedWrite` for the page origin and keeps its WebSocket open.
3. `agent-browser --session <s> click '#copy'`
4. `agent-browser --session <s> clipboard read` → `agro-copy-check`, exit 0.
5. Stop the CDP client. `agent-browser --session <s> close`.

Cost: step 2 needs a helper script and a background process. That is more than 3 commands, so the PRD rule allows a wrapper script.

Fallback: **page-side capture (d)**. It uses 3 agent-browser commands, no helper, and no launch flag, and it does not change the visible page. Limit: it proves the argument that the page passed to `writeText`, not that the write succeeded. The capture does not see a copy that uses `document.execCommand("copy")` or `ClipboardItem` through `navigator.clipboard.write`.

Not usable: launch flags (b) and headed mode (c).
