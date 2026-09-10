import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSemVer, reserveReleaseVersion } from "../release-reservation.mjs";
import {
  githubOutputLines,
  releaseTagName,
  reserveGitHubRelease,
} from "../reserve-github-release.mjs";

const ROOT = join(import.meta.dirname, "../../..");
const WORKFLOW = join(ROOT, ".github", "workflows", "release.yml");
const CLI_WORKFLOW = join(ROOT, ".github", "workflows", "publish-cli.yml");
const RELEASE_SHA = "0123456789abcdef0123456789abcdef01234567";
const FOREIGN_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const REPOSITORY = "mifunedev/agro";
const VERSION = "0.1.0";
const TAG = "v0.1.0";

type ExpectedRequest = {
  body?: unknown;
  method: string;
  path: string;
  responseBody?: unknown;
  status: number;
};

function queuedFetch(expected: ExpectedRequest[]): typeof fetch {
  let index = 0;
  const mock = async (input: string | URL | Request, init?: RequestInit) => {
    const next = expected[index++];
    expect(next, `unexpected request ${String(input)}`).toBeDefined();
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const path = `${url.pathname.replace(`/repos/${REPOSITORY}`, "")}${url.search}`;
    expect(init?.method ?? "GET").toBe(next.method);
    expect(path).toBe(next.path);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    expect(new Headers(init?.headers).get("user-agent")).toBe("agro-release-reservation");
    if (Object.hasOwn(next, "body")) {
      expect(JSON.parse(String(init?.body))).toEqual(next.body);
    }
    return new Response(next.status === 204 ? null : JSON.stringify(next.responseBody ?? {}), {
      status: next.status,
      headers: next.status === 204 ? undefined : { "content-type": "application/json" },
    });
  };
  return Object.assign(mock, {
    assertDone: () => expect(index).toBe(expected.length),
  }) as typeof fetch;
}

function assertFetchDone(fetchImpl: typeof fetch) {
  (fetchImpl as typeof fetch & { assertDone(): void }).assertDone();
}

function release(id: number, tagName: string, draft: boolean) {
  return { id, tag_name: tagName, draft };
}

function tagRef(sha: string) {
  return { ref: "refs/tags/candidate", object: { type: "commit", sha } };
}

function createRefBody(tagName: string) {
  return { ref: `refs/tags/${tagName}`, sha: RELEASE_SHA };
}

function createReleaseBody(tagName: string) {
  return {
    body: "Image publication is pending.",
    draft: true,
    prerelease: false,
    tag_name: tagName,
    target_commitish: RELEASE_SHA,
  };
}

function options(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return {
    fetchImpl,
    releaseSha: RELEASE_SHA,
    releaseVersion: VERSION,
    repository: REPOSITORY,
    token: "test-token",
    ...overrides,
  };
}

