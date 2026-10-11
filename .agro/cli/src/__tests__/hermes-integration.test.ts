import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { runHarnessInstall } from "../commands/harness.js";
import type { LifecycleRunner } from "../lib/execution/runner.js";

vi.mock("node:os", async importOriginal => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, userInfo: () => ({ ...actual.userInfo(), username: "sandbox", uid: 1000 }) };
});

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

function setup({ installed = false, installExit = 0, linkExit = 0, verify = true, configExit = 0, seedExit = 0, inheritedHome = "", rootPrefix = "oh-hermes-install-" } = {}) {
  const root = mkdtempSync(join(tmpdir(), rootPrefix));
  roots.push(root);
  mkdirSync(join(root, ".agro"));
  const calls: { cmd: string; args: string[]; env?: NodeJS.ProcessEnv }[] = [];
  let probes = 0;
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], env: opts.env });
    let status = 0;
    if (args.includes("check")) {
      return spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
        ...args.slice(args.indexOf("check"))], { encoding: "utf8", env: opts.env });
    }
    if (args.includes("configure")) status = configExit;
    else if (args.includes("seed")) status = seedExit;
    else if (args.includes("--hermes-only")) status = linkExit;
    else if (cmd === "hermes") status = (probes++ === 0 ? installed : verify) ? 0 : 1;
    else if (args.some(a => a.includes("install.sh"))) status = installExit;
    return { status, stdout: "", stderr: "" };
  };
  const out: string[] = [], err: string[] = [];
  return { root, calls, out, err, invoke: (env: NodeJS.ProcessEnv = {}) => runHarnessInstall("hermes", { bin: "agro",
    cwd: tmpdir(), run,
    env: { HOME: join(root, "user"), AGRO_EXECUTION_TARGET: "local", AGRO_PROJECT_ROOT: root, HERMES_HOME: inheritedHome, ...env },
  }, { stdout: s => out.push(s), stderr: s => err.push(s) }) };
}

