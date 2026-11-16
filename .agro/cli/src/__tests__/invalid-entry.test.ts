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
import { InvalidSandboxEntryError } from "../lib/agro-config.js";
import { runSandboxInstall } from "../commands/sandbox.js";

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

function invalidEntry(config: Record<string, unknown> = { name: SANDBOX }): string {
  const home = mkdtempSync(join(tmpdir(), "agro-invalid-"));
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

function refusal(
  root: string,
  command: string,
  detail = "agro.json: runtime must be one of docker",
  openshell: string | null = SANDBOX,
): string {
  return (
    `agro ${command}: ${detail}\n` +
    (openshell === null ? "" : `agro ${command}: run \`openshell sandbox delete ${openshell}\` first\n`) +
    `agro ${command}: fix ${join(root, "agro.json")}, or remove the entry ${root}\n`
  );
}

const MALFORMED = (root: string): string => `agro.json is not valid JSON: ${join(root, "agro.json")}`;

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

describe("verbs on an entry with an invalid agro.json", () => {
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
    const root = invalidEntry();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const { calls, run } = recorder();

    let caught: unknown;
    try {
      await invoke(run);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(InvalidSandboxEntryError);
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
  ])("`agro %s` exits 1 with the error and one remedy line", async (argv, command) => {
    const root = invalidEntry();
    const stderr = captureStderr();

    expect(await runCli(argv)).toBe(1);
    expect(stderr.text()).toBe(refusal(root, command));
    expect(existsSync(join(root, "agro.json"))).toBe(true);
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });
});

describe("agro destroy on an unreadable agro.json", () => {
  it.each([false, true])("refuses with the error and a remedy, and keeps the entry (yes=%s)", async (yes) => {
    const root = invalidEntry();
    writeFileSync(join(root, "agro.json"), "{ not json");
    const { calls, run } = recorder();

    await expect(runDestroy({ bin: "agro", name: ENTRY, yes, run }, silentIo().io)).rejects.toThrow(
      refusal(root, "destroy", MALFORMED(root), null).trimEnd(),
    );
    expect(calls).toEqual([]);
    expect(readdirSync(root)).toEqual(["agro.json"]);

    const stderr = captureStderr();
    expect(await runCli(["destroy", ENTRY, ...(yes ? ["--yes"] : [])])).toBe(1);
    expect(stderr.text()).toBe(refusal(root, "destroy", MALFORMED(root), null));
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });
});

describe("a verb that resolves its sandbox from the working directory", () => {
  it("ignores an invalid entry without a checkout and runs against the healthy entry", () => {
    const invalid = invalidEntry();
    const sandboxes = join(invalid, "..");
    const checkout = mkdtempSync(join(tmpdir(), "agro-invalid-checkout-"));
    cleanups.push(checkout);
    const healthy = join(sandboxes, "zz-healthy");
    mkdirSync(healthy, { recursive: true });
    writeFileSync(
      join(healthy, "agro.json"),
      `${JSON.stringify({ version: 1, name: "zz-healthy", image: { mode: "image" }, repo: checkout })}\n`,
    );
    const { calls, run } = recorder();

    expect(runComposeVerb("ps", { bin: "agro", cwd: join(checkout, "app"), run })).toBe(0);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.flat().some((arg) => arg.startsWith(healthy))).toBe(true);
    expect(calls.flat().some((arg) => arg.startsWith(invalid))).toBe(false);
    expect(readdirSync(invalid)).toEqual(["agro.json"]);
  });

  function healthyEntry(name: string, checkout: string): string {
    const root = join(process.env.AGRO_HOME as string, "sandboxes", name);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "agro.json"),
      `${JSON.stringify({ version: 1, name, image: { mode: "image" }, checkout })}\n`,
    );
    return root;
  }

  it("refuses an invalid entry whose checkout holds the working directory", () => {
    const checkout = mkdtempSync(join(tmpdir(), "agro-invalid-checkout-"));
    cleanups.push(checkout);
    const root = invalidEntry({ name: SANDBOX, checkout });
    healthyEntry("zz-other", "/nowhere");
    const { calls, run } = recorder();

    expect(() => runComposeVerb("ps", { bin: "agro", cwd: join(checkout, "app"), run })).toThrow(
      refusal(root, "ps").trimEnd(),
    );
    expect(calls).toEqual([]);
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });

  it("prefers an invalid entry nested under a healthy parent checkout and refuses it", () => {
    const parent = mkdtempSync(join(tmpdir(), "agro-invalid-parent-"));
    cleanups.push(parent);
    const nested = join(parent, "nested");
    mkdirSync(nested);
    const root = invalidEntry({ name: SANDBOX, checkout: nested });
    const healthy = healthyEntry("aa-parent", parent);
    const { calls, run } = recorder();

    expect(() => runComposeVerb("ps", { bin: "agro", cwd: join(nested, "app"), run })).toThrow(
      refusal(root, "ps").trimEnd(),
    );
    expect(calls).toEqual([]);
    expect(readdirSync(root)).toEqual(["agro.json"]);
    expect(readdirSync(healthy)).toEqual(["agro.json"]);
  });
});

