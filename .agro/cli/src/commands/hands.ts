import { existsSync, readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { HANDS_VERBS, isOneOf } from "../command-table.js";
import {
  brainConsoleUrlPath,
  brainTokenPath,
  confirmDestroy,
  DEFAULT_CONSOLE_URL,
  formatTable,
  NODE_READY_TIMEOUT_MS,
  nodePollDelayMs,
  resolveHandsConsoleConfig,
  type ConsoleAuthority,
  type ConsoleConfig,
  type ConsoleIO,
  type ConsolePollDeps,
} from "../lib/console-api.js";
import { readConsoleCredentials, type ConsoleCredentials } from "../lib/console-auth.js";
import { consoleCheckLines, parseCheck } from "../lib/hands/console-check.js";
import {
  createConsoleProvider,
  type ConsoleHandRequest,
  type DesktopState,
  type DesktopWait,
  type LocalSshKey,
} from "../lib/hands/console-provider.js";
import { createExedevProvider, exedevPreflight, HAND_TAG } from "../lib/hands/exedev-provider.js";
import {
  brainHarnessRoot,
  HAND_PROFILES,
  type HandProfile,
  resolveHandProviderId,
  retiredHandsNotice,
  shellQuote,
  type Hand,
  type HandOutcome,
  type HandProvider,
} from "../lib/hands/provider.js";
import { DOCKERENV_FILE, SANDBOX_MARKER_FILE } from "../lib/execution/detect.js";
import { messageOf, spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import * as prompt from "../lib/prompt.js";
import type { HandProviderId } from "../lib/host-config.js";

export { normalizeHandRef } from "../lib/hands/console-provider.js";
export { resolveHandsConsoleConfig } from "../lib/console-api.js";
export { shellQuote } from "../lib/hands/provider.js";

export const BRAIN_HOME = "/home/sandbox";
export const CONSOLE_TOKEN_MISSING = `no console token: ${brainTokenPath(BRAIN_HOME)} not found and no agro auth login credentials; run agro auth login`;

const CONSOLE_ONLY_CREATE_FLAGS = [
  "--spec",
  "--disposable",
  "--profile",
  "--docker",
  "--t3",
  "--code-server",
  "--desktop",
  "--ssh-key",
  "--json",
  "--count",
] as const;
const APP_FLAGS = ["--docker", "--t3", "--code-server"] as const;

export const HAND_MISSING =
  "no <hand> given — an unquoted #<index> starts a shell comment; write the bare index (4) or quote '#4'";

export type HandsIO = ConsoleIO;

const RDP_PORT = 3389;
const DESKTOP_READY_TIMEOUT_MS = 120 * 1000;
const DESKTOP_POLL_INTERVAL_MS = 5000;
const MAX_COUNT = 10;
const COUNT_PATTERN = /^[1-9]\d*$/;
const COUNT_RANGE_ERROR = `--count must be an integer from 1 to ${MAX_COUNT}`;

type AwaitDesktop = (id: string, wait: DesktopWait) => Promise<DesktopState>;

export interface HandsDeps extends ConsolePollDeps {
  env: Record<string, string | undefined>;
  homeDir: () => string;
  userHome: () => string;
  readFile: (path: string) => string | undefined;
  readCredentials: () => ConsoleCredentials | undefined;
  confirm: (question: string) => Promise<boolean>;
  run: LifecycleRunner;
  exists: (path: string) => boolean;
  hostname: () => string;
  inContainer: () => boolean;
  desktopPollMs: number;
  desktopTimeoutMs: number;
}

export interface ProjectSlug {
  owner: string;
  repo: string;
}

const SLUG_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseProjectSlug(value: string): ProjectSlug | undefined {
  const parts = value.split("/");
  if (parts.length !== 2 || !parts.every((part) => SLUG_PART.test(part))) return undefined;
  return { owner: parts[0], repo: parts[1] };
}

function handProjectPath(slug: ProjectSlug): string {
  return `projects/${slug.owner}/${slug.repo}`;
}

function brainProjectPath(deps: HandsDeps, slug: ProjectSlug): string {
  return join(brainHarnessRoot(deps.env, deps.userHome()), "projects", slug.owner, slug.repo);
}

function sshOptions(hand: Hand): string[] {
  return ["-o", "StrictHostKeyChecking=accept-new", "-o", `HostKeyAlias=${hand.hostKeyAlias}`];
}

function gitEnv(deps: HandsDeps, hand: Hand): NodeJS.ProcessEnv {
  return { ...deps.env, GIT_SSH_COMMAND: ["ssh", ...sshOptions(hand)].join(" ") };
}

function runSsh(deps: HandsDeps, provider: HandProvider, hand: Hand, sshDest: string, command: string): number {
  const remote = provider.remoteCommand(command);
  const result = deps.run("ssh", [...sshOptions(hand), "--", sshDest, remote], { stdio: "inherit" });
  return result.status ?? 255;
}

function defaultDeps(): HandsDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    env: process.env,
    homeDir: () => BRAIN_HOME,
    userHome: homedir,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    readCredentials: () => readConsoleCredentials(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    pollDelayMs: nodePollDelayMs,
    timeoutMs: NODE_READY_TIMEOUT_MS,
    confirm: (question) => prompt.confirm(question, false),
    run: spawnRunner,
    exists: (path) => existsSync(path),
    hostname: () => hostname(),
    inContainer: () => existsSync(DOCKERENV_FILE) || existsSync(SANDBOX_MARKER_FILE),
    desktopPollMs: DESKTOP_POLL_INTERVAL_MS,
    desktopTimeoutMs: DESKTOP_READY_TIMEOUT_MS,
  };
}

export function handsHelp(bin: string): string {
  return `${bin} hands — Create and manage hands and console VMs from a brain or an operator host

Usage:
  ${bin} hands list [--json]
  ${bin} hands create [--name <name>] [--spec <spec>] [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--disposable] [--desktop] [--ssh-key <uuid>]... [--json] [--project <owner>/<repo> | --clone <owner>/<repo>]
  ${bin} hands fork <hand> [--spec <spec>] [--name <name>]
  ${bin} hands pause <hand>
  ${bin} hands resume <hand>
  ${bin} hands destroy <hand> [--yes]
  ${bin} hands exec <hand> [--project <owner>/<repo>] -- <command...>
  ${bin} hands fetch <hand> --project <owner>/<repo>
  ${bin} hands check [--ssh-key <uuid>]...

Providers:
  \`hands.provider\` in the host config \${AGRO_HOME:-~/.agro}/config.json
  selects the provider: \`console\` (the default) or \`exedev\`.
  Run \`${bin} config set hands.provider exedev\` to select exe.dev hands.
  \`--provider console|exedev\` selects the provider for one call and
  overrides \`hands.provider\`. Put it before or after the verb.

Authority:
  Console hands run with brain authority or operator authority.
  \`--operator\` selects operator authority. Put it before or after the verb.
  \`--operator\` applies only to console hands.

  With \`--operator\`, the verbs read the token and the URL like
  \`${bin} auth\`: AGRO_CONSOLE_TOKEN, then the credentials that
  \`${bin} auth login\` writes. The URL is AGRO_CONSOLE_URL with the env
  token, else the credentials URL, else ${DEFAULT_CONSOLE_URL}. The verbs
  ignore the brain token. Without a token, the verbs exit 2.

  Without \`--operator\`, AGRO_CONSOLE_TOKEN gives brain authority. Else the
  brain token ${brainTokenPath(BRAIN_HOME)} gives brain authority. With brain
  authority, the URL is AGRO_CONSOLE_URL, else
  ${brainConsoleUrlPath(BRAIN_HOME)}. Else the credentials that
  \`${bin} auth login\` writes give operator authority. The URL is the
  credentials URL, else ${DEFAULT_CONSOLE_URL}. Without a token, the verbs
  exit 2.

Console hands:
<hand> is an index (4), an alias, or a uuid.
Quote '#4' if you write the # sign: an unquoted #4 starts a shell comment.

\`create\` requests a sandbox hand, waits up to 15 minutes for it to reach
\`running\`, then prints its index, alias, and SSH host. When the free tier
does not offer the requested spec, \`create\` creates \`n4\` and says so.
\`destroy\` asks for confirmation unless --yes is given. \`destroy\` needs the
admin role in agro-console.

\`--profile\` sets the hand profile. The profile defaults to sandbox.
\`--docker\` turns on Docker. \`--t3\` turns on T3. \`--code-server\` turns on
code-server. Each app flag requires \`--profile agro\`. \`--ssh-key <uuid>\`
adds a console SSH key to the hand. Repeat it for more keys. Without
\`--ssh-key\` and with operator authority, \`create\` finds
~/.ssh/id_ed25519.pub in the console SSH keys, or registers it as
agro-cli@<host name>, and sends its id. When the file does not exist,
\`create\` exits 1 and creates no hand. With brain authority, \`create\`
sends only the \`--ssh-key\` ids.

\`--desktop\` adds the desktop tool to the hand. It applies to both profiles.
With \`--docker\`, \`create\` sends the tools docker and desktop. The desktop
needs at least \`n4\`: the console refuses a smaller spec with HTTP 422
SPEC_TOO_SMALL_FOR_TOOL, and HTTP 503 DESKTOP_IMAGE_UNAVAILABLE when the
region has no desktop image. After \`running\`, \`create\` waits up to 120
seconds for rdpListening. If xrdp does not listen or the hand leaves
running, \`create\` prints a warning and exits 0. \`create\` then prints a
desktop line and the next steps, also when the project placement fails, and
exits with the placement status. The next steps: \`tailscale up\` and
\`sudo passwd sandbox\` on the hand, then the .rdp file from the Connect
card of the hand in the console. With \`--json\`,
the line adds desktop with rdpListening, tailnetName, and rdpAddress
(<tailnet name or address>:${RDP_PORT} when xrdp listens, else null).

\`--json\` prints one JSON line with id, index, alias, name, status, spec,
sshHost, and ssh. The ssh field is null unless the status is running.
When the console returns a hand id and the wait then fails,
\`create --json\` prints the line with the last status and exits 1.
\`--json\` excludes --project and --clone.

\`create --disposable\` requests a disposable hand with no data volume.
--disposable applies only to console hands. Only a sandbox-profile hand can
be disposable: the console refuses \`--profile agro --disposable\` with
HTTP 422 DISPOSABLE_PROFILE_UNSUPPORTED. On a disposable hand, \`pause\`,
\`resume\`, and \`fork\` exit 1 when the console returns
HTTP 409 NODE_DISPOSABLE. Delete the hand with \`${bin} hands destroy <hand>\`.
The platform deletes a running disposable hand at the end of the
credit grace window after the low-balance email, or at the end of the
free-tier allowance.

\`fork\` copies a hand with its credentials. The fork takes the spec of the
source unless --spec is given. When the console names the fork, \`fork\`
waits for it like \`create\`. Otherwise, run \`${bin} hands list\` to find it.

\`check\` applies only to console hands. It sends only GET requests and
creates nothing. \`check\` prints one line for each check and exits 0 only
when no line starts with \`fail \`.

With brain authority, \`check\` reads /api/nodes for the console line. It
finds each \`--ssh-key\` id in the console SSH keys.

With operator authority, \`check\` finds each \`--ssh-key\` id in the console
SSH keys. Without \`--ssh-key\`, it finds ~/.ssh/id_ed25519.pub there. It
reads the free tier eligibility. It reads the org credit from
/api/billing/balance for the credit line. An account outside the free tier
gets a warn line. The credit line is ok or warn and never changes the exit
status.

exe.dev hands:
<hand> is an exe.dev VM name. A hand is a VM with the tag ${HAND_TAG}.
\`list\` shows only tagged VMs. Enroll an existing VM with
\`ssh exe.dev tag <vm> ${HAND_TAG}\`. The verbs run \`ssh exe.dev\` with the
brain SSH key and exit 2 when \`ssh exe.dev whoami\` fails.

\`create\` runs \`ssh exe.dev new --json --name <name> --tag ${HAND_TAG}\`,
waits up to 15 minutes for the VM to reach \`running\`, then prints its name
and SSH host. \`fork\` runs \`ssh exe.dev cp <hand> [<name>] --copy-tags\`.
\`pause\`, \`resume\`, and \`destroy\` run \`ssh exe.dev pause\`, \`resume\`,
and \`rm\`. \`destroy\` asks for confirmation unless --yes is given.
--spec, --disposable, --profile, --docker, --t3, --code-server, --desktop,
--ssh-key, and --json apply only to console hands.

Guards: \`fork\`, \`pause\`, \`resume\`, and \`destroy\` exit 1 without a
change when the VM lacks the ${HAND_TAG} tag. Each write verb exits 1 without a
change when <hand>, the fork name, or the create name names this brain. The
brain is the VM whose name or SSH host label equals the host name. Inside a
container, \`fork\`, \`pause\`, \`resume\`, and \`destroy\` exit 1 when the host
name matches no VM; run them from the brain host.

Projects:
A project lives at ~/projects/<owner>/<repo> on the hand and at
<harness-root>/projects/<owner>/<repo> on the brain. The harness root is
\`harnessRoot\` in ~/.agro/config.json, else ~/.agro/workspaces/harness.
\`create --project\` prepares the hand folder, adds the remote hand-<index>
(hand-<name> for exe.dev hands) to the brain project, and pushes the current
branch. \`create --clone\` clones https://github.com/<owner>/<repo>.git on the
hand with the hand's own git credential. \`exec\` runs the command over SSH,
in the project folder with --project, and exits with its status. \`fetch\`
runs \`git fetch hand-<index>\` in the brain project. SSH connects to
sandbox@<sshHost> for console hands and to <vm>.exe.xyz in a login shell for
exe.dev hands, with the default brain key, and pins each hand's host key by
its uuid or VM name.
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

function printRunning(io: HandsIO, hand: Hand, providerId: HandProviderId): void {
  if (providerId === "exedev") {
    io.stdout(`name: ${hand.id}\nssh host: ${hand.sshHost ?? "-"}\n`);
    return;
  }
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

async function runList(
  tokens: string[],
  io: HandsIO,
  providerId: HandProviderId,
  provider: HandProvider,
  prefix: string,
) {
  const extra = tokens.find((token) => token !== "--json");
  if (extra !== undefined) {
    io.stderr(`${prefix}: ${extra.startsWith("-") ? "unknown flag" : "unexpected argument"} "${extra}"\n`);
    return 1;
  }
  const listed = await provider.list();
  if (!listed.ok) return failed(io, prefix, listed.error);
  const hands = listed.value;
  if (providerId === "exedev") return printExedevList(io, hands, tokens.includes("--json"));
  if (tokens.includes("--json")) {
    const rows = hands.map(({ id, index, alias, name, profile, status, spec, sshHost }) => ({
      id,
      index: index === null ? null : Number(index),
      alias,
      name,
      profile,
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
  io.stdout(
    formatTable(
      ["INDEX", "ALIAS", "STATUS", "SPEC", "SSH HOST"],
      hands.map((hand) => [
        hand.index === null ? "-" : `#${hand.index}`,
        hand.alias ?? "-",
        hand.status,
        hand.spec ?? "-",
        hand.sshHost ?? "-",
      ]),
    ),
  );
  return 0;
}