describe("Hermes workspace configuration interface", () => {
  it("accepts normalized equivalent inherited home paths", () => {
    const t = setup();
    const home = `${t.root}/.hermes`;
    const result = spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
      "check", t.root, home, `${t.root}//nested/../.hermes/./`], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: join(t.root, "user") } });
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects a relative home even when the absolute root contains a colon", () => {
    const t = setup();
    const root = join(t.root, "colon:", "root");
    mkdirSync(root, { recursive: true });
    const result = spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
      "check", root, "relative/.hermes"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: join(t.root, "user") } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("absolute paths");
  });

  it.each([0, 7])("calls the supported config CLI and preserves its exit status %s", status => {
    const t = setup();
    const home = join(t.root, "runtime home");
    const log = join(t.root, "config-call");
    const binary = join(t.root, "hermes");
    writeFileSync(binary, `#!/usr/bin/env bash\nprintf '%s\\n' "$HERMES_HOME" "$@" > "$CONFIG_LOG"\nexit ${status}\n`, { mode: 0o755 });
    const result = spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
      "configure", t.root, home, t.root, binary], { encoding: "utf8", env: { PATH: process.env.PATH, CONFIG_LOG: log } });
    expect(readFileSync(log, "utf8")).toBe([home, "config", "set", "terminal.cwd", t.root, ""].join("\n"));
    expect(result.status).toBe(status);
    if (status) expect(result.stderr).toContain("could not configure terminal.cwd");
  });

  function configureWithStub() {
    const t = setup();
    const log = join(t.root, "config-call");
    const binary = join(t.root, "hermes");
    writeFileSync(binary, `#!/usr/bin/env bash\n{ [ -f "$HERMES_HOME/config.yaml" ] && echo seeded; printf '%s\\n' "$@"; } > "$CONFIG_LOG"\n`, { mode: 0o755 });
    const run = () => spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
      "configure", t.root, join(t.root, ".hermes"), t.root, binary], { encoding: "utf8", env: { PATH: process.env.PATH, CONFIG_LOG: log } });
    return { root: t.root, log, run };
  }

  it("seeds the AGRO defaults into an empty home before setting terminal.cwd", () => {
    const c = configureWithStub();
    const result = c.run();
    expect(result.status, result.stderr).toBe(0);
    const config = parse(readFileSync(join(c.root, ".hermes", "config.yaml"), "utf8"));
    expect(config.model.default).toBe("gpt-6.1-sol-900k");
    expect(config.model.provider).toBe("openai-codex");
    expect(config.model.base_url).toBe("https://chatgpt.com/backend-api/codex");
    expect(config.compression.codex_gpt55_autoraise).toBe(false);
    expect(config.compression.auto_compact_percent).toBe(85);
    expect(typeof config.compression.auto_compact_percent).toBe("number");
    expect(config.onboarding.seen.profile_build_offered).toBe(true);
    expect(config).not.toHaveProperty("_config_version");
    expect(config).not.toHaveProperty("terminal");
    expect(readFileSync(c.log, "utf8")).toBe(["seeded", "config", "set", "terminal.cwd", c.root, ""].join("\n"));
  });

  it("keeps an existing config.yaml byte for byte and sets only terminal.cwd", () => {
    const c = configureWithStub();
    mkdirSync(join(c.root, ".hermes"));
    const operator = "model:\n  default: operator-model\n# operator note\n";
    writeFileSync(join(c.root, ".hermes", "config.yaml"), operator);
    const result = c.run();
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(c.root, ".hermes", "config.yaml"), "utf8")).toBe(operator);
    expect(readFileSync(c.log, "utf8")).toBe(["seeded", "config", "set", "terminal.cwd", c.root, ""].join("\n"));
  });

  it("seeds an empty home and keeps an existing config.yaml through the seed command", () => {
    const t = setup();
    const home = join(t.root, ".hermes");
    const seed = () => spawnSync("bash", [join(import.meta.dirname, "../../../scripts/hermes-workspace.sh"),
      "seed", t.root, home], { encoding: "utf8", env: { PATH: process.env.PATH } });
    const first = seed();
    expect(first.status, first.stderr).toBe(0);
    expect(parse(readFileSync(join(home, "config.yaml"), "utf8")).model.provider).toBe("openai-codex");
    const operator = "model:\n  default: operator-model\n";
    writeFileSync(join(home, "config.yaml"), operator);
    const second = seed();
    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(join(home, "config.yaml"), "utf8")).toBe(operator);
  });

  it("fails without a partial config.yaml or a config call when the seed cannot be written", () => {
    const c = configureWithStub();
    const home = join(c.root, ".hermes");
    mkdirSync(home);
    chmodSync(home, 0o555);
    try {
      const result = c.run();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(join(home, "config.yaml"));
      expect(readdirSync(home)).toEqual([]);
      expect(existsSync(c.log)).toBe(false);
    } finally {
      chmodSync(home, 0o755);
    }
  });
});

