import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join, resolve, parse, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveUserStateHome } from '../lib/layout.js';
import { resolveProjectRoot } from '../lib/project.js';
import { runningInsideSandbox } from '../lib/execution/detect.js';
import { hasSession, isInstalled } from '../lib/tmux.js';
import { createClipboardServer, listenClipboardServer } from '../lib/clipboard/server.js';

interface IO { stdout: (text: string) => void; stderr: (text: string) => void }
interface State { projectRoot: string; port: number; token: string; instanceId: string; session: string }
interface Context { projectRoot: string; directory: string; statePath: string; session: string }
export interface ClipboardArgs { help: boolean; verb?: 'start' | 'stop'; port: number }

export function parseClipboardArgs(args: string[]): ClipboardArgs {
  const [verb, ...tail] = args;
  if (!verb || verb === '--help' || verb === '-h') return { help: true, port: 3500 };
  if (verb !== 'start' && verb !== 'stop') throw new Error('expected start or stop; use agro clipboard --help');
  if (tail.length === 1 && ['--help', '-h'].includes(tail[0])) return { help: true, port: 3500 };
  if (!tail.length) return { help: false, verb, port: 3500 };
  if (verb === 'start' && tail[0] === '--port') {
    if (tail.length > 2) throw new Error('unexpected argument after --port');
    const value = tail[1] ?? '';
    if (!/^[0-9]+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('--port requires an integer from 1 to 65535');
    return { help: false, verb, port: Number(value) };
  }
  throw new Error(`unexpected argument ${JSON.stringify(tail[0])}`);
}

export function printClipboardHelp(bin = 'agro'): void {
  process.stdout.write(`${bin} clipboard — Upload image batches inside the sandbox\n\nUsage:\n  ${bin} clipboard start [--port <port>]\n  ${bin} clipboard stop\n\nDefault port: 3500. Ports must be integers from 1 to 65535.\nRuns detached in named tmux; binds only to 127.0.0.1.\nUse operator-managed forwarding or an authenticated proxy for browser access.\nStop preserves all uploaded batches. No sandbox is provisioned or restarted.\n`);
}

export const clipboardProjectId = (root: string): string => createHash('sha256').update(root).digest('hex');
export const clipboardShellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;
export function clipboardHealthMatches(value: unknown, instanceId: string): boolean {
  return !!value && typeof value === 'object' && 'service' in value && value.service === 'agro-clipboard' && 'instanceId' in value && value.instanceId === instanceId;
}

async function privateDirectory(path: string): Promise<void> {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try { await fs.mkdir(current, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.uid !== 0 && stat.uid !== process.getuid?.()) || ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0)) throw new Error(`unsafe directory: ${current}`);
    if (current === absolute && (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)) throw new Error(`directory must be private (0700) and owned by this user: ${current}`);
  }
}
async function context(): Promise<Context> {
  const projectRoot = await fs.realpath(resolveProjectRoot());
  const id = clipboardProjectId(projectRoot);
  const parent = join(resolveUserStateHome(), 'clipboard');
  await privateDirectory(parent);
  const directory = join(parent, id);
  await privateDirectory(directory);
  return { projectRoot, directory, statePath: join(directory, 'state.json'), session: `agro-clipboard-${id}` };
}
async function readState(ctx: Context): Promise<State | undefined> {
  let handle;
  try { handle = await fs.open(ctx.statePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1 || stat.size > 4096) throw new Error('unsafe clipboard state permissions or ownership');
    let value: State;
    try { value = JSON.parse(await handle.readFile('utf8')) as State; }
    catch { throw new Error('invalid clipboard state JSON; inspect the private state before recovery'); }
    if (!value || typeof value !== 'object') throw new Error('invalid clipboard ownership state');
    if (value.projectRoot !== ctx.projectRoot || value.session !== ctx.session || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !/^[a-f0-9]{64}$/.test(value.token) || !/^[a-f0-9-]{36}$/.test(value.instanceId)) throw new Error('invalid clipboard ownership state');
    return value;
  } finally { await handle.close(); }
}
async function writeState(ctx: Context, state: State): Promise<void> {
  const handle = await fs.open(ctx.statePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(state)); } finally { await handle.close(); }
}
function tmux(args: string[]): string {
  const result = spawnSync('tmux', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('tmux operation failed; inspect the exact clipboard session before recovery');
  return result.stdout.trim();
}
function ownedSession(state: State): boolean {
  const result = spawnSync('tmux', ['show-environment', '-t', `=${state.session}`, 'AGRO_CLIPBOARD_INSTANCE'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === `AGRO_CLIPBOARD_INSTANCE=${state.instanceId}`;
}
function killOwned(state: State): void {
  if (!hasSession(state.session)) return;
  if (!ownedSession(state)) throw new Error(`session collision: ${state.session}; refusing to stop an unowned session`);
  tmux(['kill-session', '-t', `=${state.session}`]);
}
async function healthy(state: State): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/api/health`, { headers: { Authorization: `Bearer ${state.token}` }, signal: AbortSignal.timeout(400), redirect: 'error' });
    return response.status === 200 && clipboardHealthMatches(await response.json(), state.instanceId);
  } catch { return false; }
}
async function freePort(port: number): Promise<void> {
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((done, fail) => {
    server.once('error', () => fail(new Error(`port ${port} is unavailable; leave its listener running and choose --port <port>`)));
    server.listen(port, '127.0.0.1', () => server.close((error) => error ? fail(error) : done()));
  });
}
async function serve(statePath: string): Promise<void> {
  const ctx = await context();
  if (statePath !== ctx.statePath) throw new Error('invalid private serve path');
  const state = await readState(ctx);
  if (!state || process.env.AGRO_CLIPBOARD_INSTANCE !== state.instanceId) throw new Error('private serve ownership mismatch');
  const server = createClipboardServer({ ...state, storageRoot: join(ctx.directory, 'batches') });
  await listenClipboardServer(server, state.port);
  await new Promise<void>((done, fail) => {
    server.once('close', done);
    server.once('error', fail);
  });
}

export async function runClipboard(args: string[], io: IO, deps: { insideSandbox?: () => boolean } = {}): Promise<number> {
  try {
    if (args[0] !== '__serve') {
      const parsed = parseClipboardArgs(args);
      if (parsed.help) { printClipboardHelp(); return args.length ? 0 : 1; }
    }
    if (!(deps.insideSandbox ?? runningInsideSandbox)()) throw new Error('sandbox-only — enter the existing sandbox with `agro shell <name>` and retry');
    if (args[0] === '__serve') {
      if (args.length !== 2) throw new Error('invalid private serve arguments');
      await serve(args[1]);
      return 0;
    }
    const parsed = parseClipboardArgs(args);
    if (!isInstalled()) throw new Error('tmux is required inside the sandbox; install it explicitly before retrying');
    const ctx = await context();
    const lock = join(ctx.directory, 'lock');
    try { await fs.mkdir(lock, { mode: 0o700 }); }
    catch { throw new Error(`clipboard is locked: ${lock}; if no clipboard command is running, inspect state/session and remove only this stale lock directory`); }
    try {
      const state = await readState(ctx);
      const exists = hasSession(ctx.session);
      if (exists && (!state || !ownedSession(state))) throw new Error(`session collision: ${ctx.session}; refusing to change an unowned session`);
      if (parsed.verb === 'stop') {
        if (state && exists) killOwned(state);
        if (state) await fs.unlink(ctx.statePath);
        io.stdout('Clipboard stopped; uploaded batches preserved.\n');
        return 0;
      }
      if (state && exists) {
        if (state.port !== parsed.port) throw new Error(`already running on port ${state.port}; stop it before changing --port`);
        if (!await healthy(state)) throw new Error('owned session is not ready; inspect it and run agro clipboard stop before retrying');
        io.stdout(`http://127.0.0.1:${state.port}/#token=${state.token}\n`);
        return 0;
      }
      if (state) throw new Error(`stale clipboard state: ${ctx.statePath}; inspect the prior service, then run agro clipboard stop before retrying`);
      await freePort(parsed.port);
      const created: State = { projectRoot: ctx.projectRoot, port: parsed.port, session: ctx.session, token: randomBytes(32).toString('hex'), instanceId: randomUUID() };
      const log = join(ctx.directory, 'startup.log');
      const handle = await fs.open(log, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1) throw new Error('unsafe startup log');
        await handle.truncate(0);
      } finally { await handle.close(); }
      await writeState(ctx, created);
      let launched = false;
      try {
        const entry = await fs.realpath(resolve(process.argv[1]));
        const command = ['env', `AGRO_HOME=${resolveUserStateHome()}`, `AGRO_EXECUTION_TARGET=${process.env.AGRO_EXECUTION_TARGET ?? ''}`, process.execPath, entry, 'clipboard', '__serve', ctx.statePath].map(clipboardShellQuote).join(' ');
        tmux(['new-session', '-d', '-s', ctx.session, '-c', ctx.projectRoot, '-e', `AGRO_CLIPBOARD_INSTANCE=${created.instanceId}`, `exec ${command} >${clipboardShellQuote(log)} 2>&1`]);
        launched = true;
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          if (!hasSession(ctx.session)) break;
          if (!ownedSession(created)) throw new Error('startup session ownership mismatch');
          if (await healthy(created)) {
            io.stdout(`http://127.0.0.1:${created.port}/#token=${created.token}\n`);
            return 0;
          }
          await delay(100);
        }
        throw new Error(`startup failed on port ${created.port}; inspect private log ${log} (port may be occupied)`);
      } catch (error) {
        if (launched) killOwned(created);
        await fs.unlink(ctx.statePath);
        throw error;
      }
    } finally { await fs.rmdir(lock); }
  } catch (error) {
    io.stderr(`agro clipboard: ${error instanceof Error ? error.message : 'operation failed'}\n`);
    return 1;
  }
}
