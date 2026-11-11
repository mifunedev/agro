import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDS_VERBS, isOneOf } from "../command-table.js";
import {
  callApi,
  NODE_READY_TIMEOUT_MS,
  nodePollDelayMs,
  present,
  toNode,
  toNodeList,
  trimConsoleUrl,
  waitForRunning,
  type ApiResult,
  type ConsoleConfig,
  type ConsoleIO,
  type ConsoleNode,
  type ConsolePollDeps,
} from "../lib/console-api.js";
import { messageOf, spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import * as prompt from "../lib/prompt.js";

export const BRAIN_HOME = "/home/sandbox";
export const BRAIN_TOKEN_MISSING = `not on a brain: ${brainTokenPath(BRAIN_HOME)} not found`;

export type HandsIO = ConsoleIO;

export interface HandsDeps extends ConsolePollDeps {
  env: Record<string, string | undefined>;
  homeDir: () => string;
  readFile: (path: string) => string | undefined;
  confirm: (question: string) => Promise<boolean>;
  run: LifecycleRunner;
  exists: (path: string) => boolean;
}

export interface ProjectSlug {
  owner: string;
  repo: string;
}

type ConfigResult = { ok: true; config: ConsoleConfig } | { ok: false; error: string };

function brainTokenPath(home: string): string {
  return join(home, ".agro", "brain-token");
}

function brainConsoleUrlPath(home: string): string {
  return join(home, ".agro", "brain-console-url");
}

export function resolveBrainConsoleConfig(
  env: Record<string, string | undefined>,
  homeDir: () => string,
  readFile: (path: string) => string | undefined,
): ConfigResult {
  const envToken = present(env.AGRO_CONSOLE_TOKEN);
  const tokenPath = brainTokenPath(homeDir());
  const token = envToken ?? present(readFile(tokenPath));
  if (token === undefined) return { ok: false, error: `not on a brain: ${tokenPath} not found` };
  const urlPath = brainConsoleUrlPath(homeDir());
  const url = present(env.AGRO_CONSOLE_URL) ?? present(readFile(urlPath));
  if (url === undefined) {
    return { ok: false, error: `no brain console URL: ${urlPath} not found and AGRO_CONSOLE_URL is unset` };
  }
  return { ok: true, config: { url: trimConsoleUrl(url), token, source: envToken === undefined ? "file" : "env" } };
}

export function normalizeHandRef(ref: string): string {
  return ref.startsWith("#") ? ref.slice(1) : ref;
}

const SLUG_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseProjectSlug(value: string): ProjectSlug | undefined {
  const parts = value.split("/");
  if (parts.length !== 2 || !parts.every((part) => SLUG_PART.test(part))) return undefined;
  return { owner: parts[0], repo: parts[1] };
}

const SAFE_WORD = /^[A-Za-z0-9_\/.,:=@%+-]+$/;

export function shellQuote(words: string[]): string {
  return words.map((word) => (SAFE_WORD.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`)).join(" ");
}

function handProjectPath(slug: ProjectSlug): string {
  return `projects/${slug.owner}/${slug.repo}`;
}

function brainProjectPath(home: string, slug: ProjectSlug): string {
  return join(home, ".agro", "workspaces", "harness", "projects", slug.owner, slug.repo);
}

function handRemote(hand: ConsoleNode): string {
  return `hand-${hand.orgIndex}`;
}

function sshOptions(hand: ConsoleNode): string[] {
  return ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${hand.id}`];
}

function gitEnv(deps: HandsDeps, hand: ConsoleNode): NodeJS.ProcessEnv {
  return { ...deps.env, GIT_SSH_COMMAND: ["ssh", ...sshOptions(hand)].join(" ") };
}

function runSsh(deps: HandsDeps, hand: ConsoleNode, sshHost: string, command: string): number {
  const result = deps.run("ssh", [...sshOptions(hand), "--", `sandbox@${sshHost}`, command], { stdio: "inherit" });
  return result.status ?? 255;
}

function defaultDeps(): HandsDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    homeDir: () => BRAIN_HOME,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    pollDelayMs: nodePollDelayMs,
    timeoutMs: NODE_READY_TIMEOUT_MS,
    confirm: (question) => prompt.confirm(question, false),
    run: spawnRunner,
    exists: (path) => existsSync(path),
  };
}

