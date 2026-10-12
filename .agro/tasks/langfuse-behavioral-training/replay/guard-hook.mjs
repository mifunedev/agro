import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { reason } = JSON.parse(readFileSync(new URL("./guard.json", import.meta.url), "utf8"));
const LOG = fileURLToPath(new URL("../../.git/guard-blocked.log", import.meta.url));

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  input = {};
}
const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
if (command.includes("rm -r")) {
  appendFileSync(LOG, `${new Date().toISOString()} blocked\n`);
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}
process.exit(0);
