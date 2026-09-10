import { describe, expect, it } from "vitest";
import { AGRO_PRODUCT, LEGACY_PRODUCT, invokedName, resolveProduct } from "../product.js";

describe("resolveProduct", () => {
  const table: Array<[string | undefined, "agro" | "oh"]> = [
    ["agro", "agro"],
    ["agro.js", "agro"],
    ["/usr/local/bin/agro", "agro"],
    ["/x/node_modules/.bin/agro", "agro"],
    ["/opt/oh/dist/agro.js", "agro"],
    ["C:\\Users\\me\\AppData\\npm\\node_modules\\@mifune\\agro\\dist\\agro.js", "agro"],
    ["oh", "oh"],
    ["oh.js", "oh"],
    ["oh.mjs", "oh"],
    ["/opt/oh/dist/oh.js", "oh"],
    ["/usr/local/bin/oh", "oh"],
    ["/x/node_modules/@mifune/openharness/bin/oh.js", "oh"],
    ["C:\\Users\\me\\AppData\\npm\\oh.cmd", "oh"],
    ["/home/me/.local/bin/ohno", "agro"],
    ["/x/node_modules/vitest/dist/worker.js", "agro"],
    ["", "agro"],
    [undefined, "agro"],
  ];

  it.each(table)("%j -> %s", (argv1, expected) => {
    const product = resolveProduct(argv1);
    expect(product.name).toBe(expected);
    expect(product).toBe(expected === "oh" ? LEGACY_PRODUCT : AGRO_PRODUCT);
  });

  it("strips exactly one trailing extension from the invoked basename", () => {
    expect(invokedName("/a/b/oh.js")).toBe("oh");
    expect(invokedName("/a/b/oh.cmd")).toBe("oh");
    expect(invokedName("/a/b/agro")).toBe("agro");
    expect(invokedName("/a/b/agro.tar.gz")).toBe("agro.tar");
    expect(invokedName(undefined)).toBe("");
  });

  it("describes both products with disjoint bins and package names", () => {
    expect(AGRO_PRODUCT).toEqual({
      name: "agro",
      bin: "agro",
      title: "AGRO CLI",
      packageName: "@mifune/agro",
      generation: "agro",
    });
    expect(LEGACY_PRODUCT).toEqual({
      name: "oh",
      bin: "oh",
      title: "Open Harness CLI",
      packageName: "@mifune/openharness",
      generation: "legacy",
    });
    expect(AGRO_PRODUCT.bin).not.toBe(LEGACY_PRODUCT.bin);
    expect(AGRO_PRODUCT.packageName).not.toBe(LEGACY_PRODUCT.packageName);
  });
});
