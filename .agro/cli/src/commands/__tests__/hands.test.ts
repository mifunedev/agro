import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConsoleCredentials } from "../../lib/console-auth.js";
import { HANDS_VERBS } from "../../command-table.js";
import {
  CONSOLE_TOKEN_MISSING,
  HAND_MISSING,
  handsHelp,
  normalizeHandRef,
  resolveHandsConsoleConfig,
  runHands,
  type HandsDeps,
} from "../hands.js";

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
    ["env token skips the brain URL file and takes the credentials URL", ENV_TOKEN, BRAIN, credentials("cred"), "env_token", "https://login.example", "env", "brain"],
    ["env token without a URL source takes the public console", ENV_TOKEN, {}, noCredentials, "env_token", "https://console.mifune.dev", "env", "operator"],
    ["brain token takes the brain URL file", {}, BRAIN, credentials("cred"), TOKEN, "https://brain.example", "file", "brain"],
    ["brain token takes AGRO_CONSOLE_URL over the brain URL file", { AGRO_CONSOLE_URL: "https://env.example" }, BRAIN, noCredentials, TOKEN, "https://env.example", "file", "brain"],
    ["credentials token takes the credentials URL", {}, {}, credentials("cred"), "cred", "https://login.example", "file", "operator"],
    ["credentials token takes AGRO_CONSOLE_URL over the credentials URL", { AGRO_CONSOLE_URL: "https://env.example" }, {}, credentials("cred"), "cred", "https://env.example", "file", "operator"],
    ["credentials token with an empty URL takes the public console", {}, {}, credentials("cred", " "), "cred", "https://console.mifune.dev", "file", "operator"],
  ] as const)("%s", (_, env, files, readCredentials, token, url, source, authority) => {
    expect(resolveHandsConsoleConfig(env, HOME, brainFiles(files).readFile, readCredentials)).toEqual({
      ok: true,
      config: { url, token, source },
      authority,
    });
  });

  it("trims the brain token and the brain URL", () => {
    const files = brainFiles({ [TOKEN_PATH]: ` ${TOKEN}\n`, [URL_PATH]: "https://c.example//\n" });
    expect(resolveHandsConsoleConfig({}, HOME, files.readFile, noCredentials)).toEqual({
      ok: true,
      config: { url: "https://c.example", token: TOKEN, source: "file" },
      authority: "brain",
    });
  });

  it("fails without any token and names the brain token path and agro auth login", () => {
    const result = resolveHandsConsoleConfig({}, HOME, brainFiles({ [URL_PATH]: "https://c" }).readFile, noCredentials);
    expect(result).toEqual({ ok: false, error: CONSOLE_TOKEN_MISSING });
    expect(CONSOLE_TOKEN_MISSING).toContain(TOKEN_PATH);
    expect(CONSOLE_TOKEN_MISSING).toContain("agro auth login");
  });

  it("fails without the URL file and AGRO_CONSOLE_URL instead of using the public console", () => {
    const result = resolveHandsConsoleConfig({}, HOME, brainFiles({ [TOKEN_PATH]: TOKEN }).readFile, credentials("cred"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(URL_PATH);
      expect(result.error).toContain("AGRO_CONSOLE_URL");
    }
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
const OPERATOR_ENV = { AGRO_CONSOLE_TOKEN: TOKEN, AGRO_CONSOLE_URL: "https://console.example/" };
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
  return { ...harness(replies, { env: OPERATOR_ENV, readFile: read.readFile, hostname: () => "laptop" }), reads: read.reads };
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
      "agro hands create [--name <name>] [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--disposable] [--ssh-key <uuid>]... [--json] [--project <owner>/<repo> | --clone <owner>/<repo>]",
    );
    for (const flag of ["--profile", "--json", "--ssh-key", ...APP_FLAG_NAMES]) expect(help).toContain(`\`${flag}`);
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

  it("sends no key and says so when the local key file does not exist", async () => {
    const h = operator([QUEUED, RUNNING], {});
    expect(await runHands(["create"], h.io, h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://console.example/api/nodes",
      "GET https://console.example/api/nodes/u9",
    ]);
    expect(h.calls[0].body).toEqual({ profile: "sandbox" });
    expect(h.stderr()).toContain(`agro hands create: ${LOCAL_KEY_PATH} not found; the hand gets no SSH key\n`);
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
  it("prints the admin role line on HTTP 403", async () => {
    const h = operator([{ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }]);
    expect(await runHands(["destroy", "4", "--yes"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toBe("agro hands destroy: destroy needs the admin role in agro-console\n");
  });
});
