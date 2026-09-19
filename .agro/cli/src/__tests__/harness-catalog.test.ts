import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  findHarness,
  harnessIds,
  harnessBinPath,
  HARNESS_CATALOG,
  harnessLaunchCommand,
  HARNESS_PREFIX_TOKEN,
  resolveInstallArgv,
  resolveUninstallArgv,
  resolveVerifyArgv,
  SANDBOX_HARNESS_PREFIX,
  type HarnessEntry,
} from "../lib/harnesses/catalog.js";


const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");

const DOCKERFILE = read(".devcontainer/Dockerfile");
const COMPOSE_YML = read(".devcontainer/docker-compose.yml");
const ENTRYPOINT = read(".devcontainer/entrypoint.sh");
const NPM_USER_PREFIX = "/home/sandbox/.local";

// Comments may legitimately name a harness package; only instructions may not.
const DOCKERFILE_CODE = DOCKERFILE.split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

function versionPins(argv: readonly string[]): string[] {
  const pins = new Set<string>();
  for (const part of argv) {
    for (const m of part.matchAll(/\b\d+\.\d+\.\d+\b/g)) pins.add(m[0]);
  }
  return [...pins];
}

describe("harness catalog", () => {
  it("has unique ids and no empty argv", () => {
    expect(new Set(harnessIds()).size).toBe(HARNESS_CATALOG.length);
    for (const h of HARNESS_CATALOG) {
      expect(h.installArgv.length).toBeGreaterThan(0);
      expect(h.verifyArgv.length).toBeGreaterThan(0);
      expect(h.binary).not.toBe("");
    }
  });

  it("documents every harness under docs/harnesses/<id>.md", () => {
    for (const h of HARNESS_CATALOG) {
      expect(h.docsPath).toBe(`docs/harnesses/${h.id}.md`);
      expect(() => read(h.docsPath)).not.toThrow();
    }
  });

  // #948: the only kinds left are `installable` (the verb installs it) and
  // `on-demand` (the runner fetches it per invocation). Nothing is a default.
  describe("every entry is installable or on-demand", () => {
    const installable = HARNESS_CATALOG.filter((h) => h.kind === "installable");

    it("classifies each entry as one of exactly two kinds", () => {
      for (const h of HARNESS_CATALOG) {
        expect(["installable", "on-demand"], h.id).toContain(h.kind);
      }
      expect(installable.length).toBeGreaterThan(0);
    });

    it("covers every harness the verb can install", () => {
      expect(installable.map((h) => h.id).sort()).toEqual([
        "antigravity-cli",
        "claude-code",
        "codex",
        "grok-build",
        "hermes",
        "muse-code",
        "opencode",
        "pi",
      ]);
    });

    it("leaves t3code the sole on-demand entry", () => {
      expect(HARNESS_CATALOG.filter((h) => h.kind === "on-demand").map((h) => h.id)).toEqual([
        "t3code",
      ]);
    });

    it("carries no oh.json key on any entry — the verb is the only door", () => {
      const required = [
        "binary",
        "docsPath",
        "id",
        "installArgv",
        "installUser",
        "kind",
        "title",
        "uninstallArgv",
        "verifyArgv",
      ];
      for (const h of HARNESS_CATALOG) {
        const keys = Object.keys(h).sort();
        expect(keys.filter((k) => k !== "bypassPermissionsFlag"), h.id).toEqual(required);
      }
    });

    it("names a bypass-permissions flag for claude-code and antigravity-cli and leaves it off elsewhere", () => {
      const byId = new Map(HARNESS_CATALOG.map((h) => [h.id, h]));
      expect(byId.get("claude-code")!.bypassPermissionsFlag).toBe("--permission-mode bypassPermissions");
      expect(byId.get("antigravity-cli")!.bypassPermissionsFlag).toBe("--dangerously-skip-permissions");
      expect(byId.get("codex")!.bypassPermissionsFlag).toBeUndefined();
      expect(harnessLaunchCommand(byId.get("claude-code")!)).toBe(
        "claude --permission-mode bypassPermissions",
      );
      expect(harnessLaunchCommand(byId.get("antigravity-cli")!)).toBe(
        "agy --dangerously-skip-permissions",
      );
      expect(harnessLaunchCommand(byId.get("codex")!)).toBe("codex");
    });

    it("ships antigravity-cli zero-confirmation defaults in the image, entrypoint, and zshrc", () => {
      expect(DOCKERFILE).toContain("alias agy='agy --dangerously-skip-permissions'");
      expect(DOCKERFILE).toContain('{"defaultPermissionMode": "bypassPermissions"}');
      expect(ENTRYPOINT).toContain("/home/sandbox/.gemini/antigravity-cli/settings.json");
      expect(ENTRYPOINT).toContain('{"defaultPermissionMode": "bypassPermissions"}');
      expect(read(".agro/install/.zshrc")).toContain(
        "alias agy='agy --dangerously-skip-permissions'",
      );
    });
  });

  // #908: the INSTALL_* build args are gone. The catalog no longer mirrors the
  // Dockerfile — it replaces it, and `oh harness install` is the only path.
  describe("owns the install, and the image no longer does", () => {
    it("declares no buildArg anywhere — the field itself is gone", () => {
      expect(read(".agro/cli/src/lib/harnesses/catalog.ts")).not.toContain("buildArg");
    });

    it("declares no per-harness INSTALL_* build arg or compose projection", () => {
      for (const name of ["OPENCODE", "GROK_BUILD", "HERMES", "AGENT_BROWSER", "TAILSCALE"]) {
        const arg = `INSTALL_${name}`;
        expect(DOCKERFILE).not.toMatch(new RegExp(`^ARG ${arg}`, "m"));
        expect(COMPOSE_YML).not.toContain(`${arg}: \${${arg}:-false}`);
      }
    });

    it.each(HARNESS_CATALOG.map((h) => [h.id, h] as const))(
      "%s: installs as the sandbox user into the home mount",
      (_id, h) => {
        expect(h.installUser).toBe("sandbox");
        expect(resolveInstallArgv(h, SANDBOX_HARNESS_PREFIX).join("\n")).toMatch(
          /\/home\/sandbox\/\.local|\$HOME\/\.local|uv|npx/,
        );
      },
    );

    it("keeps the grok-build pin in the catalog, now that the Dockerfile has none", () => {
      const grok = findHarness("grok-build");
      expect(versionPins(grok!.installArgv)).toEqual(["0.2.39"]);
      expect(DOCKERFILE).not.toContain("bash -s 0.2.39");
    });

    it("gates the Hermes wiring on the binary, never on INSTALL_HERMES", () => {
      expect(COMPOSE_YML).not.toContain("INSTALL_HERMES");
      expect(DOCKERFILE).not.toContain("INSTALL_HERMES");
      expect(ENTRYPOINT).not.toContain("INSTALL_HERMES");
      expect(ENTRYPOINT).toContain("if command -v hermes >/dev/null 2>&1; then");
      expect(read(".agro/scripts/link-providers.sh")).not.toContain("INSTALL_HERMES");
    });

    it("installs every harness as the sandbox user, never root", () => {
      for (const h of HARNESS_CATALOG) {
        expect(h.installUser, h.id).toBe("sandbox");
      }
      expect(DOCKERFILE).toContain("UV_TOOL_DIR=/home/sandbox");
    });
  });

  it("builds pipeline installers as constant argv, never interpolation", () => {
    for (const h of HARNESS_CATALOG) {
      if (h.installArgv[0] !== "bash") continue;
      expect(h.installArgv[1]).toBe("-lc");
      expect(h.installArgv[2]).not.toContain("${");
      expect(h.installArgv).toHaveLength(3);
    }
  });

  describe("npm-installed harnesses land in the home mount, not the image", () => {
    const npmHarnesses = HARNESS_CATALOG.filter((h) => h.installArgv[0] === "npm");

    it("covers claude-code, codex, opencode and pi", () => {
      expect(npmHarnesses.map((h) => h.id).sort()).toEqual([
        "claude-code",
        "codex",
        "opencode",
        "pi",
      ]);
    });

    it("declares NPM_USER_PREFIX as the prefix the catalog installs into", () => {
      expect(DOCKERFILE).toContain(`ENV NPM_USER_PREFIX="${NPM_USER_PREFIX}"`);
    });

    it.each(npmHarnesses.map((h) => [h.id, h] as const))(
      "%s: installs as the sandbox user into NPM_USER_PREFIX",
      (_id, h) => {
        expect(h.installUser).toBe("sandbox");
        expect(resolveInstallArgv(h, SANDBOX_HARNESS_PREFIX)).toContain(NPM_USER_PREFIX);
      },
    );

    it("keeps claude-code's postinstall, which copies the native binary over the placeholder", () => {
      expect(findHarness("claude-code")!.installArgv).not.toContain("--ignore-scripts");
    });

    it.each(npmHarnesses.map((h) => [h.id, h] as const))(
      "%s: its npm package is absent from the Dockerfile",
      (id, h) => {
        const pkg = h.installArgv[h.installArgv.length - 1];
        expect(pkg, `${id} declares no install package`).toMatch(/^(@[^/]+\/)?[^-].*/);
        expect(
          DOCKERFILE_CODE,
          `${id} is baked into the image; it enters only through \`oh harness install\``,
        ).not.toContain(pkg);
      },
    );

    it("keeps no build arg that could bake a harness back into the image", () => {
      expect(DOCKERFILE_CODE).not.toMatch(/^ARG (BAKE_HARNESSES|AGENTS)=/m);
    });
  });

  it("findHarness resolves known ids and rejects unknown ones", () => {
    expect(findHarness("opencode")?.id).toBe("opencode");
    expect(findHarness("grok-build")?.title).toBe("Grok Build");
    expect(findHarness("nope")).toBeUndefined();
  });

  it("registers Muse with a home-local native installer and version verification", () => {
    const muse = findHarness("muse-code")!;
    expect(muse).toMatchObject({
      title: "Muse Code", binary: "muse", kind: "installable",
      installUser: "sandbox", verifyArgv: ["muse", "--version"],
      docsPath: "docs/harnesses/muse-code.md",
    });
    const museScript = resolveInstallArgv(muse, SANDBOX_HARNESS_PREFIX)[2];
    expect(museScript).toContain(`MUSE_INSTALL_DIR="${SANDBOX_HARNESS_PREFIX}/bin"`);
    expect(museScript).toContain("MUSE_NO_MODIFY_PATH=1");
    expect(museScript).toContain("MUSE_LOGIN=0");
    expect(museScript).toContain("set -o pipefail");
  });
});

