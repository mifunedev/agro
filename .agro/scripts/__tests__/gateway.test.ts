import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSecretSet } from "../../cli/src/commands/secret.js";

const ROOT = join(import.meta.dirname, "../../..");
const GATEWAY = join(ROOT, ".agro/scripts/gateway.sh");

function gateway(): string {
  return readFileSync(GATEWAY, "utf8");
}

describe("gateway client-session launcher", () => {
  it("parses as valid bash", () => {
    execFileSync("bash", ["-n", GATEWAY]);
  });

  it("runs the pi backend under the self-healing supervisor", () => {
    expect(gateway()).toContain(".devcontainer/client-slack-supervise.sh");
  });

  it("runs the hermes backend via `hermes gateway run`", () => {
    expect(gateway()).toContain("hermes gateway run");
  });

  it("pins the hermes backend to the harness runtime home and cwd", () => {
    expect(gateway()).toContain("HERMES_GATEWAY_HOME:-$HARNESS/.hermes");
    expect(gateway()).toContain("HERMES_GATEWAY_CWD:-$HARNESS");
    expect(gateway()).toContain("/usr/local/bin/hermes");
    expect(gateway()).toContain("ensure_hermes_gateway_cwd");
  });

  it("syncs Hermes Teams env aliases when Teams is configured", () => {
    expect(gateway()).toContain("sync_hermes_teams_env_aliases");
  });

  it("matches session names EXACTLY (no client-slack-hermes prefix collision)", () => {
    expect(gateway()).toContain("grep -Fxq");
    expect(gateway()).not.toMatch(/^\s*tmux has-session/m);
  });

  it("exposes a msg-bridge configuration entrypoint", () => {
    expect(gateway()).toContain("gateway msg-bridge");
    expect(gateway()).toContain("/msg-bridge");
  });

  it("reconciles the installed bridge when the reviewed fork pin changes", () => {
    expect(gateway()).toContain("c8b96e9d0fb69611c4e67ae298d1d10d83792a26");
    expect(gateway()).toContain(".agro-pin");
    expect(gateway()).toContain('installed_pin" != "$FORK_PIN');
    expect(gateway()).toContain('printf \'%s\\n\' "$FORK_PIN" >"$bridge_pin_file"');
  });
});

interface PiFixture {
  harness: string;
  home: string;
  bin: string;
  tmuxArgs: string;
  piEnv: string;
  pwned: string;
}

