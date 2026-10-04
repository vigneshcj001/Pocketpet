import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { focusActive, inQuietHours, hungerAfter, nearestMonitor, insetBounds, exclusionRect, constrainPoint } from "../src/behavior.js";
import { normalizeSettings, parseBackup, keepLocalTrust, recordActivity, readSettings, accessoryUnlocked } from "../src/preferences.js";
import { localDay, scheduleDue } from "../src/schedule.js";

const makeDate = (h, m) => new Date(2026, 8, 17, h, m);

test("schedules use local days and obey missed-run policy", () => {
  const at = makeDate(9, 5);
  const schedule = { enabled: true, time: "09:00", days: "daily", lastRun: "", catchUp: "skip" };
  assert.equal(localDay(at), "2026-09-17");
  assert.equal(scheduleDue(schedule, at), true);
  assert.equal(scheduleDue({ ...schedule, lastRun: localDay(at) }, at), false);
  assert.equal(scheduleDue(schedule, makeDate(9, 10)), false);
  assert.equal(scheduleDue({ ...schedule, catchUp: "run" }, makeDate(20, 0)), true);
  assert.equal(scheduleDue({ ...schedule, days: "weekends" }, at), false);
});

test("waiting task queue survives settings normalization with bounded entries", () => {
  const queued = Array.from({ length: 24 }, (_, i) => ({ id: `task-${i}`, task: `Task ${i}`, scheduled: i === 0 }));
  const agent = normalizeSettings({ agent: { taskQueue: queued, schedules: [{ id: "morning", task: "Read news", catchUp: "run" }] } }).agent;
  assert.equal(agent.taskQueue.length, 20);
  assert.deepEqual(agent.taskQueue[0], queued[0]);
  assert.equal(agent.schedules[0].catchUp, "run");
});

test("focus hours that cross midnight have exact start and end boundaries", () => {
  assert.equal(inQuietHours("22:00", "06:00", makeDate(23, 0)), true);
  assert.equal(inQuietHours("22:00", "06:00", makeDate(5, 59)), true);
  assert.equal(inQuietHours("22:00", "06:00", makeDate(6, 0)), false);
  assert.equal(inQuietHours("22:00", "06:00", makeDate(21, 59)), false);
  assert.equal(focusActive({ focusFullscreen: true, quietHours: false }, { fullscreen: true }), true);
});

test("hunger pauses across an offline gap but can catch up when selected", () => {
  assert.equal(hungerAfter(20, 3 * 60 * 60 * 1000, 100, true), 20);
  assert.equal(hungerAfter(20, 3 * 60 * 60 * 1000, 100, false), 100);
});

test("screen placement stays inside the selected display and outside the protected area", () => {
  const monitors = [{ x: -1920, y: 0, w: 1920, h: 1080 }, { x: 0, y: 0, w: 2560, h: 1440 }];
  const chosen = nearestMonitor(monitors, { x: -100, y: 400 });
  assert.equal(chosen.x, -1920);
  const bounds = insetBounds(chosen, 16, 76);
  const avoid = exclusionRect(bounds, { enabled: true, x: 40, y: 40, w: 20, h: 20 });
  const kept = constrainPoint({ x: avoid.x + 5, y: avoid.y + 5 }, bounds, 76, avoid);
  assert.ok(kept.x >= bounds.x && kept.x + 76 <= bounds.x + bounds.w);
  assert.ok(kept.y >= bounds.y && kept.y + 76 <= bounds.y + bounds.h);
  assert.ok(kept.x + 76 <= avoid.x || kept.x >= avoid.x + avoid.w || kept.y + 76 <= avoid.y || kept.y >= avoid.y + avoid.h);
});

test("old image and counters migrate into a pet profile; backup import rejects bad images", () => {
  const img = "data:image/png;base64,iVBORw0KGgo=";
  const upgraded = normalizeSettings({ pet: "custom", customImage: img, stats: { meals: 4 } });
  assert.equal(upgraded.pet, "custom:legacy");
  assert.equal(upgraded.profiles[upgraded.pet].meals, 4);
  assert.throws(() => parseBackup({ app: "PocketPet", version: 1, settings: { customPets: [{ id: "custom:bad", image: "javascript:1" }] } }));
});

test("a restored backup cannot redirect API keys or pre-approve sites", () => {
  const local = normalizeSettings({ agent: { baseUrls: { custom: "http://localhost:1234/v1" }, siteRules: { "amazon.in": "ask" } } });
  const backup = parseBackup({ app: "PocketPet", version: 1, settings: { volume: 9, agent: {
    baseUrls: { claude: "https://attacker.example" }, siteRules: { "amazon.in": "allow", "shop.example": "allow" } } } });
  const restored = keepLocalTrust(backup, local);
  assert.equal(restored.volume, 9);
  assert.deepEqual(restored.agent.baseUrls, { custom: "http://localhost:1234/v1" });
  assert.deepEqual(restored.agent.siteRules, { "amazon.in": "ask" });
});

test("per-pet activity increments once and preserves other settings", () => {
  const data = new Map([["pocketpet", JSON.stringify(normalizeSettings({ pet: "cat", volume: 17 }))]]);
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  recordActivity("cat", "meals");
  const after = readSettings();
  assert.equal(after.volume, 17);
  assert.equal(after.profiles.cat.meals, 1);
  assert.equal(after.stats.meals, 1);
  assert.equal(after.profiles.cat.journal.length, 1);
  delete globalThis.localStorage;
});

test("friendship prizes unlock for the pet that earned them", () => {
  const settings = normalizeSettings({ profiles: { cat: { pats: 5 }, duck: { pats: 0 } } });
  assert.equal(accessoryUnlocked(settings, "cat", "🎀"), true);
  assert.equal(accessoryUnlocked(settings, "duck", "🎀"), false);
  assert.equal(accessoryUnlocked(settings, "cat", "🎩"), true);
});

test("every overlay, settings, and tasks control referenced by JavaScript exists in its page", () => {
  const files = [
    ["../src/main.js", "../src/index.html", /document\.getElementById\("([^"]+)"\)/g],
    ["../src/settings.js", "../src/settings.html", /\$\("([^"]+)"\)/g],
    ["../src/tasks.js", "../src/tasks.html", /\$\("([^"]+)"\)/g],
  ];
  for (const [scriptPath, htmlPath, pattern] of files) {
    const script = readFileSync(new URL(scriptPath, import.meta.url), "utf8");
    const html = readFileSync(new URL(htmlPath, import.meta.url), "utf8");
    for (const match of script.matchAll(pattern)) {
      assert.ok(html.includes(`id="${match[1]}"`) || script.includes(`.id = "${match[1]}"`),
        `${scriptPath} refers to missing ${match[1]}`);
    }
  }
});
