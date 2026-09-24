import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findTool,
  installableToolIds,
  toolIds,
  TOOL_CATALOG,
} from "../lib/tools/catalog.js";
import { HARNESS_CATALOG, HARNESS_PREFIX_TOKEN } from "../lib/harnesses/catalog.js";
import { RUNTIME_CATALOG } from "../lib/runtimes/catalog.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (p: string): string => readFileSync(join(REPO_ROOT, p), "utf8");

describe("tool catalog shape", () => {
  it("lists the nine known tools", () => {
    expect(toolIds()).toEqual([
      "agent-browser",
      "herdr",
      "cloudflared",
      "microsandbox",
      "docker-cli",
      "gh",
      "tailscale",
      "code-server",
      "docker",
    ]);
  });

  it("makes exactly the installable tools installable", () => {
    expect(installableToolIds()).toEqual([
      "agent-browser",
      "herdr",
      "cloudflared",
      "microsandbox",
      "tailscale",
      "code-server",
    ]);
    for (const t of TOOL_CATALOG) {
      expect(["baked-in", "installable"], t.id).toContain(t.kind);
      if (t.kind === "installable") {
        expect(t.installArgv ?? t.hostInstallArgv, t.id).toBeDefined();
      }
      if (t.kind === "baked-in") expect(t.installArgv, t.id).toBeUndefined();
    }
  });

  // #906: commands/tool.ts installs with stdio:"inherit", so local-target.ts
  // picks plain `sudo --` for a root install — and /etc/sudoers.d/sandbox has
  // no NOPASSWD. A root install would hang an agent on a password prompt, and
  // could not be upgraded by the running sandbox afterwards.
  it("installs every installable tool as the sandbox user", () => {
    const installable = TOOL_CATALOG.filter((t) => t.installArgv !== undefined);
    expect(installable.length).toBeGreaterThan(0);
    for (const t of installable) {
      expect(t.installUser, t.id).toBe("sandbox");
    }
  });

  it("marks a root-level host install only on a host-capable entry", () => {
    for (const t of TOOL_CATALOG) {
      if (t.hostInstallUser === "root") expect(t.hostCapable, t.id).toBe(true);
    }
    expect(TOOL_CATALOG.filter((t) => t.hostInstallUser === "root").map((t) => t.id)).toEqual([
      "docker",
    ]);
  });

  it("lands every downloaded binary in NPM_USER_PREFIX behind a sha256 check", () => {
    const scripts = TOOL_CATALOG.flatMap((t) =>
      [t.installArgv, t.hostInstallArgv]
        .filter((argv): argv is readonly string[] => argv !== undefined)
        .map((argv) => [t.id, argv.join("\n")] as const),
    ).filter(
      ([id, body]) => body.includes("curl -fsSL") && findTool(id)?.hostInstallUser !== "root",
    );

    expect(scripts.map(([id]) => id)).toEqual([
      "agent-browser",
      "herdr",
      "cloudflared",
      "microsandbox",
      "tailscale",
      "code-server",
    ]);
    for (const [id, body] of scripts) {
      expect(body, id).toContain("NPM_USER_PREFIX");
      expect(body, id).toContain("sha256sum -c -");
    }
  });

  it("keeps every user-level host installer clear of the operating system package manager", () => {
    for (const t of TOOL_CATALOG) {
      if (t.hostInstallArgv === undefined || t.hostInstallUser === "root") continue;
      const body = t.hostInstallArgv.join("\n");
      expect(body, t.id).not.toMatch(/\bapt(-get)?\s/);
      expect(body, t.id).not.toMatch(/\bdpkg\s+-i\b/);
      expect(body, t.id).not.toContain("sudo");
      expect(body, t.id).not.toContain("--with-deps");
    }
  });

  it("gives a host installer only to a tool the host gate admits", () => {
    for (const t of TOOL_CATALOG) {
      if (t.hostInstallArgv !== undefined) expect(t.hostCapable, t.id).toBe(true);
      if (t.hostUninstallArgv !== undefined) expect(t.hostCapable, t.id).toBe(true);
    }
  });

  it("makes every non-installable tool say why", () => {
    for (const t of TOOL_CATALOG) {
      if (t.installArgv === undefined) expect(t.notInstallableReason, t.id).toBeTruthy();
    }
  });

  it("gives every entry a docs path that exists", () => {
    for (const t of TOOL_CATALOG) {
      expect(() => read(t.docsPath), t.id).not.toThrow();
    }
  });

  it("checks presence with `command -v`, never a version flag", () => {
    for (const t of TOOL_CATALOG) {
      expect(t.verifyArgv.join(" "), t.id).toContain(`command -v ${t.binary}`);
    }
  });

  it("declares a version probe only where the flag is a safe standard", () => {
    const withVersion = TOOL_CATALOG.filter((t) => t.versionArgv !== undefined).map((t) => t.id);
    expect(withVersion).toEqual([
      "herdr",
      "cloudflared",
      "microsandbox",
      "docker-cli",
      "gh",
      "tailscale",
      "code-server",
      "docker",
    ]);
    for (const t of TOOL_CATALOG) {
      if (t.versionArgv) expect(t.versionArgv, t.id).toEqual([t.binary, "--version"]);
    }
  });

  it("passes argv arrays with no interpolation this process performs", () => {
    // A `bash -lc` script body legitimately contains ${...} for the shell IN the
    // container to expand, so that one token is exempt. A source-level scan for
    // an interpolating template literal was tried and removed: it cannot tell a
    // JS backtick from a backtick inside prose (`notInstallableReason` has
    // several), so whether it fired depended on catalog ORDER, not the hazard.
    for (const t of TOOL_CATALOG) {
      for (const argv of [t.installArgv, t.verifyArgv, t.versionArgv]) {
        if (!argv) continue;
        const shellBody = argv[0] === "bash" && argv[1] === "-lc" ? 2 : -1;
        argv.forEach((token, i) => {
          if (i === shellBody) return;
          expect(token, `${t.id}: ${token}`).not.toContain("${");
        });
      }
    }
  });
});

