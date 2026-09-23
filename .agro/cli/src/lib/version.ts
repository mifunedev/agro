declare const __AGRO_VERSION__: string;

export const AGRO_VERSION: string = typeof __AGRO_VERSION__ === "string" ? __AGRO_VERSION__ : "0.0.0-dev";

const OFFICIAL_IMAGE = "ghcr.io/mifunedev/agro";
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export function officialImageRef(version: string): string {
  return `${OFFICIAL_IMAGE}:${RELEASE_VERSION.test(version) ? version : "latest"}`;
}
