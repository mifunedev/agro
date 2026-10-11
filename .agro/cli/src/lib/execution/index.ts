import { basename, resolve } from "node:path";
import { agroConfigPath, entryRuntime, readAgroConfig, type AgroConfig } from "../agro-config.js";
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
  if (entryRuntime(opts.projectRoot) === "openshell") {
    const config = readAgroConfig(agroConfigPath(opts.projectRoot));
    return new OpenShellExecutionTarget({
      name: opts.container ?? nonEmpty(config.name) ?? basename(resolve(opts.projectRoot)),
      entryRoot: opts.projectRoot,
      image: openshellImage(config),
      ...(opts.run ? { run: opts.run } : {}),
      ...(opts.env ? { env: opts.env } : {}),
    });
  }
  return new DockerComposeExecutionTarget(opts);
}

export function openshellImage(config: AgroConfig): string {
  return nonEmpty(config.image?.ref) ?? officialImageRef(AGRO_VERSION);
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

export { DockerComposeExecutionTarget, type DockerComposeTargetOptions };
export {
  DOCKERENV_FILE,
  EXECUTION_TARGET_ENV,
  runningInsideSandbox,
  SANDBOX_MARKER_FILE,
  sandboxFallbackWarning,
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
