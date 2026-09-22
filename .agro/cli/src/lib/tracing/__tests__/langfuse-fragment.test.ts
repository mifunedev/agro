import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANGFUSE_FRAGMENT_KEYS,
  langfuseFragmentPath,
  loadLangfuseCredentials,
  renderLangfuseFragment,
  writeLangfuseFragment,
  type LangfuseFragmentInput,
} from "../providers/langfuse.js";
import { setSecret } from "../../secrets.js";
import { withInvokedBin } from "../../../__tests__/invoked-bin.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../../../", import.meta.url));
const TRACKED_ZSHENV = join(REPO_ROOT, ".agro", "install", ".zshenv");
const CLAUDE_PROJECT_SETTINGS = join(REPO_ROOT, ".claude", "settings.json");

const INPUT: LangfuseFragmentInput = {
  publicKey: "pk-lf-11111111-2222-3333-4444-555555555555",
  secretKey: "sk-lf-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  baseUrl: "https://langfuse.example.test",
  environment: "agro-sbx-local",
};

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(d);
  return d;
}

const SYSTEMD_ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseAsSystemdEnvironmentFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!SYSTEMD_ENV_NAME.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\(.)/g, "$1");
    }
    env[key] = value;
  }
  return env;
}

function readThroughTrackedZshenv(home: string, keys: readonly string[]): Record<string, string> {
  copyFileSync(TRACKED_ZSHENV, join(home, ".zshenv"));
  const env: Record<string, string> = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: home, ZDOTDIR: home };
  const out = execFileSync("zsh", ["-c", "env"], { env, encoding: "utf8" });
  const seen: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0 && keys.includes(line.slice(0, eq))) seen[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return seen;
}

describe("renderLangfuseFragment", () => {
  it("renders exactly the four keys as bare KEY=value lines", () => {
    expect(renderLangfuseFragment(INPUT)).toBe(
      [
        `LANGFUSE_PUBLIC_KEY=${INPUT.publicKey}`,
        `LANGFUSE_SECRET_KEY=${INPUT.secretKey}`,
        `LANGFUSE_BASE_URL=${INPUT.baseUrl}`,
        `LANGFUSE_TRACING_ENVIRONMENT=${INPUT.environment}`,
        "",
      ].join("\n"),
    );
  });

  it("systemd EnvironmentFile drops any line whose key is not a plain name, so no line starts with `export`", () => {
    const text = renderLangfuseFragment(INPUT);
    expect(text).not.toMatch(/\bexport\b/);
    expect(parseAsSystemdEnvironmentFile(text)).toEqual({
      LANGFUSE_PUBLIC_KEY: INPUT.publicKey,
      LANGFUSE_SECRET_KEY: INPUT.secretKey,
      LANGFUSE_BASE_URL: INPUT.baseUrl,
      LANGFUSE_TRACING_ENVIRONMENT: INPUT.environment,
    });
    expect(parseAsSystemdEnvironmentFile(`export LANGFUSE_BASE_URL=${INPUT.baseUrl}\n`)).toEqual({});
  });

  it("single-quotes a value the shell would otherwise split or expand, and systemd reads the quoted form", () => {
    const text = renderLangfuseFragment({ ...INPUT, environment: "sbx one&two $HOME" });
    expect(text).toContain("LANGFUSE_TRACING_ENVIRONMENT='sbx one&two $HOME'\n");
    expect(parseAsSystemdEnvironmentFile(text).LANGFUSE_TRACING_ENVIRONMENT).toBe("sbx one&two $HOME");
  });

  it.each([
    ["a newline", "sbx\nLANGFUSE_SECRET_KEY=stolen"],
    ["a carriage return", "sbx\r"],
    ["a single quote", "it's"],
    ["a control character", "sbx\u0007"],
  ])("rejects a value containing %s", (_label, environment) => {
    expect(() => renderLangfuseFragment({ ...INPUT, environment })).toThrow(
      /LANGFUSE_TRACING_ENVIRONMENT must not contain a newline, a control character, or a single quote/,
    );
  });

  it("rejects an empty value", () => {
    expect(() => renderLangfuseFragment({ ...INPUT, baseUrl: "" })).toThrow(/LANGFUSE_BASE_URL must not be empty/);
  });
});

