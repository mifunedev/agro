import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { HARNESS_CATALOG, findHarness } from "../../harnesses/catalog.js";
import {
  claudeCodeSettingsPath,
  claudeCodeTracingWriter,
  codexTracingConfigPath,
  codexTracingWriter,
  piTracingConfigPath,
  piTracingWriter,
} from "../harness-writers.js";
import { writeLangfuseFragment } from "../providers/langfuse.js";
import type { HarnessTracingSettings, TracingWriter } from "../writer.js";

const PUBLIC_KEY = "pk-lf-11111111-2222-3333-4444-555555555555";
const SECRET_KEY = "sk-lf-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const SETTINGS: HarnessTracingSettings = {
  enabled: true,
  baseUrl: "https://langfuse.example.test",
  environment: "agro-sbx-local",
  userId: "ryan",
};

const WRITERS: ReadonlyArray<readonly [string, TracingWriter, (home: string) => string]> = [
  ["claude-code", claudeCodeTracingWriter, claudeCodeSettingsPath],
  ["pi", piTracingWriter, piTracingConfigPath],
  ["codex", codexTracingWriter, codexTracingConfigPath],
];

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeHome(): string {
  const d = mkdtempSync(join(tmpdir(), "oh-tracing-home-"));
  cleanups.push(d);
  return d;
}

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

describe("catalog seam", () => {
  it("every other harness leaves the field unset", () => {
    for (const h of HARNESS_CATALOG) {
      if (["claude-code", "pi", "codex"].includes(h.id)) continue;
      expect(h.tracingWriter, h.id).toBeUndefined();
    }
  });

  it("the catalog references the same writer functions the tracing module exports", () => {
    expect(findHarness("claude-code")!.tracingWriter).toBe(claudeCodeTracingWriter);
    expect(findHarness("pi")!.tracingWriter).toBe(piTracingWriter);
    expect(findHarness("codex")!.tracingWriter).toBe(codexTracingWriter);
  });
});

describe.each(WRITERS)("%s writer", (_id, writer, pathOf) => {
  it("creates parent directories and reports the written path", () => {
    const home = makeHome();
    const result = writer(home, SETTINGS);
    expect(result).toEqual({ path: pathOf(home), outcome: "written" });
    expect(statSync(dirname(result.path)).isDirectory()).toBe(true);
  });

  it("is idempotent: a second run leaves a byte-identical file and reports unchanged", () => {
    const home = makeHome();
    const first = writer(home, SETTINGS);
    const bytes = readFileSync(first.path);
    const second = writer(home, SETTINGS);
    expect(second.outcome).toBe("unchanged");
    expect(readFileSync(second.path).equals(bytes)).toBe(true);
  });

  it("writes no credential value even when the fragment holding them sits in the same home", () => {
    const home = makeHome();
    writeLangfuseFragment(home, { publicKey: PUBLIC_KEY, secretKey: SECRET_KEY, ...SETTINGS });
    const { path } = writer(home, SETTINGS);
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain(PUBLIC_KEY);
    expect(text).not.toContain(SECRET_KEY);
    expect(text).not.toContain("LANGFUSE_PUBLIC_KEY");
    expect(text).not.toContain("LANGFUSE_SECRET_KEY");
  });
});

