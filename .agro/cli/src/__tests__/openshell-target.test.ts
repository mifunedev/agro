import { describe, expect, it } from "vitest";
import {
  attachArgv,
  createArgv,
  deleteArgv,
  execArgv,
  OPENSHELL_PHASE_STATUS,
  OPENSHELL_PHASES,
  OPENSHELL_VERB_HINTS,
  OpenShellExecutionTarget,
  openshellPreflight,
  parseOpenShellPhase,
} from "../lib/execution/openshell-target.js";
import {
  ExecutionExitError,
  ExecutionSpawnError,
  type LifecycleRunner,
  type RunResult,
} from "../lib/execution/index.js";


interface RecordedCall {
  cmd: string;
  args: string[];
  opts: Parameters<LifecycleRunner>[2];
}

function makeRunner(results: RunResult[] = [{ status: 0 }]): { calls: RecordedCall[]; run: LifecycleRunner } {
  const calls: RecordedCall[] = [];
  const run: LifecycleRunner = (cmd, args, opts) => {
    calls.push({ cmd, args: [...args], opts });
    return results[Math.min(calls.length - 1, results.length - 1)];
  };
  return { calls, run };
}

const ENTRY = "/home/op/.agro/sandboxes/box";
const IMAGE = "ghcr.io/mifunedev/agro:0.15.0";

function target(run: LifecycleRunner): OpenShellExecutionTarget {
  return new OpenShellExecutionTarget({ name: "box", entryRoot: ENTRY, image: IMAGE, run });
}

function getJson(phase: unknown): string {
  return JSON.stringify({ id: "sb-1", name: "box", phase, policy_source: "sandbox", revision: 1, policy: null });
}


describe("OpenShellExecutionTarget identity", () => {
  it('declares kind "openshell" and contract version 1', () => {
    const t = target(makeRunner().run);
    expect(t.kind).toBe("openshell");
    expect(t.contractVersion).toBe(1);
    expect(t.workspace).toEqual({ hostRoot: ENTRY, targetRoot: "/home/sandbox/harness" });
  });
});


describe("pure argv builders", () => {
  it("createArgv builds the exact detached create argv", () => {
    expect(createArgv({ name: "box", image: IMAGE, entryRoot: ENTRY })).toEqual([
      "sandbox",
      "create",
      "--name",
      "box",
      "--from",
      IMAGE,
      "--policy",
      `${ENTRY}/openshell-policy.yaml`,
      "--env",
      "AGRO_EXECUTION_TARGET=local",
      "--env",
      "SANDBOX_NAME=box",
      "--detach",
      "--",
      "/usr/local/bin/openshell-main.sh",
    ]);
  });

  it("attachArgv opens a login zsh in the harness directory", () => {
    expect(attachArgv("box")).toEqual([
      "sandbox",
      "exec",
      "-n",
      "box",
      "--tty",
      "--workdir",
      "/home/sandbox/harness",
      "--",
      "zsh",
      "-l",
    ]);
  });

  it("execArgv maps cwd, env, and timeoutMs onto --workdir, --env, and --timeout seconds", () => {
    expect(
      execArgv("box", { argv: ["sh", "-c", "echo hi"], cwd: "/work", env: { FOO: "bar", BAZ: "q" }, timeoutMs: 5_500 }),
    ).toEqual([
      "sandbox",
      "exec",
      "-n",
      "box",
      "--workdir",
      "/work",
      "--env",
      "FOO=bar",
      "--env",
      "BAZ=q",
      "--timeout",
      "6",
      "--",
      "sh",
      "-c",
      "echo hi",
    ]);
  });

  it("execArgv omits the optional flags when the request carries none", () => {
    expect(execArgv("box", { argv: ["ls"] })).toEqual(["sandbox", "exec", "-n", "box", "--", "ls"]);
  });

  it("deleteArgv deletes the named sandbox", () => {
    expect(deleteArgv("box")).toEqual(["sandbox", "delete", "box"]);
  });

  it("each builder returns a string[] and spawns nothing", () => {
    const { calls } = makeRunner();
    const built = [
      createArgv({ name: "box", image: IMAGE, entryRoot: ENTRY }),
      attachArgv("box"),
      execArgv("box", { argv: ["ls"] }),
      deleteArgv("box"),
    ];
    for (const argv of built) {
      expect(Array.isArray(argv)).toBe(true);
      expect(argv.every((a) => typeof a === "string")).toBe(true);
    }
    expect(calls).toEqual([]);
  });
});


