import { basename } from "node:path";
import { NAMES, type StateNames } from "./layout.js";

export type ProductName = "agro";

export interface Product {
  name: ProductName;
  bin: string;
  title: string;
  packageName: string;
}

export const AGRO_PRODUCT: Product = {
  name: "agro",
  bin: "agro",
  title: "AGRO CLI",
  packageName: "@mifune/agro",
};

const FILE_EXTENSION = /\.[^.]*$/;

export function invokedName(argv1: string | undefined): string {
  if (argv1 === undefined) return "";
  return basename(argv1.replace(/\\/g, "/")).replace(FILE_EXTENSION, "");
}

export function resolveProduct(_argv1: string | undefined): Product {
  return AGRO_PRODUCT;
}

export function activeBin(): string {
  return AGRO_PRODUCT.bin;
}

export function productFor(_bin: string): Product {
  return AGRO_PRODUCT;
}

export function stateNames(_bin?: string): StateNames {
  return NAMES;
}
