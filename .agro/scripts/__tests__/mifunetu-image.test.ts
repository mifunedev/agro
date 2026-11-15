import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dockerfile = readFileSync(path.join(repoRoot, ".devcontainer/Dockerfile"), "utf8");

function stage(name: string): string[] {
  const lines = dockerfile.split("\n");
  const start = lines.findIndex((line) => new RegExp(`^FROM \\S+ AS ${name}$`).test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const next = lines.findIndex((line, index) => index > start && /^FROM\s/.test(line));
  return lines.slice(start, next === -1 ? lines.length : next);
}

function instructions(lines: string[]): string[] {
  return lines.filter((line) => line.trim() !== "" && !/^\s/.test(line) && !line.startsWith("#"));
}

const mifunetu = stage("mifunetu");
const mifunetuText = mifunetu.join("\n");
const base = stage("base");
const baseText = base.join("\n");

describe("mifunetu image stage", () => {
  it("is the first stage, built from the pinned Node 24 Trixie slim image", () => {
    const firstFrom = dockerfile.split("\n").find((line) => /^FROM\s/.test(line));
    expect(firstFrom).toBe(
      "FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS mifunetu",
    );
  });

  it.each([
    ["the apt tool set", "apt-get install -y --no-install-recommends \\"],
    ["gh", "install -y --no-install-recommends gh"],
    ["the docker CLI and compose plugin", "docker-ce-cli docker-compose-plugin"],
    ["hadolint 2.12.0", "ARG HADOLINT_VERSION=2.12.0"],
    ["uv", "https://astral.sh/uv/install.sh"],
    ["pnpm 10.33.0", "corepack prepare pnpm@10.33.0 --activate"],
    ["the timezone", "ENV TZ=America/Denver"],
    ["PNPM_HOME", 'ENV PNPM_HOME="/home/sandbox/.local/share/pnpm"'],
    ["NPM_USER_PREFIX", 'ENV NPM_USER_PREFIX="/home/sandbox/.local"'],
    ["PATH", 'ENV PATH="$NPM_USER_PREFIX/bin:$PNPM_HOME:$PATH"'],
    ["COREPACK_ENABLE_DOWNLOAD_PROMPT", "ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0"],
    ["the root corepack cache copied to user sandbox", "cp -a /root/.cache/node/corepack /home/sandbox/.cache/node/corepack"],
    ["sandbox ownership of its corepack cache", "chown -R sandbox:sandbox /home/sandbox/.cache/node"],
    ["the license label", 'LABEL org.opencontainers.image.licenses="Apache-2.0"'],
    ["NPM_CONFIG_PREFIX", 'ENV NPM_CONFIG_PREFIX="$NPM_USER_PREFIX"'],
    ["UV_TOOL_DIR", "ENV UV_TOOL_DIR=/home/sandbox/.local/share/uv/tools"],
    ["UV_TOOL_BIN_DIR", "ENV UV_TOOL_BIN_DIR=/home/sandbox/.local/bin"],
    ["UV_PYTHON_INSTALL_DIR", "ENV UV_PYTHON_INSTALL_DIR=/home/sandbox/.local/share/uv/python"],
    ["UV_PYTHON_BIN_DIR", "ENV UV_PYTHON_BIN_DIR=/home/sandbox/.local/bin"],
    ["UV_CACHE_DIR", "ENV UV_CACHE_DIR=/home/sandbox/.cache/uv"],
    ["the bash shell", 'SHELL ["/bin/bash", "-c"]'],
    ["removal of the node user", "userdel -r node"],
    ["user sandbox with uid 1000", "useradd -m -u 1000 -s /bin/zsh sandbox"],
    ["the sandbox sudoers file", "/etc/sudoers.d/sandbox"],
    ["docker group membership", "usermod -aG docker sandbox"],
    ["an empty sandbox-owned .zshrc", "install -o sandbox -g sandbox -m 0644 /dev/null /home/sandbox/.zshrc"],
    ["the zsh login PATH fragment", `printf '%s\\n' "emulate sh -c '. /etc/profile.d/mifunetu-path.sh'" >> /etc/zsh/zprofile`],
    ["the source label", 'LABEL org.opencontainers.image.source="https://github.com/mifunedev/agro"'],
    ["the title label", 'LABEL org.opencontainers.image.title="mifunetu"'],
  ])("holds %s", (_, text) => {
    expect(mifunetuText).toContain(text);
  });

  it.each(["/opt/agro", "agro-assets", "cc-safety-net", "AGRO_", "HERMES_HOME", "container=docker"])(
    "contains no agro string %s",
    (text) => {
      expect(mifunetuText).not.toContain(text);
    },
  );

  it("keeps three apt layers with one apt-get update each", () => {
    const starts = mifunetu.flatMap((line, index) => (line.trim() !== "" && !/^\s/.test(line) ? [index] : []));
    const aptRuns = starts
      .map((start, index) => mifunetu.slice(start, starts[index + 1]).join("\n"))
      .filter((text) => text.startsWith("RUN ") && text.includes("apt-get"));
    expect(aptRuns).toHaveLength(3);
    for (const text of aptRuns) {
      expect(text.match(/apt-get update/g)).toHaveLength(1);
    }
  });

  it("installs no second JavaScript runtime", () => {
    expect(dockerfile).not.toMatch(/\bb[u]n\b/i);
  });

  it("ends as user sandbox in the home directory with no entrypoint and a login shell as the default command", () => {
    expect(instructions(mifunetu).slice(-4)).toEqual([
      "USER sandbox",
      "WORKDIR /home/sandbox",
      "ENTRYPOINT []",
      'CMD ["/bin/bash", "-l"]',
    ]);
    expect(mifunetu.filter((line) => /^(CMD|ENTRYPOINT)\b/.test(line))).toEqual([
      "ENTRYPOINT []",
      'CMD ["/bin/bash", "-l"]',
    ]);
  });

  it("adds the sandbox user bin directories to PATH only for uid 1000 login shells through /etc/profile.d", () => {
    expect(mifunetuText).toContain("> /etc/profile.d/mifunetu-path.sh");
    expect(mifunetuText).toContain(`'if [ "$(id -u)" = 1000 ]; then'`);
    expect(mifunetuText).toContain('"  for mifunetu_dir in $PNPM_HOME $NPM_USER_PREFIX/bin; do"');
    expect(mifunetuText).toContain(`'    case ":$PATH:" in *":$mifunetu_dir:"*) ;; *) PATH="$mifunetu_dir:$PATH" ;; esac'`);
    expect(mifunetuText).toContain("'  export PATH'");
    expect(mifunetuText).toContain("'fi'");
    expect(mifunetuText).toContain("chmod 0644 /etc/profile.d/mifunetu-path.sh");
    const fragment = mifunetuText.slice(
      mifunetuText.indexOf("RUN printf '%s\\n'"),
      mifunetuText.indexOf("> /etc/profile.d/mifunetu-path.sh"),
    );
    expect(fragment).not.toContain("/home/sandbox");
  });

  it("sets no shared COREPACK_HOME and fetches pnpm only once", () => {
    expect(dockerfile).not.toContain("COREPACK_HOME");
    expect(dockerfile.match(/corepack prepare/g)).toEqual(["corepack prepare"]);
  });

  it("keeps the root corepack cache, so root also resolves the pin without a download", () => {
    expect(dockerfile).not.toMatch(/\b(mv|rm -rf?)\s+\/root\/\.cache\/node\/corepack\b/);
  });

  it("gives uid 1000 no path under /usr/local", () => {
    expect(dockerfile).not.toMatch(/chown\b[^\n]*\b(1000|sandbox)\b[^\n]*\/usr\/local/);
    expect(dockerfile).not.toMatch(/chown\b[^\n]*\b(1000|sandbox)\b[^\n]*\$COREPACK/);
  });

  it("keeps the literal corepack pnpm pin as the only pin in the Dockerfile", () => {
    expect(dockerfile.match(/corepack prepare pnpm@/g)).toEqual(["corepack prepare pnpm@"]);
    expect(dockerfile.match(/pnpm@\d+\.\d+\.\d+/g)).toEqual(["pnpm@10.33.0"]);
  });
});

describe("base stage on mifunetu", () => {
  it("starts from mifunetu and switches back to root under a scoped DL3002 directive", () => {
    expect(instructions(base).slice(0, 2)).toEqual(["FROM mifunetu AS base", "USER root"]);
    expect(base.slice(0, 3)).toEqual(["FROM mifunetu AS base", "# hadolint ignore=DL3002", "USER root"]);
    expect(dockerfile.match(/hadolint ignore=DL3002/g)).toHaveLength(1);
  });

  it("does not ignore DL3002 for the whole Dockerfile", () => {
    expect(readFileSync(path.join(repoRoot, ".hadolint.yaml"), "utf8")).not.toContain("DL3002");
  });

  it.each([
    "ENV container=docker",
    "ENV AGRO_PROJECT_ROOT=",
    "ENV HERMES_HOME=",
    "npm install -g cc-safety-net@2.6.8 --prefix /usr/local",
    "/opt/agro-assets/",
    "COPY .agro/cli/ /opt/agro/",
    "npm run build",
    "ln -sf /opt/agro/dist/agro.js /usr/local/bin/agro",
  ])("holds the agro addition %s", (text) => {
    expect(baseText).toContain(text);
  });

  it.each([
    "apt-get",
    "HADOLINT_VERSION",
    "astral.sh",
    "corepack prepare",
    "useradd",
    "ENV TZ=",
    "ENV PNPM_HOME",
    "ENV NPM_CONFIG_PREFIX",
    "ENV UV_",
    "SHELL ",
  ])("does not repeat the general layer %s", (text) => {
    expect(baseText).not.toContain(text);
  });

  it("installs the agro CLI dependencies before it copies the CLI source", () => {
    const steps = [
      "COPY .agro/cli/package.json .agro/cli/package-lock.json /opt/agro/",
      "npm install --ignore-scripts --no-audit --no-fund",
      "COPY .agro/cli/ /opt/agro/",
      "npm run build",
    ];
    const positions = steps.map((step) => baseText.indexOf(step));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("final stage", () => {
  it("keeps the systemd init command and an empty entrypoint", () => {
    const final = instructions(stage("final"));
    expect(final.slice(-2)).toEqual(["ENTRYPOINT []", 'CMD ["/sbin/init"]']);
  });
});

describe("docker build context", () => {
  it("excludes every nested node_modules directory", () => {
    const ignore = readFileSync(path.join(repoRoot, ".dockerignore"), "utf8").split("\n");
    expect(ignore).toContain("**/node_modules/");
  });
});
