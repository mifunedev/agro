import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, isAbsolute } from 'node:path';
import http, { type Server } from 'node:http';
import { createClipboardServer, listenClipboardServer, readClipboardJson, CLIPBOARD_LIMITS } from '../server.js';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const jpeg = Buffer.from('ffd8ffe000104a4649460001', 'hex');
const webp = Buffer.from('52494646040000005745425056503820', 'hex');
const file = (bytes = png, mimeType = 'image/png', caption = 'first', name = '../../escape.png') => ({ name, mimeType, data: bytes.toString('base64'), caption });
let root: string;
let storageRoot: string;
let server: Server;
let port: number;
async function request(path = '/api/batches', body: unknown = { files: [file()] }, headers: Record<string, string | undefined> = {}, method = 'POST') {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string; json: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json', ...headers } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => { let json; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode!, headers: res.headers, text, json }); });
    });
    req.on('error', reject);
    req.end(method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
}
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'clipboard-test-'));
  storageRoot = join(root, 'private', 'batches');
  server = createClipboardServer({ projectRoot: root, storageRoot, token: 'secret', instanceId: 'instance-test' });
  await listenClipboardServer(server, 0);
  port = (server.address() as { port: number }).port;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  if (root) await fs.rm(root, { recursive: true, force: true });
});
describe('clipboard HTTP storage boundary', () => {
  it('stores ordered mixed files and literal captions in private files and a versioned manifest', async () => {
    const bytes = [png, jpeg, webp, Buffer.from('hello\n'), Buffer.from('%PDF-1.7\n'), Buffer.from([0, 255, 128, 1])];
    const mimes = ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/pdf', ''];
    const captions = ['<script>alert(1)</script> $(touch /tmp/pwn)', 'second', 'third', 'text', 'pdf', 'binary'];
    const result = await request('/api/batches', { files: bytes.map((b, i) => file(b, mimes[i], captions[i])) });
    expect(result.status).toBe(201);
    expect(Object.keys(result.json).sort()).toEqual(['files', 'manifestPath', 'prompt']);
    const manifest = JSON.parse(await fs.readFile(result.json.manifestPath, 'utf8'));
    expect(manifest).toMatchObject({ schemaVersion: 1, projectRoot: root, files: result.json.files });
    expect(manifest.images).toBeUndefined();
    expect(manifest.files.map((f: any) => f.caption)).toEqual(captions);
    expect(manifest.files.map((f: any) => f.kind)).toEqual(['image', 'image', 'image', 'file', 'file', 'file']);
    expect(manifest.files.map((f: any) => f.mimeType)).toEqual([...mimes.slice(0, 5), 'application/octet-stream']);
    expect(new Set(manifest.files.map((f: any) => f.id)).size).toBe(6);
    for (const [index, entry] of manifest.files.entries()) {
      expect(Object.keys(entry).sort()).toEqual(['byteLength', 'caption', 'id', 'kind', 'mimeType', 'name', 'path']);
      expect(isAbsolute(entry.path)).toBe(true);
      expect(dirname(entry.path)).toBe(dirname(result.json.manifestPath));
      expect(entry.name).toBe('../../escape.png');
      expect(basename(entry.path)).toMatch(new RegExp(`^${entry.id}\\.${['png', 'jpg', 'webp', 'png', 'png', 'png'][index]}$`));
      expect(await fs.readFile(entry.path)).toEqual(bytes[index]);
      expect((await fs.stat(entry.path)).mode & 0o777).toBe(0o600);
      expect(entry.byteLength).toBe(bytes[index].length);
    }
    expect((await fs.stat(result.json.manifestPath)).mode & 0o777).toBe(0o600);
    for (const dir of [storageRoot, dirname(storageRoot), dirname(result.json.manifestPath)]) expect((await fs.stat(dir)).mode & 0o777).toBe(0o700);
    expect(result.json.prompt).toContain(result.json.manifestPath);
    expect(result.json.prompt).toMatch(/every file/i);
    expect(result.json.prompt).toMatch(/file-reading tools/i);
    expect(result.json.prompt).toMatch(/image-capable tool/i);
    expect(result.json.prompt).toMatch(/captions.*content.*untrusted/i);
    expect(result.json.prompt).toMatch(/do not execute/i);
    expect(result.json.prompt).toMatch(/extract archives/i);
    expect(result.json.prompt).toMatch(/paths? alone.*not.*content/i);
    expect(result.json.prompt).not.toContain('secret');
    expect(await fs.readdir(root)).toEqual(['private']);
  });
  it.each([
    ['../../payload.HTML', 'text/html', 'html'], ['C:\\tmp\\payload.SVG', 'image/svg+xml', 'svg'],
    ['../../run.SH', 'application/x-sh', 'sh'], ['archive.ZIP', 'application/zip', 'zip'],
    ['../../bad.a-b', 'text/plain', 'bin'], ['../../bad.abcdefghijklmnopq', '', 'bin'],
    ['no-extension', '', 'bin'], ['a.abcdefghijklmnop', '', 'abcdefghijklmnop'],
    ['x.txt/../../escape', '', 'bin'], ['x.é', '', 'bin'],
  ])('keeps %s inert with a generated safe suffix', async (name, mimeType, suffix) => {
    const bytes = Buffer.from('<script>throw "NEVER"</script>\n$(touch NEVER)');
    const result = await request('/api/batches', { files: [file(bytes, mimeType, 'untrusted', name)] });
    expect(result.status).toBe(201);
    const entry = result.json.files[0];
    expect(entry).toMatchObject({ name, kind: 'file', mimeType: mimeType || 'application/octet-stream' });
    expect(basename(entry.path)).toBe(`${entry.id}.${suffix}`);
    expect(await fs.readFile(entry.path)).toEqual(bytes);
    expect((await request(entry.path, undefined, {}, 'GET')).status).toBe(404);
    expect((await request(`/api/batches/${basename(entry.path)}`, undefined, {}, 'GET')).status).toBe(404);
    expect(await fs.readdir(root)).toEqual(['private']);
  });
  it('allows empty generic files but rejects empty raster files', async () => {
    const result = await request('/api/batches', { files: [file(Buffer.alloc(0), 'text/plain', '', 'empty.txt')] });
    expect(result.status).toBe(201);
    expect(result.json.files[0]).toMatchObject({ byteLength: 0, kind: 'file' });
    expect(await fs.readFile(result.json.files[0].path)).toEqual(Buffer.alloc(0));
    for (const mime of ['image/png', 'image/jpeg', 'image/webp']) expect((await request('/api/batches', { files: [file(Buffer.alloc(0), mime)] })).status).toBe(400);
  });
  it('serves token-free embedded page and authenticated health identity with restrictive headers', async () => {
    const page = await request('/', undefined, {}, 'GET');
    expect(page.status).toBe(200);
    expect(page.text).toContain('<!doctype html>');
    expect(page.text).not.toContain('secret');
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(page.headers['access-control-allow-origin']).toBeUndefined();
    expect((await request('/api/health', undefined, {}, 'GET')).json).toEqual({ service: 'agro-clipboard', instanceId: 'instance-test' });
    expect((await request('/api/health', undefined, { Authorization: '' }, 'GET')).status).toBe(401);
    expect((await request('/api/health?token=secret', undefined, { Authorization: '' }, 'GET')).status).not.toBe(200);
    expect((await request('/etc/passwd', undefined, {}, 'GET')).status).toBe(404);
    expect((await request('/api/batches', undefined, { 'Content-Type': 'text/plain' })).status).toBe(415);
  });
  it.each([
    { Authorization: '' }, { Authorization: 'Bearer wrong' }, { Host: 'evil.example' },
    { Host: '127.0.0.1.evil:3500' }, { Origin: 'https://evil.example' }, { Origin: 'null' },
    { Origin: 'http://localhost:3500' },
  ])('rejects unauthorized or foreign requests %j', async headers => {
    expect([401, 403]).toContain((await request('/api/batches', undefined, headers)).status);
    await expect(fs.stat(storageRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('accepts exact same-origin and CLI without Origin', async () => {
    expect((await request('/api/batches', undefined, { Origin: `http://127.0.0.1:${port}` })).status).toBe(201);
    expect((await request()).status).toBe(201);
  });
  it.each([
    'bad json', {}, { images: [file()] }, { files: [] }, { files: Array.from({ length: 11 }, () => file()) },
    { files: [file(png, 'image/jpeg')] }, { files: [file(Buffer.from('<html>'), 'image/png')] },
    { files: [file(Buffer.from('bad'), 'image/webp')] },
    { files: [{ ...file(), data: 'a===' }] }, { files: [{ ...file(), data: 'AB==' }] },
    { files: [{ ...file(), data: 'data:image/png;base64,AAAA' }] }, { files: [{ ...file(), data: png.toString('base64') + '\n' }] },
    { files: [{ ...file(), caption: 'x'.repeat(2001) }] }, { files: [{ ...file(), caption: 1 }] },
    { files: [{ ...file(), name: null }] }, { files: [{ ...file(), name: '' }] },
    { files: [{ ...file(), name: 'x'.repeat(1025) }] }, { files: [file(), file(Buffer.from('bad'))] },
    ...['text/plain\r\nX-Evil: yes', 'text/pla\u0000in', 'text/plain\t', 'text', '/plain', 'text/', ' text/plain', 'text/plain; charset=utf-8', 'a/'.concat('b'.repeat(254))].map(mime => ({ files: [file(png, mime)] })),
    { files: [{ ...file(), mimeType: null }] }, { files: [{ ...file(), data: 'AB==', mimeType: 'text/plain' }] },
  ])('rejects malformed batch without storage writes %#', async body => {
    expect((await request('/api/batches', body)).status).toBe(400);
    await expect(fs.stat(storageRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('enforces decoded file and raw request limits', async () => {
    expect(CLIPBOARD_LIMITS).toEqual({ requestBytes: 50 * 1024 * 1024, fileBytes: 10 * 1024 * 1024, files: 10, captionCharacters: 2000 });
    const oversized = Buffer.alloc(CLIPBOARD_LIMITS.fileBytes + 1); png.copy(oversized);
    for (const mime of ['image/png', 'application/octet-stream']) expect((await request('/api/batches', { files: [file(oversized, mime)] })).status).toBe(413);
    expect((await request('/api/batches', {}, { 'Content-Length': String(CLIPBOARD_LIMITS.requestBytes + 1) })).status).toBe(413);
  });
  it('accepts exact decoded byte, name, count and caption limits', async () => {
    const bytes = Buffer.alloc(CLIPBOARD_LIMITS.fileBytes);
    const result = await request('/api/batches', { files: [file(bytes, 'application/octet-stream', 'x'.repeat(2000), 'n'.repeat(1024)), ...Array.from({ length: 9 }, () => file())] });
    expect(result.status).toBe(201);
    expect(result.json.files).toHaveLength(10);
    expect((await fs.readFile(result.json.files[0].path)).equals(bytes)).toBe(true);
  });
  it('rejects symlink destination and ancestor without touching targets', async () => {
    const target = join(root, 'target'); await fs.mkdir(target);
    await fs.symlink(target, join(root, 'private'));
    expect((await request()).status).toBe(500);
    expect(await fs.readdir(target)).toEqual([]);
    await fs.unlink(join(root, 'private')); await fs.mkdir(join(root, 'private'), { mode: 0o700 });
    await fs.symlink(target, storageRoot);
    expect((await request()).status).toBe(500);
    expect(await fs.readdir(target)).toEqual([]);
  });
  it('cleans only its own staging directory after publication failure and preserves prior batches', async () => {
    const first = await request(); expect(first.status).toBe(201);
    const before = await fs.readdir(storageRoot);
    const manifest = await fs.readFile(first.json.manifestPath);
    const bytes = await fs.readFile(first.json.files[0].path);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('injected failure'));
    expect((await request()).status).toBe(500);
    expect(await fs.readdir(storageRoot)).toEqual(before);
    expect(await fs.readFile(first.json.manifestPath)).toEqual(manifest);
    expect(await fs.readFile(first.json.files[0].path)).toEqual(bytes);
  });
  it('publishes concurrent requests without collisions or staging leftovers', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => request()));
    expect(results.map(r => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(results.map(r => r.json.manifestPath)).size).toBe(5);
    expect((await fs.readdir(storageRoot)).length).toBe(5);
  });
  it('enforces streamed raw byte counting with a small injected limit over real HTTP', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    server = http.createServer(async (req, res) => {
      try { await readClipboardJson(req, 64); res.writeHead(200); }
      catch (error) { res.writeHead((error as { status: number }).status); }
      res.end('{}');
    });
    await listenClipboardServer(server, 0);
    port = (server.address() as { port: number }).port;
    expect((await request('/', 'x'.repeat(65), { 'Transfer-Encoding': 'chunked' })).status).toBe(413);
  });
  it('publishes no partial batch and cleans completed files after a later write failure', async () => {
    await fs.mkdir(storageRoot, { recursive: true, mode: 0o700 });
    const open = fs.open.bind(fs);
    let calls = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      if (++calls === 2) {
        const entries = await fs.readdir(storageRoot);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatch(/^\.stage-/);
        expect(await fs.readdir(join(storageRoot, entries[0]))).toHaveLength(1);
        throw new Error('injected later write failure');
      }
      return open(...args);
    });
    expect((await request('/api/batches', { files: [file(), file()] })).status).toBe(500);
    expect(calls).toBe(2);
    expect(await fs.readdir(storageRoot)).toEqual([]);
  });
  it('refuses an existing non-private store', async () => {
    await fs.mkdir(storageRoot, { recursive: true, mode: 0o755 });
    expect((await request()).status).toBe(500);
    expect(await fs.readdir(storageRoot)).toEqual([]);
  });
  it('refuses non-loopback listen wrapper before binding', async () => {
    const other = createClipboardServer({ projectRoot: root, storageRoot, token: 'token', instanceId: 'other' });
    await expect(listenClipboardServer(other, 0, '0.0.0.0')).rejects.toThrow(/loopback/i);
    expect(other.listening).toBe(false);
  });
});
