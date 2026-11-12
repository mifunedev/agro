import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, isAbsolute } from 'node:path';
import http, { type Server } from 'node:http';
import { createClipboardServer, listenClipboardServer, readClipboardJson, CLIPBOARD_LIMITS } from '../server.js';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const jpeg = Buffer.from('ffd8ffe000104a4649460001', 'hex');
const webp = Buffer.from('52494646040000005745425056503820', 'hex');
const image = (bytes = png, mimeType = 'image/png', caption = 'first') => ({ name: '../../escape.png', mimeType, data: bytes.toString('base64'), caption });
let root: string;
let storageRoot: string;
let server: Server;
let port: number;
async function request(path = '/api/batches', body: unknown = { images: [image()] }, headers: Record<string, string | undefined> = {}, method = 'POST') {
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
  it('stores ordered images and literal captions in private files and a versioned manifest', async () => {
    const captions = ['<script>alert(1)</script> $(touch /tmp/pwn)', 'second', 'third'];
    const result = await request('/api/batches', { images: [image(png, 'image/png', captions[0]), image(jpeg, 'image/jpeg', captions[1]), image(webp, 'image/webp', captions[2])] });
    expect(result.status).toBe(201);
    const manifest = JSON.parse(await fs.readFile(result.json.manifestPath, 'utf8'));
    expect(manifest).toMatchObject({ schemaVersion: 1, projectRoot: root, images: result.json.images });
    expect(manifest.images.map((i: any) => i.caption)).toEqual(captions);
    expect(new Set(manifest.images.map((i: any) => i.id)).size).toBe(3);
    for (const [index, entry] of manifest.images.entries()) {
      expect(isAbsolute(entry.path)).toBe(true);
      expect(dirname(entry.path)).toBe(dirname(result.json.manifestPath));
      expect(entry.name).toBe('../../escape.png');
      expect(await fs.readFile(entry.path)).toEqual([png, jpeg, webp][index]);
      expect((await fs.stat(entry.path)).mode & 0o777).toBe(0o600);
      expect(entry.byteLength).toBe([png, jpeg, webp][index].length);
    }
    expect((await fs.stat(result.json.manifestPath)).mode & 0o777).toBe(0o600);
    for (const dir of [storageRoot, dirname(storageRoot), dirname(result.json.manifestPath)]) expect((await fs.stat(dir)).mode & 0o777).toBe(0o700);
    expect(result.json.prompt).toContain(result.json.manifestPath);
    expect(result.json.prompt).toMatch(/open every image/i);
    expect(result.json.prompt).toMatch(/image-capable tool/i);
    expect(result.json.prompt).toMatch(/captions.*untrusted/i);
    expect(result.json.prompt).not.toContain('secret');
    expect(await fs.readdir(root)).toEqual(['private']);
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
    'bad json', {}, { images: [] }, { images: Array.from({ length: 11 }, () => image()) },
    { images: [image(png, 'image/jpeg')] }, { images: [image(Buffer.from('<html>'), 'image/png')] },
    { images: [image(Buffer.from('<svg/>'), 'image/svg+xml')] },
    { images: [{ ...image(), data: 'a===' }] }, { images: [{ ...image(), data: 'AB==' }] },
    { images: [{ ...image(), data: 'data:image/png;base64,AAAA' }] }, { images: [{ ...image(), data: png.toString('base64') + '\n' }] },
    { images: [{ ...image(), caption: 'x'.repeat(2001) }] }, { images: [{ ...image(), caption: 1 }] },
    { images: [{ ...image(), name: null }] }, { images: [image(), image(Buffer.from('bad'))] },
  ])('rejects malformed batch without storage writes %#', async body => {
    expect((await request('/api/batches', body)).status).toBe(400);
    await expect(fs.stat(storageRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('enforces decoded image and raw request limits', async () => {
    expect(CLIPBOARD_LIMITS).toEqual({ requestBytes: 50 * 1024 * 1024, imageBytes: 10 * 1024 * 1024, images: 10, captionCharacters: 2000 });
    const oversized = Buffer.alloc(CLIPBOARD_LIMITS.imageBytes + 1); png.copy(oversized);
    expect((await request('/api/batches', { images: [image(oversized)] })).status).toBe(413);
    expect((await request('/api/batches', {}, { 'Content-Length': String(CLIPBOARD_LIMITS.requestBytes + 1) })).status).toBe(413);
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
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('injected failure'));
    expect((await request()).status).toBe(500);
    expect(await fs.readdir(storageRoot)).toEqual(before);
    expect(JSON.parse(await fs.readFile(first.json.manifestPath, 'utf8')).batchId).toBe(before[0]);
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
  it('accepts exact count and caption limits', async () => {
    const result = await request('/api/batches', { images: Array.from({ length: 10 }, () => image(png, 'image/png', 'x'.repeat(2000))) });
    expect(result.status).toBe(201);
    expect(result.json.images).toHaveLength(10);
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
    expect((await request('/api/batches', { images: [image(), image()] })).status).toBe(500);
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
