import { describe, expect, it } from "vitest";
import { HANDS_VERBS } from "../../command-table.js";
import {
  BRAIN_TOKEN_MISSING,
  HAND_MISSING,
  handsHelp,
  normalizeHandRef,
  resolveBrainConsoleConfig,
  runHands,
  type HandsDeps,
} from "../hands.js";

const TOKEN = "brn_known_secret_token_4f2a";
const TOKEN_PATH = "/home/sandbox/.agro/brain-token";
const URL_PATH = "/home/sandbox/.agro/brain-console-url";

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
    readFile: files.readFile,
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

describe("brain console config", () => {
  it("reads the token and the URL from the brain files", () => {
    const files = brainFiles({ [TOKEN_PATH]: ` ${TOKEN}\n`, [URL_PATH]: "https://c.example//\n" });
    expect(resolveBrainConsoleConfig({}, () => "/home/sandbox", files.readFile)).toEqual({
      ok: true,
      config: { url: "https://c.example", token: TOKEN, source: "file" },
    });
  });

  it("lets AGRO_CONSOLE_TOKEN and AGRO_CONSOLE_URL override both files", () => {
    const files = brainFiles({});
    expect(
      resolveBrainConsoleConfig(
        { AGRO_CONSOLE_TOKEN: "env_token", AGRO_CONSOLE_URL: "https://env.example/" },
        () => "/home/sandbox",
        files.readFile,
      ),
    ).toEqual({ ok: true, config: { url: "https://env.example", token: "env_token", source: "env" } });
    expect(files.reads).toEqual([]);
  });

  it("fails when the token file is missing", () => {
    const result = resolveBrainConsoleConfig({}, () => "/home/sandbox", brainFiles({ [URL_PATH]: "https://c" }).readFile);
    expect(result).toEqual({ ok: false, error: BRAIN_TOKEN_MISSING });
    expect(BRAIN_TOKEN_MISSING).toBe("not on a brain: /home/sandbox/.agro/brain-token not found");
  });

  it("fails without the URL file and AGRO_CONSOLE_URL instead of using the public console", () => {
    const result = resolveBrainConsoleConfig({}, () => "/home/sandbox", brainFiles({ [TOKEN_PATH]: TOKEN }).readFile);
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
  it("exits 2 and sends no request when the token file is missing", async () => {
    const h = harness([{ status: 200, body: [] }], { readFile: brainFiles({ [URL_PATH]: "https://c" }).readFile });
    expect(await runHands(["list"], h.io, h.deps)).toBe(2);
    expect(h.stderr()).toBe(`${BRAIN_TOKEN_MISSING}\n`);
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
  { id: "u1", orgIndex: 4, alias: "quiet-otter", status: "running", spec: "n4", sshHost: "hand-4.example" },
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
      { id: "u1", index: 4, alias: "quiet-otter", status: "running", spec: "n4", sshHost: "hand-4.example" },
      { id: "u2", index: 12, alias: "bold-heron", status: "paused", spec: "n8", sshHost: null },
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
    expect(await runHands(["create", "--profile", "agro"], h.io, h.deps)).toBe(1);
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
