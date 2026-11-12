import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, writeFileSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { clipboardProjectId } from "../commands/clipboard.js";
import { fileURLToPath } from "node:url";

const CLI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGRO_JS = join(CLI_DIR, "dist", "agro.js");
const LEGACY_JS = join(CLI_DIR, "dist", "oh.js");
const VERSION = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")).version as string;

function run(bundle: string, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [bundle, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AGRO_EXECUTION_TARGET: "docker-compose" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number | null; stdout: string; stderr: string };
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

describe.skipIf(!existsSync('/etc/agro/sandbox'))('standalone clipboard inside the actual sandbox', () => {
  it('serves, uploads, isolates, refuses collisions, and cleans only owned sessions', async () => {
    const root = mkdtempSync(join(tmpdir(), "clipboard bundle ' spaces-"));
    const bundle = join(root, 'agro.js');
    const project = join(root, 'project one');
    const other = join(root, 'project two');
    const home = join(root, 'private home');
    for (const path of [project, other]) {
      mkdirSync(join(path, '.agro'), { recursive: true });
      writeFileSync(join(path, '.git'), 'gitdir: /inaccessible/host/worktree');
    }
    copyFileSync(AGRO_JS, bundle);
    const call = (args: string[], cwd = project, extra: NodeJS.ProcessEnv = {}) => {
      try {
        return { code: 0, out: execFileSync(process.execPath, [bundle, 'clipboard', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AGRO_HOME: home, AGRO_EXECUTION_TARGET: 'local', ...extra } }), error: '' };
      } catch (error) {
        const e = error as { status: number; stdout: string; stderr: string };
        return { code: e.status, out: String(e.stdout), error: String(e.stderr) };
      }
    };
    const directory = join(home, 'clipboard', clipboardProjectId(project));
    const statePath = join(directory, 'state.json');
    const session = `agro-clipboard-${clipboardProjectId(project)}`;
    const tmux = (...args: string[]) => execFileSync('tmux', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const listener = createServer();
    let foreign = false;
    try {
      expect(call(['start'], project, { AGRO_EXECUTION_TARGET: 'docker-compose' }).error).toContain('sandbox-only');
      expect(call(['start'], project, { PATH: '/nonexistent' }).error).toContain('tmux is required');
      const started = call(['start']);
      expect(started, started.code === 0 ? '' : readFileSync(join(directory, 'startup.log'), 'utf8')).toMatchObject({ code: 0, error: '' });
      expect(started.out).toMatch(/^http:\/\/127\.0\.0\.1:3500\/#token=[a-f0-9]{64}\n$/);
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      expect(statSync(statePath).mode & 0o777).toBe(0o600);
      expect(tmux('show-environment', '-t', `=${session}`, 'AGRO_CLIPBOARD_INSTANCE')).toContain(state.instanceId);
      const command = tmux('list-panes', '-t', `=${session}`, '-F', '#{pane_start_command}');
      expect(command).not.toContain(state.token);
      expect(command).toContain('agro.js');
      expect(readFileSync(join(directory, 'startup.log'), 'utf8')).not.toContain(state.token);
      const base = 'http://127.0.0.1:3500';
      expect((await fetch(base)).status).toBe(200);
      expect(await (await fetch(base)).text()).toContain('AGRO Clipboard');
      const upload = await fetch(`${base}/api/batches`, { method: 'POST', headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ images: [{ name: "$(touch NEVER) image.png", caption: "'; touch NEVER; #", mimeType: 'image/png', data: Buffer.from('89504e470d0a1a0a', 'hex').toString('base64') }] }) });
      expect(upload.status).toBe(201);
      const batch = await upload.json() as { manifestPath: string };
      expect(existsSync(batch.manifestPath)).toBe(true);
      expect(existsSync(join(project, 'NEVER'))).toBe(false);
      expect(call(['start']).out).toBe(started.out);
      expect(call(['start', '--port', '3501']).error).toContain('already running on port 3500');
      expect(call(['start'], other).error).toContain('port 3500 is unavailable');
      expect(call(['stop']).code).toBe(0);
      expect(call(['stop']).code).toBe(0);
      expect(existsSync(batch.manifestPath)).toBe(true);
      expect(existsSync(statePath)).toBe(false);
      expect(() => tmux('has-session', '-t', `=${session}`)).toThrow();
      await new Promise<void>((done) => listener.listen(0, '127.0.0.1', done));
      const port = (listener.address() as { port: number }).port;
      expect(call(['start', '--port', String(port)]).error).toContain(`port ${port} is unavailable`);
      expect(listener.listening).toBe(true);
      expect(existsSync(statePath)).toBe(false);
      tmux('new-session', '-d', '-s', session, 'sleep 60');
      foreign = true;
      expect(call(['start']).error).toContain('session collision');
      expect(call(['stop']).error).toContain('session collision');
      tmux('has-session', '-t', `=${session}`);
      writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
      expect(call(['start']).error).toContain('session collision');
      expect(call(['stop']).error).toContain('session collision');
      tmux('has-session', '-t', `=${session}`);
      tmux('kill-session', '-t', `=${session}`);
      foreign = false;
      expect(call(['start']).error).toContain('stale clipboard state');
      expect(call(['stop']).code).toBe(0);
      expect(listener.listening).toBe(true);
      mkdirSync(join(directory, 'lock'));
      expect(call(['start']).error).toContain('stale lock');
      rmSync(join(directory, 'lock'), { recursive: true });
      const outside = join(root, 'unrelated.json');
      writeFileSync(outside, '{}');
      symlinkSync(outside, statePath);
      expect(call(['stop']).code).toBe(1);
      expect(readFileSync(outside, 'utf8')).toBe('{}');
      unlinkSync(statePath);
      writeFileSync(statePath, '{}', { mode: 0o644 });
      expect(call(['stop']).error).toContain('permissions');
      unlinkSync(statePath);
      const logPath = join(directory, 'startup.log');
      unlinkSync(logPath);
      symlinkSync(outside, logPath);
      expect(call(['start']).code).toBe(1);
      expect(readFileSync(outside, 'utf8')).toBe('{}');
      expect(existsSync(statePath)).toBe(false);
      unlinkSync(logPath);
      const validBundle = readFileSync(bundle);
      writeFileSync(bundle, 'process.stderr.write("controlled startup failure\\n"); process.exit(1);');
      const originalArgv = process.argv[1];
      process.argv[1] = bundle;
      const { runClipboard } = await import('../commands/clipboard.js');
      const originalHome = process.env.AGRO_HOME;
      const originalCwd = process.cwd();
      let startupError = '';
      try {
        process.chdir(project);
        process.env.AGRO_HOME = home;
        const io = { stdout: () => {}, stderr: (s: string) => { startupError += s; } };
        expect(await runClipboard(['start', '--port', '3501'], io, { insideSandbox: () => true })).toBe(1);
        expect(readFileSync(join(directory, 'startup.log'), 'utf8')).toContain('controlled startup failure');
        expect(existsSync(statePath)).toBe(false);
        writeFileSync(bundle, `const fs = require('node:fs'); const http = require('node:http'); const s = JSON.parse(fs.readFileSync(process.argv[4])); http.createServer((q,r) => { r.setHeader('Content-Type','application/json'); r.end(JSON.stringify({service:'agro-clipboard',instanceId:'wrong-instance'})); }).listen(s.port,'127.0.0.1');`);
        startupError = '';
        expect(await runClipboard(['start', '--port', '3501'], io, { insideSandbox: () => true })).toBe(1);
        expect(startupError).toContain('startup failed');
        expect(existsSync(statePath)).toBe(false);
      } finally {
        process.chdir(originalCwd);
        process.argv[1] = originalArgv;
        if (originalHome === undefined) delete process.env.AGRO_HOME; else process.env.AGRO_HOME = originalHome;
        writeFileSync(bundle, validBundle);
      }
      expect(startupError).toContain('startup failed');
      expect(existsSync(statePath)).toBe(false);
      expect(() => tmux('has-session', '-t', `=${session}`)).toThrow();
      expect(call(['start', '--port', '3501'], other).code).toBe(0);
      expect(call(['stop'], other).code).toBe(0);
      expect(clipboardProjectId(project)).not.toBe(clipboardProjectId(other));
    } finally {
      if (foreign) tmux('kill-session', '-t', `=${session}`);
      call(['stop']);
      call(['stop'], other);
      if (listener.listening) await new Promise<void>((done, fail) => listener.close((e) => e ? fail(e) : done()));
      rmSync(root, { recursive: true, force: true });
    }
  }, 30000);
});

