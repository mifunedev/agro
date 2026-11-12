import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { CLIPBOARD_PAGE } from './page.js';
import { storeClipboardBatch, type ClipboardRasterMimeType, type ValidatedClipboardFile } from './storage.js';

export const CLIPBOARD_LIMITS = Object.freeze({ requestBytes: 50 * 1024 * 1024, fileBytes: 10 * 1024 * 1024, files: 10, captionCharacters: 2000 });
export interface ClipboardServerOptions {
  projectRoot: string;
  storageRoot: string;
  token: string;
  instanceId: string;
}
class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const rejectPayload = (): never => { throw new RequestError(400, 'Invalid file batch'); };

function signatureMatches(bytes: Buffer, mimeType: ClipboardRasterMimeType): boolean {
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16));
}
function validateBatch(body: unknown): ValidatedClipboardFile[] {
  if (!body || typeof body !== 'object' || !('files' in body) || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > CLIPBOARD_LIMITS.files) return rejectPayload();
  return body.files.map((file: unknown) => {
    if (!file || typeof file !== 'object') return rejectPayload();
    const { name, mimeType, data, caption } = file as Record<string, unknown>;
    if (typeof name !== 'string' || !name.length || name.length > 1024 || typeof caption !== 'string' || caption.length > CLIPBOARD_LIMITS.captionCharacters || typeof data !== 'string') return rejectPayload();
    if (typeof mimeType !== 'string' || mimeType.length > 255 || (mimeType !== '' && !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(mimeType))) return rejectPayload();
    const normalizedMimeType = mimeType.toLowerCase() || 'application/octet-stream';
    const kind = ['image/png', 'image/jpeg', 'image/webp'].includes(normalizedMimeType) ? 'image' : 'file';
    if (data.length > Math.ceil(CLIPBOARD_LIMITS.fileBytes / 3) * 4) throw new RequestError(413, 'File exceeds size limit');
    if (data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data) || !/^[^=]*={0,2}$/.test(data)) return rejectPayload();
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > CLIPBOARD_LIMITS.fileBytes) throw new RequestError(413, 'File exceeds size limit');
    if (bytes.toString('base64') !== data || (kind === 'image' && !signatureMatches(bytes, normalizedMimeType as ClipboardRasterMimeType))) return rejectPayload();
    return { name, mimeType: normalizedMimeType, bytes, caption, kind };
  });
}

export async function readClipboardJson(request: IncomingMessage, maxBytes = CLIPBOARD_LIMITS.requestBytes): Promise<unknown> {
  const declared = request.headers['content-length'];
  if (declared && Number(declared) > maxBytes) throw new RequestError(413, 'Request exceeds size limit');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    let failed = false;
    request.on('data', (chunk: Buffer) => {
      if (failed) return;
      length += chunk.length;
      if (length > maxBytes) {
        failed = true;
        chunks.length = 0;
        reject(new RequestError(413, 'Request exceeds size limit'));
      } else chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new RequestError(400, 'Request aborted')));
    request.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new RequestError(400, 'Invalid JSON')); }
    });
  });
}

function trustedRequest(request: IncomingMessage): boolean {
  const host = request.headers.host;
  if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::[1-9][0-9]{0,4})?$/.test(host)) return false;
  return request.headers.origin === undefined || request.headers.origin === `http://${host}`;
}
function authenticated(request: IncomingMessage, token: string): boolean {
  const actual = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createClipboardServer(options: ClipboardServerOptions): Server {
  if (!options.token || !options.instanceId) throw new Error('Clipboard token and instance identity are required');
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    try {
      if (!trustedRequest(request)) throw new RequestError(403, 'Loopback Host and matching Origin required');
      if (request.method === 'GET' && request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(CLIPBOARD_PAGE);
        return;
      }
      if (!authenticated(request, options.token)) throw new RequestError(401, 'Bearer token required');
      if (request.method === 'GET' && request.url === '/api/health') {
        send(response, 200, { service: 'agro-clipboard', instanceId: options.instanceId });
      } else if (request.method === 'POST' && request.url === '/api/batches') {
        if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new RequestError(415, 'application/json required');
        const files = validateBatch(await readClipboardJson(request));
        send(response, 201, await storeClipboardBatch(options, files));
      } else send(response, 404, { error: 'Not found' });
    } catch (error) {
      if (!response.destroyed) send(response, error instanceof RequestError ? error.status : 500, { error: error instanceof RequestError ? error.message : 'Unable to store batch' });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

export function listenClipboardServer(server: Server, port: number, host = '127.0.0.1'): Promise<void> {
  if (!['127.0.0.1', '::1'].includes(host)) return Promise.reject(new Error('Clipboard server requires a loopback bind'));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
}
