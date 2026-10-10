import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const ASSET_PREFIX = "agro-asset:";
const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: "agro-bundled-text-assets",
      enforce: "pre",
      resolveId(id: string) {
        return id.startsWith(ASSET_PREFIX) ? id : null;
      },
      load(id: string) {
        if (!id.startsWith(ASSET_PREFIX)) return null;
        const assetRoot = process.env.AGRO_ASSET_ROOT ?? repoRoot;
        const file = resolve(assetRoot, id.slice(ASSET_PREFIX.length));
        return `export default ${JSON.stringify(readFileSync(file, "utf8"))};`;
      },
    },
  ],
  test: {
    include: [
      ".agro/scripts/__tests__/**/*.test.{ts,mjs}",
      ".agro/skills/**/__tests__/**/*.test.mjs",
      ".pi/**/__tests__/**/*.test.ts",
      ".agro/cli/**/__tests__/**/*.test.ts",
    ],
    globals: true,
    globalSetup: [".agro/cli/vitest.global-setup.mjs"],
    env: {
      AGRO_EXECUTION_TARGET: "docker-compose",
    },
    coverage: {
      provider: "v8",
      include: [".agro/cli/src/**/*.ts", ".agro/scripts/**/*.{ts,mjs}", ".pi/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.*", "**/dist/**", "**/node_modules/**"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
