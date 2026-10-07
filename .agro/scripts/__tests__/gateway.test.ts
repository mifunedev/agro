import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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

  it("does not rewrite Hermes credentials during startup", () => {
    expect(gateway()).not.toContain("sync_hermes_teams_env_aliases");
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


const hermesFixtures: string[] = [];
afterEach(() => hermesFixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

function hermesFixture(workspaceName = "workspace with spaces") {
  const temp = mkdtempSync(join(tmpdir(), "gateway-hermes-"));
  hermesFixtures.push(temp);
  const harness = join(temp, workspaceName);
  const home = join(harness, ".hermes");
  const bin = join(temp, "bin");
  mkdirSync(join(harness, ".devcontainer"), { recursive: true });
  mkdirSync(home);
  mkdirSync(bin);
  const configLog = join(temp, "config-call");
  const launchLog = join(temp, "launch-call");
  const tmuxLog = join(temp, "tmux-call");
  writeFileSync(join(bin, "hermes"), `#!/usr/bin/env bash
if [ "$1" = config ]; then
  printf '%s\\n' "$HERMES_HOME" "$@" > "$CONFIG_LOG"
  exit "\${CONFIG_EXIT:-0}"
fi
printf '%s\\n' "$HERMES_HOME" "$HERMES_GATEWAY_CWD" "$PWD" "$@" > "$LAUNCH_LOG"
`, { mode: 0o755 });
  writeFileSync(join(bin, "tmux"), `#!/usr/bin/env bash
case "$1" in
  ls|pipe-pane) exit 0 ;;
  new-session)
    printf '%s\\n' "$@" > "$TMUX_LOG"
    bash -c "\${!#}"
    ;;
esac
`, { mode: 0o755 });
  writeFileSync(join(harness, ".devcontainer/client-slack-supervise.sh"), '#!/usr/bin/env bash\nexec bash -c "$SUPERVISE_CMD"\n', { mode: 0o755 });
  const env: NodeJS.ProcessEnv = {
    PATH: `${bin}:${process.env.PATH}`, HOME: join(temp, "user"), HARNESS: harness,
    TMPDIR: temp, CONFIG_LOG: configLog, LAUNCH_LOG: launchLog, TMUX_LOG: tmuxLog,
  };
  return { harness, home, env, configLog, launchLog, tmuxLog,
    launch: (extra: NodeJS.ProcessEnv = {}) => spawnSync("bash", [GATEWAY, "hermes"], { encoding: "utf8", env: { ...env, ...extra }, cwd: temp }) };
}

describe("Hermes gateway workspace contract", () => {
  it.each(["auth.json", ".env", "config.yaml"])("rejects configured default home (%s) before config or tmux", file => {
    const t = hermesFixture();
    const fallback = join(t.env.HOME!, ".hermes");
    mkdirSync(fallback, { recursive: true });
    writeFileSync(join(fallback, file), "private-default-fixture\n");
    const result = t.launch();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(fallback);
    expect(result.stderr).toContain("explicitly select");
    expect(result.stderr).not.toContain("private-default-fixture");
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
    expect(readFileSync(join(fallback, file), "utf8")).toBe("private-default-fixture\n");
  });

  it.each(["HERMES_HOME", "HERMES_GATEWAY_HOME"])("accepts deliberate %s selection with configured default home", key => {
    const t = hermesFixture();
    const fallback = join(t.env.HOME!, ".hermes");
    mkdirSync(fallback, { recursive: true });
    writeFileSync(join(fallback, "auth.json"), "fixture-state\n");
    expect(t.launch({ [key]: t.home }).status).toBe(0);
  });

  it("launches a workspace path containing a single quote as data", () => {
    const t = hermesFixture("workspace 'quoted");
    const result = t.launch();
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(t.launchLog, "utf8")).toBe([t.home, t.harness, t.harness, "gateway", "run", ""].join("\n"));
  });

  it("rejects a foreign inherited home before configuration or launch", () => {
    const t = hermesFixture();
    const before = "CLIENT_ID=fixture-client\nCLIENT_SECRET=fixture-secret\n";
    writeFileSync(join(t.home, ".env"), before);
    const result = t.launch({ HERMES_HOME: join(t.harness, "foreign") });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unset HERMES_HOME");
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
    expect(readFileSync(join(t.home, ".env"), "utf8")).toBe(before);
  });

  it.each(["file", "environment"])("rejects legacy-only Teams keys from %s before config or tmux", source => {
    const t = hermesFixture();
    const legacy = { CLIENT_ID: "private-client", CLIENT_SECRET: "private-secret", TENANT_ID: "private-tenant" };
    const before = "# Keep these bytes\r\nexport CLIENT_ID = 'private-client'\r\nCLIENT_SECRET=private-secret\r\nTENANT_ID=private-tenant\r\n";
    writeFileSync(join(t.home, ".env"), source === "file" ? before : "# untouched\n");
    const bytes = readFileSync(join(t.home, ".env"));
    const result = t.launch(source === "environment" ? legacy : {});
    expect(result.status).toBe(1);
    for (const key of ["TEAMS_CLIENT_ID", "TEAMS_CLIENT_SECRET", "TEAMS_TENANT_ID"]) expect(result.stderr).toContain(key);
    for (const value of Object.values(legacy)) expect(result.stdout + result.stderr).not.toContain(value);
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
    expect(readFileSync(join(t.home, ".env"))).toEqual(bytes);
  });

  it.each(["", "''", '""'])("rejects empty canonical Teams assignments (%j) before config or tmux", empty => {
    const t = hermesFixture();
    const legacy = { CLIENT_ID: "private-client", CLIENT_SECRET: "private-secret", TENANT_ID: "private-tenant" };
    const before = Object.entries(legacy).map(([key, value]) => `${key}=${value}\r\nexport TEAMS_${key} = ${empty}\r\n`).join("");
    writeFileSync(join(t.home, ".env"), before);
    const bytes = readFileSync(join(t.home, ".env"));
    const result = t.launch();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(Object.keys(legacy).map(key => `[gateway] legacy Teams key ${key} requires TEAMS_${key}.\n`).join("")
      + "[gateway] configure the required TEAMS_* keys in the selected home's .env or environment, then retry.\n"
      + "[gateway] gateway startup does not copy credential values or rewrite .env.\n");
    for (const value of Object.values(legacy)) expect(result.stdout + result.stderr).not.toContain(value);
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
    expect(readFileSync(join(t.home, ".env"))).toEqual(bytes);
  });

  it.each(["file", "environment", "mixed"])("respects canonical Teams keys from %s without rewriting legacy keys", source => {
    const t = hermesFixture();
    const canonical = { TEAMS_CLIENT_ID: "canonical-client", TEAMS_CLIENT_SECRET: "canonical-secret", TEAMS_TENANT_ID: "canonical-tenant" };
    const pairs = Object.entries(canonical);
    const inFile = source === "environment" ? [] : source === "mixed" ? pairs.slice(0, 1) : pairs;
    const inEnv = source === "file" ? {} : source === "mixed" ? Object.fromEntries(pairs.slice(1)) : canonical;
    const before = "CLIENT_ID=unrelated-client\nCLIENT_SECRET=unrelated-secret\nTENANT_ID=unrelated-tenant\n" + inFile.map(([key, value]) => `export ${key} = '${value}'\r\n`).join("");
    writeFileSync(join(t.home, ".env"), before);
    const result = t.launch(inEnv);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(t.home, ".env"), "utf8")).toBe(before);
    expect(result.stdout + result.stderr).not.toContain("canonical-secret");
  });

  it("rejects partial canonical Teams keys rather than silently losing a legacy credential", () => {
    const t = hermesFixture();
    writeFileSync(join(t.home, ".env"), "CLIENT_ID=legacy\nCLIENT_SECRET=private-secret\nTEAMS_CLIENT_ID=canonical\n");
    const result = t.launch();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TEAMS_CLIENT_SECRET");
    expect(result.stderr).not.toContain("private-secret");
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
  });

  it("preserves unrelated runtime files", () => {
    const t = hermesFixture();
    const files = [".env", "auth.json", "memories/MEMORY.md", "skills/custom/SKILL.md", "sessions/state.json"];
    for (const file of files) {
      mkdirSync(join(t.home, file, ".."), { recursive: true });
      writeFileSync(join(t.home, file), file === ".env" ? "CLIENT_ID=fixture-client\nCLIENT_SECRET=fixture-secret\nTEAMS_CLIENT_ID=canonical-client\nTEAMS_CLIENT_SECRET=canonical-secret\n" : "fixture-state\n");
    }
    const before = files.map(file => readFileSync(join(t.home, file)));
    expect(t.launch().status).toBe(0);
    files.forEach((file, i) => expect(readFileSync(join(t.home, file))).toEqual(before[i]));
  });

  it("returns configuration errors before starting tmux", () => {
    const t = hermesFixture();
    const result = t.launch({ CONFIG_EXIT: "7" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not configure terminal.cwd");
    expect(existsSync(t.tmuxLog)).toBe(false);
    expect(result.stdout).not.toContain("session started");
  });

  it("keeps explicit gateway home and cwd overrides", () => {
    const t = hermesFixture();
    const overrideHome = join(t.harness, "selected runtime");
    const overrideCwd = join(t.harness, "selected cwd");
    mkdirSync(overrideCwd);
    const result = t.launch({ HERMES_HOME: "/foreign/inherited", HERMES_GATEWAY_HOME: overrideHome, HERMES_GATEWAY_CWD: overrideCwd });
    expect(result.status).toBe(0);
    expect(readFileSync(t.configLog, "utf8")).toBe([overrideHome, "config", "set", "terminal.cwd", overrideCwd, ""].join("\n"));
    expect(readFileSync(t.launchLog, "utf8")).toBe([overrideHome, overrideCwd, overrideCwd, "gateway", "run", ""].join("\n"));
  });

  it("rejects invalid gateway cwd before configuration or tmux", () => {
    const t = hermesFixture();
    const result = t.launch({ HERMES_GATEWAY_CWD: "relative/missing" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("terminal cwd must be an existing absolute directory");
    expect(existsSync(t.configLog)).toBe(false);
    expect(existsSync(t.tmuxLog)).toBe(false);
  });

  it("configures cwd through Hermes before launching with an explicit home", () => {
    const t = hermesFixture();
    const result = t.launch();
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(t.configLog)).toBe(true);
    expect(readFileSync(t.configLog, "utf8")).toBe([t.home, "config", "set", "terminal.cwd", t.harness, ""].join("\n"));
    expect(readFileSync(t.launchLog, "utf8")).toBe([t.home, t.harness, t.harness, "gateway", "run", ""].join("\n"));
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
