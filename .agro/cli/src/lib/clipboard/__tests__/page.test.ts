import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { CLIPBOARD_PAGE } from '../page.js';

function browserHarness(hash = '#token=' + 'b'.repeat(64), storageDenied = false) {
  const nodes = new Map<string, any>();
  const listeners: Record<string, (event: any) => void> = {};
  const revoked: string[] = [];
  const values = new Map();
  let request: any;
  let copied = '';
  function element() {
    const node: any = { children: [], value: '', dataset: {}, disabled: false, hidden: true, classList: { toggle() {}, add() {}, remove() {} },
      append(...children: any[]) { this.children.push(...children); },
      replaceChildren(...children: any[]) { this.children = children; },
      setAttribute(key: string, value: string) { this[key] = value; }, removeAttribute(key: string) { delete this[key]; },
      addEventListener() {}, querySelectorAll() { return []; }, focus() {}, select() { this.selected = true; }, click() { this.onclick?.(); } };
    return node;
  }
  const storage = { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) };
  const document = { documentElement: element(), createElement: element, getElementById(id: string) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); }, addEventListener(name: string, callback: (event: any) => void) { listeners[name] = callback; } };
  const location = { hash, origin: 'http://localhost:3500', pathname: '/', search: '' };
  let id = 0;
  const context: any = {
    document, location, history: { replaceState() { location.hash = ''; } }, localStorage: storage,
    window: { sessionStorage: storage, matchMedia: () => ({ matches: true, addEventListener() {} }), addEventListener(name: string, callback: (event: any) => void) { listeners[name] = callback; } },
    navigator: { clipboard: { writeText: async (text: string) => { copied = text; } } },
    crypto: { randomUUID: () => 'stable-' + (++id) }, URL: { createObjectURL: () => 'blob:' + id, revokeObjectURL: (url: string) => revoked.push(url) }, TextEncoder,
    FileReader: class { result = 'data:image/png;base64,iVBORw0KGgo='; onload?: () => void; readAsDataURL() { this.onload?.(); } },
    XMLHttpRequest: class {
      upload = {}; headers: Record<string, string> = {}; status = 0; responseText = ''; body = ''; onload?: () => void; onerror?: () => void;
      constructor() { request = this; }
      open(method: string, path: string) { Object.assign(this, { method, path }); }
      setRequestHeader(key: string, value: string) { this.headers[key] = value; }
      send(body: string) { this.body = body; }
    },
  };
  if (storageDenied) {
    const denied = () => { throw new Error('Storage denied'); };
    Object.defineProperty(context, 'localStorage', { get: denied });
    Object.defineProperty(context.window, 'sessionStorage', { get: denied });
  }
  runInNewContext(CLIPBOARD_PAGE.match(/<script>([\s\S]*?)<\/script>/)![1], context);
  return { nodes, listeners, revoked, document, context, location, get request() { return request; }, get copied() { return copied; } };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function logic() {
  const script = CLIPBOARD_PAGE.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  return runInNewContext(script + '\n;({validateFiles, validateCards, removeCard, readToken, chooseTheme, textElement});', { TextEncoder });
}
const file = (type = 'image/png', size = 10) => ({ type, size, name: '<img onerror=alert(1)>.png' });
describe('clipboard page', () => {
  it('keeps stable captions on removal and releases only removed previews', () => {
    const { removeCard } = logic();
    const cards = [{ id: 'a', caption: 'first', url: 'blob:a' }, { id: 'b', caption: 'second', url: 'blob:b' }];
    const revoked: string[] = [];
    const remaining = removeCard(cards, 'a', (url: string) => revoked.push(url));
    expect(remaining).toEqual([cards[1]]);
    expect(remaining[0].caption).toBe('second');
    expect(revoked).toEqual(['blob:a']);
    expect([...remaining, { id: 'c', caption: '' }][0].caption).toBe('second');
  });
  it('validates types, counts, bytes, captions and actual JSON UTF-8 size', () => {
    const { validateFiles, validateCards } = logic();
    expect(validateFiles([file()], 9)).toBe('');
    expect(validateFiles([file()], 10)).toMatch(/10 images/);
    for (const type of ['image/svg+xml', 'application/pdf', '']) expect(validateFiles([file(type)], 0)).toMatch(/PNG, JPEG/);
    expect(validateFiles([file('image/png', 10 * 1024 * 1024 + 1)], 0)).toMatch(/10 MiB/);
    expect(validateFiles([file('image/png', 0)], 0)).toMatch(/empty/);
    expect(validateCards([{ caption: 'x'.repeat(2001) }], '{}')).toMatch(/2000/);
    expect(validateCards([{ caption: '' }], 'é'.repeat(26 * 1024 * 1024))).toMatch(/50 MiB/);
  });
  it('consumes fragments, scopes stored credentials by origin and handles blocked storage', () => {
    const { readToken } = logic();
    const values = new Map();
    const storage = { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    let replaced = '';
    const location = { hash: '#token=' + 'a'.repeat(64), origin: 'http://localhost:3500', pathname: '/', search: '' };
    const history = { replaceState: (_a: unknown, _b: string, path: string) => { replaced = path; } };
    expect(readToken(location, history, storage)).toBe('a'.repeat(64));
    expect(replaced).toBe('/');
    expect(readToken({ ...location, hash: '' }, history, storage)).toBe('a'.repeat(64));
    expect(readToken({ ...location, hash: '', origin: 'http://localhost:3501' }, history, storage)).toBe('');
    expect(readToken({ ...location, hash: '#token=bad' }, history, storage)).toBe('');
    expect(readToken(location, history, { setItem() { throw Error(); } })).toBe('a'.repeat(64));
  });
  it('defaults to system theme and honors an explicit selection', () => {
    const { chooseTheme } = logic();
    expect(chooseTheme(null, true)).toBe('dark');
    expect(chooseTheme('invalid', false)).toBe('light');
    expect(chooseTheme('light', true)).toBe('light');
  });
  it('initializes, consumes tokens and toggles themes when browser storage is denied', () => {
    const browser = browserHarness('#token=' + 'c'.repeat(64), true);
    expect(browser.location.hash).toBe('');
    expect(browser.nodes.get('auth').textContent).toBe('');
    expect(browser.document.documentElement.dataset.theme).toBe('dark');
    expect(() => browser.nodes.get('theme').onclick()).not.toThrow();
    expect(browser.document.documentElement.dataset.theme).toBe('light');
    expect(browserHarness('', true).nodes.get('auth').textContent).toMatch(/Access token missing/);
  });
  it('handles real paste/drop event shapes, ordered captions, removal and upload reset', async () => {
    const browser = browserHarness();
    const { nodes, listeners, revoked } = browser;
    const first = { ...file(), name: '<img src=x onerror=alert(1)>.png' };
    listeners.paste({ clipboardData: { files: [first] }, preventDefault() {} });
    let cards = nodes.get('cards').children;
    expect(cards[0].children[1].children[0].children[0].textContent).toBe(first.name);
    cards[0].children[1].children[3].value = 'first <script>caption</script>';
    cards[0].children[1].children[3].oninput();
    listeners.drop({ dataTransfer: { items: [{ kind: 'file', getAsFile: () => file() }] }, preventDefault() {} });
    cards = nodes.get('cards').children;
    expect(cards[0].children[1].children[3].value).toBe('first <script>caption</script>');
    cards[1].children[1].children[3].value = 'second';
    cards[1].children[1].children[3].oninput();
    cards[0].children[1].children[0].children[1].onclick();
    expect(revoked).toEqual(['blob:1']);
    expect(nodes.get('cards').children[0].children[1].children[3].value).toBe('second');
    nodes.get('files').files = [file()]; nodes.get('files').onchange();
    const upload = nodes.get('upload').onclick(); await flush();
    expect(browser.request.path).toBe('/api/batches');
    expect(browser.request.headers.Authorization).toBe('Bearer ' + 'b'.repeat(64));
    expect(JSON.parse(browser.request.body).images.map((image: any) => image.caption)).toEqual(['second', '']);
    expect(JSON.parse(browser.request.body).images[0].data).toBe('iVBORw0KGgo=');
    browser.request.status = 201;
    browser.request.responseText = JSON.stringify({ manifestPath: '/manifest.json', images: [{ path: '/image.png' }], prompt: '<script>agent prompt</script>' });
    browser.request.onload(); await upload;
    expect(nodes.get('cards').children).toEqual([]);
    expect(revoked).toEqual(['blob:1', 'blob:2', 'blob:3']);
    expect(nodes.get('paths').children.map((node: any) => node.textContent)).toEqual(['/manifest.json', '/image.png']);
    await nodes.get('copy').onclick();
    expect(browser.copied).toBe('<script>agent prompt</script>');
    browser.context.navigator.clipboard.writeText = async () => { throw Error(); };
    await nodes.get('copy').onclick();
    expect(nodes.get('prompt').selected).toBe(true);
  });
  it('preserves previews and captions on 401, network failure and text-only server errors', async () => {
    const browser = browserHarness();
    browser.listeners.paste({ clipboardData: { files: [file()] }, preventDefault() {} });
    const input = browser.nodes.get('cards').children[0].children[1].children[3];
    input.value = 'keep this'; input.oninput();
    for (const failure of ['401', 'network', '500']) {
      const upload = browser.nodes.get('upload').onclick(); await flush();
      if (failure === 'network') browser.request.onerror();
      else { browser.request.status = Number(failure); browser.request.responseText = JSON.stringify({ error: '<img onerror=bad>' }); browser.request.onload(); }
      await upload;
      expect(browser.nodes.get('cards').children[0].children[1].children[3].value).toBe('keep this');
      expect(browser.nodes.get('upload').disabled).toBe(false);
      expect(browser.revoked).toEqual([]);
    }
    expect(browser.nodes.get('status').textContent).toBe('<img onerror=bad>');
    expect(browser.nodes.get('status').innerHTML).toBeUndefined();
  });
  it('disables unauthenticated uploads and accepts refreshed fragment access without losing cards', () => {
    const browser = browserHarness('');
    browser.listeners.paste({ clipboardData: { files: [file()] }, preventDefault() {} });
    expect(browser.nodes.get('upload').disabled).toBe(true);
    expect(browser.nodes.get('auth').textContent).toMatch(/agro clipboard start/);
    const card = browser.nodes.get('cards').children[0];
    browser.location.hash = '#token=' + 'a'.repeat(64);
    browser.listeners.hashchange({});
    expect(browser.location.hash).toBe('');
    expect(browser.nodes.get('upload').disabled).toBe(false);
    expect(browser.nodes.get('cards').children[0]).toBe(card);
    expect(browser.document.documentElement.dataset.theme).toBe('dark');
    browser.nodes.get('theme').onclick();
    expect(browser.document.documentElement.dataset.theme).toBe('light');
  });
  it('uses text-only elements and offline embedded assets', () => {
    const { textElement } = logic();
    const node = textElement({ createElement: () => ({}) }, 'p', '<script>bad</script>');
    expect(node.textContent).toBe('<script>bad</script>');
    expect(node.innerHTML).toBeUndefined();
    expect(CLIPBOARD_PAGE).not.toMatch(/innerHTML|https?:\/\/|@import/);
    expect(CLIPBOARD_PAGE).toContain('AGRO Clipboard');
    expect(CLIPBOARD_PAGE).toContain('clipboardData');
    expect(CLIPBOARD_PAGE).toContain('aria-live');
  });
});
