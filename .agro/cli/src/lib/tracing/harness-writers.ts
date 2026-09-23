import { join } from "node:path";
import {
  PRIVATE_FILE_MODE,
  isPlainObject,
  readJsonObject,
  renderJson,
  writeTextIfChanged,
  type TracingWriter,
} from "./writer.js";

export const CODEX_TRACING_TAGS = ["codex"] as const;

export function claudeCodeSettingsPath(home: string): string {
  return join(home, ".claude", "settings.json");
}

export function piTracingConfigPath(home: string): string {
  return join(home, ".pi", "agent", "langfuse.json");
}

export function codexTracingConfigPath(home: string): string {
  return join(home, ".codex", "langfuse.json");
}

export const claudeCodeTracingWriter: TracingWriter = (home, settings) => {
  const path = claudeCodeSettingsPath(home);
  const existing = readJsonObject(path, "~/.claude/settings.json");
  const env = existing.env ?? {};
  if (!isPlainObject(env)) {
    throw new Error("~/.claude/settings.json holds a non-object `env` block; repair it by hand, nothing was written");
  }
  const next = {
    ...existing,
    env: {
      ...env,
      LANGFUSE_BASE_URL: settings.baseUrl,
      LANGFUSE_TRACING_ENVIRONMENT: settings.environment,
    },
  };
  return writeTextIfChanged(path, renderJson(next));
};

export const piTracingWriter: TracingWriter = (home, settings) => {
  const config: Record<string, unknown> = { environment: settings.environment };
  if (settings.userId !== undefined) config.userId = settings.userId;
  return writeTextIfChanged(piTracingConfigPath(home), renderJson(config));
};

export const codexTracingWriter: TracingWriter = (home, settings) =>
  writeTextIfChanged(
    codexTracingConfigPath(home),
    renderJson({ enabled: settings.enabled, tags: [...CODEX_TRACING_TAGS], environment: settings.environment }),
    PRIVATE_FILE_MODE,
  );
