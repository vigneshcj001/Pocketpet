import test from "node:test";
import assert from "node:assert/strict";
import { taskView } from "../src/companion.js";
import { normalizeSettings } from "../src/preferences.js";
import { getPet, DEFAULT_PET } from "../src/pets/index.js";

test("new installs use cat and older pet selections migrate", () => {
  assert.equal(DEFAULT_PET, "cat");
  assert.equal(normalizeSettings({}).pet, "cat");
  assert.equal(normalizeSettings({ pet: "cat" }).pet, "cat");
  assert.equal(normalizeSettings({ pet: "droplet", companion: "duck" }).companion, "duck");
  assert.equal(normalizeSettings({ pet: "duck", companion: "droplet" }).companion, "");
  assert.equal(getPet("droplet"), getPet("cat"));
});

test("removed pet friendship history moves to cat once", () => {
  const migrated = normalizeSettings({
    pet: "droplet", companion: "droplet",
    profiles: {
      droplet: { meals: 4, pats: 2, firstRun: 100, journal: [{ at: 101, text: "Fed" }] },
      cat: { meals: 3, firstRun: 200, journal: [{ at: 201, text: "Played" }] },
    },
  });
  assert.equal(migrated.pet, "cat");
  assert.equal(migrated.companion, "");
  assert.equal(migrated.profiles.cat.meals, 7);
  assert.equal(migrated.profiles.cat.pats, 2);
  assert.equal(migrated.profiles.cat.firstRun, 100);
  assert.deepEqual(migrated.profiles.cat.journal.map(({ text }) => text), ["Fed", "Played"]);
  assert.equal(Object.hasOwn(migrated.profiles, "droplet"), false);
  assert.deepEqual(normalizeSettings(migrated).profiles.cat, migrated.profiles.cat);
});
test("task status follows real progress and never treats an approval as completion", () => {
  let view = taskView(null, { id: "one", kind: "start", detail: { task: "Explain AI" } });
  assert.equal(view.phase, "starting");
  view = taskView(view, { id: "one", kind: "tool" });
  assert.equal(view.phase, "thinking");
  view = taskView(view, { id: "one", kind: "confirm" });
  assert.equal(view.phase, "waiting");
  assert.equal(taskView(view, { id: "one", kind: "note" }).phase, "waiting");
  view = taskView(view, { id: "one", kind: "answer", text: "Ready" });
  assert.equal(view.phase, "completed");
  assert.equal(view.text, "Ready");
  assert.equal(taskView(view, { id: "one", kind: "note" }), view);
});
test("other task events cannot overwrite current progress; new tasks reset titles", () => {
  const view = taskView(null, { id: "one", kind: "start", detail: { task: "Old task" } });
  assert.equal(taskView(view, { id: "two", kind: "answer", text: "Unrelated" }), view);
  assert.equal(taskView(view, { id: "two", kind: "start" }).title, "Your task");
  assert.equal(taskView(view, { kind: "killed" }).text, "Task stopped");
  assert.equal(taskView(view, { id: "one", kind: "error", text: "No key" }).phase, "error");
});