describe("claude-code writer", () => {
  it("merges the env block into ~/.claude/settings.json and preserves unrelated keys and env entries", () => {
    const home = makeHome();
    const path = claudeCodeSettingsPath(home);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        permissions: { allow: ["Bash(ls:*)"] },
        env: { CC_LANGFUSE_DEBUG: "true", LANGFUSE_BASE_URL: "https://old.example.test" },
        hooks: { Stop: [] },
      }),
    );
    claudeCodeTracingWriter(home, SETTINGS);
    expect(readJson(path)).toEqual({
      permissions: { allow: ["Bash(ls:*)"] },
      env: {
        CC_LANGFUSE_DEBUG: "true",
        LANGFUSE_BASE_URL: SETTINGS.baseUrl,
        LANGFUSE_TRACING_ENVIRONMENT: SETTINGS.environment,
      },
      hooks: { Stop: [] },
    });
  });

  it("writes only LANGFUSE_BASE_URL and LANGFUSE_TRACING_ENVIRONMENT into a fresh file", () => {
    const home = makeHome();
    const { path } = claudeCodeTracingWriter(home, SETTINGS);
    expect(readJson(path)).toEqual({
      env: { LANGFUSE_BASE_URL: SETTINGS.baseUrl, LANGFUSE_TRACING_ENVIRONMENT: SETTINGS.environment },
    });
  });

  it("fails with a clear error on malformed JSON and leaves the file untouched", () => {
    const home = makeHome();
    const path = claudeCodeSettingsPath(home);
    mkdirSync(dirname(path), { recursive: true });
    const broken = '{ "permissions": { "allow": [ }';
    writeFileSync(path, broken);
    expect(() => claudeCodeTracingWriter(home, SETTINGS)).toThrow(
      /~\/\.claude\/settings\.json is not valid JSON \(.*\); repair it by hand, nothing was written/,
    );
    expect(readFileSync(path, "utf8")).toBe(broken);
  });

  it("fails when the file holds a JSON array instead of an object and leaves it untouched", () => {
    const home = makeHome();
    const path = claudeCodeSettingsPath(home);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "[]");
    expect(() => claudeCodeTracingWriter(home, SETTINGS)).toThrow(/must hold a JSON object/);
    expect(readFileSync(path, "utf8")).toBe("[]");
  });

  it("fails when env is not an object and leaves the file untouched", () => {
    const home = makeHome();
    const path = claudeCodeSettingsPath(home);
    mkdirSync(dirname(path), { recursive: true });
    const text = '{"env":"LANGFUSE_BASE_URL=x"}';
    writeFileSync(path, text);
    expect(() => claudeCodeTracingWriter(home, SETTINGS)).toThrow(/non-object `env` block/);
    expect(readFileSync(path, "utf8")).toBe(text);
  });
});

describe("pi writer", () => {
  it("writes ~/.pi/agent/langfuse.json with environment and userId only", () => {
    const home = makeHome();
    const { path } = piTracingWriter(home, SETTINGS);
    expect(path).toBe(join(home, ".pi", "agent", "langfuse.json"));
    expect(readJson(path)).toEqual({ environment: SETTINGS.environment, userId: SETTINGS.userId });
  });

  it("omits userId when none is configured", () => {
    const home = makeHome();
    const { path } = piTracingWriter(home, { ...SETTINGS, userId: undefined });
    expect(readJson(path)).toEqual({ environment: SETTINGS.environment });
  });
});

describe("codex writer", () => {
  it("writes ~/.codex/langfuse.json with enabled, an explicit codex tag and environment at mode 0600", () => {
    const home = makeHome();
    const { path } = codexTracingWriter(home, SETTINGS);
    expect(path).toBe(join(home, ".codex", "langfuse.json"));
    expect(readJson(path)).toEqual({ enabled: true, tags: ["codex"], environment: SETTINGS.environment });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("carries enabled: false through unchanged", () => {
    const home = makeHome();
    const { path } = codexTracingWriter(home, { ...SETTINGS, enabled: false });
    expect(readJson(path).enabled).toBe(false);
  });

  it("never creates or edits ~/.codex/config.toml", () => {
    const home = makeHome();
    const configToml = join(home, ".codex", "config.toml");
    mkdirSync(dirname(configToml), { recursive: true });
    const original = '[plugins."tracing@codex-observability-plugin"]\nenabled = true\n';
    writeFileSync(configToml, original);
    codexTracingWriter(home, SETTINGS);
    expect(readFileSync(configToml, "utf8")).toBe(original);
  });
});