describe("OpenShellExecutionTarget.provision", () => {
  it("spawns exactly createArgv() once with inherited stdio", async () => {
    const { calls, run } = makeRunner([{ status: 0 }]);

    await target(run).provision();

    expect(calls).toEqual([
      {
        cmd: "openshell",
        args: createArgv({ name: "box", image: IMAGE, entryRoot: ENTRY }),
        opts: { stdio: "inherit" },
      },
    ]);
  });

  it("throws ExecutionExitError carrying the create exit code", async () => {
    const { run } = makeRunner([{ status: 4 }]);

    const err = await target(run).provision().then(() => undefined, (e: unknown) => e);

    expect(err).toBeInstanceOf(ExecutionExitError);
    expect((err as ExecutionExitError).exitCode).toBe(4);
  });
});


describe("OpenShellExecutionTarget.attach", () => {
  it("runs the shell verb request as a login zsh with a forced tty", () => {
    const { calls, run } = makeRunner([{ status: 0 }]);

    const code = target(run).attach({ argv: ["zsh"], user: "sandbox" });

    expect(code).toBe(0);
    expect(calls).toEqual([
      {
        cmd: "openshell",
        args: ["sandbox", "exec", "-n", "box", "--tty", "--workdir", "/home/sandbox/harness", "--", "zsh", "-l"],
        opts: { stdio: "inherit" },
      },
    ]);
  });

  it("returns a non-zero exit code as data", () => {
    const { run } = makeRunner([{ status: 130 }]);
    expect(target(run).attach({ argv: ["zsh"] })).toBe(130);
  });

  it("refuses a user other than sandbox before spawning", () => {
    const { calls, run } = makeRunner();
    expect(() => target(run).attach({ argv: ["zsh"], user: "root" })).toThrow(/sandbox/);
    expect(calls).toEqual([]);
  });

  it("throws ExecutionSpawnError when the openshell binary is missing", () => {
    const { run } = makeRunner([{ status: null, error: { code: "ENOENT" } }]);
    let caught: unknown;
    try {
      target(run).attach({ argv: ["zsh"] });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ExecutionSpawnError);
  });
});


