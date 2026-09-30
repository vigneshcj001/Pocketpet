import test from "node:test";
import assert from "node:assert/strict";
import { updateConfirmation } from "../src/update-state.js";

const oldBuild = "PocketPet 0.2.0 · build abcdef12 (release)";
const attempt = { fromIdentity: oldBuild, targetVersion: "v0.3.0" };

test("an installer attempt is confirmed only by the requested version running afterward", () => {
  assert.equal(updateConfirmation(attempt, oldBuild).installed, false);
  assert.equal(updateConfirmation(attempt, "PocketPet 0.2.0 · build fedcba98 (release)").installed, false);
  assert.equal(updateConfirmation(attempt, "PocketPet 0.3.0 · build fedcba98 (release)").installed, true);
  assert.equal(updateConfirmation(attempt, "PocketPet 0.3.0-beta.1 · build fedcba98 (release)").installed, false);
  assert.equal(updateConfirmation(attempt, "PocketPet 0.4.0 · build fedcba98 (release)").installed, false);
});

test("missing build metadata and same-version reinstalls do not produce false confirmation", () => {
  assert.equal(updateConfirmation(null, oldBuild), null);
  assert.equal(updateConfirmation(attempt, "unknown"), null);
  assert.equal(updateConfirmation({ targetVersion: "v0.3.0" }, oldBuild), null);
  assert.equal(updateConfirmation({ fromIdentity: oldBuild, targetVersion: "bad" }, oldBuild), null);
  assert.equal(updateConfirmation({ fromIdentity: oldBuild, targetVersion: "0.2.0" }, "PocketPet 0.2.0 · build different (release)").installed, false);
});
