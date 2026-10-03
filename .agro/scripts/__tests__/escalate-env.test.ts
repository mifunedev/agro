import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSecretSet } from "../../cli/src/commands/secret.js";

const ROOT = join(import.meta.dirname, "../../..");
const ESCALATE = join(ROOT, ".agro/skills/escalate/scripts/escalate.sh");

const CURL_STUB = [
  "#!/usr/bin/env bash",
  "set -euo pipefail",
  "url='' previous='' header=''",
  'for arg in "$@"; do',
  '  case "$arg" in https://slack.com/api/*) url=${arg##*/} ;; esac',
  '  if [[ $previous == -H && $arg == @/dev/fd/* ]]; then header=$(<"${arg#@}"); fi',
  "  previous=$arg",
  "done",
  '[[ $header == "Authorization: Bearer $EXPECTED_BEARER" ]] || exit 9',
  'case "$url" in',
  "  conversations.info) printf '%s\\n' '{\"ok\":true,\"channel\":{\"is_archived\":false}}' ;;",
  "  chat.postMessage) cat >/dev/null; printf '%s\\n' '{\"ok\":true,\"ts\":\"1.2\"}' ;;",
  "  *) exit 9 ;;",
  "esac",
  "",
].join("\n");

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

describe("escalate Slack token resolution", () => {
  it("reads the bot token `agro secret set` writes when .devcontainer/.env is absent", async () => {
    const temp = mkdtempSync(join(tmpdir(), "escalate-env-"));
    cleanups.push(temp);
    const harness = join(temp, "harness");
    const bin = join(temp, "bin");
    const home = join(temp, "home");
    mkdirSync(join(harness, ".agro", "scripts"), { recursive: true });
    mkdirSync(bin);
    mkdirSync(home);
    writeFileSync(join(bin, "curl"), CURL_STUB, { mode: 0o755 });

    const io = { stdout: () => {}, stderr: () => {}, askSecret: async () => "xoxb-test" };
    expect(await runSecretSet("PI_SLACK_BOT_TOKEN", { bin: "agro", cwd: harness }, io)).toBe(0);
    expect(existsSync(join(harness, ".devcontainer", ".env"))).toBe(false);

    const env = { ...process.env };
    delete env.PI_SLACK_BOT_TOKEN;
    delete env.AGRO_SUPERVISOR_PANE;
    const stdout = execFileSync(
      "bash",
      [ESCALATE, "--summary", "s", "--needs", "n", "--channel", "C123"],
      {
        env: {
          ...env,
          HOME: home,
          AGRO_PROJECT_ROOT: harness,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          EXPECTED_BEARER: "xoxb-test",
          ESCALATE_LOG: join(temp, "escalations.jsonl"),
          ESCALATE_STATE_DIR: join(temp, "state"),
        },
        encoding: "utf8",
      },
    );

    expect(JSON.parse(stdout)).toMatchObject({ ok: true, ts: "1.2", channel: "C123" });
  });
});
