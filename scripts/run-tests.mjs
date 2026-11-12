// Cross-platform test runner: `node scripts/run-tests.mjs` (or `npm test`).
// Shell globs such as tests/*.test.mjs do not expand in PowerShell or cmd, and
// Node 20 does not expand them itself, so the file list is built here.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = readdirSync(join(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => join("tests", name));
if (!files.length) {
  console.error("No tests/*.test.mjs files found.");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
