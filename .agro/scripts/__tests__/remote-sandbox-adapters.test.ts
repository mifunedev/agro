import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const LIB = join(ROOT, ".agro/skills/remote-sandbox/scripts/lib.sh");
const REQUIRED = ["preflight", "create", "exec", "destroy", "list"];

const temp = mkdtempSync(join(tmpdir(), "remote-sandbox-adapters-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function withLib(script: string, path?: string) {
  const env: Record<string, string | undefined> = { ...process.env, MATRIX_OUT: join(temp, "out") };
  delete env.REMOTE_SANDBOX_ADAPTERS;
  if (path) env.PATH = `${path}:${process.env.PATH}`;
  const result = spawnSync("bash", ["-c", `. "$1"\n${script}`, "bash", LIB], {
    cwd: temp,
    env,
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function defined(fn: string) {
  return withLib(`declare -F ${fn} >/dev/null`).code === 0;
}

function stubCurl(code: string) {
  const bin = join(temp, `bin-${code}`);
  mkdirSync(bin, { recursive: true });
  const curl = join(bin, "curl");
  writeFileSync(curl, `#!/usr/bin/env bash\nprintf '%s' "$*" > "${bin}/args"\nprintf '${code}'\n`);
  chmodSync(curl, 0o755);
  return bin;
}

describe("remote-sandbox adapters", () => {
  it.each(["exedev", "vercel"])("%s defines the five required functions", (provider) => {
    for (const fn of REQUIRED) expect(defined(`${provider}_${fn}`), `${provider}_${fn}`).toBe(true);
    expect(withLib(`valid_provider ${provider}`).code).toBe(0);
  });

  it("lists both adapters as valid providers", () => {
    const providers = withLib("valid_providers").stdout.trim().split("\n");
    expect(providers).toEqual(expect.arrayContaining(["exedev", "vercel"]));
  });

  it("exedev defines restart and both row hooks", () => {
    for (const fn of ["exedev_restart", "exedev_row_ssh", "exedev_row_https"]) {
      expect(defined(fn), fn).toBe(true);
    }
  });

  it("vercel defines only the ssh row hook", () => {
    expect(defined("vercel_row_ssh")).toBe(true);
    expect(defined("vercel_row_https")).toBe(false);
    expect(defined("vercel_restart")).toBe(false);
  });

  it("exedev_row_ssh prints the R10 line", () => {
    expect(withLib("exedev_row_ssh vm1").stdout).toBe("RESULT R10-ssh-inbound PASS ssh vm1.exe.xyz\n");
  });

  it.each([
    ["200", "RESULT R11-https-port PASS https 200"],
    ["302", "RESULT R11-https-port SKIPPED proxy answers 302: private by default, needs share"],
    ["401", "RESULT R11-https-port SKIPPED proxy answers 401: private by default, needs share"],
    ["403", "RESULT R11-https-port SKIPPED proxy answers 403: private by default, needs share"],
    ["500", "RESULT R11-https-port FAIL http=500"],
  ])("exedev_row_https maps http %s", (code, line) => {
    const bin = stubCurl(code);
    expect(withLib("exedev_row_https vm1", bin).stdout).toBe(`${line}\n`);
    expect(withLib(`cat "${bin}/args"`).stdout).toContain("https://vm1.exe.xyz/");
  });

  it("vercel_row_ssh prints the R10 FAIL line", () => {
    expect(withLib("vercel_row_ssh vm1").stdout).toBe(
      "RESULT R10-ssh-inbound FAIL API exec only, no standard SSH endpoint\n",
    );
  });

  it("the driver skips R11 for vercel", () => {
    expect(withLib("PROVIDER=vercel NAME=vm1 row_hook row_https R11-https-port").stdout).toBe(
      "RESULT R11-https-port SKIPPED no adapter hook\n",
    );
  });
});
