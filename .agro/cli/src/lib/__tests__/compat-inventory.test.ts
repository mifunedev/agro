import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const INVENTORY = join(REPO_ROOT, ".agro", "compat-inventory.json");
const IDENTIFIER = /\bOH_[A-Z0-9_]*[A-Z0-9]\b/g;
const CLASSIFICATIONS = ["migrate-later", "alias-sla", "retained-generic", "obsolete"] as const;

interface Entry {
  classification: (typeof CLASSIFICATIONS)[number];
  phase?: number;
  owner?: string;
  agro?: string;
  note: string;
}

interface Inventory {
  version: number;
  classifications: Record<string, string>;
  variables: Record<string, Entry>;
  paths: Record<string, Entry>;
}

function inventory(): Inventory {
  return JSON.parse(readFileSync(INVENTORY, "utf8")) as Inventory;
}

function trackedFiles(): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return [...new Set(listed.split("\0"))].filter(
    (f) => f !== "" && !f.startsWith(".agro/tasks/") && f !== ".agro/compat-inventory.json",
  );
}

function identifiersInTree(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of trackedFiles()) {
    let text: string;
    try {
      text = readFileSync(join(REPO_ROOT, file), "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue;
    for (const match of text.matchAll(IDENTIFIER)) {
      const set = found.get(match[0]) ?? new Set<string>();
      set.add(file);
      found.set(match[0], set);
    }
  }
  return found;
}

describe("legacy contract inventory (.agro/compat-inventory.json)", () => {
  const doc = inventory();
  const found = identifiersInTree();

  it("uses only the four documented classifications and gives every entry a note", () => {
    expect(Object.keys(doc.classifications).sort()).toEqual([...CLASSIFICATIONS].sort());
    for (const [name, entry] of [...Object.entries(doc.variables), ...Object.entries(doc.paths)]) {
      expect(CLASSIFICATIONS, name).toContain(entry.classification);
      expect(entry.note.length, name).toBeGreaterThan(0);
      if (entry.classification === "migrate-later" || entry.classification === "alias-sla") {
        expect(entry.phase, `${name} needs an owning phase`).toBeTypeOf("number");
      }
    }
  });

  it("classifies every OH_* identifier present in tracked or untracked non-ignored files", () => {
    const missing = [...found.keys()].filter((id) => !(id in doc.variables)).sort();
    expect(missing, `uninventoried: ${missing.map((m) => `${m} (${[...found.get(m)!][0]})`).join(", ")}`).toEqual([]);
  });

  it("keeps no stale non-obsolete variable that the tree no longer mentions", () => {
    const stale = Object.entries(doc.variables)
      .filter(([name, entry]) => entry.classification !== "obsolete" && !found.has(name))
      .map(([name]) => name);
    expect(stale).toEqual([]);
  });

  it("records the AGRO spelling for every alias-sla variable", () => {
    for (const [name, entry] of Object.entries(doc.variables)) {
      if (entry.classification === "alias-sla") {
        expect(entry.agro, name).toMatch(/^AGRO_/);
        expect(entry.agro?.slice("AGRO_".length)).toBe(name.slice("OH_".length));
      }
    }
  });

  it("names the persisted legacy paths the epic lists, with ~/.openharness preserve-only", () => {
    for (const path of [".oh/", "oh.json", "~/.oh/sandboxes/", "~/.openharness", "/opt/oh-seed", ".oh/.image-seeded", "~/.config/openharness/cloud.json", "~/.local/share/oh/"]) {
      expect(doc.paths, path).toHaveProperty(path);
    }
    expect(doc.paths["~/.openharness"].classification).toBe("retained-generic");
    expect(doc.paths["~/.openharness"].note).toContain("Never registry content");
  });
});