describe("the openshell cleanup line", () => {
  it.each([
    ["a podman runtime", JSON.stringify({ version: 1, name: SANDBOX, runtime: "podman" }), "agro.json: runtime must be one of docker"],
    ["malformed JSON", "{ not json", undefined],
  ])("is absent for %s", async (_label, body, detail) => {
    const root = invalidEntry();
    writeFileSync(join(root, "agro.json"), body);
    const stderr = captureStderr();

    expect(await runCli(["ps", ENTRY])).toBe(1);
    expect(stderr.text()).toBe(refusal(root, "ps", detail ?? MALFORMED(root), null));
    expect(stderr.text()).not.toContain("openshell");
  });

  it("names the entry directory when agro.json carries no name", async () => {
    const root = invalidEntry({ name: undefined });
    const stderr = captureStderr();

    expect(await runCli(["ps", ENTRY])).toBe(1);
    expect(stderr.text()).toBe(refusal(root, "ps", undefined, ENTRY));
  });
});

describe("other verbs that target a registry entry", () => {
  it.each([
    [["config", "show", "--sandbox", ENTRY], "config show"],
    [["config", "set", "access.ssh", "true", "--sandbox", ENTRY], "config set"],
    [["secret", "set", "GH_TOKEN", "--sandbox", ENTRY], "secret set"],
    [["secret", "get", "GH_TOKEN", "--sandbox", ENTRY], "secret get"],
    [["secret", "list", "--sandbox", ENTRY], "secret list"],
    [["run", "--sandbox", ENTRY, "--", "true"], "run"],
    [["sandbox", "install", "docker", "--name", ENTRY, "--yes"], "sandbox install"],
  ])("`agro %s` exits 1 with the error and the remedy and keeps the entry", async (argv, command) => {
    const root = invalidEntry();
    const before = readFileSync(join(root, "agro.json"), "utf8");
    const stderr = captureStderr();

    expect(await runCli(argv)).toBe(1);
    expect(stderr.text()).toBe(refusal(root, command));
    expect(readdirSync(root)).toEqual(["agro.json"]);
    expect(readFileSync(join(root, "agro.json"), "utf8")).toBe(before);
  });

  it("`agro sandbox install docker --name <invalid>` spawns nothing", async () => {
    const root = invalidEntry();
    const { calls, run } = recorder();

    await expect(
      runSandboxInstall({ bin: "agro", runtime: "docker", name: ENTRY, yes: true, run }, silentIo().io),
    ).rejects.toThrow(refusal(root, "sandbox install").trimEnd());
    expect(calls).toEqual([]);
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });

  it("`agro harness uninstall` refuses the invalid entry that names its container", async () => {
    const checkout = mkdtempSync(join(tmpdir(), "agro-invalid-project-"));
    cleanups.push(checkout);
    mkdirSync(join(checkout, ".agro"));
    const root = invalidEntry({ name: SANDBOX, checkout });
    vi.stubEnv("SANDBOX_NAME", "");
    vi.spyOn(process, "cwd").mockReturnValue(checkout);
    const stderr = captureStderr();

    expect(await runCli(["harness", "uninstall", "claude"])).toBe(1);
    expect(stderr.text()).toBe(refusal(root, "harness"));
    expect(readdirSync(root)).toEqual(["agro.json"]);
  });
});
