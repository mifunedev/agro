import { describe, expect, it } from "vitest";
import { AGRO_VERSION, officialImageRef, parseReleaseVersion } from "../version.js";

describe("officialImageRef", () => {
  it.each(["0.13.0", "1.0.0", "10.20.30", "0.15.0-minimal.1", "1.0.0-rc.2"])("tags release %s with its version", (version) => {
    expect(officialImageRef(version)).toBe(`ghcr.io/mifunedev/agro:${version}`);
  });

  it.each(["0.0.0-dev", "0.14.0-rc", "1.2.3-beta", "1.2.3-Rc.1", "v0.13.0", "0.13", ""])(
    "falls back to latest for non-release version %j",
    (version) => {
      expect(officialImageRef(version)).toBe("ghcr.io/mifunedev/agro:latest");
    },
  );
});

describe("AGRO_VERSION", () => {
  it("is 0.0.0-dev when the build did not inject a version", () => {
    expect(AGRO_VERSION).toBe("0.0.0-dev");
  });
});

describe("parseReleaseVersion", () => {
  it.each([
    ["0.13.0", "0.13.0"],
    ["v0.13.0", "0.13.0"],
    ["10.20.30", "10.20.30"],
    ["0.15.0-minimal.1", "0.15.0-minimal.1"],
    ["v1.0.0-rc.2", "1.0.0-rc.2"],
  ])("accepts %j as %j", (value, version) => {
    expect(parseReleaseVersion(value)).toBe(version);
  });

  it.each(["", "v", "vv0.13.0", "0.13", "0.14.0-rc", "0.14.0-RC.1", "latest", "V0.13.0", " 0.13.0"])(
    "rejects %j",
    (value) => {
      expect(parseReleaseVersion(value)).toBeUndefined();
    },
  );
});
