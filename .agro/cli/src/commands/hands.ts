import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDS_VERBS, isOneOf } from "../command-table.js";
import {
  NODE_READY_TIMEOUT_MS,
  nodePollDelayMs,
  present,
  trimConsoleUrl,
  type ConsoleConfig,
  type ConsoleIO,
  type ConsolePollDeps,
} from "../lib/console-api.js";
import { createConsoleProvider } from "../lib/hands/console-provider.js";
import type { Hand, HandProvider } from "../lib/hands/provider.js";
import { messageOf, spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import * as prompt from "../lib/prompt.js";

export { normalizeHandRef } from "../lib/hands/console-provider.js";

export const BRAIN_HOME = "/home/sandbox";
export const BRAIN_TOKEN_MISSING = `not on a brain: ${brainTokenPath(BRAIN_HOME)} not found`;

export const HAND_MISSING =
  "no <hand> given — an unquoted #<index> starts a shell comment; write the bare index (4) or quote '#4'";

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

function sshOptions(hand: Hand): string[] {
  return ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${hand.hostKeyAlias}`];
}

function gitEnv(deps: HandsDeps, hand: Hand): NodeJS.ProcessEnv {
  return { ...deps.env, GIT_SSH_COMMAND: ["ssh", ...sshOptions(hand)].join(" ") };
}

function runSsh(deps: HandsDeps, hand: Hand, sshDest: string, command: string): number {
  const result = deps.run("ssh", [...sshOptions(hand), "--", sshDest, command], { stdio: "inherit" });
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
  ${bin} hands fork <hand> [--spec <spec>] [--name <name>]
  ${bin} hands pause <hand>
  ${bin} hands resume <hand>
  ${bin} hands destroy <hand> [--yes]
  ${bin} hands exec <hand> [--project <owner>/<repo>] -- <command...>
  ${bin} hands fetch <hand> --project <owner>/<repo>

<hand> is an index (4), an alias, or a uuid.
Quote '#4' if you write the # sign: an unquoted #4 starts a shell comment.

\`create\` requests a sandbox hand, waits up to 15 minutes for it to reach
\`running\`, then prints its index, alias, and SSH host. \`destroy\` asks for
confirmation unless --yes is given.

\`fork\` copies a hand with its credentials. The fork takes the spec of the
source unless --spec is given. When the console names the fork, \`fork\`
waits for it like \`create\`. Otherwise, run \`${bin} hands list\` to find it.

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

function failed(io: HandsIO, prefix: string, error: string): number {
  io.stderr(`${prefix}: ${error}\n`);
  return 1;
}

function statusReporter(io: HandsIO, prefix: string): (hand: Hand) => void {
  return (hand) => io.stderr(`${prefix}: hand ${hand.id} ${hand.status}\n`);
}

function printRunning(io: HandsIO, hand: Hand): void {
  io.stdout(`index: ${hand.index ?? "-"}\nalias: ${hand.alias ?? "-"}\nssh host: ${hand.sshHost ?? "-"}\n`);
}

function oneHand(tokens: string[], allowed: string[]): { ok: true; ref: string } | { ok: false; error: string } {
  const flag = tokens.find((token) => token.startsWith("-") && !allowed.includes(token));
  if (flag !== undefined) return { ok: false, error: `unknown flag "${flag}"` };
  const refs = tokens.filter((token) => !token.startsWith("-"));
  if (refs.length === 0) return { ok: false, error: HAND_MISSING };
  if (refs.length !== 1) return { ok: false, error: "takes exactly one hand" };
  return { ok: true, ref: refs[0] };
}

async function runList(tokens: string[], io: HandsIO, provider: HandProvider, prefix: string) {
  const extra = tokens.find((token) => token !== "--json");
  if (extra !== undefined) {
    io.stderr(`${prefix}: ${extra.startsWith("-") ? "unknown flag" : "unexpected argument"} "${extra}"\n`);
    return 1;
  }
  const listed = await provider.list();
  if (!listed.ok) return failed(io, prefix, listed.error);
  const hands = listed.value;
  if (tokens.includes("--json")) {
    const rows = hands.map(({ id, index, alias, status, spec, sshHost }) => ({
      id,
      index: index === null ? null : Number(index),
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
      hand.index === null ? "-" : `#${hand.index}`,
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
  hand: Hand,
  sshDest: string,
  remote: string,
  slug: ProjectSlug,
  local: { path: string; branch: string },
): number {
  const folder = handProjectPath(slug);
  const prepared = runSsh(
    deps,
    hand,
    sshDest,
    `mkdir -p projects/${slug.owner} && git init -q -b ${shellQuote([local.branch])} ${folder} && git -C ${folder} config receive.denyCurrentBranch updateInstead`,
  );
  if (prepared !== 0) {
    io.stderr(`${prefix}: preparing ~/${folder} on hand ${hand.label} failed with status ${prepared}\n`);
    return prepared;
  }
  const added = deps.run("git", ["-C", local.path, "remote", "add", remote, `${sshDest}:${folder}`], {
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

async function runCreate(tokens: string[], io: HandsIO, deps: HandsDeps, provider: HandProvider, prefix: string) {
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
  const created = await provider.create({ name, spec }, statusReporter(io, prefix));
  if (!created.ok) return failed(io, prefix, created.error);
  const running = created.value;
  printRunning(io, running);
  const { sshDest, remoteName } = running;
  const slug = project ?? clone;
  if (slug === undefined) return 0;
  if (sshDest === null || remoteName === null) {
    io.stderr(`${prefix}: hand ${running.id} has no SSH host or index\n`);
    return 1;
  }
  io.stdout(`project: ~/${handProjectPath(slug)}\n`);
  if (local !== undefined) return pushProject(io, deps, prefix, running, sshDest, remoteName, slug, local);
  const cloned = runSsh(
    deps,
    running,
    sshDest,
    `mkdir -p projects/${slug.owner} && git clone -q https://github.com/${slug.owner}/${slug.repo}.git ${handProjectPath(slug)}`,
  );
  if (cloned !== 0) io.stderr(`${prefix}: git clone on hand ${running.label} failed with status ${cloned}\n`);
  return cloned;
}

async function resolveHand(
  provider: HandProvider,
  ref: string,
): Promise<{ ok: true; hand: Hand; sshDest: string } | { ok: false; error: string }> {
  const resolved = await provider.resolve(ref);
  if (!resolved.ok) return resolved;
  const hand = resolved.value;
  if (hand.sshDest === null) return { ok: false, error: `hand ${ref} has no SSH host (status ${hand.status})` };
  return { ok: true, hand, sshDest: hand.sshDest };
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

async function runExec(tokens: string[], io: HandsIO, deps: HandsDeps, provider: HandProvider, prefix: string) {
  const split = tokens.indexOf("--");
  const command = split === -1 ? [] : tokens.slice(split + 1);
  const parsed = parseHandProject(split === -1 ? tokens : tokens.slice(0, split));
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.ref === undefined) {
    io.stderr(`${prefix}: ${HAND_MISSING}\n`);
    return 1;
  }
  if (command.length === 0) {
    io.stderr(`${prefix}: usage: exec <hand> [--project <owner>/<repo>] -- <command...>\n`);
    return 1;
  }
  const resolved = await resolveHand(provider, parsed.ref);
  if (!resolved.ok) {
    io.stderr(`${prefix}: ${resolved.error}\n`);
    return 1;
  }
  const quoted = shellQuote(command);
  const remote = parsed.project === undefined ? quoted : `cd ${handProjectPath(parsed.project)} && ${quoted}`;
  return runSsh(deps, resolved.hand, resolved.sshDest, remote);
}

async function runFetch(tokens: string[], io: HandsIO, deps: HandsDeps, provider: HandProvider, prefix: string) {
  const parsed = parseHandProject(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.ref === undefined) {
    io.stderr(`${prefix}: ${HAND_MISSING}\n`);
    return 1;
  }
  if (parsed.project === undefined) {
    io.stderr(`${prefix}: usage: fetch <hand> --project <owner>/<repo>\n`);
    return 1;
  }
  const found = brainProject(deps, parsed.project);
  if (!found.ok) {
    io.stderr(`${prefix}: ${found.error}\n`);
    return 1;
  }
  const resolved = await resolveHand(provider, parsed.ref);
  if (!resolved.ok) {
    io.stderr(`${prefix}: ${resolved.error}\n`);
    return 1;
  }
  const remote = resolved.hand.remoteName;
  if (remote === null) {
    io.stderr(`${prefix}: hand ${parsed.ref} has no index\n`);
    return 1;
  }
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

interface ForkArgs {
  ref: string;
  spec?: string;
  name?: string;
}

function parseFork(tokens: string[]): { ok: true; args: ForkArgs } | { ok: false; error: string } {
  const refs: string[] = [];
  const values: { spec?: string; name?: string } = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("-")) {
      refs.push(token);
      continue;
    }
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (flag !== "--spec" && flag !== "--name") return { ok: false, error: `unknown flag "${token}"` };
    const value = inline ?? tokens[++i];
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    values[flag === "--spec" ? "spec" : "name"] = value;
  }
  if (refs.length === 0) return { ok: false, error: HAND_MISSING };
  if (refs.length !== 1) return { ok: false, error: "takes exactly one hand" };
  return { ok: true, args: { ref: refs[0], ...values } };
}

async function runFork(tokens: string[], io: HandsIO, provider: HandProvider, prefix: string) {
  const parsed = parseFork(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { ref, name, spec } = parsed.args;
  const forked = await provider.fork(ref, { name, spec }, statusReporter(io, prefix));
  if (!forked.ok) return failed(io, prefix, forked.error);
  const { hand, job } = forked.value;
  if (hand === undefined) {
    io.stdout(`fork of ${ref} requested${job === null ? "" : ` (job ${job})`}; run agro hands list to find the fork\n`);
    return 0;
  }
  printRunning(io, hand);
  return 0;
}

const ACTION_PAST = { pause: "paused", resume: "resumed" } as const;

async function runAction(
  verb: keyof typeof ACTION_PAST,
  tokens: string[],
  io: HandsIO,
  provider: HandProvider,
  prefix: string,
) {
  const parsed = oneHand(tokens, []);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const result = await provider[verb](parsed.ref);
  if (!result.ok) return failed(io, prefix, result.error);
  io.stdout(`${ACTION_PAST[verb]} ${parsed.ref}\n`);
  return 0;
}

async function runDestroy(tokens: string[], io: HandsIO, deps: HandsDeps, provider: HandProvider, prefix: string) {
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
  const deleted = await provider.destroy(ref);
  if (!deleted.ok) return failed(io, prefix, deleted.error);
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
  const provider = createConsoleProvider(deps, config);
  const prefix = `${bin} hands ${verb}`;
  if (verb === "list") return runList(rest, safe, provider, prefix);
  if (verb === "create") return runCreate(rest, safe, deps, provider, prefix);
  if (verb === "destroy") return runDestroy(rest, safe, deps, provider, prefix);
  if (verb === "fork") return runFork(rest, safe, provider, prefix);
  if (verb === "exec") return runExec(rest, safe, deps, provider, prefix);
  if (verb === "fetch") return runFetch(rest, safe, deps, provider, prefix);
  return runAction(verb, rest, safe, provider, prefix);
}
