import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "../../..");
const devcontainer = join(root, ".devcontainer");
const composeFiles = readdirSync(devcontainer)
  .filter((f) => f.startsWith("docker-compose") && /\.ya?ml$/.test(f))
  .sort();
const serviceFiles = ["docker-compose.yml", "docker-compose.image-only.yml"];
const EGRESS_OVERLAY = "docker-compose.egress.yml";
const SQUID_IMAGE =
  "ubuntu/squid@sha256:6a097f68bae708cedbabd6188d68c7e2e7a38cedd05a176e1cc0ba29e3bbe029";
const EGRESS_PROXY_LITERALS = [
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "https_proxy",
  "http_proxy",
  "NO_PROXY",
  "no_proxy",
  "NODE_USE_ENV_PROXY",
];

const T3_PORT = "3773";
const PRE_CONTROL_PLANE_LITERALS = [
  "SANDBOX_PASSWORD",
  "CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS",
  "CC_SAFETY_NET_STRICT",
  "CC_SAFETY_NET_WORKTREE",
  "GH_TOKEN",
  "TYPESAFE_API_KEY",
  "XAI_API_KEY",
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
    expect(text, "the sandbox never runs privileged").not.toMatch(/^\s*privileged:\s*true/m);
    expect(text, "the sandbox exposes no host device").not.toMatch(/^\s*devices:/m);
    expect(text, "the sandbox never binds the host cgroup tree").not.toMatch(/\/sys\/fs\/cgroup/);
    expect(text, "the sandbox adds no capability").not.toMatch(/^\s*cap_add:/m);
    expect(text, "the sandbox keeps the default security profile").not.toMatch(/^\s*security_opt:/m);
    expect(text, "the sandbox keeps the default cgroup namespace").not.toMatch(/^\s*cgroup:/m);
  });

  it.each(composeFiles)("%s publishes no T3 Code port", (file) => {
    expect(blockEntries(read(file), "ports").filter((p) => p.includes(T3_PORT))).toEqual([]);
  });
});

describe("compose init", () => {
  it.each(serviceFiles)("%s runs sandbox-main.sh under Compose init", (file) => {
    const text = read(file);
    expect(text).toMatch(/^\s*init:\s*true\s*$/m);
    expect(text).toMatch(/^\s*entrypoint:\s*\["\/usr\/local\/bin\/sandbox-main\.sh"\]\s*$/m);
    expect(text).toMatch(/^\s*stop_signal:\s*SIGTERM\s*$/m);
  });
});

describe("VM image mode contract", () => {
  const dockerfile = readFileSync(join(devcontainer, "Dockerfile"), "utf8");

  it("boots /sbin/init as PID 1 with the container marker and systemd stop signal", () => {
    expect(dockerfile).toMatch(/^ENV container=docker$/m);
    expect(dockerfile).toMatch(/^STOPSIGNAL SIGRTMIN\+3$/m);
    expect(dockerfile).toMatch(/^ENTRYPOINT \[\]$/m);
    expect(dockerfile).toMatch(/^CMD \["\/sbin\/init"\]$/m);
    expect(dockerfile.match(/^ENTRYPOINT\b.*$/gm)).toEqual(["ENTRYPOINT []"]);
  });
});

describe("compose environment boundary", () => {
  const allowed = new Set([...renderedKeys(), ...PRE_CONTROL_PLANE_LITERALS]);

  it("derives the rendered key set from config-render.ts", () => {
    expect(allowed).toContain("SANDBOX_NAME");
  });

  it.each(composeFiles)("%s passes only rendered or pre-control-plane keys", (file) => {
    const proxyKeys = file === EGRESS_OVERLAY ? new Set(EGRESS_PROXY_LITERALS) : new Set<string>();
    const keys = environmentKeys(read(file)).filter((k) => !proxyKeys.has(k));
    expect(keys.filter((k) => k.startsWith("INSTALL_") || k === "AGRO_IMAGE_ONLY")).toEqual([]);
    expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
  });
});

describe("egress overlay", () => {
  type Service = Record<string, unknown> & { environment?: string[]; networks?: string[] };
  const overlay = (): {
    services: Record<string, Service>;
    networks: Record<string, Record<string, unknown> | null>;
  } => parse(read(EGRESS_OVERLAY));
  const PRIVILEGE_KEYS = ["privileged", "cap_add", "security_opt", "cgroup", "devices", "pid", "userns_mode", "network_mode"];

  it("is one of the guarded compose files", () => {
    expect(composeFiles).toContain(EGRESS_OVERLAY);
  });

  it("adds no privilege to the sandbox or the proxy", () => {
    const { services } = overlay();
    expect(Object.keys(services).sort()).toEqual(["proxy", "sandbox"]);
    for (const [name, service] of Object.entries(services)) {
      for (const key of PRIVILEGE_KEYS) expect(service, `${name}.${key}`).not.toHaveProperty(key);
    }
  });

  it("runs the pinned squid image as the proxy", () => {
    expect(overlay().services.proxy.image).toBe(SQUID_IMAGE);
  });

  it("puts the sandbox only on an internal network and the egress network only on the proxy", () => {
    const { services, networks } = overlay();
    const internal = Object.entries(networks).filter(([, n]) => n?.internal === true).map(([k]) => k);
    expect(internal).toHaveLength(1);
    expect(services.sandbox.networks).toEqual(internal);
    const egress = (services.proxy.networks ?? []).filter((n) => !internal.includes(n));
    expect(egress).toHaveLength(1);
    expect(networks[egress[0]]?.internal).not.toBe(true);
    expect(Object.keys(networks).sort()).toEqual([...internal, ...egress].sort());
  });

  it("routes every client through the proxy, Node.js fetch included", () => {
    const env = Object.fromEntries(
      (overlay().services.sandbox.environment ?? []).map((e) => [e.slice(0, e.indexOf("=")), e.slice(e.indexOf("=") + 1)]),
    );
    expect(Object.keys(env).sort()).toEqual([...EGRESS_PROXY_LITERALS].sort());
    for (const key of ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"]) {
      expect(env[key]).toBe("http://proxy:3128");
    }
    expect(env.NO_PROXY).toBe("localhost,127.0.0.1");
    expect(env.no_proxy).toBe("localhost,127.0.0.1");
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
  });

  it("denies every host the allowlist file does not name", () => {
    const text = read(EGRESS_OVERLAY);
    expect(text).toMatch(/acl egress_allow dstdomain "\/etc\/squid\/egress-allow\.txt"/);
    expect(text).toMatch(/http_access allow egress_allow\s+http_access deny all/);
  });
});

describe("sandbox password default", () => {
  it.each(serviceFiles)("%s passes SANDBOX_PASSWORD with no default value", (file) => {
    const text = read(file);
    expect(text).toContain("SANDBOX_PASSWORD=${SANDBOX_PASSWORD:-}");
  });
});

describe("build context", () => {
  it(".dockerignore keeps env files out of the build context", () => {
    const patterns = readFileSync(join(root, ".dockerignore"), "utf8").split("\n").map((l) => l.trim());
    expect(patterns.some((p) => /^(\*\*\/)?\.env\*?$/.test(p))).toBe(true);
  });
});
