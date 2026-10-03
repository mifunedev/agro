import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const CMD_HOOK = join(ROOT, ".agro/hooks/deny-env-dump.sh");
const FILE_HOOK = join(ROOT, ".agro/hooks/deny-secret-paths.sh");
const DEVTCP_HOOK = join(ROOT, ".claude/hooks/warn-devtcp.sh");
const CODEX_LOCAL_HOOK = join(ROOT, ".codex/hooks/deny-local-settings.sh");

type Decision = "allow" | "deny";

interface HookEntry {
  matcher?: string;
  hooks?: { command?: string }[];
}

interface HookSettings {
  permissions?: { deny?: string[] };
  hooks?: { PreToolUse?: HookEntry[] };
}

function runHook(hook: string, toolInput: Record<string, string>) {
  return spawnSync("bash", [hook], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: "utf8",
  });
}

function decision(hook: string, toolInput: Record<string, string>): Decision | string {
  const result = runHook(hook, toolInput);
  const out = result.stdout.trim();
  if (out === "") return "allow";
  return JSON.parse(out).hookSpecificOutput?.permissionDecision ?? "?";
}

function commandDecision(command: string): Decision | string {
  return decision(CMD_HOOK, { command });
}

function settings(rel: string): HookSettings {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

function matcherFor(rel: string, commandFragment: string): string {
  const entries = settings(rel).hooks?.PreToolUse ?? [];
  const entry = entries.find((e) => e.hooks?.some((h) => h.command?.includes(commandFragment)));
  return entry?.matcher ?? "";
}

function hookCommands(rel: string): string[] {
  return (settings(rel).hooks?.PreToolUse ?? []).flatMap((e) => e.hooks?.map((h) => h.command ?? "") ?? []);
}

const H = "hist" + "ory";
const SETTINGS_JSON = ".claude/settings.json";
const ENV_FILE = "." + "env";
const JQ_ENV_WORD = "env";
const JQ_ENV_VAR = "$ENV";

describe("secret-exposure guard (deny-env-dump.sh)", () => {
  const cases: [Decision, string][] = [
    ["allow", `git commit -m "record ${H} of X"`],
    ["allow", `git commit -m "apply task-${H} signal"`],
    ["deny", H],
    ["deny", `${H} | tail`],
    ["deny", `bash -ic ${H}`],
    ...["builtin", "command", "sudo", "exec", "eval"].map((w): [Decision, string] => ["deny", `${w} ${H}`]),
    ["deny", `bash -ic 'builtin ${H}'`],
    ["deny", "fc -l"],
    ["deny", `cat ~/.zsh_${H}`],
    ["deny", `tail ~/.bash_${H}`],

    ["allow", `jq '.env' ${SETTINGS_JSON}`],
    ["allow", `jq -r '.env // {}' ${SETTINGS_JSON}`],
    ["allow", `jq .env ${SETTINGS_JSON}`],
    ["allow", `cat ${ENV_FILE}.example`],

    ["deny", `cat ${ENV_FILE}`],
    ["deny", `cat ./app/${ENV_FILE}.local`],
    ["deny", `jq '.env' ${ENV_FILE}`],
    ["deny", `jq . ${ENV_FILE}`],
    ["deny", `jq '.env' ${SETTINGS_JSON} ${ENV_FILE}`],
    ["deny", `jq --arg k v '.x' ${ENV_FILE}`],
    ["deny", `jq -f ${ENV_FILE} data.json`],
    ["deny", `jq -rf ${ENV_FILE} data.json`],
    ["deny", `jq -nr --from-file ${ENV_FILE}`],
    ["deny", `jq --from-file=${ENV_FILE} data.json`],
    ["deny", `jq --rawfile s ${ENV_FILE} -n '$s'`],
    ["deny", `jq --slurpfile s ${ENV_FILE} -n .`],
    ["deny", `jq -n '.' < ${ENV_FILE}`],
    ["deny", `jq -n "$(cat ${ENV_FILE})"`],
    ["deny", `jq -n \`cat ${ENV_FILE}\``],
    ["deny", `cat ${ENV_FILE} && jq '.x' data.json`],

    ["deny", `jq -n '${JQ_ENV_WORD}'`],
    ["deny", `jq -n '${JQ_ENV_VAR}'`],
    ["deny", `jq -n '${JQ_ENV_WORD}.HOME'`],
    ["deny", `jq -n '${JQ_ENV_VAR}.GH_TOKEN'`],
    ["deny", `jq -n '[${JQ_ENV_WORD}[]]'`],
    ["deny", `jq -n "${JQ_ENV_VAR}"`],
    ["allow", `jq '.x' ${JQ_ENV_WORD}.json`],

    ["allow", `jq -nc --arg c x '{a: $c}' | bash .agro/hooks/deny-${JQ_ENV_WORD}-dump.sh`],
    ["allow", `jq --arg k v '.x' data.json; ls ${JQ_ENV_WORD}/`],
    ["deny", `jq --arg k v '${JQ_ENV_WORD}'`],
    ["deny", `jq --arg k v -n '${JQ_ENV_VAR}' | cat`],
    ["deny", `jq -f prog.jq --arg k v -n '${JQ_ENV_WORD}'`],
    ["deny", `jq --arg k v '.x' data.json; jq -n '${JQ_ENV_WORD}'`],
    ["deny", `jq --arg k v '.x' data.json | jq -n "${JQ_ENV_VAR}"`],

    ["allow", `jq '.userStories[0].notes = "the ${JQ_ENV_WORD} check denies ${JQ_ENV_VAR}"' prd.json`],
    ["allow", `jq '.notes = "${JQ_ENV_WORD}>.${JQ_ENV_WORD}>bridge precedence"' prd.json > /tmp/p`],
    ["allow", `jq --arg k v '.notes = "echo $botToken fallback"' prd.json`],
    ["allow", `git commit -m "read the bridge botToken fallback"`],

    ["deny", `jq -n '"\\(${JQ_ENV_WORD}.HOME)"'`],
    ["deny", `jq -n '"x \\(${JQ_ENV_VAR}.GH_TOKEN)"'`],
    ["deny", `jq '.a = "note" | ${JQ_ENV_WORD}' data.json`],
    ["deny", `jq '.a = "note"' data.json; jq -n '${JQ_ENV_WORD}'`],
    ["deny", `echo "$GH_TOKEN"; jq '.a = "note"' data.json`],
    ["deny", `sh -c 'echo "$GH_TOKEN"'`],

    ["allow", "grep process.env src/index.ts"],
    ["allow", `grep "Config.Env" notes.md`],
    ["allow", "rg 'import.meta.env' src"],
    ["deny", `grep TOKEN ${ENV_FILE}`],
    ["deny", `rg KEY ${ENV_FILE}.production`],
    ["deny", `grep -f ${ENV_FILE} src/index.ts`],
    ["deny", `grep -e TOKEN ${ENV_FILE}`],
    ["deny", `rg -g ${ENV_FILE} TOKEN`],
    ["deny", `cat prod${ENV_FILE}`],

    ["deny", `python3 -c 'import os; print(dict(os.environ))'`],
    ["deny", `python -c 'import os; print(os.getenv("GH_TOKEN"))'`],
    ["deny", `perl -e 'print "$_=$ENV{$_}\\n" for keys %ENV'`],
    ["deny", "ruby -e 'p ENV'"],
    ["deny", "node -e 'console.log(process.env)'"],
    ["deny", `python3 -Ic 'import os; print(os.environ)'`],
    ["deny", "perl -ne 'print $ENV{$_}'"],
    ["allow", "python3 -c 'print(1)'"],
    ["allow", "node -e 'console.log(1)'"],
    ["allow", "python3 scripts/build.py"],
    ["allow", "python3 -m pytest -c tox.ini -k env -q"],
    ["allow", "python3 -c 'print(1)' && ls env/"],
    ["allow", "node -e 'console.log(1)' | grep --env x"],
  ];

  it.each(cases)("%s: %s", (want, command) => {
    expect(commandDecision(command)).toBe(want);
  });
});

describe("docker-inspect env guard (deny-env-dump.sh)", () => {
  const envField = ".Config." + "Env";
  const cases: [Decision, string][] = [
    ["deny", "docker inspect agro"],
    ["deny", "docker container inspect agro"],
    ["deny", `docker inspect --format '{{${envField}}}' web`],
    ["deny", "docker inspect --format '{{json .}}' web"],
    ["deny", "docker inspect --format '{{.}}' web"],
    ["deny", "docker inspect --format '{{.Config}}' web"],
    ["deny", "docker inspect --format json web"],
    ["deny", "docker inspect --format 'json' web"],
    ["deny", "docker inspect -f 'json' web"],
    ["deny", "docker inspect --format='json' web"],
    ["deny", "docker inspect web | jq '.[0].State'"],
    ["deny", "podman inspect mycontainer"],
    ["allow", "docker inspect --format '{{.State.Health.Status}}' agro"],
    ["allow", "docker container inspect -f '{{.State.Status}}' agro"],
    ["allow", "docker inspect --format '{{.NetworkSettings.IPAddress}}' web"],
    ["allow", "docker inspect --format '{{json .State.Health}}' agro"],
    ["allow", "docker inspect oh-sbx-local --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}'"],
    ["allow", "docker image inspect --format '{{.Id}}' node:20"],
    ["allow", "docker ps -a"],
    ["allow", "docker compose up -d --build"],
    ["allow", "docker exec -it agro tmux ls"],
    ["deny", "docker sec" + "ret inspect foo"],
    ["deny", "docker con" + "fig inspect foo"],
  ];

  it.each(cases)("%s: %s", (want, command) => {
    expect(commandDecision(command)).toBe(want);
  });

  it("mirrors the env-shaped inspect patterns in permissions.deny without blanket-blocking inspect", () => {
    const deny = settings(SETTINGS_JSON).permissions?.deny ?? [];
    expect(deny).toEqual(
      expect.arrayContaining([
        `Bash(command=*inspect*Config.${"Env"}*)`,
        "Bash(command=*inspect*{{json .}}*)",
        "Bash(command=*inspect*{{.}}*)",
      ]),
    );
    expect(deny).not.toContain("Bash(command=*docker inspect*)");
    expect(matcherFor(SETTINGS_JSON, "deny-env-dump")).toContain("Bash");
  });
});

describe("operator-config guard", () => {
  const seg = ".config";
  const localSettings = "settings.local.json";

  it.each([
    [`/home/sandbox/${seg}/gh/hosts.yml`, "file_path"],
    [`/home/sandbox/harness/${seg}/main.yaml`, "file_path"],
    [`/home/sandbox/harness/${seg}`, "file_path"],
    [`/home/sandbox/${seg}`, "path"],
    [`/home/sandbox/harness/.claude/${localSettings}`, "file_path"],
    [`/tmp/${localSettings}`, "file_path"],
    [`/home/sandbox/harness/${ENV_FILE}`, "file_path"],
  ])("file guard denies %s (%s)", (target, key) => {
    expect(decision(FILE_HOOK, { [key]: target })).toBe("deny");
  });

  it.each([
    "/home/sandbox/harness/jest.config.js",
    "/home/sandbox/harness/.agro/config.json",
    `/home/sandbox/harness/.example${ENV_FILE}`,
  ])("file guard allows %s", (target) => {
    expect(decision(FILE_HOOK, { file_path: target })).toBe("allow");
  });

  it.each([`/home/sandbox/harness/.claude/${localSettings}`, `/tmp/${localSettings}`])(
    "Codex local-settings guard denies %s",
    (target) => {
      expect(decision(CODEX_LOCAL_HOOK, { file_path: target })).toBe("deny");
    },
  );

  it("Codex local-settings guard stays scoped to settings.local.json", () => {
    expect(decision(CODEX_LOCAL_HOOK, { file_path: `/home/sandbox/harness/${ENV_FILE}` })).toBe("allow");
  });

  it.each([
    `cat ~/${seg}/gh/hosts.yml`,
    `mkdir -p ${seg}/foo`,
    `tar czf out.tgz /home/sandbox/${seg}`,
    `python3 -c "open('/home/sandbox/${seg}/x')"`,
    `cat .claude/${localSettings}`,
    `python3 -c "open(\\"${localSettings}\\", \\"w\\")"`,
  ])("command guard denies %s", (command) => {
    expect(commandDecision(command)).toBe("deny");
  });

  it.each(["npx jest --config jest.config.js", "git config --get user.name", "cat .agro/config.json"])(
    "command guard allows %s",
    (command) => {
      expect(commandDecision(command)).toBe("allow");
    },
  );

  it("wires the file guards to every file tool", () => {
    const matcher = matcherFor(SETTINGS_JSON, "deny-secret-paths");
    for (const tool of ["Read", "Write", "Edit", "Grep", "Glob"]) expect(matcher).toContain(tool);
    const codexMatcher = matcherFor(".codex/hooks.json", "deny-local-settings");
    for (const tool of ["Read", "Write", "Edit"]) expect(codexMatcher).toContain(tool);
    expect(settings(SETTINGS_JSON).permissions?.deny ?? []).toEqual(
      expect.arrayContaining([
        `Read(file_path=**/${seg}/**)`,
        `Edit(file_path=**/${seg}/**)`,
        `Read(file_path=**/${localSettings})`,
        `Edit(file_path=**/${localSettings})`,
      ]),
    );
  });
});

describe("cc-safety-net wiring", () => {
  const pin = "1.0.6";
  const hookCommand = "cc-safety-net hook --claude-code";

  it.each([SETTINGS_JSON, ".codex/hooks.json"])("%s runs the guard unless CC_SAFETY_NET_OFF is set", (rel) => {
    expect(hookCommands(rel).filter((c) => c.includes(hookCommand) && c.includes("CC_SAFETY_NET_OFF"))).toHaveLength(1);
  });

  it("pins the same version for Pi and the image, and enables strict worktree mode in compose", () => {
    expect(readFileSync(join(ROOT, ".pi/settings.json"), "utf8")).toContain(`npm:cc-safety-net@${pin}`);
    expect(readFileSync(join(ROOT, ".devcontainer/Dockerfile"), "utf8")).toContain(`npm install -g cc-safety-net@${pin}`);
    const compose = readFileSync(join(ROOT, ".devcontainer/docker-compose.yml"), "utf8");
    expect(compose).toMatch(/CC_SAFETY_NET_STRICT[=:]\s*1/);
    expect(compose).toMatch(/CC_SAFETY_NET_WORKTREE[=:]\s*1/);
  });

  const bin = spawnSync("sh", ["-c", "command -v cc-safety-net"], { encoding: "utf8" }).stdout.trim();

  it.skipIf(bin === "")("the installed binary denies a hard reset", () => {
    const result = spawnSync(bin, ["hook", "--claude-code"], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard HEAD" } }),
      encoding: "utf8",
    });
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });
});

describe("warn-devtcp hook", () => {
  it("warns without blocking on a /dev/tcp command", () => {
    const result = runHook(DEVTCP_HOOK, { command: "bash -c 'exec 3<>/dev/tcp/10.0.0.1/80'" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("warn-devtcp");
  });

  it("stays silent on a .devcontainer path", () => {
    const result = runHook(DEVTCP_HOOK, { command: "ls .devcontainer/" });
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("warn-devtcp");
  });
});
