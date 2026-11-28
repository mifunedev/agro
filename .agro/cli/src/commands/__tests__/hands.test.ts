import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConsoleCredentials, type ConsoleCredentials } from "../../lib/console-auth.js";
import { CONSOLE_CONFIG_MISSING, resolveConsoleConfig } from "../../lib/console-api.js";
import { HANDS_VERBS } from "../../command-table.js";
import {
  CONSOLE_TOKEN_MISSING,
  HAND_MISSING,
  handsHelp,
  normalizeHandRef,
  resolveHandsConsoleConfig,
  createMany,
  runHands,
  type HandsDeps,
} from "../hands.js";
import type { Hand, HandOutcome, HandProvider, HandStatusReport } from "../../lib/hands/provider.js";

const TOKEN = "brn_known_secret_token_4f2a";
const TOKEN_PATH = "/home/sandbox/.agro/brain-token";
const URL_PATH = "/home/sandbox/.agro/brain-console-url";
const USER_HOME = mkdtempSync(join(tmpdir(), "agro-hands-home-"));
afterAll(() => rmSync(USER_HOME, { recursive: true, force: true }));

interface Recorded {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status: number; body?: unknown };

function brainFiles(files: Record<string, string>) {
  const reads: string[] = [];
  return {
    reads,
    readFile: (path: string) => {
      reads.push(path);
      return files[path];
    },
  };
}

function harness(replies: Reply[], overrides: Partial<HandsDeps> = {}) {
  const calls: Recorded[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const sleeps: number[] = [];
  const questions: string[] = [];
  let clock = 0;
  const files = brainFiles({ [TOKEN_PATH]: `${TOKEN}\n`, [URL_PATH]: "https://brain-console.example/\n" });
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
  const deps: Partial<HandsDeps> = {
    fetch: fetchStub,
    env: {},
    homeDir: () => "/home/sandbox",
    userHome: () => USER_HOME,
    readFile: files.readFile,
    readCredentials: () => undefined,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    timeoutMs: 15 * 60 * 1000,
    confirm: async (question) => {
      questions.push(question);
      return false;
    },
    ...overrides,
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return {
    calls,
    sleeps,
    questions,
    reads: files.reads,
    io,
    deps,
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    all: () => out.join("") + err.join(""),
  };
}

const HOME = () => "/home/sandbox";
const BRAIN = { [TOKEN_PATH]: `${TOKEN}\n`, [URL_PATH]: "https://brain.example/\n" };
const ENV_TOKEN = { AGRO_CONSOLE_TOKEN: "env_token" };
const ENV_BOTH = { AGRO_CONSOLE_TOKEN: "env_token", AGRO_CONSOLE_URL: "https://env.example/" };

function credentials(token: string, url = "https://login.example/"): () => ConsoleCredentials {
  return () => ({ url, token, tokenId: "t1", tokenPrefix: "agro_", login: "octo" });
}

const noCredentials = () => undefined;

describe("hands console config source order", () => {
  it.each([
    ["env token and env URL beat every file", ENV_BOTH, BRAIN, credentials("cred"), "env_token", "https://env.example", "env", "brain"],
    ["env token takes the brain URL file when the brain token file exists", ENV_TOKEN, BRAIN, credentials("cred"), "env_token", "https://brain.example", "env", "brain"],
    ["env token without a brain token file takes the brain URL file and brain authority", ENV_TOKEN, { [URL_PATH]: "https://brain.example/" }, credentials("cred"), "env_token", "https://brain.example", "env", "brain"],
    ["brain token takes the brain URL file", {}, BRAIN, credentials("cred"), TOKEN, "https://brain.example", "file", "brain"],
    ["brain token takes AGRO_CONSOLE_URL over the brain URL file", { AGRO_CONSOLE_URL: "https://env.example" }, BRAIN, noCredentials, TOKEN, "https://env.example", "file", "brain"],
    ["credentials token takes the credentials URL", {}, {}, credentials("cred"), "cred", "https://login.example", "file", "operator"],
    ["credentials token keeps the credentials URL over AGRO_CONSOLE_URL", { AGRO_CONSOLE_URL: "https://env.example" }, {}, credentials("cred"), "cred", "https://login.example", "file", "operator"],
    ["credentials token with an empty URL takes the public console", {}, {}, credentials("cred", " "), "cred", "https://console.mifune.dev", "file", "operator"],
  ] as const)("%s", (_, env, files, readCredentials, token, url, source, authority) => {
    expect(resolveHandsConsoleConfig(env, HOME, brainFiles(files).readFile, readCredentials, false)).toEqual({
      ok: true,
      config: { url, token, source },
      authority,
    });
  });

  it("trims the brain token and the brain URL", () => {
    const files = brainFiles({ [TOKEN_PATH]: ` ${TOKEN}\n`, [URL_PATH]: "https://c.example//\n" });
    expect(resolveHandsConsoleConfig({}, HOME, files.readFile, noCredentials, false)).toEqual({
      ok: true,
      config: { url: "https://c.example", token: TOKEN, source: "file" },
      authority: "brain",
    });
  });

  it("fails without any token and names the brain token path and agro auth login", () => {
    const result = resolveHandsConsoleConfig({}, HOME, brainFiles({ [URL_PATH]: "https://c" }).readFile, noCredentials, false);
    expect(result).toEqual({ ok: false, error: CONSOLE_TOKEN_MISSING });
    expect(CONSOLE_TOKEN_MISSING).toContain(TOKEN_PATH);
    expect(CONSOLE_TOKEN_MISSING).toContain("agro auth login");
  });

  it("fails without the URL file and AGRO_CONSOLE_URL instead of using the public console", () => {
    const result = resolveHandsConsoleConfig({}, HOME, brainFiles({ [TOKEN_PATH]: TOKEN }).readFile, credentials("cred"), false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(URL_PATH);
      expect(result.error).toContain("AGRO_CONSOLE_URL");
    }
  });

  it.each([
    ["the brain token file", { [TOKEN_PATH]: TOKEN }],
    ["no brain token file", {}],
  ])("fails with an env token, %s, and no brain URL source", (_, files) => {
    const result = resolveHandsConsoleConfig(ENV_TOKEN, HOME, brainFiles(files).readFile, credentials("cred"), false);
    expect(result).toEqual({
      ok: false,
      error: `no brain console URL: ${URL_PATH} not found and AGRO_CONSOLE_URL is unset`,
    });
  });

  it.each([
    ["env token and env URL", ENV_BOTH, credentials("cred"), "env_token", "https://env.example", "env"],
    ["env token without env URL takes the public console", ENV_TOKEN, credentials("cred"), "env_token", "https://console.mifune.dev", "env"],
    ["credentials token and URL", {}, credentials("cred"), "cred", "https://login.example", "file"],
    ["credentials token with an empty URL", {}, credentials("cred", " "), "cred", "https://console.mifune.dev", "file"],
  ] as const)("--operator resolves %s like agro auth and ignores the brain files", (_, env, readCredentials, token, url, source) => {
    const files = brainFiles(BRAIN);
    const expected = { ok: true, config: { url, token, source }, authority: "operator" };
    expect(resolveHandsConsoleConfig(env, HOME, files.readFile, readCredentials, true)).toEqual(expected);
    expect(resolveConsoleConfig(env, readCredentials)).toEqual(expected.config);
    expect(files.reads).toEqual([]);
  });

  it("--operator fails without credentials and names agro auth login", () => {
    expect(resolveHandsConsoleConfig({}, HOME, brainFiles(BRAIN).readFile, noCredentials, true)).toEqual({
      ok: false,
      error: CONSOLE_CONFIG_MISSING,
    });
    expect(CONSOLE_CONFIG_MISSING).toContain("agro auth login");
  });

  it("strips only a leading # from a hand ref", () => {
    expect(normalizeHandRef("#4")).toBe("4");
    expect(normalizeHandRef("4")).toBe("4");
    expect(normalizeHandRef("quiet-otter")).toBe("quiet-otter");
    expect(normalizeHandRef("3f1c2d4e-0000-4000-8000-000000000001")).toBe("3f1c2d4e-0000-4000-8000-000000000001");
  });
});

describe("agro hands config errors", () => {
  it("exits 2 and sends no request without any token", async () => {
    const h = harness([{ status: 200, body: [] }], { readFile: brainFiles({ [URL_PATH]: "https://c" }).readFile });
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe(`${CONSOLE_TOKEN_MISSING}\n`);
    expect(h.calls).toEqual([]);
  });

  it("exits 2 and sends no request when the URL file is missing", async () => {
    const h = harness([{ status: 200, body: [] }], { readFile: brainFiles({ [TOKEN_PATH]: TOKEN }).readFile });
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toContain(URL_PATH);
    expect(h.calls).toEqual([]);
    expect(h.all()).not.toContain(TOKEN);
  });

  it("uses the environment token and URL over the files", async () => {
    const h = harness([{ status: 200, body: [] }], {
      env: { AGRO_CONSOLE_TOKEN: "env_token", AGRO_CONSOLE_URL: "https://env.example" },
    });
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].url).toBe("https://env.example/api/nodes");
    expect(h.calls[0].headers.Authorization).toBe("Bearer env_token");
  });

  it("uses the agro auth login credentials without a brain token", async () => {
    const h = harness([{ status: 200, body: [] }], {
      readFile: brainFiles({}).readFile,
      readCredentials: credentials("agro_operator_secret"),
    });
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].url).toBe("https://login.example/api/nodes");
    expect(h.calls[0].headers.Authorization).toBe("Bearer agro_operator_secret");
  });
});

