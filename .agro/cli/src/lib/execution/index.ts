import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { agroConfigPath } from "../agro-config.js";
import { AGRO_VERSION, officialImageRef } from "../version.js";
import { runningInsideSandbox } from "./detect.js";
import {
  DockerComposeExecutionTarget,
  type DockerComposeTargetOptions,
} from "./docker-compose-target.js";
import { LocalExecutionTarget } from "./local-target.js";
import { OpenShellExecutionTarget } from "./openshell-target.js";
import type { ExecutionTarget } from "./target.js";


export type ResolveExecutionTargetOptions = DockerComposeTargetOptions;

export type ResolvedExecutionTarget = ExecutionTarget &
  Required<Pick<ExecutionTarget, "provision" | "attach">>;

export function resolveExecutionTarget(
  opts: ResolveExecutionTargetOptions,
): ResolvedExecutionTarget {
  if (runningInsideSandbox(opts.env ?? process.env)) {
    return new LocalExecutionTarget({
      projectRoot: opts.projectRoot,
      ...(opts.run ? { run: opts.run } : {}),
      ...(opts.env ? { env: opts.env } : {}),
    });
  }
  const entry = readEntrySelection(opts.projectRoot);
  if (entry.runtime === "openshell") {
    return new OpenShellExecutionTarget({
      name: opts.container ?? entry.name ?? basename(resolve(opts.projectRoot)),
      entryRoot: opts.projectRoot,
      image: entry.imageRef ?? officialImageRef(AGRO_VERSION),
      ...(opts.run ? { run: opts.run } : {}),
      ...(opts.env ? { env: opts.env } : {}),
    });
  }
  return new DockerComposeExecutionTarget(opts);
}

interface EntrySelection {
  runtime?: string;
  name?: string;
  imageRef?: string;
}

function readEntrySelection(projectRoot: string): EntrySelection {
  const path = agroConfigPath(projectRoot);
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const record = parsed as { runtime?: unknown; name?: unknown; image?: { ref?: unknown } };
  return {
    ...(typeof record.runtime === "string" ? { runtime: record.runtime } : {}),
    ...(typeof record.name === "string" && record.name !== "" ? { name: record.name } : {}),
    ...(typeof record.image?.ref === "string" && record.image.ref !== "" ? { imageRef: record.image.ref } : {}),
  };
}

export { DockerComposeExecutionTarget, type DockerComposeTargetOptions };
export {
  EXECUTION_TARGET_ENV,
  runningInsideSandbox,
  SANDBOX_MARKER_FILE,
} from "./detect.js";
export {
  HostOnlyError,
  LocalExecutionTarget,
  type LocalTargetOptions,
} from "./local-target.js";
export {
  OpenShellExecutionTarget,
  openshellPreflight,
  type OpenShellPreflight,
  type OpenShellTargetOptions,
} from "./openshell-target.js";
export {
  ExecutionExitError,
  ExecutionSpawnError,
  type LifecycleRunner,
  type RunResult,
} from "./runner.js";
export {
  RUNTIME_ABSENT_STATUS,
  resolveTargetStatus,
  runtimeIsAbsent,
} from "./status.js";
export type {
  ExecRequest,
  ExecResult,
  ExecutionCapability,
  ExecutionStatus,
  ExecutionTarget,
} from "./target.js";