describe("SemVer reservation", () => {
  it("accepts strict MAJOR.MINOR.PATCH versions", () => {
    expect(parseSemVer("0.1.0")).toEqual({ major: 0, minor: 1, patch: 0, version: "0.1.0" });
    expect(parseSemVer("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, version: "1.2.3" });
    expect(parseSemVer("10.0.0")).toEqual({ major: 10, minor: 0, patch: 0, version: "10.0.0" });
  });

  it("rejects malformed versions, including the CalVer forms that are not SemVer", () => {
    for (const bad of [
      "01.2.3",
      "2026.08.07",
      "1.2",
      "1.2.3.4",
      "2026.8.7-1",
      "1.0.0-rc.1",
      "1.0.0+build.5",
      "v1.2.3",
      "",
      " 1.2.3",
      null,
      undefined,
      1.23,
    ]) {
      expect(() => parseSemVer(bad as string), `expected ${JSON.stringify(bad)} to be rejected`)
        .toThrowError(expect.objectContaining({ code: "INVALID_SEMVER_VERSION" }));
    }
  });

  it("accepts a bare date-shaped version because it is well-formed SemVer", () => {
    expect(parseSemVer("2026.8.7").version).toBe("2026.8.7");
  });

  it("attempts the reservation exactly once and never advances the version", async () => {
    for (const [kind, expected] of [
      ["created", "created"],
      ["same-sha-draft", "reused-draft"],
      ["same-sha-published", "published-no-op"],
      ["foreign-collision", "already-released"],
    ] as const) {
      let calls = 0;
      const result = await reserveReleaseVersion({
        version: VERSION,
        attemptCreate: async () => {
          calls += 1;
          return { kind };
        },
      });
      expect(result).toEqual({ kind: expected, version: VERSION });
      expect(calls, `${kind} must not retry`).toBe(1);
    }
  });

  it("rejects the version before calling attemptCreate", async () => {
    let calls = 0;
    await expect(
      reserveReleaseVersion({
        version: "2026.8.7-1",
        attemptCreate: async () => {
          calls += 1;
          return { kind: "created" };
        },
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_SEMVER_VERSION" }));
    expect(calls).toBe(0);
  });

  it("wraps an attempt failure and reports an invalid outcome", async () => {
    await expect(
      reserveReleaseVersion({
        version: VERSION,
        attemptCreate: async () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: "ATTEMPT_FAILED" }));

    await expect(
      reserveReleaseVersion({
        version: VERSION,
        attemptCreate: async () => ({ kind: "invalid-state", message: "no draft" }),
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_ATTEMPT_STATE" }));

    await expect(
      reserveReleaseVersion({
        version: VERSION,
        attemptCreate: async () => ({ kind: "who-knows" }),
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_ATTEMPT_STATE" }));
  });

  it("prefixes the tag name with v while the version stays bare", () => {
    expect(releaseTagName("0.1.0")).toBe("v0.1.0");
    expect(releaseTagName("10.2.3")).toBe("v10.2.3");
  });
});

describe("GitHub reservation bridge", () => {
  it("atomically creates the v-prefixed tag before its draft", async () => {
    const fetchImpl = queuedFetch([
      {
        method: "POST",
        path: "/git/refs",
        status: 201,
        body: createRefBody(TAG),
        responseBody: tagRef(RELEASE_SHA),
      },
      {
        method: "POST",
        path: "/releases",
        status: 201,
        body: createReleaseBody(TAG),
        responseBody: release(101, TAG, true),
      },
    ]);

    const result = await reserveGitHubRelease(options(fetchImpl));
    expect(result).toEqual({
      publishedNoop: false,
      releaseId: 101,
      releaseSha: RELEASE_SHA,
      releaseVersion: VERSION,
      reservationKind: "created",
    });
    expect(githubOutputLines(result)).toContain("releaseVersion=0.1.0\n");
    expect(githubOutputLines(result)).not.toContain("releaseVersion=v");
    assertFetchDone(fetchImpl);
  });

  it("reports a foreign-SHA tag as an already-released no-op without bumping", async () => {
    const fetchImpl = queuedFetch([
      { method: "POST", path: "/git/refs", status: 422, body: createRefBody(TAG) },
      {
        method: "GET",
        path: `/git/ref/tags/${TAG}`,
        status: 200,
        responseBody: tagRef(FOREIGN_SHA),
      },
    ]);

    const result = await reserveGitHubRelease(options(fetchImpl));
    expect(result).toEqual({
      publishedNoop: true,
      releaseId: 0,
      releaseSha: RELEASE_SHA,
      releaseVersion: VERSION,
      reservationKind: "already-released",
    });
    assertFetchDone(fetchImpl);
  });

  it("recovers an exact same-SHA draft through authenticated pagination", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      release(1_000 + index, `v0.0.${index + 1}`, true),
    );
    const fetchImpl = queuedFetch([
      { method: "POST", path: "/git/refs", status: 422, body: createRefBody(TAG) },
      {
        method: "GET",
        path: `/git/ref/tags/${TAG}`,
        status: 200,
        responseBody: tagRef(RELEASE_SHA),
      },
      { method: "GET", path: `/releases/tags/${TAG}`, status: 404 },
      {
        method: "GET",
        path: "/releases?per_page=100&page=1",
        status: 200,
        responseBody: fullPage,
      },
      {
        method: "GET",
        path: "/releases?per_page=100&page=2",
        status: 200,
        responseBody: [release(103, TAG, true)],
      },
    ]);

    const result = await reserveGitHubRelease(options(fetchImpl));
    expect(result.reservationKind).toBe("reused-draft");
    expect(result.releaseId).toBe(103);
    expect(result.publishedNoop).toBe(false);
    assertFetchDone(fetchImpl);
  });

  it("treats an already-published same-SHA reservation as a successful no-op", async () => {
    const fetchImpl = queuedFetch([
      { method: "POST", path: "/git/refs", status: 422, body: createRefBody(TAG) },
      {
        method: "GET",
        path: `/git/ref/tags/${TAG}`,
        status: 200,
        responseBody: tagRef(RELEASE_SHA),
      },
      {
        method: "GET",
        path: `/releases/tags/${TAG}`,
        status: 200,
        responseBody: release(104, TAG, false),
      },
    ]);

    const result = await reserveGitHubRelease(options(fetchImpl));
    expect(result).toMatchObject({
      publishedNoop: true,
      releaseId: 104,
      releaseVersion: VERSION,
      reservationKind: "published-no-op",
    });
    assertFetchDone(fetchImpl);
  });

  it("rejects a malformed version before touching GitHub", async () => {
    const fetchImpl = queuedFetch([]);
    await expect(
      reserveGitHubRelease(options(fetchImpl, { releaseVersion: "2026.8.7-1" })),
    ).rejects.toThrowError(expect.objectContaining({ code: "INVALID_SEMVER_VERSION" }));
    assertFetchDone(fetchImpl);
  });
});

describe("release workflow contract", () => {
  const source = readFileSync(WORKFLOW, "utf8");

  it("triggers for main and master without dropping intermediate pushes", () => {
    expect(source).toMatch(/push:\n\s+branches:\n\s+- main\n\s+- master/);
    expect(source).not.toMatch(/^concurrency:/m);
    expect(source).not.toMatch(/push:\n(\s+branches:[\s\S]*?)?\s+tags:/);
  });

  it("reads the release version from package.json rather than a clock", () => {
    expect(source).toMatch(/reserve:\n[\s\S]*?needs: \[validate, boot-lint, eval-probes\]/);
    expect(source).toContain(`node -p "require('./package.json').version"`);
    expect(source).toContain("RELEASE_VERSION: ${{ steps.release_version.outputs.version }}");
    expect(source).not.toContain("RELEASE_TIMESTAMP");
    expect(source).not.toContain("github.event.repository.pushed_at");
    expect(source).not.toContain("github.event.head_commit.timestamp");
    expect(source.indexOf("Read the release version from package.json")).toBeLessThan(
      source.indexOf("Atomically reserve the SemVer tag"),
    );
    expect(source.indexOf("jobs:\n")).toBeLessThan(source.indexOf("  reserve:\n"));
    expect(source).not.toMatch(/deleteRelease|deleteRef|method:\s*["']DELETE/);
  });

  it("skips publication cleanly when the reservation is a no-op", () => {
    const guard = /if: \$\{\{[^}]*needs\.reserve\.outputs\.publishedNoop != 'true'/g;
    expect(source.match(guard)?.length).toBe(4);
    expect(source).toMatch(/publish-image:\n[\s\S]*?if: \$\{\{ needs\.reserve\.outputs\.publishedNoop != 'true' \}\}/);
    expect(source).toMatch(/publish-cli:\n[\s\S]*?if: \$\{\{ needs\.reserve\.outputs\.publishedNoop != 'true' \}\}/);
    expect(source).toMatch(/finalize:\n[\s\S]*?needs\.reserve\.outputs\.publishedNoop != 'true'/);
    expect(source).toMatch(/notify-docs:\n[\s\S]*?needs\.reserve\.outputs\.publishedNoop != 'true'/);
  });

  it("names the smoke sandbox after agro", () => {
    expect(source.match(/SANDBOX_NAME: agro-release-smoke-\$\{\{ github\.run_id \}\}/g)?.length).toBe(3);
    expect(source).not.toContain("openharness-release-smoke");
  });

  it("notifies the docs site only after a real release is finalized", () => {
    const notify = source.indexOf("  notify-docs:\n");
    const job = source.slice(notify, source.indexOf("  # publish-cli.yml", notify));

    expect(notify).toBeGreaterThan(source.indexOf("  finalize:\n"));
    expect(job).toMatch(/needs: \[reserve, finalize\]/);
    expect(job).toContain("needs.finalize.result == 'success'");
    expect(job).toContain("AGRO_WEB_DISPATCH_TOKEN: ${{ secrets.AGRO_WEB_DISPATCH_TOKEN }}");
    expect(job).toContain("AGRO_WEB_REPO: ${{ vars.AGRO_WEB_REPO || 'mifunedev/openharness-web' }}");
    expect(job).toContain("RELEASE_SHA: ${{ needs.reserve.outputs.releaseSha }}");
    expect(job).toMatch(/if \[ -z "\$AGRO_WEB_DISPATCH_TOKEN" \]; then\n\s+echo "::notice::Secret AGRO_WEB_DISPATCH_TOKEN[^"]*"\n\s+exit 0\n\s+fi/);
    expect(job).toMatch(/GH_TOKEN="\$AGRO_WEB_DISPATCH_TOKEN" gh api --method POST/);
    expect(job).toContain('"/repos/${AGRO_WEB_REPO}/dispatches"');
    expect(job).toContain("-f event_type=agro-release");
    expect(job).toContain('-f "client_payload[ref]=${RELEASE_SHA}"');
    expect(job.match(/secrets\.AGRO_WEB_DISPATCH_TOKEN/g)?.length).toBe(1);
    expect(job).not.toMatch(/echo[^\n]*\$AGRO_WEB_DISPATCH_TOKEN/);
    expect(job).not.toMatch(/set -x/);
  });

  it("publishes bare version tags and promotes latest by digest", () => {
    const immutablePush = source.indexOf("Push immutable SemVer and sha-full-SHA tags");
    const latestPromote = source.indexOf("Promote latest from the canonical branch by digest");
    const cliPublish = source.indexOf("  publish-cli:\n");
    const finalize = source.indexOf("  finalize:\n");
    const freshGithubCheck = source.indexOf("Check canonical branch for GitHub latest-release status");
    const publishDraft = source.indexOf("Publish the draft after image and CLI publication");

    expect(source).toContain("docker buildx build --load");
    expect(source).toContain('docker push "ghcr.io/mifunedev/openharness:${RELEASE_VERSION}"');
    expect(source).toContain('docker push "ghcr.io/mifunedev/openharness:sha-${RELEASE_SHA}"');
    expect(source).not.toContain("openharness:v$");
    expect(source).not.toContain('openharness:${RELEASE_SHA}"');
    expect(source).toContain(".agro/scripts/promote-release-latest.sh promote");
    expect(source).not.toContain("latest_guard");
    expect(immutablePush).toBeGreaterThan(0);
    expect(latestPromote).toBeGreaterThan(immutablePush);
    expect(cliPublish).toBeGreaterThan(latestPromote);
    expect(finalize).toBeGreaterThan(cliPublish);
    expect(freshGithubCheck).toBeGreaterThan(finalize);
    expect(publishDraft).toBeGreaterThan(freshGithubCheck);
  });

  it("builds the agro and openharness tags once, pushes all four, and verifies one digest", () => {
    const build = source.indexOf("Build immutable Docker image tags");
    const bootSmoke = source.indexOf("Smoke-test Docker image before publish");
    const agroSmoke = source.indexOf("Smoke-test agro as a first-class entry point");
    const immutablePush = source.indexOf("Push immutable SemVer and sha-full-SHA tags");
    const aliasVerify = source.indexOf("Verify the agro and openharness version tags share one digest");
    const latestPromote = source.indexOf("Promote latest from the canonical branch by digest");

    expect(source.match(/docker buildx build --load/g)?.length).toBe(1);
    expect(source).toContain('AGRO_VERSION_IMAGE="ghcr.io/mifunedev/agro:${RELEASE_VERSION}"');
    expect(source).toContain('AGRO_SHA_IMAGE="ghcr.io/mifunedev/agro:sha-${RELEASE_SHA}"');
    expect(source).toMatch(
      /-t "\$VERSION_IMAGE" -t "\$SHA_IMAGE" \\\n\s+-t "\$AGRO_VERSION_IMAGE" -t "\$AGRO_SHA_IMAGE" -t "\$SMOKE_IMAGE" \./,
    );
    expect(source).toContain('docker push "ghcr.io/mifunedev/openharness:${RELEASE_VERSION}"');
    expect(source).toContain('docker push "ghcr.io/mifunedev/openharness:sha-${RELEASE_SHA}"');
    expect(source).toContain('docker push "ghcr.io/mifunedev/agro:${RELEASE_VERSION}"');
    expect(source).toContain('docker push "ghcr.io/mifunedev/agro:sha-${RELEASE_SHA}"');
    expect(source.match(/docker push "/g)?.length).toBe(4);
    expect(source).toMatch(
      /\.agro\/scripts\/verify-release-aliases\.sh check \\\n\s+"ghcr\.io\/mifunedev\/openharness:\$\{RELEASE_VERSION\}" \\\n\s+"ghcr\.io\/mifunedev\/agro:\$\{RELEASE_VERSION\}"/,
    );
    expect(source).toContain("-lc 'agro --version'");
    expect(source).toContain("-lc 'oh --version'");
    expect(source).toContain('[ "$agro_version" != "$oh_version" ]');
    expect(source).toContain('[ "$agro_version" != "$RELEASE_VERSION" ]');
    expect(build).toBeGreaterThan(0);
    expect(bootSmoke).toBeGreaterThan(build);
    expect(agroSmoke).toBeGreaterThan(bootSmoke);
    expect(immutablePush).toBeGreaterThan(agroSmoke);
    expect(aliasVerify).toBeGreaterThan(immutablePush);
    expect(latestPromote).toBeGreaterThan(aliasVerify);
  });

  it("attaches the CLI bundles and installers before the release is undrafted", () => {
    const build = source.indexOf("Build the CLI bundles at the released commit");
    const upload = source.indexOf("Upload the CLI bundles and installers as release assets");
    const publishDraft = source.indexOf("Publish the draft after image and CLI publication");

    expect(source).toContain("npm --prefix .agro/cli ci --ignore-scripts");
    expect(source).toContain("npm --prefix .agro/cli run build");
    expect(source).toMatch(
      /gh release upload "v\$\{RELEASE_VERSION\}" --clobber \\\n\s+\.agro\/cli\/dist\/agro\.js \\\n\s+\.agro\/cli\/dist\/oh\.js \\\n\s+\.agro\/scripts\/get-agro\.sh \\\n\s+\.agro\/scripts\/get-oh\.sh/,
    );
    expect(source).toMatch(/finalize:\n[\s\S]*?GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
    expect(build).toBeGreaterThan(source.indexOf("  finalize:\n"));
    expect(upload).toBeGreaterThan(build);
    expect(publishDraft).toBeGreaterThan(upload);
  });

  it("serializes only same-version image publication and gates finalization on CLI success", () => {
    expect(source).not.toMatch(/^concurrency:/m);
    expect(source).toMatch(
      /publish-image:[\s\S]*?concurrency:\n\s+group: release-image-\$\{\{ needs\.reserve\.outputs\.releaseVersion \}\}\n\s+cancel-in-progress: false/,
    );
    expect(source).toMatch(/publish-cli:\n[\s\S]*?needs: \[reserve, publish-image\]/);
    expect(source).toContain("uses: ./.github/workflows/publish-cli.yml");
    expect(source).toContain("ref: ${{ needs.reserve.outputs.releaseSha }}");
    expect(source).toMatch(/needs: \[reserve, publish-image, publish-cli\]/);
    expect(source).toContain("needs.publish-cli.result == 'success'");
    expect(source).toContain("make_latest: process.env.MAKE_LATEST");
    expect(source).toContain("draft: false");
    expect(source).toContain("name: `v${releaseVersion}`");
  });
});

describe("CLI publication workflow contract", () => {
  const source = readFileSync(CLI_WORKFLOW, "utf8");

  it("is reusable and manually dispatchable with the exact checkout ref", () => {
    expect(source).toMatch(/workflow_call:\n\s+inputs:\n\s+ref:/);
    expect(source).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+ref:/);
    expect(source).toContain("ref: ${{ inputs.ref }}");
    expect(source).not.toMatch(/push:\n\s+tags:/);
    expect(source).toContain("npm publish --access public --provenance");
  });

  it("publishes only @mifune/agro and performs no legacy npm publish, wait, or deprecate", () => {
    const agroGuard = source.indexOf('npm view "@mifune/agro@$V" version');
    const agroPublish = source.indexOf("Publish @mifune/agro to npm");

    expect(agroGuard).toBeGreaterThan(0);
    expect(agroPublish).toBeGreaterThan(agroGuard);
    expect(source.match(/npm publish --access public --provenance/g)?.length).toBe(1);
    expect(source).toContain("working-directory: .agro/cli");
    expect(source).not.toContain("working-directory: .agro/cli/legacy");
    expect(source).not.toContain("legacy_guard");
    expect(source).not.toContain("Publish @mifune/openharness");
    expect(source).not.toContain("Deprecate @mifune/openharness");
    expect(source).not.toContain("Wait for @mifune/agro to resolve on the registry");
    expect(source).not.toContain("npm deprecate");
    expect(source).not.toContain(".agro/scripts/npm-wait-version.sh");
    expect(source).not.toContain('npm view "@mifune/openharness@$V"');
    expect(source).toContain('npm view "@mifune/agro@$V" version --prefer-online >/dev/null');
    expect(source).toContain("id-token: write");
    expect(source.match(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/g)?.length).toBe(1);
    expect(source.match(/npm ci/g)?.length).toBe(1);
    expect(source.indexOf("npm ci --ignore-scripts")).toBeLessThan(agroPublish);
    expect(source).toContain("already-published shim versions remain");
    expect(source).not.toContain("continue-on-error");
  });
});
