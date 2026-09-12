import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PiSettings {
  packages?: string[];
  skills?: string[];
}

const RETIRED_PACKAGE_NAME = "pi-dynamic-workflows";

function readPiSettings(): PiSettings {
  return JSON.parse(readFileSync(".pi/settings.json", "utf8")) as PiSettings;
}

function packageIdentity(spec: string): string {
  const withoutSource = spec.replace(/^(npm|git|https?|ssh):/, "").replace(/^\/\//, "");
  const withoutRef = withoutSource.replace(/@[^@/]*$/, "");
  return withoutRef.split("/").filter(Boolean).pop() ?? withoutRef;
}

describe("project Pi settings", () => {
  it("pins the default Pi packages used by the harness", () => {
    const settings = readPiSettings();

    expect(settings.packages).toEqual([
      "npm:@tintinweb/pi-subagents@0.12.0",
      "npm:@tintinweb/pi-tasks@0.7.0",
      "npm:@narumitw/pi-goal@0.4.2",
      "npm:@narumitw/pi-codex-usage@0.6.2",
      "npm:@tifan/pi-recap@0.4.2",
      "npm:@trevonistrevon/pi-loop@0.5.5",
      "npm:@guwidoe/pi-prompt-suggester@0.3.10",
      "npm:@ff-labs/pi-fff@0.9.5",
      "npm:cc-safety-net@1.0.6",
    ]);
    expect(settings.skills).toBeUndefined();
  });

  it("resolves a package identity from any supported source spec", () => {
    expect(packageIdentity(`npm:${RETIRED_PACKAGE_NAME}@1.0.1`)).toBe(RETIRED_PACKAGE_NAME);
    expect(packageIdentity(`git:github.com/SomeoneElse/${RETIRED_PACKAGE_NAME}@0000000`)).toBe(
      RETIRED_PACKAGE_NAME,
    );
    expect(packageIdentity(`git:github.com/Michaelliv/${RETIRED_PACKAGE_NAME}@dbc6800`)).toBe(
      RETIRED_PACKAGE_NAME,
    );
    expect(packageIdentity("npm:@tintinweb/pi-subagents@0.12.0")).toBe("pi-subagents");
  });

  it("excludes the retired dynamic workflow package from every source", () => {
    const settings = readPiSettings();

    expect((settings.packages ?? []).map(packageIdentity)).not.toContain(RETIRED_PACKAGE_NAME);
  });
});
