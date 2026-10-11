import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { EXIT, main } from "../../skills/behavioral-training/scripts/behavioral-training.mjs";
import {
  CLI_PACKAGE,
  CONTENT_FIELDS,
  DEFAULT_BASE_URL,
  EXPANDED_METADATA_KEYS,
  LangfuseError,
  MAX_RETRIES,
  SESSION_PAGE_LIMIT,
  createClient,
  isNarrowRequest,
  redact,
  resolveBaseUrl,
  resolveConfigRoot,
} from "../../skills/behavioral-training/scripts/lib/langfuse.mjs";
import * as inventory from "../../skills/behavioral-training/scripts/lib/inventory.mjs";

const fixtureDir = resolve(import.meta.dirname, "fixtures/behavioral-training/access");
const fixture = (name: string) => readFileSync(join(fixtureDir, name), "utf8");
const envelope = (status: number, body: unknown = { message: "synthetic error" }) =>
  JSON.stringify({ status, headers: { "content-type": "application/json" }, body });

const PUBLIC_KEY = ["pk", "lf", "fixture", "0000"].join("-");
const SECRET_KEY = ["sk", "lf", "fixture", "1111"].join("-");
const BASIC = `Basic ${Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString("base64")}`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix = "bt-access-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

type Reply = { exitCode: number | null; stdout?: string; stderr?: string };
type Call = { command: string; args: string[]; operation: string; cursor: string | null };
type Route = Reply | ((call: Call, count: number) => Reply);

function operationOf(args: string[]): string {
  if (args.includes("--version")) return "version";
  const api = args.indexOf("api");
  if (api === -1) return "unknown";
  if (args[api + 1] === "schema") return "schema";
  return `${args[api + 1]} ${args[api + 2]}`;
}

function fakeRunner(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const counts: Record<string, number> = {};
  const runner = async (command: string, args: string[]) => {
    const operation = operationOf(args);
    const at = args.indexOf("--cursor");
    const call = { command, args: [...args], operation, cursor: at === -1 ? null : args[at + 1] };
    calls.push(call);
    counts[operation] = (counts[operation] ?? 0) + 1;
    const route = routes[operation];
    if (!route) return { exitCode: 2, stdout: "", stderr: `no fake route for ${operation}` };
    const reply = typeof route === "function" ? route(call, counts[operation]) : route;
    return { stdout: "", stderr: "", ...reply };
  };
  return { runner, calls };
}

const ok = (stdout: string): Reply => ({ exitCode: 0, stdout });

function healthyRoutes(overrides: Record<string, Route> = {}): Record<string, Route> {
  return {
    version: ok("1.2.4\n"),
    schema: ok(fixture("schema.json")),
    "projects list": ok(fixture("projects.json")),
    "observations list": (call) =>
      ok(call.cursor === "cursor-page-2" ? fixture("observations-page-2.json") : fixture("observations-page-1.json")),
    "scores list": ok(fixture("scores-page-1.json")),
    ...overrides,
  };
}

function repo({ baseUrl, envFile = true }: { baseUrl?: string; envFile?: boolean } = {}): string {
  const root = temp("bt-repo-");
  const langfuse = baseUrl === undefined ? { enabled: false } : { enabled: false, baseUrl };
  writeFileSync(join(root, "agro.json"), JSON.stringify({ version: 1, langfuse }));
  if (envFile) writeFileSync(join(root, ".env"), `LANGFUSE_PUBLIC_KEY=${PUBLIC_KEY}\nLANGFUSE_SECRET_KEY=${SECRET_KEY}\n`);
  return root;
}

function clientFor(routes: Record<string, Route>, opts: { root?: string; env?: Record<string, string> } = {}) {
  const root = opts.root ?? repo({ baseUrl: "https://langfuse.example.test" });
  const { runner, calls } = fakeRunner(routes);
  const sleeps: number[] = [];
  const client = createClient(
    { repoRoot: root, env: opts.env ?? {} },
    { runner, sleep: async (ms: number) => void sleeps.push(ms) },
  );
  return { client, calls, sleeps, root };
}

async function causeOf(promise: Promise<unknown>): Promise<{ cause: string; message: string }> {
  try {
    await promise;
  } catch (err: any) {
    return { cause: err.cause, message: err.message };
  }
  throw new Error("expected a rejection");
}

