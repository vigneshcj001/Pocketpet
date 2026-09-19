// Tasks window. Runs a web errand through the Rust agent (agent.rs) and shows
// its progress; pauses for approvals; holds memory, keys, schedules and
// limits. Settings share the overlay's localStorage via preferences.js; API
// keys go to Credential Manager only. Task history and spend are written by
// the overlay (single writer), which tells us via pet://settings.
import { readSettings, writeSettings, AGENT_PROVIDERS } from "./preferences.js";
import { getPet } from "./pets/index.js";

const { invoke } = window.__TAURI__.core;
const { listen, emit } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
let settings = readSettings();
let providers = [];
let current = null; // { id, task, provider, model, startedAt, paused, host }
const queue = []; // tasks waiting while one runs
let answeredOnce = false;

const LABEL = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  ollama: "Ollama (local)",
  custom: "Custom OpenAI-compatible",
};
const KEY_HINT = {
  claude: "console.anthropic.com → API keys",
  openai: "platform.openai.com → API keys",
  groq: "console.groq.com → API keys",
  gemini: "aistudio.google.com → Get API key",
  deepseek: "platform.deepseek.com → API keys",
};
const EXAMPLES = [
  "Find three well-reviewed veg restaurants near me that deliver right now, with links.",
  "Order a margherita pizza from Domino's to my usual address — stop before payment.",
  "Search MakeMyTrip for a 3-star hotel near Marina Beach, Chennai, next weekend, under ₹4 000 a night; show me the best two.",
  "Go to amazon.in, search for a 65 W USB-C charger under ₹1 500 with 4+ stars, and add the best one to the cart.",
  "Summarise today's top three tech headlines with links.",
];

const today = () => new Date().toISOString().slice(0, 10);
const spentToday = () => (settings.agent.spend.date === today() ? settings.agent.spend.usd : 0);

function save(patch) {
  settings = writeSettings(patch);
  emit("pet://settings", patch).catch(() => {});
}

// --- tabs --------------------------------------------------------------------

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}
function showTab(name) {
  for (const tab of document.querySelectorAll('[role="tab"]')) tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== name;
  if (name === "history") renderHistory();
  if (name === "providers") renderKeys();
  if (name === "memory") loadMemory();
  if (name === "limits") renderLimits();
  if (name === "schedules") renderSchedules();
}

// --- providers & models ---------------------------------------------------------

async function loadProviders() {
  try {
    providers = await invoke("agent_providers");
  } catch {
    providers = AGENT_PROVIDERS.map((id) => ({ id, needs_key: id !== "ollama" && id !== "custom", base_url: "", default_model: "", has_key: false }));
  }
  const sel = $("provider");
  sel.innerHTML = "";
  for (const p of providers) {
    const ready = p.has_key || !p.needs_key;
    sel.add(new Option(`${ready ? "🔑" : "⚠"} ${LABEL[p.id] ?? p.id}${ready ? "" : " — no key"}`, p.id));
  }
  sel.value = settings.agent.provider;
  onProviderChange(false);
}

function providerInfo(id = $("provider").value) {
  return providers.find((p) => p.id === id) ?? { id, needs_key: true, default_model: "", has_key: false };
}

function onProviderChange(persist = true) {
  const id = $("provider").value;
  const p = providerInfo(id);
  $("model").value = settings.agent.models[id] ?? p.default_model ?? "";
  $("model").placeholder = p.default_model || "model id";
  const hasKey = p.has_key || !p.needs_key;
  $("providerHint").classList.toggle("warn", !hasKey);
  $("providerHint").textContent = !hasKey
    ? `No API key saved for ${LABEL[id]}. Add one under Providers & keys.`
    : id === "claude"
      ? "Claude uses Anthropic's own web tools plus the browser."
      : id === "ollama" || id === "custom"
        ? "Local models: pick one that supports tool calling (llama3.1, qwen2.5, mistral-nemo…) or it will answer from memory only."
        : "OpenAI-compatible endpoint with PocketPet's search, page-reading and browser tools.";
  if (persist) save({ agent: { provider: id } });
  $("modelList").innerHTML = "";
}

