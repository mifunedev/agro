import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SOURCE = join(ROOT, ".agro/skills/remote-sandbox/scripts");
const FIXTURES = join(import.meta.dirname, "fixtures/remote-sandbox");
const FAKE_DIR = join(FIXTURES, "adapters");
const EXTRA_DIR = join(FIXTURES, "extra");
const PARTIAL_DIR = join(FIXTURES, "partial");

const BUILTIN_ADAPTER = [
  'builtin_preflight() { echo "builtin-preflight"; }',
  "builtin_create() { true; }",
  "builtin_exec() { true; }",
  "builtin_destroy() { true; }",
  "builtin_list() { echo 0; }",
  "",
].join("\n");

const cleanups: string[] = [];
afterAll(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

interface Skill {
  temp: string;
  runSh: string;
  state: string;
  out: string;
}

function makeSkill(): Skill {
  const temp = mkdtempSync(join(tmpdir(), "remote-sandbox-"));
  cleanups.push(temp);
  const skill = join(temp, "skill");
  mkdirSync(join(skill, "scripts"), { recursive: true });
  mkdirSync(join(skill, "adapters"));
  mkdirSync(join(skill, "checks"));
  for (const file of ["lib.sh", "run.sh"]) {
    copyFileSync(join(SOURCE, file), join(skill, "scripts", file));
  }
  writeFileSync(join(skill, "adapters", "builtin.sh"), BUILTIN_ADAPTER);
  copyFileSync(join(FIXTURES, "checks/env-check.sh"), join(skill, "checks/fresh-install.sh"));
  copyFileSync(join(FIXTURES, "checks/env-check.sh"), join(skill, "checks/agro-rows.sh"));
  chmodSync(join(FIXTURES, "bin/tmux"), 0o755);
  const state = join(temp, "state");
  mkdirSync(join(state, "vms"), { recursive: true });
  return { temp, runSh: join(skill, "scripts", "run.sh"), state, out: join(temp, "out") };
}

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

function launch(skill: Skill, args: string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  for (const name of ["INSTALL_URL", "AGRO_JS_URL", "SANDBOX_IMAGE", "GET_AGRO_URL", "KEEP", "IMAGE"]) {
    delete base[name];
  }
  const child = spawn("bash", [skill.runSh, ...args], {
    env: {
      ...base,
      MATRIX_OUT: skill.out,
      FAKE_STATE: skill.state,
      POLL_INTERVAL: "0.1",
      REMOTE_SANDBOX_ADAPTERS: `${FAKE_DIR}:${EXTRA_DIR}:${PARTIAL_DIR}`,
      ...env,
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const done = new Promise<RunResult>((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done, stdout: () => stdout };
}

function logPath(stdout: string): string {
  const match = /^log: (.+)$/m.exec(stdout);
  expect(match).not.toBeNull();
  return match![1];
}

function destroyedCount(skill: Skill): number {
  const file = join(skill.state, "destroyed");
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").length : 0;
}

async function waitFor(predicate: () => boolean, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("remote-sandbox adapter discovery and contract", () => {
  it("loads adapters/ from the skill directory and every REMOTE_SANDBOX_ADAPTERS directory", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["nope", "--preflight"]).done;
    expect(result.code).toBe(2);
    const usage = result.stderr.split("\n").find((line) => line.startsWith("usage:")) ?? "";
    expect(usage).toContain("builtin");
    expect(usage).toContain("fake");
    expect(usage).toContain("hooked");
    expect(usage).not.toContain("partial");
  });

  it("loads REMOTE_SANDBOX_ADAPTERS after the skill adapters/ directory", async () => {
    const skill = makeSkill();
    const own = await launch(skill, ["builtin", "--preflight"]).done;
    expect(own.code).toBe(0);
    expect(own.stdout).toContain("builtin-preflight");

    const override = join(skill.temp, "override");
    mkdirSync(override);
    writeFileSync(join(override, "builtin.sh"), 'builtin_preflight() { echo "override-preflight"; }\n');
    const later = await launch(skill, ["builtin", "--preflight"], {
      REMOTE_SANDBOX_ADAPTERS: `${FAKE_DIR}:${override}`,
    }).done;
    expect(later.code).toBe(0);
    expect(later.stdout).toContain("override-preflight");
    expect(later.stdout).not.toContain("builtin-preflight");
  });

  it("exits 2 with a usage line when the adapter lacks <p>_list", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["partial", "--preflight"]).done;
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^usage: run\.sh /m);
    expect(result.stdout).not.toContain("preflight ok");
  });
});

describe.concurrent("remote-sandbox driver run", { timeout: 30_000 }, () => {
  it("runs the default check, forwards INSTALL_URL only, prints no driver rows, and cleans up", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["fake"], {
      INSTALL_URL: "https://example.test/install.sh",
      AGRO_JS_URL: "https://example.test/agro.js",
      GET_AGRO_URL: "https://example.test/get-agro.sh",
    }).done;
    expect(result.code).toBe(0);
    const log = readFileSync(logPath(result.stdout), "utf8");
    expect(log).toContain("check=fresh-install.sh");
    expect(log).toContain("install=https://example.test/install.sh");
    expect(log).not.toContain("get_agro");
    expect(log).toContain("CHECK INSTALL_URL=https://example.test/install.sh");
    expect(log).toContain("CHECK AGRO_JS_URL=https://example.test/agro.js");
    expect(log).toContain("CHECK SANDBOX_IMAGE=unset");
    expect(log).toContain("CHECK GET_AGRO_URL=unset");
    expect(log).not.toContain("R09-disconnect");
    expect(log).not.toContain("R10-ssh-inbound");
    expect(log).not.toContain("R11-https-port");
    expect(log.trimEnd()).toMatch(/remaining agro-matrix resources on fake: 0\nRUN DONE$/);
    expect(destroyedCount(skill)).toBe(1);
  });

  it("runs the driver rows after checks/agro-rows.sh and skips missing hooks", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["fake", "checks/agro-rows.sh"]).done;
    expect(result.code).toBe(0);
    const log = readFileSync(logPath(result.stdout), "utf8");
    expect(log).toContain("check=agro-rows.sh");
    expect(log).toContain("RESULT R09-disconnect PASS");
    expect(log).toContain("RESULT R10-ssh-inbound SKIPPED no adapter hook");
    expect(log).toContain("RESULT R11-https-port SKIPPED no adapter hook");
    expect(log.indexOf("RESULT R10-ssh-inbound")).toBeLessThan(log.indexOf("remaining "));
    expect(log.trimEnd()).toMatch(/remaining agro-matrix resources on fake: 0\nRUN DONE$/);
    expect(destroyedCount(skill)).toBe(1);
  });

  it("prints no driver rows after a check other than checks/agro-rows.sh", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["hooked", join(FIXTURES, "checks/env-check.sh")]).done;
    expect(result.code).toBe(0);
    const log = readFileSync(logPath(result.stdout), "utf8");
    expect(log).toContain("SUMMARY env-check");
    expect(log).not.toContain("R09-disconnect");
    expect(log).not.toContain("R10-ssh-inbound");
    expect(log).not.toContain("R11-https-port");
    expect(log.trimEnd()).toMatch(/remaining agro-matrix resources on hooked: 0\nRUN DONE$/);
  });

  it("calls a row hook only when the adapter defines it", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["hooked", "checks/agro-rows.sh"]).done;
    expect(result.code).toBe(0);
    const log = readFileSync(logPath(result.stdout), "utf8");
    expect(log).toMatch(/RESULT R10-ssh-inbound PASS hook saw agro-mx-/);
    expect(log).toContain("RESULT R11-https-port SKIPPED no adapter hook");
    expect(log.trimEnd()).toMatch(/remaining agro-matrix resources on hooked: 0\nRUN DONE$/);
  });

  it("keeps the VM when KEEP=1", async () => {
    const skill = makeSkill();
    const result = await launch(skill, ["fake"], { KEEP: "1" }).done;
    expect(result.code).toBe(0);
    const log = readFileSync(logPath(result.stdout), "utf8");
    expect(log).toContain("== keep agro-mx-");
    expect(log).not.toContain("RUN DONE");
    expect(destroyedCount(skill)).toBe(0);
  });

  it("ignores SIGHUP and destroys the VM exactly once on SIGTERM", async () => {
    const skill = makeSkill();
    const run = launch(skill, ["fake", join(FIXTURES, "checks/hang.sh")]);
    await waitFor(() => /^log: /m.test(run.stdout()));
    const log = logPath(run.stdout());
    await waitFor(() => existsSync(log) && readFileSync(log, "utf8").includes("CHECK hanging"));

    run.child.kill("SIGHUP");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(run.child.exitCode).toBeNull();
    expect(run.child.signalCode).toBeNull();

    run.child.kill("SIGTERM");
    const result = await run.done;
    expect(result.code).toBe(130);
    const text = readFileSync(log, "utf8");
    expect(text.trimEnd()).toMatch(/remaining agro-matrix resources on fake: 0\nRUN DONE$/);
    expect(destroyedCount(skill)).toBe(1);
  });
});
