import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { setConfigField } from "../lib/env-file.js";
import { runningInsideSandbox } from "../lib/execution/detect.js";
import { HARNESS_CATALOG, type HarnessEntry } from "../lib/harnesses/catalog.js";
import { ohConfigPath, readOhConfig, type LangfuseSettings } from "../lib/oh-config.js";
import { resolveProjectRoot } from "../lib/project.js";
import * as prompt from "../lib/prompt.js";
import { readSecret } from "../lib/secrets.js";
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
}

export interface LangfuseOptions {
  bin: string;
  cwd?: string;
  home?: string;
  insideSandbox?: boolean;
}

export const DEFAULT_LANGFUSE_BASE_URL = "https://cloud.langfuse.com";

export const LANGFUSE_FRAGMENT_LABEL = "~/.config/agro/langfuse.env";

const CREDENTIAL_KEYS = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"] as const;

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

export async function runLangfuseApply(opts: LangfuseOptions, io: LangfuseIO): Promise<number> {
  let ctx: Context;
  let resolved: ResolvedLangfuse;
  try {
    ctx = context(opts);
    resolved = resolveLangfuse(ctx.root);
  } catch (error) {
    io.stderr(`${opts.bin} langfuse apply: ${errorText(error)}\n`);
    return 1;
  }

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
  let ctx: Context;
  let resolved: ResolvedLangfuse;
  try {
    ctx = context(opts);
    resolved = resolveLangfuse(ctx.root);
  } catch (error) {
    io.stderr(`${opts.bin} langfuse status: ${errorText(error)}\n`);
    return 1;
  }
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
