import openshellPolicy from "agro-asset:.devcontainer/openshell-policy.yaml";
import type { AgroConfig } from "./agro-config.js";

export const EGRESS_PROXY_IMAGE =
  "ubuntu/squid@sha256:6a097f68bae708cedbabd6188d68c7e2e7a38cedd05a176e1cc0ba29e3bbe029";

export const EGRESS_SQUID_CONF = [
  "http_port 3128",
  "acl SSL_ports port 443",
  "acl Safe_ports port 80",
  "acl Safe_ports port 443",
  "acl CONNECT method CONNECT",
  'acl egress_allow dstdomain "/etc/squid/egress-allow.txt"',
  "http_access deny !Safe_ports",
  "http_access deny CONNECT !SSL_ports",
  "http_access allow egress_allow",
  "http_access deny all",
  "",
].join("\n");

export function policyHosts(policyText: string): string[] {
  const marker = "network_policies:";
  const start = policyText.indexOf(marker);
  const section = start === -1 ? "" : policyText.slice(start);
  const hosts = new Set<string>();
  for (const match of section.matchAll(/^\s*-\s*host:\s*(\S+)/gm)) hosts.add(match[1]);
  return [...hosts];
}

export function egressAllowHosts(config: AgroConfig): string[] {
  const hosts = new Set<string>(policyHosts(openshellPolicy));
  for (const host of config.access?.egressAllow ?? []) hosts.add(host);
  return [...hosts].sort();
}
