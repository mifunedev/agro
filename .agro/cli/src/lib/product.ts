import { basename } from "node:path";
import { GENERATIONS, type Generation, type GenerationNames } from "./compat.js";

export type ProductName = "agro" | "oh";

export interface Product {
  name: ProductName;
  bin: string;
  title: string;
  packageName: string;
  generation: Generation;
}

export const AGRO_PRODUCT: Product = {
  name: "agro",
  bin: "agro",
  title: "AGRO CLI",
  packageName: "@mifune/agro",
  generation: "agro",
};

export const LEGACY_PRODUCT: Product = {
  name: "oh",
  bin: "oh",
  title: "Open Harness CLI",
  packageName: "@mifune/openharness",
  generation: "legacy",
};

const FILE_EXTENSION = /\.[^.]*$/;

export function invokedName(argv1: string | undefined): string {
  if (argv1 === undefined) return "";
  return basename(argv1.replace(/\\/g, "/")).replace(FILE_EXTENSION, "");
}

export function resolveProduct(argv1: string | undefined): Product {
  return invokedName(argv1) === LEGACY_PRODUCT.bin ? LEGACY_PRODUCT : AGRO_PRODUCT;
}

export function productFor(bin: string): Product {
  return bin === LEGACY_PRODUCT.bin ? LEGACY_PRODUCT : AGRO_PRODUCT;
}

export function stateNames(bin: string): GenerationNames {
  return GENERATIONS[productFor(bin).generation];
}
