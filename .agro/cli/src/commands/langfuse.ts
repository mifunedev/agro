import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { setConfigField } from "../lib/env-file.js";
import { runningInsideSandbox } from "../lib/execution/detect.js";
import { spawnRunner, type LifecycleRunner } from "../lib/execution/runner.js";
import { HARNESS_CATALOG, type HarnessEntry } from "../lib/harnesses/catalog.js";
import { ohConfigPath, readOhConfig, writeOhConfig, type LangfuseSettings } from "../lib/oh-config.js";
import { resolveProjectRoot } from "../lib/project.js";
import * as prompt from "../lib/prompt.js";
import { readSecret, setSecret } from "../lib/secrets.js";
import {
  LANGFUSE_FRAGMENT_KEYS,
  langfuseFragmentPath,
  loadLangfuseCredentials,
  writeLangfuseFragment,
} from "../lib/tracing/providers/langfuse.js";
import type { HarnessTracingSettings, TracingWriteResult } from "../lib/tracing/writer.js";

export interface LangfuseIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  ask?: prompt.Asker;
  askSecret?: prompt.Asker;
}

export interface LangfuseOptions {
  bin: string;
  cwd?: string;
  home?: string;
  insideSandbox?: boolean;
  run?: LifecycleRunner;
}

export interface LangfuseSetupOptions extends LangfuseOptions {
  yes?: boolean;
}

export const DEFAULT_LANGFUSE_BASE_URL = "https://cloud.langfuse.com";

export const LANGFUSE_FRAGMENT_LABEL = "~/.config/agro/langfuse.env";

export const LANGFUSE_HEALTH_PATH = "/api/public/health";

const CREDENTIAL_KEYS = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"] as const;

const WIZARD_STEPS = 5;

const COMMAND_TIMEOUT_MS = 15_000;

export const BASE_URL_CHOICES: readonly { readonly label: string; readonly url: string }[] = [
  { label: "Langfuse Cloud or another remote HTTPS deployment", url: DEFAULT_LANGFUSE_BASE_URL },
  { label: "Langfuse on the Docker host", url: "http://host.docker.internal:3000" },
  { label: "Langfuse as a Compose service on a shared Docker network", url: "http://langfuse-web:3000" },
];

export type PluginState = "installed" | "missing" | "unknown";

export interface PluginProbe {
  readonly harnessId: string;
  readonly plugin: string;
  readonly listArgv: readonly string[];
  readonly installedWhen: (stdout: string) => boolean;
  readonly installArgvs: readonly (readonly string[])[];
}

export const PLUGIN_PROBES: readonly PluginProbe[] = [
  {
    harnessId: "claude-code",
    plugin: "langfuse-observability@langfuse-observability",
    listArgv: ["claude", "plugin", "list"],
    installedWhen: (stdout) => stdout.includes("langfuse-observability@langfuse-observability"),
    installArgvs: [
      ["claude", "plugin", "marketplace", "add", "langfuse/Claude-Observability-Plugin"],
      ["claude", "plugin", "install", "langfuse-observability@langfuse-observability"],
    ],
  },
  {
    harnessId: "pi",
    plugin: "@langfuse/pi-observability-plugin",
    listArgv: ["pi", "list"],
    installedWhen: (stdout) => stdout.includes("npm:@langfuse/pi-observability-plugin"),
    installArgvs: [["pi", "install", "npm:@langfuse/pi-observability-plugin"]],
  },
  {
    harnessId: "codex",
    plugin: "tracing@codex-observability-plugin",
    listArgv: ["codex", "plugin", "list"],
    installedWhen: (stdout) => /^tracing@codex-observability-plugin\s+installed/m.test(stdout),
    installArgvs: [
      ["codex", "plugin", "marketplace", "add", "langfuse/codex-observability-plugin"],
      ["codex", "plugin", "add", "tracing@codex-observability-plugin"],
    ],
  },
];