export function handsHelp(bin: string): string {
  return `${bin} hands — Create and manage hands (sandbox nodes) from a brain

Usage:
  ${bin} hands list [--json]
  ${bin} hands create [--name <name>] [--spec <spec>] [--project <owner>/<repo> | --clone <owner>/<repo>]
  ${bin} hands fork <hand>
  ${bin} hands pause <hand>
  ${bin} hands resume <hand>
  ${bin} hands destroy <hand> [--yes]
  ${bin} hands exec <hand> [--project <owner>/<repo>] -- <command...>
  ${bin} hands fetch <hand> --project <owner>/<repo>

<hand> is #<index>, <index>, an alias, or a uuid. \`create\` requests a
sandbox hand, waits up to 15 minutes for it to reach \`running\`, then prints
its index, alias, and SSH host. \`destroy\` asks for confirmation unless
--yes is given.

A project lives at ~/projects/<owner>/<repo> on the hand and at
~/.agro/workspaces/harness/projects/<owner>/<repo> on the brain.
\`create --project\` prepares the hand folder, adds the remote hand-<index>
to the brain project, and pushes the current branch. \`create --clone\`
clones https://github.com/<owner>/<repo>.git on the hand with the hand's own
git credential. \`exec\` runs the command over SSH, in the project folder
with --project, and exits with its status. \`fetch\` runs
\`git fetch hand-<index>\` in the brain project. SSH connects to
sandbox@<sshHost> with the default brain key and pins each hand's host key
by its uuid.

The verbs read the brain token from ${brainTokenPath(BRAIN_HOME)} and the
console URL from ${brainConsoleUrlPath(BRAIN_HOME)}. AGRO_CONSOLE_TOKEN and
AGRO_CONSOLE_URL override them. Without a brain token, the verbs exit 2.
`;
}

function hiding(io: HandsIO, token: string): HandsIO {
  const hide = (s: string): string => s.split(token).join("[redacted]");
  return { stdout: (s) => io.stdout(hide(s)), stderr: (s) => io.stderr(hide(s)) };
}

function failed(io: HandsIO, prefix: string, result: ApiResult & { ok: false }): number {
  io.stderr(`${prefix}: ${result.message}\n`);
  return 1;
}

function handPath(ref: string): string {
  return `/api/nodes/${encodeURIComponent(normalizeHandRef(ref))}`;
}

function oneHand(tokens: string[], allowed: string[]): { ok: true; ref: string } | { ok: false; error: string } {
  const flag = tokens.find((token) => token.startsWith("-") && !allowed.includes(token));
  if (flag !== undefined) return { ok: false, error: `unknown flag "${flag}"` };
  const refs = tokens.filter((token) => !token.startsWith("-"));
  if (refs.length !== 1) return { ok: false, error: "takes exactly one hand" };
  return { ok: true, ref: refs[0] };
}

async function runList(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const extra = tokens.find((token) => token !== "--json");
  if (extra !== undefined) {
    io.stderr(`${prefix}: ${extra.startsWith("-") ? "unknown flag" : "unexpected argument"} "${extra}"\n`);
    return 1;
  }
  const listed = await callApi(deps, config, "GET", "/api/nodes");
  if (!listed.ok) return failed(io, prefix, listed);
  const hands = toNodeList(listed.body);
  if (tokens.includes("--json")) {
    const rows = hands.map(({ id, orgIndex, alias, status, spec, sshHost }) => ({
      id,
      index: orgIndex === null ? null : Number(orgIndex),
      alias,
      status,
      spec,
      sshHost,
    }));
    io.stdout(`${JSON.stringify(rows)}\n`);
    return 0;
  }
  if (hands.length === 0) {
    io.stdout("no hands\n");
    return 0;
  }
  const table = [
    ["INDEX", "ALIAS", "STATUS", "SPEC", "SSH HOST"],
    ...hands.map((hand) => [
      hand.orgIndex === null ? "-" : `#${hand.orgIndex}`,
      hand.alias ?? "-",
      hand.status,
      hand.spec ?? "-",
      hand.sshHost ?? "-",
    ]),
  ];
  const widths = table[0].map((_, column) => Math.max(...table.map((cells) => cells[column].length)));
  for (const cells of table) {
    io.stdout(`${cells.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()}\n`);
  }
  return 0;
}

