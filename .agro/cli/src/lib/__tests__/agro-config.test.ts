import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configCheckout,
  defaultAgroConfig,
  AGRO_CONFIG_FIELDS,
  agroConfigPath,
  readAgroConfig,
  setAgroConfigValue,
  validateAgroConfig,
  writeAgroConfig,
  type AgroConfig,
} from "../agro-config.js";

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "agro-config-"));
  cleanups.push(d);
  return d;
}

describe("agroConfigPath", () => {
  it("resolves agro.json at a fresh project root", () => {
    const root = makeRoot();
    expect(agroConfigPath(root)).toBe(join(root, "agro.json"));
  });
});

describe("readAgroConfig", () => {
  it("returns defaults named after the project directory when the file is absent", () => {
    const root = makeRoot();
    const config = readAgroConfig(agroConfigPath(root));
    expect(config.version).toBe(1);
    expect(config.name).toBe(root.split("/").pop());
    expect(config.access?.sshPort).toBe(2222);
  });

  it("rejects a file that is not valid JSON", () => {
    const root = makeRoot();
    writeFileSync(agroConfigPath(root), "{nope");
    expect(() => readAgroConfig(agroConfigPath(root))).toThrow(/agro\.json is not valid JSON/);
  });

  it("rejects a JSON array", () => {
    const root = makeRoot();
    writeFileSync(agroConfigPath(root), "[]");
    expect(() => readAgroConfig(agroConfigPath(root))).toThrow(/agro\.json: must contain a JSON object/);
  });
});

describe("round trip", () => {
  it("preserves the default config exactly", () => {
    const root = makeRoot();
    const config = defaultAgroConfig("demo");
    writeAgroConfig(root, config);
    expect(readAgroConfig(agroConfigPath(root))).toEqual(config);
  });

  it("preserves an unknown top-level key the operator added by hand", () => {
    const root = makeRoot();
    writeFileSync(
      agroConfigPath(root),
      JSON.stringify({ version: 1, name: "demo", experimental: { beam: true } }, null, 2),
    );

    const read = readAgroConfig(agroConfigPath(root));
    expect(read.experimental).toEqual({ beam: true });

    writeAgroConfig(root, read);
    const again = JSON.parse(readFileSync(agroConfigPath(root), "utf8")) as Record<string, unknown>;
    expect(again.experimental).toEqual({ beam: true });
  });

  it("preserves an unknown key nested inside a known section", () => {
    const root = makeRoot();
    writeFileSync(
      agroConfigPath(root),
      JSON.stringify({ version: 1, access: { ssh: true, futureFlag: "keep" } }),
    );
    const read = readAgroConfig(agroConfigPath(root));
    writeAgroConfig(root, read);
    const again = JSON.parse(readFileSync(agroConfigPath(root), "utf8")) as {
      access: Record<string, unknown>;
    };
    expect(again.access.futureFlag).toBe("keep");
  });

  it("writes agro.json world-readable — it is a tracked, non-secret file", () => {
    const root = makeRoot();
    writeAgroConfig(root, defaultAgroConfig("demo"));
    expect(statSync(agroConfigPath(root)).mode & 0o777).toBe(0o644);
  });

  it("stamps version 1 on a config that omits it", () => {
    const root = makeRoot();
    writeAgroConfig(root, { name: "demo" } as unknown as AgroConfig);
    expect(readAgroConfig(agroConfigPath(root)).version).toBe(1);
  });
});

