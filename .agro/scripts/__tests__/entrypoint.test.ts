import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const ENTRYPOINT = join(ROOT, ".devcontainer/entrypoint.sh");

function entrypoint(): string {
  return readFileSync(ENTRYPOINT, "utf8");
}

describe("devcontainer entrypoint home mount ownership", () => {
  it("repairs the whole home mount with the sandbox user's current numeric uid/gid", () => {
    const text = entrypoint();

    expect(text).toContain("sandbox_ownership()");
    expect(text).toContain('$(id -u sandbox)');
    expect(text).toContain('$(id -g sandbox)');
    expect(text).toContain('owner="$(sandbox_ownership)"');
    expect(text).toContain('find /home/sandbox -path "$OH_PROJECT_ROOT" -prune -o');
    expect(text).toContain('-exec chown -h "$owner" {} +');
    expect(text).toContain("chmod 700 /home/sandbox/.ssh");
  });

  it("prunes the checkout rather than relying on -xdev, which the home mount defeats", () => {
    const text = entrypoint();

    expect(text).not.toContain("-xdev");
    expect(text).not.toContain('chown -hR "$owner" "/home/sandbox/$dir"');
  });

  it("seeds the home mount from the image before host UID reconciliation", () => {
    const text = entrypoint();
    const seedFn = text.indexOf("# >>> seed_home >>>");
    const seedCall = text.indexOf("seed_home /home/sandbox");
    const uidSync = text.indexOf("usermod -u \"$HOST_UID\" sandbox");

    expect(seedFn).toBeGreaterThan(-1);
    expect(text).toContain('if [ -e "$dest/$name" ] || [ -L "$dest/$name" ]; then');
    expect(text).toContain('find . -mindepth 1 -maxdepth 1');
    expect(text).toContain('${OH_HOME_SEED_SRC:-/opt/home-seed}');
    expect(seedCall).toBeGreaterThan(seedFn);
    expect(uidSync).toBeGreaterThan(seedCall);
  });

  it("runs home mount repair after host UID reconciliation", () => {
    const text = entrypoint();
    const uidSync = text.indexOf("usermod -u \"$HOST_UID\" sandbox");
    const secondRepair = text.indexOf('PW="${SANDBOX_PASSWORD:-test1234}"');

    expect(secondRepair).toBeGreaterThan(uidSync);
    const postUidSync = text.slice(secondRepair);
    const secondRepairCall = postUidSync.indexOf("repair_home_mount_ownership");
    const linkProviders = postUidSync.indexOf('bash "$CONTROL_DIR/scripts/link-providers.sh" --init');
    const hermesBlock = postUidSync.indexOf('if command -v hermes >/dev/null 2>&1; then');
    expect(secondRepairCall).toBeGreaterThan(-1);
    expect(linkProviders).toBeGreaterThan(secondRepairCall);
    expect(hermesBlock).toBeGreaterThan(linkProviders);
  });

  it("does not swallow host UID reconciliation failures", () => {
    const text = entrypoint();
    const block = text.slice(
      text.indexOf("uid_reconcile_step() {"),
      text.indexOf('PW="${SANDBOX_PASSWORD:-test1234}"'),
    );

    expect(block).toContain("uid_reconcile_step()");
    expect(block).toContain("WARNING: failed to");
    const reconBranch = block.slice(
      block.indexOf('if [ -d "$CHECKOUT_CONTROL_DIR" ]; then'),
      block.indexOf('echo "[entrypoint] no checkout bind at $HARNESS_DIR'),
    );
    expect(reconBranch).not.toContain("2>/dev/null || true");
    expect(reconBranch).not.toContain("groupmod -g \"$HOST_GID\" sandbox 2>/dev/null");
    expect(reconBranch).not.toContain("usermod -u \"$HOST_UID\" sandbox 2>/dev/null");
  });

  it("aligns the sandbox user with the docker socket GID without swallowing failures", () => {
    const text = entrypoint();
    const start = text.indexOf("SOCK=/var/run/docker.sock");
    const block = text.slice(start, text.indexOf("\nfi\n", start));

    expect(start).toBeGreaterThan(text.indexOf("uid_reconcile_step() {"));
    expect(block).toContain('if getent group "$SOCK_GID" >/dev/null 2>&1; then');
    expect(block).toContain('usermod -aG "$SOCK_GROUP" sandbox');
    expect(block).toContain('groupmod -g "$SOCK_GID" docker');
    expect(block).toContain("uid_reconcile_step");
    expect(block).not.toContain("2>/dev/null ||");
    expect(block).not.toContain("|| true");
  });

  it("prints UID sync success only after reconciliation commands report success", () => {
    const text = entrypoint();
    const block = text.slice(
      text.indexOf("uid_reconcile_step() {"),
      text.indexOf('PW="${SANDBOX_PASSWORD:-test1234}"'),
    );
    const usermod = block.indexOf("uid_reconcile_step \"set sandbox UID to host UID $HOST_UID\" usermod -u \"$HOST_UID\" sandbox");
    const success = block.indexOf("sandbox UID synced to host");
    const incomplete = block.indexOf("sandbox UID/GID reconciliation incomplete");

    expect(usermod).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(usermod);
    expect(incomplete).toBeGreaterThan(success);
    expect(block).toContain("if [ \"$UID_GID_SYNC_OK\" = \"true\" ]; then");
  });
});

