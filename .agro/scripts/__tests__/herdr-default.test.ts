import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readRepoFile = (file: string): string => readFileSync(path.join(repoRoot, file), "utf8");

describe("default Herdr integration", () => {
  it("pins and verifies Herdr for both supported architectures", () => {
    const catalog = readRepoFile(".agro/cli/src/lib/tools/catalog.ts");

    expect(catalog).toContain("version=0.7.4");
    expect(catalog).toContain("bc0fc02d4ba500f9cac2353a43e67fe036785ecca6eb55378e050fac3c103059");
    expect(catalog).toContain("544e0002de42806d1ab64ccdef3a7e7414f24717b0b6b022bc9e57d2eefd26a2");
    expect(catalog).toContain("sha256sum -c -");
    expect(catalog).toContain('test "$("$prefix/bin/herdr" --version)" = "herdr $version"');
  });

  it("no longer bakes Herdr into the image", () => {
    const dockerfile = readRepoFile(".devcontainer/Dockerfile");

    expect(dockerfile).not.toContain("HERDR_VERSION");
    expect(dockerfile).not.toContain("github.com/ogulcancelik/herdr");
  });

  it.each(["docker-compose.yml", "docker-compose.image-only.yml"])(
    "persists Herdr state in %s",
    (composeFile) => {
      const compose = readRepoFile(`.devcontainer/${composeFile}`);

      expect(compose).toContain("${AGRO_HOME_MOUNT:-${OH_HOME_MOUNT:-workspace}}:/home/sandbox");
      expect(compose).not.toContain("/home/sandbox/.herdr");
      expect(compose).not.toContain("/home/sandbox/.config");
      expect(compose).toMatch(/^  workspace:$/m);
    },
  );

  it("repairs ownership for Herdr state after UID sync", () => {
    const entrypoint = readRepoFile(".devcontainer/entrypoint.sh");

    expect(entrypoint).toContain('find /home/sandbox -path "$OH_PROJECT_ROOT" -prune -o');
    expect(entrypoint).toContain('-exec chown -h "$owner" {} +');
  });

  it("makes Herdr the first interactive action in canonical onboarding", () => {
    const readme = readRepoFile("README.md");
    const quickstart = readRepoFile("docs/quickstart.md");
    const agents = readRepoFile("AGENTS.md");
    const contributing = readRepoFile("docs/contributing.md");
    const intro = readRepoFile("docs/intro.md");
    const harnessOverview = readRepoFile("docs/harnesses/overview.md");
    const zshrc = readRepoFile(".agro/install/.zshrc");

    const expectBefore = (text: string, first: string, second: string): void => {
      const firstIndex = text.indexOf(first);
      const secondIndex = text.indexOf(second);
      expect(firstIndex, `missing anchor: ${first}`).toBeGreaterThanOrEqual(0);
      expect(secondIndex, `missing anchor: ${second}`).toBeGreaterThanOrEqual(0);
      expect(firstIndex).toBeLessThan(secondIndex);
    };

    expectBefore(readme, "agro tool install herdr", "\nherdr\n");
    expectBefore(readme, "\nherdr\n", "gh auth login");
    expectBefore(quickstart, "## Install and start Herdr first", "agro tool install herdr");
    expectBefore(quickstart, "agro tool install herdr", "\nherdr\n");
    expectBefore(quickstart, "\nherdr\n", "gh auth login");
    expectBefore(agents, "agro tool install herdr", "`herdr`");
    expectBefore(agents, "`herdr`", "gh auth login");
    expectBefore(contributing, "\nherdr\n", "gh auth login");
    expect(intro).toMatch(/`agro\s+tool\s+install\s+herdr`[^`]*`herdr`/);
    expect(harnessOverview).toContain("run `oh tool install herdr`, then run `herdr`");
    expect(zshrc).toContain(".agro/install/banner.sh");
  });

  it("documents correct state and direct-image persistence", () => {
    const herdrDocs = readRepoFile("docs/integrations/herdr.md");
    const imageDocs = readRepoFile("docs/deployment-prebuilt-image.md");

    expect(herdrDocs).toContain("~/.config/herdr");
    expect(herdrDocs).toContain("~/.herdr/worktrees");
    expect(herdrDocs).not.toContain("herdr update");
    expect(imageDocs).toContain(":/home/sandbox \\");
  });
});
