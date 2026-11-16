import {
  asRecord,
  asText,
  callApi,
  findKeyIdByIdentity,
  FREE_TIER_SPEC,
  toKeyList,
  type ConsoleAuthority,
  type ConsoleConfig,
  type ConsoleFetchDeps,
} from "../console-api.js";

export const LOCAL_SSH_KEY_MISSING = "no --ssh-key given and ~/.ssh/id_ed25519.pub not found";

export function parseCheck(tokens: string[]): { ok: true; sshKeyIds: string[] } | { ok: false; error: string } {
  const sshKeyIds: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const inline = token.startsWith("--ssh-key=") ? token.slice("--ssh-key=".length) : undefined;
    if (token !== "--ssh-key" && inline === undefined) {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: "--ssh-key requires a value" };
    sshKeyIds.push(value);
  }
  return { ok: true, sshKeyIds };
}

async function listSshKeys(
  deps: ConsoleFetchDeps,
  config: ConsoleConfig,
): Promise<{ ok: true; keys: Record<string, unknown>[] } | { ok: false; line: string }> {
  const listed = await callApi(deps, config, "GET", "/api/ssh-keys");
  return listed.ok
    ? { ok: true, keys: toKeyList(listed.body) }
    : { ok: false, line: `fail ssh-key: ${listed.message} — check the console login with agro auth status` };
}

async function checkSshKeyIds(deps: ConsoleFetchDeps, config: ConsoleConfig, sshKeyIds: string[]): Promise<string[]> {
  const listed = await listSshKeys(deps, config);
  if (!listed.ok) return [listed.line];
  const known = new Set(listed.keys.map((key) => asText(key.id)));
  return sshKeyIds.map((id) =>
    known.has(id)
      ? `ok ssh-key ${id}`
      : `fail ssh-key ${id}: not found in agro-console — pass the id of an SSH key in agro-console`,
  );
}

async function checkLocalSshKey(
  deps: ConsoleFetchDeps,
  config: ConsoleConfig,
  readLocalKey: () => string | undefined,
): Promise<string[]> {
  const publicKey = readLocalKey()?.trim();
  if (publicKey === undefined || publicKey === "") {
    return [`fail ssh-key: ${LOCAL_SSH_KEY_MISSING} — run ssh-keygen -t ed25519 or pass --ssh-key <uuid>`];
  }
  const listed = await listSshKeys(deps, config);
  if (!listed.ok) return [listed.line];
  const id = findKeyIdByIdentity(listed.keys, publicKey);
  return [
    id === null
      ? "fail ssh-key ~/.ssh/id_ed25519.pub: not registered in agro-console — add the key in agro-console or pass --ssh-key <uuid>"
      : `ok ssh-key ${id} ~/.ssh/id_ed25519.pub`,
  ];
}

async function checkConsole(deps: ConsoleFetchDeps, config: ConsoleConfig): Promise<string> {
  const listed = await callApi(deps, config, "GET", "/api/nodes");
  return listed.ok ? `ok console: ${config.url}` : `fail console: ${listed.message}`;
}

async function checkFreeTier(deps: ConsoleFetchDeps, config: ConsoleConfig): Promise<string> {
  const read = await callApi(deps, config, "GET", "/api/free-tier");
  if (!read.ok) {
    return read.status === 403 && /onboarding/i.test(read.message)
      ? `fail free-tier: ${read.message} — finish agro-console onboarding, or run agro auth login in the personal context`
      : `fail free-tier: ${read.message}`;
  }
  const body = asRecord(read.body);
  if (body?.eligible === true) return "ok free-tier";
  const code = asText(body?.code);
  const reason = asText(body?.reason) ?? asText(body?.message);
  const detail = [code, reason].filter((part) => part !== null).join(": ");
  return `warn free-tier: not eligible${detail === "" ? "" : ` (${detail})`} — the ${FREE_TIER_SPEC} fallback needs free tier eligibility; run agro auth login in the personal context`;
}

function formatUsd(micros: number): string {
  return `${micros < 0 ? "-" : ""}$${(Math.abs(micros) / 1_000_000).toFixed(2)}`;
}

async function checkCredit(deps: ConsoleFetchDeps, config: ConsoleConfig): Promise<string> {
  const read = await callApi(deps, config, "GET", "/api/billing/balance");
  if (!read.ok) return `warn credit: ${read.message}`;
  const body = asRecord(read.body);
  if (body?.paymentsEnabled === false) return "ok credit: payments are off";
  const micros = body?.balanceMicros;
  if (typeof micros !== "number") return "warn credit: the console reply holds no balance";
  const autoTopup = body?.autoTopup !== null && body?.autoTopup !== undefined;
  if (micros <= 0 && !autoTopup) {
    return `warn credit: no credit (balance ${formatUsd(micros)}) — top up at ${config.url}/billing`;
  }
  return `ok credit: balance ${formatUsd(micros)}${autoTopup ? ", auto top-up on" : ""}`;
}

export async function consoleCheckLines(
  deps: ConsoleFetchDeps,
  config: ConsoleConfig,
  authority: ConsoleAuthority,
  sshKeyIds: string[],
  readLocalKey: () => string | undefined,
): Promise<string[]> {
  if (authority === "brain") {
    const [console, keys] = await Promise.all([
      checkConsole(deps, config),
      sshKeyIds.length === 0 ? [] : checkSshKeyIds(deps, config, sshKeyIds),
    ]);
    return [console, ...keys];
  }
  const [keys, freeTier, credit] = await Promise.all([
    sshKeyIds.length === 0 ? checkLocalSshKey(deps, config, readLocalKey) : checkSshKeyIds(deps, config, sshKeyIds),
    checkFreeTier(deps, config),
    checkCredit(deps, config),
  ]);
  return [...keys, freeTier, credit];
}
