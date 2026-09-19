
export type HarnessKind = "installable" | "on-demand";

export interface HarnessEntry {
  readonly id: string;
  readonly title: string;
  readonly binary: string;
  readonly installArgv: readonly string[];
  readonly installUser: "root" | "sandbox";
  readonly verifyArgv: readonly string[];
  readonly uninstallArgv: readonly string[] | null;
  readonly docsPath: string;
  readonly kind: HarnessKind;
  readonly bypassPermissionsFlag?: string;
}

export const SANDBOX_HARNESS_PREFIX = "/home/sandbox/.local";

export const HARNESS_PREFIX_TOKEN = "{{prefix}}";

export const HARNESS_CATALOG: readonly HarnessEntry[] = [
  {
    id: "claude-code",
    title: "Claude Code",
    binary: "claude",
    installArgv: [
      "npm",
      "--prefix",
      HARNESS_PREFIX_TOKEN,
      "install",
      "-g",
      "@anthropic-ai/claude-code",
    ],
    installUser: "sandbox",
    verifyArgv: ["claude", "--version"],
    uninstallArgv: ["npm", "--prefix", HARNESS_PREFIX_TOKEN, "uninstall", "-g", "@anthropic-ai/claude-code"],
    docsPath: "docs/harnesses/claude-code.md",
    kind: "installable",
    bypassPermissionsFlag: "--permission-mode bypassPermissions",
  },
  {
    id: "codex",
    title: "Codex",
    binary: "codex",
    installArgv: [
      "npm",
      "--prefix",
      HARNESS_PREFIX_TOKEN,
      "install",
      "-g",
      "@openai/codex",
    ],
    installUser: "sandbox",
    verifyArgv: ["codex", "--version"],
    uninstallArgv: ["npm", "--prefix", HARNESS_PREFIX_TOKEN, "uninstall", "-g", "@openai/codex"],
    docsPath: "docs/harnesses/codex.md",
    kind: "installable",
  },
  {
    id: "pi",
    title: "Pi",
    binary: "pi",
    installArgv: [
      "npm",
      "--prefix",
      HARNESS_PREFIX_TOKEN,
      "install",
      "-g",
      "--ignore-scripts",
      "@earendil-works/pi-coding-agent",
    ],
    installUser: "sandbox",
    verifyArgv: ["pi", "--version"],
    uninstallArgv: ["npm", "--prefix", HARNESS_PREFIX_TOKEN, "uninstall", "-g", "@earendil-works/pi-coding-agent"],
    docsPath: "docs/harnesses/pi.md",
    kind: "installable",
  },
  {
    id: "opencode",
    title: "OpenCode",
    binary: "opencode",
    installArgv: [
      "npm",
      "--prefix",
      HARNESS_PREFIX_TOKEN,
      "install",
      "-g",
      "opencode-ai",
    ],
    installUser: "sandbox",
    verifyArgv: ["opencode", "--version"],
    uninstallArgv: ["npm", "--prefix", HARNESS_PREFIX_TOKEN, "uninstall", "-g", "opencode-ai"],
    docsPath: "docs/harnesses/opencode.md",
    kind: "installable",
  },
  {
    id: "grok-build",
    title: "Grok Build",
    binary: "grok",
    installArgv: [
      "bash",
      "-lc",
      `curl -fsSL https://x.ai/cli/install.sh | GROK_BIN_DIR="${HARNESS_PREFIX_TOKEN}/bin" bash -s 0.2.39 && rm -f "${HARNESS_PREFIX_TOKEN}/bin/agent"`,
    ],
    installUser: "sandbox",
    verifyArgv: ["grok", "--version"],
    uninstallArgv: ["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/grok`],
    docsPath: "docs/harnesses/grok-build.md",
    kind: "installable",
  },
  {
    id: "hermes",
    title: "Hermes",
    binary: "hermes",
    installArgv: [
      "bash",
      "-lc",
      `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | HERMES_INSTALL_DIR="${HARNESS_PREFIX_TOKEN}/lib/hermes-agent" bash -s -- --skip-setup --skip-browser && uv pip install --python "${HARNESS_PREFIX_TOKEN}/lib/hermes-agent/venv/bin/python" 'hermes-agent[slack,teams,web,pty]'`,
    ],
    installUser: "sandbox",
    verifyArgv: ["hermes", "--version"],
    uninstallArgv: ["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/hermes`, `${HARNESS_PREFIX_TOKEN}/lib/hermes-agent`],
    docsPath: "docs/harnesses/hermes.md",
    kind: "installable",
  },
  {
    id: "muse-code",
    title: "Muse Code",
    binary: "muse",
    installArgv: [
      "bash",
      "-lc",
      `set -o pipefail; curl -fsSL https://dev.meta.ai/install.sh | MUSE_INSTALL_DIR="${HARNESS_PREFIX_TOKEN}/bin" MUSE_NO_MODIFY_PATH=1 MUSE_LOGIN=0 bash`,
    ],
    installUser: "sandbox",
    verifyArgv: ["muse", "--version"],
    uninstallArgv: ["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/muse`],
    docsPath: "docs/harnesses/muse-code.md",
    kind: "installable",
  },
  {
    id: "antigravity-cli",
    title: "Antigravity CLI",
    binary: "agy",
    installArgv: [
      "bash",
      "-lc",
      `set -o pipefail; curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir "${HARNESS_PREFIX_TOKEN}/bin"`,
    ],
    installUser: "sandbox",
    verifyArgv: ["agy", "--version"],
    uninstallArgv: ["rm", "-rf", `${HARNESS_PREFIX_TOKEN}/bin/agy`],
    docsPath: "docs/harnesses/antigravity-cli.md",
    kind: "installable",
    bypassPermissionsFlag: "--dangerously-skip-permissions",
  },
  {
    id: "t3code",
    title: "T3 Code",
    binary: "t3",
    installArgv: ["npx", "--yes", "t3", "--version"],
    installUser: "sandbox",
    verifyArgv: ["npx", "--no-install", "t3", "--version"],
    uninstallArgv: null,
    docsPath: "docs/harnesses/t3code.md",
    kind: "on-demand",
  },
];

export function findHarness(id: string): HarnessEntry | undefined {
  return HARNESS_CATALOG.find((h) => h.id === id);
}

export function harnessIds(): string[] {
  return HARNESS_CATALOG.map((h) => h.id);
}

function substitute(argv: readonly string[], prefix: string): string[] {
  return argv.map((part) => part.split(HARNESS_PREFIX_TOKEN).join(prefix));
}

export function resolveInstallArgv(entry: HarnessEntry, prefix: string): string[] {
  return substitute(entry.installArgv, prefix);
}

export function resolveVerifyArgv(entry: HarnessEntry, prefix: string): string[] {
  return substitute(entry.verifyArgv, prefix);
}

export function resolveUninstallArgv(
  entry: HarnessEntry,
  prefix: string,
): string[] | null {
  return entry.uninstallArgv === null ? null : substitute(entry.uninstallArgv, prefix);
}

export function harnessLaunchCommand(entry: HarnessEntry): string {
  return entry.bypassPermissionsFlag === undefined
    ? entry.binary
    : `${entry.binary} ${entry.bypassPermissionsFlag}`;
}

export function harnessBinPath(prefix: string): string {
  return `${prefix}/bin`;
}
