import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runComposeConfig,
  runComposeVerb,
  runDestroy,
  runShell,
  type LifecycleIO,
  type LifecycleRunner,
} from "../commands/lifecycle.js";
import { runEgress } from "../commands/egress.js";
import { runSandboxUpgrade } from "../services/sandbox-upgrade.js";
import { RetiredRuntimeError, retiredRuntimeRefusal } from "../lib/agro-config.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { runCli } = await import("../cli.js");

const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const ENTRY = "old-box";
const SANDBOX = "os-box";

function retiredEntry(config: Record<string, unknown> = { name: SANDBOX }): string {
  const home = mkdtempSync(join(tmpdir(), "agro-retired-"));
  cleanups.push(home);
  vi.stubEnv("AGRO_HOME", home);
  vi.stubEnv("SANDBOX_NAME", "ambient");
  vi.stubEnv("AGRO_EXECUTION_TARGET", "docker-compose");
  const root = join(home, "sandboxes", ENTRY);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "agro.json"),
    `${JSON.stringify({ version: 1, runtime: "openshell", image: { mode: "image" }, ...config })}\n`,
  );
  return root;
}

function refusal(root: string, command: string, name = SANDBOX): string {
  return (
    `agro ${command}: the sandbox ${name} uses the retired openshell runtime; ` +
    `run \`openshell sandbox delete ${name}\`, then remove the entry ${root}\n`
  );
}

function recorder(): { calls: string[][]; run: LifecycleRunner } {
  const calls: string[][] = [];
  const run: LifecycleRunner = (cmd, args) => {
    calls.push([cmd, ...args]);
    return { status: 0 };
  };
  return { calls, run };
}

function silentIo(): { err: string[]; io: LifecycleIO } {
  const err: string[] = [];
  return {
    err,
    io: { stdout: () => {}, stderr: (s) => err.push(s), ask: async () => SANDBOX },
  };
}

function captureStderr(): { text: () => string } {
  const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  return { text: () => spy.mock.calls.map((c) => String(c[0])).join("") };
}

describe("retiredRuntimeRefusal", () => {
  it("names the entry name from agro.json, else the entry directory", () => {
    const root = retiredEntry();
    expect(retiredRuntimeRefusal(root)).toBe(refusal(root, "x").replace(/^agro x: /, "").trimEnd());
    writeFileSync(join(root, "agro.json"), `${JSON.stringify({ version: 1, runtime: "openshell" })}\n`);
    expect(retiredRuntimeRefusal(root)).toContain(`openshell sandbox delete ${ENTRY}\``);
  });

  it("returns nothing for a docker entry or a malformed agro.json", () => {
    const root = retiredEntry({ runtime: "docker" });
    expect(retiredRuntimeRefusal(root)).toBeUndefined();
    writeFileSync(join(root, "agro.json"), "{ not json");
    expect(retiredRuntimeRefusal(root)).toBeUndefined();
  });
});

describe("verbs on an entry with the retired openshell runtime", () => {
  const verbs: Array<[string, (run: LifecycleRunner) => unknown]> = [
    ["shell", (run) => runShell({ bin: "agro", name: ENTRY, run }, silentIo().io)],
    ["stop", (run) => runComposeVerb("stop", { bin: "agro", name: ENTRY, run })],
    ["restart", (run) => runComposeVerb("restart", { bin: "agro", name: ENTRY, run })],
    ["logs", (run) => runComposeVerb("logs", { bin: "agro", name: ENTRY, run })],
    ["ps", (run) => runComposeVerb("ps", { bin: "agro", name: ENTRY, run })],
    ["compose config", (run) => runComposeConfig({ bin: "agro", name: ENTRY, run })],
    ["destroy", (run) => runDestroy({ bin: "agro", name: ENTRY, run }, silentIo().io)],
    ["destroy", (run) => runDestroy({ bin: "agro", name: ENTRY, yes: true, run }, silentIo().io)],
    ["egress log", (run) => runEgress("log", { bin: "agro", name: ENTRY, run }, silentIo().io)],
    ["egress reload", (run) => runEgress("reload", { bin: "agro", name: ENTRY, run }, silentIo().io)],
    [
      "sandbox upgrade",
      (run) => runSandboxUpgrade({ bin: "agro", name: ENTRY, version: "0.13.0", run }, silentIo().io),
    ],
  ];

  it.each(verbs)("`agro %s` refuses, spawns nothing, and keeps the entry", async (command, invoke) => {
    const root = retiredEntry();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const { calls, run } = recorder();

    let caught: unknown;
    try {
      await invoke(run);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RetiredRuntimeError);
    expect(`${(caught as Error).message}\n`).toBe(refusal(root, command));
    expect(calls).toEqual([]);
    expect(readdirSync(root)).toEqual(["agro.json"]);
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
  });

  it.each([
    [["shell", ENTRY], "shell"],
    [["stop", ENTRY], "stop"],
    [["restart", ENTRY], "restart"],
    [["logs", ENTRY], "logs"],
    [["ps", ENTRY], "ps"],
    [["destroy", ENTRY], "destroy"],
    [["destroy", ENTRY, "--yes"], "destroy"],
    [["compose", "config"], "compose config"],
    [["egress", "log", ENTRY], "egress log"],
    [["egress", "reload", ENTRY], "egress reload"],
    [["sandbox", "upgrade", ENTRY, "--version", "0.13.0"], "sandbox upgrade"],
  ])("`agro %s` exits 1 with one refusal line", async (argv, command) => {
    const root = retiredEntry();
    const stderr = captureStderr();

    expect(await runCli(argv)).toBe(1);
    expect(stderr.text()).toBe(refusal(root, command));
    expect(existsSync(join(root, "agro.json"))).toBe(true);
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });
});

describe("agro destroy on an unreadable agro.json", () => {
  it.each([false, true])("reports one line and exits 1 (yes=%s)", async (yes) => {
    const root = retiredEntry();
    writeFileSync(join(root, "agro.json"), "{ not json");
    const { calls, run } = recorder();
    const { err, io } = silentIo();

    expect(await runDestroy({ bin: "agro", name: ENTRY, yes, run }, io)).toBe(1);
    expect(err).toEqual([`agro destroy: agro.json is not valid JSON: ${join(root, "agro.json")}\n`]);
    expect(calls).toEqual([]);
    expect(existsSync(join(root, "agro.json"))).toBe(true);
  });
});