$("provider").addEventListener("input", () => onProviderChange(true));
$("model").addEventListener("change", () => save({ agent: { models: { [$("provider").value]: $("model").value.trim() } } }));

$("refreshModels").addEventListener("click", async () => {
  const id = $("provider").value;
  $("status").textContent = "Fetching models…";
  try {
    const ids = await invoke("agent_models", { provider: id, baseUrl: settings.agent.baseUrls[id] ?? "" });
    const list = $("modelList");
    list.innerHTML = "";
    for (const m of ids) list.append(new Option(m));
    $("status").textContent = `${ids.length} models — start typing to pick.`;
    if (!$("model").value && ids[0]) $("model").value = ids[0];
  } catch (err) {
    $("status").textContent = `Couldn't list models: ${err}`;
  }
});

// --- keys & model behaviour ------------------------------------------------------------

function renderKeys() {
  const list = $("keys");
  list.innerHTML = "";
  for (const p of providers.filter((p) => p.needs_key)) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = LABEL[p.id] ?? p.id;
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = p.has_key ? "•••••••• (saved) — paste a new key to replace" : "Paste API key";
    input.autocomplete = "off";
    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "eye";
    eye.textContent = "👁";
    eye.title = "Show / hide what you pasted";
    eye.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      eye.textContent = input.type === "password" ? "👁" : "🙈";
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    const test = document.createElement("button");
    test.type = "button";
    test.textContent = "Test";
    test.title = "Ask the provider for its model list with the saved key";
    test.disabled = !p.has_key;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.disabled = !p.has_key;
    const state = document.createElement("span");
    state.className = `state ${p.has_key ? "ok" : ""}`;
    state.textContent = p.has_key ? "Key saved." : `No key. ${KEY_HINT[p.id] ?? ""}`;
    test.addEventListener("click", async () => {
      state.className = "state testing";
      state.textContent = "Testing…";
      test.disabled = true;
      try {
        const ids = await invoke("agent_models", { provider: p.id, baseUrl: settings.agent.baseUrls[p.id] ?? "" });
        state.className = "state ok";
        state.textContent = `Key works — ${ids.length} model${ids.length === 1 ? "" : "s"} available.`;
      } catch (err) {
        state.className = "state bad";
        state.textContent = `Key rejected: ${String(err).slice(0, 160)}`;
      } finally {
        test.disabled = false;
      }
    });
    saveBtn.addEventListener("click", async () => {
      const key = input.value.trim();
      if (!key) return;
      try {
        await invoke("agent_set_key", { provider: p.id, key });
        input.value = "";
        await loadProviders();
        renderKeys();
      } catch (err) {
        state.textContent = `Couldn't save: ${err}`;
      }
    });
    del.addEventListener("click", async () => {
      await invoke("agent_delete_key", { provider: p.id }).catch(() => {});
      await loadProviders();
      renderKeys();
    });
    li.append(name, input, eye, saveBtn, test, del, state);
    list.append(li);
  }
  $("url_ollama").value = settings.agent.baseUrls.ollama ?? "";
  $("url_custom").value = settings.agent.baseUrls.custom ?? "";
  $("stream").checked = settings.agent.stream;
  $("digestModel").value = settings.agent.digestModel;
  $("voice").checked = settings.agent.voice;
  $("voiceEngine").value = settings.agent.voiceEngine;
  $("speakSetting").checked = settings.agent.speak;
  $("mic").hidden = !settings.agent.voice;
}

for (const id of ["ollama", "custom"]) {
  $(`url_${id}`).addEventListener("change", () => save({ agent: { baseUrls: { [id]: $(`url_${id}`).value.trim() } } }));
}
$("stream").addEventListener("input", () => save({ agent: { stream: $("stream").checked } }));
$("digestModel").addEventListener("change", () => save({ agent: { digestModel: $("digestModel").value.trim() } }));
$("voice").addEventListener("input", () => {
  save({ agent: { voice: $("voice").checked } });
  $("mic").hidden = !$("voice").checked;
});
$("voiceEngine").addEventListener("input", () => save({ agent: { voiceEngine: $("voiceEngine").value } }));
$("speakSetting").addEventListener("input", () => save({ agent: { speak: $("speakSetting").checked } }));