interface CreateArgs {
  name?: string;
  spec?: string;
  project?: ProjectSlug;
  clone?: ProjectSlug;
}

function parseCreate(tokens: string[]): { ok: true; args: CreateArgs } | { ok: false; error: string } {
  const args: CreateArgs = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--name" && flag !== "--spec" && flag !== "--project" && flag !== "--clone") {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    if (flag === "--name") args.name = value;
    else if (flag === "--spec") args.spec = value;
    else {
      const slug = parseProjectSlug(value);
      if (slug === undefined) return { ok: false, error: `${flag} must be <owner>/<repo>` };
      args[flag === "--project" ? "project" : "clone"] = slug;
    }
  }
  if (args.project !== undefined && args.clone !== undefined) {
    return { ok: false, error: "--project and --clone exclude each other" };
  }
  return { ok: true, args };
}

function brainProject(deps: HandsDeps, slug: ProjectSlug): { ok: true; path: string } | { ok: false; error: string } {
  const path = brainProjectPath(deps.homeDir(), slug);
  return deps.exists(join(path, ".git"))
    ? { ok: true, path }
    : { ok: false, error: `brain project ${path} not found` };
}

function currentBranch(deps: HandsDeps, path: string): string | undefined {
  const result = deps.run("git", ["-C", path, "symbolic-ref", "--short", "-q", "HEAD"], { stdio: "capture" });
  const branch = result.stdout?.trim();
  return result.status === 0 && branch !== undefined && branch !== "" ? branch : undefined;
}

function pushProject(
  io: HandsIO,
  deps: HandsDeps,
  prefix: string,
  hand: ConsoleNode,
  sshHost: string,
  slug: ProjectSlug,
  local: { path: string; branch: string },
): number {
  const folder = handProjectPath(slug);
  const remote = handRemote(hand);
  const prepared = runSsh(
    deps,
    hand,
    sshHost,
    `mkdir -p projects/${slug.owner} && git init -q -b ${shellQuote([local.branch])} ${folder} && git -C ${folder} config receive.denyCurrentBranch updateInstead`,
  );
  if (prepared !== 0) {
    io.stderr(`${prefix}: preparing ~/${folder} on hand #${hand.orgIndex} failed with status ${prepared}\n`);
    return prepared;
  }
  const added = deps.run("git", ["-C", local.path, "remote", "add", remote, `sandbox@${sshHost}:${folder}`], {
    stdio: "capture",
  });
  if (added.status !== 0) {
    io.stderr(`${prefix}: git remote add ${remote} failed: ${added.stderr?.trim() || messageOf(added.error)}\n`);
    return added.status ?? 1;
  }
  const pushed = deps.run("git", ["-C", local.path, "push", remote, local.branch], {
    stdio: "inherit",
    env: gitEnv(deps, hand),
  });
  if (pushed.status !== 0) {
    io.stderr(`${prefix}: git push ${remote} ${local.branch} failed with status ${pushed.status ?? "none"}\n`);
    return pushed.status ?? 1;
  }
  io.stdout(`remote: ${remote}\n`);
  return 0;
}

