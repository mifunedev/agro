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

let consoleBins = 0;

function stubConsole(list = "[]", lists: string[] = []) {
  const bin = join(temp, `console-${(consoleBins += 1)}`);
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "list.json"), list);
  lists.forEach((body, index) => writeFileSync(join(bin, `list-${index + 1}.json`), body));
  const stubs: Record<string, string> = {
    agro: [
      `printf '%s\\n' "$*" >> "${bin}/agro.calls"`,
      'case "$1 $2" in',
      `  "node list") [ "\${AGRO_DOWN:-0}" = 1 ] && { echo "agro node list: HTTP 503 no code" >&2; exit 1; }; l=$(( $(cat "${bin}/lists" 2>/dev/null || echo 0) + 1 )); echo "$l" > "${bin}/lists"; if [ -e "${bin}/list-$l.json" ]; then cat "${bin}/list-$l.json"; else cat "${bin}/list.json"; fi ;;`,
      `  "node create") [ "\${CREATE_FAILS:-0}" = 1 ] && { printf '{"id":"node-1","status":"failed","ssh":null}\\n'; exit 1; }; printf '{"id":"node-1","status":"running","ssh":"ssh sandbox@203.0.113.7"}\\n' ;;`,
      '  "node delete")',
      `    n=$(( $(cat "${bin}/deletes" 2>/dev/null || echo 0) + 1 )); echo "$n" > "${bin}/deletes"`,
      '    [ "$n" -le "${CONFLICTS:-0}" ] && { echo "agro node delete: HTTP 409 conflict: node is busy" >&2; exit 1; }',
      '    echo "deleted $3" ;;',
      "esac",
    ].join("\n"),
    ssh: `printf '%s\\n' "$*" >> "${bin}/ssh.calls"\necho ran`,
    sleep: `printf '%s\\n' "$*" >> "${bin}/sleep.calls"`,
  };
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  return bin;
}

const CONSOLE_ENV = "export CONSOLE_SSH_KEY_ID=key-uuid CONSOLE_SSH_IDENTITY=/keys/id_ed25519; unset IMAGE CONSOLE_SPEC CONSOLE_FREE_TIER;";

function withConsole(script: string, bin: string) {
  return withLib(`${CONSOLE_ENV}\n${script}`, bin);
}