// --- limits, sites, rules ---------------------------------------------------------------

function renderLimits() {
  $("browserOn").checked = settings.agent.browser;
  $("sites").value = settings.agent.allowedSites.join("\n");
  $("purchaseCap").value = settings.agent.purchaseCap;
  $("dailyCap").value = settings.agent.dailyCapUsd;
  $("maxTurns").value = settings.agent.maxTurns;
  $("maxTurnsHint").textContent = String(settings.agent.maxTurns);
  $("narrate").checked = settings.agent.narrate;
  paintSpend();
  renderRules();
}

function paintSpend() {
  const cap = settings.agent.dailyCapUsd;
  const s = spentToday();
  $("spendToday").textContent = `Spent today: $${s.toFixed(3)}${cap ? ` of $${cap.toFixed(2)}` : ""}`;
  $("spend").textContent = s ? `· $${s.toFixed(3)} today` : "";
}

function renderRules() {
  const list = $("rules");
  list.innerHTML = "";
  const entries = Object.entries(settings.agent.siteRules);
  if (!entries.length) list.innerHTML = '<li class="hint">No rules yet — they appear when you pick "Always allow" or "Never" on an approval.</li>';
  for (const [domain, rule] of entries.sort()) {
    const li = document.createElement("li");
    const d = document.createElement("span");
    d.className = "domain grow";
    d.textContent = domain;
    const sel = document.createElement("select");
    for (const r of ["allow", "ask", "never"]) sel.add(new Option(r, r));
    sel.value = rule;
    sel.addEventListener("input", () => setRule(domain, sel.value));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      const rest = { ...settings.agent.siteRules };
      delete rest[domain];
      save({ agent: { siteRules: null } });
      save({ agent: { siteRules: rest } });
      renderRules();
    });
    li.append(d, sel, del);
    list.append(li);
  }
}

function setRule(domain, rule) {
  save({ agent: { siteRules: { [domain]: rule } } });
  renderRules();
}

$("browserOn").addEventListener("input", () => save({ agent: { browser: $("browserOn").checked } }));
$("sites").addEventListener("change", () => {
  const lines = $("sites").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  save({ agent: { allowedSites: lines } });
  const kept = settings.agent.allowedSites;
  $("sitesStatus").textContent = kept.length === lines.length ? `${kept.length} site${kept.length === 1 ? "" : "s"}.` : `Kept ${kept.length} of ${lines.length} (use plain domains like amazon.in).`;
  $("sites").value = kept.join("\n");
});
$("purchaseCap").addEventListener("change", () => save({ agent: { purchaseCap: Number($("purchaseCap").value) } }));
$("dailyCap").addEventListener("change", () => {
  save({ agent: { dailyCapUsd: Number($("dailyCap").value) } });
  paintSpend();
});
$("maxTurns").addEventListener("input", () => {
  $("maxTurnsHint").textContent = $("maxTurns").value;
  save({ agent: { maxTurns: Number($("maxTurns").value) } });
});
$("narrate").addEventListener("input", () => save({ agent: { narrate: $("narrate").checked } }));
$("closeBrowser").addEventListener("click", async () => {
  const closed = await invoke("agent_close_browser").catch(() => false);
  $("status").textContent = closed ? "Browser closed." : "No pet browser was open.";
});
$("signIn").addEventListener("click", async () => {
  const site = prompt("Which site? (e.g. amazon.in) — the pet's browser opens it; sign in there once and it stays signed in.");
  if (!site) return;
  const url = /^https?:\/\//.test(site) ? site : `https://${site.trim()}`;
  try {
    await invoke("agent_open_site", { url });
    $("status").textContent = `Opened ${url} in the pet's browser. Sign in, then close or leave it.`;
  } catch (err) {
    $("status").textContent = String(err);
  }
});

// --- memory ----------------------------------------------------------------------------

