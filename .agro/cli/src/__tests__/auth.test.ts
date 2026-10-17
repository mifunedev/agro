import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGRO_COMMANDS, AUTH_VERBS } from "../command-table.js";
import { runAuth, type AuthDeps } from "../commands/auth.js";
import {
  consoleCredentialsPath,
  deleteConsoleCredentials,
  readConsoleCredentials,
  writeConsoleCredentials,
  type ConsoleCredentials,
} from "../lib/console-auth.js";

const TOKEN = "mfc_full_secret_token_value";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status: number; body: unknown };

function fakeFetch(route: (call: Call) => Reply): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? "GET",
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const reply = route(call);
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { fetch: fn, calls };
}

function harness(env: Record<string, string | undefined>, fetchFn: typeof fetch) {
  const configHome = mkdtempSync(join(tmpdir(), "agro-auth-"));
  cleanups.push(configHome);
  const fileEnv = { XDG_CONFIG_HOME: configHome };
  const out: string[] = [];
  const err: string[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const deps: Partial<AuthDeps> = {
    fetch: fetchFn,
    env,
    hostname: () => "build-host",
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    readCredentials: () => readConsoleCredentials(fileEnv),
    writeCredentials: (credentials) => writeConsoleCredentials(credentials, fileEnv),
    deleteCredentials: () => deleteConsoleCredentials(fileEnv),
  };
  const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) };
  return {
    deps,
    io,
    sleeps,
    path: consoleCredentialsPath(fileEnv),
    read: () => readConsoleCredentials(fileEnv),
    seed: (credentials: ConsoleCredentials) => writeConsoleCredentials(credentials, fileEnv),
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

const DEVICE = {
  device_code: "dev_secret",
  user_code: "BCDF-GHJK",
  verification_uri: "https://console.example/device",
  expires_in: 900,
  interval: 5,
};

const APPROVED = { token: TOKEN, tokenId: "tok_9", tokenPrefix: "mfc_ful", login: "octocat" };

function deviceFlow(outcomes: Reply[]) {
  let polls = 0;
  return fakeFetch((call) => {
    if (call.url.endsWith("/api/cli/device")) return { status: 200, body: DEVICE };
    if (call.url.endsWith("/api/cli/device/token")) {
      const reply = outcomes[Math.min(polls, outcomes.length - 1)];
      polls += 1;
      return reply;
    }
    return { status: 404, body: { code: "not_found" } };
  });
}

const pending = (code: string): Reply => ({ status: 400, body: { code } });

const STORED: ConsoleCredentials = {
  url: "https://file.example",
  token: TOKEN,
  tokenId: "tok_9",
  tokenPrefix: "mfc_ful",
  login: "octocat",
};

describe("agro auth verb table", () => {
  it("holds login, status, logout, and token", () => {
    expect([...AUTH_VERBS]).toEqual(["login", "status", "logout", "token"]);
    expect(AGRO_COMMANDS.auth).toEqual(AUTH_VERBS);
  });
});

describe("agro auth login", () => {
  it("starts a device authorization with the host name and prints the code", async () => {
    const api = deviceFlow([{ status: 200, body: APPROVED }]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(0);
    expect(api.calls[0]).toMatchObject({
      method: "POST",
      url: "https://console.mifune.dev/api/cli/device",
      body: { clientName: "build-host" },
    });
    expect(h.stdout()).toContain(DEVICE.verification_uri);
    expect(h.stdout()).toContain(DEVICE.user_code);
  });

  it("polls at the interval until approval, then writes the file", async () => {
    const api = deviceFlow([pending("authorization_pending"), pending("authorization_pending"), { status: 200, body: APPROVED }]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(0);
    const polls = api.calls.filter((c) => c.url.endsWith("/api/cli/device/token"));
    expect(polls).toHaveLength(3);
    expect(polls.every((c) => c.method === "POST" && (c.body as { device_code: string }).device_code === "dev_secret")).toBe(true);
    expect(h.sleeps).toEqual([5000, 5000, 5000]);
    expect(h.read()).toEqual({ ...APPROVED, url: "https://console.mifune.dev" });
    expect(h.stdout()).toContain("logged in to https://console.mifune.dev as octocat\n");
    expect(h.stdout()).not.toContain(TOKEN);
  });

  it("adds 5 seconds to the interval on slow_down", async () => {
    const api = deviceFlow([pending("slow_down"), pending("authorization_pending"), { status: 200, body: APPROVED }]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(0);
    expect(h.sleeps).toEqual([5000, 10000, 10000]);
  });

  it("exits 1 and writes no file after a denial", async () => {
    const api = deviceFlow([pending("authorization_pending"), pending("access_denied")]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(false);
    expect(h.stderr()).toContain("denied");
  });

  it("exits 1 and writes no file after an expiry", async () => {
    const api = deviceFlow([pending("expired_token")]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(false);
    expect(h.stderr()).toContain("expired");
  });

  it("stops polling when the code outlives expires_in", async () => {
    const api = deviceFlow([pending("authorization_pending")]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(false);
    expect(h.sleeps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(900_000);
  });

  it("stores the --url value in the credentials file", async () => {
    const api = deviceFlow([{ status: 200, body: APPROVED }]);
    const h = harness({ AGRO_CONSOLE_URL: "https://env.example" }, api.fetch);
    expect(await runAuth(["login", "--url", "https://flag.example/"], h.io, h.deps)).toBe(0);
    expect(api.calls[0].url).toBe("https://flag.example/api/cli/device");
    expect(h.read()?.url).toBe("https://flag.example");
    expect(h.stdout()).toContain("logged in to https://flag.example as octocat\n");
  });

  it("accepts --url=<url> and uses AGRO_CONSOLE_URL without --url", async () => {
    const api = deviceFlow([{ status: 200, body: APPROVED }]);
    const h = harness({ AGRO_CONSOLE_URL: "https://env.example" }, api.fetch);
    expect(await runAuth(["login", "--url=https://inline.example"], h.io, { ...h.deps })).toBe(0);
    expect(h.read()?.url).toBe("https://inline.example");
    const again = deviceFlow([{ status: 200, body: APPROVED }]);
    const h2 = harness({ AGRO_CONSOLE_URL: "https://env.example" }, again.fetch);
    expect(await runAuth(["login"], h2.io, h2.deps)).toBe(0);
    expect(again.calls[0].url).toBe("https://env.example/api/cli/device");
    expect(h2.read()?.url).toBe("https://env.example");
  });

  it("rejects an unknown flag", async () => {
    const api = deviceFlow([{ status: 200, body: APPROVED }]);
    const h = harness({}, api.fetch);
    expect(await runAuth(["login", "--bogus"], h.io, h.deps)).toBe(1);
    expect(api.calls).toHaveLength(0);
  });
});

const ME = { login: "octocat", role: "operator", orgId: "org_7", via: "token", tokenId: "tok_9", tokenPrefix: "mfc_ful" };

describe("agro auth status", () => {
  it("prints the identity, the source, and the prefix but never the token", async () => {
    const api = fakeFetch(() => ({ status: 200, body: ME }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["status"], h.io, h.deps)).toBe(0);
    expect(api.calls[0]).toMatchObject({ method: "GET", url: "https://file.example/api/me" });
    expect(api.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const text = h.stdout();
    for (const value of ["https://file.example", "octocat", "operator", "org_7", "file", "mfc_ful"]) {
      expect(text).toContain(value);
    }
    expect(text).not.toContain(TOKEN);
    expect(h.stderr()).not.toContain(TOKEN);
  });

  it("reports env as the source when AGRO_CONSOLE_TOKEN is set", async () => {
    const api = fakeFetch(() => ({ status: 200, body: ME }));
    const h = harness({ AGRO_CONSOLE_TOKEN: TOKEN, AGRO_CONSOLE_URL: "https://env.example" }, api.fetch);
    expect(await runAuth(["status"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toMatch(/^source: env$/m);
    expect(h.stdout()).not.toContain(TOKEN);
  });

  it("exits 1 when no token resolves", async () => {
    const api = fakeFetch(() => ({ status: 200, body: ME }));
    const h = harness({}, api.fetch);
    expect(await runAuth(["status"], h.io, h.deps)).toBe(1);
    expect(api.calls).toHaveLength(0);
    expect(h.stderr()).toContain("not logged in to agro-console: run agro auth login");
  });

  it("exits 1 when GET /api/me returns 401", async () => {
    const api = fakeFetch(() => ({ status: 401, body: { code: "unauthorized" } }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["status"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("401");
    expect(h.stderr()).not.toContain(TOKEN);
  });
});

describe("agro auth logout", () => {
  it("revokes the token, then deletes the credentials file", async () => {
    const api = fakeFetch(() => ({ status: 200, body: { ok: true } }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(0);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toMatchObject({ method: "DELETE", url: "https://file.example/api/me/token" });
    expect(api.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(existsSync(h.path)).toBe(false);
  });

  it("refuses when the token comes from AGRO_CONSOLE_TOKEN", async () => {
    const api = fakeFetch(() => ({ status: 200, body: { ok: true } }));
    const h = harness({ AGRO_CONSOLE_TOKEN: TOKEN }, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("token comes from AGRO_CONSOLE_TOKEN; unset it to log out");
    expect(api.calls).toHaveLength(0);
    expect(existsSync(h.path)).toBe(true);
  });

  it("removes the file when the token was already revoked", async () => {
    const api = fakeFetch(() => ({ status: 401, body: { code: "unauthorized" } }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(0);
    expect(api.calls[0]).toMatchObject({ method: "DELETE", url: "https://file.example/api/me/token" });
    expect(h.stdout()).toContain("token was already revoked; removed local credentials\n");
    expect(existsSync(h.path)).toBe(false);
  });

  it("keeps the file when the revoke fails with another 4xx", async () => {
    const api = fakeFetch(() => ({ status: 403, body: { code: "forbidden" } }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(true);
  });

  it("keeps the file when the request fails", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const h = harness({}, failing);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(true);
  });

  it("keeps the file when the server revoke fails", async () => {
    const api = fakeFetch(() => ({ status: 500, body: { code: "internal" } }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(1);
    expect(existsSync(h.path)).toBe(true);
  });

  it("exits 1 when no token resolves", async () => {
    const api = fakeFetch(() => ({ status: 200, body: {} }));
    const h = harness({}, api.fetch);
    expect(await runAuth(["logout"], h.io, h.deps)).toBe(1);
    expect(api.calls).toHaveLength(0);
  });
});

describe("agro auth token", () => {
  it("prints the resolved token on stdout", async () => {
    const api = fakeFetch(() => ({ status: 500, body: {} }));
    const h = harness({}, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["token"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe(`${TOKEN}\n`);
    expect(api.calls).toHaveLength(0);
  });

  it("prefers AGRO_CONSOLE_TOKEN", async () => {
    const api = fakeFetch(() => ({ status: 500, body: {} }));
    const h = harness({ AGRO_CONSOLE_TOKEN: "mfc_env" }, api.fetch);
    h.seed(STORED);
    expect(await runAuth(["token"], h.io, h.deps)).toBe(0);
    expect(h.stdout()).toBe("mfc_env\n");
  });

  it("exits 1 when no token resolves", async () => {
    const api = fakeFetch(() => ({ status: 500, body: {} }));
    const h = harness({}, api.fetch);
    expect(await runAuth(["token"], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toBe("");
  });
});

describe("agro auth dispatch", () => {
  it("rejects an unknown verb and prints help without one", async () => {
    const api = fakeFetch(() => ({ status: 500, body: {} }));
    const h = harness({}, api.fetch);
    expect(await runAuth(["bogus"], h.io, h.deps)).toBe(1);
    expect(h.stderr()).toContain("login, status, logout, token");
    expect(await runAuth([], h.io, h.deps)).toBe(1);
    expect(h.stdout()).toContain("agro auth login [--url <url>]");
    expect(await runAuth(["--help"], h.io, h.deps)).toBe(0);
  });
});
