import { agroConfigPath, readAgroConfig } from "../lib/agro-config.js";
import {
  EphemeralExecutionTarget,
  HostOnlyError,
  openshellImage,
  runningInsideSandbox,
  type LifecycleRunner,
} from "../lib/execution/index.js";
import { messageOf, spawnRunner } from "../lib/execution/runner.js";

export interface RunIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface RunOptions {
  bin: string;
  command: string[];
  image?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  run?: LifecycleRunner;
}

function runRoot(cwd: string, run: LifecycleRunner): string {
  const r = run("git", ["rev-parse", "--show-toplevel"], { stdio: "capture", cwd });
  const top = r.error === undefined && r.status === 0 ? (r.stdout ?? "").trim() : "";
  return top === "" ? cwd : top;
}

function runImage(root: string, image: string | undefined): string {
  return image ?? openshellImage(readAgroConfig(agroConfigPath(root)));
}

export async function runRun(opts: RunOptions, io: RunIO): Promise<number> {
  const env = opts.env ?? process.env;
  if (runningInsideSandbox(env)) {
    io.stderr(`${new HostOnlyError(`${opts.bin} run`).message}\n`);
    return 1;
  }
  const run = opts.run ?? spawnRunner;
  const cwd = opts.cwd ?? process.cwd();
  try {
    const root = runRoot(cwd, run);
    const image = runImage(root, opts.image);
    const target = new EphemeralExecutionTarget({ worktreeRoot: root, image, run });
    const result = await target.exec({ argv: opts.command, cwd, stdio: "inherit" });
    return result.exitCode;
  } catch (err) {
    io.stderr(`${opts.bin} run: ${messageOf(err)}\n`);
    return 1;
  }
}