async function loadMemory() {
  $("memory").value = await invoke("memory_read").catch(() => "");
  $("memoryStatus").textContent = "";
}
$("memorySave").addEventListener("click", async () => {
  try {
    await invoke("memory_write", { text: $("memory").value });
    $("memoryStatus").textContent = "Saved.";
  } catch (err) {
    $("memoryStatus").textContent = `Couldn't save: ${err}`;
  }
});
$("memoryClear").addEventListener("click", async () => {
  if (!confirm("Forget everything the pet remembers about you?")) return;
  await invoke("memory_write", { text: "" }).catch(() => {});
  loadMemory();
});

// --- schedules ---------------------------------------------------------------------------

function renderSchedules() {
  settings = readSettings();
  const list = $("schedList");
  list.innerHTML = "";
  if (!settings.agent.schedules.length) list.innerHTML = '<li class="hint">Nothing scheduled.</li>';
  for (const s of settings.agent.schedules) {
    const li = document.createElement("li");
    const on = document.createElement("input");
    on.type = "checkbox";
    on.checked = s.enabled;
    on.title = "Enabled";
    on.addEventListener("input", () => updateSchedule(s.id, { enabled: on.checked }));
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = `${s.time} · ${s.days}${s.lastRun ? ` · last ${s.lastRun}` : ""}`;
    const text = document.createElement("span");
    text.className = "grow";
    text.textContent = s.task;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      save({ agent: { schedules: settings.agent.schedules.filter((x) => x.id !== s.id) } });
      renderSchedules();
    });
    li.append(on, when, text, del);
    list.append(li);
  }
}

function updateSchedule(id, patch) {
  save({ agent: { schedules: settings.agent.schedules.map((x) => (x.id === id ? { ...x, ...patch } : x)) } });
  renderSchedules();
}

$("schedAdd").addEventListener("click", () => {
  const task = $("schedTask").value.trim();
  if (!task) return;
  const entry = { id: Math.random().toString(36).slice(2, 10), task, time: $("schedTime").value || "09:00", days: $("schedDays").value, enabled: true, lastRun: "" };
  save({ agent: { schedules: [...settings.agent.schedules, entry] } });
  $("schedTask").value = "";
  renderSchedules();
});

// --- running a task ------------------------------------------------------------------

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function logLine(kind, text) {
  const log = $("log");
  log.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.className = kind;
  const icon = { start: "▶", tool: "🔎", result: "↳", note: "💬", answer: "✅", error: "⚠", cancelled: "⏹", killed: "⏻", ask: "❓", confirm: "🛑", browser: "🌐", act: "👉", usage: "·" }[kind] ?? "•";
  const i = document.createElement("span");
  i.textContent = icon;
  const t = document.createElement("span");
  t.textContent = text;
  const at = document.createElement("time");
  at.textContent = current ? mmss(Date.now() - current.startedAt) : "";
  li.append(i, t, at);
  // Only follow the tail when the user hasn't scrolled up to read.
  const pinned = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  log.append(li);
  if (pinned) log.scrollTop = log.scrollHeight;
}

/** Status chip on the progress card: idle | running | waiting | paused | done | error. */
function setState(state, text) {
  $("stateChip").dataset.state = state;
  $("stateText").textContent = text;
}

let elapsedTimer = 0;
function paintElapsed() {
  $("elapsed").textContent = current ? mmss(Date.now() - current.startedAt) : "";
  // While the pet is blocked on you, count how long it has been waiting.
  if (current?.waitingSince) {
    $("askWait").textContent = `waiting ${mmss(Date.now() - current.waitingSince)}`;
  }
}

function setRunning(on) {
  $("run").disabled = false; // "Go" while running queues the next task
  $("run").textContent = on ? "Queue" : "Go";
  $("cancel").disabled = !on;
  $("pause").disabled = !on;
  $("provider").disabled = on;
  clearInterval(elapsedTimer);
  if (on) {
    elapsedTimer = setInterval(paintElapsed, 1000);
    $("examplesCard").open = false;
  } else {
    $("pause").textContent = "Pause";
    hideAsk();
    // Idle with nothing typed and nothing answered: offer the examples again.
    if (!$("task").value.trim() && $("answerCard").hidden) $("examplesCard").open = true;
  }
  paintElapsed();
}

