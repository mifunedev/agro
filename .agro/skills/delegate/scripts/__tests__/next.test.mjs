import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BRANCH, NEXT_SH, SLUG, basePrd, createFixture, story } from "./fixture.mjs";

const GIT_SKILL = fileURLToPath(new URL("../../../git/SKILL.md", import.meta.url));

let fx;

beforeEach(() => {
  fx = createFixture();
});

afterEach(() => {
  fx.cleanup();
});

function expectState(result, state, action) {
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.lines).toHaveLength(2);
  expect(result.lines[0]).toBe(state);
  if (action !== undefined) expect(result.lines[1]).toBe(action);
}

const STOP_BLOCKED = "Stop. The operator clears blocked in prd.json.";

describe("output contract", () => {
  test("next.sh is executable", () => {
    expect(statSync(NEXT_SH).mode & 0o111).not.toBe(0);
  });

  test("prints one state line and one action line and exits 0", () => {
    fx.ready();
    expectState(fx.run(), "ready", "Run gh pr ready 7.");
  });

  test("rejects an unknown argument with a non-zero exit", () => {
    fx.ready();
    const result = fx.run(["--bogus"]);
    expect(result.status).not.toBe(0);
  });

  test("rejects --task without a slug", () => {
    fx.ready();
    expect(fx.run(["--task"]).status).not.toBe(0);
  });
});

describe("task binding", () => {
  test("binds the task whose branchName equals the current branch", () => {
    fx.ready();
    fx.writePrd(basePrd({ branchName: "feat/2-other" }), "other");
    fx.writePrdMd("None.", "other");
    expectState(fx.run(), "ready");
  });

  test("prints none when no task matches the current branch", () => {
    fx.ready();
    fx.git("checkout", "-q", "-b", "skill/1-worker");
    expectState(fx.run(), "none", "Stop.");
  });

  test("ignores archived tasks", () => {
    fx.ready();
    fx.git("checkout", "-q", "-b", "feat/9-archived");
    fx.writePrd(basePrd({ branchName: "feat/9-archived" }), "archive/2026-01-01/old");
    expectState(fx.run(), "none");
  });

  test("--task selects the task by slug instead of by branch", () => {
    fx.ready();
    fx.writePrd(basePrd({ branchName: "feat/2-other", userStories: [story("US-004", { passes: false })] }), "other");
    expectState(fx.run(["--task", "other"]), "story US-004");
    fx.git("checkout", "-q", "-b", "skill/1-worker");
    expectState(fx.run(["--task", "other"]), "story US-004");
  });

  test("--task with a missing task prints none", () => {
    fx.ready();
    expectState(fx.run(["--task", "missing"]), "none", "Stop.");
  });

  test("two matching tasks print blocked with both slugs", () => {
    fx.ready();
    fx.writePrd(basePrd(), "twin");
    const result = fx.run();
    expectState(result, "blocked multiple tasks: demo twin", STOP_BLOCKED);
  });

  test("an unreadable prd.json selected by --task prints blocked with the path", () => {
    fx.ready();
    fx.writePrd("{ not json", "broken");
    expectState(fx.run(["--task", "broken"]), "blocked unreadable .agro/tasks/broken/prd.json", STOP_BLOCKED);
  });

  test("an unreadable prd.json that names the current branch prints blocked with the path", () => {
    fx.ready();
    fx.writePrd(`{ "branchName": "${BRANCH}", `);
    expectState(fx.run(), `blocked unreadable .agro/tasks/${SLUG}/prd.json`, STOP_BLOCKED);
  });

  test("a prd.json without read permission prints blocked with the path", () => {
    fx.ready();
    const file = path.join(fx.work, `.agro/tasks/${SLUG}/prd.json`);
    chmodSync(file, 0o000);
    try {
      readFileSync(file);
      return;
    } catch {
      expectState(fx.run(["--task", SLUG]), `blocked unreadable .agro/tasks/${SLUG}/prd.json`);
    } finally {
      chmodSync(file, 0o644);
    }
  });

  test("works from a subdirectory of the repository", () => {
    fx.ready();
    const result = execFileSync("bash", [NEXT_SH], {
      cwd: path.join(fx.work, "src"),
      env: { ...process.env, PATH: `${path.join(fx.root, "bin")}${path.delimiter}${process.env.PATH}`, GH_STUB_LOG: fx.ghLog, GH_STUB_CHECKS: "pass", GH_STUB_DRAFT: "false" },
      encoding: "utf8",
    });
    expect(result.split("\n")[0]).toBe("done");
  });
});

