import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryRoot, materialize } from "../registry.js";
import { configCheckout, ohConfigPath, readOhConfig, type ImageMode } from "../oh-config.js";

const BUILD_STANZA = "context: ${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}";
const CHECKOUT_MOUNT = "${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}:/home/sandbox/harness";

type Base = "image-only" | "repo";

const cleanups: string[] = [];

afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function registry(): void {
  const home = mkdtempSync(join(tmpdir(), "agro-compose-base-"));
  cleanups.push(home);
  vi.stubEnv("OH_HOME", home);
}

function entry(name: string, mode: ImageMode, checkout?: string): string {
  const root = entryRoot(name);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "agro.json"),
    `${JSON.stringify({
      version: 1,
      name,
      ...(checkout === undefined ? {} : { checkout }),
      image: { mode, pullPolicy: "missing" },
    })}\n`,
  );
  return root;
}

function writtenCompose(root: string): string {
  const config = readOhConfig(ohConfigPath(root));
  const checkout = configCheckout(config);
  materialize(root, { ...(checkout === undefined ? {} : { checkout }) });
  return readFileSync(join(root, ".devcontainer", "docker-compose.yml"), "utf8");
}

function baseOf(compose: string): Base {
  const build = compose.includes(BUILD_STANZA);
  const mount = compose.includes(CHECKOUT_MOUNT);
  expect(build, "the two bundled bases differ in both discriminators together").toBe(mount);
  return build ? "repo" : "image-only";
}

describe("materialize compose base selection", () => {
  it("writes the image-only base with no checkout and image.mode build", () => {
    registry();
    expect(baseOf(writtenCompose(entry("no-checkout-build", "build")))).toBe("image-only");
  });

  it("writes the image-only base with no checkout and image.mode image", () => {
    registry();
    expect(baseOf(writtenCompose(entry("no-checkout-image", "image")))).toBe("image-only");
  });

  it("writes the build-capable base with a checkout and image.mode build", () => {
    registry();
    expect(baseOf(writtenCompose(entry("checkout-build", "build", "/srv/checkout")))).toBe("repo");
  });

  it("pins, without endorsing, the build-capable base for a checkout with image.mode image", () => {
    registry();
    const compose = writtenCompose(entry("checkout-image", "image", "/srv/checkout"));
    expect(baseOf(compose)).toBe("repo");
    expect(compose).toContain(BUILD_STANZA);
  });

  it("selects the base from checkout presence alone, image.mode never reaching materialize", () => {
    registry();
    const build = writtenCompose(entry("mode-build", "build", "/srv/checkout"));
    const image = writtenCompose(entry("mode-image", "image", "/srv/checkout"));
    expect(image).toBe(build);

    const noCheckoutBuild = writtenCompose(entry("bare-build", "build"));
    const noCheckoutImage = writtenCompose(entry("bare-image", "image"));
    expect(noCheckoutImage).toBe(noCheckoutBuild);
    expect(noCheckoutBuild).not.toBe(build);
  });

  it("supplies the checkout bind mount only through the build-capable base", () => {
    registry();
    expect(writtenCompose(entry("mounted", "image", "/srv/checkout"))).toContain(CHECKOUT_MOUNT);
    expect(writtenCompose(entry("unmounted", "build"))).not.toContain(CHECKOUT_MOUNT);
  });
});
