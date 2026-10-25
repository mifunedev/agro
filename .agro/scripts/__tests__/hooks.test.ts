import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  hooks?: { PreToolUse?: HookEntry[]; Stop?: HookEntry[]; SubagentStop?: HookEntry[] };
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runWithInput(file: string, args: string[], input: string): Promise<Run> {
  return new Promise((done, fail) => {
    const child = spawn(file, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", fail).on("close", (status) => done({ status, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function runHook(hook: string, toolInput: Record<string, string>): Promise<Run> {
  return runWithInput("bash", [hook], JSON.stringify({ tool_input: toolInput }));
}

async function decision(hook: string, toolInput: Record<string, string>): Promise<Decision | string> {
  const result = await runHook(hook, toolInput);
  const out = result.stdout.trim();
  if (out === "") return "allow";
  return JSON.parse(out).hookSpecificOutput?.permissionDecision ?? "?";
}

function commandDecision(command: string): Promise<Decision | string> {
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

describe.concurrent("secret-exposure guard (deny-env-dump.sh)", () => {
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

    ["deny", "agro secret get GH_TOKEN"],
    ["deny", "agro secret get SANDBOX_PASSWORD --sandbox box"],
    ["deny", "npx agro secret get GH_TOKEN"],
    ["allow", "agro secret list"],
    ["allow", "agro secret set GH_TOKEN"],
  ];

  it.each(cases)("%s: %s", async (want, command) => {
    expect(await commandDecision(command)).toBe(want);
  });
});

describe.concurrent("docker-inspect env guard (deny-env-dump.sh)", () => {
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

  it.each(cases)("%s: %s", async (want, command) => {
    expect(await commandDecision(command)).toBe(want);
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

describe.concurrent("operator-config guard", () => {
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
  ])("file guard denies %s (%s)", async (target, key) => {
    expect(await decision(FILE_HOOK, { [key]: target })).toBe("deny");
  });

  it.each([
    "/home/sandbox/harness/jest.config.js",
    "/home/sandbox/harness/.agro/config.json",
    `/home/sandbox/harness/.example${ENV_FILE}`,
  ])("file guard allows %s", async (target) => {
    expect(await decision(FILE_HOOK, { file_path: target })).toBe("allow");
  });

  it.each([`/home/sandbox/harness/.claude/${localSettings}`, `/tmp/${localSettings}`])(
    "Codex local-settings guard denies %s",
    async (target) => {
      expect(await decision(CODEX_LOCAL_HOOK, { file_path: target })).toBe("deny");
    },
  );

  it("Codex local-settings guard stays scoped to settings.local.json", async () => {
    expect(await decision(CODEX_LOCAL_HOOK, { file_path: `/home/sandbox/harness/${ENV_FILE}` })).toBe("allow");
  });

  it.each([
    `cat ~/${seg}/gh/hosts.yml`,
    `mkdir -p ${seg}/foo`,
    `tar czf out.tgz /home/sandbox/${seg}`,
    `python3 -c "open('/home/sandbox/${seg}/x')"`,
    `cat .claude/${localSettings}`,
    `python3 -c "open(\\"${localSettings}\\", \\"w\\")"`,
  ])("command guard denies %s", async (command) => {
    expect(await commandDecision(command)).toBe("deny");
  });

  it.each(["npx jest --config jest.config.js", "git config --get user.name", "cat .agro/config.json"])(
    "command guard allows %s",
    async (command) => {
      expect(await commandDecision(command)).toBe("allow");
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

describe.concurrent("cc-safety-net wiring", () => {
  const pin = "2.6.8";
  const hookCommand = "cc-safety-net hook --claude-code";

  it.each([SETTINGS_JSON, ".codex/hooks.json"])("%s runs the guard unless CC_SAFETY_NET_OFF is set", (rel) => {
    expect(hookCommands(rel).filter((c) => c.includes(hookCommand) && c.includes("CC_SAFETY_NET_OFF"))).toHaveLength(1);
  });

  it("pins the same version for Pi, the image and provider linking, and enables strict worktree mode in compose", () => {
    expect(readFileSync(join(ROOT, ".pi/settings.json"), "utf8")).toContain(`npm:cc-safety-net@${pin}`);
    expect(readFileSync(join(ROOT, ".devcontainer/Dockerfile"), "utf8")).toContain(`npm install -g cc-safety-net@${pin}`);
    expect(readFileSync(join(ROOT, ".agro/scripts/link-providers.sh"), "utf8")).toContain(`CC_SAFETY_NET_PIN="${pin}"`);
    const compose = readFileSync(join(ROOT, ".devcontainer/docker-compose.yml"), "utf8");
    expect(compose).toMatch(/CC_SAFETY_NET_STRICT[=:]\s*1/);
    expect(compose).toMatch(/CC_SAFETY_NET_WORKTREE[=:]\s*1/);
  });

  const bin = spawnSync("sh", ["-c", "command -v cc-safety-net"], { encoding: "utf8" }).stdout.trim();

  it.skipIf(bin === "").each<[Decision, string]>([
    ["allow", "echo harmless"],
    ["deny", "git reset --hard HEAD"],
    ["deny", "bash -c 'git reset --hard HEAD'"],
  ])("the installed binary returns %s for %s with a PreToolUse event", async (want, command) => {
    const result = await runWithInput(bin, ["hook", "--claude-code"], JSON.stringify({
      hook_event_name: "PreToolUse",
      cwd: ROOT,
      tool_name: "Bash",
      tool_input: { command },
    }));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    if (want === "allow") expect(result.stdout).toBe("");
    else expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });
});

describe.concurrent("warn-devtcp hook", () => {
  it("warns without blocking on a /dev/tcp command", async () => {
    const result = await runHook(DEVTCP_HOOK, { command: "bash -c 'exec 3<>/dev/tcp/10.0.0.1/80'" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("warn-devtcp");
  });

  it("stays silent on a .devcontainer path", async () => {
    const result = await runHook(DEVTCP_HOOK, { command: "ls .devcontainer/" });
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("warn-devtcp");
  });
});

const STOP_HOOK = ".agro/hooks/task-next-stop.sh";
const CODEX_STOP_HOOK = ".codex/hooks/task-next-stop.sh";
const STOP_BRANCH = "feat/1-demo";
const FAKE_NEXT = [
  "#!/usr/bin/env bash",
  '[ -n "${NEXT_EXIT:-}" ] && exit "$NEXT_EXIT"',
  "printf '%s\\n%s\\n' \"$NEXT_STATE\" \"Action for $NEXT_STATE.\"",
  "",
].join("\n");
const FAKE_ESCALATE = [
  "#!/usr/bin/env bash",
  "printf '%s\\n' \"$*\" >> \"$ESCALATE_CALLS\"",
  "echo noisy",
  "exit 3",
  "",
].join("\n");

interface StopOptions {
  cwd?: string;
  runCwd?: string;
  exit?: string;
  hook?: string;
}

function stopFixture() {
  const root = mkdtempSync(join(tmpdir(), "agro-stop-"));
  const work = join(root, "work");
  const calls = join(root, "escalate.log");
  const escalate = join(root, "escalate.sh");
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    AGRO_ESCALATE_SCRIPT: escalate,
    ESCALATE_CALLS: calls,
  };
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const write = (rel: string, content: string) => {
    const file = join(work, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  writeFileSync(escalate, FAKE_ESCALATE);
  chmodSync(escalate, 0o755);
  writeFileSync(calls, "");
  for (const rel of [STOP_HOOK, CODEX_STOP_HOOK]) write(rel, readFileSync(join(ROOT, rel), "utf8"));
  write(".agro/skills/delegate/scripts/next.sh", FAKE_NEXT);
  write(".agro/tasks/demo/prd.json", JSON.stringify({ branchName: STOP_BRANCH, userStories: [] }));
  git(work, "init", "-q", "-b", STOP_BRANCH);
  git(work, "config", "commit.gpgsign", "false");
  git(work, "add", "-A");
  const commit = () => git(work, "commit", "-q", "--allow-empty", "-m", "c");
  commit();

  const stop = (state: string, opts: StopOptions = {}) => {
    const cwd = opts.cwd ?? work;
    const result = spawnSync("bash", [join(work, opts.hook ?? STOP_HOOK)], {
      cwd: opts.runCwd ?? cwd,
      env: { ...env, NEXT_STATE: state, ...(opts.exit ? { NEXT_EXIT: opts.exit } : {}) },
      input: JSON.stringify({ hook_event_name: "Stop", cwd, stop_hook_active: false }),
      encoding: "utf8",
    });
    return { status: result.status, stdout: result.stdout };
  };
  const decisionOf = (state: string, opts: StopOptions = {}) => JSON.parse(stop(state, opts).stdout).decision;
  const counter = (cwd: string) => {
    const file = git(cwd, "rev-parse", "--path-format=absolute", "--git-path", "agro-next-stop");
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  };
  const escalations = () => readFileSync(calls, "utf8").split("\n").filter(Boolean);
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  return { root, work, git, commit, stop, decisionOf, counter, escalations, cleanup };
}

function withStopFixture(test: (f: ReturnType<typeof stopFixture>) => void): () => void {
  return () => {
    const f = stopFixture();
    try {
      test(f);
    } finally {
      f.cleanup();
    }
  };
}

describe("task lifecycle stop hook (task-next-stop.sh)", () => {
  it.each(["story US-003", "review", "close", "push", "ci", "ci-red", "ready"])("blocks the stop at %s", (state) =>
    withStopFixture((f) => {
      const result = f.stop(state);
      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.decision).toBe("block");
      expect(out.reason).toContain(`${state}\nAction for ${state}.`);
      expect(out.reason).toContain("Run bash .agro/skills/delegate/scripts/next.sh again after the action.");
    })(),
  );

  it.each(["none", "done", "blocked no ready story"])("allows the stop at %s", (state) =>
    withStopFixture((f) => {
      expect(f.stop(state)).toEqual({ status: 0, stdout: "" });
    })(),
  );

  it("fails open when next.sh exits non-zero", withStopFixture((f) => {
    expect(f.stop("review", { exit: "1" })).toEqual({ status: 0, stdout: "" });
  }));

  it("fails open outside a git repository", withStopFixture((f) => {
    const outside = join(f.root, "outside");
    mkdirSync(outside);
    expect(f.stop("review", { cwd: outside })).toEqual({ status: 0, stdout: "" });
  }));

  it("reads the repository from the event cwd", withStopFixture((f) => {
    const outside = join(f.root, "outside");
    mkdirSync(outside);
    expect(f.decisionOf("review", { runCwd: outside })).toBe("block");
  }));

  it("releases the stop after 3 blocks without progress and escalates one time", withStopFixture((f) => {
    for (let i = 0; i < 3; i++) expect(f.decisionOf("review")).toBe("block");
    expect(f.escalations()).toHaveLength(0);
    expect(f.stop("review")).toEqual({ status: 0, stdout: "" });
    expect(f.stop("review")).toEqual({ status: 0, stdout: "" });
    const calls = f.escalations();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--key demo-review");
    expect(calls[0]).toContain(
      "--summary demo lifecycle hook released a stop after 3 blocks with no progress at state review",
    );
    expect(calls[0]).toContain("--needs Decide how to unblock review");
  }));

  it("resets the counter when the state changes", withStopFixture((f) => {
    for (let i = 0; i < 3; i++) f.stop("review");
    expect(f.decisionOf("push")).toBe("block");
    expect(f.escalations()).toHaveLength(0);
  }));

  it("resets the counter when HEAD changes", withStopFixture((f) => {
    for (let i = 0; i < 3; i++) f.stop("story US-001");
    f.commit();
    expect(f.decisionOf("story US-001")).toBe("block");
    expect(f.escalations()).toHaveLength(0);
  }));

  it("keeps a separate counter in each worktree", withStopFixture((f) => {
    const other = join(f.root, "other");
    f.git(f.work, "worktree", "add", "-q", "-b", "feat/2-other", other);
    f.stop("review");
    f.stop("review");
    const before = f.counter(f.work);
    expect(before).toMatch(/^review\n[0-9a-f]{40}\n2\n$/);
    expect(f.counter(other)).toBe("");
    for (let i = 0; i < 3; i++) expect(f.decisionOf("review", { cwd: other })).toBe("block");
    expect(f.counter(other)).toMatch(/\n3\n$/);
    expect(f.counter(f.work)).toBe(before);
  }));

  it("runs the canonical hook through the Codex wrapper", withStopFixture((f) => {
    expect(f.decisionOf("ci", { hook: CODEX_STOP_HOOK })).toBe("block");
    expect(f.stop("done", { hook: CODEX_STOP_HOOK })).toEqual({ status: 0, stdout: "" });
  }));

  it("wires Stop in Claude Code and Codex without a SubagentStop entry", () => {
    const stopCommands = (rel: string) =>
      (settings(rel).hooks?.Stop ?? []).flatMap((e) => e.hooks?.map((h) => h.command ?? "") ?? []);
    expect(stopCommands(SETTINGS_JSON)).toEqual(['bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/task-next-stop.sh']);
    expect(settings(SETTINGS_JSON).hooks?.SubagentStop).toBeUndefined();
    expect(stopCommands(".codex/hooks.json")).toEqual([
      'bash "$(git rev-parse --show-toplevel)/.codex/hooks/task-next-stop.sh"',
    ]);
    expect(readFileSync(join(ROOT, CODEX_STOP_HOOK), "utf8")).toContain(".agro/hooks/task-next-stop.sh");
  });
});
