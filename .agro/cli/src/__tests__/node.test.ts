import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONSOLE_CONFIG_MISSING,
  DEFAULT_CONSOLE_URL,
  NODE_READY_TIMEOUT_MS,
  resolveConsoleConfig,
  runNode,
  type NodeDeps,
} from "../commands/node.js";
import { COMPOSE_SECRET_KEYS, readSecret, SECRET_KEYS } from "../lib/secrets.js";

const TOKEN = "mfc_secret_token_value";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function projectWithEnv(content: string): string {
  const root = mkdtempSync(join(tmpdir(), "agro-node-"));
  cleanups.push(root);
  mkdirSync(join(root, ".agro"), { recursive: true });
  writeFileSync(join(root, ".env"), content);
  return root;
}

describe("console config resolution", () => {
  it("registers the console keys as secrets that Compose never passes", () => {
    expect(SECRET_KEYS).toContain("AGRO_CONSOLE_URL");
    expect(SECRET_KEYS).toContain("AGRO_CONSOLE_TOKEN");
    expect(COMPOSE_SECRET_KEYS as readonly string[]).not.toContain("AGRO_CONSOLE_URL");
    expect(COMPOSE_SECRET_KEYS as readonly string[]).not.toContain("AGRO_CONSOLE_TOKEN");
  });

  it("prefers the environment over the .env fallback", () => {
    const root = projectWithEnv("AGRO_CONSOLE_URL=https://file.example\nAGRO_CONSOLE_TOKEN=mfc_file\n");
    const config = resolveConsoleConfig(
      { AGRO_CONSOLE_URL: "https://env.example/", AGRO_CONSOLE_TOKEN: TOKEN },
      (key) => readSecret(root, key),
    );
    expect(config).toEqual({ url: "https://env.example", token: TOKEN });
  });

  it("falls back to the project .env through readSecret", () => {
    const root = projectWithEnv("AGRO_CONSOLE_URL=https://file.example\nAGRO_CONSOLE_TOKEN=mfc_file\n");
    const config = resolveConsoleConfig({ AGRO_CONSOLE_URL: "" }, (key) => readSecret(root, key));
    expect(config).toEqual({ url: "https://file.example", token: "mfc_file" });
  });

  it("uses the default URL when AGRO_CONSOLE_URL is unset in the environment and .env", () => {
    const root = projectWithEnv("AGRO_CONSOLE_TOKEN=mfc_file\n");
    expect(DEFAULT_CONSOLE_URL).toBe("https://console.mifune.dev");
    expect(resolveConsoleConfig({}, (key) => readSecret(root, key))).toEqual({
      url: "https://console.mifune.dev",
      token: "mfc_file",
    });
    expect(resolveConsoleConfig({ AGRO_CONSOLE_URL: " ", AGRO_CONSOLE_TOKEN: TOKEN }, () => undefined)).toEqual({
      url: DEFAULT_CONSOLE_URL,
      token: TOKEN,
    });
  });

  it("prefers the environment URL, then the .env URL, then the default", () => {
    const root = projectWithEnv("AGRO_CONSOLE_URL=https://file.example//\n");
    const fromFile = (key: "AGRO_CONSOLE_URL" | "AGRO_CONSOLE_TOKEN") => readSecret(root, key);
    expect(resolveConsoleConfig({ AGRO_CONSOLE_URL: "https://env.example/", AGRO_CONSOLE_TOKEN: TOKEN }, fromFile)?.url).toBe(
      "https://env.example",
    );
    expect(resolveConsoleConfig({ AGRO_CONSOLE_TOKEN: TOKEN }, fromFile)?.url).toBe("https://file.example");
    expect(resolveConsoleConfig({ AGRO_CONSOLE_TOKEN: TOKEN }, () => undefined)?.url).toBe(DEFAULT_CONSOLE_URL);
  });

  it("returns undefined when the token is missing", () => {
    const root = projectWithEnv("AGRO_CONSOLE_URL=https://file.example\n");
    expect(resolveConsoleConfig({}, (key) => readSecret(root, key))).toBeUndefined();
    expect(resolveConsoleConfig({}, () => undefined)).toBeUndefined();
    expect(CONSOLE_CONFIG_MISSING).toBe("set AGRO_CONSOLE_TOKEN, or run agro secret set AGRO_CONSOLE_TOKEN");
    expect(CONSOLE_CONFIG_MISSING).not.toContain("AGRO_CONSOLE_URL");
  });
});

