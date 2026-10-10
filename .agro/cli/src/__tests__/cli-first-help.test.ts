import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGRO_PRODUCT, resolveProduct } from "../lib/product.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseSelfUpgradeArgs, parseVendorArgs, printAgroHelp, printSandboxHelp, printSelfUpgradeHelp, printVendorHelp } =
  await import("../cli.js");

function captureStdout(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fn();
  const text = spy.mock.calls.map((c) => String(c[0])).join("");
  spy.mockRestore();
  return text;
}

describe("cli-first help — the single agro identity", () => {
  it("top-level help lists self-upgrade and vendor as separate verbs", () => {
    const text = captureStdout(() => printAgroHelp(AGRO_PRODUCT));
    expect(text).toMatch(/^ {2}agro self-upgrade +Upgrade the installed agro CLI$/m);
    expect(text).toMatch(/^ {2}agro vendor +Vendor or upgrade the \.agro\/ control plane$/m);
    expect(text).toMatch(/^ {2}agro sandbox <args\.\.\.> +Create, list, and upgrade sandboxes \(install\|list\|upgrade\)$/m);
    expect(text).toMatch(/^agro — AGRO CLI/);
  });

  it("self-upgrade help covers only the installed CLI", () => {
    const text = captureStdout(() => printSelfUpgradeHelp("agro"));
    expect(text).toContain("Upgrade the installed agro CLI");
    expect(text).not.toContain("--from-remote [--ref <ref>]");
  });

  it("vendor help covers the control-plane payload", () => {
    const text = captureStdout(() => printVendorHelp("agro"));
    expect(text).toContain("Vendor or upgrade the .agro/ control plane");
    expect(text).toContain("--from-remote [--ref <ref>]");
  });

  it("sandbox help documents list with --json on its own usage line", () => {
    const text = captureStdout(() => printSandboxHelp("agro"));
    expect(text).toMatch(/^agro sandbox — Create and list sandboxes\n/);
    expect(text).toMatch(/^  agro sandbox list \[--json\]$/m);
    expect(text).toMatch(/^  agro sandbox upgrade <name> --version <X\.Y\.Z>$/m);
  });
});

describe("cli-first help — argv[1] product resolution", () => {
  it("resolves every invoked basename to the agro product", () => {
    for (const argv1 of ["agro", "/usr/local/bin/agro", "oh", "/usr/local/bin/oh", undefined]) {
      expect(resolveProduct(argv1)).toBe(AGRO_PRODUCT);
    }
  });
});

describe("cli-first help — verb dispatch", () => {
  const flags = ["--from", "--from-remote", "--ref", "--force"];

  for (const flag of flags) {
    it(`self-upgrade rejects ${flag} as belonging to agro vendor`, () => {
      const result = parseSelfUpgradeArgs([flag, "x"], "agro");
      expect(result).toEqual({
        ok: false,
        error: `agro self-upgrade: ${flag} belongs to the project-payload command; run \`agro vendor ${flag}\` — agro self-upgrade upgrades only the installed CLI`,
        showHelp: true,
      });
    });
  }

  it("vendor accepts payload flags", () => {
    expect(parseVendorArgs(["--from", "/x", "--force"], "agro")).toEqual({
      ok: true,
      args: { help: false, fromDir: "/x", fromRemote: false, force: true, dryRun: false },
    });
  });
});

const CLI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGRO_JS = join(CLI_DIR, "dist", "agro.js");

function run(
  bundle: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AGRO_EXECUTION_TARGET: "docker-compose", ...extraEnv },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

