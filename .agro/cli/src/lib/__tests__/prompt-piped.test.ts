import { PassThrough, Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptInterruptedError, askSecret } from "../prompt.js";

const originalStdin = Object.getOwnPropertyDescriptor(process, "stdin")!;

function pipeStdin(chunks: string[]): void {
  Object.defineProperty(process, "stdin", { value: Readable.from(chunks), configurable: true });
}

describe("askSecret with piped stdin", () => {
  afterEach(() => {
    Object.defineProperty(process, "stdin", originalStdin);
  });

  it("returns a value that has no trailing newline", async () => {
    pipeStdin(["value"]);
    await expect(askSecret("Value:")).resolves.toBe("value");
  });

  it("returns a newline-terminated value", async () => {
    pipeStdin(["value\n"]);
    await expect(askSecret("Value:")).resolves.toBe("value");
  });

  it("returns an empty string for empty input", async () => {
    pipeStdin([]);
    await expect(askSecret("Value:")).resolves.toBe("");
  });
});

describe("askSecret with piped stdin on SIGINT", () => {
  afterEach(() => {
    Object.defineProperty(process, "stdin", originalStdin);
    vi.restoreAllMocks();
  });

  it("rejects with PromptInterruptedError and removes its SIGINT listener", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    Object.defineProperty(process, "stdin", { value: new PassThrough(), configurable: true });
    const before = process.listeners("SIGINT");

    const pending = askSecret("Value:");
    const added = process.listeners("SIGINT").filter((l) => !before.includes(l));
    expect(added).toHaveLength(1);
    added[0]("SIGINT");

    await expect(pending).rejects.toBeInstanceOf(PromptInterruptedError);
    expect(process.listeners("SIGINT")).toEqual(before);
    expect(exit).not.toHaveBeenCalled();
  });
});
