import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EGRESS_LOG_PATH, EGRESS_LOG_LINES, markDenied, runEgress } from "../commands/egress.js";
import { AGRO_COMMANDS } from "../command-table.js";
import type { LifecycleRunner, RunResult } from "../lib/execution/runner.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseEgressArgs, printAgroHelp, printEgressHelp } = await import("../cli.js");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const ENTRY_NAME = "egress-box";

function makeEntry(config: Record<string, unknown>): string {
  const home = mkdtempSync(join(tmpdir(), "agro-egress-"));
  cleanups.push(home);
  vi.stubEnv("AGRO_HOME", home);
  vi.stubEnv("SANDBOX_NAME", "");
  const root = join(home, "sandboxes", ENTRY_NAME);
  mkdirSync(join(root, ".agro", "scripts"), { recursive: true });
  writeFileSync(join(root, "agro.json"), `${JSON.stringify({ version: 1, name: ENTRY_NAME, ...config })}\n`);
  return root;
}

interface RecordedCall {
  cmd: string;
  args: string[];
  stdio: string;
}

function makeRunner(result: RunResult = { status: 0 }): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], stdio: opts.stdio });
    return result;
  };
  return { calls, run };
}

function makeIo(): { out: string[]; err: string[]; io: { stdout: (s: string) => void; stderr: (s: string) => void } } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (s) => out.push(s), stderr: (s) => err.push(s) } };
}

const ALLOWLIST = { access: { egress: "allowlist", egressAllow: ["example.org"] } };

describe("command table", () => {
  it("registers egress with log and reload", () => {
    expect(AGRO_COMMANDS.egress).toEqual(["log", "reload"]);
  });
});

