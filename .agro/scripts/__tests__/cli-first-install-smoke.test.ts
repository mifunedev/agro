import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const SCRIPT = join(ROOT, ".agro", "scripts", "cli-first-install-smoke.sh");
const WORKFLOW = join(ROOT, ".github", "workflows", "sandbox-boot-guard.yml");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function run(args: string[], env: Record<string, string> = {}, opts: { path?: string } = {}) {
  return spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      PATH: opts.path ?? process.env.PATH,
    },
  });
}

function fixtureDocker(opts: { keepId?: boolean; inheritHost?: boolean; socketMounted?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cli-first-smoke-"));
  cleanups.push(dir);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const state = join(dir, "state");
  mkdirSync(state);
  writeFileSync(join(state, "seq"), "0");
  writeFileSync(join(state, "socket"), opts.socketMounted ? "1" : "0");
  const docker = join(bin, "docker");
  const inheritHost = opts.inheritHost ? "1" : "0";
  writeFileSync(
    docker,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `state=${JSON.stringify(state)}`,
      `INHERIT=${inheritHost}`,
      'seqf="$state/seq"',
      'cidf="$state/cid"',
      'sockf="$state/socket"',
      'logf="$state/docker.log"',
      'printf "%s\\n" "$*" >> "$logf"',
      'case "$1" in',
      "  ps)",
      '    if [ -f "$cidf" ]; then cat "$cidf"; fi',
      "    exit 0",
      "    ;;",
      "  inspect)",
      '    cid=$(cat "$cidf" 2>/dev/null || echo missing)',
      '    if [[ "$*" == *Mounts*Destination* ]]; then echo vol-fixed; exit 0; fi',
      '    if [[ "$*" == *Mounts*Source* ]]; then',
      '      if [ "$(cat "$sockf")" = "1" ]; then echo /var/run/docker.sock; fi',
      "      exit 0",
      "    fi",
      '    echo "$cid"',
      "    exit 0",
      "    ;;",
      "  exec)",
      '    all="$*"',
      '    if [[ "$all" == *healthcheck* ]]; then exit 0; fi',
      "    if [[ \"\$all\" == *'ps -p 1'* ]]; then printf 'systemd\\n'; exit 0; fi",
      '    if [[ "$all" == *systemctl* ]]; then exit 0; fi',
      "    if [[ \"\$all\" == *'.agro/.image-seeded'* && \"\$all\" == *test* ]]; then exit 0; fi",
      "    if [[ \"\$all\" == *'test -d /home/sandbox/harness/.agro'* ]]; then exit 0; fi",
      "    if [[ \"\$all\" == *'test ! -e /home/sandbox/harness/.oh'* ]]; then exit 0; fi",
      "    if [[ \"\$all\" == *'test -S /var/run/docker.sock'* ]]; then",
      '      [ "$(cat "$sockf")" = "1" ] && exit 0 || exit 1',
      "    fi",
      "    if [[ \"\$all\" == *'docker info'* ]]; then",
      '      if [ -n "${DOCKER_HOST:-}" ] && [ "$INHERIT" = "1" ]; then exit 0; fi',
      '      [ "$(cat "$sockf")" = "1" ] && exit 0 || exit 1',
      "    fi",
      '    if [[ "$all" == *sha256sum* ]]; then echo "abc123  file"; exit 0; fi',
      "    if [[ \"\$all\" == *'stat -c'* ]]; then echo \"600 1000 1000\"; exit 0; fi",
      "    exit 0",
      "    ;;",
      "  volume|rm)",
      "    exit 0",
      "    ;;",
      "  *)",
      "    exit 0",
      "    ;;",
      "esac",
      "",
    ].join("\n"),
    "utf8",
  );
  chmodSync(docker, 0o755);

  const agro = join(bin, "agro");
  writeFileSync(
    agro,
    `#!/usr/bin/env bash
set -euo pipefail
state=${JSON.stringify(state)}
cidf="$state/cid"
seqf="$state/seq"
sockf="$state/socket"
logf="$state/agro.log"
printf '%s\\n' "$*" >> "$logf"
keep=${opts.keepId ? "1" : "0"}
case "$1 $2" in
  "sandbox install")
    seq=$(cat "$seqf")
    seq=$((seq + 1))
    echo "$seq" > "$seqf"
    if [ "$keep" = "1" ]; then echo "cid-same" > "$cidf"; else echo "cid-$seq" > "$cidf"; fi
    if [[ "$*" == *latest* ]]; then echo "refused latest" >&2; exit 1; fi
    exit 0
    ;;
  "config set")
    echo "$*" > "$state/config"
    if [[ "$*" == *dockerSocket*true* ]]; then echo 1 > "$sockf"; else echo 0 > "$sockf"; fi
    exit 0
    ;;
  "config show")
    echo '{"access":{"dockerSocket":false}}'
    exit 0
    ;;
  stop*|destroy*)
    exit 0
    ;;
esac
if [ "$1" = "stop" ] || [ "$1" = "destroy" ]; then exit 0; fi
echo "unexpected agro $*" >&2
exit 2
`,
    "utf8",
  );
  chmodSync(agro, 0o755);
  return { dir, bin, state };
}