describe("the catalogs stay separate", () => {
  it("shares no id with the harness catalog", () => {
    const harness = new Set(HARNESS_CATALOG.map((h) => h.id));
    for (const t of TOOL_CATALOG) {
      expect(harness.has(t.id), `${t.id} is also a harness`).toBe(false);
    }
  });

  it("shares only the microsandbox substrate and the docker engine with the runtime catalog", () => {
    const runtime = new Set(RUNTIME_CATALOG.map((r) => r.id));
    const shared = toolIds().filter((id) => runtime.has(id));
    expect(shared).toEqual(["microsandbox", "docker"]);
    expect(RUNTIME_CATALOG.find((r) => r.id === "microsandbox")?.provisionable).toBe(false);
    expect(findTool("microsandbox")?.kind).toBe("installable");
  });

  it("has unique ids within itself", () => {
    expect(new Set(toolIds()).size).toBe(TOOL_CATALOG.length);
  });

  it("keeps the baked-in docker-cli distinct from the host docker engine", () => {
    expect(findTool("docker-cli")?.kind).toBe("baked-in");
    expect(findTool("docker-cli")?.hostCapable).toBe(false);
    expect(findTool("docker")?.hostInstallUser).toBe("root");
    expect(RUNTIME_CATALOG.some((r) => r.id === "docker")).toBe(true);
  });

  it("leaves agent-browser excluded from the harness catalog", () => {
    expect(HARNESS_CATALOG.some((h) => h.id === "agent-browser")).toBe(false);
  });
});

describe("agent-browser is installed from the catalog, not the boot path", () => {
  const ab = findTool("agent-browser")!;
  const ENTRYPOINT = read(".devcontainer/entrypoint.sh");

  it("declares neither a build arg, an entrypoint guard, nor an agro.json key", () => {
    expect(Object.keys(ab)).not.toContain("buildArg");
    expect(Object.keys(ab)).not.toContain("entrypointGuard");
    expect(ab.kind).toBe("installable");
  });

  it("is absent from the boot path and the Dockerfile", () => {
    expect(ENTRYPOINT).not.toContain("INSTALL_AGENT_BROWSER");
    expect(ENTRYPOINT).not.toContain("agent-browser@");
    expect(read(".devcontainer/Dockerfile")).not.toContain("INSTALL_AGENT_BROWSER");
  });

  it("is the sole owner of the pinned version", () => {
    expect(ab.installArgv!.join(" ")).toContain("agent-browser@0.38.1");
  });

  it("carries every install step itself", () => {
    const argv = ab.installArgv!.join(" ");
    for (const step of [
      "pnpm add -g agent-browser@0.38.1",
      "-exec chmod +x",
      "agent-browser install --with-deps",
    ]) {
      expect(argv, step).toContain(step);
    }
  });

  it("drops log cosmetics, which would eat the exit code", () => {
    const argv = ab.installArgv!.join(" ");
    expect(argv).not.toContain("tail -5");
    expect(argv).not.toContain("[entrypoint]");
  });

  it("arms the download gate with the size the install verb quotes", () => {
    expect(ab.downloadSize).toBe("~1 GB");
    expect(read(".agro/cli/src/commands/tool.ts")).toContain("downloads ${size}");
  });

  it("is reachable only through `agro tool install` — never through compose", () => {
    expect(read(".devcontainer/docker-compose.yml")).not.toContain("INSTALL_AGENT_BROWSER");
    expect(read(".agro/cli/src/lib/config-render.ts")).toContain('"INSTALL_AGENT_BROWSER"');
  });
});

