import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readRepoFile = (file: string): string => readFileSync(path.join(repoRoot, file), "utf8");

function expectBefore(text: string, earlier: string, later: string): void {
  const earlierAt = text.indexOf(earlier);
  const laterAt = text.indexOf(later);
  expect(earlierAt).toBeGreaterThan(-1);
  expect(laterAt).toBeGreaterThan(-1);
  expect(earlierAt).toBeLessThan(laterAt);
}

describe("Claude aliases", () => {
  it.each([
    { shell: "bash", customRoot: false }, { shell: "bash", customRoot: true },
    { shell: "zsh", customRoot: false }, { shell: "zsh", customRoot: true },
  ])("loads unattended settings in $shell outside the harness (custom root: $customRoot)", ({ shell, customRoot }) => {
    const home = mkdtempSync(path.join(tmpdir(), "agro-claude-alias-"));
    try {
      const root = path.join(home, customRoot ? "custom harness" : "harness");
      mkdirSync(path.join(root, ".agro/install"), { recursive: true });
      const settingsPath = path.join(root, ".agro/install/claude-settings.json");
      writeFileSync(settingsPath, readRepoFile(".agro/install/claude-settings.json"));
      const bin = path.join(home, "bin");
      mkdirSync(bin);
      writeFileSync(path.join(bin, "claude"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
console.log(JSON.stringify({ args, settings: JSON.parse(fs.readFileSync(args[args.indexOf("--settings") + 1], "utf8")) }));
`, { mode: 0o755 });
      let declaration = readRepoFile(".agro/install/.zshrc").match(/^alias claude=.*$/m)![0];
      if (shell === "bash") {
        const echo = readRepoFile(".devcontainer/Dockerfile").match(/&& (echo .*alias claude=.*) >> \/home\/sandbox\/\.bashrc/)![1];
        const rendered = spawnSync("/bin/sh", ["-c", echo], {
          encoding: "utf8", env: { HOME: "/build-home", AGRO_PROJECT_ROOT: "/build-root" },
        });
        expect(rendered.status, rendered.stderr).toBe(0);
        declaration = rendered.stdout;
      }
      const rc = path.join(home, "alias.rc");
      writeFileSync(rc, declaration);
      const result = spawnSync(shell, ["-c", `${shell === "bash" ? "shopt -s expand_aliases; " : ""}source "$1"; eval 'claude -p "approved task"'`, "alias-test", rc], {
        cwd: home, encoding: "utf8", timeout: 10_000,
        env: { HOME: home, ZDOTDIR: home, PATH: `${bin}:/usr/bin:/bin`, ...(customRoot ? { AGRO_PROJECT_ROOT: root } : {}) },
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        args: ["--dangerously-skip-permissions", "--settings", settingsPath, "-p", "approved task"],
        settings: { skipDangerousModePermissionPrompt: true, permissions: { denyInsteadOfPrompting: true } },
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("Pi clipboard defaults in the canonical zshrc", () => {
  function sourceZshrc(interactive: boolean, variables: Record<string, string>): string {
    const home = mkdtempSync(path.join(tmpdir(), "agro-pi-clipboard-"));
    try {
      mkdirSync(path.join(home, "harness/.agro/install"), { recursive: true });
      writeFileSync(path.join(home, "harness/.agro/install/banner.sh"), ":\n");
      mkdirSync(path.join(home, "fpath"));
      writeFileSync(path.join(home, "fpath/compinit"), 'print -r -- fixture-compinit > "$HOME/compinit-used"\n');
      writeFileSync(path.join(home, "fpath/vcs_info"), ":\n");
      const result = spawnSync("zsh", [
        interactive ? "-fic" : "-fc",
        'fpath=("$HOME/fpath"); source "$1"; printf "shell:<%s>:<%s>\\n" "${+PI_CLIPBOARD_OSC52}" "$PI_CLIPBOARD_OSC52"; /bin/sh -c \'printf "child:<%s>:<%s>\\n" "${PI_CLIPBOARD_OSC52+x}" "$PI_CLIPBOARD_OSC52"\'',
        "clipboard-test",
        path.join(repoRoot, ".agro/install/.zshrc"),
      ], {
        cwd: home,
        env: { HOME: home, ZDOTDIR: home, PATH: "/usr/bin:/bin", TERM: "dumb", ...variables },
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.error, "These functional tests require zsh on the test runner").toBeUndefined();
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(readFileSync(path.join(home, "compinit-used"), "utf8")).toBe("fixture-compinit\n");
      return result.stdout;
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }

  it("exports the default to children in an interactive Herdr pane", () => {
    expect(sourceZshrc(true, { HERDR_PANE_ID: "test-pane" }))
      .toBe("shell:<1>:<1>\nchild:<x>:<1>\n");
  });

  it.each(["0", "1", ""])("preserves an explicit value <%s>", (value) => {
    expect(sourceZshrc(true, { HERDR_PANE_ID: "test-pane", PI_CLIPBOARD_OSC52: value }))
      .toBe(`shell:<1>:<${value}>\nchild:<x>:<${value}>\n`);
  });

  it.each([{}, { HERDR_PANE_ID: "" }])("leaves the variable unset without a nonempty pane marker: %j", (variables) => {
    expect(sourceZshrc(true, variables)).toBe("shell:<0>:<>\nchild:<>:<>\n");
  });

  it("leaves the variable unset in a noninteractive Herdr shell", () => {
    expect(sourceZshrc(false, { HERDR_PANE_ID: "test-pane" }))
      .toBe("shell:<0>:<>\nchild:<>:<>\n");
  });
});

describe("default Herdr integration", () => {
  // #906: the pin moved out of the Dockerfile and into the tool catalog, which
  // provisions Herdr into the home mount at boot. The image no longer carries it.
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

      expect(compose).toContain("${AGRO_HOME_MOUNT:-workspace}:/home/sandbox");
      expect(compose).not.toContain("/home/sandbox/.herdr");
      expect(compose).not.toContain("/home/sandbox/.config");
      expect(compose).toMatch(/^  workspace:$/m);
    },
  );

  it("repairs ownership for Herdr state after UID sync", () => {
    const entrypoint = readRepoFile(".devcontainer/entrypoint.sh");

    expect(entrypoint).toContain('find /home/sandbox -path "$AGRO_PROJECT_ROOT" -prune -o');
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

    expectBefore(readme, "\nherdr\n", "gh auth login");
    expectBefore(quickstart, "## Start Herdr first", "gh auth login");
    expectBefore(agents, "Run `agro tool install herdr`, then `herdr`.", "gh auth login");
    expectBefore(contributing, "\nherdr\n", "gh auth login");
    expect(intro).toContain("run `agro tool install herdr` and `herdr` first");
    expect(harnessOverview).toContain("run `agro tool install herdr`, then run `herdr`");
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
