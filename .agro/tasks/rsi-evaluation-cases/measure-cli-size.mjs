import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliRoot = resolve(repoRoot, ".agro/cli");
const { build } = createRequire(resolve(cliRoot, "package.json"))("esbuild");
const pkg = JSON.parse(readFileSync(resolve(cliRoot, "package.json"), "utf8"));

const assetPlugin = {
  name: "agro-asset",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^agro-asset:/ }, (args) => ({
      path: resolve(repoRoot, args.path.slice("agro-asset:".length)),
      namespace: "agro-asset",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "agro-asset" }, (args) => {
      if (!existsSync(args.path)) throw new Error(`bundled asset not found: ${args.path}`);
      return { contents: readFileSync(args.path, "utf8"), loader: "text" };
    });
  },
};

const result = await build({
  entryPoints: [resolve(cliRoot, "src/cli.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  plugins: [assetPlugin],
  define: { __AGRO_VERSION__: JSON.stringify(pkg.version) },
  minify: true,
  write: false,
  outfile: resolve(cliRoot, "dist/measure.js"),
  logLevel: "silent",
});

process.stdout.write(`${result.outputFiles[0].contents.byteLength}\n`);