describe("remote-sandbox adapters", () => {
  it.each(["exedev", "vercel", "console"])("%s defines the five required functions", (provider) => {
    for (const fn of REQUIRED) expect(defined(`${provider}_${fn}`), `${provider}_${fn}`).toBe(true);
    expect(withLib(`valid_provider ${provider}`).code).toBe(0);
  });

  it("lists the three adapters as valid providers", () => {
    const providers = withLib("valid_providers").stdout.trim().split("\n");
    expect(providers).toEqual(expect.arrayContaining(["exedev", "vercel", "console"]));
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

  it("console defines only the ssh row hook", () => {
    expect(defined("console_row_ssh")).toBe(true);
    expect(defined("console_row_https")).toBe(false);
    expect(defined("console_restart")).toBe(false);
  });

  it("console_preflight lists nodes through the agro CLI", () => {
    const bin = stubConsole();
    expect(withConsole("console_preflight", bin).code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe("node list --json\n");
  });

  it("console_preflight fails when the console does not answer", () => {
    expect(withConsole("AGRO_DOWN=1 console_preflight", stubConsole()).code).not.toBe(0);
  });

  it.each(["CONSOLE_SSH_KEY_ID", "CONSOLE_SSH_IDENTITY"])("console_preflight fails fast without %s", (key) => {
    const bin = stubConsole();
    const result = withConsole(`unset ${key}; console_preflight`, bin);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(key);
    expect(withLib(`test -e "${bin}/agro.calls"`).code).not.toBe(0);
  });

  it("console_create requests the free tier by default and stores the node", () => {
    const bin = stubConsole();
    const result = withConsole('console_create agro-mx-1 && cat "$STATE_DIR/console-agro-mx-1"', bin);
    expect(result.code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe(
      "node create --spec n4 --ssh-key key-uuid --name agro-mx-1 --json --free-tier\n",
    );
    expect(result.stdout.trim().split("\n").at(-1)).toBe("node-1 sandbox@203.0.113.7");
  });

  it("console_create omits the free tier when CONSOLE_FREE_TIER=0 and honors CONSOLE_SPEC", () => {
    const bin = stubConsole();
    expect(withConsole("CONSOLE_FREE_TIER=0 CONSOLE_SPEC=n8 console_create agro-mx-2", bin).code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe(
      "node create --spec n8 --ssh-key key-uuid --name agro-mx-2 --json\n",
    );
  });

  it("console_create refuses IMAGE with exit 2", () => {
    const bin = stubConsole();
    const result = withConsole("IMAGE=ubuntu console_create agro-mx-3", bin);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("IMAGE");
    expect(withLib(`test -e "${bin}/agro.calls"`).code).not.toBe(0);
  });

  it("console_exec runs the command over ssh to the stored target", () => {
    const bin = stubConsole();
    const result = withConsole('console_create agro-mx-4 >/dev/null && console_exec agro-mx-4 echo "a b"', bin);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("ran\n");
    const args = withLib(`cat "${bin}/ssh.calls"`).stdout;
    expect(args).toContain("-i /keys/id_ed25519");
    expect(args).toContain("BatchMode=yes");
    expect(args.trim().endsWith("sandbox@203.0.113.7 echo a b")).toBe(true);
  });

  it("console_exec fails without a stored node", () => {
    expect(withConsole("console_exec agro-mx-none true", stubConsole()).code).not.toBe(0);
  });

  it("console_destroy deletes the stored node id", () => {
    const bin = stubConsole();
    const result = withConsole("console_create agro-mx-5 >/dev/null && console_destroy agro-mx-5", bin);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("deleted node-1\n");
    expect(withLib(`grep -c "^node delete node-1 --yes$" "${bin}/agro.calls"`).stdout).toBe("1\n");
  });

  it("console_destroy retries a 409", () => {
    const bin = stubConsole();
    const result = withConsole("console_create agro-mx-6 >/dev/null && CONFLICTS=2 console_destroy agro-mx-6", bin);
    expect(result.code).toBe(0);
    expect(withLib(`cat "${bin}/deletes"`).stdout).toBe("3\n");
    expect(result.stdout).toContain("deleted node-1");
  });

  it("console_destroy stops retrying a 409 after 60 s", () => {
    const bin = stubConsole();
    const result = withConsole("console_create agro-mx-7 >/dev/null && CONFLICTS=99 console_destroy agro-mx-7", bin);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toContain("HTTP 409");
    const waits = withLib(`cat "${bin}/sleep.calls"`).stdout.trim().split("\n").map(Number);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(60);
    expect(Number(withLib(`cat "${bin}/deletes"`).stdout)).toBeGreaterThan(1);
  });

  it("console_destroy waits until the node reaches destroyed", () => {
    const node = (status: string) => JSON.stringify([{ id: "node-1", name: "agro-mx-10", status }]);
    const bin = stubConsole(node("destroyed"), [node("destroying"), node("destroying")]);
    const result = withConsole(
      'console_create agro-mx-10 >/dev/null && console_destroy agro-mx-10; echo "rc=$?"; test -e "$STATE_DIR/console-agro-mx-10"; echo "state=$?"',
      bin,
    );
    expect(result.stdout).toContain("rc=0\nstate=1\n");
    expect(withLib(`cat "${bin}/lists"`).stdout).toBe("3\n");
    expect(withLib(`cat "${bin}/sleep.calls"`).stdout).toBe("5\n5\n");
  });

  it("console_destroy keeps the state file when the node never reaches destroyed", () => {
    const bin = stubConsole(JSON.stringify([{ id: "node-1", name: "agro-mx-11", status: "destroying" }]));
    const result = withConsole(
      'console_create agro-mx-11 >/dev/null && console_destroy agro-mx-11; echo "rc=$?"; cat "$STATE_DIR/console-agro-mx-11"',
      bin,
    );
    expect(result.stdout).toContain("rc=1\nnode-1 sandbox@203.0.113.7\n");
    expect(result.stdout).toContain("console: node node-1 is destroying after 180 s, not destroyed");
    const waits = withLib(`cat "${bin}/sleep.calls"`).stdout.trim().split("\n").map(Number);
    expect(waits.reduce((a, b) => a + b, 0)).toBe(180);
  });

  it("console_create keeps the node id when create returns no ssh target", () => {
    const bin = stubConsole();
    const result = withConsole(
      'CREATE_FAILS=1 console_create agro-mx-9; echo "rc=$?"; cat "$STATE_DIR/console-agro-mx-9"; console_exec agro-mx-9 true; echo "exec=$?"; console_destroy agro-mx-9',
      bin,
    );
    expect(result.stdout).toContain("rc=1\nnode-1 \nexec=1\ndeleted node-1\n");
    expect(withLib(`test -e "${bin}/ssh.calls"`).code).not.toBe(0);
    expect(withLib(`grep -c "^node delete node-1 --yes$" "${bin}/agro.calls"`).stdout).toBe("1\n");
  });

  it("console_list counts only live agro-mx- nodes", () => {
    const list = JSON.stringify([
      { id: "1", name: "agro-mx-1014-120000", status: "running" },
      { id: "2", name: "agro-mx-1014-120500", status: "provisioning" },
      { id: "3", name: "prod-db", status: "running" },
      { id: "4", name: null, status: "running" },
      { id: "5", name: "x-agro-mx-1", status: "running" },
      { id: "6", name: "agro-mx-1013-090000", status: "destroyed" },
    ]);
    expect(withConsole("console_list", stubConsole(list)).stdout).toBe("2\n");
  });

  it("console_row_ssh prints the R10 line with the stored target", () => {
    const bin = stubConsole();
    expect(withConsole("console_create agro-mx-8 >/dev/null && console_row_ssh agro-mx-8", bin).stdout).toBe(
      "RESULT R10-ssh-inbound PASS ssh sandbox@203.0.113.7\n",
    );
  });
});