// Grow the task box with its text so long errands stay readable.
function autosize() {
  const box = $("task");
  box.style.height = "auto";
  box.style.height = `${box.scrollHeight + 2}px`;
}
$("task").addEventListener("input", autosize);

$("run").addEventListener("click", () => submitTask($("task").value.trim(), $("followUp").checked));
$("task").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitTask($("task").value.trim(), $("followUp").checked);
});

function submitTask(task, followUp) {
  if (!task) return;
  if (current) {
    if (queue.length >= 3) {
      $("status").textContent = "Queue is full (3).";
      return;
    }
    queue.push({ task, followUp: false });
    $("task").value = "";
    renderQueue();
    return;
  }
  startTask(task, followUp);
}

function renderQueue() {
  const q = $("queue");
  q.hidden = queue.length === 0;
  q.innerHTML = "";
  queue.forEach((item, i) => {
    const li = document.createElement("li");
    const t = document.createElement("span");
    t.className = "grow";
    t.textContent = item.task;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      queue.splice(i, 1);
      renderQueue();
    });
    li.append(t, del);
    q.append(li);
  });
}

async function startTask(task, followUp = false) {
  if (!task || current) return;
  settings = readSettings();
  const cap = settings.agent.dailyCapUsd;
  const budget = cap > 0 ? Math.max(0, cap - spentToday()) : 0;
  if (cap > 0 && budget <= 0) {
    $("status").textContent = "Daily spend cap reached — raise it under Limits & sites.";
    return;
  }
  const provider = $("provider").value;
  const model = $("model").value.trim();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  current = { id, task, provider, model, startedAt: Date.now(), paused: false, host: "" };
  $("log").innerHTML = "";
  $("answerCard").hidden = true;
  $("answer").textContent = "";
  $("answer").classList.remove("live");
  $("plan").hidden = true;
  $("plan").innerHTML = "";
  $("shotWrap").hidden = true;
  $("shotWrap").open = false;
  $("status").textContent = "Working…";
  setState("running", "Working");
  setRunning(true);
  const petName = settings.petNames[settings.pet] || "";
  try {
    await invoke("agent_run", {
      req: {
        id, task, provider, model,
        baseUrl: settings.agent.baseUrls[provider] ?? "",
        petName,
        maxTurns: settings.agent.maxTurns,
        allowedSites: settings.agent.allowedSites,
        siteRules: settings.agent.siteRules,
        budgetUsd: budget,
        purchaseCap: settings.agent.purchaseCap,
        browser: settings.agent.browser,
        digestModel: settings.agent.digestModel,
        continuePrevious: followUp,
        stream: settings.agent.stream,
      },
    });
  } catch (err) {
    finish("error", String(err));
  }
}

$("cancel").addEventListener("click", () => {
  if (current) invoke("agent_cancel", { id: current.id }).catch(() => {});
});
$("pause").addEventListener("click", () => {
  if (!current) return;
  current.paused = !current.paused;
  invoke("agent_pause", { id: current.id, paused: current.paused }).catch(() => {});
  $("pause").textContent = current.paused ? "Resume" : "Pause";
  $("status").textContent = current.paused ? "Paused — take over in the browser, then Resume." : "Working…";
  setState(current.paused ? "paused" : "running", current.paused ? "Paused" : "Working");
});
$("kill").addEventListener("click", () => {
  queue.length = 0;
  renderQueue();
  invoke("agent_kill").catch(() => {});
});

