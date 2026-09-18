// Agent eval: runs scripted tasks through the live app and checks the answers.
//
// Needs PocketPet running with remote debugging on port 9222 and a provider key
// saved (or Ollama). Costs real money on paid providers.
//
//   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
//   & "$env:LOCALAPPDATA\PocketPet\pocketpet.exe"
//   node tests/agent-eval.mjs gemini gemini-3.6-flash
//
// Exit code 0 when every task passes. Results also land in tests/eval-results.json.
import { readFileSync, writeFileSync } from "node:fs";

const [provider = "gemini", model = ""] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(new URL("./eval-tasks.json", import.meta.url), "utf8"));

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
let page = targets.find((t) => t.url.includes("tasks.html"));
if (!page) {
  const overlay = targets.find((t) => t.url === "http://tauri.localhost/");
  if (!overlay) throw new Error("PocketPet is not running with remote debugging on :9222");
  await evalIn(overlay, "window.__TAURI__.core.invoke('open_tasks')");
  await new Promise((r) => setTimeout(r, 2500));
  page = (await (await fetch("http://127.0.0.1:9222/json")).json()).find((t) => t.url.includes("tasks.html"));
}

function evalIn(target, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id === 1) {
        ws.close();
        msg.result?.exceptionDetails ? reject(new Error(msg.result.exceptionDetails.text)) : resolve(msg.result?.result?.value);
      }
    };
    ws.onerror = reject;
  });
}

const results = [];
for (const c of cases) {
  const started = Date.now();
  const out = await evalIn(page, `(async () => {
    const $ = (id) => document.getElementById(id), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    $('provider').value = ${JSON.stringify(provider)}; $('provider').dispatchEvent(new Event('input'));
    if (${JSON.stringify(model)}) { $('model').value = ${JSON.stringify(model)}; $('model').dispatchEvent(new Event('change')); }
    $('followUp').checked = false;
    $('task').value = ${JSON.stringify(c.task)};
    $('run').click();
    for (let i = 0; i < ${Math.round((c.timeoutSec ?? 180) * 2)} && $('cancel').disabled === false; i++) {
      await sleep(500);
      if (!$('askCard').hidden) { $('${c.approve === false ? "deny" : "approve"}').click(); await sleep(300); }
    }
    return JSON.stringify({ status: $('status').textContent, answer: $('answer').textContent, log: [...$('log').querySelectorAll('li')].map((l) => l.textContent) });
  })()`);
  const r = JSON.parse(out);
  const pass = c.expect.every((re) => new RegExp(re, "i").test(r.answer)) && /^Done/.test(r.status);
  results.push({ name: c.name, pass, seconds: Math.round((Date.now() - started) / 1000), status: r.status, answer: r.answer.slice(0, 300), steps: r.log.length });
  console.log(`${pass ? "PASS" : "FAIL"}  ${c.name}  (${results.at(-1).seconds}s, ${r.log.length} steps)`);
  if (!pass) console.log("      ", r.status, "|", r.answer.slice(0, 200).replace(/\s+/g, " "));
}
writeFileSync(new URL("./eval-results.json", import.meta.url), JSON.stringify({ provider, model, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
