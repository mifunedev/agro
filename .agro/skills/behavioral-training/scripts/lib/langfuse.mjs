import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const CLI_PACKAGE = "@langfuse/cli@1.2.4";
export const DEFAULT_BASE_URL = "https://cloud.langfuse.com";
export const MAX_RETRIES = 3;
export const MAX_UNPROCESSABLE_RETRIES = 1;
export const BACKOFF_MS = 1000;
export const OBSERVATION_FIELDS = Object.freeze(["core", "basic", "model", "usage", "trace_context"]);
export const CONTENT_FIELDS = Object.freeze(["core", "basic", "time", "io", "metadata", "model", "usage", "metrics", "trace_context"]);
export const CONTENT_FIELD_GROUPS = Object.freeze(["io", "metadata"]);
export const OBSERVATION_PAGE_LIMIT = 1000;
export const SESSION_PAGE_LIMIT = 100;
export const SCORE_PAGE_LIMIT = 100;
export const SCORE_DATA_TYPES = Object.freeze(["NUMERIC", "BOOLEAN", "CATEGORICAL"]);

export const READ_OPERATIONS = Object.freeze(["projects list", "observations list", "scores list"]);
const REQUIRED_OPERATIONS = Object.freeze(["projects list", "observations list"]);

export const CAUSES = Object.freeze([
  "missing-credentials",
  "forbidden",
  "incompatible-endpoint",
  "unreachable",
  "http-error",
  "bad-response",
  "ambiguous-project",
  "unsupported-operation",
  "cli-unavailable",
  "cli-failed",
  "bad-config",
]);

const MAX_DETAIL = 300;

export class LangfuseError extends Error {
  constructor(cause, message) {
    super(redact(message));
    this.name = "LangfuseError";
    this.cause = cause;
  }
}

export function redact(text) {
  return String(text ?? "")
    .replace(/\b(?:sk|pk)-lf-[A-Za-z0-9_-]+/g, "<redacted>")
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]+/gi, "$1 <redacted>")
    .replace(/(LANGFUSE_(?:PUBLIC|SECRET)_KEY\s*[=:]\s*)\S+/g, "$1<redacted>");
}

function detail(stderr) {
  const text = redact(stderr).trim().split("\n").filter(Boolean).slice(-2).join(" ");
  return text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 1)}…` : text;
}

function clip(value) {
  const text = redact(value).replace(/\s+/g, " ").trim();
  return text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 1)}…` : text;
}

export function serverDetail(envelope, stderr) {
  const body = envelope && typeof envelope === "object" ? envelope.body : null;
  for (const key of ["message", "error"]) {
    const value = body && typeof body === "object" ? body[key] : undefined;
    if (typeof value === "string" && value.trim()) return clip(value);
    if (value && typeof value === "object") return clip(JSON.stringify(value));
  }
  const line = String(stderr ?? "").split("\n").find((entry) => entry.trim());
  return line ? clip(line) : "";
}

function trimSlash(url) {
  return url.replace(/\/+$/, "");
}

export function resolveConfigRoot(repoRoot, env = {}) {
  const candidate = typeof env.AGRO_PROJECT_ROOT === "string" ? env.AGRO_PROJECT_ROOT.trim() : "";
  if (candidate && existsSync(path.join(candidate, "agro.json"))) return path.resolve(candidate);
  return path.resolve(repoRoot);
}

export function resolveBaseUrl(configRoot, env = {}) {
  const file = path.join(configRoot, "agro.json");
  let configured;
  if (existsSync(file)) {
    try {
      configured = JSON.parse(readFileSync(file, "utf8"))?.langfuse?.baseUrl;
    } catch {
      throw new LangfuseError("bad-config", "agro.json is not valid JSON");
    }
  }
  if (typeof configured === "string" && configured.trim()) return trimSlash(configured.trim());
  if (typeof env.LANGFUSE_BASE_URL === "string" && env.LANGFUSE_BASE_URL.trim()) return trimSlash(env.LANGFUSE_BASE_URL.trim());
  return DEFAULT_BASE_URL;
}

