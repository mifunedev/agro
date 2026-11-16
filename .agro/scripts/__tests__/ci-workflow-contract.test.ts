import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = join(import.meta.dirname, "../../..");
const WORKFLOWS = join(ROOT, ".github", "workflows");

type Step = {
  name?: string;
  run?: string;
  shell?: string;
};

type Job = {
  if?: string;
  "runs-on"?: string;
  steps?: Step[];
  "timeout-minutes"?: number;
  uses?: string;
};

type Workflow = {
  jobs: Record<string, Job>;
  on: { push?: { branches?: string[] } };
};

function workflow(file: string): Workflow {
  return parse(readFileSync(join(WORKFLOWS, file), "utf8"));
}

const WORKFLOW_FILES = readdirSync(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file));

const KEEP_HOME_STEP = "Keep the job HOME in login shells";

const CLI_INSTALL_SMOKE_JOBS: [string, string, (step: Step) => boolean][] = [
  ["ci-harness.yml", "ci", (step) => step.run?.includes("pnpm test:scripts") ?? false],
  [
    "sandbox-boot-guard.yml",
    "sandbox-boot-guard",
    (step) => step.run?.includes("cli-first-install-smoke.sh") ?? false,
  ],
];

const EXPECTED_TIMEOUTS: Record<string, Record<string, number>> = {
  "ci-harness.yml": { ci: 20, "boot-lint": 10 },
  "sandbox-boot-guard.yml": { "sandbox-boot-guard": 45, "sandbox-upgrade-guard": 45 },
  "sandbox-compatibility.yml": { "base-node-pnpm-parity": 10, "optional-harness-install": 45 },
  "release.yml": { reserve: 10, finalize: 10, "publish-image": 45 },
  "publish-cli.yml": { "publish-npm": 15 },
  "close-issues-on-development.yml": { "close-linked-issues": 10 },
};

describe("CI workflow contract", () => {
  it.each(WORKFLOW_FILES)("%s sets timeout-minutes on every job that runs steps", (file) => {
    const missing = Object.entries(workflow(file).jobs)
      .filter(([, job]) => job.uses === undefined)
      .filter(([, job]) => typeof job["timeout-minutes"] !== "number")
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it.each(WORKFLOW_FILES)("%s sets no timeout-minutes on a reusable workflow call", (file) => {
    const invalid = Object.entries(workflow(file).jobs)
      .filter(([, job]) => job.uses !== undefined && job["timeout-minutes"] !== undefined)
      .map(([name]) => name);
    expect(invalid).toEqual([]);
  });

  it.each(Object.entries(EXPECTED_TIMEOUTS))("%s timeouts match the approved table", (file, expected) => {
    const jobs = workflow(file).jobs;
    const actual = Object.fromEntries(
      Object.keys(expected).map((name) => [name, jobs[name]?.["timeout-minutes"]]),
    );
    expect(actual).toEqual(expected);
  });

  it.each(["ci-harness.yml", "sandbox-boot-guard.yml", "sandbox-compatibility.yml"])(
    "%s does not run on main pushes",
    (file) => {
      expect(workflow(file).on.push?.branches ?? []).not.toContain("main");
    },
  );

  it.each(CLI_INSTALL_SMOKE_JOBS)(
    "%s job %s keeps the job HOME before the first CLI install smoke",
    (file, job, runsSmoke) => {
      const steps = workflow(file).jobs[job].steps ?? [];
      const keepHome = steps.findIndex((step) => step.name === KEEP_HOME_STEP);
      const firstSmoke = steps.findIndex(runsSmoke);
      expect(keepHome).toBeGreaterThanOrEqual(0);
      expect(firstSmoke).toBeGreaterThan(keepHome);
      expect(steps[keepHome].shell).toBe("bash");
      expect(steps[keepHome].run).toContain("/etc/profile.d/blacksmith.sh");
      expect(steps[keepHome].run).toContain("exit 1");
    },
  );

  it("base-node-pnpm-parity follows the CI runner variable", () => {
    expect(workflow("sandbox-compatibility.yml").jobs["base-node-pnpm-parity"]["runs-on"]).toBe(
      "${{ vars.CI_RUNNER || 'ubuntu-latest' }}",
    );
  });

  it("optional-harness-install skips pull requests", () => {
    expect(workflow("sandbox-compatibility.yml").jobs["optional-harness-install"].if).toBe(
      "github.event_name != 'pull_request'",
    );
  });
});