describe("blocked", () => {
  test("a non-empty blocked reason prints blocked with the reason", () => {
    fx.ready({ prd: basePrd({ blocked: "waiting for the operator" }) });
    expectState(fx.run(), "blocked waiting for the operator", STOP_BLOCKED);
  });

  test("an empty blocked string does not block", () => {
    fx.ready({ prd: basePrd({ blocked: "" }) });
    expectState(fx.run(), "ready");
  });
});

describe("story", () => {
  test("names the lowest-priority ready story", () => {
    fx.ready({
      prd: basePrd({
        userStories: [
          story("US-001"),
          story("US-002", { passes: false, dependsOn: ["US-003"] }),
          story("US-003", { passes: false }),
          story("US-004", { passes: false }),
        ],
      }),
    });
    expectState(fx.run(), "story US-003", "Dispatch, verify, and accept US-003 per /delegate.");
  });

  test("uses priority, not document order", () => {
    fx.ready({
      prd: basePrd({
        userStories: [story("US-001", { passes: false, priority: 5 }), story("US-002", { passes: false, priority: 2 })],
      }),
    });
    expectState(fx.run(), "story US-002");
  });

  test("a story whose dependency passes is ready", () => {
    fx.ready({
      prd: basePrd({ userStories: [story("US-001"), story("US-002", { passes: false, dependsOn: ["US-001"] })] }),
    });
    expectState(fx.run(), "story US-002");
  });

  test("no ready story prints blocked", () => {
    fx.ready({
      prd: basePrd({
        userStories: [
          story("US-001", { passes: false, dependsOn: ["US-002"] }),
          story("US-002", { passes: false, dependsOn: ["US-001"] }),
        ],
      }),
    });
    expectState(fx.run(), "blocked no ready story", STOP_BLOCKED);
  });

  test("a story with rounds greater than 2 prints blocked with the story ID", () => {
    fx.ready({
      prd: basePrd({ userStories: [story("US-001", { passes: false }), story("US-002", { passes: false, rounds: 3 })] }),
    });
    expectState(fx.run(), "blocked US-002 exceeded 2 repair rounds", STOP_BLOCKED);
  });

  test("a story with rounds equal to 2 is still dispatched", () => {
    fx.ready({ prd: basePrd({ userStories: [story("US-001", { passes: false, rounds: 2 })] }) });
    expectState(fx.run(), "story US-001");
  });

  test("a passing story with rounds greater than 2 does not block", () => {
    fx.ready({ prd: basePrd({ userStories: [story("US-001", { rounds: 5 })] }) });
    expectState(fx.run(), "ready");
  });

  test("a missing pr prints blocked after all stories pass", () => {
    const prd = basePrd();
    delete prd.pr;
    fx.ready({ prd });
    expectState(fx.run(), "blocked prd.json has no pr", STOP_BLOCKED);
  });
});

