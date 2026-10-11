import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { askSecret } from "../prompt.js";

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
