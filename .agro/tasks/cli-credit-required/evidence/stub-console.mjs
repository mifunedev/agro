import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const [port, logPath, scenario] = process.argv.slice(2);
const SSH_KEY_ID = "00000000-0000-4000-8000-000000000001";

const createScenarios = {
  "402-eligible": { refusal: credit402(), eligible: true, retry: queued() },
  "402-not-eligible": { refusal: credit402(), eligible: false, retry: queued() },
  "403-eligible": { refusal: payments403(), eligible: true, retry: queued() },
  "failed-retry": {
    refusal: credit402(),
    eligible: true,
    retry: { status: 403, body: { error: "a free node is live", code: "FREE_TIER_INELIGIBLE" } },
  },
};

const account = { hasCard: false, paymentsEnabled: true, canManage: true, autoTopup: null };
const autoTopup = { amountUsd: 20, thresholdUsd: 5 };
const balanceScenarios = {
  "payments-off": { status: 200, body: { ...account, balanceMicros: 0, paymentsEnabled: false } },
  "balance-positive": { status: 200, body: { ...account, balanceMicros: 12_345_678 } },
  "balance-positive-auto-topup": { status: 200, body: { ...account, balanceMicros: 12_345_678, autoTopup } },
  "balance-zero": { status: 200, body: { ...account, balanceMicros: 0 } },
  "balance-negative-auto-topup": { status: 200, body: { ...account, balanceMicros: -40_000, autoTopup } },
  "balance-404": { status: 404, body: { error: "Not found", code: "NOT_FOUND" } },
};

function credit402() {
  return { status: 402, body: { error: "Add credit to create a paid node.", code: "CREDIT_REQUIRED" } };
}

function payments403() {
  return { status: 403, body: { error: "Payments are not available yet. Use the free tier.", code: "PAYMENTS_DISABLED" } };
}

function queued() {
  return { status: 202, body: { id: "stub-node-1", status: "queued" } };
}

let nodePosts = 0;

function route(method, path) {
  const create = createScenarios[scenario];
  if (method === "POST" && path === "/api/nodes" && create !== undefined) {
    nodePosts += 1;
    return nodePosts === 1 ? create.refusal : create.retry;
  }
  if (method === "GET" && path === "/api/free-tier") {
    return { status: 200, body: { eligible: create?.eligible ?? true } };
  }
  if (method === "GET" && path === "/api/nodes/stub-node-1") {
    return { status: 200, body: { id: "stub-node-1", status: "running", spec: "n4", ipv4: "192.0.2.10", ssh: null } };
  }
  if (method === "GET" && path === "/api/ssh-keys") {
    return { status: 200, body: { sshKeys: [{ id: SSH_KEY_ID, name: "stub", publicKey: "ssh-ed25519 AAAAstub stub@review" }] } };
  }
  if (method === "GET" && path === "/api/billing/balance" && balanceScenarios[scenario] !== undefined) {
    return balanceScenarios[scenario];
  }
  return { status: 404, body: { error: "Not found", code: "NOT_FOUND" } };
}

createServer((request, response) => {
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const path = new URL(request.url, "http://stub").pathname;
    const authorization = request.headers.authorization === undefined ? "none" : "Bearer <redacted>";
    const reply = route(request.method, path);
    appendFileSync(logPath, `${request.method} ${path} auth=${authorization} body=${raw === "" ? "-" : raw} -> ${reply.status}\n`);
    response.writeHead(reply.status, { "content-type": "application/json" });
    response.end(JSON.stringify(reply.body));
  });
}).listen(Number(port), "127.0.0.1");