// The npm prefix is a parameter, not a constant. The catalog carries a token;
// the resolver binds it to the sandbox prefix or to a host prefix.
describe("prefix token and resolvers", () => {
  const expandSandboxHome = (script: string): string =>
    script.split("$HOME/.local").join(SANDBOX_HARNESS_PREFIX);

  const SHIPPED_SANDBOX_INSTALL_ARGV: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["claude-code", ["npm", "--prefix", "/home/sandbox/.local", "install", "-g", "@anthropic-ai/claude-code"]],
    ["codex", ["npm", "--prefix", "/home/sandbox/.local", "install", "-g", "@openai/codex"]],
    ["pi", ["npm", "--prefix", "/home/sandbox/.local", "install", "-g", "--ignore-scripts", "@earendil-works/pi-coding-agent"]],
    ["opencode", ["npm", "--prefix", "/home/sandbox/.local", "install", "-g", "opencode-ai"]],
    ["grok-build", ["bash", "-lc", expandSandboxHome("curl -fsSL https://x.ai/cli/install.sh | GROK_BIN_DIR=\"$HOME/.local/bin\" bash -s 0.2.39 && rm -f \"$HOME/.local/bin/agent\"")]],
    ["hermes", ["bash", "-lc", expandSandboxHome("curl -fsSL https://hermes-agent.nousresearch.com/install.sh | HERMES_INSTALL_DIR=\"$HOME/.local/lib/hermes-agent\" bash -s -- --skip-setup --skip-browser && uv pip install --python \"$HOME/.local/lib/hermes-agent/venv/bin/python\" 'hermes-agent[slack,teams,web,pty]'")]],
    ["muse-code", ["bash", "-lc", expandSandboxHome("set -o pipefail; curl -fsSL https://dev.meta.ai/install.sh | MUSE_INSTALL_DIR=\"$HOME/.local/bin\" MUSE_NO_MODIFY_PATH=1 MUSE_LOGIN=0 bash")]],
    ["antigravity-cli", ["bash", "-lc", expandSandboxHome("set -o pipefail; curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir \"$HOME/.local/bin\"")]],
    ["t3code", ["npx", "--yes", "t3", "--version"]],
  ];

  const HOST_PREFIX = "/home/me/.agro/.local";

  it("binds the sandbox prefix to the value the Dockerfile exports", () => {
    expect(SANDBOX_HARNESS_PREFIX).toBe(NPM_USER_PREFIX);
  });

  const PREFIX_SPELLINGS = [
    SANDBOX_HARNESS_PREFIX,
    "$HOME/.local",
    "${HOME}/.local",
    "~/.local",
  ];

  it("spells the prefix only as the token, never as a home-relative path", () => {
    for (const h of HARNESS_CATALOG) {
      for (const spelling of PREFIX_SPELLINGS) {
        expect(h.installArgv.join("\n"), `${h.id} installArgv`).not.toContain(spelling);
        expect(h.verifyArgv.join("\n"), `${h.id} verifyArgv`).not.toContain(spelling);
        expect((h.uninstallArgv ?? []).join("\n"), `${h.id} uninstallArgv`).not.toContain(
          spelling,
        );
      }
    }
  });

  it.each(["grok-build", "hermes", "muse-code", "antigravity-cli"])(
    "%s: resolves to a host prefix with no sandbox path and no shell home left",
    (id) => {
      const argv = resolveInstallArgv(findHarness(id)!, "/home/me/.agro").join("\n");
      expect(argv).not.toContain("/home/sandbox");
      expect(argv).not.toContain("$HOME");
      expect(argv).toContain("/home/me/.agro");
    },
  );

  it("covers every catalog entry in the shipped-argv table", () => {
    expect(SHIPPED_SANDBOX_INSTALL_ARGV.map(([id]) => id)).toEqual(harnessIds());
  });

  it.each(SHIPPED_SANDBOX_INSTALL_ARGV.map(([id, argv]) => [id, argv] as const))(
    "%s: resolves to the argv the catalog shipped before the token",
    (id, argv) => {
      expect(resolveInstallArgv(findHarness(id)!, SANDBOX_HARNESS_PREFIX)).toEqual([...argv]);
    },
  );

  it("substitutes every occurrence inside one argument", () => {
    const entry = {
      ...findHarness("opencode")!,
      installArgv: ["bash", "-lc", `${HARNESS_PREFIX_TOKEN}/bin/x --root ${HARNESS_PREFIX_TOKEN}`],
      verifyArgv: [`${HARNESS_PREFIX_TOKEN}/bin/opencode`, "--version"],
    } satisfies HarnessEntry;
    expect(resolveInstallArgv(entry, HOST_PREFIX)[2]).toBe(
      "/home/me/.agro/.local/bin/x --root /home/me/.agro/.local",
    );
    expect(resolveVerifyArgv(entry, HOST_PREFIX)).toEqual([
      "/home/me/.agro/.local/bin/opencode",
      "--version",
    ]);
  });

  it("resolves a non-sandbox prefix for install and verify argv", () => {
    const opencode = findHarness("opencode")!;
    expect(resolveInstallArgv(opencode, HOST_PREFIX)).toEqual([
      "npm", "--prefix", HOST_PREFIX, "install", "-g", "opencode-ai",
    ]);
    expect(resolveVerifyArgv(opencode, HOST_PREFIX)).toEqual(["opencode", "--version"]);
  });

  it("joins the bin directory onto any prefix", () => {
    expect(harnessBinPath(SANDBOX_HARNESS_PREFIX)).toBe("/home/sandbox/.local/bin");
    expect(harnessBinPath(HOST_PREFIX)).toBe("/home/me/.agro/.local/bin");
  });
});