async function runCreate(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const parsed = parseCreate(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { name, spec, project, clone } = parsed.args;
  let local: { path: string; branch: string } | undefined;
  if (project !== undefined) {
    const found = brainProject(deps, project);
    if (!found.ok) {
      io.stderr(`${prefix}: ${found.error}\n`);
      return 1;
    }
    const branch = currentBranch(deps, found.path);
    if (branch === undefined) {
      io.stderr(`${prefix}: brain project ${found.path} has no current branch\n`);
      return 1;
    }
    local = { path: found.path, branch };
  }
  const requestedAt = deps.now();
  const created = await callApi(deps, config, "POST", "/api/nodes", {
    profile: "sandbox",
    ...(name === undefined ? {} : { name }),
    ...(spec === undefined ? {} : { spec }),
  });
  if (!created.ok) return failed(io, prefix, created);
  const hand = toNode(created.body);
  if (hand === undefined) {
    io.stderr(`${prefix}: the console response has no node id\n`);
    return 1;
  }
  const report = (next: ConsoleNode) => io.stderr(`${prefix}: hand ${next.id} ${next.status}\n`);
  report(hand);
  const waited = await waitForRunning(deps, config, hand, requestedAt, report);
  if (!waited.ok) {
    const last = waited.node;
    if (waited.reason === "request") io.stderr(`${prefix}: hand ${last.id}: ${waited.message}\n`);
    else if (waited.reason === "timeout") {
      io.stderr(`${prefix}: hand ${last.id} is not running after 15 minutes — last status ${last.status}\n`);
    } else io.stderr(`${prefix}: hand ${last.id} failed — last status ${last.status}\n`);
    return 1;
  }
  const running = waited.node;
  const { orgIndex, alias, sshHost } = running;
  io.stdout(`index: ${orgIndex ?? "-"}\nalias: ${alias ?? "-"}\nssh host: ${sshHost ?? "-"}\n`);
  const slug = project ?? clone;
  if (slug === undefined) return 0;
  if (sshHost === null || orgIndex === null) {
    io.stderr(`${prefix}: hand ${running.id} has no SSH host or index\n`);
    return 1;
  }
  io.stdout(`project: ~/${handProjectPath(slug)}\n`);
  if (local !== undefined) return pushProject(io, deps, prefix, running, sshHost, slug, local);
  const cloned = runSsh(
    deps,
    running,
    sshHost,
    `mkdir -p projects/${slug.owner} && git clone -q https://github.com/${slug.owner}/${slug.repo}.git ${handProjectPath(slug)}`,
  );
  if (cloned !== 0) io.stderr(`${prefix}: git clone on hand #${orgIndex} failed with status ${cloned}\n`);
  return cloned;
}

async function resolveHand(
  deps: HandsDeps,
  config: ConsoleConfig,
  ref: string,
): Promise<{ ok: true; hand: ConsoleNode; sshHost: string } | { ok: false; error: string }> {
  const read = await callApi(deps, config, "GET", handPath(ref));
  if (!read.ok) return { ok: false, error: read.message };
  const hand = toNode(read.body);
  if (hand === undefined) return { ok: false, error: "the console response has no node id" };
  if (hand.sshHost === null) return { ok: false, error: `hand ${ref} has no SSH host (status ${hand.status})` };
  return { ok: true, hand, sshHost: hand.sshHost };
}

function parseHandProject(
  tokens: string[],
): { ok: true; ref?: string; project?: ProjectSlug } | { ok: false; error: string } {
  let ref: string | undefined;
  let project: ProjectSlug | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--project" || token.startsWith("--project=")) {
      const value = token === "--project" ? tokens[++i] : token.slice("--project=".length);
      const slug = value === undefined ? undefined : parseProjectSlug(value);
      if (slug === undefined) return { ok: false, error: "--project must be <owner>/<repo>" };
      project = slug;
    } else if (token.startsWith("-")) return { ok: false, error: `unknown flag "${token}"` };
    else if (ref === undefined) ref = token;
    else return { ok: false, error: `unexpected argument "${token}"` };
  }
  return { ok: true, ref, project };
}

async function runExec(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const split = tokens.indexOf("--");
  const command = split === -1 ? [] : tokens.slice(split + 1);
  const parsed = parseHandProject(split === -1 ? tokens : tokens.slice(0, split));
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.ref === undefined || command.length === 0) {
    io.stderr(`${prefix}: usage: exec <hand> [--project <owner>/<repo>] -- <command...>\n`);
    return 1;
  }
  const resolved = await resolveHand(deps, config, parsed.ref);
  if (!resolved.ok) {
    io.stderr(`${prefix}: ${resolved.error}\n`);
    return 1;
  }
  const quoted = shellQuote(command);
  const remote = parsed.project === undefined ? quoted : `cd ${handProjectPath(parsed.project)} && ${quoted}`;
  return runSsh(deps, resolved.hand, resolved.sshHost, remote);
}