describe("agro hands authority", () => {
  const KEY_PATH = join(USER_HOME, ".ssh", "id_ed25519.pub");
  const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIlocal op@laptop\n";
  const QUEUED_REPLY: Reply = { status: 202, body: { id: "u9", status: "queued" } };
  const RUNNING_REPLY: Reply = { status: 200, body: { id: "u9", status: "running", orgIndex: 7, sshHost: "h" } };
  const route = (calls: Recorded[]) => calls.map((c) => `${c.method} ${c.url}`);

  it("gives brain authority to an env token without a brain token file and sends no ssh-keys call on create", async () => {
    const files = brainFiles({ [KEY_PATH]: KEY });
    const h = harness([QUEUED_REPLY, RUNNING_REPLY], {
      env: ENV_BOTH,
      readFile: files.readFile,
      readCredentials: credentials("cred"),
      hostname: () => "laptop",
    });
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(files.reads).not.toContain(KEY_PATH);
    expect(route(h.calls)).toEqual(["POST https://env.example/api/nodes", "GET https://env.example/api/nodes/u9"]);
    expect(h.calls[0].body).toEqual({ profile: "sandbox" });
    expect(h.calls[0].headers.Authorization).toBe("Bearer env_token");
  });

  it.each([[["--operator", "create"]], [["create", "--operator"]]])(
    "uses the credentials and registers the local key with %j on a host with a brain token file",
    async (args) => {
      const files = brainFiles({ ...BRAIN, [KEY_PATH]: KEY });
      const h = harness(
        [{ status: 200, body: { sshKeys: [] } }, { status: 201, body: { id: "new-key" } }, QUEUED_REPLY, RUNNING_REPLY],
        { readFile: files.readFile, readCredentials: credentials("agro_operator_secret"), hostname: () => "laptop" },
      );
      expect(await runHands(args, h.io, h.deps)).toBe(0);
      expect(files.reads).not.toContain(TOKEN_PATH);
      expect(route(h.calls)).toEqual([
        "GET https://login.example/api/ssh-keys",
        "POST https://login.example/api/ssh-keys",
        "POST https://login.example/api/nodes",
        "GET https://login.example/api/nodes/u9",
      ]);
      expect(h.calls.every((c) => c.headers.Authorization === "Bearer agro_operator_secret")).toBe(true);
      expect(h.calls[2].body).toEqual({ profile: "sandbox", sshKeyIds: ["new-key"] });
    },
  );

  it("--operator takes the public console for an env token without an env URL", async () => {
    const h = harness([{ status: 200, body: [] }], { env: ENV_TOKEN, readCredentials: credentials("cred") });
    expect(await runHands(["list", "--operator"], h.io, h.deps)).toBe(0);
    expect(route(h.calls)).toEqual(["GET https://console.mifune.dev/api/nodes"]);
    expect(h.calls[0].headers.Authorization).toBe("Bearer env_token");
  });

  it("--operator exits 2 without credentials and sends no request", async () => {
    const h = harness([{ status: 200, body: [] }]);
    expect(await runHands(["--operator", "list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
    expect(h.calls).toEqual([]);
  });

  it.each([[["--operator", "--provider", "exedev", "list"]], [["list", "--provider=exedev", "--operator"]]])(
    "refuses --operator with the exedev provider before any ssh call: %j",
    async (args) => {
      const runs: string[] = [];
      const h = harness([{ status: 200, body: [] }], {
        run: (command) => {
          runs.push(command);
          return { status: 0 };
        },
      });
      expect(await runHands(args, h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe("agro hands list: --operator applies only to console hands\n");
      expect(runs).toEqual([]);
      expect(h.calls).toEqual([]);
    },
  );

  it.each([
    ["--provider", ["create", "--name", "--provider"]],
    ["--operator", ["create", "--name", "--operator"]],
    ["--provider", ["create", "--name=x", "--spec", "--provider", "--ssh-key", "k1"]],
  ])("keeps %s as the value of a verb flag", async (value, args) => {
    const h = harness([QUEUED_REPLY, RUNNING_REPLY]);
    expect(await runHands(args, h.io, h.deps)).toBe(0);
    expect(h.calls[0].url).toBe("https://brain-console.example/api/nodes");
    expect(Object.values(h.calls[0].body as Record<string, unknown>)).toContain(value);
  });
});

describe("agro hands --provider", () => {
  function exedevHome(): string {
    const dir = mkdtempSync(join(tmpdir(), "agro-hands-provider-"));
    mkdirSync(join(dir, ".agro"), { recursive: true });
    writeFileSync(join(dir, ".agro", "config.json"), JSON.stringify({ version: 1, hands: { provider: "exedev" } }), "utf8");
    return dir;
  }

  it.each([
    [["--provider", "console", "list"]],
    [["list", "--provider", "console"]],
    [["--provider=console", "list"]],
    [["list", "--provider=console"]],
  ])("overrides a host config that selects exedev: %j", async (args) => {
    const home = exedevHome();
    try {
      const runs: string[] = [];
      const h = harness([{ status: 200, body: HANDS }], {
        userHome: () => home,
        run: (command) => {
          runs.push(command);
          return { status: 255 };
        },
      });
      expect(await runHands(args, h.io, h.deps)).toBe(0);
      expect(runs).toEqual([]);
      expect(h.calls).toHaveLength(1);
      expect(h.calls[0].url).toBe("https://brain-console.example/api/nodes");
      expect(h.stdout()).toContain("quiet-otter");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it.each([[["--provider", "exedev", "list"]], [["list", "--provider=exedev"]]])(
    "selects exedev over the default console provider: %j",
    async (args) => {
      const runs: string[][] = [];
      const h = harness([{ status: 200, body: HANDS }], {
        run: (command, commandArgs) => {
          runs.push([command, ...commandArgs]);
          return { status: 255, stderr: "no exe.dev\n" };
        },
      });
      expect(await runHands(args, h.io, h.deps)).toBe(2);
      expect(runs[0][0]).toBe("ssh");
      expect(runs[0]).toContain("exe.dev");
      expect(h.calls).toEqual([]);
    },
  );

  it("exits 1 and names both providers for an unknown provider", async () => {
    const h = harness([{ status: 200, body: HANDS }]);
    expect(await runHands(["list", "--provider", "desktop"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("console");
    expect(h.stderr()).toContain("exedev");
    expect(h.calls).toEqual([]);
  });

  it("exits 1 when --provider has no value", async () => {
    const h = harness([{ status: 200, body: HANDS }]);
    expect(await runHands(["list", "--provider"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands: --provider requires a value\n");
    expect(h.calls).toEqual([]);
  });

  it("keeps --provider after -- in the exec command", async () => {
    const runs: string[][] = [];
    const h = harness([{ status: 200, body: HANDS[0] }], {
      run: (command, commandArgs) => {
        runs.push([command, ...commandArgs]);
        return { status: 0 };
      },
    });
    const status = await runHands(["exec", "4", "--provider", "console", "--", "echo", "--provider", "x"], h.io, h.deps);
    expect(h.stderr()).toBe("");
    expect(status).toBe(0);
    expect(runs).toHaveLength(1);
    expect(runs[0].at(-1)).toContain("echo --provider x");
  });
});

describe("agro hands help", () => {
  it("lists every verb", async () => {
    const help = handsHelp("agro");
    for (const verb of HANDS_VERBS) expect(help).toContain(`agro hands ${verb}`);
    const h = harness([{ status: 200 }]);
    expect(await runHands(["--help"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(help);
    expect(await runHands([], h.io, h.deps)).toBe(1);
    expect(h.calls).toEqual([]);
  });

  it("rejects an unknown verb", async () => {
    const h = harness([{ status: 200 }]);
    expect(await runHands(["ssh"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain('unknown subcommand "ssh"');
    expect(h.calls).toEqual([]);
  });
});

const HANDS = [
  { id: "u1", orgIndex: 4, alias: "quiet-otter", name: "otter-box", profile: "sandbox", status: "running", spec: "n4", sshHost: "hand-4.example" },
  { id: "u2", orgIndex: 12, alias: "bold-heron", status: "paused", spec: "n8", sshHost: null },
];

describe("agro hands list", () => {
  it("prints index, alias, status, spec, and SSH host with the bearer token", async () => {
    const h = harness([{ status: 200, body: HANDS }]);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ method: "GET", url: "https://brain-console.example/api/nodes" });
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.stdout()).toBe(
      [
        "INDEX  ALIAS        STATUS   SPEC  SSH HOST",
        "#4     quiet-otter  running  n4    hand-4.example",
        "#12    bold-heron   paused   n8    -",
        "",
      ].join("\n"),
    );
    expect(h.all()).not.toContain(TOKEN);
  });

  it("prints JSON with --json", async () => {
    const h = harness([{ status: 200, body: { nodes: HANDS } }]);
    expect(await runHands(["list", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual([
      { id: "u1", index: 4, alias: "quiet-otter", name: "otter-box", profile: "sandbox", status: "running", spec: "n4", sshHost: "hand-4.example" },
      { id: "u2", index: 12, alias: "bold-heron", name: null, profile: null, status: "paused", spec: "n8", sshHost: null },
    ]);
  });

  it("prints no hands for an empty list", async () => {
    const h = harness([{ status: 200, body: [] }]);
    expect(await runHands(["list"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("no hands\n");
  });

  it("rejects an unknown flag", async () => {
    const h = harness([{ status: 200, body: [] }]);
    expect(await runHands(["list", "--all"], h.io, h.deps)).toBe(1);
    expect(h.calls).toEqual([]);
  });
});

describe("agro hands create", () => {
  it("posts a sandbox hand, waits until it runs, and prints index, alias, and SSH host", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 200, body: { id: "u9", status: "provisioning", orgIndex: 7, slug: "calm-lynx" } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 7, slug: "calm-lynx", sshHost: "hand-7.example" } },
    ]);
    expect(await runHands(["create", "--name", "worker", "--spec=n8"], h.io, h.deps)).toBe(0);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      url: "https://brain-console.example/api/nodes",
      body: { profile: "sandbox", name: "worker", spec: "n8" },
    });
    expect(h.calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://brain-console.example/api/nodes/u9",
      "GET https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.calls.every((c) => c.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(h.sleeps).toEqual([1000, 1000]);
    expect(h.stdout()).toBe("index: 7\nalias: calm-lynx\nssh host: hand-7.example\n");
    expect(h.all()).not.toContain(TOKEN);
  });

  it("retries n4 in the free tier after HTTP 402 CREDIT_REQUIRED when the brain token cannot read the free tier", async () => {
    const h = harness([
      { status: 402, body: { error: "Add credit to create a paid node.", code: "CREDIT_REQUIRED" } },
      { status: 403, body: { error: "brain tokens may not read this route", code: "BRAIN_TOKEN_ROUTE_FORBIDDEN" } },
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 7, slug: "calm-lynx", sshHost: "hand-7.example" } },
    ]);
    expect(await runHands(["create", "--name", "worker", "--spec=n8"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://brain-console.example/api/nodes",
      "GET https://brain-console.example/api/free-tier",
      "POST https://brain-console.example/api/nodes",
      "GET https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.calls[2].body).toEqual({ profile: "sandbox", name: "worker", spec: "n4", freeTier: true });
    expect(h.stderr()).toContain("agro hands create: spec n8 is not in the free tier; creating n4\n");
    expect(h.stderr()).not.toContain("top up credit");
    expect(h.stdout()).toBe("index: 7\nalias: calm-lynx\nssh host: hand-7.example\n");
  });

  it("prints the top-up link when the free tier retry fails after HTTP 402 CREDIT_REQUIRED", async () => {
    const h = harness([
      { status: 402, body: { error: "Add credit to create a paid node.", code: "CREDIT_REQUIRED" } },
      { status: 403, body: { code: "BRAIN_TOKEN_ROUTE_FORBIDDEN" } },
      { status: 403, body: { error: "a free node is live", code: "FREE_TIER_INELIGIBLE" } },
    ]);
    expect(await runHands(["create", "--spec=n8"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(3);
    expect(h.stderr()).toContain("agro hands create: top up credit at https://brain-console.example/billing\n");
    expect(h.stderr()).toContain("HTTP 403 FREE_TIER_INELIGIBLE: a free node is live");
    expect(h.stdout()).toBe("");
  });

  it("sends only the profile without flags", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 7, alias: "calm-lynx", sshHost: "h" } },
    ]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox" });
  });

  it("exits 1 when the hand fails", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 200, body: { id: "u9", status: "failed" } },
    ]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("failed");
  });

  it("exits 1 when the hand does not run before the timeout", async () => {
    const h = harness(
      [
        { status: 202, body: { id: "u9", status: "queued" } },
        { status: 200, body: { id: "u9", status: "provisioning" } },
      ],
      { timeoutMs: 3000 },
    );
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("not running");
  });

  it("rejects an unknown flag before any request", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["create", "--bogus"], h.io, h.deps)).toBe(1);
    expect(await runHands(["create", "--spec"], h.io, h.deps)).toBe(1);
    expect(h.calls).toEqual([]);
  });
});

describe("agro hands fork, pause, resume, and destroy", () => {
  for (const verb of ["pause", "resume"] as const) {
    it(`${verb} posts to the matching route for each ref form`, async () => {
      for (const [ref, path] of [
        ["#4", "4"],
        ["4", "4"],
        ["quiet-otter", "quiet-otter"],
        ["3f1c2d4e-0000-4000-8000-000000000001", "3f1c2d4e-0000-4000-8000-000000000001"],
      ]) {
        const h = harness([{ status: 202, body: { id: "u5", status: "queued" } }]);
        expect(await runHands([verb, ref], h.io, h.deps)).toBe(0);
        expect(h.calls).toHaveLength(1);
        expect(h.calls[0]).toMatchObject({
          method: "POST",
          url: `https://brain-console.example/api/nodes/${path}/${verb}`,
        });
        expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
        expect(h.all()).not.toContain(TOKEN);
      }
    });
  }

  const SOURCE = { id: "u4", status: "running", orgIndex: 4, alias: "quiet-otter", spec: "n8", sshHost: "hand-4.example" };

  it("fork reads the source spec and sends it in the body", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 202, body: { id: "u4", status: "running", jobId: "job-1" } },
    ]);
    expect(await runHands(["fork", "#4"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://brain-console.example/api/nodes/4",
      "POST https://brain-console.example/api/nodes/4/fork",
    ]);
    expect(h.calls[1].body).toEqual({ spec: "n8" });
    expect(h.calls.every((c) => c.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
  });

  it("fork --spec overrides the source spec and --name names the fork", async () => {
    const h = harness([{ status: 202, body: { id: "u4", status: "running", jobId: "job-1" } }]);
    expect(await runHands(["fork", "quiet-otter", "--spec", "n16", "--name=copy"], h.io, h.deps)).toBe(0);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      url: "https://brain-console.example/api/nodes/quiet-otter/fork",
      body: { spec: "n16", name: "copy" },
    });
  });

  it("fork waits for the fork when the console returns forkId", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 202, body: { id: "u4", status: "running", jobId: "job-1", forkId: "u9" } },
      { status: 200, body: { id: "u9", status: "provisioning", orgIndex: 9 } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 9, slug: "ample-sparrow", sshHost: "hand-9.example" } },
    ]);
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2).map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://brain-console.example/api/nodes/u9",
      "GET https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.stdout()).toBe("index: 9\nalias: ample-sparrow\nssh host: hand-9.example\n");
    expect(h.all()).not.toContain("u4");
  });

  it("fork treats 404 as pending until the fork node appears", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 202, body: { id: "u4", status: "running", jobId: "job-1", forkId: "u9" } },
      { status: 404, body: { code: "NOT_FOUND" } },
      { status: 404, body: { code: "NOT_FOUND" } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 9, alias: "ample-sparrow", sshHost: "hand-9.example" } },
    ]);
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2).map((c) => c.url)).toEqual([
      "https://brain-console.example/api/nodes/u9",
      "https://brain-console.example/api/nodes/u9",
      "https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.stdout()).toBe("index: 9\nalias: ample-sparrow\nssh host: hand-9.example\n");
  });

  it("fork exits 1 with the job id when the fork never appears before the timeout", async () => {
    const h = harness(
      [
        { status: 200, body: SOURCE },
        { status: 202, body: { id: "u4", status: "running", jobId: "job-1", forkId: "u9" } },
        { status: 404, body: { code: "NOT_FOUND" } },
      ],
      { timeoutMs: 5000 },
    );
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(1);
    expect(h.sleeps.reduce((sum, ms) => sum + ms, 0)).toBe(5000);
    expect(h.stderr()).toContain("agro hands fork: fork u9 never appeared after 15 minutes (job job-1)\n");
    expect(h.stdout()).toBe("");
  });

  it("create still fails on a 404 poll", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 404, body: { code: "NOT_FOUND" } },
    ]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(2);
    expect(h.stderr()).toContain("HTTP 404 NOT_FOUND");
  });

  it("fork exits 1 when the fork fails", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 202, body: { id: "u4", status: "running", forkId: "u9" } },
      { status: 200, body: { id: "u9", status: "failed" } },
    ]);
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("hand u9 failed");
  });

  it("fork without forkId prints the source, the job, and a list hint, not the source as the fork", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 202, body: { id: "u4", status: "running", jobId: "job-1" } },
    ]);
    expect(await runHands(["fork", "#4"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("fork of #4 requested (job job-1); run agro hands list to find the fork\n");
    expect(h.all()).not.toContain("u4");
    expect(h.calls).toHaveLength(2);
  });

  it("fork fails before the POST when the source has no spec and no --spec is given", async () => {
    const h = harness([{ status: 200, body: { ...SOURCE, spec: null } }]);
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("--spec");
    expect(h.calls).toHaveLength(1);
  });

  it("fork rejects an unknown flag or a missing flag value before any request", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["fork", "4", "--profile", "agro"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fork", "4", "--spec"], h.io, h.deps)).toBe(1);
    expect(await runHands(["fork", "4", "5"], h.io, h.deps)).toBe(1);
    expect(h.calls).toEqual([]);
  });

  it("fork prints the 403 code of the fork request and does not retry", async () => {
    const h = harness([
      { status: 200, body: SOURCE },
      { status: 403, body: { code: "BRAIN_TOKEN_TARGET_FORBIDDEN" } },
    ]);
    expect(await runHands(["fork", "4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("BRAIN_TOKEN_TARGET_FORBIDDEN");
    expect(h.calls).toHaveLength(2);
    expect(h.sleeps).toEqual([]);
  });

  it("requires exactly one hand", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["pause"], h.io, h.deps)).toBe(1);
    expect(await runHands(["pause", "1", "2"], h.io, h.deps)).toBe(1);
    expect(await runHands(["resume", "--now", "1"], h.io, h.deps)).toBe(1);
    expect(h.calls).toEqual([]);
  });

  it("names the unquoted # as the likely cause when no hand arrives", async () => {
    const cases = [["fork"], ["pause"], ["resume"], ["destroy"], ["destroy", "--yes"], ["exec"], ["exec", "--", "ls"], ["fetch"]];
    for (const args of cases) {
      const h = harness([{ status: 202 }]);
      expect(await runHands(args, h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe(`agro hands ${args[0]}: ${HAND_MISSING}\n`);
      expect(h.calls).toEqual([]);
    }
    expect(HAND_MISSING).toBe(
      "no <hand> given — an unquoted #<index> starts a shell comment; write the bare index (4) or quote '#4'",
    );
  });

  it("still accepts a quoted #4", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["pause", "#4"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].url).toBe("https://brain-console.example/api/nodes/4/pause");
  });

  it("leads the help with the bare index and warns about #", () => {
    const help = handsHelp("agro");
    expect(help).toContain("<hand> is an index (4), an alias, or a uuid.");
    expect(help).toContain("Quote '#4' if you write the # sign");
    expect(help).not.toContain("#<index>, <index>");
  });

  it("destroy asks for confirmation and aborts without a request", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["destroy", "#4"], h.io, h.deps)).toBe(1);
    expect(h.questions).toEqual(["Destroy hand #4?"]);
    expect(h.stderr()).toContain("aborted");
    expect(h.calls).toEqual([]);
  });

  it("destroy sends DELETE after confirmation", async () => {
    const h = harness([{ status: 202 }], { confirm: async () => true });
    expect(await runHands(["destroy", "#4"], h.io, h.deps)).toBe(0);
    expect(h.calls[0]).toMatchObject({ method: "DELETE", url: "https://brain-console.example/api/nodes/4" });
    expect(h.stdout()).toBe("destroyed #4\n");
  });

  it("destroy --yes skips the confirmation", async () => {
    const h = harness([{ status: 202 }]);
    expect(await runHands(["destroy", "quiet-otter", "--yes"], h.io, h.deps)).toBe(0);
    expect(h.questions).toEqual([]);
    expect(h.calls[0]).toMatchObject({ method: "DELETE", url: "https://brain-console.example/api/nodes/quiet-otter" });
  });
});

