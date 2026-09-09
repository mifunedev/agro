import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const WORKFLOW = join(ROOT, ".github", "workflows", "release.yml");
const workflow = readFileSync(WORKFLOW, "utf8");

const RECORDED_CONSUMER =
  "recorded expectation that this test never reads — the consumer side is proven in that repository, not here";
const ACTIONS_DEFAULT_SHELL_ARGV = ["--noprofile", "--norc", "-e"];
const CONSUMER_REPO = "mifunedev/agro-web";
const CONSUMER_WORKFLOW = ".github/workflows/pages.yml";
const CONSUMER_EVENT_TYPE = "agro-release";
const CONSUMER_PAYLOAD_KEY = "ref";
const CONSUMER_REF_EXPRESSION = "client_payload.ref || inputs.ref || 'main'";
const CONSUMER_REF_VARIABLE = "OH_SCRIPTS_REF";

const STEP_NAME = "      - name: Send the agro-release repository_dispatch\n";
const RUN_HEADER = "        run: |\n";
const BODY_INDENT = "          ";

const FIXTURE_SHA = "4f21a0c9b7e35d18aa62c0f4d9e7b1a3c5806fde";
const FIXTURE_REPO = "mifunedev/agro-web-fixture";
const FIXTURE_BRANCH = "main";

