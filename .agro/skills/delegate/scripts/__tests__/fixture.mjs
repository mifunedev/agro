import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NEXT_SH = fileURLToPath(new URL("../next.sh", import.meta.url));
export const BRANCH = "feat/1-demo";
export const SLUG = "demo";

const GH_STUB = `#!/usr/bin/env bash
set -u
if [ -n "\${GH_STUB_FAIL:-}" ]; then echo "$GH_STUB_FAIL" >&2; exit 4; fi
echo "$*" >> "$GH_STUB_LOG"
case "$1 $2" in
  "pr checks")
    if [ -z "\${GH_STUB_CHECKS:-}" ]; then echo "no checks reported on the 'x' branch" >&2; exit 1; fi
    printf '%s\\n' $GH_STUB_CHECKS
    case " $GH_STUB_CHECKS " in *" fail "*|*" cancel "*) exit 1 ;; *" pending "*) exit 8 ;; esac
    ;;
  "pr view") echo "\${GH_STUB_HEAD-$(git rev-parse HEAD)} \${GH_STUB_DRAFT-false}" ;;
  *) echo "unexpected gh call: $*" >&2; exit 2 ;;
esac
`;

function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
}

export function story(id, overrides = {}) {
  return {
    id,
    title: id,
    description: "",
    acceptanceCriteria: [],
    priority: Number(id.slice(3)),
    passes: true,
    notes: "",
    dependsOn: [],
    ...overrides,
  };
}

export function basePrd(overrides = {}) {
  return {
    schemaVersion: 1,
    project: "demo",
    branchName: BRANCH,
    description: "demo",
    pr: 7,
    userStories: [story("US-001"), story("US-002")],
    ...overrides,
  };
}

export function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "agro-next-"));
  const work = path.join(root, "work");
  const remote = path.join(root, "remote.git");
  const bin = path.join(root, "bin");
  const ghLog = path.join(root, "gh.log");
  const env = {
    ...cleanEnv(),
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (...args) => execFileSync("git", args, { cwd: work, env, encoding: "utf8" }).trim();

  mkdirSync(work);
  mkdirSync(bin);
  writeFileSync(path.join(bin, "gh"), GH_STUB);
  chmodSync(path.join(bin, "gh"), 0o755);
  writeFileSync(ghLog, "");
  execFileSync("git", ["init", "-q", "--bare", remote], { env });
  git("init", "-q", "-b", BRANCH);
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", remote);

  const write = (rel, content) => {
    const file = path.join(work, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const taskDir = (slug = SLUG) => `.agro/tasks/${slug}`;
  const writePrd = (prd, slug = SLUG) =>
    write(`${taskDir(slug)}/prd.json`, typeof prd === "string" ? prd : JSON.stringify(prd, null, 2));
  const writePrdMd = (lessons, slug = SLUG) =>
    write(
      `${taskDir(slug)}/prd.md`,
      `# Demo\n\n## Stories\n\nText.\n${lessons === null ? "" : `\n## Lessons\n\n${lessons}`}`,
    );
  const commit = (message) => {
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const push = () => git("push", "-q", "-u", "origin", BRANCH);

  const run = (args = [], ghEnv = {}) => {
    const result = spawnSync("bash", [NEXT_SH, ...args], {
      cwd: work,
      env: {
        ...env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        GH_STUB_LOG: ghLog,
        GH_STUB_CHECKS: "pass",
        GH_STUB_DRAFT: "true",
        ...ghEnv,
      },
      encoding: "utf8",
    });
    return { ...result, lines: result.stdout.split("\n").filter((line, i, all) => i < all.length - 1 || line) };
  };

  const ready = ({ prd = basePrd(), lessons = "None." } = {}) => {
    write("src/app.txt", "v1\n");
    const code = commit("code");
    writePrd({ ...prd, review: { commit: code, verdict: "pass", model: "opus" }, ...stripReview(prd) });
    writePrdMd(lessons);
    commit("task state");
    push();
    return code;
  };

  return {
    root,
    work,
    ghLog,
    git,
    write,
    writePrd,
    writePrdMd,
    commit,
    push,
    run,
    ready,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function stripReview(prd) {
  return "review" in prd ? { review: prd.review } : {};
}