describe(
  "one bundle, one executable",
  () => {
    it("emits dist/agro.js as a 0755 file and no legacy dist/oh.js", () => {
      expect(statSync(AGRO_JS).mode & 0o777).toBe(0o755);
      expect(readFileSync(AGRO_JS, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
      expect(existsSync(LEGACY_JS)).toBe(false);
    });

    it("agro --help prints the AGRO banner, agro verbs, and no compatibility line", () => {
      const r = run(AGRO_JS, ["--help"]);
      expect(r.code).toBe(0);
      const lines = r.stdout.split("\n");
      expect(lines[0]).toBe(`agro — AGRO CLI (v${VERSION})`);
      expect(r.stdout).toMatch(/^ {2}agro sandbox <args\.\.\.>/m);
      expect(r.stdout).not.toMatch(/^ {2}oh /m);
      expect(r.stdout).not.toContain("compatibility entry point");
    });

    it("--version prints the bare version", () => {
      const agro = run(AGRO_JS, ["--version"]);
      expect(agro.code).toBe(0);
      expect(agro.stdout).toBe(`${VERSION}\n`);
    });

    it("error prefixes carry the agro product name", () => {
      expect(run(AGRO_JS, ["update", "--from"]).stderr).toMatch(
        /^agro self-upgrade: --from belongs to the project-payload command; run `agro vendor --from` — agro self-upgrade upgrades only the installed CLI\n/,
      );
      expect(run(AGRO_JS, ["vendor", "--from"]).stderr).toBe("agro vendor: --from requires a directory\n");
    });
  },
);
