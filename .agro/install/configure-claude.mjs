import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [home, defaultsJson] = process.argv.slice(-2);
const settingsPath = join(home ?? "", ".claude", "settings.json");
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

try {
  const defaults = JSON.parse(defaultsJson);
  if (!home || !isObject(defaults) || !isObject(defaults.permissions)
    || typeof defaults.skipDangerousModePermissionPrompt !== "boolean"
    || typeof defaults.permissions.defaultMode !== "string"
    || typeof defaults.permissions.denyInsteadOfPrompting !== "boolean") {
    throw new Error("invalid defaults");
  }
  const existing = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
  if (!isObject(existing) || (existing.permissions !== undefined && !isObject(existing.permissions))) {
    throw new Error("invalid settings");
  }
  const merged = {
    ...existing,
    skipDangerousModePermissionPrompt: defaults.skipDangerousModePermissionPrompt,
    permissions: {
      ...existing.permissions,
      defaultMode: defaults.permissions.defaultMode,
      denyInsteadOfPrompting: defaults.permissions.denyInsteadOfPrompting,
    },
  };
  if (JSON.stringify(merged) === JSON.stringify(existing)) {
    process.stdout.write(`current ${settingsPath}\n`);
  } else {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`configured ${settingsPath}\n`);
  }
} catch {
  process.stderr.write(`Could not configure ${settingsPath}; repair file permissions or invalid JSON (settings and permissions must be objects), then rerun agro harness install claude.\n`);
  process.exitCode = 1;
}