function printExedevList(io: HandsIO, hands: Hand[], json: boolean): number {
  if (json) {
    io.stdout(`${JSON.stringify(hands.map(({ id, status, sshHost }) => ({ name: id, status, sshHost })))}\n`);
    return 0;
  }
  io.stdout(
    hands.length === 0
      ? "no hands\n"
      : formatTable(["NAME", "STATUS", "SSH HOST"], hands.map((hand) => [hand.id, hand.status, hand.sshHost ?? "-"])),
  );
  return 0;
}

interface CreateArgs {
  name?: string;
  spec?: string;
  project?: ProjectSlug;
  clone?: ProjectSlug;
  disposable?: boolean;
  desktop: boolean;
  profile?: HandProfile;
  apps: Set<(typeof APP_FLAGS)[number]>;
  sshKeyIds: string[];
  json: boolean;
  count: number;
}

const VALUE_FLAGS = ["--name", "--spec", "--project", "--clone", "--profile", "--ssh-key", "--count"] as const;

function parseCount(value: string | undefined): number | undefined {
  if (value === undefined || !COUNT_PATTERN.test(value)) return undefined;
  const count = Number(value);
  return count <= MAX_COUNT ? count : undefined;
}

function parseCreate(tokens: string[]): { ok: true; args: CreateArgs } | { ok: false; error: string } {
  const args: CreateArgs = { apps: new Set(), sshKeyIds: [], json: false, desktop: false, count: 1 };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--disposable") {
      args.disposable = true;
      continue;
    }
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--desktop") {
      args.desktop = true;
      continue;
    }
    if (isOneOf(APP_FLAGS, token)) {
      args.apps.add(token);
      continue;
    }
    const [flag, inline] = token.startsWith("--") && token.includes("=")
      ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
      : [token, undefined];
    if (!isOneOf(VALUE_FLAGS, flag)) {
      return { ok: false, error: token.startsWith("-") ? `unknown flag "${token}"` : `unexpected argument "${token}"` };
    }
    const value = inline ?? tokens[++i];
    if (flag === "--count") {
      const count = parseCount(value);
      if (count === undefined) return { ok: false, error: COUNT_RANGE_ERROR };
      args.count = count;
      continue;
    }
    if (value === undefined || value === "") return { ok: false, error: `${flag} requires a value` };
    if (flag === "--name") args.name = value;
    else if (flag === "--spec") args.spec = value;
    else if (flag === "--ssh-key") args.sshKeyIds.push(value);
    else if (flag === "--profile") {
      if (!isOneOf(HAND_PROFILES, value)) return { ok: false, error: "--profile must be agro or sandbox" };
      args.profile = value;
    } else {
      const slug = parseProjectSlug(value);
      if (slug === undefined) return { ok: false, error: `${flag} must be <owner>/<repo>` };
      args[flag === "--project" ? "project" : "clone"] = slug;
    }
  }
  if (args.project !== undefined && args.clone !== undefined) {
    return { ok: false, error: "--project and --clone exclude each other" };
  }
  if (args.json && (args.project !== undefined || args.clone !== undefined)) {
    return { ok: false, error: "--json excludes --project and --clone" };
  }
  if (args.count > 1 && (args.project !== undefined || args.clone !== undefined)) {
    return { ok: false, error: "--count excludes --project and --clone" };
  }
  const sandboxApp = APP_FLAGS.find((flag) => args.profile !== "agro" && args.apps.has(flag));
  if (sandboxApp !== undefined) return { ok: false, error: `${sandboxApp} requires --profile agro` };
  return { ok: true, args };
}

