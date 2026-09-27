import test from "node:test";
import assert from "node:assert/strict";
import { monitorBounds } from "../src/behavior.js";
import { paintPetSprite, customImageSvg } from "../src/appearance.js";
import { normalizeSettings } from "../src/preferences.js";

test("any-monitor roaming uses the current monitor's work area, including negative coordinates", () => {
  const monitors = [{ x: -1920, y: 0, w: 1920, h: 1080 }, { x: 0, y: 0, w: 2560, h: 1440 }];
  const work = [{ x: -1920, y: 0, w: 1920, h: 1040 }, { x: 0, y: 0, w: 2560, h: 1400 }];
  const fallback = { x: -1920, y: 0, w: 4480, h: 1440 };
  assert.deepEqual(monitorBounds(monitors, work, "all", { x: -100, y: 500 }, fallback), work[0]);
  assert.deepEqual(monitorBounds(monitors, work, "all", { x: 800, y: 600 }, fallback), work[1]);
  assert.deepEqual(monitorBounds(monitors, work, "0", { x: 800, y: 600 }, fallback), work[0]);
});

test("monitor removal and missing work areas have usable fallbacks", () => {
  const monitor = { x: 0, y: 0, w: 1280, h: 720 };
  const fallback = { x: 0, y: 0, w: 640, h: 480 };
  assert.deepEqual(monitorBounds([monitor], [], "3", { x: -1500, y: 200 }, fallback), monitor);
  assert.deepEqual(monitorBounds([], [], "all", { x: 100, y: 200 }, fallback), fallback);
});

test("replacing a custom image refreshes its sprite without restarting unchanged animations", () => {
  let markup = "", writes = 0;
  const root = {
    dataset: {},
    get innerHTML() { return markup; },
    set innerHTML(value) { markup = value; writes += 1; },
  };
  const first = { id: "custom:one", svg: customImageSvg("data:image/png;base64,AAAA"), tint: [] };
  paintPetSprite(root, first);
  paintPetSprite(root, { ...first });
  assert.equal(writes, 1, "the same artwork must keep its existing animated DOM");
  const replacement = { ...first, svg: customImageSvg("data:image/png;base64,BBBB") };
  paintPetSprite(root, replacement);
  assert.equal(writes, 2);
  assert.match(root.innerHTML, /BBBB/);
  assert.equal(root.dataset.pet, "custom:one");
  const body = { id: "cat", svg: '<svg><path fill="#ff0000" /></svg>', tint: ["#ff0000"] };
  paintPetSprite(root, body, "#00ff00");
  const green = root.innerHTML;
  paintPetSprite(root, body, "#0000ff");
  assert.notEqual(root.innerHTML, green, "colour changes must repaint too");
});

test("removing a migrated custom pet does not resurrect it on the next settings read", () => {
  const image = "data:image/png;base64,iVBORw0KGgo=";
  const migrated = normalizeSettings({ pet: "custom", customImage: image, stats: { meals: 7 } });
  assert.equal(migrated.pet, "custom:legacy");
  assert.equal(migrated.customPets[0].image, image);
  assert.equal(migrated.profiles["custom:legacy"].meals, 7);
  assert.equal(migrated.customImage, null);
  const removed = normalizeSettings({ ...migrated, customPets: [] });
  assert.deepEqual(removed.customPets, []);
  assert.equal(removed.pet, "droplet");
  assert.deepEqual(normalizeSettings(removed).customPets, []);
});
