import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const devcontainer = resolve(import.meta.dirname, "../../../.devcontainer");
const composeFiles = readdirSync(devcontainer)
  .filter((f) => f.startsWith("docker-compose") && f.endsWith(".yml"))
  .sort();

const ALLOWED_CAPABILITIES = ["SYS_ADMIN"];

function read(file: string): string {
  return readFileSync(join(devcontainer, file), "utf8");
}

describe("sandbox privilege boundary", () => {
  it("finds the compose files it is meant to guard", () => {
    expect(composeFiles).toContain("docker-compose.yml");
    expect(composeFiles).toContain("docker-compose.image-only.yml");
  });

  it.each(composeFiles)("%s grants no blanket privilege", (file) => {
    const text = read(file);
    expect(text, "privileged: true is prohibited as a systemd shortcut").not.toMatch(/^\s*privileged:\s*true/m);
    expect(text, "the sandbox exposes no host device").not.toMatch(/^\s*devices:/m);
    expect(text, "the sandbox never binds the host cgroup tree").not.toMatch(/\/sys\/fs\/cgroup/);
    expect(text, "nothing may take PID 1 ahead of systemd").not.toMatch(/^\s*init:\s*true/m);
    expect(text, "nothing may wrap systemd").not.toMatch(/^\s*entrypoint:/m);
  });

  it.each(composeFiles)("%s adds no capability outside the allowlist", (file) => {
    const text = read(file);
    const blocks = [...text.matchAll(/^(\s*)cap_add:\s*\n((?:\1\s+-\s*\S+\n)+)/gm)];
    for (const [, , body] of blocks) {
      const granted = [...body.matchAll(/-\s*(\S+)/g)].map((m) => m[1]);
      expect(granted.sort()).toEqual([...ALLOWED_CAPABILITIES].sort());
    }
  });
});