describe("validateAgroConfig", () => {
  const cases: Array<[string, unknown, RegExp]> = [
    ["name", { name: 1 }, /^agro\.json: name must be a string$/],
    ["runtime", { runtime: "podman" }, /^agro\.json: runtime must be one of docker$/],
    ["repo", { repo: 7 }, /^agro\.json: repo must be a string$/],
    ["checkout", { checkout: 7 }, /^agro\.json: checkout must be a string$/],
    ["timezone", { timezone: true }, /^agro\.json: timezone must be a string$/],
    [
      "storage.homePath",
      { storage: { homePath: [] } },
      /^agro\.json: storage\.homePath must be a string$/,
    ],
    [
      "storage.homePath relative",
      { storage: { homePath: "oh-home" } },
      /^agro\.json: storage\.homePath must be an absolute host path$/,
    ],
    ["git", { git: "me" }, /^agro\.json: git must be an object$/],
    ["git.userName", { git: { userName: 7 } }, /^agro\.json: git\.userName must be a string$/],
    ["git.userEmail", { git: { userEmail: 7 } }, /^agro\.json: git\.userEmail must be a string$/],
    ["access.ssh", { access: { ssh: "yes" } }, /^agro\.json: access\.ssh must be a boolean$/],
    ["access.sshPort", { access: { sshPort: "2222" } }, /^agro\.json: access\.sshPort must be a number$/],
    [
      "access.sshPort range",
      { access: { sshPort: 0 } },
      /^agro\.json: access\.sshPort must be an integer between 1 and 65535$/,
    ],
    [
      "access.sshAuthorizedKeys",
      { access: { sshAuthorizedKeys: ["k"] } },
      /^agro\.json: access\.sshAuthorizedKeys must be a string$/,
    ],
    [
      "access.dockerSocket",
      { access: { dockerSocket: "on" } },
      /^agro\.json: access\.dockerSocket must be a boolean$/,
    ],
    [
      "hermesDashboard.port",
      { hermesDashboard: { port: "9119" } },
      /^agro\.json: hermesDashboard\.port must be a number$/,
    ],
    ["cron.agentBin", { cron: { agentBin: 3 } }, /^agro\.json: cron\.agentBin must be a string$/],
    [
      "build.skipPnpmInstall",
      { build: { skipPnpmInstall: "1" } },
      /^agro\.json: build\.skipPnpmInstall must be a boolean$/,
    ],
    ["image.ref", { image: { ref: 5 } }, /^agro\.json: image\.ref must be a string$/],
    ["image.mode", { image: { mode: "pull" } }, /^agro\.json: image\.mode must be one of build, image$/],
    [
      "image.pullPolicy",
      { image: { pullPolicy: "sometimes" } },
      /^agro\.json: image\.pullPolicy must be one of missing, always, never$/,
    ],
    [
      "composeOverrides",
      { composeOverrides: "a.yml" },
      /^agro\.json: composeOverrides must be an array of strings$/,
    ],
    [
      "composeOverrides entries",
      { composeOverrides: ["a.yml", 2] },
      /^agro\.json: composeOverrides must be an array of strings$/,
    ],
    ["version", { version: 2 }, /^agro\.json: version must be 1$/],
  ];

  for (const [label, value, message] of cases) {
    it(`rejects a wrong type at ${label} with a path-qualified message`, () => {
      expect(() => validateAgroConfig(value)).toThrow(message);
    });
  }

  it("accepts the default config", () => {
    expect(() => validateAgroConfig(defaultAgroConfig("demo"))).not.toThrow();
  });

  // #948: the template carries no `install` section, but an agro.json written
  // before the verb became the only door still does. An unknown key is data the
  // validator carries through, never a reason to refuse the file.
  it("tolerates a stale install section rather than refusing the file", () => {
    const stale = {
      ...defaultAgroConfig("legacy"),
      install: { opencode: true, hermes: false, tailscale: "yes" },
    };
    const validated = validateAgroConfig(stale);
    expect(validated.version).toBe(1);
    expect(validated.install).toEqual({ opencode: true, hermes: false, tailscale: "yes" });
  });

  it("accepts a registry entry: runtime docker with an absolute repo path", () => {
    const entry = { ...defaultAgroConfig("oh-sbx-1"), runtime: "docker", repo: "/srv/checkout" };
    const validated = validateAgroConfig(entry);
    expect(validated.runtime).toBe("docker");
    expect(validated.repo).toBe("/srv/checkout");
  });

  it("makes runtime and repo settable through `agro config set`", () => {
    expect(AGRO_CONFIG_FIELDS.find((f) => f.path === "runtime")).toEqual({
      path: "runtime",
      type: "enum",
      values: ["docker"],
    });
    expect(AGRO_CONFIG_FIELDS.find((f) => f.path === "repo")).toEqual({
      path: "repo",
      type: "string",
    });
    expect(AGRO_CONFIG_FIELDS.find((f) => f.path === "checkout")).toEqual({
      path: "checkout",
      type: "string",
    });
  });

  it("writes the checkout field through `agro config set checkout <dir>`", () => {
    const next = setAgroConfigValue(defaultAgroConfig("demo"), "checkout", "/srv/checkout");
    expect(next.checkout).toBe("/srv/checkout");
    expect(next.repo).toBeUndefined();
  });

  it("declares no install field in the template or the settable field list", () => {
    expect(Object.keys(defaultAgroConfig("demo"))).not.toContain("install");
    expect(AGRO_CONFIG_FIELDS.some((f) => f.path.startsWith("install."))).toBe(false);
  });
});

