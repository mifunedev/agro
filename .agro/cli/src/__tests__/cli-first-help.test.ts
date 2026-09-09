import { beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGRO_PRODUCT, LEGACY_PRODUCT, resolveProduct } from "../lib/product.js";

vi.mock("../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const { parseUpdateArgs, printOhHelp, printUpdateHelp } = await import("../cli.js");

function captureStdout(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  fn();
  const text = spy.mock.calls.map((c) => String(c[0])).join("");
  spy.mockRestore();
  return text;
}

describe("cli-first help — product-aware update lines", () => {
  it("top-level agro help describes update as CLI self-upgrade", () => {
    const text = captureStdout(() => printOhHelp(AGRO_PRODUCT));
    expect(text).toMatch(/^ {2}agro update +Upgrade the installed agro CLI$/m);
    expect(text).not.toContain("Vendor or upgrade");
    expect(text).not.toMatch(/^ {2}oh /m);
  });

  it("top-level oh help describes update as project vendoring", () => {
    const text = captureStdout(() => printOhHelp(LEGACY_PRODUCT));
    expect(text).toMatch(/^ {2}oh update +Vendor or upgrade the \.oh\/ control plane$/m);
    expect(text).not.toContain("Upgrade the installed");
    expect(text).not.toMatch(/^ {2}agro /m);
  });

  it("printOhHelp defaults to the oh identity", () => {
    const text = captureStdout(() => printOhHelp());
    expect(text).toMatch(/^oh — /);
    expect(text).toContain("Vendor or upgrade the .oh/ control plane");
  });

  it("command-specific agro update help is self-upgrade", () => {
    const text = captureStdout(() => printUpdateHelp("agro"));
    expect(text.startsWith("agro update — Upgrade the installed agro CLI\n")).toBe(true);
    expect(text).not.toContain("--from-remote [--ref <ref>]");
  });

  it("command-specific oh update help is project vendoring", () => {
    const text = captureStdout(() => printUpdateHelp("oh"));
    expect(text.startsWith("oh update — Vendor or upgrade the .oh/ control plane\n")).toBe(true);
    expect(text).toContain("--from-remote [--ref <ref>]");
  });
});

describe("cli-first help — argv[1] product resolution", () => {
  it("resolves basename agro vs oh", () => {
    expect(resolveProduct("/usr/local/bin/agro")).toBe(AGRO_PRODUCT);
    expect(resolveProduct("/usr/local/bin/oh")).toBe(LEGACY_PRODUCT);
    expect(resolveProduct("/opt/oh/dist/agro.js").name).toBe("agro");
    expect(resolveProduct("/opt/oh/dist/oh.js").name).toBe("oh");
  });
});

describe("cli-first help — update dispatch", () => {
  const flags = ["--from", "--from-remote", "--ref", "--force"];

  for (const flag of flags) {
    it(`agro update rejects ${flag} as belonging to oh update`, () => {
      const result = parseUpdateArgs([flag, "x"], "agro");
      expect(result).toEqual({
        ok: false,
        error: `agro update: ${flag} belongs to the legacy project-payload command; run \`oh update ${flag}\` during the compatibility window — agro update upgrades only the installed CLI`,
        showHelp: true,
      });
    });
  }

  it("oh update still accepts payload flags for vendoring", () => {
    expect(parseUpdateArgs(["--from", "/x", "--force"], "oh")).toEqual({
      ok: true,
      args: { help: false, fromDir: "/x", fromRemote: false, force: true, dryRun: false },
    });
  });
});

const CLI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGRO_JS = join(CLI_DIR, "dist", "agro.js");
const OH_JS = join(CLI_DIR, "dist", "oh.js");
const ESBUILD_AVAILABLE = existsSync(join(CLI_DIR, "node_modules", "esbuild"));

function run(bundle: string, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OH_EXECUTION_TARGET: "docker-compose" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

describe.skipIf(!ESBUILD_AVAILABLE)(
  "cli-first help — executable identities (skipped when esbuild is absent)",
  () => {
    beforeAll(() => {
      execFileSync("npm", ["run", "build"], { cwd: CLI_DIR, stdio: "ignore" });
    }, 120_000);

    it("agro --help and agro update --help describe CLI self-upgrade", () => {
      const top = run(AGRO_JS, ["--help"]);
      expect(top.code).toBe(0);
      expect(top.stdout).toMatch(/^ {2}agro update +Upgrade the installed agro CLI$/m);
      expect(top.stdout).not.toContain("Vendor or upgrade");

      const cmd = run(AGRO_JS, ["update", "--help"]);
      expect(cmd.code).toBe(0);
      expect(cmd.stdout).toContain("Upgrade the installed agro CLI");
      expect(cmd.stdout).not.toContain("--from-remote [--ref <ref>]");
    });

    it("oh --help and oh update --help describe project vendoring", () => {
      const top = run(OH_JS, ["--help"]);
      expect(top.code).toBe(0);
      expect(top.stdout).toMatch(/^ {2}oh update +Vendor or upgrade the \.oh\/ control plane$/m);

      const cmd = run(OH_JS, ["update", "--help"]);
      expect(cmd.code).toBe(0);
      expect(cmd.stdout).toContain("Vendor or upgrade the .oh/ control plane");
      expect(cmd.stdout).toContain("--from-remote [--ref <ref>]");
    });

    it("agro update rejects payload flags; oh update still vendors", () => {
      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(
        /^agro update: --from belongs to the legacy project-payload command; run `oh update --from` during the compatibility window — agro update upgrades only the installed CLI\n/,
      );
      expect(run(OH_JS, ["update", "--from"]).stderr).toBe("oh update: --from requires a directory\n");
    });
  },
);