describe("devcontainer entrypoint dual-generation control dir", () => {
  it("detects a checkout bind through compat_control_dir and refuses a divergent .oh/.agro pair", () => {
    const text = entrypoint();
    const detect = text.indexOf('if mountpoint -q "$HARNESS_DIR" 2>/dev/null; then');
    const resolve = text.indexOf('CHECKOUT_CONTROL_DIR="$(compat_selected_path compat_control_dir "$HARNESS_DIR")"');
    const refuse = text.indexOf("refusing to boot; resolve the conflict");
    const branch = text.indexOf('if [ -d "$CHECKOUT_CONTROL_DIR" ]; then');
    expect(detect).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(detect);
    expect(refuse).toBeGreaterThan(resolve);
    expect(branch).toBeGreaterThan(refuse);
    expect(text.slice(resolve, branch)).toContain("exit 1");
    expect(text).not.toContain('[ -d "$HARNESS_DIR/.oh" ]');
  });

  it("resolves CONTROL_DIR once after flavor detection and routes every control-plane path through it", () => {
    const text = entrypoint();
    const assignment = 'CONTROL_DIR="$(compat_selected_path compat_control_dir "$HARNESS" 2>/dev/null)" || CONTROL_DIR="$HARNESS/$COMPAT_AGRO_CONTROL_DIR"';
    expect(text.split(assignment).length - 1).toBe(1);
    const assigned = text.indexOf(assignment);
    expect(assigned).toBeGreaterThan(text.indexOf('seed_workspace_volume "$OH_PROJECT_ROOT"'));
    for (const use of [
      'bash "$CONTROL_DIR/scripts/link-providers.sh" --init',
      'bash "$CONTROL_DIR/scripts/provision-python.sh"',
      'BANNER_SOURCE_LINE="source ${CONTROL_DIR}/install/banner.sh 2>/dev/null"',
      'ln -sf "$CONTROL_DIR/scripts/gateway.sh" /usr/local/bin/gateway',
      '\\"$CONTROL_DIR\\"/scripts/gateway.sh pi',
    ]) {
      expect(text.indexOf(use), use).toBeGreaterThan(assigned);
    }
    const body = text.slice(text.indexOf("uid_reconcile_step() {"));
    expect(body).not.toMatch(/\$HARNESS\/\.agro\//);
    expect(body).not.toMatch(/\$\{OH_PROJECT_ROOT\}\/\.agro\//);
  });

  it("resolves the CLI executable through compat_env BIN with agro as the default", () => {
    const text = entrypoint();
    expect(text).toContain('CLI_BIN="$(compat_env_value BIN)"');
    expect(text).toContain('[ -n "$CLI_BIN" ] || CLI_BIN=agro');
    expect(text).toContain('gosu sandbox "$CLI_BIN" config show');
    expect(text).not.toContain("${OH_BIN:-");
  });

  it("resolves the control dir at run time in the compose healthchecks", () => {
    for (const file of [".devcontainer/docker-compose.yml", ".devcontainer/docker-compose.image-only.yml"]) {
      const compose = readFileSync(join(ROOT, file), "utf8");
      const test = compose.split("\n").find((line) => /^\s*test:/.test(line)) ?? "";
      expect(test, file).toContain('["CMD", "bash", "-c", "if [ -d /home/sandbox/harness/.agro ]; then exec bash /home/sandbox/harness/.agro/scripts/sandbox-healthcheck.sh; fi; exec bash /home/sandbox/harness/.oh/scripts/sandbox-healthcheck.sh"]');
    }
  });
});

describe("devcontainer entrypoint Slack restore (delegates to gateway.sh)", () => {
  it("exposes the bare `gateway` command via a live (idempotent) symlink", () => {
    expect(entrypoint()).toContain(
      'ln -sf "$CONTROL_DIR/scripts/gateway.sh" /usr/local/bin/gateway',
    );
  });

  it("gates on both Slack tokens + pi, then hands off to gateway.sh pi (one launch path)", () => {
    const text = entrypoint();
    expect(text).toContain("client-slack-pi");
    expect(text).toMatch(/grep -qE '\^PI_SLACK_APP_TOKEN=\.'/);
    expect(text).toMatch(/grep -qE '\^PI_SLACK_BOT_TOKEN=\.'/);
    expect(text).toContain('\\"$CONTROL_DIR\\"/scripts/gateway.sh pi');
  });

  it("reads token presence with grep — never sources the Compose env file", () => {
    const text = entrypoint();
    expect(text).not.toContain("source $SLACK_ENV");
    expect(text).not.toContain("set -a; source");
  });

  it("no longer extracts tokens inline (that logic moved into gateway.sh)", () => {
    const text = entrypoint();
    expect(text).not.toContain("SLACK_RUNTIME_ENV=$(mktemp");
    expect(text).not.toContain("shell_quote");
  });
});

describe("client-slack bridge supervisor", () => {
  const SUPERVISOR = join(ROOT, ".devcontainer/client-slack-supervise.sh");

  it("parses as valid bash", () => {
    execFileSync("bash", ["-n", SUPERVISOR]);
  });

  it("restarts pi on stale-ctx and crash, clears the lock, stops on a clean exit", () => {
    const text = readFileSync(SUPERVISOR, "utf8");
    expect(text).toContain("ctx is stale");
    expect(text).toContain("pkill -f 'pi-messenger-bridge/dist/index.js'");
    const piLine = text.split("\n").find((l) => /^\s*pi --extension/.test(l)) ?? "";
    expect(piLine).toContain("--approve");
    expect(piLine).toContain('--extension "$RECOVERY_ENTRY"');
    expect(piLine).not.toContain("--mode rpc");
    expect(piLine).not.toContain("tee");
    expect(piLine).toContain('2>>"$LOG"');
    expect(text).toContain("bridge-recovery");
    expect(text).toContain("rc=$?");
    expect(text).toContain('rm -f "$LOCK"');
    expect(text).toMatch(/\$rc"?\s+-eq\s+0/);
    expect(text).toContain("break");
    expect(text).toContain("restarting in 3s");
  });

  it("is referenced by gateway.sh, which the entrypoint delegates to", () => {
    const gateway = readFileSync(join(ROOT, ".agro/scripts/gateway.sh"), "utf8");
    expect(gateway).toContain(".devcontainer/client-slack-supervise.sh");
    expect(entrypoint()).toContain('\\"$CONTROL_DIR\\"/scripts/gateway.sh pi');
  });
});

describe("devcontainer entrypoint cron supervision", () => {
  const CRON_UNIT = join(ROOT, ".devcontainer/openharness-cron.service");
  const BOOTSTRAP_UNIT = join(ROOT, ".devcontainer/openharness-bootstrap.service");

  it("owns no cron supervision — systemd does", () => {
    const text = entrypoint();

    for (const retired of [
      "cron-watchdog",
      "cron-system",
      "system-cron",
      "CRON_WATCHDOG_INTERVAL",
    ]) {
      expect(text).not.toContain(retired);
    }
  });

  it("runs as a finite bootstrap oneshot and only execs a command when one is given", () => {
    const unit = readFileSync(BOOTSTRAP_UNIT, "utf8");

    expect(unit).toContain("Type=oneshot");
    expect(unit).toContain("RemainAfterExit=yes");
    expect(unit).toContain("ExecStart=/usr/local/bin/entrypoint.sh");
    expect(unit).toContain("KillMode=process");
    expect(entrypoint()).toContain('if [ "$#" -gt 0 ]; then\n  exec "$@"\nfi');
  });

  it("supervises cron-runtime.ts with a native systemd service", () => {
    const unit = readFileSync(CRON_UNIT, "utf8");

    expect(unit).toContain(
      "ExecStart=/bin/bash -c 'if [ -d /home/sandbox/harness/.agro ]; then exec /usr/local/bin/node --experimental-strip-types /home/sandbox/harness/.agro/scripts/cron-runtime.ts; fi; exec /usr/local/bin/node --experimental-strip-types /home/sandbox/harness/.oh/scripts/cron-runtime.ts'",
    );
    const execStart = unit.split("\n").find((line) => line.startsWith("ExecStart=")) ?? "";
    expect(execStart).not.toContain("$");
    expect(unit).toContain("User=sandbox");
    expect(unit).toContain("WorkingDirectory=/home/sandbox/harness");
    expect(unit).toContain("ExecReload=/bin/kill -HUP $MAINPID");
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain("StartLimitIntervalSec=");
    expect(unit).toContain("StartLimitBurst=");
    expect(unit).toContain("Requires=openharness-bootstrap.service");
    expect(unit).toContain("After=openharness-bootstrap.service");
    expect(unit).toContain("KillMode=process");
  });
});

describe("msg-bridge seed/merge (seed-msg-bridge.sh)", () => {
  const SEED_SCRIPT = join(ROOT, ".devcontainer/seed-msg-bridge.sh");

  function runSeed(seedJson: unknown, runtimeJson?: string): unknown {
    const home = mkdtempSync(join(tmpdir(), "seed-msg-bridge-"));
    const seed = join(home, "seed.json");
    writeFileSync(seed, JSON.stringify(seedJson));
    const dest = join(home, ".pi/msg-bridge.json");
    if (runtimeJson !== undefined) {
      mkdirSync(join(home, ".pi"), { recursive: true });
      writeFileSync(dest, runtimeJson);
    }
    execFileSync("bash", [SEED_SCRIPT, seed], { env: { ...process.env, HOME: home } });
    return { dest, raw: readFileSync(dest, "utf8") };
  }

  it("parses as valid bash", () => {
    execFileSync("bash", ["-n", SEED_SCRIPT]);
  });

  it("installs the tracked seed verbatim on first boot", () => {
    const { raw } = runSeed({ autoConnect: true, showWidget: true, auth: { trustedUsers: [] } }) as {
      raw: string;
    };
    const dest = JSON.parse(raw);
    expect(dest.showWidget).toBe(true);
    expect(dest.auth.trustedUsers).toEqual([]);
  });

  it("preserves operator grants on reboot while adopting non-grant seed structure", () => {
    const { raw } = runSeed(
      { autoConnect: true, showWidget: true, auth: { trustedUsers: [] } },
      JSON.stringify({
        autoConnect: false,
        auth: {
          trustedUsers: ["slack:UOPERATOR"],
          channels: { CCHANNEL: { enabled: true } },
        },
      }),
    ) as { raw: string };
    const merged = JSON.parse(raw);
    expect(merged.auth.trustedUsers).toEqual(["slack:UOPERATOR"]);
    expect(merged.auth.channels).toHaveProperty("CCHANNEL");
    expect(merged.showWidget).toBe(true);
  });

  it("leaves a malformed runtime file untouched (never clobbers on jq failure)", () => {
    const malformed = "{ not valid json ";
    const { raw } = runSeed({ autoConnect: true, auth: { trustedUsers: [] } }, malformed) as {
      raw: string;
    };
    expect(raw).toBe(malformed);
  });
});
