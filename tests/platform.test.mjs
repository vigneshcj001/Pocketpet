import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platformFor } from "../src/platform.js";

test("every platform has key-store, voice and modifier wording", () => {
  for (const os of ["windows", "mac", "linux"]) {
    const info = platformFor(os);
    assert.ok(info.keyStore && info.voiceHint && info.superKey, os);
  }
  assert.match(platformFor("mac").keyStore, /Keychain/);
  assert.match(platformFor("linux").keyStore, /Secret Service/);
});

test("bundle config builds packages for Windows, macOS and Linux", () => {
  const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  for (const target of ["nsis", "dmg", "deb", "rpm", "appimage"]) {
    assert.ok(config.bundle.targets.includes(target), `missing bundle target ${target}`);
  }
});

test("macOS and Linux helper scripts exist with LF endings", () => {
  for (const file of ["run.sh", "build.sh", "scripts/check-deps.sh"]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(text.startsWith("#!/usr/bin/env bash"), file);
    assert.ok(!text.includes("\r"), `${file} has CRLF line endings`);
  }
});