describe("cli-first-install-smoke.sh", () => {
  const source = readFileSync(SCRIPT, "utf8");

  it("is an executable strict bash script that parses", () => {
    expect(statSync(SCRIPT).mode & 0o111).not.toBe(0);
    expect(source.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(source).toContain("set -euo pipefail");
    expect(source).toContain('NAME_PREFIX="agro-cli-first"');
    expect(source).toContain('if [ ! -f "$home/.profile" ]; then');
    expect(source).toContain('cd "$cli_dir"');
    expect(source).toContain("*openharness-*.tgz");
    expect(source).toContain("mifune-agro-*.tgz");
    expect(source).toContain('echo "node_after=$(command -v node) version=$(node --version)"');
    const parsed = spawnSync("bash", ["-n", SCRIPT], { encoding: "utf8" });
    expect(parsed.status, parsed.stderr).toBe(0);
  });

  it("prints the argument contract", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    for (const item of [
      "--phase",
      "--image",
      "--workdir",
      "--require-docker",
      "--bootstrap-without-node",
      "--cleanup-only",
      "pack",
      "bootstrap",
      "seed",
      "recreate",
    ]) {
      expect(help.stdout).toContain(item);
    }
  });

  it("refuses a released latest image", () => {
    const result = run(["--phase", "seed", "--image", "ghcr.io/mifunedev/agro:latest"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("refusing released latest image");
    expect(result.stderr).toContain("ghcr.io/mifunedev/agro:latest");
  });

  it("refuses unscoped cleanup", () => {
    const missing = run(["--cleanup-only", "--workdir", join(tmpdir(), `cli-first-missing-${process.pid}-${Date.now()}`)]);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("refusing unscoped cleanup");

    const workdir = mkdtempSync(join(tmpdir(), "cli-first-unscoped-"));
    cleanups.push(workdir);
    writeFileSync(join(workdir, "manifest"), "");
    const flagged = run(["--cleanup-only", "--workdir", workdir], { CLI_FIRST_CLEANUP_SCOPE: "unscoped" });
    expect(flagged.status).not.toBe(0);
    expect(flagged.stderr).toContain("refusing unscoped cleanup");
  });

  it("refuses --bootstrap-without-node when node is present", () => {
    const result = run(["--phase", "bootstrap", "--bootstrap-without-node"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("bootstrap-without-node requires node to be absent");
  });

  it("provisions through agro with an explicit candidate image and isolated home", () => {
    const fx = fixtureDocker();
    const workdir = join(fx.dir, "work");
    mkdirSync(workdir);
    const result = run(
      ["--phase", "seed", "--image", "openharness-sandbox-boot-guard:abc", "--workdir", workdir, "--keep"],
      { CLI_FIRST_AGRO: join(fx.bin, "agro"), CLI_FIRST_TIMEOUT_SECONDS: "1", CLI_FIRST_INTERVAL_SECONDS: "0" },
      { path: `${fx.bin}:${process.env.PATH ?? ""}` },
    );
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain("seed_image=openharness-sandbox-boot-guard:abc");
    expect(result.stdout).not.toContain(":latest");
    const agroLog = readFileSync(join(fx.state, "agro.log"), "utf8");
    expect(agroLog).toContain("sandbox install docker");
    expect(agroLog).toContain("--image=openharness-sandbox-boot-guard:abc");
    expect(agroLog).not.toContain("--repo");
  });

  it("rejects recreation that keeps the container id", () => {
    const fx = fixtureDocker({ keepId: true });
    const workdir = join(fx.dir, "work");
    mkdirSync(workdir);
    const result = run(
      ["--phase", "recreate", "--image", "candidate:sha", "--workdir", workdir, "--keep"],
      { CLI_FIRST_AGRO: join(fx.bin, "agro"), CLI_FIRST_TIMEOUT_SECONDS: "1", CLI_FIRST_INTERVAL_SECONDS: "0" },
      { path: `${fx.bin}:${process.env.PATH ?? ""}` },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("recreation kept container id");
  });

  it("targets the socket inside the container and ignores runner DOCKER_HOST", () => {
    const fx = fixtureDocker({ inheritHost: true, socketMounted: false });
    const workdir = join(fx.dir, "work");
    mkdirSync(workdir);
    const result = run(
      ["--phase", "recreate", "--image", "candidate:sha", "--workdir", workdir, "--keep"],
      {
        CLI_FIRST_AGRO: join(fx.bin, "agro"),
        CLI_FIRST_TIMEOUT_SECONDS: "1",
        CLI_FIRST_INTERVAL_SECONDS: "0",
        DOCKER_HOST: "tcp://example.invalid:2375",
      },
      { path: `${fx.bin}:${process.env.PATH ?? ""}` },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/docker\.sock|Docker API|DOCKER_HOST/);
  });

  it("is wired into sandbox-boot-guard.yml against the locally built candidate image", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    expect(workflow).toContain("cli-first-install-smoke.sh");
    expect(workflow).toContain("openharness-sandbox-boot-guard:${{ github.sha }}");
    expect(workflow).toContain("--require-docker");
    expect(workflow).toContain("--bootstrap-without-node");
    expect(workflow).toContain("debian:bookworm-slim");
    expect(workflow).toContain("set -o pipefail");
    expect(workflow).not.toContain("ghcr.io/mifunedev/agro:latest");
    expect(workflow).not.toMatch(/cli-first-install-smoke[\s\S]*continue-on-error/);
  });

  it("rejects npm pack of the root openharness package", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-first-pack-"));
    cleanups.push(dir);
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const bundle = join(dir, "agro.js");
    writeFileSync(bundle, "#!/usr/bin/env node\nconsole.log(\"9.9.9\")\n");
    chmodSync(bundle, 0o755);
    writeFileSync(
      join(bin, "npm"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [[ "$*" == *pack* ]]; then',
        "  dest=",
        "  prev=",
        '  for a in "$@"; do',
        '    if [ "$prev" = "--pack-destination" ]; then dest="$a"; fi',
        '    prev="$a"',
        "  done",
        '  [ -n "$dest" ] || dest="."',
        '  : > "$dest/openharness-0.9.0.tgz"',
        "  echo openharness-0.9.0.tgz",
        "  exit 0",
        "fi",
        "exit 0",
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(join(bin, "npm"), 0o755);
    const workdir = join(dir, "work");
    mkdirSync(workdir);
    const result = run(
      ["--phase", "pack", "--workdir", workdir, "--bundle", bundle, "--keep"],
      {},
      { path: `${bin}:${process.env.PATH ?? ""}` },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("openharness");
    expect(result.stderr).toContain(".agro/cli");
  });
});