describe("agroConfigPath", () => {
  it("writes agro.json for a fresh root", () => {
    const root = makeRoot();
    expect(agroConfigPath(root)).toBe(join(root, "agro.json"));
    writeAgroConfig(root, defaultAgroConfig("demo"));
    expect(readFileSync(join(root, "agro.json"), "utf8")).toContain('"name": "demo"');
    expect(existsSync(join(root, "oh.json"))).toBe(false);
  });

  it("writes agro.json next to an existing .agro/ control dir with no config yet", () => {
    const root = makeRoot();
    mkdirSync(join(root, ".agro", "scripts"), { recursive: true });
    expect(agroConfigPath(root)).toBe(join(root, "agro.json"));
    writeAgroConfig(root, defaultAgroConfig("demo"));
    expect(existsSync(join(root, "agro.json"))).toBe(true);
  });

  it("reads agro.json when it is present", () => {
    const root = makeRoot();
    writeFileSync(join(root, "agro.json"), JSON.stringify({ version: 1, name: "agro-era" }));
    expect(agroConfigPath(root)).toBe(join(root, "agro.json"));
    expect(readAgroConfig(agroConfigPath(root)).name).toBe("agro-era");
  });

  it("ignores a legacy oh.json entirely", () => {
    const root = makeRoot();
    writeFileSync(join(root, "oh.json"), JSON.stringify({ version: 1, name: "legacy-era" }));
    expect(agroConfigPath(root)).toBe(join(root, "agro.json"));
    expect(readAgroConfig(agroConfigPath(root)).name).not.toBe("legacy-era");
  });
});

describe("configCheckout", () => {
  it("reads a config that spells the field repo", () => {
    expect(configCheckout({ version: 1, repo: "/srv/checkout" })).toBe("/srv/checkout");
  });

  it("reads a config that spells the field checkout", () => {
    expect(configCheckout({ version: 1, checkout: "/srv/checkout" })).toBe("/srv/checkout");
  });

  it("lets checkout outrank repo when a file holds both", () => {
    expect(configCheckout({ version: 1, repo: "/srv/old", checkout: "/srv/new" })).toBe("/srv/new");
  });

  it("treats an empty string and a missing field alike", () => {
    expect(configCheckout({ version: 1 })).toBeUndefined();
    expect(configCheckout({ version: 1, checkout: "" })).toBeUndefined();
    expect(configCheckout({ version: 1, repo: "" })).toBeUndefined();
  });

  it("round-trips a checkout field through validateAgroConfig", () => {
    const validated = validateAgroConfig({ version: 1, checkout: "/srv/checkout" });
    expect(configCheckout(validated)).toBe("/srv/checkout");
  });
});

