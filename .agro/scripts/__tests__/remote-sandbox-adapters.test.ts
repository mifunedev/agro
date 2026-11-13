import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const LIB = join(ROOT, ".agro/skills/sandbox/scripts/lib.sh");
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
      `  "node check") [ "\${AGRO_DOWN:-0}" = 1 ] && { echo "fail ssh-key: HTTP 503 no code"; exit 1; }; [ "\${CHECK_FAILS:-0}" = 1 ] && { echo "fail free-tier: not eligible (FREE_TIER_INELIGIBLE)"; exit 1; }; echo "ok ssh-key key-uuid" ;;`,
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
  it.each(["exedev", "vercel", "console", "msb"])("%s defines the five required functions", (provider) => {
    for (const fn of REQUIRED) expect(defined(`${provider}_${fn}`), `${provider}_${fn}`).toBe(true);
    expect(withLib(`valid_provider ${provider}`).code).toBe(0);
  });

  it("lists the four adapters as valid providers", () => {
    const providers = withLib("valid_providers").stdout.trim().split("\n");
    expect(providers).toEqual(expect.arrayContaining(["exedev", "vercel", "console", "msb"]));
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

  it("console_preflight runs agro node check with the free tier and the key", () => {
    const bin = stubConsole();
    const result = withConsole("console_preflight", bin);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("ok ssh-key key-uuid\n");
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe("node check --free-tier --ssh-key key-uuid\n");
  });

  it("console_preflight omits the free tier when CONSOLE_FREE_TIER=0 and the key without CONSOLE_SSH_KEY_ID", () => {
    const bin = stubConsole();
    expect(withConsole("unset CONSOLE_SSH_KEY_ID; CONSOLE_FREE_TIER=0 console_preflight", bin).code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe("node check\n");
  });

  it("console_create stops before agro node create when agro node check fails", () => {
    const bin = stubConsole();
    const result = withConsole('CHECK_FAILS=1 console_create agro-mx-0; echo "rc=$?"', bin);
    expect(result.stdout).toContain("fail free-tier: not eligible (FREE_TIER_INELIGIBLE)");
    expect(result.stdout).toContain("rc=1");
    expect(result.stderr).toContain("no node created");
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe("node check --free-tier --ssh-key key-uuid\n");
    expect(withLib(`test -e "$STATE_DIR/console-agro-mx-0"`).code).not.toBe(0);
  });

  it("console_preflight fails when the console does not answer", () => {
    expect(withConsole("AGRO_DOWN=1 console_preflight", stubConsole()).code).not.toBe(0);
  });

  it("console_preflight fails fast without CONSOLE_SSH_IDENTITY", () => {
    const bin = stubConsole();
    const result = withConsole("unset CONSOLE_SSH_IDENTITY; console_preflight", bin);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("CONSOLE_SSH_IDENTITY");
    expect(withLib(`test -e "${bin}/agro.calls"`).code).not.toBe(0);
  });

  it("console_create passes no --ssh-key without CONSOLE_SSH_KEY_ID", () => {
    const bin = stubConsole();
    expect(withConsole("unset CONSOLE_SSH_KEY_ID; console_create agro-mx-nokey", bin).code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe(
      "node check --free-tier\nnode create --spec n4 --name agro-mx-nokey --json --free-tier\n",
    );
  });

  it("console_create requests the free tier by default and stores the node", () => {
    const bin = stubConsole();
    const result = withConsole('console_create agro-mx-1 && cat "$STATE_DIR/console-agro-mx-1"', bin);
    expect(result.code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe(
      "node check --free-tier --ssh-key key-uuid\nnode create --spec n4 --ssh-key key-uuid --name agro-mx-1 --json --free-tier\n",
    );
    expect(result.stdout.trim().split("\n").at(-1)).toBe("node-1 sandbox@203.0.113.7");
  });

  it("console_create omits the free tier when CONSOLE_FREE_TIER=0 and honors CONSOLE_SPEC", () => {
    const bin = stubConsole();
    expect(withConsole("CONSOLE_FREE_TIER=0 CONSOLE_SPEC=n8 console_create agro-mx-2", bin).code).toBe(0);
    expect(withLib(`cat "${bin}/agro.calls"`).stdout).toBe(
      "node check --ssh-key key-uuid\nnode create --spec n8 --ssh-key key-uuid --name agro-mx-2 --json\n",
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

function stubMsb(list = "[]", guests = "", pid1 = ["systemd"], states = ["running"], gstate = ["running"]) {
  const bin = stubConsole(list);
  const home = join(bin, "home");
  mkdirSync(home, { recursive: true });
  writeFileSync(join(bin, "guests"), guests);
  const stubs: Record<string, string> = {
    ssh: [
      `printf '%s\\n' "$*" >> "${bin}/ssh.calls"`,
      '[ "${SSH_DOWN:-0}" = 1 ] && exit 255',
      `HOME="${home}" bash -c "\${@: -1}"`,
    ].join("\n"),
    msb: [
      `printf '%s\\n' "$*" >> "${bin}/msb.calls"`,
      'case "$1" in',
      '  --version) echo "msb 0.7.13" ;;',
      `  ls) if [ "$#" = 1 ]; then g=$(seq_next gstate); echo "NAME IMAGE STATUS CREATED"; for n in agro-mx-1 agro-mx-1-r; do echo "$n img $g 2026-11-03"; done; else cat "${bin}/guests"; fi ;;`,
      '  logs) echo "runtime log tail" ;;',
      '  run) echo "${@: -1}" ;;',
      '  exec) shift 3; "$@" ;;',
      "esac",
    ].join("\n"),
    sudo: `printf '%s\\n' "$*" >> "${bin}/sudo.calls"`,
    timeout: `printf '%s %s\\n' "$1" "$2" >> "${bin}/timeout.calls"\nexec "\${@:2}"`,
    ps: `[ "$*" = "-p 1 -o comm=" ] || exit 1\nseq_next pid1`,
    systemctl: `[ "$*" = "is-system-running" ] || exit 1\nprintf '%s\\n' "$*" >> "${bin}/systemctl.calls"\nseq_next states`,
    curl: [
      `printf '%s\\n' "$*" >> "${bin}/curl.calls"`,
      "printf '%s\\n' '#!/bin/sh' '    get_latest_version' 'mkdir -p \"$HOME/.microsandbox\"' 'chmod 777 \"$HOME/.microsandbox\"' 'echo \"installed $VERSION\"'",
    ].join("\n"),
  };
  const seqNext = [
    "seq_next() {",
    `  local n; n=$(( $(cat "${bin}/$1.n" 2>/dev/null || echo 0) + 1 )); echo "$n" > "${bin}/$1.n"`,
    `  sed -n "\${n}p" "${bin}/$1" | grep . || tail -n 1 "${bin}/$1"`,
    "}",
  ].join("\n");
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${seqNext}\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  writeFileSync(join(bin, "pid1"), `${pid1.join("\n")}\n`);
  writeFileSync(join(bin, "states"), `${states.join("\n")}\n`);
  writeFileSync(join(bin, "gstate"), `${gstate.join("\n")}\n`);
  return bin;
}

function stubSeq(bin: string) {
  writeFileSync(join(bin, "seq"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${bin}/seq.calls"\necho 1\n`);
  chmodSync(join(bin, "seq"), 0o755);
  return bin;
}

const MSB_ENV =
  "export IMAGE=ghcr.io/mifunedev/agro:spike-msb-abc; unset MSB_VERSION MSB_SSH_WAIT_TRIES MSB_SYSTEMD_WAIT_TRIES MSB_GUEST_CPUS MSB_GUEST_MEMORY MSB_GUEST MSB_GUEST_PHASE MSB_IDLE_WAIT IMAGE_SIZE_BYTES;";

function withMsb(script: string, bin: string) {
  return withConsole(`${MSB_ENV} STATE_DIR="${bin}/state"; mkdir -p "$STATE_DIR";\n${script}`, bin);
}

function calls(bin: string, name: string) {
  return withLib(`cat "${bin}/${name}.calls" 2>/dev/null`).stdout;
}

describe("remote-sandbox msb adapter", () => {
  it("msb defines restart and the ssh row hook", () => {
    for (const fn of ["msb_restart", "msb_row_ssh"]) expect(defined(fn), fn).toBe(true);
  });

  it("msb_preflight runs agro node check through the console adapter", () => {
    const bin = stubMsb();
    expect(withMsb("msb_preflight", bin).code).toBe(0);
    expect(calls(bin, "agro")).toBe("node check --free-tier --ssh-key key-uuid\n");
  });

  it("msb_preflight fails without CONSOLE_SSH_IDENTITY", () => {
    expect(withMsb("unset CONSOLE_SSH_IDENTITY; msb_preflight", stubMsb()).code).not.toBe(0);
  });

  it("msb_create refuses an unset IMAGE with exit 2 and creates nothing", () => {
    const bin = stubMsb();
    const result = withMsb("unset IMAGE; msb_create agro-mx-1; echo unreachable", bin);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("msb: set IMAGE");
    expect(result.stdout).not.toContain("unreachable");
    expect(calls(bin, "agro")).toBe("");
  });

  it("msb_create creates a free-tier console node and stores node, target, and guest", () => {
    const bin = stubMsb();
    const result = withMsb('msb_create agro-mx-1 && cat "$STATE_DIR/msb-agro-mx-1"', bin);
    expect(result.code).toBe(0);
    expect(calls(bin, "agro")).toBe(
      "node check --free-tier --ssh-key key-uuid\nnode create --spec n4 --ssh-key key-uuid --name agro-mx-1 --json --free-tier\n",
    );
    expect(result.stdout.trim().split("\n").at(-1)).toBe("node-1 sandbox@203.0.113.7 agro-mx-1");
  });

  it("msb_create adds sandbox to the kvm group in an earlier ssh session than msb run", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "sudo")).toBe("usermod -aG kvm sandbox\n");
    const sessions = calls(bin, "ssh").trim().split("\n");
    const kvm = sessions.findIndex((line) => line.includes("usermod -aG kvm sandbox"));
    const run = sessions.findIndex((line) => line.includes("msb run"));
    expect(kvm).toBeGreaterThanOrEqual(0);
    expect(run).toBeGreaterThan(kvm);
    expect(sessions[run]).toContain("-i /keys/id_ed25519");
    expect(sessions[run]).toContain("sandbox@203.0.113.7");
  });

  it("msb_create installs the pinned msb release", () => {
    const bin = stubMsb();
    const result = withMsb("msb_create agro-mx-1", bin);
    expect(result.code).toBe(0);
    expect(calls(bin, "curl")).toContain(
      "https://raw.githubusercontent.com/superradcompany/microsandbox/v0.7.13/scripts/install.sh",
    );
    expect(result.stdout).toContain("installed v0.7.13");
    expect(calls(bin, "msb")).toContain("--version\n");
  });

  it("msb_create honors MSB_VERSION and fails when the installed version differs", () => {
    const bin = stubMsb();
    const result = withMsb("MSB_VERSION=v0.8.0 msb_create agro-mx-1", bin);
    expect(result.code).not.toBe(0);
    expect(calls(bin, "curl")).toContain("/microsandbox/v0.8.0/scripts/install.sh");
    expect(calls(bin, "msb")).not.toContain("run ");
  });

  it("msb_create removes group write from ~/.microsandbox before msb run", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1", bin).code).toBe(0);
    expect(withLib(`stat -c %a "${bin}/home/.microsandbox"`).stdout).toBe("755\n");
    const session = calls(bin, "ssh").split("\n").find((line) => line.includes("msb run")) ?? "";
    expect(session.indexOf("chmod go-w ~/.microsandbox")).toBeGreaterThanOrEqual(0);
    expect(session.indexOf("chmod go-w ~/.microsandbox")).toBeLessThan(session.indexOf("msb run"));
  });

  it("msb_create boots the image detached with the init handoff and a 40G flat root disk", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "msb")).toContain(
      "run --detach --name agro-mx-1 --cpus 2 --memory 2G --init auto --root-disk flat:40G ghcr.io/mifunedev/agro:spike-msb-abc\n",
    );
  });

  it("msb_create honors MSB_GUEST_CPUS and MSB_GUEST_MEMORY", () => {
    const bin = stubMsb();
    expect(withMsb("MSB_GUEST_CPUS=4 MSB_GUEST_MEMORY=3G msb_create agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "msb")).toContain("run --detach --name agro-mx-1 --cpus 4 --memory 3G --init auto ");
  });

  it("msb_create fails when the host never answers ssh and keeps the node for destroy", () => {
    const bin = stubMsb();
    const result = withMsb('SSH_DOWN=1 MSB_SSH_WAIT_TRIES=2 msb_create agro-mx-1; echo "rc=$?"; cat "$STATE_DIR/msb-agro-mx-1"', bin);
    expect(result.stdout).toContain("rc=1\nnode-1 sandbox@203.0.113.7 agro-mx-1\n");
    expect(calls(bin, "msb")).toBe("");
  });

  it("msb_create waits 240 ssh tries of 5 s by default", () => {
    const bin = stubSeq(stubMsb());
    expect(withMsb("SSH_DOWN=1 msb_create agro-mx-1", bin).code).not.toBe(0);
    expect(calls(bin, "seq")).toBe("1 240\n");
    expect(calls(bin, "sleep")).toBe("5\n");
  });

  it("msb_create bounds the ssh wait with MSB_SSH_WAIT_TRIES", () => {
    const bin = stubMsb();
    const result = withMsb("SSH_DOWN=1 MSB_SSH_WAIT_TRIES=3 msb_create agro-mx-1", bin);
    expect(result.code).not.toBe(0);
    expect(calls(bin, "sleep")).toBe("5\n5\n5\n");
    expect(calls(bin, "ssh").trim().split("\n").filter((line) => line.endsWith(" true"))).toHaveLength(3);
  });

  it("msb_exec runs the command in the guest under timeout 120", () => {
    const bin = stubMsb();
    const result = withMsb('msb_create agro-mx-1 >/dev/null && msb_exec agro-mx-1 "echo a b | tr a z"', bin);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("z b\n");
    expect(calls(bin, "msb").trim().split("\n").at(-1)).toBe("exec agro-mx-1 -- env MSB_GUEST=1 bash -c echo a b | tr a z");
  });

  it("msb_exec always runs the guest command with MSB_GUEST=1", () => {
    const bin = stubMsb();
    const result = withMsb('msb_create agro-mx-1 >/dev/null && msb_exec agro-mx-1 \'echo "guest=$MSB_GUEST"\'', bin);
    expect(result.stdout).toBe("guest=1\n");
    expect(calls(bin, "msb").trim().split("\n").at(-1)).toMatch(/^exec agro-mx-1 -- env MSB_GUEST=1 bash -c /);
  });

  it("msb_exec forwards no optional guest variable that the driver does not set", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_exec agro-mx-1 true", bin).code).toBe(0);
    const ssh = calls(bin, "ssh").trim().split("\n").at(-1) ?? "";
    for (const name of ["MSB_GUEST_PHASE", "MSB_IDLE_WAIT", "IMAGE_SIZE_BYTES"]) expect(ssh).not.toContain(name);
  });

  it.each([
    ["MSB_GUEST_PHASE", "restart"],
    ["MSB_IDLE_WAIT", "30"],
    ["IMAGE_SIZE_BYTES", "4294967296"],
  ])("msb_exec forwards %s only when it is set", (name, value) => {
    const bin = stubMsb();
    const result = withMsb(`msb_create agro-mx-1 >/dev/null && ${name}=${value} msb_exec agro-mx-1 'echo "v=$${name}"'`, bin);
    expect(result.stdout).toBe(`v=${value}\n`);
    const ssh = calls(bin, "ssh").trim().split("\n").at(-1) ?? "";
    expect(ssh).toContain(`env MSB_GUEST=1 ${name}=${value} bash -c`);
    for (const other of ["MSB_GUEST_PHASE", "MSB_IDLE_WAIT", "IMAGE_SIZE_BYTES"].filter((n) => n !== name)) {
      expect(ssh).not.toContain(other);
    }
  });

  it("msb_exec quotes forwarded values that hold spaces and shell syntax", () => {
    const bin = stubMsb();
    const result = withMsb(
      `msb_create agro-mx-1 >/dev/null && MSB_GUEST_PHASE='a b; touch "${bin}/pwned"' msb_exec agro-mx-1 'printf "%s\\n" "$MSB_GUEST_PHASE"'`,
      bin,
    );
    expect(result.stdout).toBe(`a b; touch "${bin}/pwned"\n`);
    expect(withLib(`test -e "${bin}/pwned"`).code).not.toBe(0);
  });

  it("msb_exec returns the guest command status", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_exec agro-mx-1 'exit 7'", bin).code).toBe(7);
  });

  it("msb_exec bounds the ssh call with timeout 120", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_exec agro-mx-1 true", bin).code).toBe(0);
    expect(calls(bin, "timeout").trim().split("\n").at(-1)).toBe("120 ssh");
  });

  it("msb_exec fails without a stored guest", () => {
    expect(withMsb("msb_exec agro-mx-none true", stubMsb()).code).not.toBe(0);
  });

  it("msb_restart stops and then starts the stored guest", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_restart agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "msb")).toContain("stop agro-mx-1\nstart agro-mx-1\nls\nexec agro-mx-1 -- ");
  });

  it("msb_destroy removes the guest, then deletes the node", () => {
    const bin = stubMsb();
    const result = withMsb(
      'msb_create agro-mx-1 >/dev/null && msb_destroy agro-mx-1; echo "rc=$?"; test -e "$STATE_DIR/msb-agro-mx-1"; echo "state=$?"',
      bin,
    );
    expect(result.stdout).toContain("deleted node-1\nrc=0\nstate=1\n");
    expect(calls(bin, "msb").trim().split("\n").at(-1)).toBe("rm --force agro-mx-1");
    expect(withLib(`grep -c "^node delete node-1 --yes$" "${bin}/agro.calls"`).stdout).toBe("1\n");
  });

  it("msb_destroy retries a 409 on the node delete", () => {
    const bin = stubMsb();
    const result = withMsb("msb_create agro-mx-1 >/dev/null && CONFLICTS=2 msb_destroy agro-mx-1", bin);
    expect(result.code).toBe(0);
    expect(withLib(`cat "${bin}/deletes"`).stdout).toBe("3\n");
  });

  it("msb_destroy deletes the node when the guest removal fails", () => {
    const bin = stubMsb();
    const result = withMsb("msb_create agro-mx-1 >/dev/null && SSH_DOWN=1 msb_destroy agro-mx-1", bin);
    expect(result.code).toBe(0);
    expect(withLib(`grep -c "^node delete node-1 --yes$" "${bin}/agro.calls"`).stdout).toBe("1\n");
  });

  it("msb_list counts live agro-mx- nodes and agro-mx- guests on recorded hosts", () => {
    const list = JSON.stringify([
      { id: "1", name: "agro-mx-1", status: "running" },
      { id: "2", name: "prod-db", status: "running" },
      { id: "3", name: "agro-mx-0", status: "destroyed" },
    ]);
    const bin = stubMsb(list, "agro-mx-1\nagro-mx-2\nother\nx-agro-mx-3\n");
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_list", bin).stdout).toBe("3\n");
    expect(calls(bin, "msb")).toContain("ls --quiet\n");
  });

  it("msb_list counts only nodes when no host is recorded", () => {
    const list = JSON.stringify([{ id: "1", name: "agro-mx-1", status: "running" }]);
    const bin = stubMsb(list, "agro-mx-1\n");
    expect(withMsb("msb_list", bin).stdout).toBe("1\n");
    expect(calls(bin, "ssh")).toBe("");
  });

  it("msb_row_ssh prints the R10 line with the host target", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_row_ssh agro-mx-1", bin).stdout).toBe(
      "RESULT R10-ssh-inbound PASS ssh sandbox@203.0.113.7\n",
    );
  });

  it("msb_create returns only after the guest reports systemd as PID 1 and a running system", () => {
    const bin = stubMsb("[]", "", ["init.krun", "systemd", "systemd"], ["offline", "starting", "running"]);
    const result = withMsb('msb_create agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("msb: agro-mx-1 pid1=systemd system=running");
    expect(result.stdout).toContain("rc=0");
    expect(withLib(`cat "${bin}/pid1.n"`).stdout).toBe("3\n");
    expect(calls(bin, "sleep")).toBe("5\n5\n");
    const msb = calls(bin, "msb");
    expect(msb.indexOf("exec agro-mx-1")).toBeGreaterThan(msb.indexOf("run --detach"));
  });

  it("msb_create accepts a degraded system and records it", () => {
    const bin = stubMsb("[]", "", ["systemd"], ["initializing", "degraded"]);
    const result = withMsb('msb_create agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("msb: agro-mx-1 pid1=systemd system=degraded");
    expect(result.stdout).toContain("rc=0");
  });

  it("msb_create fails with a clear message when the systemd handoff never completes", () => {
    const bin = stubMsb("[]", "", ["init.krun"], ["offline"]);
    const result = withMsb('MSB_SYSTEMD_WAIT_TRIES=4 msb_create agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("rc=1");
    expect(result.stderr).toContain("msb: agro-mx-1 pid1=init.krun system=offline after 4 tries, systemd handoff not complete");
    expect(withLib(`cat "${bin}/pid1.n"`).stdout).toBe("4\n");
  });

  it("msb_wait_systemd waits 120 tries of 5 s by default", () => {
    const bin = stubSeq(stubMsb("[]", "", ["systemd"], ["starting"]));
    const result = withMsb('echo "node-1 sandbox@203.0.113.7 agro-mx-1" > "$STATE_DIR/msb-agro-mx-1"; msb_wait_systemd agro-mx-1', bin);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("after 120 tries");
    expect(calls(bin, "seq")).toBe("1 120\n");
    expect(calls(bin, "sleep")).toBe("5\n");
  });

  it("msb_restart returns only after the systemd handoff", () => {
    const bin = stubMsb("[]", "", ["systemd", "init.krun", "systemd"], ["running", "starting", "running"]);
    const result = withMsb('msb_create agro-mx-1 >/dev/null && msb_restart agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("rc=0");
    expect(withLib(`cat "${bin}/pid1.n"`).stdout).toBe("3\n");
    const msb = calls(bin, "msb");
    expect(msb.lastIndexOf("exec agro-mx-1")).toBeGreaterThan(msb.indexOf("start agro-mx-1"));
  });

  it("msb_restart fails when the systemd handoff never completes", () => {
    const bin = stubMsb("[]", "", ["systemd", "init.krun"], ["running", "offline"]);
    const result = withMsb('msb_create agro-mx-1 >/dev/null && MSB_SYSTEMD_WAIT_TRIES=2 msb_restart agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("rc=1");
  });

  it("msb_snapshot_restore stops, snapshots the disk, restores, starts, and retargets the state", () => {
    const bin = stubMsb();
    const result = withMsb(
      'msb_create agro-mx-1 >/dev/null && : > "${STATE_DIR%/state}/msb.calls" && msb_snapshot_restore agro-mx-1; echo "rc=$?"; cat "$STATE_DIR/msb-agro-mx-1"',
      bin,
    );
    expect(result.stdout).toContain("rc=0\nnode-1 sandbox@203.0.113.7 agro-mx-1-r agro-mx-1\n");
    expect(result.stdout).toMatch(/TIMING snapshot_restore_s=[0-9.]+ systemd_s=[0-9.]+/);
    expect(result.stdout).toContain("msb: agro-mx-1-r pid1=systemd system=running");
    const lines = calls(bin, "msb").trim().split("\n");
    expect(lines.slice(0, 5)).toEqual([
      "stop agro-mx-1",
      "snap create ready --sandbox agro-mx-1",
      "snap restore agro-mx-1:ready --name agro-mx-1-r --cpus 2 --memory 2G",
      "ls --running --quiet",
      "start agro-mx-1-r",
    ]);
    expect(lines.at(-1)).toMatch(/^exec agro-mx-1-r -- /);
  });

  it("msb_snapshot_restore skips start when the restored guest already runs", () => {
    const bin = stubMsb("[]", "agro-mx-1-r\n");
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_snapshot_restore agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "msb")).not.toContain("start agro-mx-1-r");
  });

  it("msb_snapshot_restore fails when the restored guest never reaches systemd", () => {
    const bin = stubMsb("[]", "", ["systemd", "init.krun"], ["running", "offline"]);
    const result = withMsb('msb_create agro-mx-1 >/dev/null && MSB_SYSTEMD_WAIT_TRIES=2 msb_snapshot_restore agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("rc=1");
    expect(result.stderr).toContain("msb: agro-mx-1-r pid1=init.krun");
  });

  it("msb_exec targets the restored guest after a snapshot restore", () => {
    const bin = stubMsb();
    expect(withMsb("msb_create agro-mx-1 >/dev/null && msb_snapshot_restore agro-mx-1 >/dev/null && msb_exec agro-mx-1 true", bin).code).toBe(0);
    expect(calls(bin, "msb").trim().split("\n").at(-1)).toBe("exec agro-mx-1-r -- env MSB_GUEST=1 bash -c true");
  });

  it("msb_destroy removes the original and the restored guests", () => {
    const bin = stubMsb();
    const result = withMsb("msb_create agro-mx-1 >/dev/null && msb_snapshot_restore agro-mx-1 >/dev/null && msb_destroy agro-mx-1", bin);
    expect(result.code).toBe(0);
    expect(calls(bin, "msb").trim().split("\n").at(-1)).toBe("rm --force agro-mx-1-r agro-mx-1");
    expect(withLib(`grep -c "^node delete node-1 --yes$" "${bin}/agro.calls"`).stdout).toBe("1\n");
  });

  it("msb_snapshot_restore keeps MSB_GUEST_CPUS and MSB_GUEST_MEMORY on the restored guest", () => {
    const bin = stubMsb();
    expect(withMsb("export MSB_GUEST_CPUS=3 MSB_GUEST_MEMORY=1536M; msb_create agro-mx-1 >/dev/null && msb_snapshot_restore agro-mx-1", bin).code).toBe(0);
    expect(calls(bin, "msb")).toContain("snap restore agro-mx-1:ready --name agro-mx-1-r --cpus 3 --memory 1536M\n");
  });

  it("msb_wait_systemd checks the guest state before each exec probe", () => {
    const bin = stubMsb("[]", "", ["init.krun", "systemd"], ["offline", "running"]);
    expect(withMsb("msb_create agro-mx-1", bin).code).toBe(0);
    const after = calls(bin, "msb").split("run --detach")[1].trim().split("\n").slice(1).map((line) => line.split(" ")[0]);
    expect(after).toEqual(["ls", "exec", "ls", "exec"]);
  });

  it.each(["stopped", "draining"])("msb_wait_systemd fails fast on a %s guest without another exec", (state) => {
    const bin = stubMsb("[]", "", ["init.krun"], ["offline"], ["running", state]);
    const result = withMsb('msb_create agro-mx-1; echo "rc=$?"', bin);
    expect(result.stdout).toContain("rc=1");
    expect(result.stderr).toContain(`msb: agro-mx-1 state=${state} before systemd handoff`);
    expect(result.stderr).toContain("runtime log tail");
    const after = calls(bin, "msb").split("run --detach")[1].trim().split("\n");
    expect(after.filter((line) => line.startsWith("exec "))).toHaveLength(1);
    expect(after.at(-1)).toBe("logs agro-mx-1 --source system --tail 20");
    expect(calls(bin, "sleep")).toBe("5\n");
  });

  it("msb_wait_systemd fails fast when the guest is already stopped", () => {
    const bin = stubMsb("[]", "", ["systemd"], ["running"], ["stopped"]);
    const result = withMsb('echo "node-1 sandbox@203.0.113.7 agro-mx-1" > "$STATE_DIR/msb-agro-mx-1"; msb_wait_systemd agro-mx-1', bin);
    expect(result.code).toBe(1);
    expect(calls(bin, "msb")).not.toContain("exec ");
  });
});
