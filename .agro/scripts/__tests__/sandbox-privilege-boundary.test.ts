import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const devcontainer = join(root, ".devcontainer");
const composeFiles = readdirSync(devcontainer)
  .filter((f) => f.startsWith("docker-compose") && /\.ya?ml$/.test(f))
  .sort();
const serviceFiles = ["docker-compose.yml", "docker-compose.image-only.yml"];

const ALLOWED_CAPABILITIES = ["SYS_ADMIN"];
const T3_PORT = "3773";
const PRE_CONTROL_PLANE_LITERALS = [
  "SANDBOX_PASSWORD",
  "CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS",
  "CC_SAFETY_NET_STRICT",
  "CC_SAFETY_NET_WORKTREE",
  "GH_TOKEN",
  "TYPESAFE_API_KEY",
];

function read(file: string): string {
  return readFileSync(join(devcontainer, file), "utf8");
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function blockEntries(text: string, key: string): string[] {
  const lines = text.split("\n");
  const entries: string[] = [];
  lines.forEach((line, i) => {
    const header = line.match(new RegExp(`^(\\s*)${key}:\\s*$`));
    if (!header) return;
    const indent = header[1].length;
    for (const next of lines.slice(i + 1)) {
      if (next.trim() === "" || next.trimStart().startsWith("#")) continue;
      if (indentOf(next) <= indent) break;
      entries.push(next.trim().replace(/^-\s*/, ""));
    }
  });
  return entries;
}

function environmentKeys(text: string): string[] {
  return blockEntries(text, "environment").map((entry) => entry.replace(/[=:].*$/, "").trim());
}

function renderedKeys(): string[] {
  const render = readFileSync(join(root, ".agro/cli/src/lib/config-render.ts"), "utf8");
  return [...render.matchAll(/put\("([A-Z0-9_]+)"/g)].map((m) => m[1]);
}

describe("sandbox privilege boundary", () => {
  it("finds the compose files it is meant to guard", () => {
    expect(composeFiles).toEqual(expect.arrayContaining(serviceFiles));
  });

  it.each(composeFiles)("%s grants no blanket privilege", (file) => {
    const text = read(file);
    expect(text, "privileged: true is prohibited as a systemd shortcut").not.toMatch(/^\s*privileged:\s*true/m);
    expect(text, "the sandbox exposes no host device").not.toMatch(/^\s*devices:/m);
    expect(text, "the sandbox never binds the host cgroup tree").not.toMatch(/\/sys\/fs\/cgroup/);
    expect(text, "nothing may take PID 1 ahead of systemd").not.toMatch(/^\s*init:\s*true/m);
    expect(text, "nothing may wrap systemd").not.toMatch(/^\s*entrypoint:/m);
    expect(text, "systemd owns the container lifecycle").not.toMatch(/^\s*command:\s*sleep infinity/m);
  });

  it.each(composeFiles)("%s adds no capability outside the allowlist", (file) => {
    const text = read(file);
    expect(text, "declare capabilities as a block list").not.toMatch(/^\s*cap_add:\s*\[/m);
    for (const cap of blockEntries(text, "cap_add")) expect(ALLOWED_CAPABILITIES).toContain(cap);
  });

  it.each(composeFiles)("%s publishes no T3 Code port", (file) => {
    expect(blockEntries(read(file), "ports").filter((p) => p.includes(T3_PORT))).toEqual([]);
  });
});

describe("systemd sandbox init", () => {
  const dockerfile = readFileSync(join(devcontainer, "Dockerfile"), "utf8");

  it("boots /sbin/init as PID 1 with the container marker and systemd stop signal", () => {
    expect(dockerfile).toMatch(/^ENV container=docker$/m);
    expect(dockerfile).toMatch(/^STOPSIGNAL SIGRTMIN\+3$/m);
    expect(dockerfile).toMatch(/^ENTRYPOINT \[\]$/m);
    expect(dockerfile).toMatch(/^CMD \["\/sbin\/init"\]$/m);
    expect(dockerfile.match(/^ENTRYPOINT\b.*$/gm)).toEqual(["ENTRYPOINT []"]);
  });

  it.each(serviceFiles)("%s grants systemd the minimum cgroup access", (file) => {
    const text = read(file);
    expect(text).toMatch(/^\s*cgroup:\s*private\s*$/m);
    expect(blockEntries(text, "cap_add")).toEqual(["SYS_ADMIN"]);
    expect(blockEntries(text, "security_opt")).toContain("apparmor=unconfined");
    expect(blockEntries(text, "tmpfs")).toEqual(expect.arrayContaining(["/run", "/run/lock", "/sys/fs"]));
  });
});

describe("compose environment boundary", () => {
  const allowed = new Set([...renderedKeys(), ...PRE_CONTROL_PLANE_LITERALS]);

  it("derives the rendered key set from config-render.ts", () => {
    expect(allowed).toContain("SANDBOX_NAME");
  });

  it.each(composeFiles)("%s passes only rendered or pre-control-plane keys", (file) => {
    const keys = environmentKeys(read(file));
    expect(keys.filter((k) => k.startsWith("INSTALL_") || k === "AGRO_IMAGE_ONLY")).toEqual([]);
    expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
  });
});

describe("build context", () => {
  it(".dockerignore keeps env files out of the build context", () => {
    const patterns = readFileSync(join(root, ".dockerignore"), "utf8").split("\n").map((l) => l.trim());
    expect(patterns.some((p) => /^(\*\*\/)?\.env\*?$/.test(p))).toBe(true);
  });
});