function piFixture(): PiFixture {
  const temp = mkdtempSync(join(tmpdir(), "gateway-pi-"));
  const fixture: PiFixture = {
    harness: join(temp, "harness"),
    home: join(temp, "home"),
    bin: join(temp, "bin"),
    tmuxArgs: join(temp, "tmux-args.txt"),
    piEnv: join(temp, "pi-env.txt"),
    pwned: join(temp, "pwned"),
  };
  const { harness, home, bin } = fixture;
  mkdirSync(join(harness, ".devcontainer"), { recursive: true });
  mkdirSync(join(harness, ".agro", "scripts"), { recursive: true });
  mkdirSync(join(harness, ".pi"), { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(bin);

  writeFileSync(
    join(harness, ".pi", "msg-bridge.json"),
    JSON.stringify({ autoConnect: true, auth: { trustedUsers: [] } }),
  );
  cpSync(
    join(ROOT, ".devcontainer/seed-msg-bridge.sh"),
    join(harness, ".devcontainer/seed-msg-bridge.sh"),
  );
  writeFileSync(
    join(bin, "tmux"),
    [
      "#!/usr/bin/env bash",
      'case "$1" in',
      "  ls) exit 0 ;;",
      "  has-session) exit 1 ;;",
      "  pipe-pane) exit 0 ;;",
      "  kill-session) exit 0 ;;",
      "esac",
      "printf '%s\\n' \"$@\" > \"$TMUX_ARGS_FILE\"",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "pi"),
    `#!/usr/bin/env bash\nprintf 'PI_SLACK_APP_TOKEN=%s\nPI_SLACK_BOT_TOKEN=%s\n' "$PI_SLACK_APP_TOKEN" "$PI_SLACK_BOT_TOKEN" > "$PI_ENV_FILE"\n`,
    { mode: 0o755 },
  );
  writeFileSync(join(bin, "npm"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(harness, ".devcontainer", "client-slack-supervise.sh"),
    '#!/usr/bin/env bash\nexec pi --extension "${BRIDGE_ENTRY:-x}" --extension "${RECOVERY_ENTRY:-y}" --approve\n',
    { mode: 0o755 },
  );
  return fixture;
}

function launchPi({ harness, home, bin, tmuxArgs, piEnv, pwned }: PiFixture): string {
  const env = { ...process.env };
  delete env.PI_SLACK_APP_TOKEN;
  delete env.PI_SLACK_BOT_TOKEN;
  const path = `${bin}:${process.env.PATH ?? ""}`;

  execFileSync("bash", [GATEWAY, "pi"], {
    env: {
      ...env,
      HOME: home,
      HARNESS: harness,
      PATH: path,
      TMUX_ARGS_FILE: tmuxArgs,
      PI_ENV_FILE: piEnv,
      PWNED: pwned,
    },
  });

  const tmuxLines = readFileSync(tmuxArgs, "utf8").trim().split("\n");
  const tmuxCommand = tmuxLines[tmuxLines.length - 1] ?? "";
  execFileSync("bash", ["-c", tmuxCommand], {
    env: { ...env, HOME: harness, PATH: path, PI_ENV_FILE: piEnv, PWNED: pwned },
  });
  return tmuxCommand;
}

describe("gateway pi: launches client-slack-pi handling tokens as data", () => {
  it("hands the PI_SLACK_* tokens to the supervisor as data — never evaluates them", () => {
    const fixture = piFixture();
    writeFileSync(
      join(fixture.harness, ".devcontainer", ".env"),
      ["PI_SLACK_APP_TOKEN=xapp token; touch $PWNED", "PI_SLACK_BOT_TOKEN=xoxb'quoted"].join("\n"),
    );

    const tmuxCommand = launchPi(fixture);
    expect(tmuxCommand).toContain("bash -c");
    expect(tmuxCommand).toContain("client-slack-supervise.sh");
    expect(tmuxCommand).not.toContain("xapp token; touch $PWNED");
    expect(tmuxCommand).not.toContain("xoxb'quoted");

    expect(readFileSync(fixture.piEnv, "utf8")).toBe(
      ["PI_SLACK_APP_TOKEN=xapp token; touch $PWNED", "PI_SLACK_BOT_TOKEN=xoxb'quoted", ""].join("\n"),
    );
    expect(existsSync(fixture.pwned)).toBe(false);

    const seeded = join(fixture.home, ".pi/msg-bridge.json");
    expect(existsSync(seeded)).toBe(true);
    expect(readFileSync(seeded, "utf8")).toContain("autoConnect");
  });

  it("reads the tokens `agro secret set` writes when .devcontainer/.env is absent", async () => {
    const fixture = piFixture();
    const values = { PI_SLACK_APP_TOKEN: "xapp-test", PI_SLACK_BOT_TOKEN: "xoxb-test" };
    for (const [key, value] of Object.entries(values)) {
      const io = { stdout: () => {}, stderr: () => {}, askSecret: async () => value };
      expect(await runSecretSet(key, { bin: "agro", cwd: fixture.harness }, io)).toBe(0);
    }
    expect(existsSync(join(fixture.harness, ".devcontainer", ".env"))).toBe(false);

    launchPi(fixture);

    expect(readFileSync(fixture.piEnv, "utf8")).toBe(
      ["PI_SLACK_APP_TOKEN=xapp-test", "PI_SLACK_BOT_TOKEN=xoxb-test", ""].join("\n"),
    );
  });
});