export function spawnRunner(command, args, { env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"], shell: false });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (err) => resolve({ exitCode: null, stdout: "", stderr: err.code ?? "spawn failed" }));
    child.on("close", (code) => {
      resolve({
        exitCode: code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new LangfuseError("bad-response", `${label}: the CLI printed output that is not JSON`);
  }
}

function httpCause(status) {
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "incompatible-endpoint";
  return "http-error";
}

function retryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function exitCause(exitCode) {
  if (exitCode === 3) return "missing-credentials";
  if (exitCode === 4) return "unreachable";
  if (exitCode === null) return "cli-unavailable";
  return "cli-failed";
}

function operations(schema) {
  const found = new Set();
  for (const resource of Array.isArray(schema?.resources) ? schema.resources : []) {
    if (typeof resource?.name !== "string" || resource.name.startsWith("legacy-")) continue;
    for (const action of Array.isArray(resource.actions) ? resource.actions : []) {
      if (typeof action?.name === "string" && action.deprecated !== true) found.add(`${resource.name} ${action.name}`);
    }
  }
  return found;
}

function flagList(query) {
  const flags = [];
  for (const [flag, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    flags.push(`--${flag}`, String(value));
  }
  return flags;
}

function readsContent(query) {
  const fields = typeof query.fields === "string" ? query.fields.split(",") : ["core", "basic"];
  return fields.some((field) => CONTENT_FIELD_GROUPS.includes(field.trim()));
}

function page(body, label) {
  if (!body || !Array.isArray(body.data)) throw new LangfuseError("bad-response", `${label}: the response holds no data list`);
  const next = body.meta?.cursor;
  return { items: body.data, cursor: typeof next === "string" && next.length > 0 ? next : null };
}

export function createClient(ctx, { runner = spawnRunner, sleep = defaultSleep } = {}) {
  const env = ctx.env ?? process.env;
  const configRoot = resolveConfigRoot(ctx.repoRoot, env);
  const baseUrl = resolveBaseUrl(configRoot, env);
  const envPath = path.join(configRoot, ".env");
  const envFile = existsSync(envPath) ? envPath : null;
  let apiVersion = null;

  const globals = (version) => [
    "-y",
    CLI_PACKAGE,
    ...(envFile ? ["--env", envFile] : []),
    "--host",
    baseUrl,
    ...(version ? ["--api-version", version] : []),
  ];

  const exec = async (args) => {
    const result = await runner("npx", args, { env });
    return { exitCode: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };

  async function call(resource, action, query = {}) {
    const operation = `${resource} ${action}`;
    if (!READ_OPERATIONS.includes(operation)) {
      throw new LangfuseError("unsupported-operation", `${operation}: the adapter reads only ${READ_OPERATIONS.join(", ")}`);
    }
    if (operation === "observations list" && readsContent(query) && !query["session-id"]) {
      throw new LangfuseError("unsupported-operation", "observations list: a content read needs one session id");
    }
    const args = [...globals(apiVersion), "api", resource, action, ...flagList(query), "--json"];
    let retries = 0;
    let unprocessable = 0;
    for (;;) {
      const result = await exec(args);
      if (result.exitCode === 0) {
        const envelope = parseJson(result.stdout, operation);
        if (!envelope || typeof envelope !== "object" || !("body" in envelope)) {
          throw new LangfuseError("bad-response", `${operation}: the CLI printed no response envelope`);
        }
        return envelope.body;
      }
      if (result.exitCode === 5) {
        const envelope = parseJson(result.stdout, operation);
        const status = Number(envelope?.status);
        const transient = retryable(status) && retries - unprocessable < MAX_RETRIES;
        const repeatable = status === 422 && unprocessable < MAX_UNPROCESSABLE_RETRIES;
        if (transient || repeatable) {
          await sleep(BACKOFF_MS * 2 ** retries);
          retries += 1;
          if (status === 422) unprocessable += 1;
          continue;
        }
        const after = retries > 0 ? ` after ${retries} ${retries === 1 ? "retry" : "retries"}` : "";
        const reason = serverDetail(envelope, result.stderr);
        throw new LangfuseError(
          httpCause(status),
          `${operation}: HTTP ${Number.isFinite(status) ? status : "unknown"}${after}${reason ? `: ${reason}` : ""}`,
        );
      }
      const cause = exitCause(result.exitCode);
      throw new LangfuseError(cause, `${operation}: ${cause} (CLI exit ${result.exitCode ?? "none"}) ${detail(result.stderr)}`.trim());
    }
  }

  async function cliVersion() {
    const result = await exec(["-y", CLI_PACKAGE, "--version"]);
    if (result.exitCode !== 0) {
      throw new LangfuseError("cli-unavailable", `${CLI_PACKAGE} --version failed (exit ${result.exitCode ?? "none"}) ${detail(result.stderr)}`.trim());
    }
    return result.stdout.trim();
  }

  async function schema() {
    const result = await exec([...globals("auto"), "api", "schema", "--json"]);
    if (result.exitCode === 4) throw new LangfuseError("unreachable", `api schema: ${detail(result.stderr)}`);
    if (result.exitCode !== 0) {
      throw new LangfuseError("incompatible-endpoint", `api schema: no compatible API contract (CLI exit ${result.exitCode ?? "none"}) ${detail(result.stderr)}`);
    }
    return parseJson(result.stdout, "api schema");
  }

  async function preflight() {
    const version = await cliVersion();
    const contract = await schema();
    const supported = operations(contract);
    const missing = REQUIRED_OPERATIONS.filter((operation) => !supported.has(operation));
    if (missing.length > 0) {
      throw new LangfuseError("incompatible-endpoint", `the API contract ${contract?.apiVersion ?? "unknown"} lacks ${missing.join(", ")}`);
    }
    if (typeof contract.apiVersion !== "string") throw new LangfuseError("bad-response", "api schema: no apiVersion");
    apiVersion = contract.apiVersion;
    const body = await call("projects", "list");
    const projects = Array.isArray(body?.data) ? body.data : null;
    if (!projects || projects.length === 0) throw new LangfuseError("bad-response", "projects list: the response holds no project");
    if (projects.length > 1) {
      throw new LangfuseError("ambiguous-project", `projects list: the key sees ${projects.length} projects; use a project-scoped key`);
    }
    const [project] = projects;
    if (typeof project?.id !== "string" || typeof project?.name !== "string") {
      throw new LangfuseError("bad-response", "projects list: the project has no id or name");
    }
    return {
      baseUrl,
      configRoot,
      cliVersion: version,
      apiVersion,
      project: { id: project.id, name: project.name },
      capabilities: {
        projects: "projects list",
        observations: "observations list",
        scores: supported.has("scores list") ? "scores list" : null,
        sessions: "observations",
      },
    };
  }

  async function listObservations(query = {}, { cursor = null, limit = OBSERVATION_PAGE_LIMIT } = {}) {
    const body = await call("observations", "list", {
      fields: OBSERVATION_FIELDS.join(","),
      limit,
      "from-start-time": query.fromStartTime,
      "to-start-time": query.toStartTime,
      environment: query.environment,
      cursor,
    });
    return page(body, "observations list");
  }

  async function listSessionObservations(sessionId, { cursor = null, limit = SESSION_PAGE_LIMIT } = {}) {
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new LangfuseError("unsupported-operation", "observations list: a content read needs one session id");
    }
    const body = await call("observations", "list", {
      fields: CONTENT_FIELDS.join(","),
      limit,
      "session-id": sessionId,
      cursor,
    });
    return page(body, "observations list");
  }

  async function listScores(query = {}, { cursor = null, limit = SCORE_PAGE_LIMIT } = {}) {
    const body = await call("scores", "list", {
      fields: "subject",
      "data-type": SCORE_DATA_TYPES.join(","),
      limit,
      "from-timestamp": query.fromTimestamp,
      "to-timestamp": query.toTimestamp,
      environment: query.environment,
      cursor,
    });
    return page(body, "scores list");
  }

  return { baseUrl, configRoot, envFile, call, preflight, listObservations, listSessionObservations, listScores };
}