describe("writeLangfuseFragment", () => {
  it("writes the fragment at mode 0600 inside a 0700 parent it creates", () => {
    const home = makeDir("oh-lf-home-");
    const result = writeLangfuseFragment(home, INPUT);
    expect(result).toEqual({ path: langfuseFragmentPath(home), outcome: "written" });
    expect(readFileSync(result.path, "utf8")).toBe(renderLangfuseFragment(INPUT));
    expect(statSync(result.path).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(result.path)).mode & 0o777).toBe(0o700);
  });

  it("is idempotent: a second run with unchanged input leaves a byte-identical file and reports unchanged", () => {
    const home = makeDir("oh-lf-home-");
    const first = writeLangfuseFragment(home, INPUT);
    const bytes = readFileSync(first.path);
    const second = writeLangfuseFragment(home, INPUT);
    expect(second.outcome).toBe("unchanged");
    expect(readFileSync(second.path).equals(bytes)).toBe(true);
  });

  it("restores 0600 on a fragment an operator loosened", () => {
    const home = makeDir("oh-lf-home-");
    const { path } = writeLangfuseFragment(home, INPUT);
    writeFileSync(path, "LANGFUSE_PUBLIC_KEY=stale\n", { mode: 0o644 });
    writeLangfuseFragment(home, INPUT);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it.skipIf(!existsSync(TRACKED_ZSHENV) || !hasZsh())(
    "one rendered file feeds both consumers: the tracked .zshenv exports it to a child and the systemd parse yields the same values",
    () => {
      const home = makeDir("oh-lf-home-");
      const input = { ...INPUT, environment: "sbx one&two" };
      const { path } = writeLangfuseFragment(home, input);
      const expected = {
        LANGFUSE_PUBLIC_KEY: input.publicKey,
        LANGFUSE_SECRET_KEY: input.secretKey,
        LANGFUSE_BASE_URL: input.baseUrl,
        LANGFUSE_TRACING_ENVIRONMENT: input.environment,
      };
      expect(readThroughTrackedZshenv(home, LANGFUSE_FRAGMENT_KEYS)).toEqual(expected);
      expect(parseAsSystemdEnvironmentFile(readFileSync(path, "utf8"))).toEqual(expected);
    },
  );
});

describe("loadLangfuseCredentials", () => {
  it("reads both keys from the project .env", () => {
    const root = makeDir("oh-lf-root-");
    setSecret(root, "LANGFUSE_PUBLIC_KEY", INPUT.publicKey);
    setSecret(root, "LANGFUSE_SECRET_KEY", INPUT.secretKey);
    expect(loadLangfuseCredentials(root)).toEqual({ publicKey: INPUT.publicKey, secretKey: INPUT.secretKey });
  });

  it("refuses with a clear error naming the missing key", () => {
    const root = makeDir("oh-lf-root-");
    setSecret(root, "LANGFUSE_PUBLIC_KEY", INPUT.publicKey);
    withInvokedBin("agro", () => {
      expect(() => loadLangfuseCredentials(root)).toThrow(
        "LANGFUSE_SECRET_KEY is not set in .env — run `agro secret set LANGFUSE_SECRET_KEY <value>` first",
      );
    });
  });

  it("names both keys when neither is set", () => {
    const root = makeDir("oh-lf-root-");
    expect(() => loadLangfuseCredentials(root)).toThrow(
      /LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are not set in \.env/,
    );
  });
});

describe("deny coverage of the fragment path", () => {
  const settings = JSON.parse(readFileSync(CLAUDE_PROJECT_SETTINGS, "utf8")) as {
    permissions: { deny: string[] };
  };
  const deny = settings.permissions.deny;
  const fragment = langfuseFragmentPath("/home/sandbox");

  function rulesFor(tool: string, param: string): RegExp[] {
    const prefix = `${tool}(${param}=`;
    return deny
      .filter((rule) => rule.startsWith(prefix) && rule.endsWith(")"))
      .map((rule) => rule.slice(prefix.length, -1))
      .map((glob) => {
        const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const body = tool === "Bash"
          ? escaped.replace(/\*/g, ".*")
          : escaped.replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
        return new RegExp(`^${body}$`);
      });
  }

  it.each([
    ["Read", "file_path"],
    ["Edit", "file_path"],
  ])("an existing %s deny rule already covers the fragment path, so no new rule is added", (tool, param) => {
    expect(rulesFor(tool, param).some((re) => re.test(fragment))).toBe(true);
  });

  it("an existing Bash deny rule already covers a command naming the fragment", () => {
    expect(rulesFor("Bash", "command").some((re) => re.test(`cat ${fragment}`))).toBe(true);
  });

  it("no Read deny rule covers ~/.claude/settings.json, which agents legitimately read", () => {
    const claudeSettings = "/home/sandbox/.claude/settings.json";
    expect(rulesFor("Read", "file_path").some((re) => re.test(claudeSettings))).toBe(false);
  });
});

function hasZsh(): boolean {
  try {
    execFileSync("zsh", ["-c", "exit 0"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
