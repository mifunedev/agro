import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const host = process.env.PI_HOST ?? '/home/sandbox/.local/lib/node_modules/@earendil-works/pi-coding-agent';
const scratch = mkdtempSync(resolve('.agro/tasks/pi-extension-issues/evidence/runtime-'));
process.env.HOME = join(scratch, 'home');
process.env.PI_CODING_AGENT_DIR = join(scratch, 'agent');
process.env.npm_config_cache = join(scratch, 'npm-cache');
process.env.PI_LOOP = join(scratch, 'loops.json');
mkdirSync(process.env.HOME, { recursive: true });
const mod = async (file) => import(pathToFileURL(join(host, 'dist/core', file)));
const { DefaultPackageManager } = await mod('package-manager.js');
const { SettingsManager } = await mod('settings-manager.js');
const { DefaultResourceLoader } = await mod('resource-loader.js');
const { createEventBus } = await mod('event-bus.js');
const { SessionManager } = await mod('session-manager.js');
const eventBus = createEventBus();
const oldPins = ['npm:@narumitw/pi-goal@0.4.2', 'npm:@trevonistrevon/pi-loop@0.5.5'];
const newPins = ['npm:@narumitw/pi-goal@0.54.8', 'npm:@trevonistrevon/pi-loop@0.7.15'];
console.log('Pi', JSON.parse(readFileSync(join(host, 'package.json'))).version, 'Node', process.version);
async function load(label, agentDir, pins, update = false) {
  mkdirSync(agentDir, { recursive: true });
  const settingsManager = SettingsManager.inMemory({ packages: pins });
  const pm = new DefaultPackageManager({ cwd: scratch, agentDir, settingsManager });
  if (update) {
    writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ packages: pins }));
    const output = execFileSync(process.execPath, [join(host, 'dist/cli.js'), 'update', '--extensions', '--no-approve'], {
      cwd: scratch, env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, timeout: 30000, encoding: 'utf8',
    });
    console.log('pi update --extensions --no-approve EXIT=0', output.trim());
  }
  await pm.resolve();
  const manifests = pins.map(pin => JSON.parse(readFileSync(join(pm.getInstalledPath(pin, 'user'), 'package.json'))));
  console.log(label, 'manifests', JSON.stringify(manifests.map(({name,version,dependencies,peerDependencies}) => ({name,version,dependencies,peerDependencies}))));
  if (label !== 'original') {
    assert.deepEqual(manifests.map(m => m.version), ['0.54.8', '0.7.15']);
    for (const manifest of manifests) {
      assert.equal(manifest.peerDependencies.typebox, '*');
      assert(!manifest.dependencies?.typebox);
      assert(Object.values(manifest.peerDependencies).every(range => range === '*'));
    }
    const kit = JSON.parse(readFileSync(join(agentDir, 'npm/node_modules/@narumitw/pi-tui-kit/package.json')));
    console.log(label, 'tui-kit', JSON.stringify({ version: kit.version, dependencies: kit.dependencies, peerDependencies: kit.peerDependencies }));
  }
  const loader = new DefaultResourceLoader({ cwd: scratch, agentDir, settingsManager, eventBus, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await loader.reload();
  const result = loader.getExtensions();
  console.log(label, 'errors', JSON.stringify(result.errors), 'warnings', JSON.stringify(result.warnings));
  console.log(label, 'registered', JSON.stringify(result.extensions.map(e => ({ tools: [...e.tools.keys()], commands: [...e.commands.keys()] }))));
  return result;
}
try {
  const old = await load('original', join(scratch, 'reconcile'), oldPins);
  assert.equal(old.warnings.length, 2);
  const clean = await load('clean', join(scratch, 'clean'), newPins);
  assert.deepEqual(clean.errors, []);
  assert.deepEqual(clean.warnings, []);
  const reconciled = await load('reconciled', join(scratch, 'reconcile'), newPins, true);
  assert.deepEqual(reconciled.errors, []);
  assert.deepEqual(reconciled.warnings, []);
  const { extensions, runtime } = reconciled;
  const tools = new Map(extensions.flatMap(e => [...e.tools]));
  const commands = new Map(extensions.flatMap(e => [...e.commands]));
  for (const name of ['goal_complete', 'goal_blocked', 'goal_wait', 'LoopCreate', 'LoopList', 'LoopDelete', 'MonitorCreate', 'MonitorList', 'MonitorStop']) assert(tools.has(name), name);
  for (const name of ['goal', 'loop']) assert(commands.has(name), name);
  const sessionManager = SessionManager.inMemory(scratch);
  const sent = [];
  const ctx = {
    cwd: scratch, mode: 'json', hasUI: false, sessionManager,
    isIdle: () => true, hasPendingMessages: () => false,
    getContextUsage: () => undefined,
    ui: { notify: (message, level) => { if (level === 'error') throw new Error(message); }, setStatus: () => {}, setWidget: () => {}, confirm: async () => true },
  };
  Object.assign(runtime, {
    appendEntry: (type, data) => sessionManager.appendCustomEntry(type, data),
    sendMessage: (...args) => sent.push(args), sendUserMessage: (...args) => sent.push(args),
    getActiveTools: () => [...tools.keys()], getAllTools: () => [...tools.values()].map(t => t.definition),
    getSettings: () => ({}), createContext: () => ctx,
  });
  const emit = async type => {
    for (const extension of extensions) for (const handler of extension.handlers.get(type) ?? []) await handler({ type }, ctx);
  };
  const execute = (name, args) => tools.get(name).definition.execute('review', args, undefined, undefined, ctx);
  try {
    await emit('session_start');
    await commands.get('goal').handler('Verify disposable runtime', ctx);
    const states = () => sessionManager.getBranch().filter(e => e.type === 'custom' && e.customType.includes('goal')).map(e => e.data);
    assert.equal(states().at(-1).goal.status, 'active');
    console.log('goal started', JSON.stringify(states()));
    await commands.get('goal').handler('pause', ctx);
    assert.equal(states().at(-1).goal.status, 'paused');
    console.log('goal paused', JSON.stringify(states().slice(-1)));
    await commands.get('goal').handler('clear', ctx);
    assert.equal(states().at(-1).goal, null);
    console.log('goal cleared', JSON.stringify(states().slice(-1)));
    assert(sent.length > 0, 'goal prompt captured without a model call');
    const completed = new Promise((resolveDone, reject) => {
      const timer = setTimeout(() => reject(new Error('Monitor exceeded 10s')), 10000);
      eventBus.on('monitor:done', event => { clearTimeout(timer); resolveDone(event); });
    });
    console.log('monitor create', JSON.stringify(await execute('MonitorCreate', { command: "printf 'pi-compat-ok\\n'", timeout: 2000 })));
    const done = await completed;
    console.log('monitor done', JSON.stringify(done));
    assert.equal(done.exitCode, 0);
    const list = await execute('MonitorList', {});
    console.log('monitor list', JSON.stringify(list));
    assert(JSON.stringify(list).includes('pi-compat-ok'));
  } finally {
    await emit('session_shutdown');
    runtime.invalidate();
  }
  console.log('PASS installation, reconciliation, loader and bounded capabilities');
} finally {
  rmSync(scratch, { recursive: true, force: true });
  console.log('Disposable state removed');
}