// approvals and questions
function showAsk(kind, text, host) {
  $("askCard").hidden = false;
  $("askTitle").textContent = kind === "confirm" ? "Approve this step?" : "The pet has a question";
  if (current) current.waitingSince = Date.now();
  // Setting textContent above dropped the timer span; put it back.
  let wait = $("askWait");
  if (!wait) {
    wait = document.createElement("span");
    wait.id = "askWait";
    wait.className = "wait";
  }
  wait.textContent = "";
  $("askTitle").append(wait);
  $("askText").textContent = text;
  $("askConfirm").hidden = kind !== "confirm";
  $("askRules").hidden = kind !== "confirm" || !host;
  $("askReply").hidden = kind === "confirm";
  if (current) current.host = host || "";
  if (kind !== "confirm") {
    $("replyText").value = "";
    $("replyText").focus();
  }
  $("status").textContent = kind === "confirm" ? "Waiting for your approval…" : "Waiting for your answer…";
  setState("waiting", kind === "confirm" ? "Needs approval" : "Needs an answer");
  $("askCard").scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (kind === "confirm") $("approve").focus();
}
function hideAsk() {
  $("askCard").hidden = true;
  if (current) current.waitingSince = 0;
}
function reply(text) {
  if (!current) return;
  invoke("agent_reply", { id: current.id, text }).catch(() => {});
  hideAsk();
  $("status").textContent = "Working…";
  setState("running", "Working");
}
$("approve").addEventListener("click", () => reply("yes"));
$("deny").addEventListener("click", () => reply("no"));
$("alwaysAllow").addEventListener("click", () => {
  if (current?.host) setRule(current.host, "allow");
  reply("yes");
});
$("neverAllow").addEventListener("click", () => {
  if (current?.host) setRule(current.host, "never");
  reply("no");
});
$("replySend").addEventListener("click", () => reply($("replyText").value.trim() || "done"));
$("replyText").addEventListener("keydown", (e) => {
  if (e.key === "Enter") reply($("replyText").value.trim() || "done");
});

function finish(status, text) {
  if (!current) return;
  const done = { ...current };
  const took = mmss(Date.now() - done.startedAt);
  // Log while `current` is still set so the line gets a timestamp.
  logLine(status === "done" ? "answer" : status, status === "done" ? "Answer ready" : text);
  current = null;
  setRunning(false);
  $("elapsed").textContent = took;
  $("answer").classList.remove("live");
  $("status").textContent = status === "done" ? `Done in ${took}` : status === "cancelled" ? "Cancelled." : "Failed.";
  setState(status === "done" ? "done" : status === "cancelled" ? "idle" : "error", status === "done" ? "Done" : status === "cancelled" ? "Cancelled" : "Failed");
  if (status === "done") {
    for (const li of $("plan").querySelectorAll('[data-status="doing"]')) li.dataset.status = "done";
    $("answerCard").hidden = false;
    renderAnswer(text);
    answeredOnce = true;
    $("followRow").hidden = false; // opt-in: ticking it continues with this task's context
    $("answerCard").scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (settings.agent.speak) speak(text);
  }
  if (queue.length) {
    const next = queue.shift();
    renderQueue();
    $("task").value = next.task;
    setTimeout(() => startTask(next.task, false), 400);
  }
}

/** Plain text with clickable links; nothing else is interpreted. */
function renderAnswer(text) {
  const box = $("answer");
  box.innerHTML = "";
  const re = /https?:\/\/[^\s)\]>"']+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    box.append(document.createTextNode(text.slice(last, m.index)));
    const a = document.createElement("a");
    a.href = m[0];
    a.textContent = m[0];
    a.addEventListener("click", (e) => {
      e.preventDefault();
      invoke("open_external", { url: a.href }).catch(() => {});
    });
    box.append(a);
    last = m.index + m[0].length;
  }
  box.append(document.createTextNode(text.slice(last)));
}

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("answer").textContent);
    $("copy").textContent = "Copied";
    setTimeout(() => ($("copy").textContent = "Copy"), 1200);
  } catch {
    /* clipboard blocked */
  }
});

function speak(text) {
  try {
    speechSynthesis.cancel();
    const v = getPet(settings.pet)?.voice ?? { pitch: 1, rate: 1 };
    const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "link").slice(0, 1200));
    u.pitch = v.pitch;
    u.rate = v.rate;
    speechSynthesis.speak(u);
  } catch {
    /* no voices */
  }
}
$("speak").addEventListener("click", () => speak($("answer").textContent));
$("followBtn").addEventListener("click", () => {
  $("followUp").checked = true;
  $("task").value = "";
  $("task").placeholder = "Ask a follow-up about that answer…";
  autosize();
  $("task").focus();
  $("task").scrollIntoView({ block: "nearest", behavior: "smooth" });
});

