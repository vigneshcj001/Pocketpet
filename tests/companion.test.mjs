import test from "node:test";
import assert from "node:assert/strict";
import { taskView } from "../src/companion.js";
import { normalizeSettings } from "../src/preferences.js";
import { getPet, DEFAULT_PET } from "../src/pets/index.js";

test("new installs use droplet and existing selections survive migration", () => {
  assert.equal(DEFAULT_PET, "droplet");
  assert.equal(normalizeSettings({}).pet, "droplet");
  assert.equal(normalizeSettings({ pet: "cat" }).pet, "cat");
  assert.equal(normalizeSettings({ pet: "droplet", companion: "duck" }).companion, "duck");
  assert.equal(getPet("droplet").paw.x, 0.84);
});
test("task status follows real progress and never treats an approval as completion", () => {
  let view = taskView(null, { id: "one", kind: "start", detail: { task: "Explain AI" } });
  assert.equal(view.phase, "starting");
  view = taskView(view, { id: "one", kind: "tool" });
  assert.equal(view.phase, "thinking");
  view = taskView(view, { id: "one", kind: "confirm" });
  assert.equal(view.phase, "waiting");
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
