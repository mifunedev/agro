import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.env.PROBE_INSTALL_ROOT ?? "");
assert.ok(process.argv[2] || process.env.PROBE_INSTALL_ROOT, "Pass a temporary npm installation root");
for (const key of ["HOME", "PI_CODING_AGENT_DIR"]) {
  assert.ok(process.env[key]?.startsWith(`${root}${sep}`), `${key} must be inside the temporary installation root`);
}
const host = join(root, "node_modules/@earendil-works/pi-coding-agent");
const pkg = join(root, "node_modules/@juicesharp/rpiv-ask-user-question");
const manifest = async (dir) => JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
const piVersion = (await manifest(host)).version;
const packageVersion = (await manifest(pkg)).version;
assert.equal(packageVersion, "2.15.0");
console.log(JSON.stringify({ node: process.version, piVersion, packageVersion }));
const scratch = await mkdtemp(join(root, "probe-"));
let runtime;
try {
  const cwd = join(scratch, "project");
  await mkdir(cwd);
  await mkdir(process.env.PI_CODING_AGENT_DIR, { recursive: true });
  const { discoverAndLoadExtensions } = await import(pathToFileURL(join(host, "dist/core/extensions/loader.js")));
  const loaded = await discoverAndLoadExtensions([pkg], cwd, process.env.PI_CODING_AGENT_DIR);
  runtime = loaded.runtime;
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(loaded.warnings, []);
  assert.equal(loaded.extensions.length, 1);
  const extension = loaded.extensions[0];
  assert.equal(extension.resolvedPath, join(pkg, "index.ts"));
  assert.deepEqual([...extension.tools.keys()], ["ask_user_question"]);
  const tool = extension.tools.get("ask_user_question").definition;
  assert.equal(tool.exposure, "model-only");
  assert.equal(typeof tool.execute, "function");
  const handlers = extension.handlers.get("before_agent_start");
  assert.equal(handlers.length, 1);
  console.log("PASS manifest discovery + real extension loader + tool and reconciler registration");

  let active = ["read", tool.name];
  runtime.getActiveTools = () => [...active];
  runtime.setActiveTools = (names) => { active = [...names]; };
  const reconcile = async (hasUI) => {
    for (const handler of handlers) await handler({ type: "before_agent_start" }, { hasUI, mode: hasUI ? "rpc" : "print" });
  };
  const question = {
    question: "Which environment?",
    header: "Environment",
    options: [
      { label: "Staging", description: "Use the staging environment" },
      { label: "Production", description: "Use the production environment" },
    ],
  };
  const params = { questions: [question] };
  const execute = (id, args, ui, hasUI = true) => tool.execute(id, args, undefined, undefined, { cwd, mode: hasUI ? "rpc" : "print", hasUI, ui });
  let selects = 0;
  const failInput = async () => { assert.fail("Unexpected input dialog"); };
  const answer = await execute("probe-answer", params, {
    select: async (title, options) => {
      selects++;
      assert.match(title, /Which environment\?/);
      assert.equal(options.length, 3);
      assert.match(options[0], /Staging/);
      return options[0];
    },
    input: failInput,
  });
  assert.equal(selects, 1);
  assert.equal(answer.details.cancelled, false);
  assert.equal(answer.details.answers[0].questionIndex, 0);
  assert.equal(answer.details.answers[0].kind, "option");
  assert.equal(answer.details.answers[0].answer, "Staging");
  assert.match(answer.content[0].text, /User has answered your questions:/);
  console.log(`PASS structured option answer ${JSON.stringify(answer.details)}`);

  let inputs = 0;
  const custom = await execute("probe-custom", params, {
    select: async (_title, options) => options.at(-1),
    input: async (title) => {
      inputs++;
      assert.match(title, /Which environment\?/);
      return "Preview environment";
    },
  });
  assert.equal(inputs, 1);
  assert.equal(custom.details.cancelled, false);
  assert.equal(custom.details.answers[0].kind, "custom");
  assert.equal(custom.details.answers[0].answer, "Preview environment");
  console.log(`PASS structured custom answer ${JSON.stringify(custom.details)}`);

  const cancelled = await execute("probe-cancel", params, { select: async () => undefined, input: failInput });
  assert.deepEqual(cancelled.details, { answers: [], cancelled: true });
  assert.equal(cancelled.content[0].text, "User declined to answer questions");
  console.log(`PASS dialog cancellation ${JSON.stringify(cancelled.details)}`);

  await reconcile(false);
  assert.deepEqual(active, ["read"]);
  await reconcile(false);
  assert.deepEqual(active, ["read"]);
  const noUI = await execute("probe-no-ui", params, {}, false);
  assert.deepEqual(noUI.details, { answers: [], cancelled: true, error: "no_ui" });
  assert.match(noUI.content[0].text, /UI not available/);
  await reconcile(true);
  assert.deepEqual(active, ["read", tool.name]);
  await reconcile(true);
  assert.deepEqual(active, ["read", tool.name]);
  console.log("PASS no-UI removal, idempotence, execution backstop, RPC restoration and sibling preservation");
  console.log("PASS all checks; no session prompt or model API invoked");
} finally {
  runtime?.invalidate();
  await rm(scratch, { recursive: true, force: true });
  console.log("CLEANUP probe scratch removed; caller owns installation-root cleanup");
}
