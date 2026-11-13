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

test("voice recording picks a format the webview supports", async () => {
  const { recordingMime } = await import("../src/platform.js");
  assert.equal(recordingMime((type) => type.startsWith("audio/webm")), "audio/webm;codecs=opus");
  assert.equal(recordingMime((type) => type === "audio/mp4"), "audio/mp4", "macOS WKWebView records MP4 only");
  assert.equal(recordingMime(() => false), "");
  assert.equal(recordingMime(undefined), "");
});

test("daily spend uses the local calendar day", async () => {
  const { spentOn, localDay } = await import("../src/schedule.js");
  const now = new Date(2026, 10, 13, 2, 30); // 02:30 local time
  assert.equal(spentOn({ date: localDay(now), usd: 1.25 }, now), 1.25);
  assert.equal(spentOn({ date: localDay(new Date(2026, 10, 12, 23, 0)), usd: 1.25 }, now), 0, "yesterday's spend does not count");
  assert.equal(spentOn(undefined, now), 0);
  assert.equal(spentOn({ date: localDay(now), usd: "x" }, now), 0);
});

test("no window compares the spend record with a UTC date", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of ["main.js", "tasks.js"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.ok(!/toISOString\(\)\.slice\(0, 10\)/.test(source), `${file} still uses a UTC day`);
  }
});
