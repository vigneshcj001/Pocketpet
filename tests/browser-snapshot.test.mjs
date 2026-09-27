import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the same scripts the browser driver sends to CDP with a small DOM fixture.
const source = readFileSync(new URL("../src-tauri/src/browser.rs", import.meta.url), "utf8");
const script = (name) => source.match(new RegExp(`const ${name}: &str = r#"([\\s\\S]*?)"#;`))[1];
const description = script("ELEMENT_INFO_JS");
const snapshot = script("READ_PAGE_JS").replace("/*ELEMENT_INFO*/", description);

function input(type, label, value, attributes = {}) {
  return {
    tagName: "INPUT", type, value, name: "", id: "", innerText: "", placeholder: "",
    labels: [{ innerText: label }], isConnected: true,
    getAttribute: (name) => attributes[name] || "",
    getBoundingClientRect: () => ({ width: 200, height: 30, top: 10, bottom: 40 }),
  };
}

test("page snapshots redact secret values but preserve useful search field values", () => {
  const fields = [
    input("password", "Password", "secret-password"),
    input("text", "Card", "4111222233334444", { autocomplete: "cc-number" }),
    input("text", "Verification", "928374", { autocomplete: "one-time-code" }),
    input("search", "Search", "cats and ducks"),
  ];
  const view = runInNewContext(snapshot, {
    document: { querySelectorAll: () => fields, body: { innerText: "Example form" }, documentElement: { scrollHeight: 900 }, title: "Example" },
    window: {}, location: { href: "https://example.com" }, scrollY: 0, innerHeight: 900,
    getComputedStyle: () => ({ visibility: "visible", display: "block" }),
  });
  for (const secret of ["secret-password", "4111222233334444", "928374"]) assert.ok(!view.includes(secret));
  assert.ok(view.includes("cats and ducks"));
  assert.equal(view.match(/private value hidden/g).length, 3);
});

test("action descriptions include form submission context and reject detached references", () => {
  const field = input("text", "Email", "private@example.com");
  field.form = {
    action: "https://example.com/sign-in",
    querySelectorAll: () => [{ innerText: "Sign in" }],
  };
  const info = runInNewContext(`(${description})(field)`, { field });
  assert.equal(info.text, "Email");
  assert.equal(info.formText, "Sign in");
  assert.equal(info.formAction, "https://example.com/sign-in");
  assert.ok(!JSON.stringify(info).includes(field.value));
  field.isConnected = false;
  assert.equal(runInNewContext(`(${description})(field)`, { field }), null);
});