describe("agro egress log", () => {
  it("reads the proxy access log through the compose wrapper", () => {
    const root = makeEntry(ALLOWLIST);
    const { calls, run } = makeRunner({ status: 0, stdout: "" });
    const { io } = makeIo();
    expect(runEgress("log", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("bash");
    expect(calls[0].stdio).toBe("capture");
    expect(calls[0].args[0]).toBe(join(root, ".agro", "scripts", "docker-compose.sh"));
    expect(calls[0].args[1]).toBe("--extra-env-file");
    expect(calls[0].args.slice(3)).toEqual([
      "exec",
      "-T",
      "proxy",
      "tail",
      "-n",
      String(EGRESS_LOG_LINES),
      EGRESS_LOG_PATH,
    ]);
    expect(EGRESS_LOG_PATH).toBe("/var/log/squid/access.log");
  });

  it("marks the denied lines and prints the rest unchanged", () => {
    makeEntry(ALLOWLIST);
    const log = [
      "1700000000.000 10 172.18.0.3 TCP_TUNNEL/200 5000 CONNECT github.com:443 - HIER_DIRECT/1.2.3.4 -",
      "1700000001.000 0 172.18.0.3 TCP_DENIED/403 3900 CONNECT evil.test:443 - HIER_NONE/- text/html",
      "",
    ].join("\n");
    const { run } = makeRunner({ status: 0, stdout: log });
    const { out, io } = makeIo();
    expect(runEgress("log", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(0);
    expect(out.join("")).toBe(
      [
        "1700000000.000 10 172.18.0.3 TCP_TUNNEL/200 5000 CONNECT github.com:443 - HIER_DIRECT/1.2.3.4 -",
        "DENIED 1700000001.000 0 172.18.0.3 TCP_DENIED/403 3900 CONNECT evil.test:443 - HIER_NONE/- text/html",
        "",
      ].join("\n"),
    );
  });

  it("forwards the child's stderr and exit code", () => {
    makeEntry(ALLOWLIST);
    const { run } = makeRunner({ status: 7, stdout: "", stderr: "service proxy is not running\n" });
    const { err, io } = makeIo();
    expect(runEgress("log", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(7);
    expect(err.join("")).toBe("service proxy is not running\n");
  });

  it("marks only lines that carry TCP_DENIED", () => {
    expect(markDenied("a TCP_DENIED/403 b\nc TCP_MISS/200 d\n")).toBe("DENIED a TCP_DENIED/403 b\nc TCP_MISS/200 d\n");
  });
});

describe("agro egress reload", () => {
  it("regenerates egress-allow.txt and reconfigures the proxy through the compose wrapper", () => {
    const root = makeEntry(ALLOWLIST);
    writeFileSync(join(root, "egress-allow.txt"), "stale.test\n");
    const { calls, run } = makeRunner();
    const { io } = makeIo();
    expect(runEgress("reload", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(0);
    const allow = readFileSync(join(root, "egress-allow.txt"), "utf8").split("\n");
    expect(allow).toContain("example.org");
    expect(allow).not.toContain("stale.test");
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("bash");
    expect(calls[0].stdio).toBe("inherit");
    expect(calls[0].args[0]).toBe(join(root, ".agro", "scripts", "docker-compose.sh"));
    expect(calls[0].args[1]).toBe("--extra-env-file");
    expect(calls[0].args.slice(3)).toEqual(["exec", "-T", "proxy", "squid", "-k", "reconfigure"]);
  });

  it("propagates the child's exit code", () => {
    makeEntry(ALLOWLIST);
    const { run } = makeRunner({ status: 4 });
    const { io } = makeIo();
    expect(runEgress("reload", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(4);
  });

  it("reports a signal-killed child as failure", () => {
    makeEntry(ALLOWLIST);
    const { run } = makeRunner({ status: null });
    const { io } = makeIo();
    expect(runEgress("reload", { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(1);
  });
});

describe("refusals", () => {
  it.each(["log", "reload"] as const)("refuses %s for an open-egress entry with one line naming access.egress", (verb) => {
    makeEntry({ access: { egress: "open" } });
    const { calls, run } = makeRunner();
    const { out, err, io } = makeIo();
    expect(runEgress(verb, { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(1);
    expect(calls).toHaveLength(0);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `agro egress ${verb}: the sandbox ${ENTRY_NAME} uses access.egress open; set access.egress allowlist\n`,
    ]);
  });

  it.each(["log", "reload"] as const)("refuses %s for an entry that leaves access.egress unset", (verb) => {
    makeEntry({});
    const { calls, run } = makeRunner();
    const { err, io } = makeIo();
    expect(runEgress(verb, { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(1);
    expect(calls).toHaveLength(0);
    expect(err.join("")).toContain("access.egress open");
  });

  it.each(["log", "reload"] as const)("refuses %s for an openshell entry with one line naming runtime", (verb) => {
    const root = makeEntry({ runtime: "openshell", ...ALLOWLIST });
    const { calls, run } = makeRunner();
    const { out, err, io } = makeIo();
    expect(runEgress(verb, { bin: "agro", name: ENTRY_NAME, run }, io)).toBe(1);
    expect(calls).toHaveLength(0);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `agro egress ${verb}: the sandbox ${ENTRY_NAME} uses runtime openshell; access.egress allowlist applies to the docker runtime\n`,
    ]);
    expect(() => readFileSync(join(root, "egress-allow.txt"))).toThrow();
  });
});

describe("parseEgressArgs", () => {
  it("parses each verb with and without a name", () => {
    expect(parseEgressArgs(["log"])).toEqual({ ok: true, args: { help: false, verb: "log" } });
    expect(parseEgressArgs(["reload", "box"])).toEqual({ ok: true, args: { help: false, verb: "reload", name: "box" } });
  });

  it("treats a bare call and --help as help", () => {
    expect(parseEgressArgs([])).toEqual({ ok: true, args: { help: true } });
    expect(parseEgressArgs(["log", "--help"])).toEqual({ ok: true, args: { help: true } });
  });

  it("rejects an unknown verb, an unknown flag, and a second name", () => {
    expect(parseEgressArgs(["tail"]).ok).toBe(false);
    expect(parseEgressArgs(["log", "--follow"]).ok).toBe(false);
    expect(parseEgressArgs(["log", "a", "b"]).ok).toBe(false);
  });
});

describe("egress help", () => {
  it("lists egress in the top-level usage and names both verbs", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printAgroHelp();
    printEgressHelp();
    const text = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(text).toContain("agro egress <args...>");
    expect(text).toContain("agro egress log [name]");
    expect(text).toContain("agro egress reload [name]");
  });
});