listen("pet://task", ({ payload }) => {
  const { kind, text, detail } = payload;
  if (kind === "killed") {
    if (current) finish("cancelled", "Stopped by the kill switch.");
    logLine("killed", text);
    return;
  }
  if (!current || payload.id !== current.id) return;
  switch (kind) {
    case "delta": {
      // Live answer text; the final "answer" event replaces it.
      const box = $("answer");
      if ($("answerCard").hidden) {
        $("answerCard").hidden = false;
        box.textContent = "";
      }
      box.classList.add("live");
      box.append(document.createTextNode(text));
      return;
    }
    case "answer":
      return finish("done", text);
    case "error":
      return finish("error", text);
    case "cancelled":
      return finish("cancelled", text);
    case "confirm":
    case "ask":
      logLine(kind, text);
      return showAsk(kind, text, detail?.host);
    case "plan": {
      $("plan").hidden = false;
      $("plan").innerHTML = "";
      for (const s of detail?.steps ?? []) {
        const li = document.createElement("li");
        li.textContent = s;
        $("plan").append(li);
      }
      return;
    }
    case "step": {
      const li = $("plan").children[detail?.index ?? -1];
      if (li) li.dataset.status = detail.status;
      return;
    }
    case "shot":
      $("shotWrap").hidden = false;
      $("shot").src = `data:image/jpeg;base64,${detail?.jpeg ?? ""}`;
      return logLine("browser", text);
    case "usage":
      $("spend").textContent = `· $${(spentToday() + (detail?.usd ?? 0)).toFixed(3)} today`;
      return;
    case "act":
      return;
    case "tool":
    case "note":
      // A new model turn started (text streaming stopped); clear the live box.
      $("answer").classList.remove("live");
      logLine(kind, text);
      return;
    default:
      logLine(kind, text);
  }
});

// --- voice input ----------------------------------------------------------------------
// Windows engine: one call, the OS listens until you pause. Whisper engine:
// hold the button (or press the hotkey to toggle), the clip goes to Whisper.

let recorder = null;
let chunks = [];
let listening = false;

async function listenWindows() {
  if (listening) return;
  listening = true;
  $("mic").classList.add("recording");
  $("status").textContent = "Listening… speak, then pause.";
  try {
    const text = await invoke("windows_listen");
    $("task").value = ($("task").value.trim() ? $("task").value.trim() + " " : "") + text;
    $("status").textContent = "Heard you. Press Go.";
  } catch (err) {
    $("status").textContent = String(err);
  } finally {
    listening = false;
    $("mic").classList.remove("recording");
  }
}

async function startRecording() {
  if (recorder) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      recorder = null;
      $("mic").classList.remove("recording");
      if (blob.size < 2000) return;
      $("status").textContent = "Transcribing…";
      try {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(blob);
        });
        const text = await invoke("agent_transcribe", { audioB64: b64, mime: "audio/webm" });
        $("task").value = ($("task").value.trim() ? $("task").value.trim() + " " : "") + text;
        $("status").textContent = "Heard you. Press Go.";
      } catch (err) {
        $("status").textContent = String(err);
      }
    };
    recorder.start();
    $("mic").classList.add("recording");
    $("status").textContent = "Listening… release to stop.";
  } catch (err) {
    $("status").textContent = `Microphone unavailable: ${err.message ?? err}. Try the Windows engine under Providers › Voice.`;
  }
}
function stopRecording() {
  if (recorder && recorder.state === "recording") recorder.stop();
}
const whisperMode = () => settings.agent.voiceEngine === "whisper";
$("mic").addEventListener("pointerdown", () => (whisperMode() ? startRecording() : listenWindows()));
$("mic").addEventListener("pointerup", () => whisperMode() && stopRecording());
$("mic").addEventListener("pointerleave", () => whisperMode() && stopRecording());

// Hotkeys from Rust: voice (toggle) and clipboard.
listen("pet://voice", () => {
  showTab("run");
  if (whisperMode()) {
    if (recorder) stopRecording();
    else startRecording();
  } else listenWindows();
});
listen("pet://clip", ({ payload }) => {
  showTab("run");
  const text = (payload?.text ?? "").trim();
  $("task").value = text ? `Do this with the text below:\n\n${text.slice(0, 2000)}` : "";
  autosize();
  $("task").focus();
  $("task").setSelectionRange(0, 0);
});

