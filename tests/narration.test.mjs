import test from "node:test";
import assert from "node:assert/strict";
import { taskNarration } from "../src/narration.js";

test("overlay narration does not reveal task queries, URLs, typed text, or errors", () => {
  const sensitive = "private.example/checkout?token=secret";
  for (const kind of ["tool", "note", "plan", "step", "result", "error", "answer"]) {
    const line = taskNarration({ kind, text: sensitive, detail: { tool: "type_text", value: sensitive } });
    assert.ok(line.length > 0);
    assert.equal(line.includes(sensitive), false);
  }
  assert.match(taskNarration({ kind: "tool", detail: { tool: "web_search" } }), /Looking/);
  assert.match(taskNarration({ kind: "tool", detail: { tool: "unknown" } }), /Working/);
});
