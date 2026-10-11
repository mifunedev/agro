import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export const FACTS_FILE = "facts.jsonl";
export const GUARD_WINDOW = 10;

const TOOL_METADATA_KEYS = Object.freeze(["tool_name", "codex.tool_name"]);
const ERROR_FLAG_KEYS = Object.freeze(["is_error", "isError"]);
const EXIT_KEYS = Object.freeze(["exit_code", "exitCode"]);
const TEXT_KEYS = Object.freeze(["content", "text", "output", "error", "stderr", "stdout", "message", "result"]);
const PATH_KEYS = Object.freeze(["file_path", "filePath", "path"]);
const CONTENT_KEYS = Object.freeze(["content", "contents", "new_string", "newString", "patch"]);
const SEARCH_DEPTH = 3;

const EXIT_LINE = /^(?:Exit code|Process exited with code) (\d+)\b/;
const GUARD = /^(?:Error:\s*)?(?:PreToolUse:\S+ hook error|BLOCKED by|hook error:)/i;
const ASK_USER = /\bask (?:the )?(?:user|operator)\b|\bask for (?:approval|permission|confirmation)\b|\bconfirm with the (?:user|operator)\b/i;
const EXPLICIT_PATHS = /\bexplicit (?:file )?paths?\b/i;
const OTHER_REMEDY = /\b(?:use|run|instead|try)\b/i;
const ASK_TOOL = /^(?:AskUserQuestion|ask_user(?:_question)?|request_user_input)$/i;
const EDIT_TOOL = /^(?:write|edit|multiedit|notebookedit|apply_patch|str_replace_editor|str_replace_based_edit_tool|create_file|write_file|edit_file)$/i;
const TEST_COMMAND = /\b(?:vitest|jest|pytest|mocha|rspec|phpunit)\b|\b(?:go|cargo|deno|bun) test\b|\b(?:npm|pnpm|yarn)(?: run)? test\b|\bnode --test\b/;
const PENDING_CHECK = /\bgh\s+pr\s+checks\b/;
const PENDING_EXIT = 8;
const DELETE = /\brm\b|\brmdir\b|\bunlink\b|\s-delete\b|\brmSync\b|\bunlinkSync\b|\brmtree\b|\bos\.remove\b|\bfs\.rm\b/;
const SHELL = /(?:^|\/)(?:ba|z|da)?sh$/;
const SHELL_FLAG = /^-\w*c$/;
const GLOB = /[*?[]/;
const REDIRECT = /(?:>{1,2}|\btee\s+(?:-a\s+)?)\s*([^\s;&|<>]+)/g;
const QUOTED = /(['"`])([^'"`]+)\1/g;
const TRIVIAL_TARGETS = new Set(["", ".", "..", "/", "~", "*"]);
const SUBCOMMAND_PROGRAMS = new Set(["git", "npx", "pnpm", "npm", "yarn", "sudo"]);

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort(byText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function hash(value) {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function findKey(value, keys, accept, depth = 0) {
  if (depth > SEARCH_DEPTH || value === null || typeof value !== "object") return undefined;
  if (!Array.isArray(value)) {
    for (const key of keys) if (accept(value[key])) return value[key];
  }
  for (const item of Object.values(value)) {
    const found = findKey(item, keys, accept, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function textOf(value, depth = 0) {
  if (typeof value === "string") return value;
  if (depth > SEARCH_DEPTH || value === null || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map((item) => textOf(item, depth + 1)).filter(Boolean).join("\n");
  for (const key of TEXT_KEYS) {
    const found = textOf(value[key], depth + 1);
    if (found) return found;
  }
  return "";
}

function joinArgv(list) {
  if (!list.every((item) => typeof item === "string")) return null;
  if (list.length >= 3 && SHELL.test(list[0]) && SHELL_FLAG.test(list[1])) return list[2];
  return list.join(" ");
}

function commandOf(input) {
  if (typeof input === "string") return input.trim() || null;
  if (!isObject(input)) return null;
  for (const key of ["command", "cmd", "script"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length > 0) return joinArgv(value);
  }
  return null;
}

function written(input) {
  if (!isObject(input)) return null;
  const path = PATH_KEYS.map((key) => input[key]).find((value) => typeof value === "string" && value);
  const content = CONTENT_KEYS.map((key) => input[key]).find((value) => typeof value === "string");
  return path && content !== undefined ? { path, content } : null;
}

function toolName(event) {
  const metadata = isObject(event.metadata) ? event.metadata : {};
  return TOOL_METADATA_KEYS.map((key) => metadata[key]).find((value) => typeof value === "string") ?? event.name ?? null;
}

function exitStatus(event, text) {
  const isExit = (value) => Number.isInteger(value);
  const field = findKey(event.output, EXIT_KEYS, isExit) ?? findKey(event.metadata, EXIT_KEYS, isExit);
  if (field !== undefined) return field;
  const line = EXIT_LINE.exec(text.trimStart());
  return line ? Number(line[1]) : null;
}

function remedyOf(text) {
  if (ASK_USER.test(text)) return "ask-user";
  if (EXPLICIT_PATHS.test(text)) return "explicit-paths";
  if (OTHER_REMEDY.test(text)) return "other";
  return null;
}

function callOf(event, index) {
  const text = textOf(event.output) || (event.statusMessage ?? "");
  const exit = exitStatus(event, text);
  const guardText = [text, event.statusMessage ?? ""].map((value) => value.trimStart().replace(EXIT_LINE, "").trimStart()).find((value) => GUARD.test(value));
  const flagged = findKey(event.output, ERROR_FLAG_KEYS, (value) => value === true) ?? findKey(event.metadata, ERROR_FLAG_KEYS, (value) => value === true);
  const guard = guardText !== undefined;
  const failed =
    guard ||
    event.level === "ERROR" ||
    (typeof event.statusMessage === "string" && event.statusMessage.trim() !== "") ||
    flagged === true ||
    (exit !== null && exit !== 0);
  const command = commandOf(event.input);
  const tool = toolName(event);
  return {
    index,
    id: event.observationId,
    tool,
    command,
    key: hash(command ?? event.input),
    write: written(event.input),
    edit: (typeof tool === "string" && EDIT_TOOL.test(tool)) || written(event.input) !== null || /^apply_patch\b/.test(command ?? ""),
    exit,
    failed,
    guard,
    remedy: guard ? remedyOf(guardText) : null,
  };
}

function tokenize(command) {
  const segments = [[]];
  let token = null;
  let raw = "";
  let quote = null;
  const close = () => {
    if (token !== null) segments.at(-1).push({ value: token, raw });
    token = null;
    raw = "";
  };
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote) {
      raw += char;
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      token ??= "";
      raw += char;
      continue;
    }
    if (/\s/.test(char) && char !== "\n") {
      close();
      continue;
    }
    if (char === "\n" || char === ";" || char === "&" || char === "|") {
      close();
      if (segments.at(-1).length > 0) segments.push([]);
      continue;
    }
    token = (token ?? "") + char;
    raw += char;
  }
  close();
  return segments.filter((segment) => segment.length > 0);
}

function normalizePath(value) {
  return value.replace(/^\.\//, "").replace(/\/+$/, "");
}

function deletions(command) {
  const found = [];
  for (const segment of tokenize(command)) {
    const words = segment.map((token) => token.value);
    if (!DELETE.test(segment.map((token) => token.raw).join(" "))) continue;
    const width = SUBCOMMAND_PROGRAMS.has(words[0]) && words.length > 1 ? 2 : 1;
    const targets = new Set();
    for (const token of segment.slice(width)) {
      if (token.value.startsWith("-")) continue;
      targets.add(normalizePath(token.value));
      for (const match of token.value.matchAll(QUOTED)) targets.add(normalizePath(match[2]));
    }
    for (const target of TRIVIAL_TARGETS) targets.delete(target);
    found.push({ program: words.slice(0, width).join(" "), targets });
  }
  return found;
}

function scriptTargets(call, blocked) {
  if (call.write && call.write.content.includes(blocked)) return [normalizePath(call.write.path)];
  if (call.command === null || call.command === blocked || !call.command.includes(blocked)) return [];
  return [...call.command.matchAll(REDIRECT)].map((match) => normalizePath(match[1]));
}

function runsScript(call, scripts) {
  if (call.command === null) return false;
  const words = tokenize(call.command).flat().map((token) => normalizePath(token.value));
  return words.some((word) => scripts.has(word) || [...scripts].some((script) => script.endsWith(`/${word}`) || word.endsWith(`/${script}`)));
}

function routedAround(block, calls) {
  const blocked = block.command;
  if (blocked === null) return null;
  const blockedDeletes = deletions(blocked);
  const blockedPrograms = new Set(blockedDeletes.map((item) => item.program));
  const blockedTargets = new Set(blockedDeletes.flatMap((item) => [...item.targets]));
  const scripts = new Set();
  for (const call of calls) {
    if (runsScript(call, scripts)) return call;
    const targets = scriptTargets(call, blocked);
    if (targets.length > 0) {
      for (const target of targets) scripts.add(target);
      continue;
    }
    if (call.command === null || call.command === blocked) continue;
    if (call.command.includes(blocked)) return call;
    const other = deletions(call.command).some(
      (item) => !blockedPrograms.has(item.program) && [...item.targets].some((target) => blockedTargets.has(target)),
    );
    if (other) return call;
  }
  return null;
}

function programOf(command) {
  return command === null ? null : (tokenize(command)[0]?.[0]?.value ?? null);
}

function isBoundary(event, block) {
  if (event.role === "tool") return false;
  if (event.role === "user") return true;
  return event.parentObservationId === null && event.traceId !== block.traceId && event.type !== "GENERATION";
}

function guardFollowUp(events, eventIndex, block, calls) {
  const later = [];
  let boundary = null;
  for (const event of events.slice(eventIndex + 1)) {
    if (event.role === "tool") {
      if (boundary !== null) break;
      later.push(calls.get(event.observationId));
      if (later.length >= GUARD_WINDOW) break;
    } else if (isBoundary(event, events[eventIndex])) {
      if (later.length === 0) return { followUp: "obeyed", next: event.observationId };
      boundary = event;
    }
  }
  const [first] = later;
  if (first === undefined) return { followUp: "obeyed", next: null };
  if (typeof first.tool === "string" && ASK_TOOL.test(first.tool)) return { followUp: "obeyed", next: first.id };
  const route = routedAround(block, later);
  if (route) return { followUp: "routed-around", next: route.id };
  const explicit =
    block.remedy === "explicit-paths" &&
    first.tool === block.tool &&
    first.command !== null &&
    programOf(first.command) === programOf(block.command) &&
    !GLOB.test(first.command);
  return { followUp: explicit ? "obeyed" : "unclear", next: first.id };
}

function redTest(call, later) {
  if (call.command === null || !TEST_COMMAND.test(call.command)) return false;
  const edit = later.findIndex((item) => item.edit);
  if (edit < 0) return false;
  return later.slice(edit + 1).some((item) => item.tool === call.tool && item.command === call.command && !item.failed);
}

function repeatedRuns(calls) {
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length >= 2) runs.push({ tool: current[0].tool, inputHash: current[0].key, observationIds: current.map((call) => call.id) });
    current = [];
  };
  for (const call of calls) {
    const continues = current.length > 0 && call.failed && call.tool === current[0].tool && call.key === current[0].key;
    if (continues) {
      current.push(call);
      continue;
    }
    flush();
    if (call.failed) current = [call];
  }
  flush();
  return runs;
}

export function sessionFacts(chunks) {
  const ordered = [...chunks].sort((a, b) => (a?.chunk?.index ?? 0) - (b?.chunk?.index ?? 0));
  const events = ordered.flatMap((record) => (Array.isArray(record?.events) ? record.events : []));
  const toolEvents = events.map((event, position) => ({ event, position })).filter(({ event }) => event?.role === "tool");
  const list = toolEvents.map(({ event }, index) => callOf(event, index));
  const calls = new Map(list.map((call) => [call.id, call]));
  const facts = {
    sessionId: ordered[0]?.sessionId ?? null,
    toolCalls: list.length,
    toolErrors: 0,
    resolvedErrors: [],
    unresolvedErrors: [],
    excludedErrors: [],
    repeatedFailingCalls: repeatedRuns(list),
    guardBlocks: [],
    unclassified: [],
  };
  for (const call of list) {
    if (!call.failed) continue;
    facts.toolErrors += 1;
    const later = list.slice(call.index + 1);
    if (call.guard) {
      const { followUp, next } = guardFollowUp(events, toolEvents[call.index].position, call, calls);
      facts.guardBlocks.push({ observationId: call.id, remedy: call.remedy, nextObservationId: next, followUp });
      if (followUp === "obeyed") facts.excludedErrors.push({ observationId: call.id, class: "obeyed-guard" });
      else if (followUp === "routed-around") facts.unresolvedErrors.push({ observationId: call.id, tool: call.tool, reason: "guard-routed-around" });
      else facts.unclassified.push({ observationIds: [call.id, next].filter(Boolean), reason: "guard-follow-up-unclear" });
      continue;
    }
    if (call.exit === PENDING_EXIT && call.command !== null && PENDING_CHECK.test(call.command)) {
      facts.excludedErrors.push({ observationId: call.id, class: "pending-check" });
      continue;
    }
    if (redTest(call, later)) {
      facts.excludedErrors.push({ observationId: call.id, class: "red-test" });
      continue;
    }
    const sameTool = later.filter((item) => item.tool === call.tool);
    const changed = sameTool.filter((item) => item.key !== call.key);
    const fix = changed.find((item) => !item.failed);
    if (fix) {
      facts.resolvedErrors.push({ observationId: call.id, tool: call.tool, resolvedBy: fix.id });
      continue;
    }
    const retry = sameTool.find((item) => item.key === call.key && !item.failed);
    if (retry) {
      facts.unclassified.push({ observationIds: [call.id, retry.id], reason: "identical-retry-succeeded" });
      continue;
    }
    const reason = sameTool.length === 0 ? "no-later-call" : changed.length === 0 ? "identical-retries-only" : "changed-calls-failed";
    facts.unresolvedErrors.push({ observationId: call.id, tool: call.tool, reason });
  }
  return facts;
}

export async function* sessionFactStream(lines) {
  const closed = new Set();
  let current = null;
  let chunks = [];
  let line = 0;
  for await (const raw of lines) {
    line += 1;
    if (raw.trim() === "") continue;
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      yield { error: { line, field: null, message: "line is not valid JSON" } };
      continue;
    }
    const sessionId = isObject(record) && typeof record.sessionId === "string" && record.sessionId ? record.sessionId : null;
    if (sessionId === null) {
      yield { error: { line, field: "sessionId", message: "must be a non-empty string" } };
      continue;
    }
    if (sessionId !== current) {
      if (closed.has(sessionId)) {
        yield { error: { line, field: "sessionId", message: "repeats a session that an earlier line closed" } };
        continue;
      }
      if (current !== null) {
        closed.add(current);
        yield { facts: sessionFacts(chunks) };
      }
      current = sessionId;
      chunks = [];
    }
    chunks.push(record);
  }
  if (current !== null) yield { facts: sessionFacts(chunks) };
}

export function fileLines(file) {
  return createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
}