describe("OpenShellExecutionTarget.exec", () => {
  it("captures output and passes the request flags through execArgv", async () => {
    const { calls, run } = makeRunner([{ status: 3, stdout: "out", stderr: "err" }]);
    const request = { argv: ["make"], cwd: "/home/sandbox/harness", env: { CI: "1" }, timeoutMs: 2_000 };

    const result = await target(run).exec(request);

    expect(result).toEqual({ exitCode: 3, stdout: "out", stderr: "err" });
    expect(calls).toEqual([{ cmd: "openshell", args: execArgv("box", request), opts: { stdio: "capture" } }]);
    expect(calls[0].args).toEqual(
      expect.arrayContaining(["--workdir", "/home/sandbox/harness", "--env", "CI=1", "--timeout", "2"]),
    );
  });

  it("streams when stdio is inherit", async () => {
    const { calls, run } = makeRunner([{ status: 0 }]);
    const result = await target(run).exec({ argv: ["ls"], stdio: "inherit" });
    expect(calls[0].opts.stdio).toBe("inherit");
    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("refuses a root request, since the workload has one non-root user", async () => {
    const { calls, run } = makeRunner();
    await expect(target(run).exec({ argv: ["apt-get", "update"], user: "root" })).rejects.toThrow(/root/);
    expect(calls).toEqual([]);
  });
});


describe("OpenShellExecutionTarget.status", () => {
  it.each([
    ["Ready", "ready"],
    ["Provisioning", "starting"],
    ["Starting", "starting"],
    ["Stopping", "stopped"],
    ["Stopped", "stopped"],
    ["Deleting", "stopped"],
    ["Completed", "stopped"],
    ["Error", "failed"],
    ["Unknown", "failed"],
    ["Unspecified", "failed"],
  ])("maps phase %s to %s through sandbox get -o json", async (phase, expected) => {
    const { calls, run } = makeRunner([{ status: 0, stdout: getJson(phase) }]);

    expect(await target(run).status()).toBe(expected);
    expect(calls).toEqual([
      { cmd: "openshell", args: ["sandbox", "get", "box", "-o", "json"], opts: { stdio: "capture" } },
    ]);
  });

  it("maps an unlisted phase to failed", async () => {
    const { run } = makeRunner([{ status: 0, stdout: getJson("Hibernating") }]);
    expect(await target(run).status()).toBe("failed");
  });

  it.each([
    ["sandbox 'box' not found"],
    ['Error:   × status: NotFound, message: "sandbox not found", details: [], metadata: MetadataMap { headers: {} }'],
  ])("returns absent when the output says %s", async (stderr) => {
    const { run } = makeRunner([{ status: 1, stdout: "", stderr }]);
    expect(await target(run).status()).toBe("absent");
  });

  it("throws on any other failure instead of guessing a status", async () => {
    const { run } = makeRunner([{ status: 1, stdout: "", stderr: "transport error: connection refused" }]);
    await expect(target(run).status()).rejects.toBeInstanceOf(ExecutionExitError);
  });
});


describe("parseOpenShellPhase", () => {
  it("reads the phase field once from the JSON document", () => {
    expect(parseOpenShellPhase(getJson("Ready"))).toBe("Ready");
  });

  it.each([[getJson("Hibernating")], [getJson(2)], ["{}"], ["not json"], ["null"]])(
    "collapses %s to Unknown",
    (raw) => {
      expect(parseOpenShellPhase(raw)).toBe("Unknown");
    },
  );

  it("keeps one frozen table with a status for every upstream phase", () => {
    expect(Object.isFrozen(OPENSHELL_PHASE_STATUS)).toBe(true);
    expect(Object.keys(OPENSHELL_PHASE_STATUS).sort()).toEqual([...OPENSHELL_PHASES].sort());
  });
});


describe("OpenShellExecutionTarget.destroy", () => {
  it("runs sandbox delete with inherited stdio", async () => {
    const { calls, run } = makeRunner([{ status: 0 }]);
    await target(run).destroy();
    expect(calls).toEqual([{ cmd: "openshell", args: ["sandbox", "delete", "box"], opts: { stdio: "inherit" } }]);
  });

  it("throws ExecutionExitError when delete fails", async () => {
    const { run } = makeRunner([{ status: 2 }]);
    await expect(target(run).destroy()).rejects.toBeInstanceOf(ExecutionExitError);
  });
});


describe("OpenShellExecutionTarget.capabilities", () => {
  it("returns exec and pty, never docker, and spawns nothing", async () => {
    const { calls, run } = makeRunner();
    const caps = await target(run).capabilities();
    expect([...caps].sort()).toEqual(["exec", "pty"]);
    expect(caps.has("docker")).toBe(false);
    expect(calls).toEqual([]);
  });
});


describe("openshellPreflight", () => {
  it("passes when the binary runs and the gateway reports connected", () => {
    const { calls, run } = makeRunner([
      { status: 0, stdout: "openshell 0.1.2\n" },
      { status: 0, stdout: JSON.stringify({ gateway: "openshell", status: "connected" }) },
    ]);

    expect(openshellPreflight(run)).toEqual({ ok: true });
    expect(calls.map((c) => [c.cmd, ...c.args])).toEqual([
      ["openshell", "--version"],
      ["openshell", "status", "-o", "json"],
    ]);
  });

  it("reports missing-binary with the pinned install command and a review-first alternative", () => {
    const { calls, run } = makeRunner([{ status: null, error: { code: "ENOENT" } }]);

    const result = openshellPreflight(run);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing-binary");
    expect(result.hint).toContain(
      "curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | OPENSHELL_VERSION=v0.1.2 sh",
    );
    expect(result.hint).toMatch(/review-first/);
    expect(result.hint).toContain("curl -LsSf -o openshell-install.sh");
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a non-zero status exit", { status: 1, stdout: "" }],
    ["a disconnected gateway, which upstream reports with exit 0", { status: 0, stdout: JSON.stringify({ status: "disconnected" }) }],
    ["no configured gateway", { status: 0, stdout: JSON.stringify({ status: "not_configured" }) }],
  ])("reports gateway-unreachable on %s", (_label, statusResult) => {
    const { run } = makeRunner([{ status: 0, stdout: "openshell 0.1.2\n" }, statusResult]);

    const result = openshellPreflight(run);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("gateway-unreachable");
    expect(result.hint).toContain("openshell gateway add https://127.0.0.1:17670 --local");
  });
});


describe("OPENSHELL_VERB_HINTS", () => {
  it("names the exact openshell command for each refused verb", () => {
    expect(OPENSHELL_VERB_HINTS.stop("box")).toBe("openshell sandbox stop box");
    expect(OPENSHELL_VERB_HINTS.restart("box")).toBe("openshell sandbox stop box && openshell sandbox start box");
    expect(OPENSHELL_VERB_HINTS.logs("box")).toBe("openshell logs box");
    expect(OPENSHELL_VERB_HINTS.ps("box")).toBe("openshell sandbox get box");
    expect(OPENSHELL_VERB_HINTS.config("box")).toBe("openshell policy get box");
  });
});
