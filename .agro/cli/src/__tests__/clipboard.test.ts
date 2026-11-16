import { describe, expect, it } from 'vitest';
import { parseClipboardArgs, clipboardProjectId, clipboardShellQuote, clipboardHealthMatches, runClipboard } from '../commands/clipboard.js';

describe('clipboard lifecycle contract', () => {
  it('defaults to port 3500 and parses strict ports', () => {
    expect(parseClipboardArgs(['start'])).toEqual({ help: false, verb: 'start', port: 3500 });
    for (const port of ['1', '3500', '65535']) expect(parseClipboardArgs(['start', '--port', port]).port).toBe(Number(port));
    for (const port of ['', '0', '-1', '65536', '3.5', '1e3', '3500abc', ' 3500', '+3500']) expect(() => parseClipboardArgs(['start', '--port', port])).toThrow(/port/);
    expect(() => parseClipboardArgs(['start', '--port'])).toThrow(/port/);
  });
  it('rejects unknown verbs and arguments', () => {
    for (const args of [['serve'], ['stop', '--port', '3500'], ['start', 'extra'], ['start', '--port', '1', '--port', '2']]) expect(() => parseClipboardArgs(args)).toThrow();
    expect(parseClipboardArgs(['start', '--help']).help).toBe(true);
    expect(parseClipboardArgs(['stop', '-h']).help).toBe(true);
  });
  it('isolates project names and quotes shell metacharacters', () => {
    expect(clipboardProjectId('/a')).not.toBe(clipboardProjectId('/b'));
    expect(clipboardProjectId('/a')).toMatch(/^[a-f0-9]{64}$/);
    expect(clipboardShellQuote("/a b/'$(id)" )).toBe("'/a b/'\"'\"'$(id)'");
  });
  it('requires both service and instance readiness identity', () => {
    expect(clipboardHealthMatches({ service: 'agro-clipboard', instanceId: 'a' }, 'a')).toBe(true);
    expect(clipboardHealthMatches({ service: 'agro-clipboard', instanceId: 'b' }, 'a')).toBe(false);
    expect(clipboardHealthMatches({ service: 'other', instanceId: 'a' }, 'a')).toBe(false);
    expect(clipboardHealthMatches(null, 'a')).toBe(false);
  });
  it('refuses the host before accessing project state', async () => {
    let error = '';
    expect(await runClipboard(['start'], { stdout: () => {}, stderr: (s) => { error += s; } }, { insideSandbox: () => false })).toBe(1);
    expect(error).toContain('agro shell');
  });
});
