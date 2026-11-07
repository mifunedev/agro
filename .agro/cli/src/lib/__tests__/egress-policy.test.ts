import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import openshellPolicy from "agro-asset:.devcontainer/openshell-policy.yaml";
import { EGRESS_PROXY_IMAGE, EGRESS_SQUID_CONF, egressAllowHosts, policyHosts } from "../egress-policy.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const EGRESS_COMPOSE = readFileSync(join(REPO_ROOT, ".devcontainer", "docker-compose.egress.yml"), "utf8");

function blockAfter(text: string, header: RegExp): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => header.test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const indent = lines[start].search(/\S/);
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    block.push(line);
  }
  return block;
}

function squidConfContent(): string {
  const config = blockAfter(EGRESS_COMPOSE, /^ {2}egress-squid:\s*$/);
  const content = blockAfter(config.join("\n"), /^\s*content:\s*\|\s*$/);
  while (content.length > 0 && content[content.length - 1].trim() === "") content.pop();
  const indent = content[0].search(/\S/);
  return content.map((line) => `${line.slice(indent)}\n`).join("");
}

function proxyImage(): string {
  const proxy = blockAfter(EGRESS_COMPOSE, /^ {2}proxy:\s*$/);
  const image = proxy.map((line) => /^\s*image:\s*(\S+)\s*$/.exec(line)).find(Boolean);
  expect(image).toBeTruthy();
  return image![1];
}

describe("egressAllowHosts", () => {
  it("returns the policy hosts when access.egressAllow is absent", () => {
    expect(egressAllowHosts({ version: 1 })).toEqual([...new Set(policyHosts(openshellPolicy))].sort());
  });

  it("adds access.egressAllow, de-duplicated and sorted", () => {
    const policy = policyHosts(openshellPolicy);
    expect(policy.length).toBeGreaterThan(0);
    const hosts = egressAllowHosts({
      version: 1,
      access: { egress: "allowlist", egressAllow: ["zzz.test", policy[0], "aaa.test", "zzz.test"] },
    });
    expect(hosts).toEqual([...new Set([...policy, "zzz.test", "aaa.test"])].sort());
    expect(hosts).toEqual([...new Set(hosts)]);
  });
});

describe("the egress proxy definition", () => {
  it("matches the egress-squid config content in docker-compose.egress.yml", () => {
    expect(EGRESS_SQUID_CONF).toBe(squidConfContent());
  });

  it("matches the proxy image digest in docker-compose.egress.yml", () => {
    expect(EGRESS_PROXY_IMAGE).toBe(proxyImage());
    expect(EGRESS_PROXY_IMAGE).toMatch(/@sha256:[0-9a-f]{64}$/);
  });
});