describe("external stories", () => {
  const STOP_EXTERNAL = "Stop. The advisor sets passes on the external story when its owner completes it.";

  test("an unpassed external story prints no story line and the task proceeds to close", () => {
    fx.ready({
      prd: basePrd({ userStories: [story("US-001"), story("US-002", { passes: false, external: true })] }),
      lessons: null,
    });
    expectState(fx.run(), "close");
  });

  test("an unpassed external story does not hold back ready", () => {
    fx.ready({ prd: basePrd({ userStories: [story("US-001"), story("US-002", { passes: false, external: true })] }) });
    expectState(fx.run(), "ready");
  });

  test("an unpassed external story with rounds greater than 2 does not block", () => {
    fx.ready({
      prd: basePrd({ userStories: [story("US-001"), story("US-002", { passes: false, external: true, rounds: 3 })] }),
    });
    expectState(fx.run(), "ready");
  });

  test("a non-external story is dispatched before the external story", () => {
    fx.ready({
      prd: basePrd({
        userStories: [story("US-001", { passes: false, external: true }), story("US-002", { passes: false })],
      }),
    });
    expectState(fx.run(), "story US-002");
  });

  test("a story that depends on an unpassed external story prints blocked with the dependency", () => {
    fx.ready({
      prd: basePrd({
        userStories: [
          story("US-001", { passes: false, external: true }),
          story("US-002", { passes: false, dependsOn: ["US-001"] }),
        ],
      }),
    });
    expectState(fx.run(), "blocked US-002 waits on external US-001", STOP_EXTERNAL);
  });

  test("a story that depends on a passed external story is dispatched", () => {
    fx.ready({
      prd: basePrd({
        userStories: [
          story("US-001", { external: true }),
          story("US-002", { passes: false, dependsOn: ["US-001"] }),
        ],
      }),
    });
    expectState(fx.run(), "story US-002");
  });

  test("the rounds cap still blocks a non-external story", () => {
    fx.ready({
      prd: basePrd({
        userStories: [story("US-001", { passes: false, external: true }), story("US-002", { passes: false, rounds: 3 })],
      }),
    });
    expectState(fx.run(), "blocked US-002 exceeded 2 repair rounds", STOP_BLOCKED);
  });

  test("an unpassed story without the field is dispatched as before", () => {
    const prd = basePrd({ userStories: [story("US-001"), story("US-002", { passes: false })] });
    expect(prd.userStories.some((entry) => "external" in entry)).toBe(false);
    fx.ready({ prd });
    expectState(fx.run(), "story US-002");
  });

  test("external false behaves as a story without the field", () => {
    fx.ready({ prd: basePrd({ userStories: [story("US-001"), story("US-002", { passes: false, external: false })] }) });
    expectState(fx.run(), "story US-002");
  });
});

describe("close", () => {
  test("prints close when prd.md has no Lessons section", () => {
    fx.ready({ lessons: null });
    expectState(fx.run(), "close");
  });

  test("prints close when the Lessons section is empty", () => {
    fx.ready({ lessons: "\n\n" });
    expectState(fx.run(), "close");
  });

  test("prints close when a later section follows an empty Lessons section", () => {
    fx.ready({ lessons: "\n## Appendix\n\ntext\n" });
    expectState(fx.run(), "close");
  });

  test("uses the awk check from /git § Ready for review", () => {
    const awk = readFileSync(GIT_SKILL, "utf8").match(/`awk '([^']+)' \.agro\/tasks\/<slug>\/prd\.md`/);
    expect(awk).not.toBeNull();
    const script = readFileSync(NEXT_SH, "utf8");
    expect(script).toContain(`awk '${awk[1]}'`);
  });
});

describe("push", () => {
  test("prints push when local HEAD differs from the upstream head", () => {
    fx.ready();
    fx.writePrdMd("Updated lesson.");
    fx.commit("unpushed task commit");
    expectState(fx.run(), "push", "Run git push.");
  });

  test("prints push when the branch has no upstream", () => {
    fx.ready();
    fx.git("branch", "--unset-upstream");
    expectState(fx.run(), "push");
  });

  test("does not call gh before push", () => {
    fx.ready();
    fx.writePrdMd("Updated lesson.");
    fx.commit("unpushed");
    fx.run();
    expect(readFileSync(fx.ghLog, "utf8")).toBe("");
  });
});