function noCredential(text: string) {
  expect(text).not.toContain(PUBLIC_KEY);
  expect(text).not.toContain(SECRET_KEY);
  expect(text).not.toMatch(/(?:sk|pk)-lf-/);
  expect(text).not.toContain(BASIC.slice("Basic ".length));
}

describe("Langfuse adapter configuration", () => {
  it("passes the agro.json base URL through --host and the root .env through --env", async () => {
    const root = repo({ baseUrl: "https://langfuse.example.test/" });
    const { client, calls } = clientFor(healthyRoutes(), { root, env: { LANGFUSE_BASE_URL: "https://ignored.example.test" } });
    await client.preflight();
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.command).toBe("npx");
      expect(call.args.slice(0, 2)).toEqual(["-y", CLI_PACKAGE]);
      noCredential(call.args.join(" "));
    }
    const api = calls.find((c) => c.operation === "projects list")!;
    expect(api.args[api.args.indexOf("--env") + 1]).toBe(join(root, ".env"));
    expect(api.args[api.args.indexOf("--host") + 1]).toBe("https://langfuse.example.test");
    expect(api.args).toContain("--json");
    expect(CLI_PACKAGE).toBe("@langfuse/cli@1.2.4");
  });

  it("omits --env when the root .env does not exist", async () => {
    const root = repo({ baseUrl: "https://langfuse.example.test", envFile: false });
    const { client, calls } = clientFor(healthyRoutes(), { root });
    await client.preflight();
    for (const call of calls) expect(call.args).not.toContain("--env");
  });

  it("reads agro.json and .env from AGRO_PROJECT_ROOT when that directory holds agro.json", async () => {
    const worktree = repo({ baseUrl: "https://worktree.example.test", envFile: false });
    const project = repo({ baseUrl: "https://project.example.test" });
    expect(resolveConfigRoot(worktree, { AGRO_PROJECT_ROOT: project })).toBe(project);
    const { client, calls } = clientFor(healthyRoutes(), { root: worktree, env: { AGRO_PROJECT_ROOT: project } });
    const result = await client.preflight();
    expect(result.configRoot).toBe(project);
    const api = calls.find((c) => c.operation === "projects list")!;
    expect(api.args[api.args.indexOf("--env") + 1]).toBe(join(project, ".env"));
    expect(api.args[api.args.indexOf("--host") + 1]).toBe("https://project.example.test");
  });

  it("ignores an AGRO_PROJECT_ROOT that holds no agro.json", async () => {
    const worktree = repo({ baseUrl: "https://worktree.example.test" });
    const bare = temp("bt-bare-");
    writeFileSync(join(bare, ".env"), "LANGFUSE_PUBLIC_KEY=unused\n");
    expect(resolveConfigRoot(worktree, { AGRO_PROJECT_ROOT: bare })).toBe(worktree);
    const { client, calls } = clientFor(healthyRoutes(), { root: worktree, env: { AGRO_PROJECT_ROOT: bare } });
    expect((await client.preflight()).configRoot).toBe(worktree);
    const api = calls.find((c) => c.operation === "projects list")!;
    expect(api.args[api.args.indexOf("--env") + 1]).toBe(join(worktree, ".env"));
    expect(api.args[api.args.indexOf("--host") + 1]).toBe("https://worktree.example.test");
  });

  it("falls back to the repository root without AGRO_PROJECT_ROOT", async () => {
    const worktree = repo({ baseUrl: "https://worktree.example.test" });
    expect(resolveConfigRoot(worktree, {})).toBe(worktree);
    expect(resolveConfigRoot(worktree, { AGRO_PROJECT_ROOT: "" })).toBe(worktree);
    const { client } = clientFor(healthyRoutes(), { root: worktree });
    expect(client.configRoot).toBe(worktree);
    expect(client.envFile).toBe(join(worktree, ".env"));
  });

  it("uses LANGFUSE_BASE_URL only when agro.json holds no base URL, then the Langfuse Cloud default", () => {
    const withConfig = repo({ baseUrl: "https://config.example.test" });
    const without = repo();
    expect(resolveBaseUrl(withConfig, { LANGFUSE_BASE_URL: "https://env.example.test" })).toBe("https://config.example.test");
    expect(resolveBaseUrl(without, { LANGFUSE_BASE_URL: "https://env.example.test/" })).toBe("https://env.example.test");
    expect(resolveBaseUrl(without, {})).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toBe("https://cloud.langfuse.com");
  });
});