function rdpAddress(state: DesktopState): string | null {
  const host = state.tailnetName ?? state.tailnetAddress;
  return !state.rdpListening || host === null ? null : `${host}:${RDP_PORT}`;
}

const DESKTOP_NEXT_STEPS =
  "next: tailscale up\n" +
  "next: sudo passwd sandbox\n" +
  "next: open the Connect card of the hand in the console and download the .rdp file\n";

function printDesktop(io: HandsIO, hand: Hand, state: DesktopState): void {
  const address = rdpAddress(state);
  io.stdout(
    `desktop: ${state.rdpListening ? `xrdp listening${address === null ? "" : ` on ${address}`}` : "xrdp not listening"}\n` +
      (hand.sshDest === null ? "" : `next: ssh ${hand.sshDest}\n`) +
      DESKTOP_NEXT_STEPS,
  );
}

function createdLine(hand: Hand, desktop?: DesktopState): string {
  return `${JSON.stringify({
    id: hand.id,
    index: hand.index === null ? null : Number(hand.index),
    alias: hand.alias,
    name: hand.name,
    status: hand.status,
    spec: hand.spec,
    sshHost: hand.sshHost,
    ssh: hand.status === "running" && hand.sshDest !== null ? `ssh ${hand.sshDest}` : null,
    ...(desktop === undefined
      ? {}
      : { desktop: { rdpListening: desktop.rdpListening, tailnetName: desktop.tailnetName, rdpAddress: rdpAddress(desktop) } }),
  })}\n`;
}

