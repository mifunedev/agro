import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as prompt from "../prompt.js";

vi.mock("../../commands/auth.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../commands/auth.js")>(),
  runAuth: async () => {
    const { PromptInterruptedError } = await import("../prompt.js");
    throw new PromptInterruptedError();
  },
}));

vi.mock("../../cli.js", async (importOriginal) => {
  const original = process.exit;
  process.exit = (() => {}) as never;
  const mod = await importOriginal<typeof import("../../cli.js")>();
  await new Promise((r) => setTimeout(r, 0));
  process.exit = original;
  return mod;
});

const originalStdin = Object.getOwnPropertyDescriptor(process, "stdin")!;

function ttyStdin(): { stdin: PassThrough; setRawMode: ReturnType<typeof vi.fn> } {
  const stdin = new PassThrough();
  const setRawMode = vi.fn();
  Object.assign(stdin, { isTTY: true, setRawMode });
  Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
  return { stdin, setRawMode };
}

describe("askSecret interrupt on a TTY", () => {
  afterEach(() => {
    Object.defineProperty(process, "stdin", originalStdin);
    vi.restoreAllMocks();
  });

  it("rejects with PromptInterruptedError and runs the caller's finally block after byte 0x03", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const { stdin, setRawMode } = ttyStdin();
    let finallyRan = false;

    const pending = (async () => {
      try {
        return await prompt.askSecret("Secret:");
      } finally {
        finallyRan = true;
      }
    })();
    stdin.emit("data", Buffer.from([0x61, 0x03]));

    await expect(pending).rejects.toBeInstanceOf(prompt.PromptInterruptedError);
    expect(finallyRan).toBe(true);
    expect(setRawMode).toHaveBeenLastCalledWith(false);
    expect(stdin.listenerCount("data")).toBe(0);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("runCli on a prompt interrupt", () => {
  it("returns 130 and writes no stack trace", async () => {
    const { runCli } = await import("../../cli.js");
    const stderr: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    });

    expect(await runCli(["auth"])).toBe(130);
    expect(stderr.join("")).toBe("");
  });
});
