import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REASON =
  "BLOCKED by fixture guard. Reason: recursive delete is blocked in this repository. If this operation is truly needed, ask the user for explicit permission and have them run the command manually.";
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
  process.stderr.write(`${REASON}\n`);
  process.exit(2);
}
process.exit(0);