describe("langfuse settings", () => {
  it("defaults to an empty section", () => {
    expect(defaultAgroConfig("demo").langfuse).toEqual({});
  });

  it("accepts all four non-secret fields", () => {
    const validated = validateAgroConfig({
      version: 1,
      langfuse: {
        enabled: true,
        baseUrl: "https://cloud.langfuse.com",
        environment: "demo",
        userId: "ada",
      },
    });
    expect(validated.langfuse).toEqual({
      enabled: true,
      baseUrl: "https://cloud.langfuse.com",
      environment: "demo",
      userId: "ada",
    });
  });

  it.each([
    [{ enabled: "yes" }, /langfuse\.enabled must be a boolean/],
    [{ baseUrl: 3 }, /langfuse\.baseUrl must be a string/],
    [{ environment: [] }, /langfuse\.environment must be a string/],
    [{ userId: {} }, /langfuse\.userId must be a string/],
    ["on", /langfuse must be an object/],
  ] as [unknown, RegExp][])("rejects langfuse %j", (langfuse, message) => {
    expect(() => validateAgroConfig({ version: 1, langfuse })).toThrow(message);
  });

  it("registers all four paths in AGRO_CONFIG_FIELDS", () => {
    const paths = AGRO_CONFIG_FIELDS.map((field) => field.path);
    expect(paths).toContain("langfuse.enabled");
    expect(paths).toContain("langfuse.baseUrl");
    expect(paths).toContain("langfuse.environment");
    expect(paths).toContain("langfuse.userId");
    expect(AGRO_CONFIG_FIELDS.find((field) => field.path === "langfuse.enabled")?.type).toBe(
      "boolean",
    );
  });

  it("sets langfuse.baseUrl through setAgroConfigValue", () => {
    const next = setAgroConfigValue(
      defaultAgroConfig("demo"),
      "langfuse.baseUrl",
      "http://host.docker.internal:3000",
    );
    expect(next.langfuse?.baseUrl).toBe("http://host.docker.internal:3000");
  });

  it("registers no credential path", () => {
    const paths = AGRO_CONFIG_FIELDS.map((field) => field.path);
    expect(paths).not.toContain("langfuse.publicKey");
    expect(paths).not.toContain("langfuse.secretKey");
    expect(() => setAgroConfigValue(defaultAgroConfig("demo"), "langfuse.publicKey", "pk")).toThrow(
      /unknown agro\.json field "langfuse\.publicKey"/,
    );
  });

  it("keeps the privacy preset retired", () => {
    expect(AGRO_CONFIG_FIELDS.map((field) => field.path)).not.toContain("langfuse.privacyPreset");
  });

  it("loads an existing config with no langfuse section and leaves the feature inert", () => {
    const root = makeRoot();
    writeFileSync(
      agroConfigPath(root),
      `${JSON.stringify({ version: 1, name: "demo", timezone: "UTC" }, null, 2)}\n`,
    );
    const config = readAgroConfig(agroConfigPath(root));
    expect(config.langfuse).toBeUndefined();
    expect(config.langfuse?.enabled ?? false).toBe(false);
  });

  it("round-trips the section through writeAgroConfig", () => {
    const root = makeRoot();
    const config = defaultAgroConfig("demo");
    config.langfuse = { enabled: true, environment: "demo" };
    writeAgroConfig(root, config);
    expect(readAgroConfig(agroConfigPath(root)).langfuse).toEqual({
      enabled: true,
      environment: "demo",
    });
  });
});

describe("the tracked agro.json", () => {
  it("carries a langfuse section that validates and holds no credential", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
    const config = readAgroConfig(join(repoRoot, "agro.json"));
    expect(config.langfuse).toBeDefined();
    expect(JSON.stringify(config.langfuse ?? {})).not.toMatch(/pk-lf|sk-lf|publicKey|secretKey/);
  });
});