describe("tailscale is installed from the catalog, not the boot path", () => {
  const ts = findTool("tailscale")!;
  const ENTRYPOINT = read(".devcontainer/entrypoint.sh");
  const VERSION = "1.102.3";
  const SHA_AMD64 = "36ddd9b51be57ffc2990cf76323cfa13643bfbb1b8a969f6183fa164741cdef5";
  const SHA_ARM64 = "a0fa1b154af8c61f862a2259f559f7396d96c0225f4a863eae2333e1546bbe25";

  it("declares neither a build arg, an entrypoint guard, nor an agro.json key", () => {
    expect(Object.keys(ts)).not.toContain("buildArg");
    expect(Object.keys(ts)).not.toContain("entrypointGuard");
    expect(ts.kind).toBe("installable");
  });

  it("is absent from the boot path and the Dockerfile", () => {
    expect(ENTRYPOINT).not.toContain("INSTALL_TAILSCALE");
    expect(ENTRYPOINT).not.toContain(`tailscale_${VERSION}_`);
    expect(read(".devcontainer/Dockerfile")).not.toContain("INSTALL_TAILSCALE");
  });

  it("is the sole owner of the pinned version and both checksums", () => {
    const argv = ts.installArgv!.join(" ");
    expect(argv).toContain(`tailscale_${VERSION}_`);
    for (const sha of [SHA_AMD64, SHA_ARM64]) {
      expect(argv, sha).toContain(sha);
      expect(ENTRYPOINT, sha).not.toContain(sha);
    }
    expect(argv).toContain("sha256sum -c -");
  });

  it("downloads from the pinned stable base", () => {
    expect(ts.installArgv!.join(" ")).toContain("https://pkgs.tailscale.com/stable/");
  });

  it("installs as the sandbox user into the home mount", () => {
    expect(ts.installUser).toBe("sandbox");
    const argv = ts.installArgv!.join(" ");
    expect(argv).toContain("NPM_USER_PREFIX");
    expect(argv).not.toContain("/usr/local/bin/tailscale");
    expect(argv).not.toContain("/usr/local/bin/tailscaled");
  });

  it("leaves the root-owned socket directory to the entrypoint", () => {
    expect(ts.installArgv!.join(" ")).not.toContain("/var/run/tailscale");
    expect(ENTRYPOINT).toContain("/var/run/tailscale");
  });

  it("never joins a tailnet — installation is not authentication", () => {
    const argv = ts.installArgv!.join(" ");
    expect(argv).not.toContain("tailscale up");
    expect(argv).not.toMatch(/(^|[^d])tailscaled\s+--tun/);
  });

  it("drops log cosmetics, which would eat the exit code", () => {
    const argv = ts.installArgv!.join(" ");
    expect(argv).not.toContain("[entrypoint]");
    expect(argv).not.toContain("tail -");
  });

  it("arms no download gate — the tarball is small", () => {
    expect(ts.downloadSize).toBeUndefined();
  });

  it("is reachable only through `agro tool install` — never through compose", () => {
    expect(read(".devcontainer/docker-compose.yml")).not.toContain("INSTALL_TAILSCALE");
    expect(read(".agro/cli/src/lib/config-render.ts")).toContain('"INSTALL_TAILSCALE"');
  });
});

describe("code-server installs a pinned release for the invoking user", () => {
  const cs = findTool("code-server")!;
  const script = cs.installArgv!.join("\n");
  const VERSION = "4.129.0";
  const SHA_AMD64 = "889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0";
  const SHA_ARM64 = "62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617";

  it("is an installable, host-capable tool that installs without root", () => {
    expect(cs.kind).toBe("installable");
    expect(cs.hostCapable).toBe(true);
    expect(cs.hostInstallUser).toBeUndefined();
    expect(cs.installUser).toBe("sandbox");
    expect(cs.hostInstallArgv).toBeUndefined();
    expect(script).not.toContain("sudo");
  });

  it("pins the release and both tarball checksums", () => {
    expect(script).toContain(`version=${VERSION}`);
    expect(script).toContain(
      "https://github.com/coder/code-server/releases/download/v$version/code-server-$version-linux-$arch.tar.gz",
    );
    expect(script).toContain(`amd64) sha=${SHA_AMD64} ;;`);
    expect(script).toContain(`arm64) sha=${SHA_ARM64} ;;`);
    expect(script).toContain("sha256sum -c -");
  });

  it("refuses an unpinned architecture by name", () => {
    expect(script).toContain('*) echo "no pinned code-server build for $arch" >&2; exit 1 ;;');
  });

  it("extracts under lib and links the launcher into bin", () => {
    expect(script).toContain('prefix="${NPM_USER_PREFIX:-$HOME/.local}"');
    expect(script).toContain('dest="$prefix/lib/code-server-$version"');
    expect(script).toContain('ln -sfn "$dest/bin/code-server" "$prefix/bin/code-server"');
  });

  it("fails the install unless the linked launcher reports the pinned version", () => {
    expect(script).toContain('"$prefix/bin/code-server" --version | grep -q "^$version "');
  });

  it("removes the link and the extracted release", () => {
    expect(cs.uninstallArgv).toEqual([
      "rm",
      "-rf",
      `${HARNESS_PREFIX_TOKEN}/bin/code-server`,
      `${HARNESS_PREFIX_TOKEN}/lib/code-server-${VERSION}`,
    ]);
    expect(cs.hostUninstallArgv).toBeUndefined();
  });
});

