import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro/skills/t3/scripts/t3-code.sh");

const SERVER_URL = "http://localhost:3773/pair#token=server-token";

const HERDR_ENV = {
  HERDR_ENV: "1",
  HERDR_PANE_ID: "pane-1",
  HERDR_SOCKET_PATH: "/tmp/herdr.sock",
  HERDR_TAB_ID: "tab-1",
  HERDR_WORKSPACE_ID: "ws-1",
};

const HERDR_NAMES = "env | sed -n 's/^\\(HERDR_[A-Za-z0-9_]*\\)=.*/\\1/p'";

const STUBS: Record<string, string> = {
  tmux: [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'cmd="$1"; shift',
    'case "$cmd" in',
    "  new-session)",
    '    name="" command=""',
    "    while [[ $# -gt 0 ]]; do",
    '      case "$1" in',
    "        -d) shift ;;",
    '        -s) name="$2"; shift 2 ;;',
    '        *) command="$1"; shift ;;',
    "      esac",
    "    done",
    '    touch "$STUB_STATE/session-$name"',
    '    sh -c "$command"',
    "    ;;",
    '  has-session) [[ -f "$STUB_STATE/session-$2" ]] ;;',
    "  capture-pane) ;;",
    '  kill-session) rm -f "$STUB_STATE/session-$2" ;;',
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n"),
  npx: [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'case "$3" in',
    "  serve)",
    '    echo "$*" >> "$STUB_STATE/serve-calls"',
    `    ${HERDR_NAMES} > "$STUB_STATE/serve-herdr"`,
    `    echo "Pair this device: ${SERVER_URL}"`,
    "    ;;",
    "  pair)",
    '    echo "$*" >> "$STUB_STATE/pair-calls"',
    `    ${HERDR_NAMES} > "$STUB_STATE/pair-herdr"`,
    `    echo "${SERVER_URL}"`,
    "    ;;",
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n"),
  node: "#!/usr/bin/env bash\necho v24.10.0\n",
  curl: "#!/usr/bin/env bash\nexit 0\n",
};

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function sandbox() {
  const temp = mkdtempSync(join(tmpdir(), "t3-code-"));
  cleanups.push(temp);
  const bin = join(temp, "bin");
  const state = join(temp, "state");
  mkdirSync(bin);
  mkdirSync(state);
  for (const [name, body] of Object.entries(STUBS)) writeFileSync(join(bin, name), body, { mode: 0o755 });

  const run = (...args: string[]) => {
    const result = spawnSync(
      "bash",
      [SCRIPT, ...args, "--session", "t3-test", "--log", join(temp, "t3-test.log")],
      {
        env: { ...process.env, ...HERDR_ENV, PATH: `${bin}:${process.env.PATH ?? ""}`, STUB_STATE: state },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  const read = (name: string) => (existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8") : null);
  return { run, read };
}

describe("t3-code.sh Herdr environment", () => {
  it("start launches t3 serve without HERDR_* variables", () => {
    const { run, read } = sandbox();
    const result = run("start");
    expect(result.status, result.stderr).toBe(0);
    expect(read("serve-herdr")).toBe("");
  });

  it("pair runs t3 pair without HERDR_* variables", () => {
    const { run, read } = sandbox();
    expect(run("start").status).toBe(0);
    const result = run("pair");
    expect(result.status, result.stderr).toBe(0);
    expect(read("pair-herdr")).toBe("");
  });
});

describe("t3-code.sh pairing URL", () => {
  it("start reports the localhost URL and does not run t3 pair", () => {
    const { run, read } = sandbox();
    const result = run("start");
    expect(result.status, result.stderr).toBe(0);
    expect(read("serve-calls")).toBe("--yes t3@latest serve\n");
    expect(read("pair-calls")).toBeNull();
    const pairingLines = result.stdout.split("\n").filter((line) => line.startsWith("Pairing URL:"));
    expect(pairingLines).toEqual([`Pairing URL: ${SERVER_URL}`]);
  });

  it("pair mints a local pairing URL with plain t3 pair", () => {
    const { run, read } = sandbox();
    expect(run("start").status).toBe(0);
    const result = run("pair");
    expect(result.status, result.stderr).toBe(0);
    expect(read("pair-calls")).toBe("--yes t3@latest pair\n");
    expect(result.stdout).toContain(SERVER_URL);
  });
});