// --- history -------------------------------------------------------------------------

function renderHistory() {
  settings = readSettings();
  const list = $("history");
  list.innerHTML = "";
  const items = [...settings.tasks].reverse();
  $("historyCount").textContent = items.length ? `${items.length}` : "";
  if (!items.length) list.innerHTML = '<li class="hint">No tasks yet.</li>';
  const mini = (text, title, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mini";
    b.textContent = text;
    b.title = title;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };
  const open = (t) => {
    $("task").value = t.task;
    autosize();
    if (t.status === "done" && t.answer) {
      $("answerCard").hidden = false;
      renderAnswer(t.answer);
    }
    showTab("run");
  };
  items.forEach((t, i) => {
    const li = document.createElement("li");
    li.dataset.text = `${t.task} ${t.provider} ${t.model ?? ""} ${t.status}`.toLowerCase();
    const title = document.createElement("div");
    title.textContent = t.task;
    const meta = document.createElement("div");
    meta.className = `meta ${t.status === "error" ? "status-error" : ""}`;
    meta.textContent = `${new Date(t.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${t.provider}${t.model ? " · " + t.model : ""} · ${t.status}`;
    const tools = document.createElement("span");
    tools.className = "tools";
    tools.append(
      mini("▶ Run again", "Run this task again", () => {
        open(t);
        submitTask(t.task, false);
      }),
    );
    // Only the newest task still has its context on the Rust side.
    if (i === 0 && t.status === "done") {
      tools.append(
        mini("↩ Follow up", "Ask something more about this answer", () => {
          open(t);
          $("followBtn").click();
        }),
      );
    }
    tools.append(
      mini("Log", "Open this task's log file", async () => {
        const ok = await invoke("open_task_log", { id: t.id }).catch(() => false);
        if (!ok) $("status").textContent = "No log file for that task.";
      }),
    );
    meta.append(tools);
    li.append(title, meta);
    li.addEventListener("click", () => open(t));
    list.append(li);
  });
  filterHistory();
}

function filterHistory() {
  const q = $("historyFilter").value.trim().toLowerCase();
  let shown = 0;
  for (const li of $("history").querySelectorAll("li[data-text]")) {
    const hit = !q || li.dataset.text.includes(q);
    li.classList.toggle("filtered-out", !hit);
    shown += hit;
  }
  const total = $("history").querySelectorAll("li[data-text]").length;
  $("historyCount").textContent = total ? (q ? `${shown} of ${total}` : `${total}`) : "";
}
$("historyFilter").addEventListener("input", filterHistory);

$("clearHistory").addEventListener("click", () => {
  save({ tasks: [] });
  renderHistory();
});

// --- boot ------------------------------------------------------------------------------

for (const e of EXAMPLES) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = e.length > 60 ? e.slice(0, 58) + "…" : e;
  b.title = e;
  b.addEventListener("click", () => {
    $("task").value = e;
    autosize();
    $("task").focus();
  });
  $("examples").append(b);
}
$("log").innerHTML = '<li class="empty">Nothing running yet — type an errand above and press Go.</li>';
// Offline dictation is the Windows recogniser; elsewhere only Whisper works.
if (!/Windows/i.test(navigator.userAgent)) {
  const opt = $("voiceEngine").querySelector('option[value="windows"]');
  if (opt) {
    opt.disabled = true;
    opt.textContent = "Windows (offline) — Windows only";
  }
  if (settings.agent.voiceEngine === "windows") save({ agent: { voiceEngine: "whisper" } });
}
// The sticky approval card sits just under the header, whose height changes
// when the tabs wrap.
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty("--header-h", `${Math.round(entry.contentRect.height + 12)}px`);
}).observe(document.querySelector("header"));
$("mic").hidden = !settings.agent.voice;
window.addEventListener("storage", () => {
  settings = readSettings();
  paintSpend();
});
listen("pet://settings", () => {
  settings = readSettings();
  paintSpend();
  if (!document.querySelector('[data-panel="history"]').hidden) renderHistory();
});
loadProviders();
paintSpend();