export interface PluginReport {
  readonly harness: HarnessEntry;
  readonly probe: PluginProbe;
  readonly state: PluginState;
}

function shellWords(argv: readonly string[]): string {
  return argv.join(" ");
}

export function probePlugins(run: LifecycleRunner): PluginReport[] {
  const reports: PluginReport[] = [];
  for (const harness of tracingHarnesses()) {
    const probe = PLUGIN_PROBES.find((candidate) => candidate.harnessId === harness.id);
    if (probe === undefined) continue;
    let result;
    try {
      result = run(probe.listArgv[0], [...probe.listArgv.slice(1)], { stdio: "capture", timeoutMs: COMMAND_TIMEOUT_MS });
    } catch {
      reports.push({ harness, probe, state: "unknown" });
      continue;
    }
    if (result.error?.code === "ENOENT") continue;
    if (result.error !== undefined || result.status !== 0 || result.stdout === undefined) {
      reports.push({ harness, probe, state: "unknown" });
      continue;
    }
    reports.push({ harness, probe, state: probe.installedWhen(result.stdout) ? "installed" : "missing" });
  }
  return reports;
}

function printPlugins(reports: PluginReport[], io: LangfuseIO): void {
  if (reports.length === 0) return;
  io.stdout("plugins:\n");
  for (const report of reports) {
    io.stdout(`  ${report.state.padEnd(9)} ${report.harness.title} (${report.probe.plugin})\n`);
    if (report.state === "missing") {
      for (const argv of report.probe.installArgvs) io.stdout(`             ${shellWords(argv)}\n`);
    }
  }
}

function healthy(run: LifecycleRunner, baseUrl: string): boolean {
  const url = `${baseUrl.replace(/\/+$/, "")}${LANGFUSE_HEALTH_PATH}`;
  try {
    const result = run("curl", ["-fsS", "--max-time", "10", url], { stdio: "capture", timeoutMs: COMMAND_TIMEOUT_MS });
    return result.error === undefined && result.status === 0;
  } catch {
    return false;
  }
}

export type GeneratedFileState = "current" | "drifted" | "missing";

export interface GeneratedFileReport {
  readonly path: string;
  readonly state: GeneratedFileState;
}

export interface ResolvedLangfuse {
  readonly enabled: boolean;
  readonly settings: LangfuseSettings;
  readonly tracing: HarnessTracingSettings;
}

interface Context {
  readonly root: string;
  readonly home: string;
  readonly insideSandbox: boolean;
}

function context(opts: LangfuseOptions): Context {
  return {
    root: resolveProjectRoot(opts.cwd),
    home: opts.home ?? homedir(),
    insideSandbox: opts.insideSandbox ?? runningInsideSandbox(),
  };
}

export function resolveLangfuse(root: string): ResolvedLangfuse {
  const config = readOhConfig(ohConfigPath(root));
  const settings = config.langfuse ?? {};
  const enabled = settings.enabled === true;
  return {
    enabled,
    settings,
    tracing: {
      enabled,
      baseUrl: settings.baseUrl ?? DEFAULT_LANGFUSE_BASE_URL,
      environment: settings.environment ?? config.name ?? "sandbox",
      ...(settings.userId === undefined ? {} : { userId: settings.userId }),
    },
  };
}

function tracingHarnesses(): (HarnessEntry & { tracingWriter: NonNullable<HarnessEntry["tracingWriter"]> })[] {
  return HARNESS_CATALOG.filter(
    (entry): entry is HarnessEntry & { tracingWriter: NonNullable<HarnessEntry["tracingWriter"]> } =>
      entry.tracingWriter !== undefined,
  );
}