async function runFetch(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const parsed = parseHandProject(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.ref === undefined || parsed.project === undefined) {
    io.stderr(`${prefix}: usage: fetch <hand> --project <owner>/<repo>\n`);
    return 1;
  }
  const found = brainProject(deps, parsed.project);
  if (!found.ok) {
    io.stderr(`${prefix}: ${found.error}\n`);
    return 1;
  }
  const resolved = await resolveHand(deps, config, parsed.ref);
  if (!resolved.ok) {
    io.stderr(`${prefix}: ${resolved.error}\n`);
    return 1;
  }
  if (resolved.hand.orgIndex === null) {
    io.stderr(`${prefix}: hand ${parsed.ref} has no index\n`);
    return 1;
  }
  const remote = handRemote(resolved.hand);
  const fetched = deps.run("git", ["-C", found.path, "fetch", remote], {
    stdio: "inherit",
    env: gitEnv(deps, resolved.hand),
  });
  if (fetched.status !== 0) {
    io.stderr(`${prefix}: git fetch ${remote} failed with status ${fetched.status ?? "none"}\n`);
    return fetched.status ?? 1;
  }
  return 0;
}

const ACTION_PAST = { fork: "forked", pause: "paused", resume: "resumed" } as const;

async function runAction(
  verb: keyof typeof ACTION_PAST,
  tokens: string[],
  io: HandsIO,
  deps: HandsDeps,
  config: ConsoleConfig,
  prefix: string,
) {
  const parsed = oneHand(tokens, []);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const result = await callApi(deps, config, "POST", `${handPath(parsed.ref)}/${verb}`);
  if (!result.ok) return failed(io, prefix, result);
  const node = toNode(result.body);
  const detail = verb === "fork" && node !== undefined ? `: ${node.id} ${node.status}` : "";
  io.stdout(`${ACTION_PAST[verb]} ${parsed.ref}${detail}\n`);
  return 0;
}

async function runDestroy(tokens: string[], io: HandsIO, deps: HandsDeps, config: ConsoleConfig, prefix: string) {
  const parsed = oneHand(tokens, ["--yes", "-y"]);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { ref } = parsed;
  const yes = tokens.includes("--yes") || tokens.includes("-y");
  if (!yes && !(await deps.confirm(`Destroy hand ${ref}?`))) {
    io.stderr(`${prefix}: aborted — hand ${ref} unchanged\n`);
    return 1;
  }
  const deleted = await callApi(deps, config, "DELETE", handPath(ref));
  if (!deleted.ok) return failed(io, prefix, deleted);
  io.stdout(`destroyed ${ref}\n`);
  return 0;
}

export async function runHands(
  args: string[],
  io: HandsIO,
  overrides: Partial<HandsDeps> = {},
  bin = "agro",
): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === "--help" || verb === "-h" || verb === "help") {
    io.stdout(handsHelp(bin));
    return verb === undefined ? 1 : 0;
  }
  if (!isOneOf(HANDS_VERBS, verb)) {
    io.stderr(`${bin} hands: unknown subcommand "${verb}" — expected ${HANDS_VERBS.join(", ")}\n`);
    return 1;
  }
  const options = rest.includes("--") ? rest.slice(0, rest.indexOf("--")) : rest;
  if (options.some((token) => token === "--help" || token === "-h")) {
    io.stdout(handsHelp(bin));
    return 0;
  }
  const deps = { ...defaultDeps(), ...overrides };
  const resolved = resolveBrainConsoleConfig(deps.env, deps.homeDir, deps.readFile);
  if (!resolved.ok) {
    io.stderr(`${resolved.error}\n`);
    return 2;
  }
  const { config } = resolved;
  const safe = hiding(io, config.token);
  const prefix = `${bin} hands ${verb}`;
  if (verb === "list") return runList(rest, safe, deps, config, prefix);
  if (verb === "create") return runCreate(rest, safe, deps, config, prefix);
  if (verb === "destroy") return runDestroy(rest, safe, deps, config, prefix);
  if (verb === "exec") return runExec(rest, safe, deps, config, prefix);
  if (verb === "fetch") return runFetch(rest, safe, deps, config, prefix);
  return runAction(verb, rest, safe, deps, config, prefix);
}
