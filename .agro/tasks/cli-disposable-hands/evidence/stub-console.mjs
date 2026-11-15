import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const [port, logPath] = process.argv.slice(2);
const SSH_KEY_ID = "00000000-0000-4000-8000-000000000001";
const NODE_ID = "stub-node-1";

const RUNNING = {
  id: NODE_ID,
  status: "running",
  spec: "n4",
  orgIndex: 7,
  slug: "calm-lynx",
  ipv4: "192.0.2.10",
  ssh: null,
  sshHost: "hand-7.example",
};

function createNode(raw) {
  const body = JSON.parse(raw);
  if (body.profile === "agro" && body.disposable === true) {
    return {
      status: 422,
      body: { error: "Only sandbox nodes can be disposable", code: "DISPOSABLE_PROFILE_UNSUPPORTED" },
    };
  }
  return { status: 202, body: { id: NODE_ID, status: "queued" } };
}

function route(method, path, raw) {
  if (method === "POST" && path === "/api/nodes") return createNode(raw);
  if (method === "GET" && /^\/api\/nodes\/(stub-node-1|7)$/.test(path)) return { status: 200, body: RUNNING };
  if (method === "POST" && /^\/api\/nodes\/(stub-node-1|7)\/(pause|resume|fork)$/.test(path)) {
    return { status: 409, body: { error: "This node is disposable", code: "NODE_DISPOSABLE" } };
  }
  if (method === "GET" && path === "/api/ssh-keys") {
    return { status: 200, body: { sshKeys: [{ id: SSH_KEY_ID, name: "stub", publicKey: "ssh-ed25519 AAAAstub stub@review" }] } };
  }
  return { status: 404, body: { error: "Not found", code: "NOT_FOUND" } };
}

createServer((request, response) => {
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const path = new URL(request.url, "http://stub").pathname;
    const authorization = request.headers.authorization === undefined ? "none" : "Bearer <redacted>";
    const reply = route(request.method, path, raw);
    appendFileSync(logPath, `${request.method} ${path} auth=${authorization} body=${raw === "" ? "-" : raw} -> ${reply.status}\n`);
    response.writeHead(reply.status, { "content-type": "application/json" });
    response.end(JSON.stringify(reply.body));
  });
}).listen(Number(port), "127.0.0.1");