describe("Hermes installation postconditions", () => {
  it.each([false, true])("uses container paths and runs the installer through Docker (installed=%s)", async installed => {
    const t = setup();
    const calls: string[][] = [];
    let probes = 0;
    const run: LifecycleRunner = (cmd, args) => {
      calls.push([cmd, ...args]);
      const status = args.includes("hermes") && args.includes("--version") && probes++ === 0 && !installed ? 1 : 0;
      return { status, stdout: args[0] === "inspect" ? "running\n" : "", stderr: "" };
    };
    expect(await runHarnessInstall("hermes", { bin: "agro",
      cwd: t.root, run, env: { AGRO_EXECUTION_TARGET: "docker-compose" },
    }, { stdout: () => {}, stderr: () => {} })).toBe(0);
    const link = calls.find(args => args.includes("--hermes-only"))!;
    expect(link).toContain("/home/sandbox/harness");
    expect(link).toContain("scripts/link-providers.sh");
    expect(link.join(" ")).toContain(".agro");
    expect(link.join(" ")).not.toContain(".oh");
    expect(link).toContain("AGRO_PROJECT_ROOT=/home/sandbox/harness");
    const configure = calls.find(args => args.includes("configure"))!;
    expect(configure.slice(-5)).toEqual(["configure", "/home/sandbox/harness", "/home/sandbox/harness/.hermes", "/home/sandbox/harness", "hermes"]);
    expect(calls.some(args => args.some(a => a.includes("install.sh")))).toBe(true);
    expect(calls.flat().some(arg => arg.includes(t.root))).toBe(false);
  });

  it("anchors to the sandbox project outside a project cwd, and sets home before install", async () => {
    const t = setup();
    expect(await t.invoke()).toBe(0);
    const install = t.calls.find(c => c.args.some(a => a.includes("install.sh")))!;
    expect(install.env?.HERMES_HOME).toBe(join(t.root, ".hermes"));
    expect(install.env?.AGRO_PROJECT_ROOT).toBe(t.root);
    expect(t.calls.filter(c => c.args.includes("--hermes-only"))).toHaveLength(2);
    expect(t.calls.filter(c => c.cmd === "hermes")).toHaveLength(2);
    expect(t.calls[0].args).toContain(t.root);
    expect(t.calls[1].args).toContain("scripts/link-providers.sh");
    expect(install.env?.AGRO_PROJECT_ROOT).toBe(t.root);
    const configure = t.calls.find(c => c.args.includes("configure"))!;
    expect(configure).toBeDefined();
    expect(configure.args).toContain(t.root);
    expect(configure.args).toContain(join(t.root, ".hermes"));
    expect(configure.env?.HERMES_HOME).toBe(join(t.root, ".hermes"));
    expect(t.calls.indexOf(configure)).toBeGreaterThan(t.calls.indexOf(install));
    expect(t.out.join("")).toContain("installed —");
  });

  it("seeds the sandbox home before the installer runs", async () => {
    const t = setup();
    expect(await t.invoke()).toBe(0);
    const seed = t.calls.find(c => c.args.includes("seed"))!;
    const install = t.calls.find(c => c.args.some(a => a.includes("install.sh")))!;
    expect(seed.args.slice(-3)).toEqual(["seed", t.root, join(t.root, ".hermes")]);
    expect(seed.env?.HERMES_HOME).toBe(join(t.root, ".hermes"));
    expect(t.calls.indexOf(seed)).toBeLessThan(t.calls.indexOf(install));
  });

  it("stops before the installer when the seed write fails", async () => {
    const t = setup({ seedExit: 5 });
    expect(await t.invoke()).toBe(5);
    expect(t.calls.some(c => c.args.some(a => a.includes("install.sh")))).toBe(false);
    expect(t.calls.some(c => c.args.includes("configure"))).toBe(false);
    expect(t.err.join("")).toContain(join(t.root, ".hermes", "config.yaml"));
  });

  it("sets the workspace home for each link step on the host path", async () => {
    const t = setup();
    const state = mkdtempSync(join(tmpdir(), "oh-hermes-state-"));
    const user = mkdtempSync(join(tmpdir(), "oh-hermes-user-"));
    roots.push(state, user);
    const workspace = join(state, "workspaces", "harness");
    mkdirSync(join(workspace, ".git"), { recursive: true });
    const calls: { cmd: string; args: string[]; env?: NodeJS.ProcessEnv }[] = [];
    let probes = 0;
    const run: LifecycleRunner = (cmd, args, opts) => {
      calls.push({ cmd, args: [...args], env: opts.env });
      if (cmd === "docker" && args[0] === "inspect") return { status: 0, stdout: "exited\n", stderr: "" };
      if (cmd === "hermes") return { status: probes++ === 0 ? 1 : 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const { HERMES_HOME: _unset, ...parent } = process.env;
    expect(await runHarnessInstall("hermes", { bin: "agro",
      cwd: t.root, run, homedir: () => user, interactive: false, host: true,
      env: { ...parent, HOME: user, AGRO_HOME: state, HERMES_HOME: join(workspace, ".hermes") },
    }, { stdout: () => {}, stderr: () => {} })).toBe(0);
    const links = calls.filter(c => c.args.includes("--hermes-only"));
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.env?.HERMES_HOME).toBe(join(workspace, ".hermes"));
    const seed = calls.find(c => c.args.includes("seed"))!;
    const install = calls.find(c => c.args.some(a => a.includes("install.sh")))!;
    expect(seed.args.slice(-3)).toEqual(["seed", workspace, join(workspace, ".hermes")]);
    expect(seed.env?.HERMES_HOME).toBe(join(workspace, ".hermes"));
    expect(calls.indexOf(seed)).toBeLessThan(calls.indexOf(install));
  });

  it("updates an installed integration and configures it once", async () => {
    const t = setup({ installed: true });
    expect(await t.invoke()).toBe(0);
    expect(t.calls.some(c => c.args.some(a => a.includes("install.sh")))).toBe(true);
    expect(t.calls.filter(c => c.args.includes("configure"))).toHaveLength(1);
    expect(t.out.join("")).toContain("updating Hermes in the sandbox…");
  });

  it.each(["auth.json", ".env", "config.yaml"])("refuses a configured default home (%s) before installation mutation", async file => {
    const t = setup();
    const fallback = join(t.root, "user", ".hermes");
    mkdirSync(fallback, { recursive: true });
    const secret = "default-home-private-fixture\n";
    writeFileSync(join(fallback, file), secret);
    expect(await t.invoke()).toBe(1);
    expect(t.calls).toHaveLength(1);
    expect(t.err.join("")).toContain(fallback);
    expect(t.err.join("")).toContain("explicitly select");
    expect(t.err.join("")).not.toContain(secret.trim());
    expect(readFileSync(join(fallback, file), "utf8")).toBe(secret);
  });

  it("accepts a configured default home when it is the normalized workspace home", async () => {
    const t = setup();
    mkdirSync(join(t.root, ".hermes"));
    writeFileSync(join(t.root, ".hermes", "auth.json"), "fixture-state\n");
    expect(await t.invoke({ HOME: `${t.root}//nested/../.` })).toBe(0);
    expect(t.err.join("")).toBe("");
  });

  it("accepts empty default-home marker files without implicit identity conflicts", async () => {
    const t = setup();
    const fallback = join(t.root, "user", ".hermes");
    mkdirSync(fallback, { recursive: true });
    for (const file of ["auth.json", ".env", "config.yaml"]) writeFileSync(join(fallback, file), "");
    expect(await t.invoke()).toBe(0);
  });

  it("accepts explicit workspace selection despite a configured default home", async () => {
    const t = setup();
    const fallback = join(t.root, "user", ".hermes");
    mkdirSync(fallback, { recursive: true });
    writeFileSync(join(fallback, "auth.json"), "fixture-state\n");
    expect(await t.invoke({ HERMES_HOME: join(t.root, ".hermes") })).toBe(0);
  });

  it("rejects a foreign inherited home before any state mutation", async () => {
    const t = setup({ inheritedHome: "/foreign/hermes" });
    expect(await t.invoke()).toBe(1);
    expect(t.calls.some(c => c.args.includes("--hermes-only") || c.args.includes("configure"))).toBe(false);
    expect(t.calls.some(c => c.args.some(a => a.includes("install.sh")))).toBe(false);
    expect(t.err.join("")).toContain("HERMES_HOME");
    expect(t.err.join("")).toContain("unset HERMES_HOME");
  });

  it("executes the printed recovery command unchanged for a workspace containing spaces and a quote", async () => {
    const t = setup({ configExit: 7, rootPrefix: "hermes 'quoted workspace-" });
    expect(await t.invoke()).toBe(7);
    const command = t.err.join("").split("; run ")[1]!;
    const log = join(t.root, "recovery-call");
    const bin = join(t.root, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "hermes"), '#!/usr/bin/env bash\nprintf \'%s\\n\' "$HERMES_HOME" "$@" > "$CONFIG_LOG"\n', { mode: 0o755 });
    const result = spawnSync("bash", ["-c", command], { encoding: "utf8", env: { PATH: `${bin}:${process.env.PATH}`, CONFIG_LOG: log } });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(log, "utf8")).toBe([join(t.root, ".hermes"), "config", "set", "terminal.cwd", t.root, ""].join("\n"));
  });

  it.each([false, true])("prevents success when cwd configuration fails (installed=%s)", async installed => {
    const t = setup({ installed, configExit: 7 });
    expect(await t.invoke()).toBe(7);
    expect(t.err.join("")).toContain("hermes config set terminal.cwd");
    expect(t.out.join("")).not.toMatch(/installed —|already installed/);
  });

  it("reports an integration conflict before invoking the installer", async () => {
    const t = setup({ linkExit: 1 });
    expect(await t.invoke()).toBe(1);
    expect(t.calls).toHaveLength(2);
    expect(t.err.join("")).toContain("integration failed");
    expect(t.out.join("")).not.toContain("installed");
  });

  it("propagates installation failures without reporting success", async () => {
    const t = setup({ installExit: 7 });
    expect(await t.invoke()).toBe(7);
    expect(t.err.join("")).toContain("exit 7");
    expect(t.out.join("")).not.toContain("installed —");
  });

  it("rejects a successful installer whose executable does not verify", async () => {
    const t = setup({ verify: false });
    expect(await t.invoke()).toBe(1);
    expect(t.err.join("")).toContain("executable verification failed");
    expect(t.out.join("")).not.toContain("installed —");
  });
});
