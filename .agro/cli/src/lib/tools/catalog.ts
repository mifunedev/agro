import { HARNESS_PREFIX_TOKEN } from "../harnesses/catalog.js";

export type ToolKind = "baked-in" | "installable";

export interface ToolEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: ToolKind;
  readonly binary: string;
  readonly verifyArgv: readonly string[];
  readonly versionArgv?: readonly string[];
  readonly installArgv?: readonly string[];
  readonly hostInstallArgv?: readonly string[];
  readonly installUser?: "root" | "sandbox";
  readonly hostInstallUser?: "root";
  readonly downloadSize?: string;
  readonly hostDownloadSize?: string;
  readonly notInstallableReason?: (bin: string) => string;
  readonly hostCapable: boolean;
  readonly notHostCapableReason?: (bin: string) => string;
  readonly uninstallArgv: readonly string[] | null;
  readonly hostUninstallArgv?: readonly string[];
  readonly docsPath: string;
}

const TOOLS_DOC = "docs/installation.md";

export const TOOL_HOST_PLATFORM = "linux";

export const TOOL_CATALOG: readonly ToolEntry[] = Object.freeze([
  Object.freeze({
    id: "agent-browser",
    title: "agent-browser",
    kind: "installable",
    binary: "agent-browser",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v agent-browser >/dev/null"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      "pnpm add -g agent-browser@0.38.1 && find \"$PNPM_HOME\" -name \"agent-browser-linux-*\" -exec chmod +x {} \\; && agent-browser install --with-deps",
    ]),
    hostInstallArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        "version=0.38.1",
        'case "$(dpkg --print-architecture)" in',
        "  amd64) arch=x64; sha=5100149a1903211c889de4e545bf36d90803740cea4f99aa22651649f9205ea1 ;;",
        "  arm64) arch=arm64; sha=937b315ee0761e8a62f7950ddcfef9b3d3d8e8d5eb9c9d2bf9e23e5725664511 ;;",
        '  *) echo "no pinned agent-browser build for $(dpkg --print-architecture)" >&2; exit 1 ;;',
        "esac",
        'prefix="${NPM_USER_PREFIX:-$HOME/.local}"',
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        'curl -fsSL "https://github.com/vercel-labs/agent-browser/releases/download/v$version/agent-browser-linux-$arch" -o "$tmp/agent-browser"',
        'echo "$sha  $tmp/agent-browser" | sha256sum -c -',
        'install -d "$prefix/bin"',
        'install -m 0755 "$tmp/agent-browser" "$prefix/bin/agent-browser"',
        'browser=""',
        'for candidate in "$AGENT_BROWSER_EXECUTABLE_PATH" google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do',
        '  test -n "$candidate" || continue',
        '  resolved="$(command -v "$candidate" 2>/dev/null || true)"',
        '  test -n "$resolved" || continue',
        '  browser="$resolved"',
        "  break",
        "done",
        'if [ -z "$browser" ]; then',
        '  echo "agent-browser is installed at $prefix/bin/agent-browser, but no Chromium-family browser was found on this host." >&2',
        '  echo "AGRO does not install browser libraries on the host. Point agent-browser at an existing browser, then rerun:" >&2',
        '  echo "  export AGENT_BROWSER_EXECUTABLE_PATH=/path/to/chrome" >&2',
        '  echo "Or install one with your own package manager. Inside the sandbox, agro tool install agent-browser downloads Chrome for you." >&2',
        "  exit 1",
        "fi",
        'echo "agent-browser will drive $browser"',
        '"$prefix/bin/agent-browser" --version >/dev/null',
      ].join("\n"),
    ]),
    installUser: "sandbox",
    downloadSize: "~1 GB",
    hostCapable: true,
    uninstallArgv: Object.freeze(["bash", "-lc", "pnpm remove -g agent-browser"]),
    hostUninstallArgv: Object.freeze(["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/agent-browser`]),
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "herdr",
    title: "Herdr",
    kind: "installable",
    binary: "herdr",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v herdr >/dev/null"]),
    versionArgv: Object.freeze(["herdr", "--version"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        'version=0.7.4',
        'case "$(dpkg --print-architecture)" in',
        "  amd64) arch=x86_64; sha=bc0fc02d4ba500f9cac2353a43e67fe036785ecca6eb55378e050fac3c103059 ;;",
        "  arm64) arch=aarch64; sha=544e0002de42806d1ab64ccdef3a7e7414f24717b0b6b022bc9e57d2eefd26a2 ;;",
        '  *) echo "no pinned Herdr build for $(dpkg --print-architecture)" >&2; exit 1 ;;',
        "esac",
        'prefix="${NPM_USER_PREFIX:-$HOME/.local}"',
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        'curl -fsSL "https://github.com/ogulcancelik/herdr/releases/download/v$version/herdr-linux-$arch" -o "$tmp/herdr"',
        'echo "$sha  $tmp/herdr" | sha256sum -c -',
        'install -d "$prefix/bin"',
        'install -m 0755 "$tmp/herdr" "$prefix/bin/herdr"',
        'test "$("$prefix/bin/herdr" --version)" = "herdr $version"',
      ].join("\n"),
    ]),
    installUser: "sandbox",
    hostCapable: true,
    uninstallArgv: Object.freeze(["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/herdr`]),
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "cloudflared",
    title: "cloudflared",
    kind: "installable",
    binary: "cloudflared",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v cloudflared >/dev/null"]),
    versionArgv: Object.freeze(["cloudflared", "--version"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        "version=2026.8.2",
        'case "$(dpkg --print-architecture)" in',
        "  amd64) sha=fcfb02b575a52ca1af2e3267af4e1517bcdeb30ac48c834c69abaed3c0576ad2 ;;",
        "  arm64) sha=7747d94570fb390cf47dcb4f9555c193c6355cda9793f0d878d9049e5d6a7790 ;;",
        '  *) echo "no pinned cloudflared build for $(dpkg --print-architecture)" >&2; exit 1 ;;',
        "esac",
        'arch="$(dpkg --print-architecture)"',
        'prefix="${NPM_USER_PREFIX:-$HOME/.local}"',
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        'curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/$version/cloudflared-linux-$arch" -o "$tmp/cloudflared"',
        'echo "$sha  $tmp/cloudflared" | sha256sum -c -',
        'install -d "$prefix/bin"',
        'install -m 0755 "$tmp/cloudflared" "$prefix/bin/cloudflared"',
        '"$prefix/bin/cloudflared" --version >/dev/null',
      ].join("\n"),
    ]),
    installUser: "sandbox",
    hostCapable: true,
    uninstallArgv: Object.freeze(["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/cloudflared`]),
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "microsandbox",
    title: "MicroSandbox CLI",
    kind: "installable",
    binary: "msb",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v msb >/dev/null"]),
    versionArgv: Object.freeze(["msb", "--version"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        "sha=767df6954e09fec9bf8276cc2858fc9038024b3a22fa4740572620370eb719f4",
        'prefix="${NPM_USER_PREFIX:-$HOME/.local}"',
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        'curl -fsSL "https://raw.githubusercontent.com/superradcompany/microsandbox/refs/heads/main/scripts/install.sh" -o "$tmp/install-msb.sh"',
        'echo "$sha  $tmp/install-msb.sh" | sha256sum -c -',
        'MSB_HOME="$prefix/microsandbox" sh "$tmp/install-msb.sh"',
        '"$prefix/bin/msb" --version >/dev/null',
      ].join("\n"),
    ]),
    installUser: "sandbox",
    hostCapable: true,
    uninstallArgv: Object.freeze([
      "rm",
      "-rf",
      `${HARNESS_PREFIX_TOKEN}/bin/msb`,
      `${HARNESS_PREFIX_TOKEN}/microsandbox`,
    ]),
    docsPath: "docs/runtimes/microsandbox.md",
  }),
  Object.freeze({
    id: "docker-cli",
    title: "Docker CLI + Compose",
    kind: "baked-in",
    binary: "docker",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v docker >/dev/null"]),
    versionArgv: Object.freeze(["docker", "--version"]),
    notInstallableReason: (bin: string): string =>
      `The Docker CLI is installed in the base image. Note that the CLI being present says nothing about whether a daemon is reachable — \`${bin} ps <name>\` answers that.`,
    hostCapable: false,
    uninstallArgv: null,
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "gh",
    title: "GitHub CLI",
    kind: "baked-in",
    binary: "gh",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v gh >/dev/null"]),
    versionArgv: Object.freeze(["gh", "--version"]),
    notInstallableReason: (): string =>
      "The GitHub CLI is installed in the base image. Run `gh auth login` inside the sandbox to authenticate it.",
    hostCapable: false,
    uninstallArgv: null,
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "tailscale",
    title: "Tailscale",
    kind: "installable",
    binary: "tailscale",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v tailscale >/dev/null"]),
    versionArgv: Object.freeze(["tailscale", "--version"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      "set -e\narch=\"$(dpkg --print-architecture)\"\ncase \"$arch\" in\n  amd64) tarball=tailscale_1.102.3_amd64.tgz; sha=36ddd9b51be57ffc2990cf76323cfa13643bfbb1b8a969f6183fa164741cdef5 ;;\n  arm64) tarball=tailscale_1.102.3_arm64.tgz; sha=a0fa1b154af8c61f862a2259f559f7396d96c0225f4a863eae2333e1546bbe25 ;;\n  *) echo \"no pinned Tailscale build for $arch\" >&2; exit 1 ;;\nesac\nprefix=\"${NPM_USER_PREFIX:-$HOME/.local}\"\ntmp=\"$(mktemp -d)\"\ntrap 'rm -rf \"$tmp\"' EXIT\ncurl -fsSL \"https://pkgs.tailscale.com/stable/$tarball\" -o \"$tmp/$tarball\"\necho \"$sha  $tmp/$tarball\" | sha256sum -c -\ntar -xzf \"$tmp/$tarball\" -C \"$tmp\"\ninstall -d \"$prefix/bin\"\ninstall -m 0755 \"$tmp/tailscale_1.102.3_$arch/tailscale\" \"$prefix/bin/tailscale\"\ninstall -m 0755 \"$tmp/tailscale_1.102.3_$arch/tailscaled\" \"$prefix/bin/tailscaled\"\ninstall -d -m 0700 \"$HOME/.tailscale\"",
    ]),
    installUser: "sandbox",
    hostCapable: true,
    uninstallArgv: Object.freeze([
      "rm",
      "-rf",
      `${HARNESS_PREFIX_TOKEN}/bin/tailscale`,
      `${HARNESS_PREFIX_TOKEN}/bin/tailscaled`,
    ]),
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "code-server",
    title: "code-server",
    kind: "installable",
    binary: "code-server",
    verifyArgv: Object.freeze(["bash", "-lc", "command -v code-server >/dev/null"]),
    versionArgv: Object.freeze(["code-server", "--version"]),
    installArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        "version=4.129.0",
        'arch="$(dpkg --print-architecture)"',
        'case "$arch" in',
        "  amd64) sha=889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0 ;;",
        "  arm64) sha=62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617 ;;",
        '  *) echo "no pinned code-server build for $arch" >&2; exit 1 ;;',
        "esac",
        'prefix="${NPM_USER_PREFIX:-$HOME/.local}"',
        'dest="$prefix/lib/code-server-$version"',
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        'curl -fsSL "https://github.com/coder/code-server/releases/download/v$version/code-server-$version-linux-$arch.tar.gz" -o "$tmp/code-server.tar.gz"',
        'echo "$sha  $tmp/code-server.tar.gz" | sha256sum -c -',
        'install -d "$tmp/release" "$prefix/lib" "$prefix/bin"',
        'tar -xzf "$tmp/code-server.tar.gz" -C "$tmp/release" --strip-components=1',
        'rm -rf "$dest"',
        'mv "$tmp/release" "$dest"',
        'ln -sfn "$dest/bin/code-server" "$prefix/bin/code-server"',
        'if ! "$prefix/bin/code-server" --version | grep -q "^$version "; then',
        '  echo "$prefix/bin/code-server does not report version $version" >&2',
        "  exit 1",
        "fi",
      ].join("\n"),
    ]),
    installUser: "sandbox",
    hostCapable: true,
    uninstallArgv: Object.freeze([
      "rm",
      "-rf",
      `${HARNESS_PREFIX_TOKEN}/bin/code-server`,
      `${HARNESS_PREFIX_TOKEN}/lib/code-server-4.129.0`,
    ]),
    docsPath: TOOLS_DOC,
  }),
  Object.freeze({
    id: "docker",
    title: "Docker Engine + Compose",
    kind: "installable",
    binary: "docker",
    verifyArgv: Object.freeze([
      "bash",
      "-lc",
      'command -v docker >/dev/null && docker compose version >/dev/null && systemctl is-enabled --quiet docker && id -nG "${SUDO_USER:-$(id -un)}" | tr " " "\\n" | grep -qx docker',
    ]),
    versionArgv: Object.freeze(["docker", "--version"]),
    hostInstallArgv: Object.freeze([
      "bash",
      "-lc",
      [
        "set -e",
        ". /etc/os-release",
        'if [ "${ID:-}" != ubuntu ]; then',
        '  echo "docker installs from Docker\'s Ubuntu repository; this host is ${ID:-unknown}" >&2',
        "  exit 1",
        "fi",
        "fingerprint=9DC858229FC7DD38854AE2D88D81803C0EBFCD88",
        'user="${SUDO_USER:-$(id -un)}"',
        "export DEBIAN_FRONTEND=noninteractive",
        'tmp="$(mktemp -d)"',
        "trap 'rm -rf \"$tmp\"' EXIT",
        "apt-get update",
        "apt-get install -y ca-certificates curl gnupg",
        "install -m 0755 -d /etc/apt/keyrings",
        'curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "$tmp/docker.asc"',
        'actual="$(gpg --homedir "$tmp" --show-keys --with-colons "$tmp/docker.asc" | awk -F: \'$1 == "fpr" { print $10; exit }\')"',
        'if [ "$actual" != "$fingerprint" ]; then',
        '  echo "Docker\'s repository key has fingerprint ${actual:-none}, expected $fingerprint" >&2',
        "  exit 1",
        "fi",
        'install -m 0644 "$tmp/docker.asc" /etc/apt/keyrings/docker.asc',
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list',
        "apt-get update",
        "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
        'usermod -aG docker "$user"',
        "systemctl enable --now docker",
        'echo "$user is in the docker group. Log out and back in before you run docker without sudo."',
      ].join("\n"),
    ]),
    hostInstallUser: "root",
    notInstallableReason: (bin: string): string =>
      `Docker Engine installs on the host only, with \`${bin} tool install docker --host\`. ` +
      "To use Docker inside the sandbox, set `access.dockerSocket` to true in agro.json on the host and recreate the sandbox. That mounts the host Docker socket, which is effectively host root.",
    hostCapable: true,
    uninstallArgv: null,
    docsPath: TOOLS_DOC,
  }),
]);

export function findTool(id: string): ToolEntry | undefined {
  return TOOL_CATALOG.find((t) => t.id === id);
}

export function toolIds(): string[] {
  return TOOL_CATALOG.map((t) => t.id);
}

export function installableToolIds(): string[] {
  return TOOL_CATALOG.filter((t) => t.installArgv !== undefined).map((t) => t.id);
}

export function hostCapableToolIds(): string[] {
  return TOOL_CATALOG.filter((t) => t.hostCapable).map((t) => t.id);
}

export function resolveToolUninstallArgv(
  entry: ToolEntry,
  prefix: string,
  host = false,
): string[] | null {
  const argv = host ? (entry.hostUninstallArgv ?? entry.uninstallArgv) : entry.uninstallArgv;
  return argv === null || argv === undefined
    ? null
    : argv.map((part) => part.split(HARNESS_PREFIX_TOKEN).join(prefix));
}

export function resolveToolInstallArgv(entry: ToolEntry, host: boolean): string[] | undefined {
  const argv = host ? (entry.hostInstallArgv ?? entry.installArgv) : entry.installArgv;
  return argv === undefined ? undefined : [...argv];
}
