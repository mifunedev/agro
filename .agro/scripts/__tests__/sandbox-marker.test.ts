import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SANDBOX_MARKER_FILE } from "../../cli/src/lib/execution/detect.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dockerfile = readFileSync(path.join(repoRoot, ".devcontainer/Dockerfile"), "utf8");

function splitAtFinalStage(text: string): { before: string; final: string } {
  const start = text.search(/^FROM base AS final$/m);
  expect(start).toBeGreaterThan(-1);
  const rest = text.slice(start);
  const nextFrom = rest.slice(1).search(/^FROM /m);
  return { before: text.slice(0, start), final: nextFrom === -1 ? rest : rest.slice(0, nextFrom + 1) };
}

const escaped = SANDBOX_MARKER_FILE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const createsMarker = new RegExp(`(?::|touch|install\\b[^\\n]*)\\s*>?\\s*${escaped}(?![\\w/])`);

describe("sandbox marker in the image", () => {
  it("names the marker under /etc/agro", () => {
    expect(SANDBOX_MARKER_FILE).toBe("/etc/agro/sandbox");
  });

  it("creates the marker file in the final stage", () => {
    const { final } = splitAtFinalStage(dockerfile);
    expect(final).toMatch(createsMarker);
  });

  it("does not create the marker in an earlier stage", () => {
    const { before } = splitAtFinalStage(dockerfile);
    expect(before).not.toContain(SANDBOX_MARKER_FILE);
  });
});