describe("agro hands 403", () => {
  const cases: [string[], string][] = [
    [["list"], "BRAIN_TOKEN_FORBIDDEN"],
    [["create"], "BRAIN_TOKEN_FORBIDDEN"],
    [["fork", "#2"], "BRAIN_TOKEN_TARGET_FORBIDDEN"],
    [["pause", "2"], "BRAIN_TOKEN_TARGET_FORBIDDEN"],
    [["resume", "alias-x"], "BRAIN_TOKEN_TARGET_FORBIDDEN"],
    [["destroy", "2", "--yes"], "BRAIN_TOKEN_TARGET_FORBIDDEN"],
  ];
  for (const [args, code] of cases) {
    it(`${args[0]} prints ${code}, exits 1, and does not retry`, async () => {
      const h = harness([{ status: 403, body: { code, error: `token ${TOKEN} may not do that` } }]);
      expect(await runHands(args, h.io, h.deps)).toBe(1);
      expect(h.calls).toHaveLength(1);
      expect(h.sleeps).toEqual([]);
      expect(h.stderr()).toContain(code);
      expect(h.all()).not.toContain(TOKEN);
    });
  }
});

describe("agro hands disposable hands", () => {
  it("create --disposable posts disposable true to the console", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "queued" } },
      { status: 200, body: { id: "u9", status: "running", orgIndex: 7, slug: "calm-lynx", sshHost: "hand-7.example" } },
    ]);
    expect(await runHands(["create", "--name", "worker", "--disposable"], h.io, h.deps)).toBe(0);
    expect(h.calls[0]).toMatchObject({
      method: "POST",
      url: "https://brain-console.example/api/nodes",
      body: { profile: "sandbox", name: "worker", disposable: true },
    });
  });

  it("create without --disposable posts no disposable key", async () => {
    const h = harness([
      { status: 202, body: { id: "u9", status: "running", orgIndex: 7, slug: "calm-lynx", sshHost: "hand-7.example" } },
    ]);
    expect(await runHands(["create", "--name", "worker"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).not.toHaveProperty("disposable");
  });

  it("refuses create --disposable on exedev hands before any provider call", async () => {
    const home = mkdtempSync(join(tmpdir(), "agro-hands-disposable-"));
    try {
      mkdirSync(join(home, ".agro"), { recursive: true });
      writeFileSync(join(home, ".agro", "config.json"), `${JSON.stringify({ version: 1, hands: { provider: "exedev" } })}\n`);
      const runs: string[][] = [];
      const h = harness([{ status: 200 }], {
        userHome: () => home,
        run: (cmd, args) => {
          runs.push([cmd, ...args]);
          return { status: 0, stdout: "{}" };
        },
      });
      expect(await runHands(["create", "--disposable"], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe("agro hands create: --disposable applies only to console hands\n");
      expect(runs).toEqual([]);
      expect(h.calls).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  const NODE_DISPOSABLE = { status: 409, body: { error: "Node is disposable", code: "NODE_DISPOSABLE" } };

  it.each([
    [["pause", "4"], "pause", "4"],
    [["resume", "quiet-otter"], "resume", "quiet-otter"],
    [["fork", "4", "--spec", "n8"], "fork", "4"],
  ])("%j prints the disposable line on HTTP 409 NODE_DISPOSABLE", async (args, verb, ref) => {
    const h = harness([NODE_DISPOSABLE]);
    expect(await runHands(args, h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.stderr()).toBe(
      `agro hands ${verb}: hand ${ref} is disposable and cannot ${verb}: delete it with agro hands destroy ${ref}\n`,
    );
    expect(h.stdout()).toBe("");
  });

  it.each([["pause"], ["resume"]])("%s keeps the console message on another HTTP 409 code", async (verb) => {
    const h = harness([{ status: 409, body: { error: "Node is busy", code: "NODE_BUSY" } }]);
    expect(await runHands([verb, "4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands ${verb}: HTTP 409 NODE_BUSY: Node is busy\n`);
  });

  it("fork keeps the console message on another HTTP 409 code", async () => {
    const h = harness([{ status: 409, body: { error: "Node is busy", code: "NODE_BUSY" } }]);
    expect(await runHands(["fork", "4", "--spec", "n8"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands fork: HTTP 409 NODE_BUSY: Node is busy\n");
  });

  it("states the disposable rules in the create help", () => {
    const help = handsHelp("agro");
    expect(help).toContain("[--code-server] [--disposable]");
    expect(help).toContain("HTTP 422 DISPOSABLE_PROFILE_UNSUPPORTED");
    expect(help).toContain("--disposable applies only to console hands");
    expect(help).toContain("HTTP 409 NODE_DISPOSABLE");
    for (const verb of ["`pause`", "`resume`", "`fork`"]) expect(help).toContain(verb);
    expect(help).toContain("agro hands destroy <hand>");
    expect(help).toContain("credit grace window");
    expect(help).toContain("low-balance email");
    expect(help).toContain("free-tier allowance");
  });
});

describe("agro hands token secrecy", () => {
  it("never prints the token, even when a request fails with it in the message", async () => {
    const failing = (async () => {
      throw new Error(`connect refused for ${TOKEN}`);
    }) as typeof fetch;
    const h = harness([{ status: 200 }], { fetch: failing });
    expect(await runHands(["list"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("request failed");
    expect(h.all()).not.toContain(TOKEN);
  });
});

const LOCAL_KEY_PATH = join(USER_HOME, ".ssh", "id_ed25519.pub");
const LOCAL_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIlocal op@laptop\n";
const QUEUED: Reply = { status: 202, body: { id: "u9", status: "queued" } };
const RUNNING_HAND = {
  id: "u9",
  status: "running",
  orgIndex: 7,
  alias: "calm-lynx",
  name: "worker",
  profile: "agro",
  spec: "n4",
  sshHost: "hand-7.example",
};
const RUNNING: Reply = { status: 200, body: RUNNING_HAND };
const BASE_CREATE = ["create", "--ssh-key", "key-1"];
const APP_FLAGS = [
  ["--docker", { docker: true }],
  ["--t3", { t3: true }],
  ["--code-server", { runtimeSettings: { codeServerEnabled: true } }],
] as const;
const APP_FLAG_NAMES = APP_FLAGS.map(([flag]) => flag);

function operator(replies: Reply[], files: Record<string, string> = { [LOCAL_KEY_PATH]: LOCAL_KEY }) {
  const read = brainFiles(files);
  return {
    ...harness(replies, {
      env: {},
      readFile: read.readFile,
      readCredentials: credentials(TOKEN, "https://console.example/"),
      hostname: () => "laptop",
    }),
    reads: read.reads,
  };
}

describe("agro hands create profile and app flags", () => {
  it("posts the sandbox profile and the keys without a new flag", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(BASE_CREATE, h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["key-1"] });
  });

  it.each([[["--profile", "agro"]], [["--profile=agro"]]])("posts the agro profile with %j and no app field", async (flag) => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, ...flag], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"] });
  });

  it("posts the sandbox profile with --profile sandbox", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile", "sandbox"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["key-1"] });
  });

  it("posts docker, t3, and codeServerEnabled with all app flags", async () => {
    const h = harness([QUEUED, RUNNING]);
    const args = [...BASE_CREATE, "--profile", "agro", "--docker", "--t3", "--code-server"];
    expect(await runHands(args, h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({
      profile: "agro",
      sshKeyIds: ["key-1"],
      docker: true,
      t3: true,
      runtimeSettings: { codeServerEnabled: true },
    });
  });

  it.each(APP_FLAGS)("posts only the field of %s with --profile agro", async (flag, field) => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile", "agro", flag], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"], ...field });
  });

  it("rejects a profile other than agro or sandbox before any request", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile", "desktop"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --profile must be agro or sandbox\n");
    expect(h.calls).toEqual([]);
  });

  it("rejects --profile without a value before any request", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --profile requires a value\n");
    expect(h.calls).toEqual([]);
  });

  it.each(APP_FLAG_NAMES)("rejects %s with the default profile before key resolution", async (flag) => {
    const h = operator([QUEUED, RUNNING]);
    expect(await runHands(["create", flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands create: ${flag} requires --profile agro\n`);
    expect(h.reads).not.toContain(LOCAL_KEY_PATH);
    expect(h.calls).toEqual([]);
  });

  it.each(APP_FLAG_NAMES)("rejects %s with --profile sandbox before any request", async (flag) => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile", "sandbox", flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands create: ${flag} requires --profile agro\n`);
    expect(h.calls).toEqual([]);
  });

  it("prints the HTTP status and code when runtime settings are disabled", async () => {
    const h = harness([{ status: 422, body: { error: "Runtime settings are disabled", code: "RUNTIME_SETTINGS_DISABLED" } }]);
    expect(await runHands([...BASE_CREATE, "--profile", "agro", "--code-server"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("HTTP 422 RUNTIME_SETTINGS_DISABLED: Runtime settings are disabled");
    expect(h.calls).toHaveLength(1);
  });

  it("posts --profile agro --disposable and prints the sandbox-only line on HTTP 422", async () => {
    const h = harness([{ status: 422, body: { error: "Only sandbox nodes can be disposable", code: "DISPOSABLE_PROFILE_UNSUPPORTED" } }]);
    expect(await runHands([...BASE_CREATE, "--profile", "agro", "--disposable"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"], disposable: true });
    expect(h.stderr()).toBe(
      "agro hands create: only a sandbox node can be disposable: drop --disposable, or use --profile sandbox\n",
    );
    expect(h.stdout()).toBe("");
  });

  it("shows the new flags in the help", () => {
    const help = handsHelp("agro");
    expect(help).toContain(
      "agro hands create [--name <name>] [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--disposable] [--desktop] [--ssh-key <uuid>]... [--count <N>] [--json] [--project <owner>/<repo> | --clone <owner>/<repo>]",
    );
    for (const flag of ["--profile", "--json", "--ssh-key", "--count", ...APP_FLAG_NAMES]) expect(help).toContain(`\`${flag}`);
    expect(help).toContain("--count must be an integer from 1 to 10");
    expect(help).toContain("hand <k> of <N>: <error>");
    expect(help).toContain("--ssh-key, --count, and --json apply only to console hands.");
    expect(help).toContain("agro, docker, and desktop for the");
    expect(help).toContain("With \`--spec n2\`, \`create\`");
    expect(help).not.toContain("sends the tools docker and desktop");
  });
});

describe("agro hands create ssh key resolution", () => {
  it("reuses a console key whose type and body match the local key", async () => {
    const h = operator([
      {
        status: 200,
        body: {
          sshKeys: [
            { id: "other", name: "x", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIother op@laptop" },
            { id: "match", name: "y", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIlocal a-different-comment" },
          ],
        },
      },
      QUEUED,
      RUNNING,
    ]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(h.reads).toContain(LOCAL_KEY_PATH);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://console.example/api/ssh-keys",
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/nodes/u9",
    ]);
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.calls[1].body).toEqual({ profile: "sandbox", sshKeyIds: ["match"] });
  });

  it("registers the local key when no console key matches", async () => {
    const h = operator([
      { status: 200, body: { sshKeys: [{ id: "other", publicKey: "ssh-rsa AAAAC3NzaC1lZDI1NTE5AAAAIlocal" }] } },
      { status: 201, body: { sshKey: { id: "new-key", name: "agro-cli@laptop" } } },
      QUEUED,
      RUNNING,
    ]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(0, 3).map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://console.example/api/ssh-keys",
      "POST https://console.example/api/ssh-keys",
      "POST https://console.example/api/nodes",
    ]);
    expect(h.calls[1].body).toEqual({ name: "agro-cli@laptop", publicKey: LOCAL_KEY.trim() });
    expect(h.calls[2].body).toMatchObject({ sshKeyIds: ["new-key"] });
  });

  it("accepts a top-level id in the register response", async () => {
    const h = operator([{ status: 200, body: { sshKeys: [] } }, { status: 201, body: { id: "top-key" } }, QUEUED, RUNNING]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls[2].body).toMatchObject({ sshKeyIds: ["top-key"] });
  });

  it("exits 1 and creates no hand when the local key file does not exist", async () => {
    const h = operator([QUEUED, RUNNING], {});
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.reads).toContain(LOCAL_KEY_PATH);
    expect(h.stderr()).toBe("agro hands create: no --ssh-key given and ~/.ssh/id_ed25519.pub not found\n");
    expect(h.calls).toEqual([]);
    expect(h.stdout()).toBe("");
  });

  it("uses only the given --ssh-key flags and makes no ssh-keys call", async () => {
    const h = operator([QUEUED, RUNNING]);
    expect(await runHands(["create", "--ssh-key", "a", "--ssh-key=b"], h.io, h.deps)).toBe(0);
    expect(h.reads).not.toContain(LOCAL_KEY_PATH);
    expect(h.calls[0]).toMatchObject({ method: "POST", url: "https://console.example/api/nodes" });
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["a", "b"] });
  });

  it("exits 1 with the API error when the key list fails", async () => {
    const h = operator([{ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("HTTP 403 FORBIDDEN");
    expect(h.calls).toHaveLength(1);
  });

  it("exits 1 when the register response has no key id", async () => {
    const h = operator([{ status: 200, body: { sshKeys: [] } }, { status: 201, body: {} }]);
    expect(await runHands(["create"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("the console response has no SSH key id");
    expect(h.calls).toHaveLength(2);
  });

  it("sends no key from the local file on a brain", async () => {
    const files = brainFiles({
      [TOKEN_PATH]: TOKEN,
      [URL_PATH]: "https://brain-console.example",
      [LOCAL_KEY_PATH]: LOCAL_KEY,
    });
    const h = harness([QUEUED, RUNNING], { readFile: files.readFile });
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(files.reads).not.toContain(LOCAL_KEY_PATH);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://brain-console.example/api/nodes",
      "GET https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.calls[0].body).toEqual({ profile: "sandbox" });
  });

  it("sends --ssh-key ids on a brain", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(["create", "--ssh-key", "k1"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["k1"] });
  });

  it("rejects --ssh-key without a value before any request", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(["create", "--ssh-key"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --ssh-key requires a value\n");
    expect(h.calls).toEqual([]);
  });
});

const CREATED_JSON = {
  id: "u9",
  index: 7,
  alias: "calm-lynx",
  name: "worker",
  status: "running",
  spec: "n4",
  sshHost: "hand-7.example",
  ssh: "ssh sandbox@hand-7.example",
};

describe("agro hands create --json", () => {
  it("prints one JSON line and keeps the status lines on stderr", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(0);
    expect(h.stdout().split("\n")).toEqual([JSON.stringify(CREATED_JSON), ""]);
    expect(h.stderr()).toContain("agro hands create: hand u9 running\n");
  });

  it("prints ssh null without an SSH host", async () => {
    const h = harness([QUEUED, { status: 200, body: { ...RUNNING_HAND, sshHost: null } }]);
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ ...CREATED_JSON, sshHost: null, ssh: null });
  });

  it.each(["failed", "provisioning"])("prints ssh null for a %s hand with an SSH host", async (status) => {
    const h = harness([QUEUED, { status: 200, body: { ...RUNNING_HAND, status } }], { timeoutMs: 3000 });
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(1);
    expect(JSON.parse(h.stdout())).toEqual({ ...CREATED_JSON, status, ssh: null });
  });

  it("reports the n4 fallback spec when the console node has no spec", async () => {
    const h = harness([
      { status: 402, body: { error: "Add credit", code: "CREDIT_REQUIRED" } },
      { status: 200, body: { eligible: true } },
      QUEUED,
      { status: 200, body: { ...RUNNING_HAND, spec: null } },
    ]);
    expect(await runHands(["create", "--spec", "n8", "--json"], h.io, h.deps)).toBe(0);
    expect(h.calls[2].body).toMatchObject({ spec: "n4", freeTier: true });
    expect(JSON.parse(h.stdout())).toEqual(CREATED_JSON);
  });

  it("reports the n4 fallback spec on a failed wait", async () => {
    const h = harness([
      { status: 402, body: { error: "Add credit", code: "CREDIT_REQUIRED" } },
      { status: 200, body: { eligible: true } },
      QUEUED,
      { status: 200, body: { id: "u9", status: "failed" } },
    ]);
    expect(await runHands(["create", "--spec", "n8", "--json"], h.io, h.deps)).toBe(1);
    expect(JSON.parse(h.stdout())).toMatchObject({ status: "failed", spec: "n4", ssh: null });
  });

  it("prefers the spec that the console reports", async () => {
    const h = harness([QUEUED, { status: 200, body: { ...RUNNING_HAND, spec: "n16" } }]);
    expect(await runHands(["create", "--spec", "n8", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toMatchObject({ spec: "n16" });
  });

  it("prints the JSON line with the last status before it exits 1 on a timeout", async () => {
    const h = harness([QUEUED, { status: 200, body: { ...RUNNING_HAND, status: "provisioning", sshHost: null } }], {
      timeoutMs: 3000,
    });
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(1);
    expect(JSON.parse(h.stdout())).toEqual({ ...CREATED_JSON, status: "provisioning", sshHost: null, ssh: null });
    expect(h.stderr()).toContain("not running after 15 minutes");
  });

  it("prints the JSON line before it exits 1 when the hand fails", async () => {
    const h = harness([QUEUED, { status: 200, body: { id: "u9", status: "failed" } }]);
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(1);
    expect(JSON.parse(h.stdout())).toEqual({
      id: "u9",
      index: null,
      alias: null,
      name: null,
      status: "failed",
      spec: null,
      sshHost: null,
      ssh: null,
    });
    expect(h.stderr()).toContain("hand u9 failed");
  });

  it("prints nothing on stdout when the console returns no node", async () => {
    const h = harness([{ status: 500, body: { code: "INTERNAL" } }]);
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe("");
  });

  it.each([[["--project", "acme/widget"]], [["--clone", "acme/widget"]]])("refuses --json with %j", async (flag) => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(["create", "--json", ...flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --json excludes --project and --clone\n");
    expect(h.calls).toEqual([]);
  });
});

describe("agro hands destroy admin role", () => {
  it("prints the admin role line on HTTP 403 with no error code", async () => {
    const h = operator([{ status: 403, body: { error: "forbidden" } }]);
    expect(await runHands(["destroy", "4", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands destroy: destroy needs the admin role in agro-console\n");
  });

  it.each(["ONBOARDING_REQUIRED", "PAYMENTS_DISABLED", "FORBIDDEN"])("prints the console message on HTTP 403 %s", async (code) => {
    const h = operator([{ status: 403, body: { error: "not allowed", code } }]);
    expect(await runHands(["destroy", "4", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands destroy: HTTP 403 ${code}: not allowed\n`);
  });
});

describe("agro hands check", () => {
  const LOCAL_KEY = "ssh-ed25519 AAAAlocal op@laptop";
  const LOCAL_KEY_PATH = join(USER_HOME, ".ssh", "id_ed25519.pub");
  const KEYS = { status: 200, body: { sshKeys: [{ id: "key-1", publicKey: "ssh-ed25519 AAAAlocal other@host" }, { id: "key-2", publicKey: "ssh-ed25519 AAAAother" }] } };
  const ELIGIBLE = { status: 200, body: { eligible: true } };
  const balance = (balanceMicros: number, overrides: Record<string, unknown> = {}) => ({
    status: 200,
    body: { balanceMicros, hasCard: false, paymentsEnabled: true, canManage: true, autoTopup: null, ...overrides },
  });
  const FUNDED = balance(12_345_678);
  const AUTO_TOPUP = { amountUsd: 20, thresholdUsd: 5 };
  const RETIRED_FLAG = ["--free", "tier"].join("-");
  const LOCAL_SSH_KEY_MISSING = "no --ssh-key given and ~/.ssh/id_ed25519.pub not found";
  const withLocalKey = { readFile: (path: string) => (path === LOCAL_KEY_PATH ? `${LOCAL_KEY}\n` : undefined) };
  const methods = (calls: Recorded[]) => calls.map((c) => `${c.method} ${c.url}`);
  const BOTH = [
    "GET https://console.example/api/ssh-keys",
    "GET https://console.example/api/free-tier",
    "GET https://console.example/api/billing/balance",
  ];
  const checkHarness = (replies: Reply[], overrides: Partial<HandsDeps> = {}) =>
    harness(replies, {
      env: {},
      readFile: () => undefined,
      readCredentials: credentials(TOKEN, "https://console.example"),
      ...overrides,
    });

  it("finds the local public key by identity and checks the free tier with GET only", async () => {
    const h = checkHarness([KEYS, ELIGIBLE, FUNDED], withLocalKey);
    expect(await runHands(["check"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("ok ssh-key key-1 ~/.ssh/id_ed25519.pub\nok free-tier\nok credit: balance $12.35\n");
    expect(methods(h.calls)).toEqual(BOTH);
    expect(h.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("fails without a POST when the local public key is not registered", async () => {
    const h = checkHarness([{ status: 200, body: { sshKeys: [{ id: "key-2", publicKey: "ssh-ed25519 AAAAother" }] } }, ELIGIBLE, FUNDED], withLocalKey);
    expect(await runHands(["check"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toMatch(/^fail ssh-key ~\/\.ssh\/id_ed25519\.pub: not registered in agro-console — .*--ssh-key <uuid>\nok free-tier\nok credit: balance \$12\.35\n$/);
    expect(h.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("fails with a remedy when the local public key file is missing and reads only the free tier", async () => {
    const h = checkHarness([ELIGIBLE, FUNDED]);
    expect(await runHands(["check"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain(`fail ssh-key: ${LOCAL_SSH_KEY_MISSING} — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>`);
    expect(methods(h.calls)).toEqual(["GET https://console.example/api/free-tier", "GET https://console.example/api/billing/balance"]);
  });

  it("finds each --ssh-key id and fails on an unknown id", async () => {
    const h = checkHarness([KEYS, ELIGIBLE, FUNDED]);
    expect(await runHands(["check", "--ssh-key", "key-2", "--ssh-key=key-9"], h.io, h.deps)).toBe(1);
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
    const h = checkHarness([KEYS, ELIGIBLE, FUNDED]);
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("ok ssh-key key-1\nok free-tier\nok credit: balance $12.35\n");
    expect(methods(h.calls)).toEqual(BOTH);
  });

  it("warns with the code and the reason when the account is not eligible and keeps exit 0", async () => {
    const h = checkHarness([KEYS, { status: 200, body: { eligible: false, code: "FREE_TIER_INELIGIBLE", reason: "a free node is live" } }, FUNDED]);
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toContain("ok ssh-key key-1\n");
    expect(h.stdout()).toMatch(/\nwarn free-tier: not eligible \(FREE_TIER_INELIGIBLE: a free node is live\) — .*agro auth login in the personal context\nok credit: balance \$12\.35\n$/);
  });

  it("keeps exit 1 for a failed key check when the account is not eligible", async () => {
    const h = checkHarness([KEYS, { status: 200, body: { eligible: false } }, FUNDED]);
    expect(await runHands(["check", "--ssh-key", "key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("warn free-tier: not eligible — ");
  });

  it("names onboarding and the personal context on a 403 onboarding reply", async () => {
    const h = checkHarness([KEYS, { status: 403, body: { error: "Onboarding required" } }, FUNDED]);
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("fail free-tier: HTTP 403 no code: Onboarding required — finish agro-console onboarding, or run agro auth login in the personal context\n");
  });

  it("never sends a POST or a DELETE across every check outcome", async () => {
    const h = checkHarness([{ status: 200, body: { sshKeys: [] } }, { status: 200, body: { eligible: false } }, balance(0)], withLocalKey);
    expect(await runHands(["check"], h.io, h.deps)).toBe(1);
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
    const h = checkHarness([KEYS, ELIGIBLE, reply]);
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`ok ssh-key key-1\nok free-tier\n${line}\n`);
    expect(methods(h.calls)).toEqual(BOTH);
  });

  it("keeps exit 1 on a failed key check whatever the credit line says", async () => {
    const h = checkHarness([KEYS, ELIGIBLE, balance(5_000_000)]);
    expect(await runHands(["check", "--ssh-key", "key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("ok credit: balance $5.00\n");
  });

  it("names the credit line in the help", () => {
    const help = handsHelp("agro");
    expect(help).toContain("credit line");
    expect(help).toContain("/api/billing/balance");
  });

  it("rejects an unknown flag before any request", async () => {
    const h = checkHarness([KEYS]);
    expect(await runHands(["check", "--spec", "n4"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe('agro hands check: unknown flag "--spec"\n');
    expect(h.calls).toEqual([]);
  });

  it("rejects the retired free tier flag before any request", async () => {
    const h = checkHarness([KEYS]);
    expect(await runHands(["check", RETIRED_FLAG], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe(`agro hands check: unknown flag "${RETIRED_FLAG}"\n`);
    expect(h.calls).toEqual([]);
  });

  it("lists check in the verbs and the help", () => {
    expect(HANDS_VERBS).toContain("check");
    expect(handsHelp("agro")).toContain("agro hands check [--ssh-key <uuid>]...");
  });

  it("reads the nodes and each --ssh-key id with brain authority and skips the operator reads", async () => {
    const h = harness([{ status: 200, body: [] }, KEYS]);
    expect(await runHands(["check", "--ssh-key", "key-1", "--ssh-key", "key-9"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe(
      "ok console: https://brain-console.example\nok ssh-key key-1\nfail ssh-key key-9: not found in agro-console — pass the id of an SSH key in agro-console\n",
    );
    expect(methods(h.calls)).toEqual([
      "GET https://brain-console.example/api/nodes",
      "GET https://brain-console.example/api/ssh-keys",
    ]);
  });

  it("reads only the nodes with brain authority and no --ssh-key, without the local key", async () => {
    const reads: string[] = [];
    const files = { [TOKEN_PATH]: TOKEN, [URL_PATH]: "https://brain-console.example", [LOCAL_KEY_PATH]: LOCAL_KEY };
    const h = harness([{ status: 200, body: [] }], {
      readFile: (path) => {
        reads.push(path);
        return files[path];
      },
    });
    expect(await runHands(["check"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("ok console: https://brain-console.example\n");
    expect(methods(h.calls)).toEqual(["GET https://brain-console.example/api/nodes"]);
    expect(reads).not.toContain(LOCAL_KEY_PATH);
  });

  it("fails the console line with brain authority from an env token when the nodes read fails", async () => {
    const h = harness([{ status: 403, body: { error: "revoked", code: "BRAIN_TOKEN_REVOKED" } }], {
      env: { AGRO_CONSOLE_TOKEN: TOKEN, AGRO_CONSOLE_URL: "https://console.example" },
      readFile: () => undefined,
      readCredentials: credentials("cred"),
    });
    expect(await runHands(["check"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe("fail console: HTTP 403 BRAIN_TOKEN_REVOKED: revoked\n");
    expect(methods(h.calls)).toEqual(["GET https://console.example/api/nodes"]);
  });

  it("sends the three operator reads in parallel and prints them in a fixed order", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const replies: Record<string, unknown> = {
      "/api/ssh-keys": KEYS.body,
      "/api/free-tier": ELIGIBLE.body,
      "/api/billing/balance": FUNDED.body,
    };
    const fetchStub = (async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      order.push(path);
      if (order.length === 3) release();
      await gate;
      return new Response(JSON.stringify(replies[path]), { status: 200 });
    }) as typeof fetch;
    const h = checkHarness([], { fetch: fetchStub });
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(order).toHaveLength(3);
    expect(h.stdout()).toBe("ok ssh-key key-1\nok free-tier\nok credit: balance $12.35\n");
  });

  it("never prints the token in a check line", async () => {
    const h = checkHarness([KEYS, ELIGIBLE, { status: 500, body: { error: `bad token ${TOKEN}` } }]);
    expect(await runHands(["check", "--ssh-key", "key-1"], h.io, h.deps)).toBe(0);
    expect(h.all()).not.toContain(TOKEN);
    expect(h.stdout()).toContain("warn credit: HTTP 500 no code: bad token [redacted]\n");
  });
});

describe("agro hands create --desktop", () => {
  const TAILNET_NAME = "calm-lynx.tail1234.ts.net";
  const TAILNET_ADDRESS = "100.64.0.7";
  const DESKTOP_HAND = { ...RUNNING_HAND, desktop: true, rdpListening: false, tailnetName: null, tailnetAddress: null };
  const DESKTOP_RUNNING: Reply = { status: 200, body: DESKTOP_HAND };
  const RDP_DOWN: Reply = { status: 200, body: DESKTOP_HAND };
  const RDP_UP: Reply = {
    status: 200,
    body: { ...DESKTOP_HAND, rdpListening: true, tailnetName: TAILNET_NAME, tailnetAddress: TAILNET_ADDRESS },
  };
  const SPEC_TOO_SMALL: Reply = {
    status: 422,
    body: { error: "The desktop tool needs a larger spec", code: "SPEC_TOO_SMALL_FOR_TOOL" },
  };
  const IMAGE_UNAVAILABLE: Reply = {
    status: 503,
    body: { error: "No desktop image in this region", code: "DESKTOP_IMAGE_UNAVAILABLE" },
  };
  const NEXT_LINES =
    "next: ssh sandbox@hand-7.example\n" +
    "next: tailscale up\n" +
    "next: sudo passwd sandbox\n" +
    "next: open the Connect card of the hand in the console and download the .rdp file\n";
  const RUNNING_LINES = "index: 7\nalias: calm-lynx\nssh host: hand-7.example\n";
  const TIMEOUT_WARNING =
    "warning: hand u9 is running but xrdp is not listening after 120 s; check with agro hands exec u9 -- systemctl status xrdp";

  const OPERATOR = { readCredentials: credentials("cred") };
  const SANDBOX_TOOLS = ["agro", "docker", "desktop"];
  const AGRO_TOOLS = ["docker", "desktop"];

  it.each([[[]], [["--profile", "sandbox"]]])("posts the sandbox role tools and no docker field with %j", async (flag) => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP]);
    expect(await runHands([...BASE_CREATE, ...flag, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["key-1"], tools: SANDBOX_TOOLS });
  });

  it.each([[[]], [["--docker"]]])(
    "posts the agro role tools and no docker field with --profile agro and %j under operator authority",
    async (flag) => {
      const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP], OPERATOR);
      expect(await runHands(["--operator", ...BASE_CREATE, "--profile", "agro", ...flag, "--desktop"], h.io, h.deps)).toBe(0);
      expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"], tools: AGRO_TOOLS });
    },
  );

  it("posts the sandbox role tools under operator authority without --profile", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP], OPERATOR);
    expect(await runHands(["--operator", ...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "sandbox", sshKeyIds: ["key-1"], tools: SANDBOX_TOOLS });
  });

  it.each([[[]], [["--docker"]]])(
    "posts the sandbox role tools with --profile agro and %j under brain authority",
    async (flag) => {
      const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP]);
      expect(await runHands([...BASE_CREATE, "--profile", "agro", ...flag, "--desktop"], h.io, h.deps)).toBe(0);
      expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"], tools: SANDBOX_TOOLS });
    },
  );

  it("sends no spec field with --desktop and no --spec", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).not.toHaveProperty("spec");
  });

  it("posts no tools field without --desktop", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--profile", "agro", "--docker"], h.io, h.deps)).toBe(0);
    expect(h.calls[0].body).toEqual({ profile: "agro", sshKeyIds: ["key-1"], docker: true });
    expect(h.calls).toHaveLength(2);
  });

  it("keeps tools on the n4 free tier retry", async () => {
    const h = harness([
      { status: 402, body: { error: "Add credit", code: "CREDIT_REQUIRED" } },
      { status: 200, body: { eligible: true } },
      QUEUED,
      DESKTOP_RUNNING,
      RDP_UP,
    ]);
    expect(await runHands([...BASE_CREATE, "--spec", "n8", "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls[2].body).toEqual({
      profile: "sandbox",
      sshKeyIds: ["key-1"],
      spec: "n4",
      tools: SANDBOX_TOOLS,
      freeTier: true,
    });
  });

  it("refuses --desktop on exedev hands before any provider call", async () => {
    const home = mkdtempSync(join(tmpdir(), "agro-hands-desktop-"));
    try {
      const runs: string[][] = [];
      const h = harness([{ status: 200 }], {
        userHome: () => home,
        run: (cmd, args) => {
          runs.push([cmd, ...args]);
          return { status: 0, stdout: "{}" };
        },
      });
      expect(await runHands(["--provider", "exedev", "create", "--desktop"], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe("agro hands create: --desktop applies only to console hands\n");
      expect(runs).toEqual([]);
      expect(h.calls).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it.each([[BASE_CREATE], [["--operator", "create"]]])(
    "refuses --desktop --spec n2 with the spec line and sends no console request: %j",
    async (args) => {
      const h = harness([SPEC_TOO_SMALL], OPERATOR);
      expect(await runHands([...args, "--spec", "n2", "--desktop"], h.io, h.deps)).toBe(1);
      expect(h.calls).toEqual([]);
      expect(h.stderr()).toBe(
        "agro hands create: the desktop needs at least n4 (4 GB); use --spec n4 or larger (n8 recommended)\n",
      );
      expect(h.stdout()).toBe("");
    },
  );

  it("prints the spec line and exits 1 on HTTP 422 SPEC_TOO_SMALL_FOR_TOOL", async () => {
    const h = harness([SPEC_TOO_SMALL]);
    expect(await runHands([...BASE_CREATE, "--spec", "n4", "--desktop"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.stderr()).toBe(
      "agro hands create: the desktop needs at least n4 (4 GB); use --spec n4 or larger (n8 recommended)\n",
    );
    expect(h.stdout()).toBe("");
  });

  it("prints the image line and exits 1 on HTTP 503 DESKTOP_IMAGE_UNAVAILABLE", async () => {
    const h = harness([IMAGE_UNAVAILABLE]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(1);
    expect(h.calls).toHaveLength(1);
    expect(h.stderr()).toBe("agro hands create: desktop hands are unavailable right now: the desktop image is missing\n");
    expect(h.stdout()).toBe("");
  });

  it("polls the node until xrdp listens, then prints the desktop and next lines", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN, RDP_DOWN, RDP_UP]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://brain-console.example/api/nodes/u9",
      "GET https://brain-console.example/api/nodes/u9",
      "GET https://brain-console.example/api/nodes/u9",
      "GET https://brain-console.example/api/nodes/u9",
    ]);
    expect(h.sleeps).toEqual([1000, 5000, 5000]);
    expect(h.stdout()).toBe(`${RUNNING_LINES}desktop: xrdp listening on ${TAILNET_NAME}:3389\n${NEXT_LINES}`);
    expect(h.stderr()).not.toContain("warning");
  });

  it("warns on stderr and exits 0 when xrdp does not listen after 120 s", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.stderr()).toContain(`agro hands create: ${TIMEOUT_WARNING}\n`);
    expect(h.stdout()).toBe(`${RUNNING_LINES}desktop: xrdp not listening\n${NEXT_LINES}`);
    expect(h.sleeps.slice(1).reduce((sum, ms) => sum + ms, 0)).toBe(120_000);
  });

  it("takes the injected desktop poll interval and timeout", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN], { desktopPollMs: 10, desktopTimeoutMs: 30 });
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.sleeps.slice(1)).toEqual([10, 10, 10]);
    expect(h.calls.slice(2)).toHaveLength(4);
    expect(h.stderr()).toContain("is running but xrdp is not listening");
  });

  it("states the measured wait in the timeout warning", async () => {
    let clock = 0;
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN], {
      desktopPollMs: 10_000,
      desktopTimeoutMs: 30_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms + 7000;
      },
    });
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.stderr()).toContain(
      "warning: hand u9 is running but xrdp is not listening after 34 s; check with agro hands exec u9 -- systemctl status xrdp\n",
    );
  });

  it("stops polling on HTTP 401 and warns with the API error", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 401, body: { error: "token revoked", code: "UNAUTHORIZED" } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2)).toHaveLength(1);
    expect(h.sleeps).toEqual([1000]);
    expect(h.stderr()).toContain(
      "agro hands create: warning: hand u9 desktop state unknown: HTTP 401 UNAUTHORIZED: token revoked\n",
    );
    expect(h.stderr()).not.toContain("xrdp is not listening");
  });

  it("warns with the API error when every desktop read fails", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 500, body: { error: "boom" } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.sleeps.slice(1).reduce((sum, ms) => sum + ms, 0)).toBe(120_000);
    expect(h.stderr()).toContain("agro hands create: warning: hand u9 desktop state unknown: HTTP 500 no code: boom\n");
    expect(h.stderr()).not.toContain("xrdp is not listening");
  });

  it("prints no warning after a transient read failure and then xrdp listening", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 500, body: { error: "boom" } }, RDP_UP]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.stderr()).not.toContain("warning");
    expect(h.stdout()).toContain(`desktop: xrdp listening on ${TAILNET_NAME}:3389\n`);
  });

  it("omits the ssh next line when the hand has no SSH host", async () => {
    const noHost = { ...DESKTOP_HAND, sshHost: null };
    const h = harness([QUEUED, { status: 200, body: noHost }, { status: 200, body: { ...noHost, rdpListening: true } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).not.toContain("next: ssh");
    expect(h.stdout()).toContain("next: tailscale up\n");
  });

  it("clones the project before it waits for the desktop", async () => {
    const runAt: number[] = [];
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN, RDP_UP], {
      run: () => {
        runAt.push(h.calls.length);
        return { status: 0 };
      },
    });
    expect(await runHands([...BASE_CREATE, "--desktop", "--clone", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(runAt).toEqual([2]);
    expect(h.calls).toHaveLength(4);
    expect(h.stdout().indexOf("project: ~/projects/acme/widget\n")).toBeLessThan(h.stdout().indexOf("desktop: "));
  });

  it("pushes the brain project before it waits for the desktop", async () => {
    const runAt: Array<[string, number]> = [];
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN, RDP_UP], {
      exists: () => true,
      run: (cmd, args) => {
        runAt.push([`${cmd} ${args.includes("symbolic-ref") ? "symbolic-ref" : args.includes("push") ? "push" : ""}`.trim(), h.calls.length]);
        return args.includes("symbolic-ref") ? { status: 0, stdout: "main\n" } : { status: 0 };
      },
    });
    expect(await runHands([...BASE_CREATE, "--desktop", "--project", "acme/widget"], h.io, h.deps)).toBe(0);
    expect(runAt).toEqual([
      ["git symbolic-ref", 0],
      ["ssh", 2],
      ["git", 2],
      ["git push", 2],
    ]);
    expect(h.calls).toHaveLength(4);
  });

  it("adds the desktop object to the --json line", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP]);
    expect(await runHands([...BASE_CREATE, "--desktop", "--json"], h.io, h.deps)).toBe(0);
    const lines = h.stdout().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({
      ...CREATED_JSON,
      desktop: { rdpListening: true, tailnetName: TAILNET_NAME, rdpAddress: `${TAILNET_NAME}:3389` },
    });
  });

  it("takes the tailnet address for rdpAddress without a tailnet name", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 200, body: { ...DESKTOP_HAND, rdpListening: true, tailnetAddress: TAILNET_ADDRESS } }]);
    expect(await runHands([...BASE_CREATE, "--desktop", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout()).desktop).toEqual({
      rdpListening: true,
      tailnetName: null,
      rdpAddress: `${TAILNET_ADDRESS}:3389`,
    });
  });

  it("prints rdpAddress null and the warning when xrdp does not listen with --json", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN]);
    expect(await runHands([...BASE_CREATE, "--desktop", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout()).desktop).toEqual({ rdpListening: false, tailnetName: null, rdpAddress: null });
    expect(h.stderr()).toContain(TIMEOUT_WARNING);
  });

  it("prints the desktop and next lines and returns the clone status when the clone fails", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP], { run: () => ({ status: 128 }) });
    expect(await runHands([...BASE_CREATE, "--desktop", "--clone", "acme/widget"], h.io, h.deps)).toBe(128);
    expect(h.stderr()).toContain("git clone on hand");
    expect(h.stdout()).toBe(
      `${RUNNING_LINES}project: ~/projects/acme/widget\ndesktop: xrdp listening on ${TAILNET_NAME}:3389\n${NEXT_LINES}`,
    );
  });

  it("stops polling and warns when the hand leaves running", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, RDP_DOWN, { status: 200, body: { ...DESKTOP_HAND, status: "stopped" } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2)).toHaveLength(2);
    expect(h.stderr()).toContain("agro hands create: warning: hand u9 is stopped; the desktop is not reachable\n");
    expect(h.stderr()).not.toContain("xrdp is not listening");
    expect(h.stdout()).toBe(`${RUNNING_LINES}desktop: xrdp not listening\n${NEXT_LINES}`);
  });

  it("stops polling on HTTP 400", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 400, body: { error: "bad id", code: "BAD_REQUEST" } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2)).toHaveLength(1);
    expect(h.stderr()).toContain("agro hands create: warning: hand u9 desktop state unknown: HTTP 400 BAD_REQUEST: bad id\n");
  });

  it.each([408, 429])("keeps polling after HTTP %i", async (status) => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status, body: { error: "later" } }, RDP_UP]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls.slice(2)).toHaveLength(2);
    expect(h.stderr()).not.toContain("warning");
    expect(h.stdout()).toContain(`desktop: xrdp listening on ${TAILNET_NAME}:3389\n`);
  });

  it("prints rdpAddress null in --json when a tailnet name exists but xrdp does not listen", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 200, body: { ...DESKTOP_HAND, tailnetName: TAILNET_NAME } }]);
    expect(await runHands([...BASE_CREATE, "--desktop", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout()).desktop).toEqual({ rdpListening: false, tailnetName: TAILNET_NAME, rdpAddress: null });
  });

  it("prints no address in text when a tailnet name exists but xrdp does not listen", async () => {
    const h = harness([QUEUED, DESKTOP_RUNNING, { status: 200, body: { ...DESKTOP_HAND, tailnetName: TAILNET_NAME } }]);
    expect(await runHands([...BASE_CREATE, "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`${RUNNING_LINES}desktop: xrdp not listening\n${NEXT_LINES}`);
  });

  it("prints no desktop field in the --json line without --desktop", async () => {
    const h = harness([QUEUED, RUNNING]);
    expect(await runHands(["create", "--json"], h.io, h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).not.toHaveProperty("desktop");
  });

  it("clones over SSH with a fresh known_hosts path and pins the host key by the hand uuid", async () => {
    const home = mkdtempSync(join(tmpdir(), "agro-hands-desktop-known-hosts-"));
    try {
      const runs: string[][] = [];
      const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP], {
        userHome: () => home,
        run: (cmd, args) => {
          runs.push([cmd, ...args]);
          return { status: 0 };
        },
      });
      expect(await runHands([...BASE_CREATE, "--desktop", "--clone", "acme/widget"], h.io, h.deps)).toBe(0);
      expect(existsSync(join(home, ".ssh", "known_hosts"))).toBe(false);
      expect(runs).toHaveLength(1);
      expect(runs[0].slice(0, 5)).toEqual(["ssh", "-o", "StrictHostKeyChecking=accept-new", "-o", "HostKeyAlias=u9"]);
      expect(runs[0]).toContain("sandbox@hand-7.example");
      expect(h.stdout()).toContain(`desktop: xrdp listening on ${TAILNET_NAME}:3389\n`);
      expect(h.stdout()).toContain("project: ~/projects/acme/widget\n");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("registers the local key under a container-like host name", async () => {
    const h = harness(
      [{ status: 200, body: { sshKeys: [] } }, { status: 201, body: { id: "new-key" } }, QUEUED, DESKTOP_RUNNING, RDP_UP],
      {
        env: {},
        readFile: brainFiles({ [LOCAL_KEY_PATH]: LOCAL_KEY }).readFile,
        readCredentials: credentials(TOKEN, "https://console.example/"),
        hostname: () => "9f3c2a1b7e4d",
        inContainer: () => true,
      },
    );
    expect(await runHands(["create", "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.calls[1].body).toEqual({ name: "agro-cli@9f3c2a1b7e4d", publicKey: LOCAL_KEY.trim() });
    expect(h.calls[2].body).toEqual({ profile: "sandbox", sshKeyIds: ["new-key"], tools: SANDBOX_TOOLS });
  });

  it("exits 2 through the config error path for a malformed console.json", async () => {
    const configHome = mkdtempSync(join(tmpdir(), "agro-hands-desktop-config-"));
    try {
      mkdirSync(join(configHome, "agro"), { recursive: true });
      writeFileSync(join(configHome, "agro", "console.json"), "{ not json", "utf8");
      const h = harness([QUEUED, DESKTOP_RUNNING, RDP_UP], {
        readCredentials: () => readConsoleCredentials({ XDG_CONFIG_HOME: configHome }, configHome),
      });
      expect(await runHands(["--operator", "create", "--desktop"], h.io, h.deps)).toBe(2);
      expect(h.stderr()).toBe(`${CONSOLE_CONFIG_MISSING}\n`);
      expect(h.calls).toEqual([]);
    } finally {
      rmSync(configHome, { recursive: true, force: true });
    }
  });

  it("documents --desktop in the help", () => {
    const help = handsHelp("agro");
    expect(help).toContain("[--code-server] [--disposable] [--desktop]");
    expect(help).toContain("`--desktop`");
    expect(help).toContain("SPEC_TOO_SMALL_FOR_TOOL");
    expect(help).toContain("DESKTOP_IMAGE_UNAVAILABLE");
    expect(help).toContain("rdpListening");
    expect(help).toContain(":3389 when xrdp listens, else null");
    expect(help).toContain("--code-server, --desktop,\n--ssh-key, --count, and --json apply only to console hands.");
    expect(help).not.toContain("--desktop applies only to console hands");
  });
});

describe("agro hands create --count", () => {
  type NodeBody = Record<string, unknown>;
  const COUNT_TOOLS = ["agro", "docker", "desktop"];
  const COUNT_NEXT_LINES =
    "next: tailscale up\n" +
    "next: sudo passwd sandbox\n" +
    "next: open the Connect card of the hand in the console and download the .rdp file\n";

  function node(k: number, status = "running", extra: NodeBody = {}): NodeBody {
    return {
      id: `u${k}`,
      status,
      orgIndex: 40 + k,
      alias: `alias-${k}`,
      name: null,
      profile: "sandbox",
      spec: "n4",
      sshHost: `hand-${k}.example`,
      ...extra,
    };
  }

  function reply(r: Reply): Response {
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }

  function counted(
    nodes: Record<string, NodeBody[]>,
    post: (k: number) => Reply | Promise<Reply> = (k) => ({ status: 202, body: { id: `u${k}`, status: "queued" } }),
    overrides: Partial<HandsDeps> = {},
  ) {
    const posts: Array<Record<string, unknown>> = [];
    const log: string[] = [];
    const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? "GET") === "POST") {
        posts.push(JSON.parse(String(init?.body)));
        const k = posts.length;
        log.push(`POST ${k}`);
        const answer = await post(k);
        log.push(`POST ${k} replied`);
        return reply(answer);
      }
      const id = url.slice(url.lastIndexOf("/") + 1);
      log.push(`GET ${id}`);
      const queue = nodes[id];
      return reply({ status: 200, body: queue.length > 1 ? queue.shift() : queue[0] });
    }) as typeof fetch;
    return { ...harness([], { fetch: fetchStub, ...overrides }), posts, log };
  }

  const THREE_RUNNING = () => ({ u1: [node(1)], u2: [node(2)], u3: [node(3)] });
  const HAND_LINES =
    "hand 41 alias alias-1 status running ssh sandbox@hand-1.example\n" +
    "hand 42 alias alias-2 status running ssh sandbox@hand-2.example\n" +
    "hand 43 alias alias-3 status running ssh sandbox@hand-3.example\n";

  function jsonOf(k: number, status = "running") {
    return {
      id: `u${k}`,
      index: 40 + k,
      alias: `alias-${k}`,
      name: null,
      status,
      spec: "n4",
      sshHost: `hand-${k}.example`,
      ssh: status === "running" ? `ssh sandbox@hand-${k}.example` : null,
    };
  }

  it.each(["0", "11", "2.5", "abc", "+3", "03", "-1", ""])("refuses --count %j and sends no console request", async (value) => {
    for (const args of [["--count", value], [`--count=${value}`]]) {
      const h = counted(THREE_RUNNING());
      expect(await runHands([...BASE_CREATE, ...args], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe("agro hands create: --count must be an integer from 1 to 10\n");
      expect(h.posts).toEqual([]);
    }
  });

  it("refuses --count without a value", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--count"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --count must be an integer from 1 to 10\n");
    expect(h.posts).toEqual([]);
  });

  it.each([[["--count", "10"]], [["--count=10"]]])("accepts the upper bound with %j", async (args) => {
    const nodes = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`u${i + 1}`, [node(i + 1)]]));
    const h = counted(nodes);
    expect(await runHands([...BASE_CREATE, ...args], h.io, h.deps)).toBe(0);
    expect(h.posts).toHaveLength(10);
    expect(h.stdout().split("\n")).toHaveLength(11);
  });

  it.each([[["--count", "2"]], [["--count=2"]]])("refuses %j on exedev hands before any provider call", async (args) => {
    const home = mkdtempSync(join(tmpdir(), "agro-hands-count-"));
    try {
      const runs: string[][] = [];
      const h = counted(THREE_RUNNING(), undefined, {
        userHome: () => home,
        run: (cmd, runArgs) => {
          runs.push([cmd, ...runArgs]);
          return { status: 0, stdout: "{}" };
        },
      });
      expect(await runHands(["--provider", "exedev", "create", ...args], h.io, h.deps)).toBe(1);
      expect(h.stderr()).toBe("agro hands create: --count applies only to console hands\n");
      expect(runs).toEqual([]);
      expect(h.posts).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it.each([[["--project", "acme/widget"]], [["--clone", "acme/widget"]]])("refuses --count 2 with %j", async (flag) => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--count", "2", ...flag], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands create: --count excludes --project and --clone\n");
    expect(h.posts).toEqual([]);
  });

  it("names the hands <name>-1 to <name>-N in request order", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--name", "gate", "--count", "3"], h.io, h.deps)).toBe(0);
    expect(h.posts.map((body) => body.name)).toEqual(["gate-1", "gate-2", "gate-3"]);
  });

  it("keeps the plain name with --count 1", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--name", "gate", "--count", "1"], h.io, h.deps)).toBe(0);
    expect(h.posts.map((body) => body.name)).toEqual(["gate"]);
  });

  it("sends no name field without --name", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--count", "3"], h.io, h.deps)).toBe(0);
    expect(h.posts).toHaveLength(3);
    for (const body of h.posts) expect(body).not.toHaveProperty("name");
  });

  it("sends request k+1 only after request k returns a node id and waits for the hands at the same time", async () => {
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const nodes = {
      u1: [node(1, "queued"), node(1, "queued"), node(1, "queued"), node(1)],
      u2: [node(2, "queued"), node(2)],
      u3: [node(3)],
    };
    const h = counted(nodes, async (k) => {
      if (k === 1) await gate;
      return { status: 202, body: { id: `u${k}`, status: "queued" } };
    });
    const run = runHands([...BASE_CREATE, "--count", "3"], h.io, h.deps);
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    expect(h.log).toEqual(["POST 1"]);
    release();
    expect(await run).toBe(0);
    const at = (entry: string) => h.log.indexOf(entry);
    expect(at("POST 2")).toBeGreaterThan(at("POST 1 replied"));
    expect(at("POST 3")).toBeGreaterThan(at("POST 2 replied"));
    expect(h.log.lastIndexOf("GET u1")).toBeGreaterThan(at("GET u2"));
    expect(h.log.lastIndexOf("GET u1")).toBeGreaterThan(at("GET u3"));
    expect(h.stdout()).toBe(HAND_LINES);
  });

  it("prints one human line with the console index for each hand in request order", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--count", "3"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(HAND_LINES);
    expect(h.stderr()).toContain("agro hands create: hand u2 running\n");
  });

  it("prints a dash for a hand without an index or an SSH host", async () => {
    const h = counted({ u1: [node(1)], u2: [node(2, "running", { sshHost: null, alias: null, orgIndex: null })] });
    expect(await runHands([...BASE_CREATE, "--count", "2"], h.io, h.deps)).toBe(0);
    expect(h.stdout().split("\n")[1]).toBe("hand - alias - status running ssh -");
  });

  it("prints one JSON line for each hand in request order", async () => {
    const h = counted(THREE_RUNNING());
    expect(await runHands([...BASE_CREATE, "--count", "3", "--json"], h.io, h.deps)).toBe(0);
    expect(h.stdout().split("\n")).toEqual([
      JSON.stringify(jsonOf(1)),
      JSON.stringify(jsonOf(2)),
      JSON.stringify(jsonOf(3)),
      "",
    ]);
  });

  it("stops after a refusal at request 2 of 3", async () => {
    const h = counted(THREE_RUNNING(), (k) =>
      k === 2 ? { status: 500, body: { error: "boom", code: "INTERNAL" } } : { status: 202, body: { id: `u${k}`, status: "queued" } },
    );
    expect(await runHands([...BASE_CREATE, "--count", "3"], h.io, h.deps)).toBe(1);
    expect(h.posts).toHaveLength(2);
    expect(h.stdout()).toBe("hand 41 alias alias-1 status running ssh sandbox@hand-1.example\n");
    expect(h.stderr()).toMatch(/^agro hands create: hand 2 of 3: HTTP 500 INTERNAL: boom$/m);
    expect(h.stderr()).not.toContain("hand 3 of 3");
    expect(h.stderr().endsWith("agro hands create: hand 2 of 3: HTTP 500 INTERNAL: boom\nagro hands create: hand 3 not requested\n")).toBe(true);
  });

  it("names the skipped range after a refusal at request 2 of 4", async () => {
    const nodes = { ...THREE_RUNNING(), u4: [node(4)] };
    const h = counted(nodes, (k) =>
      k === 2 ? { status: 500, body: { error: "boom", code: "INTERNAL" } } : { status: 202, body: { id: `u${k}`, status: "queued" } },
    );
    expect(await runHands([...BASE_CREATE, "--count", "4"], h.io, h.deps)).toBe(1);
    expect(h.posts).toHaveLength(2);
    expect(h.stderr().endsWith("agro hands create: hand 2 of 4: HTTP 500 INTERNAL: boom\nagro hands create: hands 3 to 4 not requested\n")).toBe(true);
  });

  it("prints the JSON line of hand 1 only after a refusal at request 2 of 3", async () => {
    const h = counted(THREE_RUNNING(), (k) =>
      k === 2 ? { status: 500, body: { error: "boom", code: "INTERNAL" } } : { status: 202, body: { id: `u${k}`, status: "queued" } },
    );
    expect(await runHands([...BASE_CREATE, "--count", "3", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe(`${JSON.stringify(jsonOf(1))}\n`);
    expect(h.stderr()).toContain("agro hands create: hand 3 not requested\n");
  });

  it("prints desktop - for a hand whose wait failed with --desktop", async () => {
    const desktop = (k: number, status = "running") =>
      node(k, status, { desktop: true, rdpListening: true, tailnetName: `alias-${k}.ts.net`, tailnetAddress: null });
    const h = counted({ u1: [desktop(1)], u2: [desktop(2, "failed")], u3: [desktop(3)] });
    expect(await runHands([...BASE_CREATE, "--count", "3", "--desktop"], h.io, h.deps)).toBe(1);
    expect(h.stdout().split("\n")[1]).toBe("hand 42 alias alias-2 status failed ssh sandbox@hand-2.example desktop -");
  });

  it("prints every hand and exits 1 after a wait failure at hand 2 of 3", async () => {
    const h = counted({ u1: [node(1)], u2: [node(2, "failed")], u3: [node(3)] });
    expect(await runHands([...BASE_CREATE, "--count", "3"], h.io, h.deps)).toBe(1);
    expect(h.posts).toHaveLength(3);
    expect(h.stdout()).toBe(
      "hand 41 alias alias-1 status running ssh sandbox@hand-1.example\n" +
        "hand 42 alias alias-2 status failed ssh sandbox@hand-2.example\n" +
        "hand 43 alias alias-3 status running ssh sandbox@hand-3.example\n",
    );
    expect(h.stderr()).toContain("agro hands create: hand 2 of 3: hand u2 failed — last status failed\n");
  });

  it("prints the JSON line with the last status after a wait failure at hand 2 of 3", async () => {
    const h = counted({ u1: [node(1)], u2: [node(2, "failed")], u3: [node(3)] });
    expect(await runHands([...BASE_CREATE, "--count", "3", "--json"], h.io, h.deps)).toBe(1);
    expect(h.stdout().split("\n")).toEqual([
      JSON.stringify(jsonOf(1)),
      JSON.stringify(jsonOf(2, "failed")),
      JSON.stringify(jsonOf(3)),
      "",
    ]);
  });

  it("sends three desktop requests and prints desktop fields and the next steps once", async () => {
    const desktop = (k: number, rdpListening: boolean) =>
      node(k, "running", { desktop: true, rdpListening, tailnetName: rdpListening ? `alias-${k}.ts.net` : null, tailnetAddress: null });
    const h = counted(
      { u1: [desktop(1, true)], u2: [desktop(2, false)], u3: [desktop(3, true)] },
      undefined,
      { desktopPollMs: 10, desktopTimeoutMs: 30 },
    );
    expect(await runHands([...BASE_CREATE, "--count", "3", "--desktop"], h.io, h.deps)).toBe(0);
    expect(h.posts).toEqual(Array(3).fill({ profile: "sandbox", sshKeyIds: ["key-1"], tools: COUNT_TOOLS }));
    expect(h.stdout()).toBe(
      "hand 41 alias alias-1 status running ssh sandbox@hand-1.example desktop alias-1.ts.net:3389\n" +
        "hand 42 alias alias-2 status running ssh sandbox@hand-2.example desktop not listening\n" +
        "hand 43 alias alias-3 status running ssh sandbox@hand-3.example desktop alias-3.ts.net:3389\n" +
        COUNT_NEXT_LINES,
    );
    expect(h.stderr()).toContain("agro hands create: warning: hand u2 is running but xrdp is not listening");
  });

  it("adds the desktop object to each JSON line with --desktop", async () => {
    const desktop = (k: number) =>
      node(k, "running", { desktop: true, rdpListening: true, tailnetName: `alias-${k}.ts.net`, tailnetAddress: null });
    const h = counted({ u1: [desktop(1)], u2: [desktop(2)] });
    expect(await runHands([...BASE_CREATE, "--count", "2", "--desktop", "--json"], h.io, h.deps)).toBe(0);
    const lines = h.stdout().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1])).toEqual({
      ...jsonOf(2),
      desktop: { rdpListening: true, tailnetName: "alias-2.ts.net", rdpAddress: "alias-2.ts.net:3389" },
    });
    expect(h.stdout()).not.toContain("next:");
  });

  it.each([[[]], [["--json"]]])("keeps the output of --count 1 with %j", async (flag) => {
    const plain = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, ...flag], plain.io, plain.deps)).toBe(0);
    const counted1 = harness([QUEUED, RUNNING]);
    expect(await runHands([...BASE_CREATE, "--count", "1", ...flag], counted1.io, counted1.deps)).toBe(0);
    expect(counted1.stdout()).toBe(plain.stdout());
    expect(counted1.stderr()).toBe(plain.stderr());
  });

  function fakeHand(k: number, status = "running"): Hand {
    return {
      id: `u${k}`,
      index: String(40 + k),
      alias: `alias-${k}`,
      name: null,
      profile: "sandbox",
      status,
      spec: "n4",
      sshHost: `hand-${k}.example`,
      sshDest: `sandbox@hand-${k}.example`,
      remoteName: `hand-${40 + k}`,
      hostKeyAlias: `u${k}`,
      label: `#${40 + k}`,
    } as Hand;
  }

  function fakeProvider(create: (k: number, onStatus: HandStatusReport) => Promise<HandOutcome<Hand>>) {
    let k = 0;
    return { create: (_request: unknown, onStatus: HandStatusReport) => create(++k, onStatus) } as unknown as HandProvider;
  }

  function fakeDeps(h: ReturnType<typeof harness>): HandsDeps {
    return { ...h.deps, desktopPollMs: 10, desktopTimeoutMs: 30 } as HandsDeps;
  }

  it("prints every hand with a node id and exits 1 when create rejects for hand 2 of 3", async () => {
    const h = harness([]);
    let finishFirst!: () => void;
    const first = new Promise<void>((done) => {
      finishFirst = done;
    });
    const provider = fakeProvider(async (k, onStatus) => {
      await Promise.resolve();
      onStatus(fakeHand(k, "queued"));
      if (k === 1) await first;
      if (k === 2) throw new Error("socket closed");
      if (k === 3) finishFirst();
      return { ok: true, value: fakeHand(k) };
    });
    const status = await createMany(h.io, fakeDeps(h), provider, "agro hands create", { sshKeyIds: [] }, 3, undefined, false);
    expect(status).toBe(1);
    expect(h.stdout()).toBe(
      "hand 41 alias alias-1 status running ssh sandbox@hand-1.example\n" +
        "hand 42 alias alias-2 status queued ssh sandbox@hand-2.example\n" +
        "hand 43 alias alias-3 status running ssh sandbox@hand-3.example\n",
    );
    expect(h.stderr()).toContain("agro hands create: hand 2 of 3: socket closed\n");
  });

  it("prints every hand and exits 1 when the desktop wait rejects for hand 2 of 3", async () => {
    const h = harness([]);
    const provider = fakeProvider(async (k, onStatus) => {
      await Promise.resolve();
      onStatus(fakeHand(k, "queued"));
      return { ok: true, value: fakeHand(k) };
    });
    const awaitDesktop = async (id: string) => {
      if (id === "u2") throw new Error("desktop read broke");
      return { rdpListening: true, tailnetName: `${id}.ts.net`, tailnetAddress: null, status: "running", apiError: null };
    };
    const status = await createMany(
      h.io,
      fakeDeps(h),
      provider,
      "agro hands create",
      { sshKeyIds: [], desktop: true },
      3,
      awaitDesktop,
      false,
    );
    expect(status).toBe(1);
    expect(h.stdout().split("\n").slice(0, 3)).toEqual([
      "hand 41 alias alias-1 status running ssh sandbox@hand-1.example desktop u1.ts.net:3389",
      "hand 42 alias alias-2 status running ssh sandbox@hand-2.example desktop -",
      "hand 43 alias alias-3 status running ssh sandbox@hand-3.example desktop u3.ts.net:3389",
    ]);
    expect(h.stderr()).toContain("agro hands create: hand 2 of 3: desktop read broke\n");
  });

  it("keeps request order when the provider reports a status before its first await", async () => {
    const h = harness([]);
    const provider = fakeProvider((k, onStatus) => {
      onStatus(fakeHand(k, "queued"));
      return Promise.resolve({ ok: true, value: fakeHand(k) });
    });
    const status = await createMany(h.io, fakeDeps(h), provider, "agro hands create", { sshKeyIds: [] }, 3, undefined, true);
    expect(status).toBe(0);
    expect(h.stdout().split("\n").map((line) => (line === "" ? "" : JSON.parse(line).id))).toEqual(["u1", "u2", "u3", ""]);
  });
});