describe("ci and ci-red", () => {
  test("prints ci when a check is pending", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "pass pending" }), "ci", "Run /ci-status and wait for the result.");
  });

  test("prints ci when no checks are reported", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "" }), "ci");
  });

  test("prints ci-red when a check failed", () => {
    fx.ready();
    expectState(
      fx.run([], { GH_STUB_CHECKS: "pass fail" }),
      "ci-red",
      "Reopen the story that owns the failing path per /delegate § Acceptance.",
    );
  });

  test("prints ci-red when a check was cancelled", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "cancel" }), "ci-red");
  });

  test("a failed check wins over a pending check", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "pending fail" }), "ci-red");
  });

  test("asks gh about the recorded pr", () => {
    fx.ready();
    fx.run();
    const log = readFileSync(fx.ghLog, "utf8");
    expect(log).not.toContain("pr checks");
    expect(log).toContain("pr view 7 --json headRefOid,isDraft,statusCheckRollup");
    expect(log.match(/^pr view /gm)).toHaveLength(1);
  });

  test("a stale PR head prints ci even when its checks pass", () => {
    fx.ready();
    expectState(
      fx.run([], { GH_STUB_HEAD: "f".repeat(40), GH_STUB_CHECKS: "pass", GH_STUB_DRAFT: "true" }),
      "ci",
      "Run /ci-status and wait for the result.",
    );
  });

  test("a stale PR head prints ci even when its checks failed", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_HEAD: "f".repeat(40), GH_STUB_CHECKS: "fail" }), "ci");
  });

  test("a PR head equal to local HEAD uses the checks", () => {
    fx.ready();
    const head = fx.git("rev-parse", "HEAD");
    expectState(fx.run([], { GH_STUB_HEAD: head, GH_STUB_CHECKS: "pass", GH_STUB_DRAFT: "false" }), "done");
  });
});

describe("statusCheckRollup mapping", () => {
  const checkRun = (status, conclusion, overrides = {}) => ({
    __typename: "CheckRun",
    workflowName: "CI",
    name: "test",
    status,
    conclusion,
    startedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  });
  const statusContext = (state, overrides = {}) => ({
    __typename: "StatusContext",
    context: "ci/external",
    state,
    startedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  });
  const runRollup = (rollup, draft = "false") =>
    fx.run([], { GH_STUB_ROLLUP: JSON.stringify(rollup), GH_STUB_DRAFT: draft });

  test.each([
    ["pass", "COMPLETED", "SUCCESS", "done"],
    ["pass", "COMPLETED", "NEUTRAL", "done"],
    ["skipping", "COMPLETED", "SKIPPED", "done"],
    ["cancel", "COMPLETED", "CANCELLED", "ci-red"],
    ["pending", "IN_PROGRESS", "", "ci"],
    ["pending", "QUEUED", "", "ci"],
    ["fail", "COMPLETED", "FAILURE", "ci-red"],
    ["fail", "COMPLETED", "TIMED_OUT", "ci-red"],
    ["fail", "COMPLETED", "", "ci-red"],
  ])("a CheckRun maps to %s for %s %s", (_label, status, conclusion, state) => {
    fx.ready();
    expectState(runRollup([checkRun(status, conclusion)]), state);
  });

  test.each([
    ["pass", "SUCCESS", "done"],
    ["pending", "PENDING", "ci"],
    ["pending", "EXPECTED", "ci"],
    ["fail", "FAILURE", "ci-red"],
    ["fail", "ERROR", "ci-red"],
  ])("a StatusContext maps to %s for %s", (_label, state, expected) => {
    fx.ready();
    expectState(runRollup([statusContext(state)]), expected);
  });

  test("a failed result and a later passing result of one check do not print ci-red", () => {
    fx.ready();
    const failed = checkRun("COMPLETED", "FAILURE", { startedAt: "2026-01-01T00:00:00Z" });
    const passed = checkRun("COMPLETED", "SUCCESS", { startedAt: "2026-01-01T01:00:00Z" });
    expectState(runRollup([failed, passed]), "done");
    expectState(runRollup([passed, failed]), "done");
  });

  test("a passing result and a later failed result of one check print ci-red", () => {
    fx.ready();
    const passed = checkRun("COMPLETED", "SUCCESS", { startedAt: "2026-01-01T00:00:00Z" });
    const failed = checkRun("COMPLETED", "FAILURE", { startedAt: "2026-01-01T01:00:00Z" });
    expectState(runRollup([passed, failed]), "ci-red");
  });

  test("a later StatusContext result replaces an earlier result of one context", () => {
    fx.ready();
    const failed = statusContext("FAILURE", { startedAt: "2026-01-01T00:00:00Z" });
    const passed = statusContext("SUCCESS", { startedAt: "2026-01-01T01:00:00Z" });
    expectState(runRollup([failed, passed]), "done");
  });

  test("a queued re-run with no start time replaces a failed result", () => {
    fx.ready();
    const failed = checkRun("COMPLETED", "FAILURE");
    const queued = checkRun("QUEUED", "", { startedAt: "0001-01-01T00:00:00Z" });
    expectState(runRollup([failed, queued]), "ci");
  });

  test("one check name in two workflows stays two checks", () => {
    fx.ready();
    const failed = checkRun("COMPLETED", "FAILURE", { workflowName: "A" });
    const passed = checkRun("COMPLETED", "SUCCESS", { workflowName: "B", startedAt: "2026-01-01T01:00:00Z" });
    expectState(runRollup([failed, passed]), "ci-red");
  });

  test("a CheckRun failure wins over a StatusContext pending state", () => {
    fx.ready();
    expectState(runRollup([statusContext("PENDING"), checkRun("COMPLETED", "FAILURE")]), "ci-red");
  });

  test("a null rollup prints ci", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_ROLLUP: "null" }), "ci");
  });

  test("a query failure prints blocked and not a green state", () => {
    fx.ready();
    const result = fx.run([], { GH_STUB_ROLLUP: '"not-a-rollup"' });
    expect(result.status).toBe(0);
    expect(result.lines[0]).toMatch(/^blocked gh unavailable: /);
    expect(result.lines[1]).toBe(STOP_BLOCKED);
  });
});

