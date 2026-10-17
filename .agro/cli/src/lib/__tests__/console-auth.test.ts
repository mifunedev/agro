import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  consoleCredentialsPath,
  deleteConsoleCredentials,
  readConsoleCredentials,
  writeConsoleCredentials,
  type ConsoleCredentials,
} from "../console-auth.js";

const CREDENTIALS: ConsoleCredentials = {
  url: "https://console.example",
  token: "mfc_file_token",
  tokenId: "tok_1",
  tokenPrefix: "mfc_file",
  login: "octocat",
};

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length > 0) rmSync(cleanups.pop()!, { recursive: true, force: true });
});

function makeHome(): string {
  const d = mkdtempSync(join(tmpdir(), "agro-console-auth-"));
  cleanups.push(d);
  return d;
}

describe("consoleCredentialsPath", () => {
  it("uses XDG_CONFIG_HOME when it is set", () => {
    expect(consoleCredentialsPath({ XDG_CONFIG_HOME: "/xdg" }, "/home/op")).toBe("/xdg/agro/console.json");
  });

  it("uses ~/.config when XDG_CONFIG_HOME is unset or empty", () => {
    expect(consoleCredentialsPath({}, "/home/op")).toBe("/home/op/.config/agro/console.json");
    expect(consoleCredentialsPath({ XDG_CONFIG_HOME: "" }, "/home/op")).toBe("/home/op/.config/agro/console.json");
  });
});

describe("console credentials file", () => {
  it("writes the file with mode 0600 in a directory with mode 0700, then reads it back", () => {
    const home = makeHome();
    const path = writeConsoleCredentials(CREDENTIALS, {}, home);
    expect(path).toBe(join(home, ".config", "agro", "console.json"));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(CREDENTIALS);
    expect(readConsoleCredentials({}, home)).toEqual(CREDENTIALS);
  });

  it("writes under XDG_CONFIG_HOME when it is set", () => {
    const home = makeHome();
    const xdg = join(home, "xdg");
    const path = writeConsoleCredentials(CREDENTIALS, { XDG_CONFIG_HOME: xdg }, home);
    expect(path).toBe(join(xdg, "agro", "console.json"));
    expect(readConsoleCredentials({ XDG_CONFIG_HOME: xdg }, home)).toEqual(CREDENTIALS);
    expect(readConsoleCredentials({}, home)).toBeUndefined();
  });

  it("tightens the mode of an existing file on overwrite", () => {
    const home = makeHome();
    const dir = join(home, ".config", "agro");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "console.json"), "{}");
    chmodSync(join(dir, "console.json"), 0o644);
    chmodSync(dir, 0o755);
    const path = writeConsoleCredentials(CREDENTIALS, {}, home);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("reads nothing when the file is missing or malformed", () => {
    const home = makeHome();
    expect(readConsoleCredentials({}, home)).toBeUndefined();
    const dir = join(home, ".config", "agro");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "console.json"), "not json");
    expect(readConsoleCredentials({}, home)).toBeUndefined();
    writeFileSync(join(dir, "console.json"), JSON.stringify({ url: "https://x" }));
    expect(readConsoleCredentials({}, home)).toBeUndefined();
  });

  it("deletes the file and reports whether one existed", () => {
    const home = makeHome();
    const path = writeConsoleCredentials(CREDENTIALS, {}, home);
    expect(deleteConsoleCredentials({}, home)).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(deleteConsoleCredentials({}, home)).toBe(false);
  });
});
