import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FREE_TIER_SPEC, LOCAL_SSH_KEY_MISSING, nodeHelp, runNode, type NodeDeps } from "../commands/node.js";
import {
  CONSOLE_CONFIG_MISSING,
  DEFAULT_CONSOLE_URL,
  NODE_READY_TIMEOUT_MS,
  resolveConsoleConfig,
} from "../lib/console-api.js";
import { createConsoleProvider } from "../lib/hands/console-provider.js";
import { NODE_VERBS } from "../command-table.js";
import type { ConsoleCredentials } from "../lib/console-auth.js";
import { SECRET_KEYS } from "../lib/secrets.js";

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

const FILE_CREDENTIALS: ConsoleCredentials = {
  url: "https://file.example//",
  token: "mfc_file",
  tokenId: "tok_1",
  tokenPrefix: "mfc_fil",
  login: "octocat",
};

const fromFile = (credentials: Partial<ConsoleCredentials>) => () => ({ ...FILE_CREDENTIALS, ...credentials });
const noFile = () => undefined;

describe("console config resolution", () => {
  it("keeps the console keys out of the project secrets", () => {
    expect(SECRET_KEYS as readonly string[]).not.toContain("AGRO_CONSOLE_URL");
    expect(SECRET_KEYS as readonly string[]).not.toContain("AGRO_CONSOLE_TOKEN");
  });

  it("prefers the environment over the credentials file", () => {
    const config = resolveConsoleConfig(
      { AGRO_CONSOLE_URL: "https://env.example/", AGRO_CONSOLE_TOKEN: TOKEN },
      fromFile({}),
    );
    expect(config).toEqual({ url: "https://env.example", token: TOKEN, source: "env" });
  });

  it("falls back to the user credentials file", () => {
    const config = resolveConsoleConfig({ AGRO_CONSOLE_URL: "", AGRO_CONSOLE_TOKEN: " " }, fromFile({}));
    expect(config).toEqual({ url: "https://file.example", token: "mfc_file", source: "file" });
  });

  it("never reads the project .env", async () => {
    const root = projectWithEnv("AGRO_CONSOLE_URL=https://dotenv.example\nAGRO_CONSOLE_TOKEN=mfc_dotenv\n");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const err: string[] = [];
      const io = { stdout: () => {}, stderr: (s: string) => err.push(s) };
      const fetchStub = (async () => new Response("[]", { status: 200 })) as typeof fetch;
      expect(await runNode(["list"], io, { env: {}, readCredentials: noFile, fetch: fetchStub })).toBe(1);
      expect(err.join("")).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
    } finally {
      process.chdir(previous);
    }
  });

  it("pairs an environment token with the environment URL or the default and never reads the file", () => {
    expect(DEFAULT_CONSOLE_URL).toBe("https://console.mifune.dev");
    let reads = 0;
    const tracked = () => {
      reads += 1;
      return { ...FILE_CREDENTIALS };
    };
    expect(resolveConsoleConfig({ AGRO_CONSOLE_TOKEN: TOKEN }, tracked)).toEqual({
      url: DEFAULT_CONSOLE_URL,
      token: TOKEN,
      source: "env",
    });
    expect(resolveConsoleConfig({ AGRO_CONSOLE_TOKEN: TOKEN, AGRO_CONSOLE_URL: "https://env.example/" }, tracked)).toEqual(
      { url: "https://env.example", token: TOKEN, source: "env" },
    );
    expect(reads).toBe(0);
  });

  it("pairs a file token with the file URL or the default and ignores AGRO_CONSOLE_URL", () => {
    expect(resolveConsoleConfig({ AGRO_CONSOLE_URL: "https://env.example/" }, fromFile({}))).toEqual({
      url: "https://file.example",
      token: "mfc_file",
      source: "file",
    });
    expect(resolveConsoleConfig({ AGRO_CONSOLE_URL: "https://env.example/" }, fromFile({ url: "" }))?.url).toBe(
      DEFAULT_CONSOLE_URL,
    );
    expect(resolveConsoleConfig({}, fromFile({}))?.url).toBe("https://file.example");
  });

  it("returns undefined when no token resolves", () => {
    expect(resolveConsoleConfig({ AGRO_CONSOLE_URL: "https://env.example" }, noFile)).toBeUndefined();
    expect(resolveConsoleConfig({}, fromFile({ token: "" }))).toBeUndefined();
    expect(CONSOLE_CONFIG_MISSING).toBe("not logged in to agro-console: run agro auth login");
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
    readCredentials: () => undefined,
    homeDir: () => "/home/op",
    hostname: () => "laptop",
    readFile: () => undefined,
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

const RETIRED_FLAG = ["--free", "tier"].join("-");

const PAYMENTS_DISABLED: Reply = {
  status: 403,
  body: { error: "Payments are not available yet. Use the free tier.", code: "PAYMENTS_DISABLED" },
};

const CREDIT_REQUIRED: Reply = {
  status: 402,
  body: { error: "Add credit to create a paid node.", code: "CREDIT_REQUIRED" },
};

const FREE_TIER_ELIGIBLE: Reply = { status: 200, body: { eligible: true } };
const FREE_TIER_NOT_ELIGIBLE: Reply = { status: 200, body: { eligible: false, code: "FREE_TIER_INELIGIBLE" } };
const TOP_UP = "top up credit at https://console.example/billing\n";

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
    expect(JSON.parse(h.stdout())).toEqual({ id: "n6", status: "running", spec: "small", ssh: "ssh sandbox@5.6.7.8" });
  });

  it("sends no freeTier key on the first request", async () => {
    const h = harness([{ status: 202, body: { id: "f2", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] });
  });

  it("sends the spec n4 without --spec", async () => {
    const h = harness([{ status: 202, body: { id: "f3", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(FREE_TIER_SPEC).toBe("n4");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] });
  });

  it.each([
    ["HTTP 403 PAYMENTS_DISABLED", PAYMENTS_DISABLED],
    ["HTTP 402 CREDIT_REQUIRED", CREDIT_REQUIRED],
  ])("falls back to n4 in the free tier with a notice after %s when eligible", async (_, refusal) => {
    const h = harness([
      refusal,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "f4", status: "running", ipv4: "1.2.3.4" } },
    ]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1", "--name", "box"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/free-tier",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n8", sshKeyIds: ["key-1"], name: "box" });
    expect(h.calls[2].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"], name: "box", freeTier: true });
    expect(h.stderr()).toContain("spec n8 is not in the free tier; creating n4\n");
    expect(h.stderr()).not.toContain("top up credit");
    expect(h.stdout()).toBe("id: f4\nstatus: running\nspec: n4\nssh sandbox@1.2.3.4\n");
  });

  it.each([
    ["HTTP 402 CREDIT_REQUIRED", CREDIT_REQUIRED, "agro node create: HTTP 402 CREDIT_REQUIRED: Add credit to create a paid node.\n"],
    [
      "HTTP 403 PAYMENTS_DISABLED",
      PAYMENTS_DISABLED,
      "agro node create: HTTP 403 PAYMENTS_DISABLED: Payments are not available yet. Use the free tier.\n",
    ],
  ])("prints the top-up link and sends no retry after %s when not eligible", async (_, refusal, failure) => {
    const h = harness([refusal, FREE_TIER_NOT_ELIGIBLE, { status: 202, body: { id: "x1", status: "running" } }]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/free-tier",
    ]);
    expect(h.stderr()).toBe(`agro node create: ${TOP_UP}${failure}`);
    expect(h.stdout()).toBe("");
  });

  it("keeps stdout empty and sends the top-up link to stderr with --json when not eligible", async () => {
    const h = harness([CREDIT_REQUIRED, FREE_TIER_NOT_ELIGIBLE]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe("");
    expect(h.stderr()).toContain(`agro node create: ${TOP_UP}`);
  });

  it("sends the free n4 retry when the eligibility read fails", async () => {
    const h = harness([
      CREDIT_REQUIRED,
      { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } },
      { status: 202, body: { id: "f11", status: "running", ipv4: "1.2.3.4" } },
    ]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1", "--json"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/free-tier",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[2].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"], freeTier: true });
    expect(JSON.parse(h.stdout())).toEqual({ id: "f11", status: "running", spec: "n4", ssh: "ssh sandbox@1.2.3.4" });
    expect(h.stderr()).toContain("agro node create: spec n8 is not in the free tier; creating n4\n");
    expect(h.stderr()).not.toContain("top up credit");
  });

  it("prints the created spec n4 in the JSON line after the fallback", async () => {
    const h = harness([
      PAYMENTS_DISABLED,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "f8", status: "running", ipv4: "1.2.3.4" } },
    ]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ id: "f8", status: "running", spec: "n4", ssh: "ssh sandbox@1.2.3.4" });
    expect(h.stdout().trimEnd().split("\n")).toHaveLength(1);
    expect(h.stderr()).toContain("agro node create: spec n8 is not in the free tier; creating n4\n");
    expect(h.stderr()).not.toContain("top up credit");
  });

  it("prints the requested spec in the JSON line without the fallback", async () => {
    const h = harness([{ status: 202, body: { id: "f9", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ id: "f9", status: "running", spec: "n8", ssh: "ssh sandbox@1.2.3.4" });
  });

  it("prints the requested spec in the text output without the fallback", async () => {
    const h = harness([{ status: 202, body: { id: "f10", status: "running", ipv4: "1.2.3.4" } }]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("id: f10\nstatus: running\nspec: n8\nssh sandbox@1.2.3.4\n");
  });

  it("retries n4 in the free tier without a notice when the requested spec is n4", async () => {
    const h = harness([
      PAYMENTS_DISABLED,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "f5", status: "running", ipv4: "1.2.3.4" } },
    ]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.calls).toHaveLength(3);
    expect(h.calls[2].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"], freeTier: true });
    expect(h.stderr()).not.toContain("is not in the free tier");
  });

  it("prints the top-up link and sends no further request when the free tier retry fails", async () => {
    const h = harness([
      CREDIT_REQUIRED,
      FREE_TIER_ELIGIBLE,
      { status: 403, body: { error: "a free node is live", code: "FREE_TIER_INELIGIBLE" } },
      { status: 202, body: { id: "f6", status: "running" } },
    ]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(3);
    expect(h.stderr()).toBe(
      "agro node create: spec n8 is not in the free tier; creating n4\n" +
        `agro node create: ${TOP_UP}` +
        "agro node create: HTTP 403 FREE_TIER_INELIGIBLE: a free node is live\n",
    );
    expect(h.stdout()).toBe("");
  });

  it.each([
    [403, "FREE_TIER_INELIGIBLE"],
    [403, "FORBIDDEN"],
    [400, "PAYMENTS_DISABLED"],
    [403, "CREDIT_REQUIRED"],
    [402, "PAYMENTS_DISABLED"],
    [422, "INVALID_SPEC"],
  ])("exits 1 after one request on HTTP %i %s", async (status, code) => {
    const h = harness([
      { status, body: { error: "refused", code } },
      { status: 202, body: { id: "f7", status: "running" } },
    ]);
    expect(await runNode(["create", "--spec", "n8", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.stderr()).toContain(`agro node create: HTTP ${status} ${code}: refused`);
    expect(h.stderr()).not.toContain("is not in the free tier");
    expect(h.stderr()).not.toContain("top up credit");
  });

  it("rejects the retired free tier flag before any request", async () => {
    const h = harness([{ status: 202, body: {} }]);
    expect(await runNode(["create", "--spec", "n4", "--ssh-key", "key-1", RETIRED_FLAG], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro node create: unknown flag "${RETIRED_FLAG}"\n`);
    expect(h.calls).toHaveLength(0);
  });

  it("exits 1 with the token message when the token is missing", async () => {
    const h = harness([{ status: 202, body: {} }], { env: { AGRO_CONSOLE_URL: "https://console.example" } });
    expect(await runNode(CREATE_ARGS, h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
    expect(h.all()).not.toContain(TOKEN);
    expect(h.calls).toHaveLength(0);
  });
});

const LOCAL_KEY_PATH = "/home/op/.ssh/id_ed25519.pub";
const LOCAL_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIlocal op@laptop\n";
const RUNNING = { status: 202, body: { id: "k1", status: "running", ipv4: "1.2.3.4" } };

function localKey(content = LOCAL_KEY) {
  const reads: string[] = [];
  return {
    reads,
    readFile: (path: string) => {
      reads.push(path);
      return path === LOCAL_KEY_PATH ? content : undefined;
    },
  };
}

describe("agro node create ssh key resolution", () => {
  it("reuses a console key whose type and body match the local key", async () => {
    const files = localKey();
    const h = harness(
      [
        {
          status: 200,
          body: {
            sshKeys: [
              { id: "other", name: "x", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIother op@laptop" },
              { id: "match", name: "y", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIlocal a-different-comment" },
            ],
          },
        },
        RUNNING,
      ],
      { readFile: files.readFile },
    );
    expect(await runNode(["create"], h.io, h.deps)).toBe(0);
    expect(files.reads).toEqual([LOCAL_KEY_PATH]);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://console.example/api/ssh-keys",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.calls[1].body).toMatchObject({ sshKeyIds: ["match"] });
  });

  it("registers the local key when no console key matches", async () => {
    const files = localKey();
    const h = harness(
      [
        { status: 200, body: { sshKeys: [{ id: "other", publicKey: "ssh-rsa AAAAC3NzaC1lZDI1NTE5AAAAIlocal" }] } },
        { status: 201, body: { sshKey: { id: "new-key", name: "agro-cli@laptop" } } },
        RUNNING,
      ],
      { readFile: files.readFile },
    );
    expect(await runNode(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://console.example/api/ssh-keys",
      "POST https://console.example/api/ssh-keys",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[1].body).toEqual({ name: "agro-cli@laptop", publicKey: LOCAL_KEY.trim() });
    expect(h.calls[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.calls[2].body).toMatchObject({ sshKeyIds: ["new-key"] });
  });

  it("accepts a top-level id in the register response", async () => {
    const h = harness(
      [{ status: 200, body: { sshKeys: [] } }, { status: 201, body: { id: "top-key" } }, RUNNING],
      { readFile: localKey().readFile },
    );
    expect(await runNode(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls[2].body).toMatchObject({ sshKeyIds: ["top-key"] });
  });

  it("exits 1 when the local key file does not exist", async () => {
    const h = harness([RUNNING], { readFile: () => undefined });
    expect(await runNode(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("no --ssh-key given and ~/.ssh/id_ed25519.pub not found");
    expect(h.calls).toHaveLength(0);
  });

  it("uses only the given --ssh-key flags and makes no ssh-keys call", async () => {
    const files = localKey();
    const h = harness([RUNNING], { readFile: files.readFile });
    expect(await runNode(["create", "--ssh-key", "a", "--ssh-key", "b"], h.io, h.deps)).toBe(0);
    expect(files.reads).toEqual([]);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST https://console.example/api/nodes"]);
    expect(h.calls[0].body).toMatchObject({ sshKeyIds: ["a", "b"] });
  });

  it("exits 1 with the API error when the key list fails", async () => {
    const h = harness([{ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }], {
      readFile: localKey().readFile,
    });
    expect(await runNode(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("HTTP 403 FORBIDDEN");
    expect(h.calls).toHaveLength(1);
  });

  it("exits 1 when the register response has no key id", async () => {
    const h = harness([{ status: 200, body: { sshKeys: [] } }, { status: 201, body: {} }], {
      readFile: localKey().readFile,
    });
    expect(await runNode(["create"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(2);
  });
});

const BASE_CREATE = ["create", "--spec", "n4", "--ssh-key", "key-1"];
const APP_FLAGS = [
  ["--docker", { docker: true }],
  ["--t3", { t3: true }],
  ["--code-server", { runtimeSettings: { codeServerEnabled: true } }],
] as const;
const APP_FLAG_NAMES = APP_FLAGS.map(([flag]) => flag);

describe("agro node create profile and app flags", () => {
  it("posts only the sandbox profile, spec, and keys without a new flag", async () => {
    const h = harness([RUNNING]);
    expect(await runNode(BASE_CREATE, h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] });
  });

  it("posts the agro profile with --profile agro and no app field", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile", "agro"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "agro", spec: "n4", sshKeyIds: ["key-1"] });
  });

  it("posts the agro profile with --profile=agro", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile=agro"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toMatchObject({ profile: "agro" });
  });

  it("posts the sandbox profile with --profile sandbox", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile", "sandbox"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] });
  });

  it("posts docker, t3, and codeServerEnabled with all app flags", async () => {
    const h = harness([RUNNING]);
    const args = [...BASE_CREATE, "--profile", "agro", "--docker", "--t3", "--code-server"];
    expect(await runNode(args, h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({
      profile: "agro",
      spec: "n4",
      sshKeyIds: ["key-1"],
      docker: true,
      t3: true,
      runtimeSettings: { codeServerEnabled: true },
    });
  });

  it.each(APP_FLAGS)("posts only the field of %s with --profile agro", async (flag, field) => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile", "agro", flag], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "agro", spec: "n4", sshKeyIds: ["key-1"], ...field });
  });

  it("rejects a profile other than agro or sandbox before any API call", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile", "desktop"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("--profile must be agro or sandbox");
    expect(h.calls).toHaveLength(0);
  });

  it("rejects --profile without a value before any API call", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("--profile requires a value");
    expect(h.calls).toHaveLength(0);
  });

  it.each(APP_FLAG_NAMES)("rejects %s with the default profile before key resolution", async (flag) => {
    const files = localKey();
    const h = harness([RUNNING], { readFile: files.readFile });
    expect(await runNode(["create", "--spec", "n4", flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(`${flag} requires --profile agro`);
    expect(files.reads).toEqual([]);
    expect(h.calls).toHaveLength(0);
  });

  it.each(APP_FLAG_NAMES)("rejects %s with --profile sandbox before any API call", async (flag) => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--profile", "sandbox", flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain(`${flag} requires --profile agro`);
    expect(h.calls).toHaveLength(0);
  });

  it("prints the HTTP status and code when runtime settings are disabled", async () => {
    const h = harness([
      { status: 422, body: { error: "Runtime settings are disabled", code: "RUNTIME_SETTINGS_DISABLED" } },
    ]);
    expect(await runNode([...BASE_CREATE, "--profile", "agro", "--code-server"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("HTTP 422 RUNTIME_SETTINGS_DISABLED: Runtime settings are disabled");
    expect(h.calls).toHaveLength(1);
  });

  it("shows the new flags in the help", () => {
    const help = nodeHelp("agro");
    expect(help).toContain(
      "agro node create [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--disposable] [--ssh-key <uuid>]... [--name <name>] [--json]",
    );
    for (const flag of ["--profile", ...APP_FLAG_NAMES]) expect(help).toContain(`\`${flag}`);
  });
});

const DISPOSABLE_PROFILE_UNSUPPORTED: Reply = {
  status: 422,
  body: { error: "Only sandbox nodes can be disposable", code: "DISPOSABLE_PROFILE_UNSUPPORTED" },
};

describe("agro node create --disposable", () => {
  it("posts disposable true with --disposable", async () => {
    const h = harness([RUNNING]);
    expect(await runNode([...BASE_CREATE, "--disposable"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"], disposable: true });
  });

  it("posts no disposable key without --disposable", async () => {
    const h = harness([RUNNING]);
    expect(await runNode(BASE_CREATE, h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).not.toHaveProperty("disposable");
  });

  it("keeps disposable true in the free n4 retry after a credit refusal", async () => {
    const h = harness([CREDIT_REQUIRED, FREE_TIER_ELIGIBLE, RUNNING]);
    expect(await runNode([...BASE_CREATE, "--spec", "n8", "--disposable"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/free-tier",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[2].body).toEqual({
      profile: "sandbox",
      spec: "n4",
      sshKeyIds: ["key-1"],
      disposable: true,
      freeTier: true,
    });
  });

  it("sends --profile agro --disposable and prints the sandbox-only line on HTTP 422", async () => {
    const h = harness([DISPOSABLE_PROFILE_UNSUPPORTED]);
    expect(await runNode([...BASE_CREATE, "--profile", "agro", "--disposable"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toEqual({ profile: "agro", spec: "n4", sshKeyIds: ["key-1"], disposable: true });
    expect(h.stderr()).toBe(
      "agro node create: only a sandbox node can be disposable: drop --disposable, or use --profile sandbox\n",
    );
    expect(h.stdout()).toBe("");
  });

  it("states the disposable rules in the help", () => {
    const help = nodeHelp("agro");
    expect(help).toContain("`--disposable`");
    expect(help).toContain("no data volume");
    expect(help).toContain("HTTP 409 NODE_DISPOSABLE");
    for (const verb of ["pause", "resume", "fork", "snapshot", "convert", "disk grow"]) expect(help).toContain(verb);
    expect(help).toContain("agro node delete <id>");
    expect(help).toContain("credit grace window");
    expect(help).toContain("low-balance email");
    expect(help).toContain("free-tier allowance");
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
    expect(h.stderr()).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
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
    expect(h.stderr()).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
    expect(h.calls).toHaveLength(0);
  });
});

describe("agro node check", () => {
  const LOCAL_KEY = "ssh-ed25519 AAAAlocal op@laptop";
  const KEYS = { status: 200, body: { sshKeys: [{ id: "key-1", publicKey: "ssh-ed25519 AAAAlocal other@host" }, { id: "key-2", publicKey: "ssh-ed25519 AAAAother" }] } };
  const ELIGIBLE = { status: 200, body: { eligible: true } };
  const balance = (balanceMicros: number, overrides: Record<string, unknown> = {}) => ({
    status: 200,
    body: { balanceMicros, hasCard: false, paymentsEnabled: true, canManage: true, autoTopup: null, ...overrides },
  });
  const FUNDED = balance(12_345_678);
  const AUTO_TOPUP = { amountUsd: 20, thresholdUsd: 5 };
  const withLocalKey = { readFile: (path: string) => (path === "/home/op/.ssh/id_ed25519.pub" ? `${LOCAL_KEY}\n` : undefined) };
  const methods = (calls: Recorded[]) => calls.map((c) => `${c.method} ${c.url}`);
  const BOTH = [
    "GET https://console.example/api/ssh-keys",
    "GET https://console.example/api/free-tier",
    "GET https://console.example/api/billing/balance",
  ];

  it("finds the local public key by identity and checks the free tier with GET only", async () => {
    const h = harness([KEYS, ELIGIBLE, FUNDED], withLocalKey);
    expect(await runNode(["check"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("ok ssh-key key-1 ~/.ssh/id_ed25519.pub\nok free-tier\nok credit: balance $12.35\n");
    expect(methods(h.calls)).toEqual(BOTH);
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("fails without a POST when the local public key is not registered", async () => {
    const h = harness([{ status: 200, body: { sshKeys: [{ id: "key-2", publicKey: "ssh-ed25519 AAAAother" }] } }, ELIGIBLE, FUNDED], withLocalKey);
    expect(await runNode(["check"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toMatch(/^fail ssh-key ~\/\.ssh\/id_ed25519\.pub: not registered in agro-console — .*--ssh-key <uuid>\nok free-tier\nok credit: balance \$12\.35\n$/);
    expect(h.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("fails with a remedy when the local public key file is missing and reads only the free tier", async () => {
    const h = harness([ELIGIBLE, FUNDED]);
    expect(await runNode(["check"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain(`fail ssh-key: ${LOCAL_SSH_KEY_MISSING} — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>`);
    expect(methods(h.calls)).toEqual(["GET https://console.example/api/free-tier", "GET https://console.example/api/billing/balance"]);
  });

  it("finds each --ssh-key id and fails on an unknown id", async () => {
    const h = harness([KEYS, ELIGIBLE, FUNDED]);
    expect(await runNode(["check", "--ssh-key", "key-2", "--ssh-key=key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout().split("\n")).toEqual([
      "ok ssh-key key-2",
      "fail ssh-key key-9: not found in agro-console — pass the id of an SSH key in agro-console",
      "ok free-tier",
      "ok credit: balance $12.35",
      "",
    ]);
    expect(methods(h.calls)).toEqual(BOTH);
  });

  it("passes the free tier check when eligible", async () => {
    const h = harness([KEYS, ELIGIBLE, FUNDED]);
    expect(await runNode(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("ok ssh-key key-1\nok free-tier\nok credit: balance $12.35\n");
    expect(methods(h.calls)).toEqual(BOTH);
  });

  it("warns with the code and the reason when the account is not eligible and keeps exit 0", async () => {
    const h = harness([KEYS, { status: 200, body: { eligible: false, code: "FREE_TIER_INELIGIBLE", reason: "a free node is live" } }, FUNDED]);
    expect(await runNode(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toContain("ok ssh-key key-1\n");
    expect(h.stdout()).toMatch(/\nwarn free-tier: not eligible \(FREE_TIER_INELIGIBLE: a free node is live\) — .*agro auth login in the personal context\nok credit: balance \$12\.35\n$/);
  });

  it("keeps exit 1 for a failed key check when the account is not eligible", async () => {
    const h = harness([KEYS, { status: 200, body: { eligible: false } }, FUNDED]);
    expect(await runNode(["check", "--ssh-key", "key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("warn free-tier: not eligible — ");
  });

  it("names onboarding and the personal context on a 403 onboarding reply", async () => {
    const h = harness([KEYS, { status: 403, body: { error: "Onboarding required" } }, FUNDED]);
    expect(await runNode(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("fail free-tier: HTTP 403 no code: Onboarding required — finish agro-console onboarding, or run agro auth login in the personal context\n");
  });

  it("never sends a POST or a DELETE across every check outcome", async () => {
    const h = harness([{ status: 200, body: { sshKeys: [] } }, { status: 200, body: { eligible: false } }, balance(0)], withLocalKey);
    expect(await runNode(["check"], h.io, h.deps)).toBe(1);
    expect(h.calls.length).toBe(3);
    expect(h.calls.map((c) => c.method)).toEqual(["GET", "GET", "GET"]);
    expect(h.stdout()).toContain("warn free-tier: not eligible — ");
  });

  it.each([
    ["payments are off", balance(0, { paymentsEnabled: false }), "ok credit: payments are off"],
    ["a positive balance", balance(1_500_000), "ok credit: balance $1.50"],
    ["a positive balance with auto top-up", balance(1_500_000, { autoTopup: AUTO_TOPUP }), "ok credit: balance $1.50, auto top-up on"],
    [
      "a zero balance without auto top-up",
      balance(0),
      "warn credit: no credit (balance $0.00) — top up at https://console.example/billing",
    ],
    [
      "a negative balance without auto top-up",
      balance(-40_000),
      "warn credit: no credit (balance -$0.04) — top up at https://console.example/billing",
    ],
    ["a zero balance with auto top-up", balance(0, { autoTopup: AUTO_TOPUP }), "ok credit: balance $0.00, auto top-up on"],
    ["a negative balance with auto top-up", balance(-40_000, { autoTopup: AUTO_TOPUP }), "ok credit: balance -$0.04, auto top-up on"],
    [
      "a console without the balance route",
      { status: 404, body: { error: "Not found", code: "NOT_FOUND" } },
      "warn credit: HTTP 404 NOT_FOUND: Not found",
    ],
    ["a failed balance read", { status: 500, body: { error: "boom" } }, "warn credit: HTTP 500 no code: boom"],
  ])("prints the credit line for %s with GET only and keeps exit 0", async (_, reply, line) => {
    const h = harness([KEYS, ELIGIBLE, reply]);
    expect(await runNode(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`ok ssh-key key-1\nok free-tier\n${line}\n`);
    expect(methods(h.calls)).toEqual(BOTH);
  });

  it("keeps exit 1 on a failed key check whatever the credit line says", async () => {
    const h = harness([KEYS, ELIGIBLE, balance(5_000_000)]);
    expect(await runNode(["check", "--ssh-key", "key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("ok credit: balance $5.00\n");
  });

  it("names the credit line in the help", () => {
    const help = nodeHelp("agro");
    expect(help).toContain("credit line");
    expect(help).toContain("/api/billing/balance");
  });

  it("rejects an unknown flag before any request", async () => {
    const h = harness([KEYS]);
    expect(await runNode(["check", "--spec", "n4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe('agro node check: unknown flag "--spec"\n');
    expect(h.calls).toEqual([]);
  });

  it("rejects the retired free tier flag before any request", async () => {
    const h = harness([KEYS]);
    expect(await runNode(["check", RETIRED_FLAG], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro node check: unknown flag "${RETIRED_FLAG}"\n`);
    expect(h.calls).toEqual([]);
  });

  it("lists check in the verbs and the help", () => {
    expect(NODE_VERBS).toContain("check");
    expect(nodeHelp("agro")).toContain("agro node check [--ssh-key <uuid>]...");
  });
});

describe("agro node help", () => {
  it("names no free tier flag and describes the n4 fallback", () => {
    const help = nodeHelp("agro");
    expect(help).not.toContain(RETIRED_FLAG);
    expect(help).toContain("agro node create [--spec <spec>]");
    expect(help).toContain("creates n4 in the free tier");
  });

  it("names both credit refusals and the top-up link", () => {
    const help = nodeHelp("agro");
    expect(help).toContain("HTTP 402 CREDIT_REQUIRED");
    expect(help).toContain("HTTP 403 PAYMENTS_DISABLED");
    expect(help).toContain("top up credit at <console url>/billing");
  });

  it("states that a sandbox node is not a hand unless a brain manages it", () => {
    expect(nodeHelp("agro")).toContain("is not a hand unless a brain manages the node");
  });
});

describe("console hand provider create", () => {
  function provider(replies: Reply[]) {
    const h = harness(replies);
    const notices: string[] = [];
    const config = { url: "https://console.example", token: TOKEN, source: "env" as const };
    const deps = { ...(h.deps as NodeDeps), pollDelayMs: () => 1000 };
    return { h, notices, hands: createConsoleProvider(deps, config, (notice) => notices.push(notice)) };
  }

  it("falls back to n4 in the free tier with a notice when payments are disabled", async () => {
    const { h, notices, hands } = provider([
      PAYMENTS_DISABLED,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "u1", status: "running" } },
    ]);
    const created = await hands.create({ name: "w", spec: "n8" }, () => {});
    expect(created.ok).toBe(true);
    expect(h.calls.map((c) => c.body)).toEqual([
      { profile: "sandbox", name: "w", spec: "n8" },
      undefined,
      { profile: "sandbox", name: "w", spec: "n4", freeTier: true },
    ]);
    expect(notices).toEqual(["spec n8 is not in the free tier; creating n4"]);
  });

  it("keeps the first body without a spec and retries n4 in the free tier", async () => {
    const { h, hands } = provider([
      CREDIT_REQUIRED,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "u2", status: "running" } },
    ]);
    expect((await hands.create({}, () => {})).ok).toBe(true);
    expect(h.calls.map((c) => c.body)).toEqual([
      { profile: "sandbox" },
      undefined,
      { profile: "sandbox", spec: "n4", freeTier: true },
    ]);
  });

  it("reports the top-up link through the notice when not eligible", async () => {
    const { h, notices, hands } = provider([CREDIT_REQUIRED, FREE_TIER_NOT_ELIGIBLE]);
    expect(await hands.create({ spec: "n8" }, () => {})).toEqual({
      ok: false,
      error: "HTTP 402 CREDIT_REQUIRED: Add credit to create a paid node.",
    });
    expect(h.calls).toHaveLength(2);
    expect(notices).toEqual(["top up credit at https://console.example/billing"]);
  });

  it("does not retry on another code", async () => {
    const { h, notices, hands } = provider([{ status: 403, body: { code: "FREE_TIER_INELIGIBLE" } }]);
    expect(await hands.create({ spec: "n8" }, () => {})).toEqual({ ok: false, error: "HTTP 403 FREE_TIER_INELIGIBLE" });
    expect(h.calls).toHaveLength(1);
    expect(notices).toEqual([]);
  });

  it("sends disposable true and keeps it in the free n4 retry", async () => {
    const { h, hands } = provider([
      CREDIT_REQUIRED,
      FREE_TIER_ELIGIBLE,
      { status: 202, body: { id: "u3", status: "running" } },
    ]);
    expect((await hands.create({ spec: "n8", disposable: true }, () => {})).ok).toBe(true);
    expect(h.calls.map((c) => c.body)).toEqual([
      { profile: "sandbox", spec: "n8", disposable: true },
      undefined,
      { profile: "sandbox", spec: "n4", disposable: true, freeTier: true },
    ]);
  });

  it("sends no disposable key when the request does not set it", async () => {
    const { h, hands } = provider([{ status: 202, body: { id: "u4", status: "running" } }]);
    expect((await hands.create({ disposable: false }, () => {})).ok).toBe(true);
    expect(h.calls[0].body).toEqual({ profile: "sandbox" });
  });

  const NODE_DISPOSABLE: Reply = { status: 409, body: { error: "Node is disposable", code: "NODE_DISPOSABLE" } };

  it.each(["pause", "resume"] as const)("maps HTTP 409 NODE_DISPOSABLE on %s to the delete line", async (verb) => {
    const { hands } = provider([NODE_DISPOSABLE]);
    expect(await hands[verb]("#4")).toEqual({
      ok: false,
      error: `hand #4 is disposable and cannot ${verb}: delete it with agro hands destroy #4`,
    });
  });

  it("maps HTTP 409 NODE_DISPOSABLE on fork to the delete line", async () => {
    const { hands } = provider([NODE_DISPOSABLE]);
    expect(await hands.fork("quiet-otter", { spec: "n8" }, () => {})).toEqual({
      ok: false,
      error: "hand quiet-otter is disposable and cannot fork: delete it with agro hands destroy quiet-otter",
    });
  });

  it("keeps the console message on destroy after HTTP 409 NODE_DISPOSABLE", async () => {
    const { hands } = provider([NODE_DISPOSABLE]);
    expect(await hands.destroy("4")).toEqual({ ok: false, error: "HTTP 409 NODE_DISPOSABLE: Node is disposable" });
  });
});
