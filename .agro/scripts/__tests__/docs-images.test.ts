import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");
const IMAGE_DIR = "img";
const REQUIRED_WIDTH = 1920;
const REQUIRED_HEIGHT = 1080;
const CALLOUT_WINDOW = 3;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IMAGE_LINK = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

type DocsTree = {
  pages: Map<string, string>;
  images: Map<string, Uint8Array>;
};

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function docsImageProblems({ pages, images }: DocsTree): string[] {
  const problems: string[] = [];
  const referenced = new Set<string>();

  for (const [page, content] of pages) {
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      for (const [, alt, target] of line.matchAll(IMAGE_LINK)) {
        if (/^https?:\/\//i.test(target)) continue;
        const where = `${page}:${index + 1}`;
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), target));
        referenced.add(resolved);
        if (!images.has(resolved)) problems.push(`${where}: ${target} does not exist`);
        if (alt.trim() === "") problems.push(`${where}: ${target} has no alt text`);
        const following = lines.slice(index + 1, index + 1 + CALLOUT_WINDOW);
        if (!following.some((next) => next.trimStart().startsWith("Callouts:"))) {
          problems.push(`${where}: ${target} has no Callouts: line within ${CALLOUT_WINDOW} lines`);
        }
      }
    });
  }

  for (const [image, bytes] of images) {
    if (!image.startsWith(`${IMAGE_DIR}/`)) continue;
    if (!referenced.has(image)) problems.push(`${image}: no page in docs/ references it`);
    if (!image.toLowerCase().endsWith(".png")) continue;
    const size = pngSize(bytes);
    if (!size) {
      problems.push(`${image}: has no PNG IHDR header`);
    } else if (size.width !== REQUIRED_WIDTH || size.height !== REQUIRED_HEIGHT) {
      problems.push(
        `${image}: is ${size.width}x${size.height}, not ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}`,
      );
    }
  }

  return problems;
}

function readDocsTree(root: string): DocsTree {
  const pages = new Map<string, string>();
  const images = new Map<string, Uint8Array>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) pages.set(relative, readFileSync(full, "utf8"));
      else if (entry.isFile()) images.set(relative, readFileSync(full));
    }
  };
  walk(root);
  return { pages, images };
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set(PNG_SIGNATURE, 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function tree(pages: Record<string, string>, images: Record<string, Uint8Array>): DocsTree {
  return { pages: new Map(Object.entries(pages)), images: new Map(Object.entries(images)) };
}

const GOOD_PAGE = "# Page\n\n![A terminal runs a command.](img/shot.png)\nCallouts: 1 is the command.\n";
const GOOD_NESTED = "![A pane runs a command.](../img/nested.png)\n\nCallouts: 1 is the command.\n";
const GOOD_IMAGES = { "img/shot.png": png(1920, 1080), "img/nested.png": png(1920, 1080) };

describe("docsImageProblems", () => {
  it("accepts complete images on top-level and nested pages", () => {
    expect(
      docsImageProblems(tree({ "intro.md": GOOD_PAGE, "integrations/x.md": GOOD_NESTED }, GOOD_IMAGES)),
    ).toEqual([]);
  });

  it("skips external image links", () => {
    const page = "![Badge](https://example.com/badge.png)\n";
    expect(docsImageProblems(tree({ "intro.md": page }, {}))).toEqual([]);
  });

  it("reports an image link that names a missing file", () => {
    const page = "![A shot.](img/missing.png)\nCallouts: 1 is the command.\n";
    expect(docsImageProblems(tree({ "intro.md": page }, {}))).toEqual([
      "intro.md:1: img/missing.png does not exist",
    ]);
  });

  it("resolves a link from the directory of the page", () => {
    const page = "![A shot.](img/shot.png)\nCallouts: 1 is the command.\n";
    expect(
      docsImageProblems(tree({ "integrations/x.md": page }, { "img/shot.png": png(1920, 1080) })),
    ).toEqual([
      "integrations/x.md:1: img/shot.png does not exist",
      "img/shot.png: no page in docs/ references it",
    ]);
  });

  it("reports an image without alt text", () => {
    const page = "![ ](img/shot.png)\nCallouts: 1 is the command.\n";
    expect(docsImageProblems(tree({ "intro.md": page }, { "img/shot.png": png(1920, 1080) }))).toEqual([
      "intro.md:1: img/shot.png has no alt text",
    ]);
  });

  it("reports an image without a Callouts: line within 3 lines", () => {
    const page = "![A shot.](img/shot.png)\n\n\n\nCallouts: 1 is the command.\n";
    expect(docsImageProblems(tree({ "intro.md": page }, { "img/shot.png": png(1920, 1080) }))).toEqual([
      "intro.md:1: img/shot.png has no Callouts: line within 3 lines",
    ]);
  });

  it("reports a file in img/ that no page references", () => {
    expect(
      docsImageProblems(tree({ "intro.md": GOOD_PAGE }, GOOD_IMAGES)),
    ).toEqual(["img/nested.png: no page in docs/ references it"]);
  });

  it("reports a PNG that is not 1920x1080", () => {
    expect(docsImageProblems(tree({ "intro.md": GOOD_PAGE }, { "img/shot.png": png(1280, 720) }))).toEqual([
      "img/shot.png: is 1280x720, not 1920x1080",
    ]);
  });

  it("reports a PNG without an IHDR header", () => {
    expect(
      docsImageProblems(tree({ "intro.md": GOOD_PAGE }, { "img/shot.png": new Uint8Array([1, 2, 3]) })),
    ).toEqual(["img/shot.png: has no PNG IHDR header"]);
  });
});

describe("docs/ images", () => {
  it("has no image problems", () => {
    const docs = readDocsTree(DOCS_ROOT);
    expect([...docs.images.keys()].some((image) => image.startsWith(`${IMAGE_DIR}/`))).toBe(true);
    expect(docsImageProblems(docs)).toEqual([]);
  });
});
