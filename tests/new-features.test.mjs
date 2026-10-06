import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../src/preferences.js";
import { effectivePetMode } from "../src/app-profile.js";
import { petMood } from "../src/mood.js";
import { resultHints } from "../src/result-card.js";
import { parsePetPreset, parsePetPresetLink } from "../src/pet-preset.js";
import { customImageSvg } from "../src/appearance.js";

test("app modes obey fullscreen priority and exact executable match", () => {
  const settings = normalizeSettings({ focusFullscreen: true, focusAction: "hide", quietHours: true, quietStart: "09:00", quietEnd: "17:00", appProfiles: [{ app: "zoom.exe", mode: "quiet" }] });
  const at = new Date(2026, 9, 6, 10, 0);
  assert.equal(effectivePetMode(settings, { fullscreen: true, activeApp: "zoom.exe" }, at), "hide");
  assert.equal(effectivePetMode(settings, { fullscreen: false, activeApp: "zoom.exe" }, at), "quiet");
  assert.equal(effectivePetMode(settings, { fullscreen: false, activeApp: "other.exe" }, at), "hide");
  assert.equal(effectivePetMode(settings, { fullscreen: false, activeApp: "other.exe" }, new Date(2026, 9, 6, 19, 0)), "playful");
});

test("new saved fields normalize with limits and preserve custom sheet type", () => {
  const image = "data:image/png;base64,iVBORw0KGgo=";
  const settings = normalizeSettings({
    customPets: [{ id: "custom:test", name: "Test", image, frames: 4 }],
    appProfiles: [{ app: "ZOOM.EXE", mode: "quiet" }, { app: "zoom.exe", mode: "hide" }, { app: "../bad", mode: "hide" }],
    agent: { recipes: [{ id: "one", name: "News", task: "Summarise news" }] },
    tasks: [{ id: "done", task: "Find link", status: "done", answer: "ok", approvals: 2, durationMs: 1400 }],
  });
  assert.equal(settings.customPets[0].frames, 4);
  assert.deepEqual(settings.appProfiles, [{ app: "zoom.exe", mode: "quiet" }]);
  assert.equal(settings.agent.recipes[0].name, "News");
  assert.equal(settings.tasks[0].approvals, 2);
  assert.equal(settings.tasks[0].durationMs, 1400);
  assert.match(customImageSvg(image, 4), /custom-sheet/);
});

test("friendship mood responds to play and hunger", () => {
  assert.deepEqual(petMood({ meals: 0 }, 0), { level: 1, mood: "curious", interactions: 0 });
  assert.equal(petMood({ pats: 5 }, 0).mood, "friendly");
  assert.equal(petMood({ pats: 25 }, 0).level, 3);
  assert.equal(petMood({ pats: 25 }, 91).mood, "famished");
});

test("result hints and website preset stay bounded and appearance-only", () => {
  assert.deepEqual(resultHints("Pay ₹120 by 2026-10-06. https://example.com/item."), {
    urls: ["https://example.com/item"], prices: ["₹120"], dates: ["2026-10-06"],
  });
  assert.deepEqual(parsePetPreset({ app: "PocketPet", type: "pet-preset", version: 1, pet: "cat", color: "#FFAA00", accessories: [{ emoji: "🎩", slot: "hat" }], agent: { siteRules: { "evil.example": "allow" } } }), {
    pet: "cat", colors: { cat: "#ffaa00" }, accessories: { cat: [{ emoji: "🎩", slot: "hat", size: 1, x: 0, y: 0 }] },
  });
  assert.throws(() => parsePetPreset({ app: "PocketPet", type: "pet-preset", version: 1, pet: "../../bad" }));
  const link = `pocketpet://pet/apply?${new URLSearchParams({ pet: "cat", color: "#ffaa00", accessories: "[]" })}`;
  assert.deepEqual(parsePetPresetLink(link), { pet: "cat", colors: { cat: "#ffaa00" }, accessories: { cat: [] } });
  assert.throws(() => parsePetPresetLink("https://evil.example/pet/apply?pet=cat"));
  assert.throws(() => parsePetPresetLink("pocketpet://pet/apply?pet=cat&color=%23ffaa00&accessories=%5B%5D&agent=allow"));
});
