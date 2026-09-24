import test from "node:test";
import assert from "node:assert/strict";
import { readReleaseVersions, validateReleaseVersions } from "../scripts/validate-release.mjs";

const versions = {
  "Cargo.toml": "0.2.0",
  "Cargo.lock": "0.2.0",
  "tauri.conf.json": "0.2.0",
};

test("a release tag must match the version embedded in the app and installer", () => {
  assert.equal(validateReleaseVersions(versions, "refs/tags/v0.2.0"), "0.2.0");
  assert.throws(() => validateReleaseVersions(versions, "refs/tags/v0.1.0"), /must match app version/);
  assert.throws(() => validateReleaseVersions(versions, "refs/tags/v0.2.1"), /must match app version/);
});

test("branch and pull request builds still require all app versions to agree", () => {
  assert.equal(validateReleaseVersions(versions, "refs/heads/main"), "0.2.0");
  assert.equal(validateReleaseVersions(versions, "refs/pull/1/merge"), "0.2.0");
  for (const name of Object.keys(versions)) {
    assert.throws(() => validateReleaseVersions({ ...versions, [name]: "0.1.0" }), /versions must match/);
    assert.throws(() => validateReleaseVersions({ ...versions, [name]: undefined }), /versions must match/);
  }
});

test("the checked-in app, installer, and lockfile have matching versions", () => {
  assert.ok(validateReleaseVersions(readReleaseVersions()));
});