function jobBlock(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  expect(start, `job ${name} is not defined in release.yml`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const notifyDocs = jobBlock("notify-docs");

function dispatchStepScript(): string {
  const stepAt = workflow.indexOf(STEP_NAME);
  expect(stepAt, "the dispatch step was renamed; this test can no longer find its run body").toBeGreaterThan(-1);
  const step = workflow.slice(stepAt);
  const runAt = step.indexOf(RUN_HEADER);
  expect(runAt, "the dispatch step no longer carries a literal `run: |` body").toBeGreaterThan(-1);
  const lines: string[] = [];
  for (const line of step.slice(runAt + RUN_HEADER.length).split("\n")) {
    if (line.trim() === "") {
      lines.push("");
      continue;
    }
    if (!line.startsWith(BODY_INDENT)) break;
    lines.push(line.slice(BODY_INDENT.length));
  }
  const script = `${lines.join("\n").replace(/\s+$/, "")}\n`;
  expect(script).toContain("AGRO_WEB_DISPATCH_TOKEN");
  expect(script, "the run body carries a GitHub expression and is no longer executable as plain bash").not.toContain("${{");
  return script;
}

interface StepRun {
  status: number | null;
  stdout: string;
  stderr: string;
  ghCalls: string[][];
}

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function runDispatchStep(env: Record<string, string>, ghExitStatus = 0): StepRun {
  const root = mkdtempSync(join(tmpdir(), "agro-dispatch-step-"));
  roots.push(root);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const log = join(root, "gh-argv.log");
  writeFileSync(
    join(bin, "gh"),
    [
      "#!/usr/bin/env bash",
      `for arg in "$@"; do printf '%s\\n' "$arg" >> ${JSON.stringify(log)}; done`,
      `printf -- '--END--\\n' >> ${JSON.stringify(log)}`,
      `exit ${ghExitStatus}`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  const script = join(root, "step.sh");
  writeFileSync(script, dispatchStepScript());
  const result = spawnSync("bash", [...ACTIONS_DEFAULT_SHELL_ARGV, script], {
    encoding: "utf8",
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: root, ...env },
  });
  let ghCalls: string[][] = [];
  try {
    ghCalls = readFileSync(log, "utf8")
      .split("--END--\n")
      .filter((call) => call.length > 0)
      .map((call) => call.split("\n").filter((arg) => arg.length > 0));
  } catch {
    ghCalls = [];
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, ghCalls };
}

describe(`release.yml notify-docs — producer shape, checked against ${CONSUMER_REPO} ${CONSUMER_WORKFLOW} as a ${RECORDED_CONSUMER}`, () => {
  it("POSTs to the dispatches endpoint of the configured docs repository", () => {
    expect(notifyDocs).toContain("gh api --method POST");
    expect(notifyDocs).toContain('"/repos/${AGRO_WEB_REPO}/dispatches"');
    expect(notifyDocs).toMatch(/AGRO_WEB_REPO: \$\{\{ vars\.AGRO_WEB_REPO \|\| '[^']+' \}\}/);
  });

  it(`emits the event_type recorded for the consumer (${CONSUMER_EVENT_TYPE})`, () => {
    expect(notifyDocs).toContain(`-f event_type=${CONSUMER_EVENT_TYPE}`);
  });

  it(`emits the released commit under the payload key recorded for the consumer (client_payload[${CONSUMER_PAYLOAD_KEY}], which the consumer is recorded as reading via "${CONSUMER_REF_EXPRESSION}" into ${CONSUMER_REF_VARIABLE})`, () => {
    expect(notifyDocs).toContain(`-f "client_payload[${CONSUMER_PAYLOAD_KEY}]=\${RELEASE_SHA}"`);
    expect(notifyDocs).toContain("RELEASE_SHA: ${{ needs.reserve.outputs.releaseSha }}");
  });

  it("sources the ref from the reserve job's releaseSha, never from github.sha or a branch name", () => {
    expect(notifyDocs).not.toContain("github.sha");
    expect(notifyDocs).not.toContain("github.ref");
    expect(notifyDocs).not.toMatch(/client_payload\[ref\]=(main|master)/);
    expect(jobBlock("reserve")).toContain("releaseSha:");
  });

  it("runs only after finalize succeeds and only on a non-no-op release", () => {
    expect(notifyDocs).toContain("needs: [reserve, finalize]");
    expect(notifyDocs).toContain(
      "if: ${{ needs.reserve.outputs.publishedNoop != 'true' && needs.finalize.result == 'success' }}",
    );
  });

  it("takes the notice-and-skip path when AGRO_WEB_DISPATCH_TOKEN is empty, instead of POSTing", () => {
    expect(notifyDocs).toContain(
      "AGRO_WEB_DISPATCH_TOKEN: ${{ secrets.AGRO_WEB_DISPATCH_TOKEN }}",
    );
    const guard = notifyDocs.indexOf('if [ -z "$AGRO_WEB_DISPATCH_TOKEN" ]; then');
    const notice = notifyDocs.indexOf("::notice::Secret AGRO_WEB_DISPATCH_TOKEN is not set");
    const exit = notifyDocs.indexOf("exit 0");
    const post = notifyDocs.indexOf("gh api --method POST");
    expect(guard).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(guard);
    expect(exit).toBeGreaterThan(notice);
    expect(post).toBeGreaterThan(exit);
    expect(notifyDocs).toContain('GH_TOKEN="$AGRO_WEB_DISPATCH_TOKEN" gh api');
  });

  it("grants its automatic GITHUB_TOKEN read access only — the dispatch writes to the other repository through AGRO_WEB_DISPATCH_TOKEN, not through that token", () => {
    expect(notifyDocs).toContain("permissions:\n      contents: read");
    expect(notifyDocs).not.toContain("contents: write");
  });
});

describe("release.yml notify-docs — the real run body executed with gh stubbed and no network", () => {
  it("makes no gh call at all and exits 0 with a notice when the token is empty", () => {
    const run = runDispatchStep({
      AGRO_WEB_DISPATCH_TOKEN: "",
      AGRO_WEB_REPO: FIXTURE_REPO,
      RELEASE_SHA: FIXTURE_SHA,
    });
    expect(run.status).toBe(0);
    expect(run.ghCalls).toHaveLength(0);
    expect(run.stdout).toContain("::notice::Secret AGRO_WEB_DISPATCH_TOKEN is not set");
    expect(run.stdout).toContain(FIXTURE_REPO);
    expect(run.stdout).not.toContain("Dispatched");
  });

  it(`makes exactly one gh call carrying the repository, ${CONSUMER_EVENT_TYPE}, and the release SHA as client_payload[${CONSUMER_PAYLOAD_KEY}]`, () => {
    const run = runDispatchStep({
      AGRO_WEB_DISPATCH_TOKEN: "stub-token-not-a-credential",
      AGRO_WEB_REPO: FIXTURE_REPO,
      RELEASE_SHA: FIXTURE_SHA,
    });
    expect(run.status).toBe(0);
    expect(run.ghCalls).toHaveLength(1);
    const argv = run.ghCalls[0];
    expect(argv).toContain("api");
    expect(argv).toContain("--method");
    expect(argv).toContain("POST");
    expect(argv).toContain(`/repos/${FIXTURE_REPO}/dispatches`);
    expect(argv).toContain(`event_type=${CONSUMER_EVENT_TYPE}`);
    expect(argv).toContain(`client_payload[${CONSUMER_PAYLOAD_KEY}]=${FIXTURE_SHA}`);
    expect(argv).not.toContain(`client_payload[${CONSUMER_PAYLOAD_KEY}]=${FIXTURE_BRANCH}`);
    expect(argv.join(" ")).not.toContain("refs/heads");
    expect(run.stdout).toContain(`Dispatched ${CONSUMER_EVENT_TYPE} for ${FIXTURE_SHA} to ${FIXTURE_REPO}`);
  });

  it("keeps the failed-dispatch exit reachable: the body never disables errexit, and release.yml names no non-bash shell (an unspecified shell and an explicit bash both run with -e)", () => {
    expect(dispatchStepScript()).not.toContain("set +e");
    expect(workflow).not.toMatch(/\n[ \t]*shell:[ \t]*(?!bash[ \t]*(?:\n|$))\S+/);
  });

  it("exits non-zero when gh fails, rather than swallowing a failed dispatch", () => {
    const run = runDispatchStep(
      {
        AGRO_WEB_DISPATCH_TOKEN: "stub-token-not-a-credential",
        AGRO_WEB_REPO: FIXTURE_REPO,
        RELEASE_SHA: FIXTURE_SHA,
      },
      7,
    );
    expect(run.status).not.toBe(0);
    expect(run.ghCalls).toHaveLength(1);
    expect(run.stdout).not.toContain("Dispatched");
  });
});
