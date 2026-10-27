import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const WORKFLOW = join(import.meta.dirname, "../../..", ".github", "workflows", "release.yml");

type Step = {
  name?: string;
  run?: string;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
};

function finalizeSteps(): Step[] {
  const workflow = parse(readFileSync(WORKFLOW, "utf8"));
  return workflow.jobs.finalize.steps;
}

describe("release workflow agro-web dispatch", () => {
  const steps = finalizeSteps();
  const notify = steps.at(-1) as Step;

  it("ends the finalize job with the agro-web notify step", () => {
    expect(notify.name).toBe("Notify agro-web of the release");
    expect(steps.filter((step) => step.name === notify.name)).toHaveLength(1);
  });

  it("sends the agro-release dispatch with the release tag as ref", () => {
    expect(notify.env?.RELEASE_VERSION).toBe("${{ needs.reserve.outputs.releaseVersion }}");
    expect(notify.run).toContain("gh api --method POST repos/mifunedev/agro-web/dispatches");
    expect(notify.run).toContain("-f event_type=agro-release");
    expect(notify.run).toContain('-f "client_payload[ref]=v${RELEASE_VERSION}"');
    expect(notify.run).not.toContain("${{");
  });

  it("reads the token from AGRO_WEB_DISPATCH_TOKEN and skips with a warning when it is empty", () => {
    expect(notify.env?.GH_TOKEN).toBe("${{ secrets.AGRO_WEB_DISPATCH_TOKEN }}");
    expect(notify.run).toMatch(
      /if \[ -z "\$GH_TOKEN" \]; then\n\s+echo "::warning::[^"]*"\n\s+exit 0\n\s*fi/,
    );
  });

  it("never fails the release run on a failed dispatch", () => {
    expect(notify["continue-on-error"]).toBe(true);
    expect(notify.run).toMatch(/::warning::agro-web release dispatch[^\n]*\$\{status/);
  });
});
