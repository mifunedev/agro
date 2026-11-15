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
  return lines.filter((line) => line.trim() !== "" && !/^\s/.test(line));
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
    ["bun", "https://bun.sh/install"],
    ["uv", "https://astral.sh/uv/install.sh"],
    ["pnpm 10.33.0", "corepack prepare pnpm@10.33.0 --activate"],
    ["the timezone", "ENV TZ=America/Denver"],
    ["PNPM_HOME", 'ENV PNPM_HOME="/home/sandbox/.local/share/pnpm"'],
    ["NPM_USER_PREFIX", 'ENV NPM_USER_PREFIX="/home/sandbox/.local"'],
    ["PATH", 'ENV PATH="$NPM_USER_PREFIX/bin:$PNPM_HOME:$PATH"'],
    ["COREPACK_ENABLE_DOWNLOAD_PROMPT", "ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0"],
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

  it("ends as user sandbox in the home directory", () => {
    expect(instructions(mifunetu).slice(-2)).toEqual(["USER sandbox", "WORKDIR /home/sandbox"]);
  });
});

describe("base stage on mifunetu", () => {
  it("starts from mifunetu and switches back to root", () => {
    expect(instructions(base).slice(0, 2)).toEqual(["FROM mifunetu AS base", "USER root"]);
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
    "apt-get install",
    "HADOLINT_VERSION",
    "bun.sh",
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
});