interface Recorded {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status: number; body?: unknown };

function harness(replies: Reply[], overrides: Partial<NodeDeps> = {}) {
  const calls: Recorded[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const reply = replies.length > 1 ? replies.shift()! : replies[0];
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const deps: Partial<NodeDeps> = {
    fetch: fetchStub,
    env: { AGRO_CONSOLE_URL: "https://console.example/", AGRO_CONSOLE_TOKEN: TOKEN },
    readSecret: () => undefined,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    timeoutMs: 15 * 60 * 1000,
    ...overrides,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return {
    calls,
    sleeps,
    io,
    deps,
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    all: () => out.join("") + err.join(""),
  };
}

const CREATE_ARGS = ["create", "--spec", "small", "--ssh-key", "key-1", "--ssh-key", "key-2", "--name", "box"];

describe("agro node create", () => {
  it("posts a sandbox node with the bearer token and polls until running", async () => {
    const h = harness([
      { status: 202, body: { node: { id: "n1", status: "provisioning" } } },
      { status: 200, body: { id: "n1", status: "booting", ipv4: null, ssh: null } },
      { status: 200, body: { id: "n1", status: "running", ipv4: "1.2.3.4", ssh: null } },
    ]);
    const code = await runNode(CREATE_ARGS, h.io, h.deps);
    expect(code).toBe(0);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      url: "https://console.example/api/nodes",
      body: { profile: "sandbox", spec: "small", sshKeyIds: ["key-1", "key-2"], name: "box" },
    });
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://console.example/api/nodes/n1",
      "GET https://console.example/api/nodes/n1",
    ]);
    expect(h.calls[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.sleeps).toEqual([1000, 1000]);
    expect(h.stdout()).toContain("n1");
    expect(h.stdout()).toContain("running");
    expect(h.stdout()).toContain("ssh sandbox@1.2.3.4");
    expect(h.all()).not.toContain(TOKEN);
  });

  it("prints the ssh field from the console when present", async () => {
    const h = harness([
      { status: 202, body: { id: "n2", status: "running", ipv4: "1.2.3.4", ssh: "ssh sandbox@node.example" } },
      { status: 200, body: { id: "n2", status: "running", ipv4: "1.2.3.4", ssh: "ssh sandbox@node.example" } },
    ]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(0);
    expect(h.stdout()).toContain("ssh sandbox@node.example");
  });

  it("exits 1 with the id and last status when the node fails", async () => {
    const h = harness([
      { status: 202, body: { id: "n3", status: "provisioning" } },
      { status: 200, body: { id: "n3", status: "failed" } },
    ]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.all()).toContain("n3");
    expect(h.all()).toContain("failed");
  });

  it.each(["retired", "destroy_requested"])("exits 1 when the node reaches %s", async (status) => {
    const h = harness([
      { status: 202, body: { id: "n7", status: "queued" } },
      { status: 200, body: { id: "n7", status: "waiting_for_ip" } },
      { status: 200, body: { id: "n7", status } },
    ]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(3);
    expect(h.all()).toContain("n7");
    expect(h.all()).toContain(status);
  });

  it("exits 1 with the id and last status after the time limit", async () => {
    const h = harness(
      [
        { status: 202, body: { id: "n4", status: "provisioning" } },
        { status: 200, body: { id: "n4", status: "booting" } },
      ],
      { pollDelayMs: () => 60_000, timeoutMs: 15 * 60 * 1000 },
    );
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.sleeps.reduce((a, b) => a + b, 0)).toBe(15 * 60 * 1000);
    expect(h.all()).toContain("n4");
    expect(h.all()).toContain("booting");
  });

  it("polls every second for the first 30 seconds, then every 5 seconds", async () => {
    const h = harness([
      { status: 202, body: { id: "n5", status: "provisioning" } },
      ...Array.from({ length: 32 }, () => ({ status: 200, body: { id: "n5", status: "booting" } })),
      { status: 200, body: { id: "n5", status: "running", ipv4: "1.2.3.4" } },
    ]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(0);
    expect(h.sleeps).toEqual([...Array<number>(30).fill(1000), 5000, 5000, 5000]);
  });

  it("keeps the 15-minute limit with the default poll schedule", async () => {
    const h = harness([
      { status: 202, body: { id: "n6", status: "provisioning" } },
      { status: 200, body: { id: "n6", status: "booting" } },
    ]);
    delete h.deps.timeoutMs;
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(NODE_READY_TIMEOUT_MS).toBe(15 * 60 * 1000);
    expect(h.sleeps.reduce((a, b) => a + b, 0)).toBe(NODE_READY_TIMEOUT_MS);
    expect(h.sleeps.filter((ms) => ms === 1000)).toHaveLength(30);
    expect(h.sleeps.slice(30).every((ms) => ms === 5000)).toBe(true);
    expect(h.all()).toContain("is not running after 15 minutes");
  });

  it("prints the HTTP status and code field on an API error", async () => {
    const h = harness([{ status: 400, body: { error: "spec is invalid", code: "INVALID_SPEC" } }]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("400");
    expect(h.stderr()).toContain("INVALID_SPEC");
    expect(h.calls).toHaveLength(1);
  });

  it("prints the HTTP status and code field when a poll fails", async () => {
    const h = harness([
      { status: 202, body: { id: "n5", status: "provisioning" } },
      { status: 500, body: { error: "boom", code: "INTERNAL" } },
    ]);
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("500");
    expect(h.stderr()).toContain("INTERNAL");
  });

  it("prints one JSON object with --json", async () => {
    const h = harness([
      { status: 202, body: { id: "n6", status: "provisioning" } },
      { status: 200, body: { id: "n6", status: "running", ipv4: "5.6.7.8", ssh: null } },
    ]);
    expect(await runNode([...CREATE_ARGS, "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ id: "n6", status: "running", ssh: "ssh sandbox@5.6.7.8" });
  });

  it("sends freeTier true with --free-tier", async () => {
    const h = harness([{ status: 202, body: { id: "f1", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1", "--free-tier"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"], freeTier: true });
  });

  it("sends no freeTier key without --free-tier", async () => {
    const h = harness([{ status: 202, body: { id: "f2", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).not.toHaveProperty("freeTier");
  });

  it("defaults the spec to n4 with --free-tier", async () => {
    const h = harness([{ status: 202, body: { id: "f3", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--free-tier", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toMatchObject({ spec: "n4", freeTier: true });
  });

  it("sends a spec other than n4 with --free-tier unchanged", async () => {
    const h = harness([{ status: 202, body: { id: "f4", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--free-tier", "--spec", "small", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toMatchObject({ spec: "small", freeTier: true });
  });

  it("prints the HTTP status and code when payments are disabled", async () => {
    const h = harness([
      {
        status: 403,
        body: { error: "Payments are not available yet. Use the free tier.", code: "PAYMENTS_DISABLED" },
      },
    ]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(
      "agro node create: HTTP 403 PAYMENTS_DISABLED: Payments are not available yet. Use the free tier.",
    );
    expect(h.calls).toHaveLength(1);
  });

  it("requires --spec and --ssh-key", async () => {
    const h = harness([{ status: 202, body: {} }]);
    expect(await runNode(["create", "--ssh-key", "k"], h.io, h.deps)).toBe(1);
    expect(await runNode(["create", "--spec", "small"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(0);
  });

  it("exits 1 with the token message when the token is missing", async () => {
    const h = harness([{ status: 202, body: {} }], { env: { AGRO_CONSOLE_URL: "https://console.example" } });
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(CONSOLE_CONFIG_MISSING);
    expect(h.all()).not.toContain(TOKEN);
    expect(h.calls).toHaveLength(0);
  });
});

const NODES = [
  { id: "n1", name: "alpha", profile: "sandbox", status: "running", ipv4: "1.2.3.4", ssh: "ssh sandbox@1.2.3.4" },
  { id: "n2", name: "beta", profile: "desktop", status: "provisioning", ipv4: null, ssh: null },
];

describe("agro node list", () => {
  it("prints one row per node with id, name, profile, status, and IPv4", async () => {
    const h = harness([{ status: 200, body: NODES }]);
    expect(await runNode(["list"], h.io, h.deps)).toBe(0);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "GET", url: "https://console.example/api/nodes" });
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const rows = h.stdout().trimEnd().split("\n").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].split(/\s+/)).toEqual(["n1", "alpha", "sandbox", "running", "1.2.3.4"]);
    expect(rows[1].split(/\s+/)).toEqual(["n2", "beta", "desktop", "provisioning", "-"]);
  });

  it("accepts a wrapped node list and prints JSON with --json", async () => {
    const h = harness([{ status: 200, body: { nodes: NODES } }]);
    expect(await runNode(["list", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual([
      { id: "n1", name: "alpha", profile: "sandbox", status: "running", ipv4: "1.2.3.4" },
      { id: "n2", name: "beta", profile: "desktop", status: "provisioning", ipv4: null },
    ]);
  });

  it("prints the HTTP status and code field on an API error", async () => {
    const h = harness([{ status: 401, body: { error: "unauthorized", code: "UNAUTHORIZED" } }]);
    expect(await runNode(["list"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("401");
    expect(h.stderr()).toContain("UNAUTHORIZED");
  });

  it("calls the default console URL when AGRO_CONSOLE_URL is unset", async () => {
    const h = harness([{ status: 200, body: [] }], { env: { AGRO_CONSOLE_TOKEN: TOKEN } });
    expect(await runNode(["list"], h.io, h.deps)).toBe(0);
    expect(h.calls[0]).toMatchObject({ method: "GET", url: "https://console.mifune.dev/api/nodes" });
  });

  it("exits 1 with the token message when the token is missing", async () => {
    const h = harness([{ status: 200, body: [] }], { env: {} });
    expect(await runNode(["list"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(CONSOLE_CONFIG_MISSING);
    expect(h.calls).toHaveLength(0);
  });
});

describe("agro node delete", () => {
  it("asks for confirmation, then sends DELETE", async () => {
    const questions: string[] = [];
    const h = harness([{ status: 202, body: { id: "n1", status: "destroying" } }], {
      confirm: async (q) => {
        questions.push(q);
        return true;
      },
    });
    expect(await runNode(["delete", "n1"], h.io, h.deps)).toBe(0);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain("n1");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "DELETE", url: "https://console.example/api/nodes/n1" });
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.all()).not.toContain(TOKEN);
  });

  it("sends nothing when the operator declines", async () => {
    const h = harness([{ status: 202, body: {} }], { confirm: async () => false });
    expect(await runNode(["delete", "n1"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(0);
  });

  it("skips the confirmation with --yes", async () => {
    let asked = false;
    const h = harness([{ status: 204 }], {
      confirm: async () => {
        asked = true;
        return false;
      },
    });
    expect(await runNode(["delete", "n1", "--yes"], h.io, h.deps)).toBe(0);
    expect(asked).toBe(false);
    expect(h.calls.map((c) => c.method)).toEqual(["DELETE"]);
  });

  it("explains a 403 as the admin role requirement", async () => {
    const h = harness([{ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }]);
    expect(await runNode(["delete", "n1", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("destroy needs the admin role in agro-console");
  });

  it("requires exactly one node id", async () => {
    const h = harness([{ status: 204 }]);
    expect(await runNode(["delete", "--yes"], h.io, h.deps)).toBe(1);
    expect(await runNode(["delete", "a", "b", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(0);
  });

  it("exits 1 with the token message when the token is missing", async () => {
    const h = harness([{ status: 204 }], { env: { AGRO_CONSOLE_URL: "https://console.example" } });
    expect(await runNode(["delete", "n1", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(CONSOLE_CONFIG_MISSING);
    expect(h.calls).toHaveLength(0);
  });
});