function brainProject(deps: HandsDeps, slug: ProjectSlug): { ok: true; path: string } | { ok: false; error: string } {
  const path = brainProjectPath(deps, slug);
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
  provider: HandProvider,
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
    provider,
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

async function runCreate(
  tokens: string[],
  io: HandsIO,
  deps: HandsDeps,
  providerId: HandProviderId,
  provider: HandProvider,
  prefix: string,
  awaitDesktop: AwaitDesktop | undefined,
) {
  const parsed = parseCreate(tokens);
  if (!parsed.ok) {
    io.stderr(`${prefix}: ${parsed.error}\n`);
    return 1;
  }
  const { name, spec, project, clone, disposable, desktop, profile, apps, sshKeyIds, json, count } = parsed.args;
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
  const report = statusReporter(io, prefix);
  let last: Hand | undefined;
  const request = {
    name,
    spec,
    disposable,
    profile,
    docker: apps.has("--docker"),
    t3: apps.has("--t3"),
    codeServer: apps.has("--code-server"),
    desktop,
    sshKeyIds,
  };
  if (count > 1) {
    const desktopWait = desktop ? awaitDesktop : undefined;
    return createMany(io, deps, provider, prefix, request, count, desktopWait, json);
  }
  const created = await provider.create(request, (hand) => {
    last = hand;
    report(hand);
  });
  if (!created.ok) {
    if (json && last !== undefined) io.stdout(createdLine(last));
    return failed(io, prefix, created.error);
  }
  const running = created.value;
  const waitForDesktop = () =>
    desktop && awaitDesktop !== undefined ? waitDesktop(io, deps, prefix, running, awaitDesktop) : Promise.resolve(undefined);
  if (json) {
    io.stdout(createdLine(running, await waitForDesktop()));
    return 0;
  }
  printRunning(io, running, providerId);
  const placed = placeProject(io, deps, provider, prefix, running, project ?? clone, local);
  const desktopState = await waitForDesktop();
  if (desktopState !== undefined) printDesktop(io, running, desktopState);
  return placed;
}

interface CreatedHand {
  index: number;
  last: Hand | undefined;
  outcome: HandOutcome<Hand>;
  desktop: DesktopState | undefined;
}

function launchInSequence(
  io: HandsIO,
  deps: HandsDeps,
  provider: HandProvider,
  prefix: string,
  request: ConsoleHandRequest,
  count: number,
  awaitDesktop: AwaitDesktop | undefined,
): Promise<CreatedHand>[] {
  const report = statusReporter(io, prefix);
  const launched: Promise<CreatedHand>[] = [];
  const launch = (index: number): void => {
    let last: Hand | undefined;
    const named = request.name === undefined ? request : { ...request, name: `${request.name}-${index}` };
    const created = provider.create(named, (hand) => {
      if (last === undefined && index < count) launch(index + 1);
      last = hand;
      report(hand);
    });
    launched.push(
      created.then(async (outcome) => ({
        index,
        last,
        outcome,
        desktop:
          outcome.ok && awaitDesktop !== undefined ? await waitDesktop(io, deps, prefix, outcome.value, awaitDesktop) : undefined,
      })),
    );
  };
  launch(1);
  return launched;
}

function handLine(created: CreatedHand, hand: Hand, desktop: boolean): string {
  const address = created.desktop === undefined ? null : rdpAddress(created.desktop);
  const desktopField = desktop ? ` desktop ${address ?? "not listening"}` : "";
  return `hand ${created.index} alias ${hand.alias ?? "-"} status ${hand.status} ssh ${hand.sshDest ?? "-"}${desktopField}\n`;
}

async function createMany(
  io: HandsIO,
  deps: HandsDeps,
  provider: HandProvider,
  prefix: string,
  request: ConsoleHandRequest,
  count: number,
  awaitDesktop: AwaitDesktop | undefined,
  json: boolean,
): Promise<number> {
  const launched = launchInSequence(io, deps, provider, prefix, request, count, awaitDesktop);
  const settled: CreatedHand[] = [];
  for (let i = 0; i < launched.length; i += 1) settled.push(await launched[i]);
  for (const created of settled) {
    const hand = created.outcome.ok ? created.outcome.value : created.last;
    if (hand === undefined) continue;
    io.stdout(json ? createdLine(hand, created.desktop) : handLine(created, hand, request.desktop === true));
  }
  if (!json && settled.some((created) => created.desktop !== undefined)) io.stdout(DESKTOP_NEXT_STEPS);
  for (const created of settled) {
    if (!created.outcome.ok) io.stderr(`${prefix}: hand ${created.index} of ${count}: ${created.outcome.error}\n`);
  }
  return settled.length === count && settled.every((created) => created.outcome.ok) ? 0 : 1;
}

async function waitDesktop(
  io: HandsIO,
  deps: HandsDeps,
  prefix: string,
  hand: Hand,
  awaitDesktop: AwaitDesktop,
): Promise<DesktopState> {
  const startedAt = deps.now();
  const state = await awaitDesktop(hand.id, { intervalMs: deps.desktopPollMs, timeoutMs: deps.desktopTimeoutMs });
  const waitedSeconds = Math.round((deps.now() - startedAt) / 1000);
  if (state.rdpListening) return state;
  io.stderr(
    state.apiError !== null
      ? `${prefix}: warning: hand ${hand.id} desktop state unknown: ${state.apiError}\n`
      : state.status !== null && state.status !== "running"
        ? `${prefix}: warning: hand ${hand.id} is ${state.status}; the desktop is not reachable\n`
        : `${prefix}: warning: hand ${hand.id} is running but xrdp is not listening after ${waitedSeconds} s; check with agro hands exec ${hand.id} -- systemctl status xrdp\n`,
  );
  return state;
}

function placeProject(
  io: HandsIO,
  deps: HandsDeps,
  provider: HandProvider,
  prefix: string,
  hand: Hand,
  slug: ProjectSlug | undefined,
  local: { path: string; branch: string } | undefined,
): number {
  if (slug === undefined) return 0;
  const { sshDest, remoteName } = hand;
  if (sshDest === null || remoteName === null) {
    io.stderr(`${prefix}: hand ${hand.id} has no SSH host or index\n`);
    return 1;
  }
  io.stdout(`project: ~/${handProjectPath(slug)}\n`);
  if (local !== undefined) return pushProject(io, deps, provider, prefix, hand, sshDest, remoteName, slug, local);
  const cloned = runSsh(
    deps,
    provider,
    hand,
    sshDest,
    `mkdir -p projects/${slug.owner} && git clone -q https://github.com/${slug.owner}/${slug.repo}.git ${handProjectPath(slug)}`,
  );
  if (cloned !== 0) io.stderr(`${prefix}: git clone on hand ${hand.label} failed with status ${cloned}\n`);
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
  return runSsh(deps, provider, resolved.hand, resolved.sshDest, remote);
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

async function runFork(
  tokens: string[],
  io: HandsIO,
  providerId: HandProviderId,
  provider: HandProvider,
  prefix: string,
) {
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
  printRunning(io, hand, providerId);
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
  if (!(await confirmDestroy(io, deps.confirm, { prefix, yes, question: `Destroy hand ${ref}?`, subject: `hand ${ref}` }))) {
    return 1;
  }
  const deleted = await provider.destroy(ref);
  if (!deleted.ok) return failed(io, prefix, deleted.error);
  io.stdout(`destroyed ${ref}\n`);
  return 0;
}

async function runCheck(
  tokens: string[],
  io: HandsIO,
  deps: HandsDeps,
  config: ConsoleConfig,
  authority: ConsoleAuthority,
  keyPath: string,
  prefix: string,
): Promise<number> {
  const parsed = parseCheck(tokens);
  if (!parsed.ok) return failed(io, prefix, parsed.error);
  const lines = await consoleCheckLines(deps, config, authority, parsed.sshKeyIds, () => deps.readFile(keyPath));
  for (const line of lines) io.stdout(`${line}\n`);
  return lines.some((line) => line.startsWith("fail ")) ? 1 : 0;
}

type GlobalFlags =
  | { ok: true; provider: string | undefined; operator: boolean; args: string[] }
  | { ok: false; error: string };

function takeGlobalFlags(args: string[]): GlobalFlags {
  const end = args.includes("--") ? args.indexOf("--") : args.length;
  const kept: string[] = [];
  let provider: string | undefined;
  let operator = false;
  for (let i = 0; i < end; i++) {
    const token = args[i];
    if (isOneOf(VALUE_FLAGS, token)) {
      kept.push(token);
      if (i + 1 < end) kept.push(args[++i]);
    } else if (token === "--operator") {
      operator = true;
    } else if (token === "--provider") {
      provider = args[++i];
      if (provider === undefined || i >= end) return { ok: false, error: "--provider requires a value" };
    } else if (token.startsWith("--provider=")) {
      provider = token.slice("--provider=".length);
    } else {
      kept.push(token);
    }
  }
  return { ok: true, provider, operator, args: [...kept, ...args.slice(end)] };
}

export async function runHands(
  args: string[],
  io: HandsIO,
  overrides: Partial<HandsDeps> = {},
  bin = "agro",
): Promise<number> {
  const flag = takeGlobalFlags(args);
  if (!flag.ok) {
    io.stderr(`${bin} hands: ${flag.error}\n`);
    return 1;
  }
  const [verb, ...rest] = flag.args;
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
  const notice = retiredHandsNotice(brainHarnessRoot(deps.env, deps.userHome()), deps.env, deps.userHome(), bin);
  if (notice !== undefined) io.stderr(`${bin} hands: ${notice}\n`);
  let providerId: HandProviderId;
  try {
    providerId = resolveHandProviderId(deps.env, deps.userHome(), flag.provider);
  } catch (error) {
    io.stderr(`${bin} hands: ${messageOf(error)}\n`);
    return 1;
  }
  const prefix = `${bin} hands ${verb}`;
  let safe: HandsIO;
  let provider: HandProvider;
  let awaitDesktop: AwaitDesktop | undefined;
  if (providerId === "exedev") {
    if (flag.operator) {
      io.stderr(`${prefix}: --operator applies only to console hands\n`);
      return 1;
    }
    if (verb === "check") {
      io.stderr(`${prefix}: check applies only to console hands\n`);
      return 1;
    }
    const consoleOnly: readonly string[] = verb === "create" ? CONSOLE_ONLY_CREATE_FLAGS : verb === "fork" ? ["--spec"] : [];
    const refused = options
      .map((token) => (token.includes("=") ? token.slice(0, token.indexOf("=")) : token))
      .find((flag) => consoleOnly.includes(flag));
    if (refused !== undefined) {
      io.stderr(`${prefix}: ${refused} applies only to console hands\n`);
      return 1;
    }
    const preflight = exedevPreflight(deps.run);
    if (!preflight.ok) {
      io.stderr(`${bin} hands: ${preflight.error}\n`);
      return 2;
    }
    safe = io;
    provider = createExedevProvider(deps);
  } else {
    const resolved = resolveHandsConsoleConfig(deps.env, deps.homeDir, deps.readFile, deps.readCredentials, flag.operator);
    if (!resolved.ok) {
      io.stderr(`${resolved.error}\n`);
      return 2;
    }
    const { config, authority } = resolved;
    const hidden = hiding(io, config.token);
    safe = hidden;
    const keyPath = join(deps.userHome(), ".ssh", "id_ed25519.pub");
    if (verb === "check") return runCheck(rest, hidden, deps, config, authority, keyPath, prefix);
    const localKey: LocalSshKey | undefined =
      authority === "operator"
        ? { read: () => deps.readFile(keyPath), name: `agro-cli@${deps.hostname()}` }
        : undefined;
    const consoleProvider = createConsoleProvider(deps, config, authority, (notice) => hidden.stderr(`${prefix}: ${notice}\n`), localKey);
    provider = consoleProvider;
    awaitDesktop = consoleProvider.awaitDesktop;
  }
  if (verb === "list") return runList(rest, safe, providerId, provider, prefix);
  if (verb === "create") return runCreate(rest, safe, deps, providerId, provider, prefix, awaitDesktop);
  if (verb === "destroy") return runDestroy(rest, safe, deps, provider, prefix);
  if (verb === "fork") return runFork(rest, safe, providerId, provider, prefix);
  if (verb === "exec") return runExec(rest, safe, deps, provider, prefix);
  if (verb === "fetch") return runFetch(rest, safe, deps, provider, prefix);
  return runAction(verb, rest, safe, provider, prefix);
}
