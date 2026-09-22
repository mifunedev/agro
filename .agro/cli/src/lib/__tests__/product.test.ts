import { describe, expect, it } from "vitest";
import { AGRO_PRODUCT, invokedName, resolveProduct } from "../product.js";

describe("resolveProduct", () => {
  const table: Array<string | undefined> = [
    "agro",
    "agro.js",
    "/usr/local/bin/agro",
    "/x/node_modules/.bin/agro",
    "/opt/agro/dist/agro.js",
    "C:\\Users\\me\\AppData\\npm\\node_modules\\@mifune\\agro\\dist\\agro.js",
    "oh",
    "oh.js",
    "/usr/local/bin/oh",
    "/home/me/.local/bin/ohno",
    "/x/node_modules/vitest/dist/worker.js",
    "",
    undefined,
  ];

  it.each(table)("%j resolves to the single AGRO product", (argv1) => {
    const product = resolveProduct(argv1);
    expect(product.name).toBe("agro");
    expect(product).toBe(AGRO_PRODUCT);
  });

  it("strips exactly one trailing extension from the invoked basename", () => {
    expect(invokedName("/a/b/oh.js")).toBe("oh");
    expect(invokedName("/a/b/agro.cmd")).toBe("agro");
    expect(invokedName("/a/b/agro")).toBe("agro");
    expect(invokedName("/a/b/agro.tar.gz")).toBe("agro.tar");
    expect(invokedName(undefined)).toBe("");
  });

  it("describes exactly one product", () => {
    expect(AGRO_PRODUCT).toEqual({
      name: "agro",
      bin: "agro",
      title: "AGRO CLI",
      packageName: "@mifune/agro",
    });
  });
});
