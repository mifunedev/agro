#!/usr/bin/env node
import { spawn } from "node:child_process";

const USAGE = "usage: clipboard-read.mjs --session <name>";
const PERMISSIONS = ["clipboardReadWrite", "clipboardSanitizedWrite"];

class Failure extends Error {}

function parseSession(argv) {
  if (argv.length !== 2 || argv[0] !== "--session" || !argv[1]) return null;
  return argv[1];
}

function agentBrowser(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("agent-browser", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) =>
      reject(new Failure(error.code === "ENOENT" ? "agent-browser not found in PATH" : error.message)),
    );
    child.on("close", (status) => resolve({ status, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function agentBrowserValue(args) {
  const result = await agentBrowser(args);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).split("\n").pop();
    throw new Failure(`agent-browser ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout;
}

async function assertActive(session) {
  const listing = JSON.parse(await agentBrowserValue(["--json", "session", "list"]));
  if (!listing.data?.sessions?.includes(session)) throw new Failure(`no active agent-browser session: ${session}`);
}

function grantOrigin(pageUrl) {
  const url = new URL(pageUrl);
  if (url.protocol === "file:") return "file://";
  if (url.origin === "null") throw new Failure(`page has no origin to grant: ${pageUrl}`);
  return url.origin;
}

function connect(cdpUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(cdpUrl);
    const pending = new Map();
    let nextId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const settle = pending.get(message.id);
      if (!settle) return;
      pending.delete(message.id);
      settle(message);
    };
    socket.onerror = () => reject(new Failure(`cannot connect to CDP at ${cdpUrl}`));
    socket.onopen = () =>
      resolve({
        socket,
        send: (method, params = {}) =>
          new Promise((settle) => {
            const id = ++nextId;
            pending.set(id, settle);
            socket.send(JSON.stringify({ id, method, params }));
          }),
      });
  });
}

async function grant(cdp, origin) {
  const contexts = await cdp.send("Target.getBrowserContexts");
  const targets = await cdp.send("Target.getTargets");
  const contextIds = new Set([
    undefined,
    ...(contexts.result?.browserContextIds ?? []),
    ...(targets.result?.targetInfos ?? []).map((target) => target.browserContextId),
  ]);
  for (const browserContextId of contextIds) {
    const reply = await cdp.send("Browser.grantPermissions", {
      origin,
      permissions: PERMISSIONS,
      ...(browserContextId ? { browserContextId } : {}),
    });
    if (reply.error) throw new Failure(`Browser.grantPermissions failed: ${reply.error.message}`);
  }
}

async function main() {
  const session = parseSession(process.argv.slice(2));
  if (!session) {
    console.error(USAGE);
    return 2;
  }
  await assertActive(session);
  const origin = grantOrigin(await agentBrowserValue(["--session", session, "get", "url"]));
  const cdp = await connect(await agentBrowserValue(["--session", session, "get", "cdp-url"]));
  try {
    await grant(cdp, origin);
    const read = await agentBrowser(["--session", session, "clipboard", "read"]);
    if (read.status !== 0) throw new Failure(`clipboard read failed: ${(read.stderr || read.stdout).split("\n").pop()}`);
    process.stdout.write(`${read.stdout}\n`);
    return 0;
  } finally {
    cdp.socket.close();
  }
}

main().then(
  (status) => process.exit(status),
  (error) => {
    console.error(`clipboard-read: ${error instanceof Failure ? error.message : String(error)}`);
    process.exit(1);
  },
);