function hostRefusal(bin: string): string {
  return (
    `~/.claude and ~/.pi exist only in the sandbox — settings saved; ` +
    `run \`${bin} langfuse apply\` in the sandbox or restart it\n`
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function displayPath(home: string, path: string): string {
  const rel = relative(home, path);
  return rel.startsWith("..") ? path : `~/${rel}`;
}

function withTempHome<T>(fn: (home: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "agro-langfuse-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function probeGeneratedFile(
  home: string,
  render: (home: string) => TracingWriteResult,
): GeneratedFileReport {
  const rel = withTempHome((scratch) => relative(scratch, render(scratch).path));
  const path = join(home, rel);
  if (!existsSync(path)) return { path, state: "missing" };
  const outcome = withTempHome((scratch) => {
    const copy = join(scratch, rel);
    mkdirSync(dirname(copy), { recursive: true });
    copyFileSync(path, copy);
    return render(scratch).outcome;
  });
  return { path, state: outcome === "unchanged" ? "current" : "drifted" };
}

function renderAll(
  ctx: Context,
  resolved: ResolvedLangfuse,
  io: LangfuseIO,
  bin: string,
  verb: string,
): number {
  let failed = false;
  const report = (result: TracingWriteResult): void => {
    io.stdout(`${result.outcome === "written" ? "wrote    " : "unchanged"} ${displayPath(ctx.home, result.path)}\n`);
  };
  const attempt = (label: string, render: () => TracingWriteResult): void => {
    try {
      report(render());
    } catch (error) {
      failed = true;
      io.stderr(`${bin} langfuse ${verb}: ${label} failed — ${errorText(error)}\n`);
    }
  };

  if (resolved.enabled) {
    attempt(LANGFUSE_FRAGMENT_LABEL, () => {
      const credentials = loadLangfuseCredentials(ctx.root);
      return writeLangfuseFragment(ctx.home, {
        ...credentials,
        baseUrl: resolved.tracing.baseUrl,
        environment: resolved.tracing.environment,
      });
    });
  }
  for (const entry of tracingHarnesses()) {
    attempt(`${entry.title} file`, () => entry.tracingWriter(ctx.home, resolved.tracing));
  }
  return failed ? 1 : 0;
}

function resolveOrReport(
  opts: LangfuseOptions,
  io: LangfuseIO,
  label: string,
): { ctx: Context; resolved: ResolvedLangfuse } | undefined {
  try {
    const ctx = context(opts);
    return { ctx, resolved: resolveLangfuse(ctx.root) };
  } catch (error) {
    io.stderr(`${opts.bin} ${label}: ${errorText(error)}\n`);
    return undefined;
  }
}

export async function runLangfuseApply(opts: LangfuseOptions, io: LangfuseIO): Promise<number> {
  const state = resolveOrReport(opts, io, "langfuse apply");
  if (state === undefined) return 1;
  const { ctx, resolved } = state;

  if (!resolved.enabled) {
    io.stdout(`langfuse: not configured (langfuse.enabled is not true in agro.json) — nothing written\n`);
    return 0;
  }
  if (!ctx.insideSandbox) {
    io.stderr(`${opts.bin} langfuse apply: ${hostRefusal(opts.bin)}`);
    return 1;
  }
  return renderAll(ctx, resolved, io, opts.bin, "apply");
}

function zshenvWarning(home: string): string | undefined {
  const zshenv = join(home, ".zshenv");
  if (!existsSync(zshenv)) return undefined;
  if (readFileSync(zshenv, "utf8").includes("langfuse.env")) return undefined;
  return (
    `~/.zshenv exists but does not source ${LANGFUSE_FRAGMENT_LABEL} — ` +
    `non-interactive shells will carry no Langfuse credentials; add the source block from .agro/install/.zshenv\n`
  );
}

function printResolved(resolved: ResolvedLangfuse, root: string, io: LangfuseIO): void {
  const { settings, tracing } = resolved;
  io.stdout(`langfuse: ${resolved.enabled ? "enabled" : "disabled"}\n`);
  io.stdout(`  baseUrl:      ${tracing.baseUrl}${settings.baseUrl === undefined ? " (default)" : ""}\n`);
  io.stdout(`  environment:  ${tracing.environment}${settings.environment === undefined ? " (default)" : ""}\n`);
  io.stdout(`  userId:       ${tracing.userId ?? "(unset)"}\n`);
  for (const key of CREDENTIAL_KEYS) {
    const value = readSecret(root, key);
    io.stdout(`  ${key}: ${value === undefined ? "not set" : prompt.redact(value)}\n`);
  }
}

export async function runLangfuseStatus(opts: LangfuseOptions, io: LangfuseIO): Promise<number> {
  const state = resolveOrReport(opts, io, "langfuse status");
  if (state === undefined) return 1;
  const { ctx, resolved } = state;
  printResolved(resolved, ctx.root, io);

  if (!ctx.insideSandbox) {
    io.stdout(`files: generated in the sandbox — run \`${opts.bin} langfuse status\` there to check them\n`);
    return 0;
  }

  const fragment = langfuseFragmentPath(ctx.home);
  if (!resolved.enabled) {
    if (!existsSync(fragment)) {
      io.stdout(`files:\n  absent   ${displayPath(ctx.home, fragment)}\n`);
      return 0;
    }
    io.stdout(`files:\n  present  ${displayPath(ctx.home, fragment)}\n`);
    io.stderr(
      `${opts.bin} langfuse status: tracing is disabled but the credential fragment is still present — ` +
        `run \`${opts.bin} langfuse disable\` to remove it\n`,
    );
    return 1;
  }

  const reports: GeneratedFileReport[] = [];
  const failures: string[] = [];
  try {
    const credentials = loadLangfuseCredentials(ctx.root);
    reports.push(
      probeGeneratedFile(ctx.home, (home) =>
        writeLangfuseFragment(home, {
          ...credentials,
          baseUrl: resolved.tracing.baseUrl,
          environment: resolved.tracing.environment,
        }),
      ),
    );
  } catch (error) {
    failures.push(`${LANGFUSE_FRAGMENT_LABEL}: ${errorText(error)}`);
  }
  for (const entry of tracingHarnesses()) {
    try {
      reports.push(probeGeneratedFile(ctx.home, (home) => entry.tracingWriter(home, resolved.tracing)));
    } catch (error) {
      failures.push(`${entry.title} file: ${errorText(error)}`);
    }
  }

  io.stdout("files:\n");
  for (const report of reports) {
    io.stdout(`  ${report.state.padEnd(8)} ${displayPath(ctx.home, report.path)}\n`);
  }
  for (const failure of failures) io.stderr(`${opts.bin} langfuse status: ${failure}\n`);
  printPlugins(probePlugins(opts.run ?? spawnRunner), io);

  const warning = zshenvWarning(ctx.home);
  if (warning !== undefined) io.stderr(`${opts.bin} langfuse status: warning: ${warning}`);

  const stale = reports.some((report) => report.state !== "current");
  if (stale || failures.length > 0) {
    io.stderr(`${opts.bin} langfuse status: generated files do not match agro.json — run \`${opts.bin} langfuse apply\`\n`);
    return 1;
  }
  return 0;
}

export async function runLangfuseDisable(opts: LangfuseOptions, io: LangfuseIO): Promise<number> {
  let ctx: Context;
  try {
    ctx = context(opts);
    setConfigField(ctx.root, "langfuse.enabled", "false");
  } catch (error) {
    io.stderr(`${opts.bin} langfuse disable: ${errorText(error)}\n`);
    return 1;
  }
  io.stdout("agro.json: set langfuse.enabled=false (other langfuse settings and .env keys retained)\n");

  if (!ctx.insideSandbox) {
    io.stderr(`${opts.bin} langfuse disable: ${hostRefusal(opts.bin)}`);
    return 1;
  }

  const fragment = langfuseFragmentPath(ctx.home);
  if (existsSync(fragment)) {
    try {
      unlinkSync(fragment);
      io.stdout(`removed   ${displayPath(ctx.home, fragment)}\n`);
    } catch (error) {
      io.stderr(`${opts.bin} langfuse disable: could not remove ${LANGFUSE_FRAGMENT_LABEL} — ${errorText(error)}\n`);
      return 1;
    }
  } else {
    io.stdout(`absent    ${displayPath(ctx.home, fragment)}\n`);
  }

  const code = renderAll(ctx, resolveLangfuse(ctx.root), io, opts.bin, "disable");
  io.stderr(
    `${opts.bin} langfuse disable: warning: harnesses already running keep the ${LANGFUSE_FRAGMENT_KEYS.join(", ")} ` +
      "values they loaded — restart every running harness session to stop tracing\n",
  );
  return code;
}

function isWizardInteractive(opts: LangfuseSetupOptions, io: LangfuseIO): boolean {
  return opts.yes !== true && (process.stdin.isTTY === true || io.ask !== undefined);
}

async function askBaseUrl(ask: prompt.Asker, io: LangfuseIO, current: string): Promise<string> {
  const customIndex = BASE_URL_CHOICES.length;
  const matched = BASE_URL_CHOICES.findIndex((choice) => choice.url === current);
  const preset = matched === -1 ? customIndex : matched;
  io.stdout("  Where does the harness reach Langfuse? (pick from where the harness runs, not where you browse)\n");
  BASE_URL_CHOICES.forEach((choice, index) => {
    io.stdout(`    ${index + 1}) ${choice.label} — ${choice.url}\n`);
  });
  io.stdout(`    ${customIndex + 1}) Custom URL\n`);
  let chosen = preset;
  for (;;) {
    const answer = (await ask(`Choose [1-${customIndex + 1}] [${preset + 1}]:`)).trim();
    if (answer === "") break;
    const index = Number.parseInt(answer, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index <= customIndex) {
      chosen = index;
      break;
    }
    io.stdout(`  Invalid choice. Pick 1-${customIndex + 1}.\n`);
  }
  if (chosen < customIndex) return BASE_URL_CHOICES[chosen].url;
  for (;;) {
    const url = await prompt.askDefaulted(ask, "Langfuse base URL", matched === -1 ? current : "");
    if (/^https?:\/\/\S+$/.test(url)) return url.replace(/\/+$/, "");
    io.stdout("  Enter an http:// or https:// URL.\n");
  }
}

async function askKeys(
  ask: prompt.Asker,
  askSecret: prompt.Asker,
  io: LangfuseIO,
  root: string,
  bin: string,
): Promise<Map<string, string>> {
  const pending = new Map<string, string>();
  for (const key of CREDENTIAL_KEYS) {
    const existing = readSecret(root, key);
    if (existing !== undefined) {
      io.stdout(`  ${key}: currently ${prompt.redact(existing)}\n`);
      if (await prompt.askYesNo(ask, `Keep the current ${key}?`, true)) continue;
    }
    const value = (await askSecret(`Value for ${prompt.bold(key)} (input hidden):`)).trim();
    if (value === "") {
      io.stdout(
        `  ${key}: ${existing === undefined ? `left unset — set it later with \`${bin} secret set ${key}\`` : "unchanged"}\n`,
      );
      continue;
    }
    pending.set(key, value);
  }
  return pending;
}

async function offerPluginInstalls(
  ask: prompt.Asker,
  run: LifecycleRunner,
  io: LangfuseIO,
  bin: string,
): Promise<void> {
  const reports = probePlugins(run);
  printPlugins(reports, io);
  for (const report of reports) {
    if (report.state !== "missing") continue;
    const commands = report.probe.installArgvs.map(shellWords).join(" && ");
    if (!(await prompt.askYesNo(ask, `Install the ${report.harness.title} plugin now? (${commands})`, false))) {
      io.stdout(`  ${report.harness.title}: plugin not installed — run the commands above later\n`);
      continue;
    }
    for (const argv of report.probe.installArgvs) {
      io.stdout(`  running: ${shellWords(argv)}\n`);
      const result = run(argv[0], [...argv.slice(1)], { stdio: "inherit" });
      if (result.error !== undefined || result.status !== 0) {
        io.stderr(
          `${bin} config langfuse: \`${shellWords(argv)}\` failed` +
            `${result.error?.message !== undefined ? ` — ${result.error.message}` : result.status === null ? "" : ` (exit ${result.status})`}` +
            "; the saved configuration is intact, install the plugin by hand and re-run\n",
        );
        break;
      }
    }
  }
}

export async function runLangfuseSetup(opts: LangfuseSetupOptions, io: LangfuseIO): Promise<number> {
  const bin = opts.bin;
  if (!isWizardInteractive(opts, io)) {
    io.stdout(`${bin} config langfuse: no interactive terminal — skipping the wizard and running \`${bin} langfuse apply\`\n`);
    return runLangfuseApply(opts, io);
  }

  const state = resolveOrReport(opts, io, "config langfuse");
  if (state === undefined) return 1;
  const { ctx, resolved } = state;
  const ask = io.ask ?? prompt.ask;
  const askSecret = io.askSecret ?? prompt.askSecret;
  const run = opts.run ?? spawnRunner;

  prompt.header("Configure Langfuse tracing  (press Enter to accept the shown default)");

  prompt.step(1, WIZARD_STEPS, "Enable");
  if (resolved.enabled) {
    if (!(await prompt.askYesNo(ask, "Langfuse tracing is enabled. Keep it enabled?", true))) {
      io.stdout("langfuse: disabling tracing\n");
      return runLangfuseDisable(opts, io);
    }
  } else if (!(await prompt.askYesNo(ask, "Enable Langfuse tracing?", false))) {
    io.stdout("langfuse: not enabled — nothing written\n");
    return 0;
  }

  prompt.step(2, WIZARD_STEPS, "Base URL");
  const baseUrl = await askBaseUrl(ask, io, resolved.tracing.baseUrl);

  prompt.step(3, WIZARD_STEPS, "API keys");
  const pendingKeys = await askKeys(ask, askSecret, io, ctx.root, bin);

  prompt.step(4, WIZARD_STEPS, "Segmentation");
  const environment = await prompt.askDefaulted(ask, "Trace environment", resolved.tracing.environment);
  const userId = await prompt.askDefaulted(ask, "User id (blank for none)", resolved.tracing.userId ?? "");

  prompt.step(5, WIZARD_STEPS, "Verify and write");
  const healthUrl = `${baseUrl}${LANGFUSE_HEALTH_PATH}`;
  if (healthy(run, baseUrl)) {
    io.stdout(`  reachable  ${healthUrl}\n`);
  } else {
    io.stderr(
      `${bin} config langfuse: warning: GET ${healthUrl} failed — ` +
        "the URL may resolve only from inside the sandbox, or the deployment may be down\n",
    );
    if (!(await prompt.askYesNo(ask, "Save the configuration anyway?", true))) {
      io.stdout("langfuse: not saved — nothing written\n");
      return 0;
    }
  }

  try {
    const config = readOhConfig(ohConfigPath(ctx.root));
    config.langfuse = {
      enabled: true,
      baseUrl,
      environment,
      ...(userId === "" ? {} : { userId }),
    };
    writeOhConfig(ctx.root, config);
    io.stdout(`agro.json: set langfuse.enabled=true baseUrl=${baseUrl} environment=${environment} userId=${userId === "" ? "(unset)" : userId}\n`);
    for (const [key, value] of pendingKeys) {
      setSecret(ctx.root, key, value);
      io.stdout(`.env: set ${key}=${prompt.redact(value)}\n`);
    }
  } catch (error) {
    io.stderr(`${bin} config langfuse: ${errorText(error)}\n`);
    return 1;
  }

  await offerPluginInstalls(ask, run, io, bin);

  return runLangfuseApply(opts, io);
}
