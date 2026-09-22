import { beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const { parseSelfUpgradeArgs, parseVendorArgs, printAgroHelp, printSelfUpgradeHelp, printVendorHelp } =
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
const ESBUILD_AVAILABLE = existsSync(join(CLI_DIR, "node_modules", "esbuild"));

function run(bundle: string, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AGRO_EXECUTION_TARGET: "docker-compose" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

describe.skipIf(!ESBUILD_AVAILABLE)(
  "cli-first help — the built bundle (skipped when esbuild is absent)",
  () => {
    beforeAll(() => {
      execFileSync("npm", ["run", "build"], { cwd: CLI_DIR, stdio: "ignore" });
    }, 120_000);

    it("builds exactly one executable bundle", () => {
      expect(existsSync(AGRO_JS)).toBe(true);
      expect(existsSync(join(CLI_DIR, "dist", "oh.js"))).toBe(false);
    });

    it("agro --help lists both self-upgrade and vendor", () => {
      const top = run(AGRO_JS, ["--help"]);
      expect(top.code).toBe(0);
      expect(top.stdout).toMatch(/^ {2}agro self-upgrade +Upgrade the installed agro CLI$/m);
      expect(top.stdout).toMatch(/^ {2}agro vendor +Vendor or upgrade the \.agro\/ control plane$/m);
    });

    it("agro update is an alias of self-upgrade and refuses payload flags", () => {
      const cmd = run(AGRO_JS, ["update", "--help"]);
      expect(cmd.code).toBe(0);
      expect(cmd.stdout).toContain("Upgrade the installed agro CLI");
      expect(cmd.stdout).not.toContain("--from-remote [--ref <ref>]");

      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(
        /^agro self-upgrade: --from belongs to the project-payload command; run `agro vendor --from` — agro self-upgrade upgrades only the installed CLI\n/,
      );
    });

    it("agro vendor requires a directory for --from", () => {
      expect(run(AGRO_JS, ["vendor", "--from"]).stderr).toBe("agro vendor: --from requires a directory\n");
    });
  },
);