describe(
  "cli-first help — the built bundle",
  () => {
    it("builds exactly one executable bundle", () => {
      expect(existsSync(AGRO_JS)).toBe(true);
      expect(existsSync(join(CLI_DIR, "dist", "oh.js"))).toBe(false);
    });

    it("agro --help lists both self-upgrade and vendor", () => {
      const top = run(AGRO_JS, ["--help"]);
      expect(top.code).toBe(0);
      expect(top.stdout).toMatch(/^ {2}agro self-upgrade +Upgrade the installed agro CLI$/m);
      expect(top.stdout).toMatch(/^ {2}agro vendor +Vendor or upgrade the \.agro\/ control plane$/m);
      expect(top.stdout).toMatch(/^ {2}agro sandbox <args\.\.\.> +Create, list, and upgrade sandboxes \(install\|list\|upgrade\)$/m);
    });

    it("agro update is an alias of self-upgrade and refuses payload flags", () => {
      const cmd = run(AGRO_JS, ["update", "--help"]);
      expect(cmd.code).toBe(0);
      expect(cmd.stdout).toContain("Upgrade the installed agro CLI");
      expect(cmd.stdout).not.toContain("--from-remote [--ref <ref>]");
      expect(cmd.stdout).not.toContain("sandbox upgrade");

      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(
        /^agro self-upgrade: --from belongs to the project-payload command; run `agro vendor --from` — agro self-upgrade upgrades only the installed CLI\n/,
      );
    });

    it("sandbox upgrade help exits successfully without provisioning", () => {
      for (const flag of ["--help", "-h"]) {
        const result = run(AGRO_JS, ["sandbox", "upgrade", flag]);
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/^  agro sandbox upgrade <name> --version <X\.Y\.Z>$/m);
        expect(result.stderr).toBe("");
      }
    });

    it("sandbox upgrade rejects missing name, version, invalid version, latest, and extra arguments", () => {
      const home = mkdtempSync(join(tmpdir(), "agro-upgrade-invalid-"));
      try {
        for (const [tail, error] of [
          [[], "a name is required"],
          [["--version", "1.2.3"], "a name is required"],
          [["demo"], "--version is required"],
          [["demo", "--version"], "--version requires a value"],
          [["demo", "--version", "latest"], '--version "latest" is not a release version'],
          [["demo", "--latest"], 'unknown flag "--latest"'],
          [["demo", "--version", "1.2.3", "extra"], 'unexpected argument "extra"'],
        ] as const) {
          const result = run(AGRO_JS, ["sandbox", "upgrade", ...tail], { AGRO_HOME: home });
          expect(result.code).toBe(1);
          expect(result.stdout).toBe("");
          expect(result.stderr).toContain(`agro sandbox upgrade: ${error}`);
          expect(existsSync(join(home, "sandboxes"))).toBe(false);
        }
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });

    it("sandbox upgrade refuses the sandbox execution target and an absent host entry", () => {
      const home = mkdtempSync(join(tmpdir(), "agro-upgrade-absent-"));
      try {
        expect(run(AGRO_JS, ["sandbox", "upgrade", "demo", "--version", "v1.2.3"], {
          AGRO_HOME: home,
          AGRO_EXECUTION_TARGET: "local",
        })).toEqual({
          code: 1,
          stdout: "",
          stderr: "agro sandbox upgrade: host-only — run this command on the host\n",
        });
        expect(run(AGRO_JS, ["sandbox", "upgrade", "demo", "--version", "1.2.3"], {
          AGRO_HOME: home,
        })).toEqual({
          code: 1,
          stdout: "",
          stderr: 'agro sandbox upgrade: no sandbox entry named "demo"\n',
        });
        expect(existsSync(join(home, "sandboxes"))).toBe(false);
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });

    it("agro --version and agro -v print the bare CLI version", () => {
      const version = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")).version as string;
      for (const flag of ["--version", "-v"]) {
        const result = run(AGRO_JS, [flag]);
        expect(result.code).toBe(0);
        expect(result.stdout).toBe(`${version}\n`);
      }
    });

    it("agro sandbox install rejects --version without a value or with --image=<ref>, writing no entry", () => {
      const home = mkdtempSync(join(tmpdir(), "agro-version-pin-"));
      try {
        const missing = run(AGRO_JS, ["sandbox", "install", "docker", "--yes", "--version"], { AGRO_HOME: home });
        expect(missing.code).toBe(1);
        expect(missing.stderr).toBe("agro sandbox install: --version requires a value\n");

        const both = run(
          AGRO_JS,
          ["sandbox", "install", "docker", "--yes", "--version=0.13.0", "--image=my/img:1"],
          { AGRO_HOME: home },
        );
        expect(both.code).toBe(1);
        expect(both.stderr).toContain("--version");
        expect(both.stderr).toContain("--image=<ref>");
        expect(existsSync(join(home, "sandboxes"))).toBe(false);
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });

    it("sandbox list help exits successfully without querying the registry", () => {
      for (const flag of ["--help", "-h"]) {
        const result = run(AGRO_JS, ["sandbox", "list", flag]);
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/^agro sandbox — Create and list sandboxes\n/);
        expect(result.stdout).toMatch(/^  agro sandbox list \[--json\]$/m);
        expect(result.stderr).toBe("");
      }
    });

    it("sandbox list and --json return exact empty-registry output", () => {
      const home = mkdtempSync(join(tmpdir(), "agro-list-empty-"));
      try {
        expect(run(AGRO_JS, ["sandbox", "list", "--json"], { AGRO_HOME: home })).toEqual({
          code: 0,
          stdout: "[]\n",
          stderr: "",
        });
        expect(run(AGRO_JS, ["sandbox", "list"], { AGRO_HOME: home })).toEqual({
          code: 0,
          stdout: `no sandbox is registered in ${join(home, "sandboxes")} — create one with \`agro sandbox install docker\`\n`,
          stderr: "",
        });
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });

    it("sandbox list rejects unexpected positionals and unknown flags with exact exit and stderr", () => {
      const home = mkdtempSync(join(tmpdir(), "agro-list-invalid-"));
      try {
        for (const [tail, error] of [
          [["extra"], 'agro sandbox list: unexpected argument "extra"\n'],
          [["--json", "extra"], 'agro sandbox list: unexpected argument "extra"\n'],
          [["--unknown"], 'agro sandbox list: unknown flag "--unknown"\n'],
          [["--json", "--unknown"], 'agro sandbox list: unknown flag "--unknown"\n'],
        ] as const) {
          expect(run(AGRO_JS, ["sandbox", "list", ...tail], { AGRO_HOME: home })).toEqual({
            code: 1,
            stdout: "",
            stderr: error,
          });
        }
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });

    it("agro vendor requires a directory for --from", () => {
      expect(run(AGRO_JS, ["vendor", "--from"]).stderr).toBe("agro vendor: --from requires a directory\n");
    });
  },
);
