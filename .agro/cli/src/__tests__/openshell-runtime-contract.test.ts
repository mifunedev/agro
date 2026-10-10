import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { findRuntime, PROVISIONABLE_RUNTIMES } from "../lib/runtimes/catalog.js";
import {
  AGRO_CONFIG_FIELDS,
  SANDBOX_RUNTIMES,
  defaultAgroConfig,
  validateAgroConfig,
} from "../lib/agro-config.js";
import openshellPolicy from "agro-asset:.devcontainer/openshell-policy.yaml";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (p: string): string => readFileSync(join(REPO_ROOT, p), "utf8");
const POLICY_PATH = ".devcontainer/openshell-policy.yaml";

describe("the openshell runtime contract", () => {
  it("keeps a provisionable openshell entry in the runtime catalog", () => {
    expect(findRuntime("openshell")).toMatchObject({
      provisionable: true,
      docsPath: "docs/runtimes/openshell.md",
    });
    expect(PROVISIONABLE_RUNTIMES).toContain("openshell");
  });

  it("derives the agro.json runtime enum from the catalog", () => {
    expect(SANDBOX_RUNTIMES).toEqual(PROVISIONABLE_RUNTIMES);
    expect(AGRO_CONFIG_FIELDS.find((f) => f.path === "runtime")).toEqual({
      path: "runtime",
      type: "enum",
      values: SANDBOX_RUNTIMES,
    });
    expect(validateAgroConfig({ ...defaultAgroConfig("box"), runtime: "openshell" }).runtime).toBe("openshell");
  });

  it("documents openshell as a runtime value in docs/configuration.md", () => {
    const row = read("docs/configuration.md").split("\n").find((line) => line.startsWith("| `runtime` |"));
    expect(row).toContain('`"openshell"`');
  });

  it("ships the policy as a bundled asset and in the image asset COPY", () => {
    expect(existsSync(join(REPO_ROOT, POLICY_PATH))).toBe(true);
    expect(openshellPolicy).toBe(read(POLICY_PATH));
    expect((parse(openshellPolicy) as { process?: { run_as_user?: string } }).process?.run_as_user).toBe("sandbox");
    expect(read(".agro/cli/src/lib/registry.ts")).toContain(`from "agro-asset:${POLICY_PATH}"`);
    const assetCopies = read(".devcontainer/Dockerfile")
      .split("\n")
      .filter((line) => /^COPY .*\/opt\/agro-assets\//.test(line));
    expect(assetCopies.some((line) => line.split(/\s+/).includes(POLICY_PATH))).toBe(true);
  });

  it("keeps the runtime page and links it from the runtime overview and the lifecycle reference", () => {
    const page = read("docs/runtimes/openshell.md");
    for (const fragment of ["Experimental.", "interactive-only", "Claude Code only", POLICY_PATH, "## Out of scope in v1"]) {
      expect(page, fragment).toContain(fragment);
    }
    expect(read("docs/runtimes/overview.md")).toContain("](openshell.md");
    expect(read("docs/lifecycle-commands.md")).toContain("](runtimes/openshell.md");
  });
});
