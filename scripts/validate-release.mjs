import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function readReleaseVersions(root = fileURLToPath(new URL("../", import.meta.url))) {
  const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
  const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
  const lockedPackage = lock.split(/^\[\[package\]\]\s*$/m)
    .find((section) => /^name\s*=\s*"pocketpet"\s*$/m.test(section));
  return {
    "Cargo.toml": cargo.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1],
    "Cargo.lock": lockedPackage?.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    "tauri.conf.json": JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8")).version,
  };
}

export function validateReleaseVersions(versions, ref = "") {
  const current = versions["Cargo.toml"];
  if (!current || Object.values(versions).some((version) => version !== current)) {
    throw new Error(`App versions must match: ${JSON.stringify(versions)}`);
  }
  if (ref.startsWith("refs/tags/") && ref !== `refs/tags/v${current}`) {
    throw new Error(`Release tag ${ref.slice("refs/tags/".length)} must match app version v${current}. Bump Cargo.toml, Cargo.lock, and tauri.conf.json before tagging.`);
  }
  return current;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const version = validateReleaseVersions(readReleaseVersions(), process.env.GITHUB_REF);
    console.log(`App versions agree: ${version}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