describe("Langfuse adapter preflight", () => {
  it("resolves the project identity, the CLI version, the API version, and the capabilities", async () => {
    const { client, calls } = clientFor(healthyRoutes());
    const result = await client.preflight();
    expect(result).toMatchObject({
      baseUrl: "https://langfuse.example.test",
      cliVersion: "1.2.4",
      apiVersion: "4.35.0",
      project: { id: "proj-fixture", name: "Fixture Project" },
      capabilities: { projects: "projects list", observations: "observations list", scores: "scores list", sessions: "observations" },
    });
    const schema = calls.find((c) => c.operation === "schema")!;
    expect(schema.args).toEqual(expect.arrayContaining(["--api-version", "auto", "--json"]));
    const later = calls.find((c) => c.operation === "projects list")!;
    expect(later.args[later.args.indexOf("--api-version") + 1]).toBe("4.35.0");
    noCredential(JSON.stringify(result));
  });

  it("reports incompatible-endpoint when the schema lacks the observations resource", async () => {
    const schema = JSON.parse(fixture("schema.json"));
    schema.resources = schema.resources.filter((r: { name: string }) => r.name !== "observations");
    const { client, calls } = clientFor(healthyRoutes({ schema: ok(JSON.stringify(schema)) }));
    expect((await causeOf(client.preflight())).cause).toBe("incompatible-endpoint");
    expect(calls.some((c) => c.operation === "projects list")).toBe(false);
  });

  it("reports incompatible-endpoint on HTTP 404 for a required resource", async () => {
    const { client } = clientFor(healthyRoutes({ "projects list": { exitCode: 5, stdout: envelope(404) } }));
    expect((await causeOf(client.preflight())).cause).toBe("incompatible-endpoint");
  });

  it("never calls a legacy or a write operation", async () => {
    const { client, calls } = clientFor(healthyRoutes());
    for (const [resource, action] of [["legacy-traces", "list"], ["legacy-sessions", "list"], ["traces", "delete"], ["scores", "create"]]) {
      expect((await causeOf(client.call(resource, action))).cause).toBe("unsupported-operation");
    }
    expect(calls).toHaveLength(0);
  });
});