// An uninstall verb with a path bug deletes the operator's files, so removal is
// stated per entry and every resolved path is proven to stay under the prefix.
describe("uninstall knowledge", () => {
  const HOST_PREFIX = "/home/me/.agro/.local";

  it("declares removal for every installable entry and none for an on-demand one", () => {
    for (const h of HARNESS_CATALOG) {
      if (h.kind === "installable") {
        expect(h.uninstallArgv, h.id).not.toBeNull();
        expect(h.uninstallArgv!.length, h.id).toBeGreaterThan(0);
        expect(resolveUninstallArgv(h, HOST_PREFIX), h.id).not.toBeNull();
      } else {
        expect(h.uninstallArgv, h.id).toBeNull();
        expect(resolveUninstallArgv(h, HOST_PREFIX), h.id).toBeNull();
      }
    }
  });

  it("removes an npm harness by its stated package name", () => {
    expect(resolveUninstallArgv(findHarness("opencode")!, HOST_PREFIX)).toEqual([
      "npm", "--prefix", HOST_PREFIX, "uninstall", "-g", "opencode-ai",
    ]);
    expect(resolveUninstallArgv(findHarness("claude-code")!, SANDBOX_HARNESS_PREFIX)).toEqual([
      "npm", "--prefix", SANDBOX_HARNESS_PREFIX, "uninstall", "-g", "@anthropic-ai/claude-code",
    ]);
  });

  it("removes a script harness by its exact installed paths", () => {
    expect(resolveUninstallArgv(findHarness("hermes")!, HOST_PREFIX)).toEqual([
      "rm", "-rf", `${HOST_PREFIX}/bin/hermes`, `${HOST_PREFIX}/lib/hermes-agent`,
    ]);
  });

  it("deletes idempotently, so removing a half-installed harness cannot fail", () => {
    for (const h of HARNESS_CATALOG) {
      const argv = resolveUninstallArgv(h, HOST_PREFIX);
      if (argv === null || argv[0] !== "rm") continue;
      expect(argv[1], h.id).toBe("-rf");
      expect(argv.length, h.id).toBeGreaterThan(2);
    }
  });

  it.each(HARNESS_CATALOG.map((h) => [h.id, h] as const))(
    "%s: removal never reaches outside the resolved prefix",
    (id, h) => {
      const argv = resolveUninstallArgv(h, HOST_PREFIX);
      if (argv === null) return;
      expect(argv.join("\n"), id).not.toContain(HARNESS_PREFIX_TOKEN);
      for (const arg of argv) {
        expect(arg, `${id}: bare root argument`).not.toBe("/");
        expect(arg.split("/"), `${id}: ${arg} carries a parent segment`).not.toContain("..");
        if (!arg.startsWith("/")) continue;
        expect(
          arg === HOST_PREFIX || arg.startsWith(`${HOST_PREFIX}/`),
          `${id}: ${arg} escapes ${HOST_PREFIX}`,
        ).toBe(true);
      }
    },
  );
});