describe("gh stub", () => {
  test("gh pr checks --json fails as gh 2.45.0 does", () => {
    const result = spawnSync(path.join(fx.root, "bin", "gh"), ["pr", "checks", "7", "--json", "bucket"], {
      env: { ...process.env, GH_STUB_LOG: fx.ghLog },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unknown flag: --json");
  });
});

describe("ready and done", () => {
  test("prints ready when the PR is a draft", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_DRAFT: "true" }), "ready", "Run gh pr ready 7.");
  });

  test("prints done when the PR is not a draft", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_DRAFT: "false" }), "done", "Stop.");
  });

  test("skipped checks count as passing", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "pass skipping", GH_STUB_DRAFT: "false" }), "done");
  });

  test("a stale review field with verdict fail does not change the state", () => {
    fx.ready({ prd: { ...basePrd(), review: { commit: "0".repeat(40), verdict: "fail", model: "opus" } } });
    expectState(fx.run(), "ready", "Run gh pr ready 7.");
  });
});

describe("gh failures", () => {
  test("a gh failure prints blocked gh unavailable", () => {
    fx.ready();
    const result = fx.run([], { GH_STUB_FAIL: "HTTP 401: Bad credentials" });
    expect(result.status).toBe(0);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toBe("blocked gh unavailable: HTTP 401: Bad credentials");
    expect(result.lines[1]).toBe(STOP_BLOCKED);
  });

  test("a gh failure on pr view prints blocked gh unavailable", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_DRAFT: "" }), "blocked gh unavailable: unexpected isDraft output", STOP_BLOCKED);
  });
});

describe("state order", () => {
  test("blocked wins over story", () => {
    fx.ready({ prd: basePrd({ blocked: "hold", userStories: [story("US-001", { passes: false })] }) });
    expectState(fx.run(), "blocked hold");
  });

  test("story wins over a missing pr", () => {
    const prd = basePrd({ userStories: [story("US-001", { passes: false })] });
    delete prd.pr;
    fx.write("src/app.txt", "v1\n");
    fx.commit("code");
    fx.writePrd(prd);
    fx.commit("task");
    expectState(fx.run(), "story US-001");
  });

  test("close wins over push", () => {
    fx.ready({ lessons: null });
    fx.write(`.agro/tasks/${SLUG}/evidence/x.md`, "x\n");
    fx.commit("unpushed task commit");
    expectState(fx.run(), "close");
  });

  test("push wins over ci-red", () => {
    fx.ready();
    fx.writePrdMd("More.");
    fx.commit("unpushed");
    expectState(fx.run([], { GH_STUB_CHECKS: "fail" }), "push");
  });

  test("ci wins over ready", () => {
    fx.ready();
    expectState(fx.run([], { GH_STUB_CHECKS: "pending", GH_STUB_DRAFT: "true" }), "ci");
  });
});