describe("docker installs Docker Engine on an Ubuntu host as root", () => {
  const dk = findTool("docker")!;
  const script = dk.hostInstallArgv!.join("\n");
  const FINGERPRINT = "9DC858229FC7DD38854AE2D88D81803C0EBFCD88";

  it("is a host-only, root-level installable tool", () => {
    expect(dk.kind).toBe("installable");
    expect(dk.binary).toBe("docker");
    expect(dk.hostCapable).toBe(true);
    expect(dk.hostInstallUser).toBe("root");
    expect(dk.installArgv).toBeUndefined();
    expect(dk.hostInstallArgv!.slice(0, 2)).toEqual(["bash", "-lc"]);
    expect(dk.uninstallArgv).toBeNull();
  });

  it("refuses the sandbox by naming access.dockerSocket", () => {
    const reason = dk.notInstallableReason!("agro");
    expect(reason).toContain("access.dockerSocket");
    expect(reason).toContain("agro tool install docker --host");
  });

  it("verifies the engine, the compose plugin, the enabled service and the docker group", () => {
    const verify = dk.verifyArgv.join(" ");
    expect(verify).toContain("command -v docker >/dev/null");
    expect(verify).toContain("docker compose version >/dev/null");
    expect(verify).toContain("systemctl is-enabled --quiet docker");
    expect(verify).toContain('id -nG "${SUDO_USER:-$(id -un)}"');
  });

  it("refuses a host that is not Ubuntu", () => {
    expect(script).toContain(". /etc/os-release");
    expect(script).toContain('if [ "${ID:-}" != ubuntu ]; then');
  });

  it("trusts Docker's repository key only after checking its fingerprint", () => {
    expect(script).toContain("install -m 0755 -d /etc/apt/keyrings");
    expect(script).toContain(
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "$tmp/docker.asc"',
    );
    expect(script).toContain(`fingerprint=${FINGERPRINT}`);
    expect(script).toContain('gpg --homedir "$tmp" --show-keys --with-colons "$tmp/docker.asc"');
    const check = script.indexOf('if [ "$actual" != "$fingerprint" ]; then');
    const trust = script.indexOf('install -m 0644 "$tmp/docker.asc" /etc/apt/keyrings/docker.asc');
    expect(check).toBeGreaterThan(-1);
    expect(trust).toBeGreaterThan(check);
  });

  it("installs the five packages from the signed Docker repository", () => {
    expect(script).toContain(
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list',
    );
    expect(script).toContain(
      "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
    );
  });

  it("adds the invoking user to the docker group and enables the service", () => {
    expect(script).toContain('user="${SUDO_USER:-$(id -un)}"');
    expect(script).toContain('usermod -aG docker "$user"');
    expect(script).toContain("systemctl enable --now docker");
  });

  it("runs as root through the CLI and never calls sudo itself", () => {
    expect(script).toContain("set -e");
    expect(script).not.toContain("sudo ");
  });
});

describe("baked-in tools", () => {
  it("declare no install argv — the installer must not invent one", () => {
    for (const t of TOOL_CATALOG) {
      if (t.kind !== "baked-in") continue;
      expect(t.installArgv, t.id).toBeUndefined();
      expect(t.notInstallableReason, t.id).toBeTruthy();
    }
  });

  it("are each actually in the Dockerfile", () => {
    const dockerfile = read(".devcontainer/Dockerfile");
    const baked = TOOL_CATALOG.filter((t) => t.kind === "baked-in");
    expect(baked.length, "no baked-in tool left to check").toBeGreaterThan(0);
    for (const t of baked) {
      expect(dockerfile, t.id).toContain(t.binary);
    }
  });

  // #948: herdr and cloudflared enter only through `agro tool install`. The
  // inverse of the check above — an installable tool must NOT be in the
  // Dockerfile — lives in .agro/evals/probes/harness-one-door.sh, which matches
  // on the pinned project URL rather than the bare binary name.
  it("no longer claims herdr or cloudflared", () => {
    for (const id of ["herdr", "cloudflared"]) {
      expect(findTool(id)!.kind, id).toBe("installable");
    }
  });
});