describe("Langfuse adapter errors", () => {
  it("maps CLI exit code 3 to missing-credentials without a retry", async () => {
    const { client, calls, sleeps } = clientFor(
      healthyRoutes({ "projects list": { exitCode: 3, stderr: "This operation requires LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY\n" } }),
    );
    expect((await causeOf(client.preflight())).cause).toBe("missing-credentials");
    expect(calls.filter((c) => c.operation === "projects list")).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it.each([401, 403])("maps HTTP %i to forbidden without a retry", async (status) => {
    const { client, calls, sleeps } = clientFor(healthyRoutes({ "projects list": { exitCode: 5, stdout: envelope(status) } }));
    expect((await causeOf(client.preflight())).cause).toBe("forbidden");
    expect(calls.filter((c) => c.operation === "projects list")).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("maps CLI exit code 4 to unreachable", async () => {
    const { client } = clientFor(
      healthyRoutes({ schema: { exitCode: 4, stderr: "API version detection failed: GET https://langfuse.example.test/api/public/health: fetch failed\n" } }),
    );
    expect((await causeOf(client.preflight())).cause).toBe("unreachable");
  });

  it("retries HTTP 429 at most 3 times with exponential backoff, then fails", async () => {
    const { client, calls, sleeps } = clientFor(healthyRoutes({ "observations list": { exitCode: 5, stdout: envelope(429) } }));
    await client.preflight();
    const failure = await causeOf(client.listObservations({ fromStartTime: "2026-10-01T00:00:00.000Z", toStartTime: "2026-10-08T00:00:00.000Z" }));
    expect(failure.cause).toBe("http-error");
    expect(failure.message).toMatch(/429/);
    expect(MAX_RETRIES).toBe(3);
    expect(calls.filter((c) => c.operation === "observations list")).toHaveLength(MAX_RETRIES + 1);
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it("retries HTTP 5xx and succeeds when a retry succeeds", async () => {
    const { client, sleeps } = clientFor(
      healthyRoutes({
        "observations list": (_call, count) => (count < 3 ? { exitCode: 5, stdout: envelope(503) } : ok(fixture("observations-page-2.json"))),
      }),
    );
    await client.preflight();
    const page = await client.listObservations({});
    expect(page.items).toHaveLength(3);
    expect(page.cursor).toBeNull();
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("retries HTTP 422 once and recovers when the retry succeeds", async () => {
    const { client, calls, sleeps } = clientFor(
      healthyRoutes({
        "observations list": (_call, count) =>
          count < 2 ? { exitCode: 5, stdout: envelope(422, { message: "synthetic cursor rejection" }) } : ok(fixture("observations-page-2.json")),
      }),
    );
    await client.preflight();
    const page = await client.listObservations({}, { cursor: "cursor-page-2" });
    expect(page.items).toHaveLength(3);
    expect(sleeps).toEqual([1000]);
    expect(calls.filter((c) => c.operation === "observations list").map((c) => c.cursor)).toEqual(["cursor-page-2", "cursor-page-2"]);
  });

  it("fails a second HTTP 422 as http-error with the server detail", async () => {
    const { client, calls, sleeps } = clientFor(
      healthyRoutes({ "observations list": { exitCode: 5, stdout: envelope(422, { message: "synthetic cursor rejection" }) } }),
    );
    await client.preflight();
    const failure = await causeOf(client.listObservations({}, { cursor: "cursor-page-2" }));
    expect(failure.cause).toBe("http-error");
    expect(failure.message).toBe("observations list: HTTP 422 after 1 retry: synthetic cursor rejection");
    expect(calls.filter((c) => c.operation === "observations list")).toHaveLength(2);
    expect(sleeps).toEqual([1000]);
  });

  it("takes the detail from the error field or the first stderr line", async () => {
    const fromError = clientFor(healthyRoutes({ "projects list": { exitCode: 5, stdout: envelope(400, { error: "synthetic bad request" }) } }));
    expect((await causeOf(fromError.client.preflight())).message).toBe("projects list: HTTP 400: synthetic bad request");
    const fromStderr = clientFor(
      healthyRoutes({ "projects list": { exitCode: 5, stdout: envelope(400, null), stderr: "\nfirst synthetic line\nsecond line\n" } }),
    );
    expect((await causeOf(fromStderr.client.preflight())).message).toBe("projects list: HTTP 400: first synthetic line");
  });

  it("redacts a key that the server error body holds and truncates the detail", async () => {
    const body = { message: `rejected ${SECRET_KEY} for ${PUBLIC_KEY} with ${BASIC} ${"x".repeat(400)}` };
    const { client } = clientFor(healthyRoutes({ "observations list": { exitCode: 5, stdout: envelope(422, body) } }));
    await client.preflight();
    const failure = await causeOf(client.listObservations({}));
    noCredential(failure.message);
    expect(failure.message).toContain("<redacted>");
    const detail = failure.message.slice(failure.message.indexOf(": rejected") + 2);
    expect(detail.length).toBeLessThanOrEqual(300);
  });

  it("reports bad-response for output that is not a JSON envelope", async () => {
    const { client } = clientFor(healthyRoutes({ "projects list": ok("not json") }));
    expect((await causeOf(client.preflight())).cause).toBe("bad-response");
  });

  it("redacts keys and Basic auth headers from each error message", async () => {
    const stderr = `request failed: authorization: ${BASIC} key=${SECRET_KEY} public=${PUBLIC_KEY}\n`;
    const { client } = clientFor(healthyRoutes({ "projects list": { exitCode: 1, stderr } }));
    const failure = await causeOf(client.preflight());
    noCredential(failure.message);
    noCredential(redact(stderr));
    expect(redact(stderr)).toContain("<redacted>");
  });
});

describe("Langfuse adapter pagination", () => {
  it("passes the cursor and returns the next cursor", async () => {
    const { client, calls } = clientFor(healthyRoutes());
    await client.preflight();
    const first = await client.listObservations({ fromStartTime: "2026-10-01T00:00:00.000Z", toStartTime: "2026-10-08T00:00:00.000Z", environment: "dev" });
    expect(first.items).toHaveLength(4);
    expect(first.cursor).toBe("cursor-page-2");
    const second = await client.listObservations({}, { cursor: first.cursor });
    expect(second.items).toHaveLength(3);
    expect(second.cursor).toBeNull();
    const [a, b] = calls.filter((c) => c.operation === "observations list");
    expect(a.cursor).toBeNull();
    expect(b.cursor).toBe("cursor-page-2");
    expect(a.args).toEqual(expect.arrayContaining(["--from-start-time", "2026-10-01T00:00:00.000Z", "--to-start-time", "2026-10-08T00:00:00.000Z", "--environment", "dev"]));
    const fields = a.args[a.args.indexOf("--fields") + 1].split(",");
    expect(fields).not.toContain("io");
    expect(fields).not.toContain("metadata");
  });
});

describe("Langfuse adapter session content read", () => {
  it("requests content fields for one session id and follows the cursor", async () => {
    const { client, calls } = clientFor(
      healthyRoutes({
        "observations list": (call) =>
          ok(call.cursor === "cursor-page-2" ? fixture("observations-page-2.json") : fixture("observations-page-1.json")),
      }),
    );
    await client.preflight();
    const first = await client.listSessionObservations("session-a");
    expect(first.items).toHaveLength(4);
    expect(first.cursor).toBe("cursor-page-2");
    const second = await client.listSessionObservations("session-a", { cursor: first.cursor });
    expect(second).toEqual({ items: expect.any(Array), cursor: null });
    const [a, b] = calls.filter((c) => c.operation === "observations list");
    for (const call of [a, b]) {
      expect(call.args[call.args.indexOf("--session-id") + 1]).toBe("session-a");
      expect(call.args[call.args.indexOf("--fields") + 1]).toBe(CONTENT_FIELDS.join(","));
      expect(call.args).not.toContain("--from-start-time");
    }
    expect(CONTENT_FIELDS).toEqual(expect.arrayContaining(["io", "metadata"]));
    expect(b.cursor).toBe("cursor-page-2");
  });

  it("sends the session window, the page size, and the expanded metadata keys on a content read", async () => {
    const { client, calls } = clientFor(healthyRoutes({ "observations list": ok(fixture("observations-page-2.json")) }));
    await client.preflight();
    await client.listSessionObservations("session-a", {
      fromStartTime: "2026-10-02T09:00:00.000Z",
      toStartTime: "2026-10-02T12:00:00.000Z",
    });
    const [call] = calls.filter((c) => c.operation === "observations list");
    const flag = (name: string) => call.args[call.args.indexOf(name) + 1];
    expect(flag("--from-start-time")).toBe("2026-10-02T09:00:00.000Z");
    expect(flag("--to-start-time")).toBe("2026-10-02T12:00:00.000Z");
    expect(flag("--limit")).toBe(String(SESSION_PAGE_LIMIT));
    expect(SESSION_PAGE_LIMIT).toBe(50);
    expect(flag("--expand-metadata")).toBe("input_meta,output_meta,user_text,assistant_text");
    expect(EXPANDED_METADATA_KEYS).toEqual(["input_meta", "output_meta", "user_text", "assistant_text"]);
  });

  it("reads the observation ids of one trace with metadata fields only", async () => {
    const page = envelope(200, {
      data: [
        { id: "obs-p", traceId: "trace-a1", sessionId: "session-b", type: "SPAN", name: "Conversational Turn", isRootObservation: true, input: "x", metadata: { k: "v" }, startTime: "2026-10-02T10:00:00.000Z" },
      ],
      meta: { cursor: "cursor-2" },
    });
    const { client, calls } = clientFor(healthyRoutes({ "observations list": ok(page) }));
    await client.preflight();
    const result = await client.listTraceObservations("trace-a1", {
      cursor: "cursor-1",
      fromStartTime: "2026-10-02T08:00:00.000Z",
      toStartTime: "2026-10-02T12:00:00.000Z",
    });
    expect(result).toEqual({
      items: [{ id: "obs-p", sessionId: "session-b", type: "SPAN", name: "Conversational Turn", isRootObservation: true }],
      cursor: "cursor-2",
    });
    const [call] = calls.filter((c) => c.operation === "observations list");
    const flag = (name: string) => call.args[call.args.indexOf(name) + 1];
    expect(flag("--trace-id")).toBe("trace-a1");
    expect(flag("--fields")).toBe("core,basic");
    expect(flag("--from-start-time")).toBe("2026-10-02T08:00:00.000Z");
    expect(flag("--to-start-time")).toBe("2026-10-02T12:00:00.000Z");
    expect(flag("--cursor")).toBe("cursor-1");
    expect(call.args).not.toContain("--expand-metadata");
    expect(call.args).not.toContain("--session-id");
  });

  it("keeps null for a trace lookup field that the source does not supply", async () => {
    const page = envelope(200, { data: [{ id: "obs-q" }], meta: {} });
    const { client } = clientFor(healthyRoutes({ "observations list": ok(page) }));
    await client.preflight();
    expect(await client.listTraceObservations("trace-a1")).toEqual({
      items: [{ id: "obs-q", sessionId: null, type: null, name: null, isRootObservation: null }],
      cursor: null,
    });
  });

  it("refuses a trace lookup without one trace id", async () => {
    const { client, calls } = clientFor(healthyRoutes());
    await client.preflight();
    expect((await causeOf(client.listTraceObservations(""))).cause).toBe("unsupported-operation");
    expect(calls.filter((c) => c.operation === "observations list")).toHaveLength(0);
  });

  it("recognizes only the HTTP 422 that asks for a narrower request", async () => {
    const narrow =
      "Your query could not be completed. Please narrow your request by adding more specific filters (e.g., a shorter date range).";
    const { client } = clientFor(healthyRoutes({ "observations list": { exitCode: 5, stdout: envelope(422, { message: narrow }) } }));
    await client.preflight();
    const failure = await client.listSessionObservations("session-a").catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(LangfuseError);
    expect(isNarrowRequest(failure)).toBe(true);
    expect(isNarrowRequest(new LangfuseError("http-error", "observations list: HTTP 422: synthetic cursor rejection", 422))).toBe(false);
    expect(isNarrowRequest(new LangfuseError("http-error", "observations list: HTTP 500: narrow your request", 500))).toBe(false);
    expect(isNarrowRequest(new Error("narrow your request"))).toBe(false);
  });

  it("retries a session content read like each other read", async () => {
    const { client, sleeps } = clientFor(
      healthyRoutes({
        "observations list": (_call, count) => (count < 2 ? { exitCode: 5, stdout: envelope(500) } : ok(fixture("observations-page-2.json"))),
      }),
    );
    await client.preflight();
    expect((await client.listSessionObservations("session-a")).items).toHaveLength(3);
    expect(sleeps).toEqual([1000]);
  });

  it("refuses a content read without one session id", async () => {
    const { client, calls } = clientFor(healthyRoutes());
    await client.preflight();
    expect((await causeOf(client.listSessionObservations(""))).cause).toBe("unsupported-operation");
    expect((await causeOf(client.call("observations", "list", { fields: "core,io" }))).cause).toBe("unsupported-operation");
    expect((await causeOf(client.call("observations", "list", { fields: "core,metadata" }))).cause).toBe("unsupported-operation");
    expect(calls.filter((c) => c.operation === "observations list")).toHaveLength(0);
  });
});

describe("inventory stage", () => {
  function setup(routes: Record<string, Route>) {
    const root = repo({ baseUrl: "https://langfuse.example.test" });
    const runDir = join(temp("bt-run-parent-"), "run");
    const fake = fakeRunner(routes);
    const out: string[] = [];
    const err: string[] = [];
    const deps = {
      env: {},
      repoRoot: root,
      tmpdir: () => temp("bt-tmp-"),
      now: () => new Date("2026-10-11T12:00:00.000Z"),
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
      loadStage: async (name: string) => (name === "inventory" ? inventory : null),
      langfuseFactory: (ctx: any) => createClient(ctx, { runner: fake.runner, sleep: async () => {} }),
    };
    const window = ["--since", "2026-10-01T00:00:00Z", "--until", "2026-10-08T00:00:00Z"];
    const run = (extra: string[] = []) => main(["inventory", "--run-dir", runDir, ...window, ...extra], deps);
    const manifest = () => JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
    const records = () =>
      readFileSync(join(runDir, "inventory.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return { run, runDir, root, manifest, records, calls: fake.calls, out, err };
  }

  it("writes one metadata-only record per session within the window", async () => {
    const t = setup(healthyRoutes());
    expect(await t.run()).toBe(EXIT.complete);
    const records = t.records();
    expect(records.map((r: any) => r.sessionId)).toEqual(["session-a", "session-b", "session-c"]);
    const a = records[0];
    expect(a).toMatchObject({
      sessionId: "session-a",
      projectId: "proj-fixture",
      traceIds: ["trace-a1", "trace-a2"],
      firstSeenAt: "2026-10-02T10:00:00.000Z",
      lastSeenAt: "2026-10-02T10:10:30.000Z",
      environment: "dev",
      harness: "claude-code",
      models: ["model-alpha"],
      traceCount: 2,
      observationCount: 3,
      toolErrorCount: 1,
      latencyMs: 630000,
      costUsd: 0.75,
      tokens: { input: 150, output: 30, total: 180 },
      scores: [{ name: "task-success", value: 0, source: "ANNOTATION" }],
      sourceLink: "https://langfuse.example.test/project/proj-fixture/sessions/session-a",
    });
    expect(records[1].scores).toEqual([{ name: "helpful", value: true, source: "API" }]);
    const c = records[2];
    expect(c).toMatchObject({ harness: null, models: [], costUsd: null, toolErrorCount: null, lastSeenAt: "2026-10-04T08:00:00.000Z" });
    expect(c.unavailable).toEqual(expect.arrayContaining(["harness", "models", "costUsd", "tokens", "toolErrorCount"]));
    const text = readFileSync(join(t.runDir, "inventory.jsonl"), "utf8");
    expect(text).not.toContain("synthetic failure");
    expect(text).not.toMatch(/"(input|output)":\s*"/);
    for (const call of t.calls.filter((c) => c.operation === "observations list")) {
      const fields = call.args[call.args.indexOf("--fields") + 1].split(",");
      expect(fields).not.toContain("io");
      expect(fields).not.toContain("metadata");
      expect(call.args).not.toContain("--session-id");
      expect(call.args).toEqual(expect.arrayContaining(["--from-start-time", "2026-10-01T00:00:00.000Z", "--to-start-time", "2026-10-08T00:00:00.000Z"]));
    }
  });

  it("records the project identity, the versions, and the summary in the manifest without a credential", async () => {
    const t = setup(healthyRoutes());
    expect(await t.run()).toBe(EXIT.complete);
    const manifest = t.manifest();
    expect(manifest.project).toEqual({ id: "proj-fixture", name: "Fixture Project" });
    expect(manifest.endpoint.baseUrl).toBe("https://langfuse.example.test");
    expect(manifest.endpoint.configRoot).toBe(resolve(t.root));
    noCredential(JSON.stringify(manifest.endpoint));
    expect(manifest.versions).toMatchObject({ cli: "1.2.4", api: "4.35.0", harnesses: ["claude-code", "codex"], models: ["model-alpha", "model-beta"] });
    const summary = manifest.completeness.inventory;
    expect(summary).toMatchObject({
      status: "complete",
      sessions: 3,
      observations: 6,
      sessionlessObservations: 1,
      byHarness: { "claude-code": 1, codex: 1, unknown: 1 },
      byModel: { "model-alpha": 1, "model-beta": 1 },
      byEnvironment: { dev: 2, prod: 1 },
    });
    for (const key of ["bySessionLength", "byToolErrors", "byLatency", "byCost", "byOutcomeSignal"]) {
      const counts = Object.values(summary[key] as Record<string, number>);
      expect(counts.reduce((sum, n) => sum + n, 0)).toBe(3);
    }
    expect(summary.unavailableFields).toEqual([]);
    noCredential(readFileSync(join(t.runDir, "manifest.json"), "utf8"));
  });

  it("lists each field that no session supplied", async () => {
    const schema = JSON.parse(fixture("schema.json"));
    schema.resources = schema.resources.filter((r: { name: string }) => r.name !== "scores");
    const t = setup(healthyRoutes({ schema: ok(JSON.stringify(schema)), "observations list": ok(fixture("observations-page-2.json")) }));
    expect(await t.run()).toBe(EXIT.complete);
    const summary = t.manifest().completeness.inventory;
    expect(summary.unavailableFields).toEqual(expect.arrayContaining(["scores"]));
    expect(summary.byOutcomeSignal).toEqual({ unavailable: 2 });
    expect(t.calls.some((c) => c.operation === "scores list")).toBe(false);
  });

  it("checkpoints the page cursor and resumes from it after a failed read, without double counts", async () => {
    let fail = true;
    const t = setup(
      healthyRoutes({
        "observations list": (call) => {
          if (call.cursor === "cursor-page-2") {
            return fail ? { exitCode: 4, stderr: "GET https://langfuse.example.test failed: fetch failed\n" } : ok(fixture("observations-page-2.json"));
          }
          return ok(fixture("observations-page-1.json"));
        },
      }),
    );
    expect(await t.run()).toBe(EXIT.failed);
    const failed = t.manifest();
    expect(failed.stages.inventory).toMatchObject({ status: "failed", cause: "unreachable" });
    expect(failed.stages.inventory.progress.observations.cursor).toBe("cursor-page-2");
    expect(existsSync(join(t.runDir, "inventory.jsonl"))).toBe(false);
    expect(failed.completeness.inventory).toMatchObject({ status: "failed", cause: "unreachable" });
    expect(failed.completeness.inventory.sessions).toBeUndefined();

    fail = false;
    const before = t.calls.length;
    expect(await t.run(["--resume"])).toBe(EXIT.complete);
    const resumed = t.calls.slice(before).filter((c) => c.operation === "observations list");
    expect(resumed.map((c) => c.cursor)).toEqual(["cursor-page-2"]);
    const a = t.records().find((r: any) => r.sessionId === "session-a");
    expect(a.observationCount).toBe(3);
    expect(a.toolErrorCount).toBe(1);
  });

  it("stops at --max-sessions and reports partial", async () => {
    const t = setup(healthyRoutes());
    expect(await t.run(["--max-sessions", "1"])).toBe(EXIT.partial);
    expect(t.records().map((r: any) => r.sessionId)).toEqual(["session-a"]);
    expect(t.manifest().stages.inventory).toMatchObject({ status: "partial", cause: "max-sessions" });
    expect(t.calls.filter((c) => c.operation === "observations list")).toHaveLength(1);
  });

  it("applies the harness filter to the sessions", async () => {
    const t = setup(healthyRoutes());
    expect(await t.run(["--harness", "codex"])).toBe(EXIT.complete);
    expect(t.records().map((r: any) => r.sessionId)).toEqual(["session-b"]);
    expect(t.manifest().completeness.inventory.excludedByHarness).toBe(2);
  });

  it("reports an empty corpus as empty and a failed read as the cause, with distinct exit codes", async () => {
    const empty = setup(healthyRoutes({ "observations list": ok(fixture("observations-empty.json")) }));
    const emptyCode = await empty.run();
    expect(emptyCode).toBe(EXIT.empty);
    expect(empty.manifest().stages.inventory.status).toBe("empty");
    expect(empty.manifest().completeness.inventory).toMatchObject({ status: "empty", sessions: 0 });

    const failed = setup(healthyRoutes({ "projects list": { exitCode: 5, stdout: envelope(403) } }));
    const failedCode = await failed.run();
    expect(failedCode).toBe(EXIT.failed);
    expect(failed.manifest().stages.inventory).toMatchObject({ status: "failed", cause: "forbidden" });
    expect(failed.manifest().completeness.inventory.sessions).toBeUndefined();
    expect(existsSync(join(failed.runDir, "inventory.jsonl"))).toBe(false);
    expect(emptyCode).not.toBe(failedCode);
  });

  it("keeps a fixture key out of each run file and each message on failure", async () => {
    const stderr = `boom ${BASIC} ${SECRET_KEY} ${PUBLIC_KEY}\n`;
    const t = setup(healthyRoutes({ "observations list": { exitCode: 1, stderr } }));
    expect(await t.run()).toBe(EXIT.failed);
    noCredential([...t.out, ...t.err].join("\n"));
    for (const name of readdirSync(t.runDir)) noCredential(readFileSync(join(t.runDir, name), "utf8"));
  });
});
